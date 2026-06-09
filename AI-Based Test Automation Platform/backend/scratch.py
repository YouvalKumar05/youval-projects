import asyncio
from db.database import AsyncSessionLocal
from sqlalchemy.future import select
from models.core import Execution

async def check():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Execution).order_by(Execution.id.desc()).limit(5))
        execs = result.scalars().all()
        for e in execs:
            print(f"ID: {e.id}, Status: {e.status}, Step Results: {bool(e.step_results)}")

asyncio.run(check())
