from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict

router = APIRouter(tags=["websockets"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.execution_rooms: Dict[int, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, user_id: int):
        await ws.accept()
        self.active_connections[user_id] = ws

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def join_execution_room(self, ws: WebSocket, execution_id: int):
        await ws.accept()
        if execution_id not in self.execution_rooms:
            self.execution_rooms[execution_id] = []
        self.execution_rooms[execution_id].append(ws)

    def leave_execution_room(self, ws: WebSocket, execution_id: int):
        if execution_id in self.execution_rooms:
            self.execution_rooms[execution_id].remove(ws)
            if not self.execution_rooms[execution_id]:
                del self.execution_rooms[execution_id]

    async def broadcast_to_execution(self, execution_id: int, message: dict):
        if execution_id in self.execution_rooms:
            for connection in self.execution_rooms[execution_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            ws = self.active_connections[user_id]
            await ws.send_json(message)

manager = ConnectionManager()

@router.websocket("/ws/executions/{execution_id}")
async def execution_websocket_endpoint(websocket: WebSocket, execution_id: int):
    await manager.join_execution_room(websocket, execution_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.leave_execution_room(websocket, execution_id)


# ─── Dashboard real-time broadcast ──────────────────────────────────────────

# All connected dashboard WebSocket clients
_dashboard_clients: list[WebSocket] = []


async def broadcast_dashboard_event(event: dict):
    """Call this from any route after a DB mutation to push updates to all dashboard viewers."""
    dead: list[WebSocket] = []
    for ws in _dashboard_clients:
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _dashboard_clients.remove(ws)


@router.websocket("/ws/dashboard")
async def dashboard_websocket(websocket: WebSocket):
    await websocket.accept()
    _dashboard_clients.append(websocket)
    try:
        while True:
            # Keep connection alive — client may send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in _dashboard_clients:
            _dashboard_clients.remove(websocket)
