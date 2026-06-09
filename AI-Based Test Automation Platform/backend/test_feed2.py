import asyncio
import sys
from db.database import AsyncSessionLocal
from models.core import Execution, TestCase
from sqlalchemy.future import select
import traceback

async def main():
    async with AsyncSessionLocal() as db:
        try:
            exec_result = await db.execute(
                select(Execution, TestCase).join(TestCase, Execution.test_case_id == TestCase.id).order_by(Execution.started_at.desc()).limit(20)
            )
            for ex, tc in exec_result.all():
                print(f"Status: {ex.status}, Started at: {ex.started_at}, Title: {tc.title}")
            print("Activity feed query successful.")
        except Exception as e:
            traceback.print_exc()

asyncio.run(main())
