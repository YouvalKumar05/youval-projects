from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from passlib.context import CryptContext

from db.database import get_db
from models.core import User, Role, Permission, RolePermission
from schemas.api_models import TokenResponse, StandardResponse, RoleCreate, RoleResponse
from middleware.rbac import create_access_token, require_permission

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == form_data.username)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        # Auto-create admin on first login if credentials match known admin email
        if form_data.username == "admin@autoqa.local":
            try:
                # Find or create Admin role
                role_stmt = select(Role).where(Role.name == "Admin")
                role_result = await db.execute(role_stmt)
                admin_role = role_result.scalars().first()
                if not admin_role:
                    admin_role = Role(name="Admin", description="Superuser")
                    db.add(admin_role)
                    await db.flush()

                user = User(
                    email=form_data.username,
                    password_hash=get_password_hash(form_data.password),
                    role_id=admin_role.id
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
            except Exception as e:
                await db.rollback()
                raise HTTPException(status_code=500, detail=f"Auto-create failed: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="Incorrect email or password")
    else:
        if not verify_password(form_data.password, user.password_hash):
            raise HTTPException(status_code=400, detail="Incorrect email or password")

    # Get role name for the response
    role_name = None
    if user.role_id:
        role_stmt = select(Role).where(Role.id == user.role_id)
        role_result = await db.execute(role_stmt)
        role = role_result.scalars().first()
        if role:
            role_name = role.name

    access_token = create_access_token(data={"sub": user.email})
    
    # NEW: Create a login session record
    try:
        from models.core import UserSession
        # In a real app, you'd extract device/IP from request headers
        new_session = UserSession(
            user_id=user.id, 
            device="Web Browser", 
            ip_address="Unknown", 
            location="Remote Access"
        )
        db.add(new_session)
        await db.commit()
    except Exception as e:
        print(f"Session recording failed: {e}")
        await db.rollback()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_role": role_name,
        "role_id": user.role_id, # Added for RBAC checks in frontend
        "user_name": user.name or user.email.split("@")[0].replace(".", " ").title(),
        "user_email": user.email,
    }

@router.get("/roles", response_model=StandardResponse)
async def list_roles(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("roles:read"))):
    stmt = select(Role)
    result = await db.execute(stmt)
    roles = result.scalars().all()
    
    roles_list = []
    for r in roles:
        # Fetch permissions for each role
        perm_stmt = select(Permission).join(RolePermission).where(RolePermission.role_id == r.id)
        perm_res = await db.execute(perm_stmt)
        perms = perm_res.scalars().all()
        
        roles_list.append({
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "parent_role_id": r.parent_role_id,
            "permissions": [f"{p.resource_name}:{p.action}" for p in perms]
        })
        
    return StandardResponse(status="success", data=roles_list)

@router.get("/permissions", response_model=StandardResponse)
async def list_permissions(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("roles:read"))):
    stmt = select(Permission)
    result = await db.execute(stmt)
    perms = result.scalars().all()
    return StandardResponse(status="success", data=[{"id": p.id, "resource_name": p.resource_name, "action": p.action} for p in perms])


@router.post("/roles", response_model=StandardResponse)
async def create_role(role_data: RoleCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("roles:write"))):
    new_role = Role(name=role_data.name, description=role_data.description, parent_role_id=role_data.parent_role_id)
    db.add(new_role)
    await db.commit()
    await db.refresh(new_role)
    return StandardResponse(status="success", message="Role created successfully", data={"role_id": new_role.id})

@router.post("/roles/{role_id}/permissions", response_model=StandardResponse)
async def set_role_permissions(role_id: int, permissions: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("rbac:write"))):
    # This endpoint receives { "testcases": {"read": true, "write": false}, ... }
    
    # 1. Clear existing perms for this role
    from models.core import RolePermission, Permission
    from sqlalchemy import delete
    await db.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
    
    # 2. Add new ones
    for res, actions in permissions.items():
        for action, enabled in actions.items():
            if enabled:
                # Find or create permission
                stmt = select(Permission).where(Permission.resource_name == res, Permission.action == action)
                p = (await db.execute(stmt)).scalars().first()
                if not p:
                    p = Permission(resource_name=res, action=action)
                    db.add(p)
                    await db.flush()
                
                db.add(RolePermission(role_id=role_id, permission_id=p.id))
                
    await db.commit()
    return StandardResponse(status="success", message="Permissions updated successfully")
