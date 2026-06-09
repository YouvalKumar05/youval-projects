import asyncio
import os
from sqlalchemy.future import select
from passlib.context import CryptContext
from db.database import AsyncSessionLocal
from models.core import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def reset_password():
    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.email == "admin@autoqa.local")
        result = await db.execute(stmt)
        user = result.scalars().first()
        if user:
            user.password_hash = pwd_context.hash("admin123")
            await db.commit()
            print(f"Password reset for: {user.email}")
        else:
            print("User NOT found")

if __name__ == "__main__":
    asyncio.run(reset_password())
