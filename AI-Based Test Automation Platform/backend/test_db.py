import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from db.database import SQLALCHEMY_DATABASE_URL
from models.core import Version
from sqlalchemy.future import select

async def main():
    engine = create_async_engine(SQLALCHEMY_DATABASE_URL)
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        result = await session.execute(select(Version).where(Version.version_number == 'v1.0.0'))
        version = result.scalars().first()
        if version:
            print(f"Version found: {version.id}")
        else:
            print("No version found")

asyncio.run(main())
