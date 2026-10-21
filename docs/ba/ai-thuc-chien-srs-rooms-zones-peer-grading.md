# 📑 ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS): PHÂN HỆ PHÒNG THI (ROOM), KHU VỰC (ZONE) & CHẤM CHÉO 3 GIAI ĐOẠN CHO "AI THỰC CHIẾN"

> **Mã tài liệu:** `SRS-AI-THUC-CHIEN`  
> **Dự án:** HackFlow — Nền tảng Quản lý & Thi đấu AI Thực Chiến  
> **Phiên bản:** 1.0  
> **Ngày cập nhật:** 22/10/2026

---

## 1. Tổng quan Nghiệp vụ

Nhằm đáp ứng mô hình đào tạo và thi đấu **AI Thực Chiến** với nhiều lớp học bắt đầu ở các khung giờ khác nhau nhưng dùng chung đề thi và tài nguyên Mentor, hệ thống mở rộng cấu trúc tổ chức theo 3 cấp:
- **Cấp Toàn khóa (Global Contest):** Dùng chung ngân hàng Đề tài (`Topic`/`Subtopic`), kho tài nguyên dữ liệu, bộ tiêu chí `RubricCriteria` và đội ngũ `Mentor` hỗ trợ kỹ thuật.
- **Cấp Phòng học / Ca thi (`Room`):** Mỗi lớp học là một Phòng thi độc lập có khung giờ bắt đầu/kết thúc riêng, Người quản lý phòng (`manager_id` - Admin phụ trách phòng) riêng, và cấu hình hạn nộp `Checkpoint` riêng (`RoomCheckpointSchedule`).
- **Cấp Khu vực (`Zone`):** Do số lượng người ở mỗi phòng khác nhau, mỗi Phòng được chia thành các `Zone` (Zone A, Zone B, Zone C...) để các đội trong cùng Zone chấm chéo cho nhau ở Vòng 1 trước khi chọn đại diện thuyết trình cấp Phòng (Vòng 2) và Liên Phòng (Vòng 3).

---

## 2. Thiết kế Mô hình Dữ liệu Mở rộng

### 2.1. Bảng `rooms` (Phòng học / Ca thi AI Thực Chiến)
| Trường | Kiểu | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | UUID định danh phòng |
| `code` | `VARCHAR(32)` | UNIQUE, NOT NULL | Mã phòng (VD: `ROOM-A1`, `ROOM-B2`) |
| `name` | `VARCHAR(128)` | NOT NULL | Tên phòng/lớp (VD: `Lớp AI Thực Chiến K1 - Ca Sáng`) |
| `description` | `TEXT` | NULLABLE | Ghi chú lịch học, giảng đường / link Zoom |
| `manager_id` | `VARCHAR(36)` | FK `users.id` | Người quản lý phòng (Admin phụ trách phòng) |
| `manager_name` | `VARCHAR(128)` | NULLABLE | Tên người quản lý phòng hiển thị nhanh |
| `capacity` | `INTEGER` | DEFAULT 40 | Sức chứa học viên dự kiến của phòng |
| `start_time` | `TIMESTAMPTZ` | NOT NULL | Khung giờ bắt đầu của phòng |
| `end_time` | `TIMESTAMPTZ` | NOT NULL | Khung giờ kết thúc làm bài của phòng |
| `judging_stage` | `VARCHAR(32)` | DEFAULT `'not_started'` | Trạng thái chấm: `'not_started'` \| `'stage_1_zone'` \| `'stage_2_room'` \| `'stage_3_cross_room'` \| `'completed'` |
| `room_top_n` | `INTEGER` | DEFAULT 1 | Số đội đại diện phòng lên Vòng 3 Liên phòng (`1` hoặc `3`) |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | Trạng thái hoạt động của phòng |

### 2.2. Bảng `zones` (Khu vực chấm chéo trong Phòng)
| Trường | Kiểu | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | UUID định danh Zone |
| `room_id` | `VARCHAR(36)` | FK `rooms.id` CASCADE | Phòng chứa Zone này |
| `code` | `VARCHAR(32)` | NOT NULL | Mã Zone (VD: `ZONE-A`, `ZONE-B`) |
| `name` | `VARCHAR(128)` | NOT NULL | Tên Zone (VD: `Zone A - Cụm 1`) |
| `max_teams` | `INTEGER` | DEFAULT 5 | Số đội tối đa trong Zone |

### 2.3. Bảng `room_checkpoint_schedules` (Cấu hình thời gian Checkpoint riêng theo Phòng)
| Trường | Kiểu | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | UUID cấu hình lịch |
| `room_id` | `VARCHAR(36)` | FK `rooms.id` CASCADE | Phòng áp dụng lịch này |
| `checkpoint_id` | `VARCHAR(36)` | FK `checkpoints.id` CASCADE | Mốc Checkpoint gốc |
| `start_time` | `TIMESTAMPTZ` | NOT NULL | Giờ mở nộp riêng cho Phòng |
| `deadline` | `TIMESTAMPTZ` | NOT NULL | Hạn chót nộp bài riêng cho Phòng |
| `is_active` | `BOOLEAN` | DEFAULT TRUE | Cho phép mở/khóa riêng ở cấp Phòng |

