import asyncio
from sqlalchemy import text
from db.database import engine

async def check_and_fix_users():
    async with engine.begin() as conn:
        print("Checking users table schema...")
        # Check if 'name' column exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='name';
        """))
        if not result.fetchone():
            print("Adding 'name' column to 'users' table...")
            await conn.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR(255);"))
            print("'name' column added.")
        else:
            print("'name' column already exists.")

        # Check for other potential missing columns from models/core.py
        columns_to_check = [
            ("profile_image_url", "TEXT"),
            ("theme", "VARCHAR(50) DEFAULT 'light'"),
            ("timezone", "VARCHAR(100) DEFAULT 'UTC'"),
            ("is_active", "BOOLEAN DEFAULT TRUE"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        ]

        for col_name, col_type in columns_to_check:
            result = await conn.execute(text(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='{col_name}';
            """))
            if not result.fetchone():
                print(f"Adding '{col_name}' column to 'users' table...")
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type};"))
                print(f"'{col_name}' column added.")
            else:
                print(f"'{col_name}' column already exists.")

    print("Schema check complete.")

if __name__ == "__main__":
    asyncio.run(check_and_fix_users())
