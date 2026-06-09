import asyncio
import os
from sqlalchemy.future import select
from db.database import AsyncSessionLocal
from models.core import User

async def check_user():
    async with AsyncSessionLocal() as db:
        stmt = select(User).where(User.email == "admin@autoqa.local")
        result = await db.execute(stmt)
        user = result.scalars().first()
        if user:
            print(f"User found: {user.email}")
            print(f"Password Hash: {user.password_hash}")
        else:
            print("User NOT found")

if __name__ == "__main__":
    asyncio.run(check_user())
