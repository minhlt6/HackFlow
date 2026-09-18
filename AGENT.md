# AGENT.md — Quy tắc & Hướng dẫn làm việc dự án HackFlow

> File này là "luật" bắt buộc đọc trước khi bắt đầu code.
> Mọi AI agent, thành viên nhóm và contributor đều phải tuân thủ.

---

## 1. Cấu trúc thư mục dự án

```
HackFlow/
├── backend/                  # Python FastAPI
│   ├── app/
│   │   ├── api/              # Định nghĩa route (controllers)
│   │   │   └── v1/
│   │   │       ├── auth.py
│   │   │       ├── teams.py
│   │   │       ├── topics.py
│   │   │       ├── checkpoints.py
│   │   │       ├── submissions.py
│   │   │       ├── scoring.py
│   │   │       ├── tickets.py
│   │   │       └── admin.py
│   │   ├── core/             # Cấu hình, bảo mật, middleware
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   ├── models/           # SQLAlchemy ORM models (ánh xạ bảng DB)
│   │   ├── schemas/          # Pydantic schemas (validate request/response)
│   │   ├── services/         # Business logic (tách khỏi route)
│   │   ├── repositories/     # Query database (tách khỏi service)
│   │   └── utils/            # Hàm tiện ích dùng chung
│   ├── migrations/           # Alembic migration scripts
│   ├── tests/                # Unit test và integration test
│   ├── main.py               # Entry point FastAPI app
│   ├── requirements.txt      # Dependencies production
│   ├── requirements-dev.txt  # Dependencies development (pytest, black...)
│   ├── Procfile              # Lệnh chạy trên Railway
│   ├── .env                  # Biến môi trường LOCAL (không commit lên Git)
│   └── .env.example          # Template biến môi trường (commit lên Git)
│
├── frontend/                 # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/              # Axios instance và các hàm gọi API
│   │   ├── components/       # Component dùng chung (Button, Modal, Card...)
│   │   ├── features/         # Feature-based: mỗi tính năng 1 thư mục
│   │   │   ├── auth/
│   │   │   ├── teams/
│   │   │   ├── topics/
│   │   │   ├── checkpoints/
│   │   │   ├── scoring/
│   │   │   └── tickets/
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components (route-level)
│   │   ├── store/            # Zustand store (global state)
│   │   ├── utils/            # Hàm tiện ích
│   │   └── types/            # TypeScript type definitions
│   ├── .env                  # Biến môi trường LOCAL (không commit)
│   ├── .env.example          # Template
│   └── package.json
│
├── Database/
│   ├── database_schema.md    # Thiết kế CSDL chi tiết
│   └── init.sql              # Script SQL tạo toàn bộ bảng
│
├── Feature_Description/      # Mô tả tính năng theo role
├── AGENT.md                  # File này
├── ly_do_va_trien_khai.md
└── .gitignore
```

---

## 2. Thiết lập môi trường phát triển

### 2.1 Backend (Python FastAPI)

```bash
# Bước 1: Tạo và kích hoạt môi trường ảo
cd backend
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

# Bước 2: Cài dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Bước 3: Copy file biến môi trường
cp .env.example .env
# Sau đó mở .env và điền các giá trị thực

# Bước 4: Chạy server phát triển
uvicorn main:app --reload --port 8000

# Tài liệu API tự động tại:
# http://localhost:8000/docs   (Swagger UI)
# http://localhost:8000/redoc  (ReDoc)
```

### 2.2 Frontend (React + Vite)

```bash
# Bước 1: Cài dependencies
cd frontend
npm install

# Bước 2: Copy file biến môi trường
cp .env.example .env
# Mở .env và set VITE_API_BASE_URL=http://localhost:8000

# Bước 3: Chạy server phát triển
npm run dev
# Mở http://localhost:5173
```

### 2.3 Database (PostgreSQL — Supabase)

```bash
# Không cài PostgreSQL local — dùng Supabase miễn phí
# 1. Tạo project tại https://supabase.com
# 2. Vào SQL Editor, chạy file Database/init.sql
# 3. Copy DATABASE_URL từ Settings > Database > Connection string
# 4. Paste vào backend/.env
```

