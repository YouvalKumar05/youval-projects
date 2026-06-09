from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import List, Dict, Any
from pydantic import BaseModel

from db.database import get_db
from models.core import User, Role, Permission, RolePermission
from schemas.api_models import StandardResponse, RoleCreate
from middleware.rbac import require_permission

router = APIRouter(prefix="/api/rbac", tags=["rbac"])

# ---- API SCHEMAS ----
class BulkPermissions(BaseModel):
    role_id: int
    permissions: List[Dict[str, str]] # [{'resource_name': 'tasks', 'action': 'read'}, ...]

# ---- ROLES ----
@router.get("/roles", response_model=StandardResponse)
async def get_roles(db: AsyncSession = Depends(get_db)):
    stmt = select(Role)
    result = await db.execute(stmt)
    roles = result.scalars().all()
    
    data = []
    for r in roles:
        data.append({
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "parent_role_id": r.parent_role_id
        })
    return StandardResponse(status="success", data=data)

@router.post("/roles", response_model=StandardResponse)
async def create_role(role_data: RoleCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("rbac:write"))):
    new_role = Role(
        name=role_data.name,
        description=role_data.description,
        parent_role_id=role_data.parent_role_id
    )
    db.add(new_role)
    await db.commit()
    await db.refresh(new_role)
    return StandardResponse(status="success", message="Role created", data={"id": new_role.id})

@router.put("/roles/{role_id}", response_model=StandardResponse)
async def update_role(role_id: int, role_data: RoleCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("rbac:write"))):
    stmt = select(Role).where(Role.id == role_id)
    result = await db.execute(stmt)
    role = result.scalars().first()
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    role.name = role_data.name
    role.description = role_data.description
    
    # Check for circular dependency
    if role_data.parent_role_id == role_id:
        raise HTTPException(status_code=400, detail="A role cannot be its own parent")
        
    role.parent_role_id = role_data.parent_role_id
    
    await db.commit()
    return StandardResponse(status="success", message="Role updated")

@router.delete("/roles/{role_id}", response_model=StandardResponse)
async def delete_role(role_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("rbac:write"))):
    stmt = select(Role).where(Role.id == role_id)
    result = await db.execute(stmt)
    role = result.scalars().first()
    
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    await db.delete(role)
    await db.commit()
    return StandardResponse(status="success", message="Role deleted")

# ---- PERMISSIONS ----
@router.get("/permissions", response_model=StandardResponse)
async def get_permissions(db: AsyncSession = Depends(get_db)):
    stmt = select(Permission)
    result = await db.execute(stmt)
    perms = result.scalars().all()
    
    data = [{"id": p.id, "resource_name": p.resource_name, "action": p.action} for p in perms]
    return StandardResponse(status="success", data=data)

@router.get("/roles/{role_id}/permissions", response_model=StandardResponse)
async def get_role_permissions(role_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Permission).join(RolePermission).where(RolePermission.role_id == role_id)
    result = await db.execute(stmt)
    perms = result.scalars().all()
    
    data = [{"id": p.id, "resource_name": p.resource_name, "action": p.action} for p in perms]
    return StandardResponse(status="success", data=data)

@router.post("/assign-permissions", response_model=StandardResponse)
async def assign_permissions(req: BulkPermissions, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("rbac:write"))):
    role_id = req.role_id
    
    # Ensure role exists
    role_check = await db.execute(select(Role).where(Role.id == role_id))
    if not role_check.scalars().first():
        raise HTTPException(status_code=404, detail="Role not found")
        
    # Clear existing permissions for role
    await db.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
    
    # Process desired permissions array
    for p in req.permissions:
        r_name = p['resource_name']
        action = p['action']
        
        # Check if permission exists in master list
        p_stmt = select(Permission).where(Permission.resource_name == r_name, Permission.action == action)
        perm = (await db.execute(p_stmt)).scalars().first()
        
        # If it doesn't exist dynamically create it
        if not perm:
            perm = Permission(resource_name=r_name, action=action)
            db.add(perm)
            await db.flush() # get ID
            
        rp = RolePermission(role_id=role_id, permission_id=perm.id)
        db.add(rp)
        
    await db.commit()
    return StandardResponse(status="success", message="Permissions successfully synced")

# ---- USERS ----
@router.get("/users/{role_id}", response_model=StandardResponse)
async def get_role_users(role_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.role_id == role_id)
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    data = [{"id": u.id, "email": u.email, "is_active": u.is_active} for u in users]
    return StandardResponse(status="success", data=data)

@router.get("/users", response_model=StandardResponse)
async def get_all_users(db: AsyncSession = Depends(get_db)):
    stmt = select(User)
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    data = [{"id": u.id, "email": u.email, "is_active": u.is_active, "role_id": u.role_id} for u in users]
    return StandardResponse(status="success", data=data)
