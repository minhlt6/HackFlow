# HackFlow — Thiết kế Cơ sở Dữ liệu Chi tiết

> **Hệ quản trị CSDL:** PostgreSQL  
> **Quy ước đặt tên:** `snake_case`, khoá chính luôn là `id` (UUID hoặc SERIAL), khoá ngoại dạng `<bang_tham_chieu>_id`

---

## Sơ đồ quan hệ tổng quát

```
users
 ├──< team_members >── teams ──< team_topic_selection >── subtopics >── topics
 │                       │
 │                       └──< checkpoint_submissions >── checkpoints
 │                       └── final_submissions
 │                       └──< judge_assignments >── users (judge)
 │                       └──< evaluations >──< evaluation_details >── scoring_criteria
 │                       └──< support_tickets >──< ticket_messages
 │
hackathon_config (singleton)
scoring_criteria
topics ──< subtopics ──< topic_mentors >── users (mentor)
```

---

## NHÓM 1: Người dùng & Xác thực

### Bảng `users`
> Lưu thông tin tất cả người dùng của hệ thống (4 role)

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() | Khoá chính |
| `github_id` | `VARCHAR(50)` | UNIQUE, NULLABLE | ID GitHub (chỉ có với role participant) |
| `github_username` | `VARCHAR(100)` | UNIQUE, NULLABLE | Username GitHub |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | Email dùng để liên lạc |
| `password_hash` | `VARCHAR(255)` | NULLABLE | Mật khẩu đã hash (dùng cho mentor/judge/admin — không dùng cho participant) |
| `role` | `ENUM('participant','mentor','judge','admin')` | NOT NULL | Vai trò trong hệ thống |
| `full_name` | `VARCHAR(255)` | NOT NULL | Họ và tên đầy đủ |
| `date_of_birth` | `DATE` | NULLABLE | Ngày sinh |
| `gender` | `ENUM('male','female','other')` | NULLABLE | Giới tính |
| `province` | `VARCHAR(100)` | NULLABLE | Tỉnh/Thành phố |
| `district` | `VARCHAR(100)` | NULLABLE | Quận/Huyện |
| `phone` | `VARCHAR(20)` | NULLABLE | Số điện thoại |
| `school` | `VARCHAR(255)` | NULLABLE | Trường học/Cơ quan |
| `skills` | `TEXT[]` | DEFAULT '{}' | Mảng kỹ năng kỹ thuật (Frontend, Backend, AI/ML, ...) |
| `major_direction` | `VARCHAR(100)` | NULLABLE | Hướng chuyên sâu chính |
| `bio` | `TEXT` | NULLABLE | Giới thiệu bản thân (dùng cho mentor/judge) |
| `avatar_url` | `VARCHAR(500)` | NULLABLE | Đường dẫn ảnh đại diện |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | Tài khoản có hoạt động không |
| `profile_completed` | `BOOLEAN` | DEFAULT FALSE | Đã hoàn thiện hồ sơ chưa |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm tạo tài khoản |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm cập nhật gần nhất |

**Index:** `idx_users_github_id`, `idx_users_email`, `idx_users_role`

---

## NHÓM 2: Cấu hình Cuộc thi

### Bảng `hackathon_config`
> Bảng singleton — chỉ có 1 dòng duy nhất, lưu toàn bộ cấu hình cuộc thi

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `INTEGER` | PK, DEFAULT 1, CHECK(id=1) | Luôn là 1 (singleton) |
| `name` | `VARCHAR(255)` | NOT NULL | Tên cuộc thi |
| `description` | `TEXT` | NULLABLE | Mô tả tổng quan |
| `logo_url` | `VARCHAR(500)` | NULLABLE | Đường dẫn logo |
| `banner_url` | `VARCHAR(500)` | NULLABLE | Đường dẫn banner |
| `rules` | `TEXT` | NULLABLE | Thể lệ và quy định tham gia |
| `prizes` | `JSONB` | DEFAULT '[]' | Danh sách giải thưởng (JSON array) |
| `contact_channels` | `JSONB` | DEFAULT '{}' | Kênh liên lạc chính thức (fanpage, Discord, email...) |
| `min_team_size` | `SMALLINT` | NOT NULL, DEFAULT 2 | Số thành viên tối thiểu mỗi đội |
| `max_team_size` | `SMALLINT` | NOT NULL, DEFAULT 5 | Số thành viên tối đa mỗi đội |
| `registration_start` | `TIMESTAMPTZ` | NOT NULL | Thời điểm bắt đầu nhận đăng ký |
| `registration_end` | `TIMESTAMPTZ` | NOT NULL | Thời điểm đóng đăng ký |
| `topic_selection_deadline` | `TIMESTAMPTZ` | NULLABLE | Hạn chót chọn đề tài |
| `contest_start` | `TIMESTAMPTZ` | NOT NULL | Thời điểm bắt đầu cuộc thi |
| `contest_end` | `TIMESTAMPTZ` | NOT NULL | Thời điểm kết thúc cuộc thi |
| `blind_judging` | `BOOLEAN` | DEFAULT FALSE | Bật/tắt chế độ chấm điểm ẩn danh |
| `results_published` | `BOOLEAN` | DEFAULT FALSE | BTC đã công bố kết quả chưa |
| `ticket_enabled` | `BOOLEAN` | DEFAULT TRUE | Cho phép tạo ticket hỗ trợ không |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm cập nhật gần nhất |
| `updated_by` | `UUID` | FK → users.id | Admin đã cập nhật |