### 2.4 Biến môi trường (backend/.env.example)

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:8000/api/v1/auth/github/callback

# JWT
JWT_SECRET_KEY=your_super_secret_key_min_32_chars
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

# Supabase Storage
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

# App
APP_ENV=development
CORS_ORIGINS=["http://localhost:5173"]
```

### 2.5 Biến môi trường (frontend/.env.example)

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_NAME=HackFlow
```

---

## 3. Quy trình Git — Branching Strategy

### 3.1 Sơ đồ nhánh

```
master          ──●────────────────────●──────────────●──▶
                  │                    ↑              ↑
                  │          merge PR  │    merge PR  │
                  │                    │              │
feature/...       └──●──●──●───────────┘              │
                                                      │
bugfix/...                       └──●──●──────────────┘
```

### 3.2 Quy tắc đặt tên nhánh

```
feature/<ten-tinh-nang>     # Tính năng mới
bugfix/<mo-ta-loi>          # Sửa bug
hotfix/<mo-ta-loi>          # Fix khẩn cấp trên production
docs/<mo-ta>                # Cập nhật tài liệu
refactor/<mo-ta>            # Tái cấu trúc code, không đổi logic
```

**Ví dụ:**
```bash
git checkout -b feature/checkpoint-system
git checkout -b feature/ticket-support
git checkout -b bugfix/fix-topic-selection-concurrency
git checkout -b docs/update-api-docs
```

### 3.3 Quy trình làm việc một tính năng mới

```bash
# Bước 1: Luôn pull code mới nhất từ master trước
git checkout master
git pull origin master

# Bước 2: Tạo nhánh mới từ master
git checkout -b feature/ten-tinh-nang

# Bước 3: Code, commit thường xuyên (xem quy tắc commit bên dưới)
git add .
git commit -m "feat(checkpoint): add time-gated submission endpoint"

# Bước 4: Đẩy nhánh lên remote
git push origin feature/ten-tinh-nang

# Bước 5: Tạo Pull Request trên GitHub
# Title: [Feature] Tên tính năng
# Description: Mô tả ngắn những gì đã làm

# Bước 6: Sau khi review OK → Merge vào master
# (Ưu tiên dùng "Squash and merge" để giữ master sạch)

# Bước 7: Xóa nhánh feature sau khi merge
git branch -d feature/ten-tinh-nang
git push origin --delete feature/ten-tinh-nang
```

### 3.4 Quy tắc commit message (Conventional Commits)

```
<type>(<scope>): <mo ta ngan gon>

[body — mo ta chi tiet neu can]
```

**Type:**
| Type | Dùng khi |
|---|---|
| `feat` | Thêm tính năng mới |
| `fix` | Sửa bug |
| `docs` | Cập nhật tài liệu |
| `refactor` | Tái cấu trúc, không đổi logic |
| `test` | Thêm/sửa test |
| `chore` | Cập nhật dependency, config |
| `style` | Format code, không đổi logic |

**Scope (tuỳ chọn):** `auth`, `teams`, `topics`, `checkpoint`, `scoring`, `ticket`, `admin`, `db`

**Ví dụ commit tốt:**
```bash
git commit -m "feat(topics): add SELECT FOR UPDATE to prevent concurrency on topic selection"
git commit -m "fix(auth): handle expired GitHub OAuth token correctly"
git commit -m "docs(api): add response schema for /checkpoints endpoint"
git commit -m "refactor(scoring): extract weight calculation to service layer"
```

**Ví dụ commit tệ (KHÔNG được dùng):**
```bash
git commit -m "fix"
git commit -m "update code"
git commit -m "done"
git commit -m "sssss"
```

---

## 4. Quy tắc viết code

### 4.1 Backend (Python)

#### Cấu trúc tầng (bắt buộc tuân thủ)

```
Request → Router (api/) → Service (services/) → Repository (repositories/) → Database
                        ↕
                     Schema (schemas/) — validate input/output
```

