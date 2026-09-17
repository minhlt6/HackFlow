# HackFlow — Lý do chọn đề tài và Phương án triển khai

---

## PHẦN 1: LÝ DO CHỌN ĐỀ TÀI

### 1.1 Bối cảnh thực tế — Vấn đề chưa được giải quyết

Các cuộc thi Hackathon ngày càng trở nên phổ biến trong môi trường đại học và doanh nghiệp tại Việt Nam. Tuy nhiên, hầu hết các Ban Tổ Chức (BTC) hiện nay vẫn đang vận hành toàn bộ quy trình thi bằng các công cụ không được thiết kế dành riêng cho mục đích này:

- **Google Form** được dùng để thu thập thông tin đăng ký đội, nộp bài, nhận link checkpoint.
- **Google Sheet** được dùng để theo dõi danh sách đội thi, trạng thái nộp bài, nhập điểm thủ công.
- **Zalo / Discord** được dùng để thí sinh liên lạc và đặt câu hỏi cho mentor.
- **Email** được dùng để thông báo lịch thi, kết quả, thay đổi quy chế.

Sự kết hợp rời rạc giữa các công cụ này gây ra hàng loạt vấn đề nghiêm trọng trong thực tế vận hành:

#### Vấn đề 1: Không kiểm soát được tính toàn vẹn của bài nộp

Khi thí sinh nộp bài qua Google Form bằng cách dán link (GitHub, Google Drive, Canva, YouTube...), hệ thống **không có cơ chế nào ngăn thí sinh tiếp tục chỉnh sửa nội dung bên trong link đó sau deadline**. Một đội có thể nộp link GitHub đúng giờ, nhưng sau đó vẫn tiếp tục `git push` thêm tính năng và mang bản code mới nhất lên trình bày trước Ban Giám Khảo. Google Form hoàn toàn bất lực trước tình huống này vì nó chỉ lưu lại chuỗi URL, không hề biết nội dung bên trong URL đó có thay đổi hay không.

#### Vấn đề 2: Bảng dữ liệu Google Sheet không đáp ứng nhu cầu quản lý phức tạp

Google Sheet là một bảng tính, không phải hệ thống quản lý sự kiện. Khi sử dụng Google Sheet để quản lý Hackathon, BTC gặp các vấn đề:

- **Không có phân quyền chi tiết**: Rất khó giới hạn giám khảo chỉ xem một phần dữ liệu, không vô tình thấy điểm của giám khảo khác trước khi chốt kết quả.
- **Không có audit trail**: Nếu ai đó vô ý sửa đè một ô điểm, không thể biết ai sửa, sửa lúc nào, sửa từ giá trị nào sang giá trị nào.
- **Phải tính điểm thủ công**: Công thức tính điểm theo trọng số phải được viết bằng tay từng ô, dễ sai và khó bảo trì.
- **Không có giao diện trực quan**: BTC không thể nhìn tổng quan "Đội nào đã nộp checkpoint 2 chưa?" mà không phải lọc và cuộn qua hàng chục cột dữ liệu.

#### Vấn đề 3: Kênh hỗ trợ mentor không có tổ chức

Trong các cuộc thi kéo dài nhiều ngày, thí sinh liên tục đặt câu hỏi kỹ thuật cho mentor qua Zalo hoặc Discord. Điều này dẫn đến:

- Mentor không biết ai đã được hỗ trợ, ai chưa, ticket nào đang được xử lý.
- Câu hỏi giống nhau bị hỏi đi hỏi lại nhiều lần, không có kho kiến thức tập trung.
- BTC không thể audit xem mentor có làm đủ nhiệm vụ hỗ trợ không.
- Lịch sử hỗ trợ không được lưu lại có tổ chức.

#### Vấn đề 4: Thiếu cơ chế theo dõi tiến độ theo từng mốc (Checkpoint)

Nhiều cuộc thi học thuật yêu cầu đội thi nộp báo cáo tiến độ định kỳ (ví dụ: nộp ý tưởng sau 2 ngày, nộp prototype sau 4 ngày, nộp sản phẩm hoàn chỉnh sau 7 ngày). Với Google Form, BTC phải tạo thủ công nhiều Form riêng lẻ cho từng checkpoint, tổng hợp kết quả từ nhiều Sheet khác nhau, dễ nhầm lẫn và mất kiểm soát.