### 2.4. Mở rộng bảng `teams`
- Bổ sung `room_id` (`FK rooms.id`, NULLABLE) và `zone_id` (`FK zones.id`, NULLABLE).
- Bổ sung cờ kết quả tiến vòng:
  - `is_zone_winner` (`BOOLEAN`, mặc định `False`): Đội đạt Top 1 của Zone sau Vòng 1, được quyền thuyết trình trước Phòng ở Vòng 2.
  - `is_room_winner` (`BOOLEAN`, mặc định `False`): Đội thuộc Top 1 (hoặc Top 3) của Phòng sau Vòng 2, được quyền thuyết trình chéo Liên phòng ở Vòng 3.

### 2.5. Bảng `peer_evaluations` (Phiếu chấm điểm chéo giữa các Đội theo 3 giai đoạn)
| Trường | Kiểu | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| `id` | `VARCHAR(36)` | PK | UUID phiếu chấm |
| `stage` | `VARCHAR(32)` | NOT NULL, INDEX | `'stage_1_zone'` \| `'stage_2_room'` \| `'stage_3_cross_room'` |
| `room_id` | `VARCHAR(36)` | FK `rooms.id` | Phòng của đội được chấm |
| `zone_id` | `VARCHAR(36)` | FK `zones.id`, NULLABLE | Zone của đội được chấm (dùng cho Vòng 1) |
| `evaluator_team_id` | `VARCHAR(36)` | FK `teams.id` CASCADE | Đội thực hiện chấm điểm |
| `target_team_id` | `VARCHAR(36)` | FK `teams.id` CASCADE | Đội được chấm điểm |
| `submitted_by` | `VARCHAR(36)` | FK `users.id` SET NULL | Thành viên đại diện đội bấm gửi phiếu |
| `criteria_scores` | `JSON` | NOT NULL | Điểm chi tiết theo từng `criteria_id` |
| `total_score` | `FLOAT` | NOT NULL | Điểm quy đổi thang 100 theo trọng số Rubric |
| `comment` | `TEXT` | NULLABLE | Nhận xét góp ý chéo cho đội bạn |

> **Ràng buộc duy nhất (`UniqueConstraint`):** `(stage, evaluator_team_id, target_team_id)` — Mỗi đội chỉ có đúng 1 phiếu chấm cho một đội mục tiêu ở mỗi giai đoạn.

---

## 3. Quy tắc Nghiệp vụ & Kiểm soát Hợp lệ (Business Rules)

1. **Chặn tự chấm đội nhà (`SELF_EVALUATION_FORBIDDEN` - HTTP 400):**
   - Trong cả 3 giai đoạn, `evaluator_team_id` bắt buộc khác `target_team_id`.
2. **Quy tắc Giai đoạn 1 (`stage_1_zone` — Chấm chéo trong Zone):**
   - Hai đội `evaluator_team` và `target_team` bắt buộc phải thuộc **cùng một Zone (`evaluator_team.zone_id == target_team.zone_id`)**.
   - Khi Người quản lý phòng bấm **"Chốt Vòng 1 & Chọn Top 1 mỗi Zone"**, hệ thống tính điểm trung bình của các đội trong từng Zone, đánh dấu đội có điểm cao nhất mỗi Zone là `is_zone_winner = True` và chuyển phòng sang `stage_2_room`.
3. **Quy tắc Giai đoạn 2 (`stage_2_room` — Thuyết trình cấp Phòng):**
   - Chỉ các đội có `is_zone_winner == True` trong Phòng mới nằm trong danh sách thuyết trình và nhận phiếu chấm ở Vòng 2.
   - Mọi đội thuộc cùng Phòng (`evaluator_team.room_id == target_team.room_id`) đều được chấm điểm cho các đội thuyết trình này (trừ đội của chính mình).
   - Khi Người quản lý phòng bấm **"Chốt Vòng 2 & Chọn Top N Phòng (Top 1 hoặc Top 3)"**, hệ thống chọn `room_top_n` đội điểm cao nhất Vòng 2 của phòng, đánh dấu `is_room_winner = True` và chuyển sang `stage_3_cross_room`.
4. **Quy tắc Giai đoạn 3 (`stage_3_cross_room` — Thuyết trình Chéo Liên Phòng):**
   - Chỉ các đội có `is_room_winner == True` từ tất cả các Phòng mới lên thuyết trình Liên phòng.
   - Các đội khác chấm điểm chéo để xác định thứ hạng chung cuộc toàn khóa.
