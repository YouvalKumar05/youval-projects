import asyncio
from db.database import AsyncSessionLocal
from sqlalchemy import text

async def migrate():
    async with AsyncSessionLocal() as db:
        queries = [
            # Projects table (ensure it exists)
            "CREATE TABLE IF NOT EXISTS projects (id SERIAL PRIMARY KEY, name VARCHAR(100) UNIQUE NOT NULL, description TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
            
            # Sprints table
            "CREATE TABLE IF NOT EXISTS sprints (id SERIAL PRIMARY KEY, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, name VARCHAR(100) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, status VARCHAR(50) DEFAULT 'Active');",
            "ALTER TABLE sprints ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;",
            
            # Versions table
            "CREATE TABLE IF NOT EXISTS versions (id SERIAL PRIMARY KEY, sprint_id INTEGER REFERENCES sprints(id) ON DELETE CASCADE, version_number VARCHAR(50) NOT NULL, status VARCHAR(50) DEFAULT 'Draft', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
            "ALTER TABLE versions ADD COLUMN IF NOT EXISTS sprint_id INTEGER REFERENCES sprints(id) ON DELETE CASCADE;",
            
            # Additional columns for test_cases and executions (just in case)
            "ALTER TABLE test_cases ADD COLUMN IF NOT EXISTS version_id INTEGER REFERENCES versions(id) ON DELETE CASCADE;",
            "ALTER TABLE executions ADD COLUMN IF NOT EXISTS version_id INTEGER REFERENCES versions(id) ON DELETE CASCADE;",
            "ALTER TABLE executions ADD COLUMN IF NOT EXISTS execution_time INTEGER;"
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
