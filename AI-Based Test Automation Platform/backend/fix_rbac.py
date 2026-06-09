import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from db.database import AsyncSessionLocal
from models.core import Role, Permission, RolePermission

async def fix_rbac():
    async with AsyncSessionLocal() as db:
        print("Fixing RBAC permissions...")
        
        # 1. Ensure Admin role exists
        role_stmt = select(Role).where(Role.name == "Admin")
        result = await db.execute(role_stmt)
        admin_role = result.scalars().first()
        if not admin_role:
            admin_role = Role(name="Admin", description="Total system access")
            db.add(admin_role)
            await db.flush()
            print("Created Admin role.")
        
        # 2. Define required permissions
        required_perms = [
            ("testcases", "create"),
            ("testcases", "write"),
            ("testcases", "read"),
            ("workflows", "execute"),
            ("ai", "generate"),
            ("ai", "refine"),
            ("roles", "read"),
            ("roles", "write"),
            ("rbac", "write"),
            ("admin", "all")
        ]
        
        for res, act in required_perms:
            perm_stmt = select(Permission).where(Permission.resource_name == res, Permission.action == act)
            perm_res = await db.execute(perm_stmt)
            perm = perm_res.scalars().first()
            if not perm:
                perm = Permission(resource_name=res, action=act)
                db.add(perm)
                await db.flush()
                print(f"Created permission: {res}:{act}")
            
            # Assign to Admin
            rp_stmt = select(RolePermission).where(RolePermission.role_id == admin_role.id, RolePermission.permission_id == perm.id)
            rp_res = await db.execute(rp_stmt)
            if not rp_res.scalars().first():
                db.add(RolePermission(role_id=admin_role.id, permission_id=perm.id))
                print(f"Assigned {res}:{act} to Admin.")
        
        await db.commit()
        print("RBAC fix complete.")

if __name__ == "__main__":
    asyncio.run(fix_rbac())
