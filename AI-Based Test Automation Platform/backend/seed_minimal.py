import asyncio
from db.database import AsyncSessionLocal
from models.core import Project, Sprint, Version
from datetime import date, timedelta

async def seed():
    async with AsyncSessionLocal() as db:
        p = Project(name="AutoQA Enterprise", description="Main automation project")
        db.add(p)
        await db.flush()
        
        s = Sprint(project_id=p.id, name="Sprint 1 - MVP", start_date=date.today(), end_date=date.today() + timedelta(days=14), status="Active")
        db.add(s)
        await db.flush()
        
        v = Version(sprint_id=s.id, version_number="v1.0.0", status="Draft")
        db.add(v)
        
        await db.commit()
        print("Seed successful.")

if __name__ == "__main__":
    asyncio.run(seed())
