import asyncio
import sys
from datetime import datetime, timezone, timedelta

# Fix Windows stdout encoding for UTF-8
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.user import User
from app.models.config import HackathonConfig
from app.models.topic import Topic, Subtopic, TopicMentor
from app.models.scoring import ScoringCriteria
from app.models.checkpoint import Checkpoint
from sqlalchemy import select


async def seed():
    print("🌱 Đang khởi tạo bảng CSDL...")
    await init_db()

    async with AsyncSessionLocal() as db:
        # 1. Seed Hackathon Config
        config = (await db.execute(select(HackathonConfig).where(HackathonConfig.id == 1))).scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if not config:
            config = HackathonConfig(
                id=1,
                name="HackFlow 2025 — Công nghệ Kiến tạo Tương lai",
                description="Cuộc thi Hackathon học thuật thường niên dành cho sinh viên CNTT toàn quốc.",
                min_team_size=2,
                max_team_size=5,
                topic_mode="closed",
                registration_start=now - timedelta(days=2),
                registration_end=now + timedelta(days=5),
                topic_selection_deadline=now + timedelta(days=6),
                contest_start=now + timedelta(days=7),
                contest_end=now + timedelta(days=14),
                blind_judging=False,
                results_published=False,
                ticket_enabled=True,
            )
            db.add(config)
            print("✅ Đã tạo cấu hình HackFlow Config")

        # 2. Seed Users (Admin, Mentor, Judge, Participants)
        users_data = [
            {
                "email": "admin@hackflow.local",
                "password": "Admin@123",
                "full_name": "Quản Trị Viên HackFlow",
                "role": "admin",
                "profile_completed": True,
            },
            {
                "email": "mentor@hackflow.local",
                "password": "Mentor@123",
                "full_name": "ThS. Nguyễn Văn Hướng Dẫn",
                "role": "mentor",
                "skills": ["AI/ML", "Backend", "Python"],
                "school": "Đại học Bách Khoa",
                "profile_completed": True,
            },
            {
                "email": "judge@hackflow.local",
                "password": "Judge@123",
                "full_name": "TS. Trần Giám Khảo",
                "role": "judge",
                "skills": ["Software Architecture", "AI/ML"],
                "school": "Viện Nghiên Cứu CNTT",
                "profile_completed": True,
            },
            {
                "email": "leader@hackflow.local",
                "password": "User@123",
                "full_name": "Lê Trưởng Nhóm",
                "role": "participant",
                "skills": ["React", "FastAPI", "UI/UX"],
                "school": "Đại học CNTT",
                "profile_completed": True,
            },
            {
                "email": "member1@hackflow.local",
                "password": "User@123",
                "full_name": "Phạm Thành Viên 1",
                "role": "participant",
                "skills": ["Frontend", "Tailwind CSS"],
                "school": "Đại học CNTT",
                "profile_completed": True,
            },
        ]

        seeded_users = {}
        for u in users_data:
            existing = (
                await db.execute(select(User).where(User.email == u["email"]))
            ).scalar_one_or_none()
            if not existing:
                user = User(
                    email=u["email"],
                    password_hash=get_password_hash(u["password"]),
                    full_name=u["full_name"],
                    role=u["role"],
                    skills=u.get("skills", []),
                    school=u.get("school"),
                    profile_completed=u["profile_completed"],
                )
                db.add(user)
                await db.flush()
                seeded_users[u["role"]] = user
                print(f"✅ Đã tạo user: {u['email']} (vai trò: {u['role']})")
            else:
                seeded_users[u["role"]] = existing

        # 3. Seed Topics & Subtopics
        existing_topic = (
            await db.execute(select(Topic).where(Topic.name == "Trí tuệ nhân tạo (AI/ML)"))
        ).scalar_one_or_none()
        if not existing_topic:
            topic1 = Topic(
                name="Trí tuệ nhân tạo (AI/ML)",
                description="Ứng dụng mô hình ngôn ngữ lớn (LLM) và Thị giác máy tính vào giải quyết bài toán thực tế.",
                display_order=1,
            )
            db.add(topic1)
            await db.flush()

            sub1 = Subtopic(
                topic_id=topic1.id,
                name="Trợ lý AI hỗ trợ gia sư cá nhân hóa",
                description="Xây dựng chatbot RAG hỗ trợ sinh viên ôn tập giải tích và đại số tuyến tính.",
                max_teams=3,
                reference_links=["https://arxiv.org/abs/2005.11401"],
            )
            sub2 = Subtopic(
                topic_id=topic1.id,
                name="Thị giác máy tính nhận diện rác thải thông minh",
                description="Mô hình YOLOv8 phát hiện và phân loại rác tái chế qua camera di động.",
                max_teams=3,
            )
            db.add(sub1)
            db.add(sub2)
            await db.flush()

            # Assign mentor to subtopic 1
            if "mentor" in seeded_users:
                tm = TopicMentor(subtopic_id=sub1.id, mentor_id=seeded_users["mentor"].id)
                db.add(tm)

            print("✅ Đã tạo Topic & Subtopics mẫu")

        # 4. Seed Scoring Criteria (Sum weight = 1.0)
        existing_criteria = (await db.execute(select(ScoringCriteria))).scalars().all()
        if not existing_criteria:
            criteria_list = [
                ScoringCriteria(
                    name="Tính Sáng tạo & Đột phá",
                    description="Mức độ độc đáo của ý tưởng và sự khác biệt với các giải pháp hiện nay.",
                    max_score=10.0,
                    weight=0.25,
                    display_order=1,
                ),
                ScoringCriteria(
                    name="Tính Khả thi & Ứng dụng",
                    description="Kế hoạch thực thi rõ ràng, tiềm năng áp dụng thực tế cao.",
                    max_score=10.0,
                    weight=0.25,
                    display_order=2,
                ),
                ScoringCriteria(
                    name="Chất lượng Kỹ thuật & Kiến trúc",
                    description="Kiến trúc hệ thống, chất lượng code, công nghệ phù hợp và bảo mật.",
                    max_score=10.0,
                    weight=0.30,
                    display_order=3,
                ),
                ScoringCriteria(
                    name="Thuyết trình & Demo Sản phẩm",
                    description="Slide rõ ràng, demo mượt mà, trả lời câu hỏi tự tin, thuyết phục.",
                    max_score=10.0,
                    weight=0.20,
                    display_order=4,
                ),
            ]
            for c in criteria_list:
                db.add(c)
            print("✅ Đã tạo 4 tiêu chí chấm điểm mẫu (tổng trọng số = 1.0)")

        # 5. Seed Checkpoints
        existing_cp = (await db.execute(select(Checkpoint))).scalars().all()
        if not existing_cp:
            cp1 = Checkpoint(
                name="Checkpoint 1: Nộp Đề cương & Kiến trúc Ý tưởng",
                description="Nộp slide tóm tắt ý tưởng, sơ đồ kiến trúc và phân công nhiệm vụ nhóm.",
                open_at=now - timedelta(hours=12),
                close_at=now + timedelta(days=2),
                display_order=1,
                is_required=True,
            )
            cp2 = Checkpoint(
                name="Checkpoint 2: Nộp Bản thử nghiệm Prototype",
                description="Nộp video demo ngắn (dưới 3 phút) hoặc link deployment thử nghiệm.",
                open_at=now + timedelta(days=3),
                close_at=now + timedelta(days=5),
                display_order=2,
                is_required=True,
            )
            db.add(cp1)
            db.add(cp2)
            print("✅ Đã tạo Checkpoints mẫu (Time-gated)")

        await db.commit()
    print("🎉 Khởi tạo dữ liệu mẫu hoàn tất thành công!")


if __name__ == "__main__":
    asyncio.run(seed())
