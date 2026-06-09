import asyncio
from sqlalchemy import text
from db.database import engine

async def migrate():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE analyses ADD COLUMN config_json JSON;"))
            print("Successfully added config_json to analyses table.")
        except Exception as e:
            print(f"Error (probably already exists): {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