- **Router**: Chỉ định nghĩa endpoint, gọi service, trả response. Không chứa business logic.
- **Service**: Chứa toàn bộ business logic. Gọi repository để lấy data.
- **Repository**: Chỉ chứa query database. Không có logic nghiệp vụ.
- **Schema**: Pydantic model cho request body và response — validate tự động.

#### Coding style

```python
# Dùng async/await cho mọi endpoint và DB call
@router.post("/checkpoints/{checkpoint_id}/submit")
async def submit_checkpoint(
    checkpoint_id: UUID,
    body: CheckpointSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await checkpoint_service.submit(db, checkpoint_id, body, current_user)

# Dùng dependency injection cho DB session và current user
# KHÔNG dùng global variable cho DB connection

# Đặt tên rõ ràng, đủ nghĩa:
# TỐTS: get_team_by_id(), create_checkpoint_submission(), validate_topic_slot_available()
# TỆ:   get(), create(), check()

# Mọi function có side effect phải có type hint đầy đủ
async def create_team(db: AsyncSession, data: TeamCreateRequest, creator_id: UUID) -> Team:
    ...
```

#### Xử lý lỗi — dùng HTTPException có message rõ ràng

```python
# TỐTS
raise HTTPException(
    status_code=400,
    detail="Dề tài này đã đủ số nhóm đăng ký. Vui lòng chọn đề tài khác."
)

# TỆ
raise HTTPException(status_code=400, detail="Bad request")
```

#### Format code — dùng Black

```bash
# Cài Black
pip install black

# Format toàn bộ backend
black app/

# Cấu hình trong pyproject.toml (tạo file này):
# [tool.black]
# line-length = 100
```

### 4.2 Frontend (React + TypeScript)

#### Quy tắc component

```tsx
// Mỗi component một file, đặt tên PascalCase
// TỐTS: CheckpointCard.tsx, TeamMemberList.tsx
// TỆ:   checkpointcard.tsx, team-member-list.tsx

// Dùng TypeScript — KHÔNG dùng 'any'
interface CheckpointCardProps {
  checkpoint: Checkpoint;
  onSubmit: (url: string) => Promise<void>;
}

// Mọi API call đặt trong thư mục src/api/, không gọi fetch/axios trực tiếp trong component
// TỐTS:
const submission = await checkpointApi.submit(checkpointId, { url });

// TỆ:
const res = await axios.post(`/api/v1/checkpoints/${id}/submit`, { url });
```

#### State management

```tsx
// Dùng Zustand cho global state (user, config)
// Dùng React Query (TanStack Query) cho server state (data từ API)
// Dùng useState/useReducer cho local UI state

// KHÔNG dùng Redux — quá nặng cho dự án này
```

#### Format code — dùng Prettier + ESLint

```bash
npm run lint    # Check lỗi ESLint
npm run format  # Format với Prettier
```

---

## 5. Quy tắc API

### 5.1 URL convention

```
GET    /api/v1/teams                  # Lấy danh sách
GET    /api/v1/teams/{team_id}        # Lấy chi tiết 1 đội
POST   /api/v1/teams                  # Tạo mới
PATCH  /api/v1/teams/{team_id}        # Cập nhật một phần
DELETE /api/v1/teams/{team_id}        # Xóa

# Quan hệ lồng nhau:
GET    /api/v1/teams/{team_id}/members
POST   /api/v1/teams/{team_id}/members/{user_id}/accept

# Admin endpoint có prefix riêng:
GET    /api/v1/admin/teams
PATCH  /api/v1/admin/teams/{team_id}/approve
```

### 5.2 Response format chuẩn

```json
// Thành công
{
  "success": true,
  "data": { ... },
  "message": "Tạo đội thành công"
}

// Lỗi
{
  "success": false,
  "error": {
    "code": "TEAM_NAME_TAKEN",
    "message": "Tên đội đã tồn tại. Vui lòng chọn tên khác."
  }
}

// Danh sách có phân trang
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

---

## 6. Quy tắc Database

### 6.1 Migration với Alembic

```bash
# Tạo migration mới sau khi thay đổi model
alembic revision --autogenerate -m "add_team_proposals_table"