---

### 1.2 Tại sao chưa có giải pháp nào giải quyết triệt để?

Trong quá trình nghiên cứu, nhóm đã khảo sát các nền tảng hackathon lớn nhất thế giới:

| Nền tảng | Đặc điểm | Hạn chế với môi trường học thuật VN |
|---|---|---|
| **Devpost** (>25M developers) | Nộp bài 1 lần duy nhất, mentor hỗ trợ qua Discord ngoài platform | Không phù hợp với mô hình BTC cấp đề tài sẵn |
| **Major League Hacking (MLH)** | Tích hợp Devpost, mentor volunteer qua Discord | Không có portal riêng cho mentor, không phân quyền theo chủ đề |
| **HackerEarth** | Hỗ trợ multi-round nhưng thiên về competitive programming | Không có ticket mentor, không có hệ thống chọn đề tài |
| **DoraHacks** | Thiên về Web3, voting cộng đồng | Không có checkpoint system, không có mentor system |

**Nhận xét chung:** Tất cả các nền tảng trên đều được thiết kế cho mô hình hackathon *"startup-style"* — thí sinh tự đề xuất ý tưởng, mentor là tình nguyện viên liên lạc qua Discord. Mô hình này không phù hợp với hackathon học thuật Việt Nam, nơi BTC cung cấp danh sách đề tài cụ thể, mentor là giảng viên/trợ giảng có trách nhiệm, và cần theo dõi tiến độ định kỳ qua nhiều checkpoint.

---

### 1.3 Ý nghĩa thực tế của đề tài

**HackFlow** được xây dựng để lấp đầy khoảng trống này. Sau khi triển khai:

- **BTC** không cần tạo Google Form, tổng hợp Sheet thủ công — tất cả quản lý tập trung trên một Dashboard trực quan.
- **Thí sinh** có trải nghiệm liền mạch từ đăng ký, vào đội, chọn đề tài, nộp checkpoint đến nộp sản phẩm cuối.
- **Giám khảo** có giao diện chuyên biệt để chấm điểm theo rubric với trọng số, điểm được tính tự động, đảm bảo minh bạch.
- **Mentor** có portal riêng xử lý ticket hỗ trợ từ thí sinh, lưu lịch sử có tổ chức, thay thế hoàn toàn kênh Zalo/Discord lộn xộn.

---

## PHẦN 2: PHƯƠNG ÁN TRIỂN KHAI

### 2.1 Kiến trúc tổng thể

Hệ thống được xây dựng theo mô hình **Client-Server**, tách biệt hoàn toàn Frontend và Backend:

```
+----------------------------------------------------+
|          FRONTEND — React.js + Tailwind CSS        |
|  [Thi sinh]  [Giam Khao]  [Mentor]  [Admin/BTC]   |
+----------------------+-----------------------------+
                       | REST API (JSON over HTTPS)
+----------------------v-----------------------------+
|          BACKEND — Python FastAPI                  |
|  Auth | Teams | Topics | Checkpoints              |
|  Submissions | Scoring | Tickets | Leaderboard    |
|  -> Tu dong sinh tai lieu API tai /docs            |
+-------------+------------------+------------------+
              | SQLAlchemy ORM   | Presigned URL
+-------------v------+  +--------v-----------------+
| PostgreSQL Database |  |  Cloud Storage           |
| (Du lieu chinh)     |  |  (File, Slide, Video)    |
+---------------------+  +--------------------------+
```

**Lý do chọn công nghệ:**
- **Python FastAPI**: Hỗ trợ async/await giúp xử lý hàng nghìn request đồng thời; tự động sinh tài liệu Swagger UI tại `/docs`.
- **React.js + Tailwind CSS**: Component-based giúp tái sử dụng code UI hiệu quả; xây dựng giao diện responsive nhanh.
- **PostgreSQL**: Hỗ trợ quan hệ phức tạp; Connection Pooling giúp chịu tải tốt khi nhiều người dùng đồng thời.
- **Cloud Storage**: File dung lượng lớn tải thẳng lên Cloud qua Presigned URL, không đi qua server Backend — tránh nghẽn tải trong giờ cao điểm.

---

### 2.2 Phân quyền hệ thống (4 Role)

