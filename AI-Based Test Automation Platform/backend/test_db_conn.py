import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = "postgresql+asyncpg://postgres:sql%40123@localhost:5432/postgres"

async def test_connection():
    engine = create_async_engine(DATABASE_URL)
    try:
        async with engine.connect() as conn:
            print("--- Connection Details ---")
            print(f"Host: {engine.url.host}")
            print(f"Port: {engine.url.port}")
            print(f"User: {engine.url.username}")
            
            # Get current database name
            db_name_res = await conn.execute(text("SELECT current_database();"))
            db_name = db_name_res.scalar()
            print(f"Connected to Database: {db_name}")
            
            # Get tables
            tables_res = await conn.execute(text("""
                SELECT tablename 
                FROM pg_catalog.pg_tables 
                WHERE schemaname = 'public';
            """))
            tables = [row[0] for row in tables_res.fetchall()]
            
            print(f"--- Tables in '{db_name}' (public schema) ---")
            if tables:
                for table in tables:
                    print(f" - {table}")
            else:
                print(" No tables found in public schema.")
            print("--------------------------")
            print("Connection test successful!")
    except Exception as e:
        print(f"\n[!] Connection failed: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_connection())