# Chạy migration
alembic upgrade head

# Rollback 1 bước
alembic downgrade -1

# KHÔNG chỉnh sửa trực tiếp database production bằng tay
# Mọi thay đổi schema phải đi qua Alembic migration
```

### 6.2 Quy tắc query

```python
# LUÔN dùng parameterized query, KHÔNG nối chuỗi SQL
# TỐTS
result = await db.execute(
    select(Team).where(Team.id == team_id)
)

# TỆ (SQL Injection risk!)
result = await db.execute(f"SELECT * FROM teams WHERE id = '{team_id}'")

# Transaction cho các thao tác phải atomic
async with db.begin():
    await db.execute(update_old_leader)
    await db.execute(update_new_leader)
# Nếu 1 lệnh lỗi → cả 2 đều rollback tự động
```

---

## 7. Quy tắc bảo mật

```
✅ LUÔN validate dữ liệu đầu vào bằng Pydantic schema
✅ LUÔN kiểm tra thời gian ở server-side (datetime.utcnow()), không tin client
✅ LUÔN kiểm tra role của user hiện tại trước khi thực hiện hành động nhạy cảm
✅ Dùng httpOnly cookie cho JWT, không lưu localStorage
✅ CORS chỉ cho phép domain frontend, không để *

❌ KHÔNG commit file .env lên Git (đã có trong .gitignore)
❌ KHÔNG log thông tin nhạy cảm (password, token, email) ra console production
❌ KHÔNG expose stack trace ra response API (chỉ log server-side)
❌ KHÔNG tin tưởng bất kỳ dữ liệu nào từ client khi liên quan đến thời gian, quyền hạn
```

---

## 8. Quy tắc test

```bash
# Chạy toàn bộ test
cd backend
pytest

# Chạy test 1 file
pytest tests/test_topics.py

# Chạy với coverage report
pytest --cov=app tests/

# Yêu cầu tối thiểu: viết test cho các hàm sau
# - calculate_weighted_score()          → test edge case: weight không bằng 1.0
# - validate_checkpoint_time()          → test nộp trước/sau giờ, đúng giờ
# - select_topic() với concurrency      → test 2 request đồng thời
# - create_team_member() giới hạn size  → test thêm khi đã đủ người
```

---

## 9. Checklist trước khi tạo Pull Request

```
[ ] Code đã được format (black / prettier)
[ ] Không có file .env bị commit
[ ] Không có secret/token hardcode trong code
[ ] API endpoint mới đã có Pydantic schema validate
[ ] Thêm tính năng mới → đã cập nhật .env.example nếu cần biến mới
[ ] Logic phức tạp đã có comment giải thích (tiếng Anh hoặc tiếng Việt đều OK)
[ ] Đã test thủ công tính năng trên local trước khi push
[ ] Commit message theo đúng format Conventional Commits
```

---

## 10. Lệnh nhanh (Quick Reference)

```bash
# ── BACKEND ──────────────────────────────────────
# Kích hoạt môi trường ảo (Windows)
.venv\Scripts\Activate.ps1

# Chạy server dev
uvicorn main:app --reload --port 8000

# Thêm dependency mới
pip install <package>
pip freeze > requirements.txt

# Tạo và chạy migration
alembic revision --autogenerate -m "ten_thay_doi"
alembic upgrade head

# Chạy test
pytest --cov=app tests/

# Format code
black app/

# ── FRONTEND ─────────────────────────────────────
# Chạy dev server
npm run dev

# Build production
npm run build

# Lint và format
npm run lint
npm run format

# ── GIT ──────────────────────────────────────────
# Bắt đầu tính năng mới
git checkout master && git pull origin master
git checkout -b feature/ten-tinh-nang

# Đẩy nhánh lên và tạo PR
git push origin feature/ten-tinh-nang
# → Vào GitHub tạo Pull Request

# Xóa nhánh sau khi merge
git branch -d feature/ten-tinh-nang
git push origin --delete feature/ten-tinh-nang
```
