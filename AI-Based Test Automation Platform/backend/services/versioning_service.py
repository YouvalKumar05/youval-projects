from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc
from models.core import Version, Sprint

class VersioningService:
    @staticmethod
    async def get_next_version(db: AsyncSession, sprint_id: int, change_type: str = "minor") -> str:
        """
        Logic:
        - First generation: v1.0
        - minor: v1.0 -> v1.1
        - fix: v1.1 -> v1.1.1
        - major: v1.1 -> v2.0
        """
        stmt = select(Version).where(Version.sprint_id == sprint_id).order_by(desc(Version.created_at)).limit(1)
        result = await db.execute(stmt)
        latest = result.scalars().first()

        if not latest:
            return "v1.0"

        v = latest.version_number.lstrip('v')
        parts = list(map(int, v.split('.')))

        if change_type == "major":
            parts[0] += 1
            parts[1] = 0
            if len(parts) > 2: parts = parts[:2]
        elif change_type == "minor":
            if len(parts) == 1: parts.append(0)
            parts[1] += 1
            if len(parts) > 2: parts = parts[:2]
        elif change_type == "fix":
            if len(parts) < 3:
                while len(parts) < 2: parts.append(0)
                parts.append(1)
            else:
                parts[2] += 1
        
        return "v" + ".".join(map(str, parts))

    @staticmethod
    async def create_new_version(db: AsyncSession, sprint_id: int, version_num: str = None) -> Version:
        if not version_num:
            version_num = await VersioningService.get_next_version(db, sprint_id)
        
        new_v = Version(sprint_id=sprint_id, version_number=version_num, status="Draft")
        db.add(new_v)
        await db.commit()
        await db.refresh(new_v)
        return new_v