| Role | Đăng nhập | Quyền chính |
|---|---|---|
| **Thí sinh (Participant)** | GitHub OAuth | Tạo đội, chọn đề tài, nộp checkpoint, tạo ticket |
| **Mentor** | Username + Password do BTC cấp | Xử lý ticket hỗ trợ, xem tiến độ (không xem link bài nộp) |
| **Giám Khảo (Judge)** | Username + Password do BTC cấp | Xem bài nộp, nhập điểm theo rubric |
| **Quản Trị (Admin/BTC)** | Username + Password nội bộ | Toàn quyền cấu hình hệ thống, xem Dashboard tổng quan |

> **Nguyên tắc cốt lõi:** Mentor và Giám Khảo hoàn toàn tách biệt để tránh xung đột lợi ích. Mentor đã hướng dẫn đội nào thì hệ thống tự động không cho phép chấm điểm đội đó.

---

### 2.3 Chi tiết các tính năng và cách triển khai

#### 2.3.1 Quản lý thông tin chương trình (Admin)

**Mô tả:** Admin thiết lập toàn bộ thông tin của cuộc thi: tên, mô tả, logo, banner, thể lệ, giải thưởng, kênh thông tin chính thức, giới hạn số thành viên đội (min/max), timeline các mốc quan trọng.

**Cách triển khai:**
- Dữ liệu lưu vào bảng `hackathon_config` trong PostgreSQL. Hệ thống vận hành 1 cuộc thi tại một thời điểm nên bảng này chỉ có 1 bản ghi được cập nhật liên tục.
- Cấu hình timeline (`registration_start`, `registration_end`, `contest_start`, `contest_end`) được toàn bộ hệ thống sử dụng để tự động mở/khóa các tính năng đúng giờ mà không cần Admin can thiệp thủ công.

---

#### 2.3.2 Đăng nhập bằng GitHub OAuth + Hoàn thiện hồ sơ (Thí sinh)

**Mô tả:** Thí sinh đăng nhập bằng tài khoản GitHub cá nhân. Lần đầu đăng nhập, hệ thống yêu cầu điền đầy đủ hồ sơ cá nhân (họ tên, ngày sinh, giới tính, địa chỉ, trường, SĐT, kỹ năng kỹ thuật).

**Cách triển khai:**
- Backend dùng thư viện `authlib` kết hợp GitHub OAuth 2.0. Sau khi GitHub xác thực thành công, Backend gọi GitHub API `/user` để lấy thông tin, tạo bản ghi `User` trong database và trả về JWT token.
- JWT token lưu trong `httpOnly cookie` ở phía client, tránh bị đánh cắp qua XSS.
- Middleware `get_current_user` trong FastAPI kiểm tra JWT ở mọi API endpoint cần xác thực.

---

#### 2.3.3 Quản lý Đội thi — Tạo đội, Mời thành viên, Chuyển trưởng nhóm

**Mô tả:** Thí sinh tạo đội mới (trở thành Nhóm trưởng) hoặc tìm kiếm và gửi yêu cầu tham gia đội. Nhóm trưởng phê duyệt yêu cầu, xóa thành viên, chuyển quyền trưởng nhóm. Hệ thống tự kiểm tra giới hạn số thành viên.

**Cách triển khai:**
- Bảng `teams` lưu thông tin đội; bảng `team_members` lưu quan hệ thành viên kèm trường `role` (leader/member) và `status` (pending/accepted/rejected).
- Khi Nhóm trưởng chấp nhận yêu cầu: Backend kiểm tra `current_member_count < max_team_size` trước khi cập nhật. Nếu đội đã đủ người, API trả về lỗi 400.
- **Chuyển quyền Nhóm trưởng**: Hai lệnh UPDATE được thực thi trong 1 **database transaction** để đảm bảo tính nhất quán — không xảy ra tình trạng đội có 2 leader hoặc 0 leader.

---

#### 2.3.4 Danh sách Đề tài và Cơ chế Chọn Đề tài *(Tính năng độc đáo #1)*

**Mô tả:** Admin tạo danh sách chủ đề lớn (chứa các chủ đề nhỏ). Mỗi chủ đề nhỏ có mô tả, dữ liệu mẫu, tài liệu tham khảo, mentor phụ trách và giới hạn số nhóm đăng ký. Nhóm trưởng chọn 1 đề tài cho đội mình.

