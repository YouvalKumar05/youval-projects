
import asyncio
import logging
from sqlalchemy import text
from db.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fix_executions_table():
    async with engine.begin() as conn:
        logger.info("Checking for 'logs' column in 'executions' table...")
        # Check if logs column exists
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='executions' AND column_name='logs';"
        ))
        if not result.fetchone():
            logger.info("Adding 'logs' column to 'executions' table...")
            await conn.execute(text("ALTER TABLE executions ADD COLUMN logs JSONB DEFAULT '[]'::jsonb;"))
        else:
            logger.info("'logs' column already exists.")

        logger.info("Checking for 'step_results' column in 'executions' table...")
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name='executions' AND column_name='step_results';"
        ))
        if not result.fetchone():
            logger.info("Adding 'step_results' column to 'executions' table...")
            await conn.execute(text("ALTER TABLE executions ADD COLUMN step_results JSONB DEFAULT '[]'::jsonb;"))
        else:
            logger.info("'step_results' column already exists.")

    logger.info("Database migration simulation/fix complete.")

if __name__ == "__main__":
    asyncio.run(fix_executions_table())
