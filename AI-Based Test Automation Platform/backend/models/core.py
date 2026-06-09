from sqlalchemy import Column, Integer, String, Text, ForeignKey, TIMESTAMP, Boolean, JSON, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.database import Base

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    parent_role_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    parent = relationship("Role", remote_side=[id], backref="children")
    users = relationship("User", back_populates="role")
    role_permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")

class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    resource_name = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False)

    role_permissions = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan")

class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True)

    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255))
    password_hash = Column(String(255), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    profile_image_url = Column(Text)
    theme = Column(String(50), default="light")
    timezone = Column(String(100), default="UTC")
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    role = relationship("Role", back_populates="users")
    settings = relationship("UserSetting", back_populates="user", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    api_tokens = relationship("APIToken", back_populates="user", cascade="all, delete-orphan")

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    trigger_event = Column(String(100), nullable=False)
    ast_json = Column(JSON, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

class WorkflowInstance(Base):
    __tablename__ = "workflow_instances"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"))
    target_entity_type = Column(String(100))
    target_entity_id = Column(Integer)
    current_state = Column(String(100), nullable=False)
    started_at = Column(TIMESTAMP, server_default=func.current_timestamp())

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    sprints = relationship("Sprint", back_populates="project", cascade="all, delete-orphan")

class Sprint(Base):
    __tablename__ = "sprints"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    name = Column(String(150), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(50), default='planned') # active, completed

    project = relationship("Project", back_populates="sprints")
    versions = relationship("Version", back_populates="sprint", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="sprint")

class Version(Base):
    __tablename__ = "versions"

    id = Column(Integer, primary_key=True, index=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id", ondelete="CASCADE"))
    version_number = Column(String(50), nullable=False) # v1.0, v1.1
    status = Column(String(50), default="Draft") # Draft, Released, Archived
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    sprint = relationship("Sprint", back_populates="versions")
    test_cases = relationship("TestCase", back_populates="version")
    executions = relationship("Execution", back_populates="version")

class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("versions.id", ondelete="CASCADE"), nullable=True)
    project_id = Column(String(100)) # legacy field, keep for compatibility or migratete
    title = Column(String(255), nullable=False)
    steps_json = Column(JSON, nullable=False)
    expected_result = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_approved = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    version = relationship("Version", back_populates="test_cases")
    executions = relationship("Execution", back_populates="test_case", cascade="all, delete-orphan")

class Execution(Base):
    __tablename__ = "executions"

    id = Column(Integer, primary_key=True, index=True)
    test_case_id = Column(Integer, ForeignKey("test_cases.id", ondelete="CASCADE"))
    version_id = Column(Integer, ForeignKey("versions.id", ondelete="CASCADE"), nullable=True)
    status = Column(String(50), nullable=False)
    logs_path = Column(Text)
    video_path = Column(Text)
    logs = Column(JSON, default=[])
    step_results = Column(JSON, default=[])
    execution_time = Column(Integer) # in ms
    started_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    completed_at = Column(TIMESTAMP, nullable=True)

    test_case = relationship("TestCase", back_populates="executions")
    version = relationship("Version", back_populates="executions")
    bugs = relationship("Bug", back_populates="execution")

class Bug(Base):
    __tablename__ = "bugs"

    id = Column(Integer, primary_key=True, index=True)
    execution_id = Column(Integer, ForeignKey("executions.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(255), nullable=False)
    severity = Column(String(50))
    status = Column(String(50), default="Open")
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    execution = relationship("Execution", back_populates="bugs")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    description = Column(Text)
    priority = Column(String(50))
    sprint_id = Column(Integer, ForeignKey("sprints.id", ondelete="SET NULL"), nullable=True)
    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), nullable=False)
    reference_type = Column(String(50)) # bug or testcase
    reference_id = Column(Integer)
    due_date = Column(Date)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    sprint = relationship("Sprint", back_populates="tasks")

class Thread(Base):
    __tablename__ = "threads"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(Text)
    reference_type = Column(String(50))
    reference_id = Column(Integer)
    unread_count = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    messages = relationship("Message", back_populates="thread", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    thread_id = Column(Integer, ForeignKey("threads.id", ondelete="CASCADE"))
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    thread = relationship("Thread", back_populates="messages")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    title = Column(String(255), nullable=False)
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    link_url = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

class ConnectionConfig(Base):
    __tablename__ = "connection_configs"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(100), nullable=False)
    auth_type = Column(String(50), nullable=False)
    credentials = Column(JSON, nullable=False)
    base_url = Column(String(255))
    status = Column(String(50), default="Disconnected")
    last_verified = Column(TIMESTAMP, nullable=True)
    environment = Column(String(50), default="Dev")
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    project_name = Column(String(255))
    requirement_text = Column(Text)
    scenarios = Column(JSON)
    risk_score = Column(Integer)
    coverage_pct = Column(Integer)
    status = Column(String(50), default="Pending")
    config_json = Column(JSON, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())
    approved_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(255), nullable=False)
    resource = Column(String(255))
    details = Column(Text)
    timestamp = Column(TIMESTAMP, server_default=func.current_timestamp())

    user = relationship("User")

class UserSetting(Base):
    __tablename__ = "user_settings"
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    email_enabled = Column(Boolean, default=True)
    inapp_enabled = Column(Boolean, default=True)
    execution_alerts = Column(Boolean, default=True)
    bug_alerts = Column(Boolean, default=True)
    workflow_alerts = Column(Boolean, default=True)

    user = relationship("User", back_populates="settings")

class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    device = Column(String(255))
    ip_address = Column(String(100))
    location = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    user = relationship("User", back_populates="sessions")

class APIToken(Base):
    __tablename__ = "api_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    name = Column(String(255))
    token_hash = Column(String(255), nullable=False)
    last_used = Column(TIMESTAMP)
    created_at = Column(TIMESTAMP, server_default=func.current_timestamp())

    user = relationship("User", back_populates="api_tokens")