**Cách triển khai:**
- Cấu trúc: Bảng `topics` → Bảng `subtopics` → Bảng `team_topic_selection`.
- **Giải quyết Concurrency (2 nhóm cùng chọn 1 đề tài trong cùng 1 giây):**
  Sử dụng `SELECT FOR UPDATE` trong PostgreSQL Transaction:
  ```sql
  BEGIN;
  SELECT current_registered_count FROM subtopics
  WHERE id = :subtopic_id FOR UPDATE;
  -- Nếu count < max_teams thì cho phép chọn
  INSERT INTO team_topic_selection ...;
  UPDATE subtopics SET current_registered_count = current_registered_count + 1;
  COMMIT;
  ```
  Transaction này đảm bảo dù 100 nhóm cùng bấm "Chọn đề tài" trong 1 giây, chỉ đúng số nhóm tối đa được phép sẽ thành công.

---

#### 2.3.5 Checkpoint System — Nộp bài nhiều vòng *(Tính năng độc đáo #2)*

**Mô tả:** Admin tạo các checkpoint (tên, thời gian mở, thời gian đóng, yêu cầu). Nút nộp bài chỉ hiển thị và active trong khoảng thời gian quy định. Chỉ Nhóm trưởng được nộp. Hệ thống lưu lại mọi lần nộp/cập nhật kèm dấu thời gian chính xác.

**Cách triển khai:**
- Bảng `checkpoints` lưu cấu hình. Bảng `checkpoint_submissions` lưu bài nộp kèm `submitted_at` (timestamp UTC từ server).
- **Kiểm tra thời gian phía Server-side (bắt buộc):** Backend luôn kiểm tra lại `datetime.utcnow()` với `checkpoint.end_time` trước khi chấp nhận bài nộp. Điều này ngăn thí sinh bypass bằng cách chỉnh thời gian máy hoặc gửi request trực tiếp qua Postman sau khi hết hạn.
- Mỗi lần cập nhật bài nộp tạo ra 1 bản ghi mới với trường `version` tăng dần. Hệ thống hiển thị bản mới nhất nhưng giữ toàn bộ lịch sử để audit.

---

#### 2.3.6 Nộp Sản phẩm cuối (kèm Commit SHA Freeze)

**Mô tả:** Đội nộp sản phẩm hoàn chỉnh gồm link GitHub, link video demo (YouTube Unlisted/Loom), link slide (PDF), mô tả ngắn. Hệ thống tự động ghi lại Commit SHA của repository tại thời điểm nộp.

**Cách triển khai:**
- **Commit SHA Freeze:** Ngay khi đội bấm Xác nhận, Backend gọi GitHub REST API `GET /repos/{owner}/{repo}/commits/HEAD` để lấy `sha` commit mới nhất và lưu vào bảng `final_submissions`.
- Sau deadline, cron job tự động so sánh `current_head_sha` với `frozen_sha`. Nếu khác → hệ thống đánh dấu bài là "Có thay đổi sau deadline" và hiển thị cảnh báo màu đỏ trên màn hình Giám khảo kèm nút "Xem Git Diff".
- **File PDF "Đóng băng":** Thí sinh bắt buộc upload 1 bản PDF của slide thuyết trình qua Cloud Storage. File này là bản duy nhất có giá trị pháp lý để chấm điểm, bất kể link Canva/Figma gốc có bị sửa sau này hay không.

---

#### 2.3.7 Hệ thống Tiêu chí Chấm điểm Động (Admin)

**Mô tả:** Admin tạo bộ tiêu chí linh hoạt (tên, mô tả, điểm tối đa, trọng số %). Có thể thêm/sửa/xóa tiêu chí bất kỳ lúc nào mà không cần sửa code. Có thể bật Blind Judging. Điểm tổng tính tự động theo trọng số.

**Cách triển khai:**
- Bảng `scoring_criteria` lưu danh sách tiêu chí. Bảng `evaluation_details` lưu điểm chi tiết theo cặp `(evaluation_id, criteria_id, score, note)` — thiết kế này cho phép thêm bất kỳ số lượng tiêu chí mà không đổi cấu trúc database.
- Công thức: `total_score = Σ (score_i × weight_i)` — được tính khi Giám khảo bấm Lưu, lưu vào `evaluations.total_score` để Leaderboard truy vấn nhanh.
- **Blind Judging:** Khi Admin bật `blind_judging=true`, API trả về tên đội đã mã hóa thành "Đội #XX". Tên thật chỉ được giải mã khi Admin bật `results_published=true`.

