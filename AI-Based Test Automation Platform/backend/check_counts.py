import asyncio
from db.database import AsyncSessionLocal
from models.core import Project, Sprint, Version, TestCase, Execution
from sqlalchemy import func, select

async def m(): 
    async with AsyncSessionLocal() as db:
        pc = (await db.execute(select(func.count(Project.id)))).scalar_one()
        sc = (await db.execute(select(func.count(Sprint.id)))).scalar_one()
        vc = (await db.execute(select(func.count(Version.id)))).scalar_one()
        tc = (await db.execute(select(func.count(TestCase.id)))).scalar_one()
        ec = (await db.execute(select(func.count(Execution.id)))).scalar_one()
        print(f'Projects: {pc}, Sprints: {sc}, Versions: {vc}, TestCases: {tc}, Executions: {ec}')

if __name__ == "__main__":
    asyncio.run(m())
