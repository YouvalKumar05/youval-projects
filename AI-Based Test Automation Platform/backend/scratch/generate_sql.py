
import asyncio
from sqlalchemy.schema import CreateTable
from sqlalchemy import create_mock_engine
from db.database import Base
from models.core import Role, Permission, RolePermission, User, Workflow, WorkflowInstance, TestCase, Execution, Bug, Sprint, Task, Thread, Message, Notification

def dump(sql, *multiparams, **params):
    print(sql.compile(dialect=engine.dialect))

engine = create_mock_engine("postgresql://", dump)

def generate_ddl():
    # Sort tables by dependency
    for table in Base.metadata.sorted_tables:
        print(f"-- Table: {table.name}")
        print(CreateTable(table).compile(dialect=engine.dialect))
        print(";")

if __name__ == "__main__":
    generate_ddl()