---

## NHÓM 3: Đội thi

### Bảng `teams`
> Lưu thông tin các đội thi

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() | Khoá chính |
| `name` | `VARCHAR(255)` | NOT NULL, UNIQUE | Tên đội (duy nhất) |
| `description` | `TEXT` | NULLABLE | Mô tả ngắn về đội |
| `status` | `ENUM('pending','approved','rejected','disqualified')` | DEFAULT 'pending' | Trạng thái duyệt đội (BTC phê duyệt) |
| `blind_code` | `VARCHAR(20)` | UNIQUE | Mã ẩn danh khi Blind Judging bật (vd: "Đội #07") |
| `created_by` | `UUID` | FK → users.id, NOT NULL | Người tạo đội (Nhóm trưởng ban đầu) |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm tạo |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm cập nhật |

**Index:** `idx_teams_name`, `idx_teams_status`

---

### Bảng `team_members`
> Lưu quan hệ nhiều-nhiều giữa users và teams, kèm vai trò và trạng thái

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `team_id` | `UUID` | FK → teams.id, NOT NULL | Thuộc đội nào |
| `user_id` | `UUID` | FK → users.id, NOT NULL | Thành viên nào |
| `role` | `ENUM('leader','member')` | NOT NULL, DEFAULT 'member' | Vai trò trong đội |
| `status` | `ENUM('pending','accepted','rejected','left')` | DEFAULT 'pending' | Trạng thái tham gia |
| `invited_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm gửi yêu cầu/lời mời |
| `responded_at` | `TIMESTAMPTZ` | NULLABLE | Thời điểm phản hồi |

**Unique constraint:** `(team_id, user_id)`  
**Index:** `idx_team_members_team_id`, `idx_team_members_user_id`

---

## NHÓM 4: Đề tài

### Bảng `topics`
> Chủ đề lớn do BTC tạo ra

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `name` | `VARCHAR(255)` | NOT NULL | Tên chủ đề lớn |
| `description` | `TEXT` | NULLABLE | Mô tả tổng quan chủ đề |
| `display_order` | `SMALLINT` | DEFAULT 0 | Thứ tự hiển thị |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | Còn hiển thị cho thí sinh không |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm tạo |

---

### Bảng `subtopics`
> Chủ đề nhỏ thuộc một chủ đề lớn — đây là đơn vị mà đội thi thực sự chọn

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `topic_id` | `UUID` | FK → topics.id, NOT NULL | Thuộc chủ đề lớn nào |
| `name` | `VARCHAR(255)` | NOT NULL | Tên chủ đề nhỏ |
| `description` | `TEXT` | NULLABLE | Mô tả chi tiết vấn đề cần giải quyết |
| `sample_data_url` | `VARCHAR(500)` | NULLABLE | Link dữ liệu mẫu |
| `reference_links` | `TEXT[]` | DEFAULT '{}' | Mảng link tài liệu tham khảo |
| `max_teams` | `SMALLINT` | NOT NULL, DEFAULT 3 | Số nhóm tối đa được đăng ký đề tài này |
| `current_registered_count` | `SMALLINT` | NOT NULL, DEFAULT 0 | Số nhóm đã đăng ký (dùng cho kiểm tra giới hạn) |
| `display_order` | `SMALLINT` | DEFAULT 0 | Thứ tự hiển thị |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | Còn hiển thị không |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm tạo |

**Index:** `idx_subtopics_topic_id`

---

### Bảng `topic_mentors`
> Phân công mentor phụ trách chủ đề (nhiều-nhiều)

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `subtopic_id` | `UUID` | FK → subtopics.id, NOT NULL | Chủ đề nhỏ nào |
| `mentor_id` | `UUID` | FK → users.id, NOT NULL | Mentor nào (role=mentor) |
| `assigned_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm phân công |

