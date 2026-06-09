import asyncio
import os
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext
from db.database import engine, AsyncSessionLocal
from models.core import Role, Permission, RolePermission, User, Workflow, TestCase, Sprint, Task

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_data():
    async with AsyncSessionLocal() as db:
        print("Seeding database...")

        # 1. Create Roles
        admin_role = Role(name="Admin", description="Total system access")
        lead_role = Role(name="Test Lead", description="Manages teams and technical approvals")
        qa_role = Role(name="QA Engineer", description="Executes tests and logs bugs")
        dev_role = Role(name="Developer", description="Fixes bugs and reviews code")
        
        db.add_all([admin_role, lead_role, qa_role, dev_role])
        await db.flush()

        # Set Hierarchy
        lead_role.parent_role_id = admin_role.id
        qa_role.parent_role_id = lead_role.id
        dev_role.parent_role_id = admin_role.id
        
        # 2. Create Permissions
        perms_list = [
            ("admin", "all"),
            ("testcases", "read"),
            ("testcases", "write"),
            ("executions", "write"),
            ("workflows", "write"),
            ("tasks", "read"),
            ("ai", "refine"),
        ]
        perms = []
        for res, act in perms_list:
            p = Permission(resource_name=res, action=act)
            db.add(p)
            perms.append(p)
        await db.flush()

        # 3. Assign Permissions to Roles
        def get_perm(res, act):
            return [p for p in perms if p.resource_name == res and p.action == act][0]

        # Admin gets everything
        admin_perm = get_perm("admin", "all")
        db.add(RolePermission(role_id=admin_role.id, permission_id=admin_perm.id))

        # Lead gets testcases:write, ai:refine, executions:write
        lead_perms = [get_perm("testcases", "write"), get_perm("ai", "refine"), get_perm("executions", "write")]
        for lp in lead_perms:
            db.add(RolePermission(role_id=lead_role.id, permission_id=lp.id))

        # QA gets testcases:read, ai:refine
        qa_perms = [get_perm("testcases", "read"), get_perm("ai", "refine")]
        for qp in qa_perms:
            db.add(RolePermission(role_id=qa_role.id, permission_id=qp.id))

        # 4. Create Users
        admin_user = User(
            email="admin@autoqa.local",
            password_hash=pwd_context.hash("admin123"),
            role_id=admin_role.id
        )
        qa_user = User(
            email="qa@autoqa.local",
            password_hash=pwd_context.hash("qa123"),
            role_id=qa_role.id
        )
        db.add_all([admin_user, qa_user])

        # 5. Create Default Workflow
        workflow_ast = {
            "rules": [
                {
                    "condition": {"field": "status", "operator": "==", "value": "FAIL"},
                    "action": {"type": "create_bug", "params": {"default_severity": "High"}}
                },
                {
                    "condition": {"field": "severity", "operator": "==", "value": "High"},
                    "action": {"type": "assign_to_role", "params": {"role_name": "Test Lead"}}
                }
            ]
        }
        default_wf = Workflow(
            name="Standard Defect Escalation",
            description="Auto-creates bugs on failure and assigns high severity to Lead",
            trigger_event="test_failed",
            ast_json=workflow_ast
        )
        db.add(default_wf)

        # 6. Create Sprint & Tasks
        now = datetime.now()
        sprint = Sprint(name="Sprint 1: Genesis", start_date=now, end_date=now + timedelta(days=7))
        db.add(sprint)
        await db.flush()

        task1 = Task(sprint_id=sprint.id, assignee_id=qa_user.id, status="pending", reference_type="testcase", reference_id=1)
        db.add(task1)

        await db.commit()
        print("Database seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
