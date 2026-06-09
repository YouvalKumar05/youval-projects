import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# The user already configured database connection url in postgres_setup_readme.md
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:sql%40123@localhost:5432/postgres")


engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
