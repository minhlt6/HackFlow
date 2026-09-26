"""
WebSocket endpoint cho ticket chat real-time.
Mỗi ticket có 1 "room" (room_id = ticket_id).
ConnectionManager quản lý tất cả active connections.
"""

from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import verify_token
from app.models.ticket import SupportTicket, TicketMessage
from app.models.user import User
from datetime import datetime, timezone
import json

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    """Quản lý tất cả WebSocket connections theo room (ticket_id)."""

    def __init__(self):
        # { room_id: [WebSocket, ...] }
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            (
                self.active_connections[room_id].discard(websocket)
                if hasattr(self.active_connections[room_id], "discard")
                else None
            )
            try:
                self.active_connections[room_id].remove(websocket)
            except ValueError:
                pass
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast_to_room(self, room_id: str, message: dict, exclude: WebSocket = None):
        """Broadcast tin nhắn đến tất cả client trong room, trừ sender (nếu có)."""
        if room_id not in self.active_connections:
            return
        dead_connections = []
        for connection in self.active_connections[room_id]:
            if connection is exclude:
                continue
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)
        # Dọn dẹp connections đã chết
        for dead in dead_connections:
            self.disconnect(dead, room_id)

    def get_room_count(self, room_id: str) -> int:
        return len(self.active_connections.get(room_id, []))


# Singleton connection manager (shared across all websocket connections)
manager = ConnectionManager()


@router.websocket("/ws/tickets/{ticket_id}")
async def ticket_chat_ws(
    websocket: WebSocket,
    ticket_id: str,
    token: str = Query(..., description="JWT token để xác thực"),
    db: AsyncSession = Depends(get_db),
):
    """
    WebSocket endpoint cho real-time ticket chat.
    Client kết nối với URL: ws://localhost:8000/ws/tickets/{ticket_id}?token=<jwt>

    Protocol:
    - Client gửi: { "type": "message", "content": "text" }
    - Server broadcast: { "type": "message", "id": "...", "content": "...", "sender": {...}, "created_at": "..." }
    - Server gửi: { "type": "system", "content": "X người đang xem" }
    - Server gửi: { "type": "error", "content": "error message" }
    """
    # 1. Xác thực JWT token
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=1008, reason="Token không hợp lệ")
        return

    user_id = payload.get("sub")

    # 2. Lấy thông tin user
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user or not user.is_active:
        await websocket.close(code=1008, reason="Tài khoản không tồn tại hoặc bị khóa")
        return

    # 3. Kiểm tra ticket tồn tại
    ticket = (
        await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ).scalar_one_or_none()
    if not ticket:
        await websocket.close(code=1008, reason="Ticket không tồn tại")
        return

    # 4. Kiểm tra quyền truy cập ticket:
    # - participant trong team đó, hoặc
    # - mentor được assign, hoặc
    # - admin
    has_access = (
        user.role == "admin"
        or ticket.team_id == getattr(user, "team_id", None)  # không dùng direct attr
        or ticket.claimed_by == user_id
        or user.role == "mentor"
    )
    if not has_access:
        await websocket.close(code=1008, reason="Không có quyền truy cập ticket này")
        return

    # 5. Connect vào room
    room_id = f"ticket:{ticket_id}"
    await manager.connect(websocket, room_id)

    # Thông báo số người online trong room
    count = manager.get_room_count(room_id)
    await manager.broadcast_to_room(
        room_id,
        {
            "type": "system",
            "content": f"{count} người đang xem ticket này",
            "online_count": count,
        },
    )

    try:
        while True:
            # Nhận message từ client
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "content": "Dữ liệu không hợp lệ (cần JSON)"}
                )
                continue

            msg_type = data.get("type", "message")

            if msg_type == "message":
                content = (data.get("content") or "").strip()
                if not content:
                    continue

                # Lưu vào DB
                new_msg = TicketMessage(
                    ticket_id=ticket_id,
                    sender_id=user_id,
                    content=content,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(new_msg)
                await db.commit()
                await db.refresh(new_msg)

                # Broadcast đến tất cả trong room (kể cả sender để confirm)
                broadcast_payload = {
                    "type": "message",
                    "id": new_msg.id,
                    "ticket_id": ticket_id,
                    "content": content,
                    "sender": {
                        "id": user.id,
                        "full_name": user.full_name,
                        "role": user.role,
                    },
                    "created_at": new_msg.created_at.isoformat(),
                }
                await manager.broadcast_to_room(room_id, broadcast_payload)

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
        count = manager.get_room_count(room_id)
        await manager.broadcast_to_room(
            room_id,
            {
                "type": "system",
                "content": f"{user.full_name} đã rời khỏi. {count} người đang xem.",
                "online_count": count,
            },
        )