**Unique constraint:** `(subtopic_id, mentor_id)`

---

### Bảng `team_topic_selection`
> Đội thi chọn đề tài nào

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `team_id` | `UUID` | FK → teams.id, NOT NULL, UNIQUE | Mỗi đội chỉ chọn 1 đề tài |
| `subtopic_id` | `UUID` | FK → subtopics.id, NOT NULL | Đề tài đã chọn |
| `selected_by` | `UUID` | FK → users.id, NOT NULL | Nhóm trưởng đã bấm chọn |
| `selected_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm chọn |

---

## NHÓM 5: Checkpoint & Nộp bài

### Bảng `checkpoints`
> Danh sách các mốc nộp bài do BTC tạo

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `name` | `VARCHAR(255)` | NOT NULL | Tên checkpoint (vd: "Nộp ý tưởng", "Nộp prototype") |
| `description` | `TEXT` | NULLABLE | Yêu cầu chi tiết cần nộp |
| `open_at` | `TIMESTAMPTZ` | NOT NULL | Thời điểm bắt đầu nhận bài |
| `close_at` | `TIMESTAMPTZ` | NOT NULL | Thời điểm đóng nhận bài |
| `display_order` | `SMALLINT` | DEFAULT 0 | Thứ tự hiển thị trên timeline |
| `is_required` | `BOOLEAN` | DEFAULT TRUE | Checkpoint bắt buộc phải nộp không |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm tạo |

---

### Bảng `checkpoint_submissions`
> Lưu lịch sử nộp bài cho từng checkpoint

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `checkpoint_id` | `UUID` | FK → checkpoints.id, NOT NULL | Thuộc checkpoint nào |
| `team_id` | `UUID` | FK → teams.id, NOT NULL | Đội nào nộp |
| `submitted_by` | `UUID` | FK → users.id, NOT NULL | Nhóm trưởng đã nộp |
| `submission_url` | `VARCHAR(500)` | NOT NULL | Link bài nộp (GitHub, Drive, Slide...) |
| `note` | `TEXT` | NULLABLE | Ghi chú thêm của đội |
| `version` | `SMALLINT` | NOT NULL, DEFAULT 1 | Lần nộp thứ mấy (mỗi lần cập nhật +1) |
| `submitted_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Timestamp UTC từ server khi nộp |
| `is_latest` | `BOOLEAN` | DEFAULT TRUE | Đây có phải bài nộp mới nhất không |

**Index:** `idx_checkpoint_submissions_team_checkpoint` trên `(team_id, checkpoint_id)`

---

### Bảng `final_submissions`
> Bài nộp sản phẩm cuối của mỗi đội

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `team_id` | `UUID` | FK → teams.id, NOT NULL, UNIQUE | Mỗi đội chỉ có 1 bài nộp cuối (ghi đè) |
| `submitted_by` | `UUID` | FK → users.id, NOT NULL | Nhóm trưởng đã nộp |
| `github_url` | `VARCHAR(500)` | NOT NULL | Link GitHub repository |
| `github_repo_owner` | `VARCHAR(100)` | NOT NULL | Username chủ repo GitHub |
| `github_repo_name` | `VARCHAR(100)` | NOT NULL | Tên repo GitHub |
| `frozen_commit_sha` | `VARCHAR(40)` | NULLABLE | Commit SHA được đóng băng tại thời điểm nộp |
| `latest_commit_sha` | `VARCHAR(40)` | NULLABLE | Commit SHA mới nhất (cập nhật bởi cron job sau deadline) |
| `has_post_deadline_changes` | `BOOLEAN` | DEFAULT FALSE | Có commit sau deadline không |
| `demo_video_url` | `VARCHAR(500)` | NULLABLE | Link video demo (YouTube Unlisted / Loom) |
| `slide_pdf_url` | `VARCHAR(500)` | NULLABLE | Link file PDF slide (lưu trên Cloud Storage) |
| `description` | `TEXT` | NULLABLE | Mô tả ngắn sản phẩm |
| `submitted_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Timestamp UTC từ server |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Lần cập nhật gần nhất |
| `version` | `SMALLINT` | DEFAULT 1 | Lần nộp/cập nhật thứ mấy |

---

## NHÓM 6: Chấm điểm

### Bảng `scoring_criteria`
> Danh sách tiêu chí chấm điểm do BTC thiết lập — có thể thêm/sửa/xóa linh hoạt

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `name` | `VARCHAR(255)` | NOT NULL | Tên tiêu chí (vd: "Tính sáng tạo", "Khả năng trình bày") |
| `description` | `TEXT` | NULLABLE | Mô tả chi tiết tiêu chí — hướng dẫn giám khảo chấm |
| `max_score` | `NUMERIC(5,2)` | NOT NULL | Điểm tối đa cho tiêu chí này |
| `weight` | `NUMERIC(4,3)` | NOT NULL, CHECK(weight > 0 AND weight <= 1) | Trọng số (0.0 → 1.0). Tổng tất cả tiêu chí phải = 1.0 |
| `display_order` | `SMALLINT` | DEFAULT 0 | Thứ tự hiển thị trong form chấm điểm |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | Tiêu chí còn áp dụng không |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm tạo |

---

### Bảng `judge_assignments`
> Phân công giám khảo chấm đội nào

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `judge_id` | `UUID` | FK → users.id, NOT NULL | Giám khảo (role=judge) |
| `team_id` | `UUID` | FK → teams.id, NOT NULL | Đội được phân công |
| `assigned_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm phân công |
| `assigned_by` | `UUID` | FK → users.id, NOT NULL | Admin đã phân công |

