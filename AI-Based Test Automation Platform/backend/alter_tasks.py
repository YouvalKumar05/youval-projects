import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")
if DB_URL and DB_URL.startswith("postgresql://"):
    DB_URL = DB_URL.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(DB_URL)

async def alter_table():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE tasks ADD COLUMN title VARCHAR(255);"))
        except Exception as e: print(e)
        try:
            await conn.execute(text("ALTER TABLE tasks ADD COLUMN description TEXT;"))
        except Exception as e: print(e)
        try:
            await conn.execute(text("ALTER TABLE tasks ADD COLUMN priority VARCHAR(50);"))
        except Exception as e: print(e)
        try:
            await conn.execute(text("ALTER TABLE tasks ADD COLUMN due_date DATE;"))
        except Exception as e: print(e)
        print("Done altering")

asyncio.run(alter_table())
