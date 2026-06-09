import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from db.database import SQLALCHEMY_DATABASE_URL
from models.core import Execution, TestCase
from sqlalchemy.future import select
import traceback

async def main():
    engine = create_async_engine(SQLALCHEMY_DATABASE_URL)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as db:
        try:
            exec_result = await db.execute(
                select(Execution, TestCase).join(TestCase, Execution.test_case_id == TestCase.id).order_by(Execution.started_at.desc()).limit(20)
            )
            for ex, tc in exec_result.all():
                print(ex.status.lower())
        except Exception as e:
            traceback.print_exc()

asyncio.run(main())