**Unique constraint:** `(judge_id, team_id)`  
**Rule:** Judge không được phân công chấm đội mà trong đội đó có thí sinh đã từng được mentor đó hướng dẫn (kiểm tra ở tầng ứng dụng).

---

### Bảng `evaluations`
> Phiên chấm điểm của 1 giám khảo cho 1 đội (header)

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `judge_id` | `UUID` | FK → users.id, NOT NULL | Giám khảo chấm |
| `team_id` | `UUID` | FK → teams.id, NOT NULL | Đội được chấm |
| `total_score` | `NUMERIC(6,3)` | NULLABLE | Điểm tổng đã tính theo trọng số (tính khi lưu) |
| `general_comment` | `TEXT` | NULLABLE | Nhận xét tổng thể cho cả đội |
| `status` | `ENUM('draft','submitted')` | DEFAULT 'draft' | Nháp hay đã nộp chính thức |
| `submitted_at` | `TIMESTAMPTZ` | NULLABLE | Thời điểm nộp chính thức |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm bắt đầu chấm |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm cập nhật gần nhất |

**Unique constraint:** `(judge_id, team_id)`  
**Index:** `idx_evaluations_team_id`, `idx_evaluations_judge_id`

---

### Bảng `evaluation_details`
> Điểm chi tiết từng tiêu chí trong 1 phiên chấm

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `evaluation_id` | `UUID` | FK → evaluations.id, NOT NULL | Thuộc phiên chấm nào |
| `criteria_id` | `UUID` | FK → scoring_criteria.id, NOT NULL | Tiêu chí nào |
| `score` | `NUMERIC(5,2)` | NOT NULL, CHECK(score >= 0) | Điểm nhập vào (phải <= max_score của criteria) |
| `note` | `TEXT` | NULLABLE | Nhận xét riêng cho tiêu chí này |

**Unique constraint:** `(evaluation_id, criteria_id)`  
**Công thức tính điểm:** `total_score = Σ(score_i × weight_i)` — tính tại tầng ứng dụng (Python), lưu vào `evaluations.total_score`

---

## NHÓM 7: Ticket Hỗ trợ

### Bảng `support_tickets`
> Ticket câu hỏi/yêu cầu hỗ trợ từ thí sinh gửi cho mentor

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `team_id` | `UUID` | FK → teams.id, NOT NULL | Đội gửi ticket |
| `created_by` | `UUID` | FK → users.id, NOT NULL | Nhóm trưởng tạo ticket |
| `title` | `VARCHAR(500)` | NOT NULL | Tiêu đề vấn đề |
| `description` | `TEXT` | NOT NULL | Mô tả chi tiết vấn đề |
| `priority` | `ENUM('low','medium','high')` | DEFAULT 'medium' | Mức độ ưu tiên |
| `status` | `ENUM('open','in_progress','resolved','cancelled')` | DEFAULT 'open' | Trạng thái xử lý |
| `assigned_mentor_id` | `UUID` | FK → users.id, NULLABLE | Mentor đang xử lý (NULL nếu chưa có ai nhận) |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm tạo ticket |
| `assigned_at` | `TIMESTAMPTZ` | NULLABLE | Thời điểm mentor nhận ticket |
| `resolved_at` | `TIMESTAMPTZ` | NULLABLE | Thời điểm hoàn thành |

**Index:** `idx_tickets_team_id`, `idx_tickets_status`, `idx_tickets_assigned_mentor`

---

