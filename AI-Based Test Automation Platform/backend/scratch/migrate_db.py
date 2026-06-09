import asyncio
from sqlalchemy import text
from db.database import engine

async def migrate():
    print("Starting migration...")
    async with engine.begin() as conn:
        # Add project_id to analyses
        try:
            await conn.execute(text("ALTER TABLE analyses ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL"))
            print("Successfully added project_id to analyses")
        except Exception as e:
            print(f"Skipping project_id on analyses: {e}")

        # Also add any other missing columns from my previous turn's schema updates
        # e.g. versions, sprints tables might be missing if they weren't created
        
    print("Migration finished.")

if __name__ == "__main__":
    asyncio.run(migrate())
