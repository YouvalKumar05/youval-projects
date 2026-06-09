from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from db.database import get_db
from models.core import Thread, Message, User, Notification
from schemas.api_models import StandardResponse
from middleware.rbac import require_permission, get_current_user
from routes.ws import broadcast_dashboard_event

router = APIRouter(prefix="/api/communications", tags=["communications"])

@router.get("/threads", response_model=StandardResponse)
async def get_threads(db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("communications:read"))):
    # Fetch threads with their last message
    stmt = select(Thread).options(joinedload(Thread.messages)).order_by(Thread.created_at.desc())
    result = await db.execute(stmt)
    threads = result.unique().scalars().all()
    
    data = []
    for t in threads:
        last_msg = t.messages[-1] if t.messages else None
        
        # Get sender of last message
        sender_email = "System"
        if last_msg and last_msg.sender_id:
            s_stmt = select(User).where(User.id == last_msg.sender_id)
            s_res = await db.execute(s_stmt)
            sender = s_res.scalar_one_or_none()
            if sender:
                sender_email = sender.email

        data.append({
            "id": t.id,
            "subject": t.subject or f"{t.reference_type} #{t.reference_id}",
            "reference_type": t.reference_type,
            "reference_id": t.reference_id,
            "unread_count": t.unread_count,
            "created_at": t.created_at,
            "last_message": {
                "body": last_msg.body if last_msg else "",
                "created_at": last_msg.created_at if last_msg else t.created_at,
                "sender": sender_email
            } if last_msg else None
        })
    
    return StandardResponse(status="success", data=data)

@router.get("/threads/{thread_id}", response_model=StandardResponse)
async def get_thread_messages(thread_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("communications:read"))):
    stmt = select(Thread).options(joinedload(Thread.messages)).where(Thread.id == thread_id)
    result = await db.execute(stmt)
    thread = result.unique().scalar_one_or_none()
    
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
        
    # Mark as read
    thread.unread_count = 0
    await db.commit()

    messages_data = []
    for msg in thread.messages:
        sender_stmt = select(User).where(User.id == msg.sender_id)
        sender_res = await db.execute(sender_stmt)
        sender = sender_res.scalar_one_or_none()
        
        messages_data.append({
            "id": msg.id,
            "body": msg.body,
            "created_at": msg.created_at,
            "sender": {
                "id": sender.id,
                "email": sender.email
            } if sender else {"email": "System"}
        })
        
    return StandardResponse(status="success", data={
        "id": thread.id,
        "subject": thread.subject,
        "reference_type": thread.reference_type,
        "reference_id": thread.reference_id,
        "messages": messages_data
    })

@router.post("/threads", response_model=StandardResponse)
async def create_thread(payload: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("communications:write"))):
    ref_type = payload.get("reference_type")
    ref_id = payload.get("reference_id")
    subject = payload.get("subject")
    body = payload.get("body")
    to_user_id = payload.get("to_user_id") # Optional specific recipient

    thread = Thread(reference_type=ref_type, reference_id=ref_id, subject=subject, unread_count=1)
    db.add(thread)
    await db.flush()
        
    new_msg = Message(thread_id=thread.id, sender_id=current_user.id, body=body)
    db.add(new_msg)
    
    # Create notification if recipient specified
    if to_user_id:
        notif = Notification(
            user_id=to_user_id,
            title=f"New message from {current_user.email}",
            message=subject or body[:50],
            link_url=f"/communications?thread={thread.id}"
        )
        db.add(notif)
    
    await db.commit()
    await db.refresh(new_msg)
    
    # Broadcast via WS
    await broadcast_dashboard_event({
        "type": "new_message",
        "thread_id": thread.id,
        "sender": current_user.email
    })
    
    return StandardResponse(status="success", message="Thread created", data={"thread_id": thread.id})

@router.post("/threads/{thread_id}/reply", response_model=StandardResponse)
async def reply_to_thread(thread_id: int, payload: dict, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("communications:write"))):
    body = payload.get("body")
    
    stmt = select(Thread).where(Thread.id == thread_id)
    result = await db.execute(stmt)
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    new_msg = Message(thread_id=thread_id, sender_id=current_user.id, body=body)
    db.add(new_msg)
    
    thread.unread_count += 1
    await db.commit()
    
    await broadcast_dashboard_event({
        "type": "new_reply",
        "thread_id": thread_id,
        "sender": current_user.email
    })
    
    return StandardResponse(status="success", message="Reply sent")

@router.get("/notifications", response_model=StandardResponse)
async def get_notifications(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc())
    result = await db.execute(stmt)
    notifs = result.scalars().all()
    return StandardResponse(status="success", data=notifs)

@router.post("/notifications/{notif_id}/read", response_model=StandardResponse)
async def mark_notif_read(notif_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    stmt = select(Notification).where(Notification.id == notif_id, Notification.user_id == current_user.id)
    result = await db.execute(stmt)
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
    return StandardResponse(status="success")
