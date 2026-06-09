from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import Optional, List

from db.database import get_db
from models.core import User, Role, RolePermission, Permission

SECRET_KEY = "your-very-secret-key-for-autoqa"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    stmt = select(User).options(selectinload(User.role)).where(User.email == email)
    result = await db.execute(stmt)
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    return user

async def get_role_hierarchy_permissions(role_id: int, db: AsyncSession) -> List[str]:
    # Recursively fetch permissions for role and parent roles
    collected_permissions = []
    current_role_id = role_id
    
    while current_role_id is not None:
        # Fetch permissions for this role
        stmt = select(Permission.resource_name, Permission.action).join(RolePermission).where(RolePermission.role_id == current_role_id)
        result = await db.execute(stmt)
        perms = result.all()
        for resource_name, action in perms:
            collected_permissions.append(f"{resource_name}:{action}")
            
        # Get parent role
        role_stmt = select(Role.parent_role_id).where(Role.id == current_role_id)
        role_result = await db.execute(role_stmt)
        parent_id = role_result.scalar_one_or_none()
        
        # Prevent infinite loops in case of bad data
        if parent_id == current_role_id:
            break
        current_role_id = parent_id

    return collected_permissions

def require_permission(required_permission: str):
    async def permission_dependency(
        current_user: User = Depends(get_current_user), 
        db: AsyncSession = Depends(get_db)
    ):
        if not current_user.role_id:
            raise HTTPException(status_code=403, detail="User has no assigned role")
            
        # Bypass for Admin role
        stmt = select(Role.name).where(Role.id == current_user.role_id)
        role_name = (await db.execute(stmt)).scalar_one_or_none()
        
        if role_name == "Admin":
            return current_user

        user_permissions = await get_role_hierarchy_permissions(current_user.role_id, db)
        
        if required_permission not in user_permissions and "admin:all" not in user_permissions:
            raise HTTPException(status_code=403, detail=f"Insufficient permissions. Required: {required_permission}")
            
        return current_user
        
    return permission_dependency
