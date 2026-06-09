import asyncio
from db.database import AsyncSessionLocal
from sqlalchemy import text

async def migrate():
    async with AsyncSessionLocal() as db:
        queries = [
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(50);",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id INTEGER REFERENCES sprints(id) ON DELETE SET NULL;",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL;",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status VARCHAR(50);",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50);",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reference_id INTEGER;",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;",
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"
        ]
        
        for q in queries:
            try:
                await db.execute(text(q))
                await db.commit()
                print(f"Executed: {q}")
            except Exception as e:
                await db.rollback()
                print(f"Failed: {q} -> {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
