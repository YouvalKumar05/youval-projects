import asyncio
from db.database import AsyncSessionLocal
from models.core import TestCase, Analysis
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as db:
        print("--- Test Cases Project IDs ---")
        res_tc = await db.execute(select(TestCase.project_id).distinct())
        print(res_tc.scalars().all())
        
        print("\n--- Analyses Project Names ---")
        res_an = await db.execute(select(Analysis.project_name).distinct())
        print(res_an.scalars().all())

if __name__ == "__main__":
    asyncio.run(check())