### Bảng `ticket_messages`
> Nội dung hội thoại trong ticket (thí sinh & mentor cùng nhắn)

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `ticket_id` | `UUID` | FK → support_tickets.id, NOT NULL | Thuộc ticket nào |
| `sender_id` | `UUID` | FK → users.id, NOT NULL | Ai gửi |
| `content` | `TEXT` | NOT NULL | Nội dung tin nhắn / phản hồi |
| `sent_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm gửi |

**Index:** `idx_ticket_messages_ticket_id`

---

## NHÓM 8: Thông báo (Notification)

### Bảng `notifications`
> Thông báo hệ thống gửi đến người dùng

| Cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | `UUID` | PK | Khoá chính |
| `user_id` | `UUID` | FK → users.id, NOT NULL | Người nhận |
| `type` | `VARCHAR(50)` | NOT NULL | Loại thông báo (ticket_replied, checkpoint_open, result_published...) |
| `title` | `VARCHAR(255)` | NOT NULL | Tiêu đề thông báo |
| `body` | `TEXT` | NULLABLE | Nội dung chi tiết |
| `link` | `VARCHAR(500)` | NULLABLE | Đường dẫn đến trang liên quan |
| `is_read` | `BOOLEAN` | DEFAULT FALSE | Đã đọc chưa |
| `created_at` | `TIMESTAMPTZ` | DEFAULT NOW() | Thời điểm tạo |

**Index:** `idx_notifications_user_id`, `idx_notifications_unread` trên `(user_id, is_read)`

---

## Tóm tắt danh sách bảng

| # | Tên bảng | Nhóm | Mô tả ngắn |
|:---:|---|---|---|
| 1 | `users` | Người dùng | Tất cả tài khoản (4 role) |
| 2 | `hackathon_config` | Cấu hình | Thông tin cuộc thi (singleton) |
| 3 | `teams` | Đội thi | Thông tin đội |
| 4 | `team_members` | Đội thi | Thành viên đội (nhiều-nhiều) |
| 5 | `topics` | Đề tài | Chủ đề lớn |
| 6 | `subtopics` | Đề tài | Chủ đề nhỏ (đơn vị đội thi chọn) |
| 7 | `topic_mentors` | Đề tài | Phân công mentor theo chủ đề |
| 8 | `team_topic_selection` | Đề tài | Đội thi chọn đề tài nào |
| 9 | `checkpoints` | Nộp bài | Mốc nộp bài do BTC tạo |
| 10 | `checkpoint_submissions` | Nộp bài | Lịch sử nộp bài checkpoint |
| 11 | `final_submissions` | Nộp bài | Bài nộp sản phẩm cuối |
| 12 | `scoring_criteria` | Chấm điểm | Tiêu chí chấm điểm (động) |
| 13 | `judge_assignments` | Chấm điểm | Phân công giám khảo — đội |
| 14 | `evaluations` | Chấm điểm | Phiên chấm của 1 giám khảo cho 1 đội |
| 15 | `evaluation_details` | Chấm điểm | Điểm từng tiêu chí |
| 16 | `support_tickets` | Hỗ trợ | Ticket câu hỏi từ thí sinh |
| 17 | `ticket_messages` | Hỗ trợ | Hội thoại trong ticket |
| 18 | `notifications` | Thông báo | Thông báo hệ thống |

**Tổng: 18 bảng**

---

## Ghi chú thiết kế quan trọng

### 1. Kiểu UUID thay vì SERIAL INT
Dùng `UUID` làm khoá chính cho hầu hết các bảng để:
- Tránh lộ thông tin (thí sinh không đoán được có bao nhiêu đội từ ID số thứ tự)
- An toàn hơn khi expose qua API
- Dễ merge dữ liệu nếu cần

### 2. TIMESTAMPTZ thay vì TIMESTAMP
Tất cả cột thời gian dùng `TIMESTAMPTZ` (timestamp với timezone) để lưu UTC, tránh lỗi khi server đặt ở múi giờ khác múi giờ của thí sinh.

### 3. Soft Delete thay vì Hard Delete
Các bảng quan trọng (users, teams, topics) dùng cột `is_active` thay vì xóa dòng thật sự — đảm bảo audit trail và tránh lỗi khoá ngoại.

### 4. JSONB cho dữ liệu linh hoạt
Các trường có cấu trúc linh hoạt như `prizes` (danh sách giải thưởng) và `contact_channels` (kênh liên lạc) dùng `JSONB` — PostgreSQL hỗ trợ query và index trên JSONB hiệu quả.

### 5. Tính điểm tổng ở tầng ứng dụng
`total_score` trong bảng `evaluations` được tính bởi Python FastAPI (không dùng trigger database) để dễ test và debug hơn.
