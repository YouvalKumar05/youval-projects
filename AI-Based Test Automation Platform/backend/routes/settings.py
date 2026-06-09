from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import List, Optional
from passlib.hash import bcrypt

from db.database import get_db
from models.core import User, UserSetting, UserSession, APIToken, Role
from schemas.api_models import StandardResponse
from middleware.rbac import get_current_user
import secrets

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("/profile", response_model=StandardResponse)
async def get_profile(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Need to fetch role name
    stmt = select(Role.name).where(Role.id == current_user.role_id)
    role_name = (await db.execute(stmt)).scalar_one_or_none() or "Team Member"
    
    return StandardResponse(status="success", data={
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name or current_user.email.split('@')[0],
        "role": role_name,
        "profile_image_url": current_user.profile_image_url,
        "theme": current_user.theme,
        "timezone": current_user.timezone
    })

@router.put("/profile", response_model=StandardResponse)
async def update_profile(payload: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.name = payload.get("name", current_user.name)
    current_user.profile_image_url = payload.get("profile_image_url", current_user.profile_image_url)
    current_user.theme = payload.get("theme", current_user.theme)
    current_user.timezone = payload.get("timezone", current_user.timezone)
    
    await db.commit()
    return StandardResponse(status="success", message="Profile updated", data={"theme": current_user.theme})

@router.post("/change-password", response_model=StandardResponse)
async def change_password(payload: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_pass = payload.get("current_password")
    new_pass = payload.get("new_password")
    
    if not bcrypt.verify(current_pass, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    current_user.password_hash = bcrypt.hash(new_pass)
    await db.commit()
    return StandardResponse(status="success", message="Password changed successfully")

@router.get("/notifications", response_model=StandardResponse)
async def get_notification_settings(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
    settings = (await db.execute(stmt)).scalar_one_or_none()
    
    if not settings:
        settings = UserSetting(user_id=current_user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
        
    return StandardResponse(status="success", data={
        "email_enabled": settings.email_enabled,
        "inapp_enabled": settings.inapp_enabled,
        "execution_alerts": settings.execution_alerts,
        "bug_alerts": settings.bug_alerts,
        "workflow_alerts": settings.workflow_alerts
    })

@router.put("/notifications", response_model=StandardResponse)
async def update_notification_settings(payload: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = select(UserSetting).where(UserSetting.user_id == current_user.id)
    settings = (await db.execute(stmt)).scalar_one_or_none()
    
    if not settings:
        settings = UserSetting(user_id=current_user.id)
        db.add(settings)
        
    settings.email_enabled = payload.get("email_enabled", settings.email_enabled)
    settings.inapp_enabled = payload.get("inapp_enabled", settings.inapp_enabled)
    settings.execution_alerts = payload.get("execution_alerts", settings.execution_alerts)
    settings.bug_alerts = payload.get("bug_alerts", settings.bug_alerts)
    settings.workflow_alerts = payload.get("workflow_alerts", settings.workflow_alerts)
    
    await db.commit()
    return StandardResponse(status="success", message="Notification settings updated")

@router.get("/sessions", response_model=StandardResponse)
async def get_sessions(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = select(UserSession).where(UserSession.user_id == current_user.id).order_by(UserSession.created_at.desc())
    sessions = (await db.execute(stmt)).scalars().all()
    return StandardResponse(status="success", data=sessions)

@router.delete("/sessions", response_model=StandardResponse)
async def revoke_all_sessions(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # In a real app with JWT refresh tokens, you'd blacklist them here
    stmt = delete(UserSession).where(UserSession.user_id == current_user.id)
    await db.execute(stmt)
    await db.commit()
    return StandardResponse(status="success", message="All sessions revoked")

@router.post("/api-token", response_model=StandardResponse)
async def generate_token(payload: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    name = payload.get("name", "New Token")
    raw_token = f"aq_{secrets.token_urlsafe(32)}"
    token_hash = bcrypt.hash(raw_token)
    
    new_token = APIToken(user_id=current_user.id, name=name, token_hash=token_hash)
    db.add(new_token)
    await db.commit()
    
    return StandardResponse(status="success", message="Token generated. Copy it now, it won't be shown again.", data={"token": raw_token})

@router.get("/api-tokens", response_model=StandardResponse)
async def get_tokens(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = select(APIToken).where(APIToken.user_id == current_user.id)
    tokens = (await db.execute(stmt)).scalars().all()
    # Map to exclude hashes
    data = [{"id": t.id, "name": t.name, "created_at": t.created_at, "last_used": t.last_used} for t in tokens]
    return StandardResponse(status="success", data=data)

@router.delete("/api-token/{token_id}", response_model=StandardResponse)
async def delete_token(token_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = delete(APIToken).where(APIToken.id == token_id, APIToken.user_id == current_user.id)
    await db.execute(stmt)
    await db.commit()
    return StandardResponse(status="success", message="Token revoked")