---

#### 2.3.8 Judge Portal — Giao diện Chấm điểm

**Mô tả:** Giám khảo có portal riêng, chỉ thấy các đội được phân công. Giao diện chia đôi màn hình: trái hiển thị tài liệu bài nộp, phải là form nhập điểm từng tiêu chí. Điểm tổng hiển thị real-time. Cảnh báo nếu phát hiện commit sau deadline.

**Cách triển khai:**
- Bảng `judge_assignments` lưu phân công `(judge_id, team_id)`. API chỉ trả về đội có trong bảng này cho giám khảo đang đăng nhập.
- Điểm tổng real-time: Frontend JavaScript tính `Σ (score_i × weight_i)` ngay tại client khi nhập — không cần gọi API. Backend tính lại một lần nữa khi lưu để đảm bảo chính xác.
- **Cảnh báo commit sau deadline:** Nếu phát hiện, Frontend hiển thị badge `[⚠️ CÓ CODE MỚI SAU DEADLINE]` trên thẻ đội kèm nút xem chi tiết Git Diff.

---

#### 2.3.9 Mentor Portal + Ticket hỗ trợ *(Tính năng độc đáo #3 & #4)*

**Mô tả:** Mentor có portal tách biệt, có thể xem trạng thái nộp bài (không xem link/nội dung), xử lý ticket hỗ trợ từ thí sinh qua hệ thống 3 trạng thái: Chờ xử lý → Đang xử lý → Hoàn thành.

**Cách triển khai:**
- Bảng `support_tickets` với các trường: `team_id`, `title`, `description`, `priority` (low/medium/high), `status` (open/in_progress/resolved), `assigned_mentor_id`, `created_at`, `resolved_at`.
- **State Machine Ticket:**
  - Thí sinh tạo ticket → `status='open'`, `assigned_mentor_id=NULL`.
  - Mentor bấm Nhận ticket → `status='in_progress'`, `assigned_mentor_id=mentor.id` (trong transaction, tránh 2 mentor cùng nhận).
  - Mentor bấm Hoàn thành → `status='resolved'`, `resolved_at=datetime.utcnow()`.
- **Giới hạn quyền Mentor:** Mọi endpoint trả về `submission_url` đều bị chặn hoàn toàn với JWT có role `mentor`. Mentor chỉ nhận được `submission_status` (boolean đã nộp hay chưa).

---

#### 2.3.10 Phân công Mentor theo Chủ đề *(Tính năng độc đáo #5)*

**Mô tả:** Mỗi chủ đề lớn/nhỏ được gán một hoặc nhiều mentor phụ trách. Thí sinh khi xem đề tài biết ngay mentor nào là người hỗ trợ chính. BTC điều chỉnh phân công bất kỳ lúc nào.

**Cách triển khai:**
- Bảng `topic_mentors` lưu quan hệ nhiều-nhiều `(topic_id, mentor_id)`.
- Khi thí sinh tạo ticket, hệ thống gợi ý (không bắt buộc) các mentor phụ trách đề tài mà đội đó đã chọn. Mentor khác vẫn có thể nhận ticket nếu trong chuyên môn của họ.

---

#### 2.3.11 Chuyển quyền Trưởng nhóm *(Tính năng độc đáo #6)*

**Mô tả:** Nhóm trưởng có thể chuyển quyền lãnh đạo sang thành viên khác bất kỳ lúc nào (ví dụ khi trưởng nhóm gặp sự cố, không thể tiếp tục).

**Cách triển khai:**
- Hai lệnh `UPDATE team_members` (đổi role của cũ sang member, đổi role của mới sang leader) được đặt trong 1 database transaction để đảm bảo tính nguyên tử — không bao giờ xảy ra trạng thái đội có 0 leader hoặc 2 leader.

---

#### 2.3.12 Bảng xếp hạng (Leaderboard)

**Mô tả:** Hiển thị điểm tổng của tất cả đội thi, sắp xếp từ cao xuống thấp. Chỉ công khai khi Admin bật chế độ công bố kết quả.

