import asyncio
from db.database import AsyncSessionLocal
from models.core import TestCase, Analysis, Project, Task, Execution, Bug
from sqlalchemy import select, delete, func

async def cleanup():
    async with AsyncSessionLocal() as db:
        # 1. Get all project names that have an Analysis
        an_stmt = select(Analysis.project_name)
        an_res = await db.execute(an_stmt)
        valid_projects = set(p.strip() for p in an_res.scalars().all())
        
        print(f"Valid projects from analyses: {valid_projects}")
        
        # 2. Find TestCases that DON'T have a valid project (ignoring case/whitespace for safety, but let's be strict if we want to clean up)
        # Actually, let's just find test cases whose project_id (trimmed) is not in valid_projects
        tc_stmt = select(TestCase)
        tc_res = await db.execute(tc_stmt)
        all_tcs = tc_res.scalars().all()
        
        to_delete_tc_ids = []
        for tc in all_tcs:
            p_id = (tc.project_id or "").strip()
            if p_id not in valid_projects:
                print(f"Orphaned TestCase found: ID={tc.id}, Project='{tc.project_id}'")
                to_delete_tc_ids.append(tc.id)
        
        if to_delete_tc_ids:
            # Delete Tasks for these TCs
            await db.execute(delete(Task).where(Task.reference_type == 'testcase', Task.reference_id.in_(to_delete_tc_ids)))
            
            # Find executions for these TCs to delete bug tasks
            ex_stmt = select(Execution.id).where(Execution.test_case_id.in_(to_delete_tc_ids))
            ex_res = await db.execute(ex_stmt)
            ex_ids = ex_res.scalars().all()
            
            if ex_ids:
                bug_stmt = select(Bug.id).where(Bug.execution_id.in_(ex_ids))
                bug_res = await db.execute(bug_stmt)
                bug_ids = bug_res.scalars().all()
                if bug_ids:
                    await db.execute(delete(Task).where(Task.reference_type == 'bug', Task.reference_id.in_(bug_ids)))
            
            # Delete TestCases (cascades to executions/bugs)
            await db.execute(delete(TestCase).where(TestCase.id.in_(to_delete_tc_ids)))
            print(f"Deleted {len(to_delete_tc_ids)} orphaned test cases and related data.")
        
        # 3. Cleanup Projects table entries that don't have an analysis
        proj_stmt = select(Project)
        proj_res = await db.execute(proj_stmt)
        all_projs = proj_res.scalars().all()
        for p in all_projs:
            if p.name.strip() not in valid_projects:
                print(f"Orphaned Project entry found: '{p.name}'")
                await db.execute(delete(Project).where(Project.id == p.id))
        
        await db.commit()
        print("Cleanup complete.")

if __name__ == "__main__":
    asyncio.run(cleanup())
