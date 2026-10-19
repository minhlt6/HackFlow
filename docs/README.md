# 📚 HackFlow — Tài liệu Kiến trúc & Nghiệp vụ Dự án

> **Nguyên tắc:** Lưu trữ toàn bộ tài liệu kiến trúc hệ thống, đặc tả yêu cầu phần mềm (SRS), thiết kế cơ sở dữ liệu và hợp đồng tích hợp API phục vụ phát triển & vận hành cục bộ (Local Environment).

---

## 📂 Cấu trúc Thư mục Tài liệu

```text
docs/
├── ba/          ← Phân tích nghiệp vụ (BRD/SRS), User Stories, Acceptance Criteria, UAT Test Cases
├── backend/     ← Kiến trúc hệ thống 3 tầng, Thiết kế CSDL (ERD), API Contract, OpenAPI Schema
├── frontend/    ← Kiến trúc Frontend SPA, Hệ thống 4 Role Portals & Quản lý Trạng thái (Dual-Store)
└── ui-ux/       ← Quy chuẩn Thiết kế Giao diện (Design System & Style Guide)
```

---

## 📄 Danh mục Tài liệu Hiện có

### 🔵 1. Phân tích Nghiệp vụ & Đặc tả Yêu cầu (Business Analysis — `docs/ba/`)

| Tài liệu | Mô tả | Tác giả | Sprint |
|---|---|---|---|
| [`ba-01-ke-hoach-phan-tich-nghiep-vu-bai-toan-hackflo.md`](./ba/ba-01-ke-hoach-phan-tich-nghiep-vu-bai-toan-hackflo.md) | Phân tích bài toán HackFlow · 20 User Stories (US-01~20) · Acceptance Criteria · Ma trận ưu tiên P0/P1 | Đinh Phương Ly | Sprint 1 |
| [`hf-03-viet-dac-ta-srs-luong-auth-onboarding.md`](./ba/hf-03-viet-dac-ta-srs-luong-auth-onboarding.md) | Đặc tả SRS luồng Xác thực Kép (Local + GitHub OAuth 2.0), Whitelist & Onboarding Hồ sơ Thí sinh | Đinh Phương Ly | Sprint 1 |
| [`hf-04-viet-dac-ta-srs-luong-tao-doi-chon-de-tai.md`](./ba/hf-04-viet-dac-ta-srs-luong-tao-doi-chon-de-tai.md) | Đặc tả SRS luồng Ghép đội bằng Mã mời 6 ký tự (3–5 thành viên) & Chọn đề tài chống Race Condition | Đinh Phương Ly | Sprint 2 |
| [`hf-23-dac-ta-srs-luong-checkpoint-nop-bai.md`](./ba/hf-23-dac-ta-srs-luong-checkpoint-nop-bai.md) | Đặc tả SRS luồng Checkpoint Time-Gated (Server UTC + Ân hạn 5s) & Nộp bài đóng băng GitHub Commit SHA | Đinh Phương Ly | Sprint 3 |
| [`hf-24-dac-ta-srs-module-thong-bao-chung.md`](./ba/hf-24-dac-ta-srs-module-thong-bao-chung.md) | Đặc tả SRS Module Thông báo chung (Announcements Banner, Bell & Urgent Modal) | Đinh Phương Ly | Sprint 3 |
| [`hf-35-thiet-ke-kich-ban-uat-test-cases-bo-sung-luon.md`](./ba/hf-35-thiet-ke-kich-ban-uat-test-cases-bo-sung-luon.md) | Bộ kịch bản kiểm thử nghiệm thu người dùng (UAT Test Cases) toàn hệ thống | Đinh Phương Ly | Sprint 4 |
| [`hf-36-dac-ta-srs-luong-cham-thi-rubric-blind-judgin.md`](./ba/hf-36-dac-ta-srs-luong-cham-thi-rubric-blind-judgin.md) | Đặc tả SRS luồng Chấm thi theo Barem Rubric trọng số, Blind Judging & Bảng xếp hạng Leaderboard | Đinh Phương Ly | Sprint 4 |
| [`hf-37-dac-ta-srs-phan-he-helpdesk-ticket-3-trang-th.md`](./ba/hf-37-dac-ta-srs-phan-he-helpdesk-ticket-3-trang-th.md) | Đặc tả SRS Phân hệ Helpdesk Ticket hỗ trợ & Ma trận phân quyền cô lập dữ liệu Mentor | Đinh Phương Ly | Sprint 4 |

---

### 🟢 2. Kiến trúc Hệ thống & Cơ sở Dữ liệu (`docs/backend/`)

| Tài liệu | Mô tả | Tác giả | Sprint |
|---|---|---|---|
| [`system-architecture.md`](./backend/system-architecture.md) | Kiến trúc tổng thể Full-Stack (React 19 + FastAPI 3-Tier) · Sơ đồ Topology & Sequence · Cơ chế Concurrency `SELECT FOR UPDATE` · Time-Gated Checkpoints · Blind Judging & Vận hành Local | Lê Tiến Minh | Sprint 1–4 |
| [`database-schema.md`](./backend/database-schema.md) | Sơ đồ ERD 13 bảng quan hệ · Đặc tả cột, kiểu dữ liệu, PK/FK, Unique Constraints, Indexes & Dữ liệu Seed mặc định | Lê Tiến Minh | Sprint 1–4 |
| [`api-contract-handover.md`](./backend/api-contract-handover.md) | Chuẩn `ApiResponse[T]` Envelope · Danh mục toàn bộ Endpoints các phân hệ · Bảng mã lỗi chuẩn hóa | Lê Tiến Minh | Sprint 1–4 |
| [`hf-27-lap-trinh-api-crud-announcements.md`](./backend/hf-27-lap-trinh-api-crud-announcements.md) | Tài liệu kỹ thuật API CRUD Thông báo chung (`/api/v1/announcements`) | Nông Lan Anh | Sprint 3 |
| [`openapi.json`](./backend/openapi.json) | Đặc tả OpenAPI 3.1.0 phục vụ import trực tiếp vào Postman / Insomnia | Lê Tiến Minh | Sprint 1–4 |

---

### 🟣 3. Kiến trúc Giao diện Người dùng (`docs/frontend/`)

| Tài liệu | Mô tả | Tác giả | Sprint |
|---|---|---|---|
| [`frontend-architecture.md`](./frontend/frontend-architecture.md) | Kiến trúc Frontend SPA (React 19 + TypeScript + Vite 8 + Tailwind CSS) · Hệ thống 4 Role Portals (28 màn hình) · Quản lý trạng thái Dual-Store & Đồng bộ Đa Tab (`BroadcastChannel`) | Phạm Thị Huyền Linh | Sprint 1–4 |

---
*Cập nhật: 19/10/2026 · Môi trường: Local Development (`http://localhost:8000` & `http://localhost:5173`)*
