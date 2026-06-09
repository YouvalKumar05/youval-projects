from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any, Dict
from datetime import datetime, date

class StandardResponse(BaseModel):
    status: str
    data: Optional[Any] = None
    message: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    role_id: Optional[int]
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_role: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_role_id: Optional[int] = None

class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    parent_role_id: Optional[int]
    model_config = ConfigDict(from_attributes=True)

class PermissionCreate(BaseModel):
    resource_name: str
    action: str

class AssignPermissionRequest(BaseModel):
    role_id: int
    permission_id: int

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_event: str
    ast_json: Dict[str, Any]

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_event: Optional[str] = None
    ast_json: Optional[Dict[str, Any]] = None

class WorkflowResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    trigger_event: str
    ast_json: Dict[str, Any]
    model_config = ConfigDict(from_attributes=True)

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "Medium"
    due_date: Optional[date] = None
    assignee_id: Optional[int]
    status: str = "Backlog"
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[date] = None
    assignee_id: Optional[int] = None
    status: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None

class TaskStatusUpdate(BaseModel):
    status: str

class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    priority: Optional[str]
    due_date: Optional[date]
    assignee_id: Optional[int]
    status: str
    reference_type: Optional[str]
    reference_id: Optional[int]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class BugCreate(BaseModel):
    execution_id: Optional[int]
    title: str
    severity: str
    assigned_to: Optional[int]

class BugResponse(BaseModel):
    id: int
    execution_id: Optional[int]
    title: str
    severity: str
    status: str
    assigned_to: Optional[int]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TriggerExecutionRequest(BaseModel):
    headless: bool = True
    browser_type: str = "chromium"
    delay: float = 2.0

class ConnectionTestRequest(BaseModel):
    type: str
    auth_type: str
    credentials: Dict[str, Any]
    base_url: Optional[str] = None
    environment: str = "Dev"

class ConnectionResponse(BaseModel):
    id: Optional[int] = None
    status: str
    message: str
    logs: Optional[str] = None
    response_time_ms: Optional[int] = None