**Cách triển khai:**
- API `/leaderboard` kiểm tra `hackathon_config.results_published`. Nếu `false`, chỉ trả về điểm của đội hiện tại. Nếu `true`, trả về toàn bộ danh sách sắp xếp theo `total_score DESC`.
- Điểm tổng đã được tính sẵn và lưu trong `evaluations.total_score` — query chỉ cần đọc dữ liệu có sẵn, không tính lại, đảm bảo tốc độ tải nhanh.

---

#### 2.3.13 Export dữ liệu CSV (Admin)

**Mô tả:** Admin xuất toàn bộ bảng điểm, danh sách đội, thông tin thành viên ra file CSV/Excel để lưu trữ hồ sơ chính thức.

**Cách triển khai:**
- Backend dùng thư viện `pandas` hoặc module `csv` của Python để generate file từ query database.
- API trả về `StreamingResponse` với header `Content-Disposition: attachment; filename=hackflow_results.csv` để trình duyệt tự động tải file về.

---

#### 2.3.14 Giải quyết vấn đề chịu tải trong 15 phút cuối

**Mô tả:** Kịch bản nghẹn tải nghiêm trọng nhất: Hàng chục/hàng trăm đội cùng nộp bài trong 15 phút cuối trước deadline, kèm hiện tượng spam nút Submit.

**Cách triển khai — 3 tầng bảo vệ:**

1. **Direct-to-Cloud Upload (Tầng 1 — quan trọng nhất):** File dung lượng lớn (PDF, video) KHÔNG đi qua server Python. Frontend xin Presigned URL → tải file thẳng lên Cloud Storage → Cloud trả về URL → Frontend gửi URL về Backend để lưu vào database. Server Python chỉ xử lý JSON nhẹ, không bao giờ bị nghẹn vì file lớn.

2. **FastAPI Async + Uvicorn (Tầng 2):** FastAPI chạy trên ASGI với `async/await`. Khi 500 đội gửi request cùng lúc, Uvicorn không block — xử lý bất đồng bộ, request nào đang chờ I/O thì nhường CPU cho request khác.

3. **Debounce + Disable nút Submit ở Frontend (Tầng 3):** Ngay khi thí sinh bấm Submit, nút bị disable lập tức và hiện trạng thái loading. Ngăn hoàn toàn hiện tượng spam click gây ra duplicate requests.

---

### 2.4 Giải quyết các rủi ro kỹ thuật

| Rủi ro | Giải pháp |
|---|---|
| **2 nhóm cùng chọn 1 đề tài** | `SELECT FOR UPDATE` trong PostgreSQL Transaction — đảm bảo atomic |
| **Thí sinh chỉnh đồng hồ máy để nộp trễ** | Validate thời gian bằng `datetime.utcnow()` ở Server-side, không tin client |
| **Lời mời vào đội: từ chối, hết hạn, đội đầy** | State machine rõ ràng cho `invitation_status`, kiểm tra giới hạn trước khi accept |
| **Bug tính điểm theo trọng số** | Unit test cho hàm `calculate_weighted_score()`, validate `Σweight = 1.0` khi Admin lưu |
| **Thí sinh sửa GitHub sau deadline** | Commit SHA Freeze + Cron job kiểm tra sau deadline, cảnh báo Giám khảo |

---

### 2.5 Phạm vi MVP và lộ trình

**Giai đoạn 1 (Core Workflow):**
- GitHub OAuth + Hoàn thiện hồ sơ thí sinh
- Tạo đội / Mời thành viên / Quản lý đội (chuyển trưởng nhóm)
- Admin: Cấu hình chương trình + Timeline + Tiêu chí chấm điểm
- Danh sách đề tài + Nhóm trưởng chọn đề tài (có xử lý concurrency)
- Checkpoint System (time-gated, lưu lịch sử)
- Nộp sản phẩm cuối (kèm Commit SHA Freeze)

**Giai đoạn 2 (Collaboration & Judging):**
- Ticket hỗ trợ Mentor tích hợp (3 trạng thái)
- Judge Portal + Chấm điểm theo tiêu chí (split-screen)
- Bảng xếp hạng (ẩn/hiện theo Admin)

**Giai đoạn 3 (Polish & Reporting):**
- Mentor Portal đầy đủ (phân công theo chủ đề)
- Blind Judging option
- GitHub Commit Freeze tự động (cron job)
- Export CSV kết quả
- Email Notification tự động (nhắc deadline, phản hồi ticket)
- Statistics Dashboard cho Admin (tỉ lệ nộp bài, số ticket theo thời gian)
