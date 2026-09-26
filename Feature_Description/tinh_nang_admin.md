# Tính năng dành cho Admin (Ban Tổ Chức - BTC)

## Tổng quan
Admin là người quản trị toàn bộ hệ thống. Admin có quyền cao nhất, chịu trách nhiệm thiết lập cấu hình chương trình, quản lý dữ liệu đội thi, phân công nhân sự (mentor, giám khảo), và giám sát tiến độ toàn bộ cuộc thi.

---

## 1. Đăng nhập
- Đăng nhập bằng **tài khoản nội bộ** (username + password do hệ thống cấp sẵn, không dùng GitHub OAuth).
- Sau khi đăng nhập thành công, hệ thống chuyển thẳng đến **trang Dashboard tổng quan**.

---

## 2. Dashboard tổng quan (Màn hình chính)
Màn hình đầu tiên sau khi đăng nhập. Hiển thị tất cả chỉ số vận hành quan trọng của cuộc thi dưới dạng thẻ thống kê và biểu đồ trực quan:

- **Thống kê nhanh:**
  - Tổng số đội đã đăng ký / đã được duyệt / chờ duyệt.
  - Tổng số thí sinh đã đăng nhập vào hệ thống.
  - Số đội đã nộp / chưa nộp cho từng checkpoint hiện tại.
  - Số ticket hỗ trợ đang chờ xử lý / đang xử lý / đã hoàn thành.
- **Mốc thời gian sắp tới:** Hiển thị countdown đến deadline gần nhất (checkpoint/sản phẩm).
- **Danh sách đội thi:** Bảng tra cứu nhanh trạng thái từng đội (đã nộp checkpoint chưa, đã chọn đề tài chưa,...).

---

## 3. Thiết lập thông tin chương trình
Cấu hình thông tin cơ bản của cuộc thi, hiển thị ra ngoài cho thí sinh thấy:

- **Tên chương trình** *(bắt buộc)*
- **Mô tả chương trình** *(bắt buộc)*: Hỗ trợ định dạng văn bản phong phú (Rich Text / Markdown).
- **Logo chương trình** *(bắt buộc)*: Upload ảnh, hiển thị trên thanh điều hướng và trang chủ.
- **Banner chương trình**: Upload ảnh banner lớn hiển thị trên trang thông tin chính.
- **Quy định & Thể lệ tham gia**: Nhập dạng văn bản, thí sinh phải đọc và xác nhận khi đăng ký.
- **Giải thưởng:** Danh sách các hạng giải và phần thưởng kèm theo (Giải Nhất, Nhì, Ba, Khuyến khích,...).
- **Kênh thông tin chính thức:** Thêm các đường dẫn đến fanpage, group Facebook, kênh Discord, email liên hệ của BTC.
- **Giới hạn số thành viên mỗi đội:** Thiết lập số thành viên tối thiểu (ví dụ: 2) và tối đa (ví dụ: 5) cho một đội thi. Hệ thống sẽ tự động kiểm tra và ngăn thí sinh tạo đội vi phạm giới hạn này.

---

## 4. Thiết lập thời gian diễn ra chương trình
Quản lý toàn bộ mốc thời gian của cuộc thi. Sau khi thiết lập, hệ thống sẽ tự động đóng/mở các tính năng (nút nộp bài, nút đăng ký,...) đúng giờ mà không cần can thiệp thủ công:

- **Thời gian bắt đầu nhận đăng ký đội thi.**
- **Thời gian kết thúc nhận đăng ký đội thi:** Sau mốc này, hệ thống tự khóa tính năng tạo đội và tham gia đội.
- **Thời gian bắt đầu cuộc thi chính thức.**
- **Dự kiến các mốc thời gian quan trọng** (ví dụ: ngày khai mạc, ngày công bố đề tài,...): Hiển thị dưới dạng timeline cho thí sinh theo dõi.
- **Thời gian kết thúc cuộc thi** (Deadline nộp sản phẩm cuối).

---

## 5. Phê duyệt Tài khoản Thí sinh *(Tính năng mới)*
> Kiểm soát chất lượng người tham gia: chỉ thí sinh được BTC xác nhận mới có thể sử dụng hệ thống.

### Luồng hoạt động:
1. Thí sinh tự đăng ký qua form `/login` (tab "Đăng ký thí sinh").
2. Tài khoản được tạo với trạng thái `pending` — **chưa đăng nhập được**.
3. Thí sinh gửi email xác nhận danh tính cho BTC (hệ thống cung cấp nút mailto tự điền template).
4. Admin vào tab **"Duyệt TK"** trong Dashboard để xem danh sách chờ duyệt.
5. Admin nhấn **[Phê duyệt]** → tài khoản chuyển sang `approved`, thí sinh đăng nhập được ngay.
6. Admin nhấn **[Từ chối]** → tài khoản bị `rejected`, thí sinh nhận thông báo khi đăng nhập.

### Thông tin hiển thị mỗi tài khoản chờ duyệt:
- Họ và tên
- Mã sinh viên *(nếu có)*
- Email đã đăng ký
- Thời điểm đăng ký

### Trạng thái tài khoản (`approval_status`):
| Trạng thái | Ý nghĩa | Hành động đăng nhập |
|---|---|---|
| `approved` | Được phê duyệt | ✅ Đăng nhập bình thường |
| `pending` | Chờ BTC duyệt | ❌ Màn hình chờ duyệt |
| `rejected` | BTC từ chối | ❌ Thông báo bị từ chối |

> **Lưu ý:** Tài khoản `admin`, `judge`, `mentor` luôn có `approval_status = approved` (không bị ảnh hưởng bởi cơ chế này).

### API liên quan:
- `GET /api/v1/admin/pending-users` → Danh sách tài khoản đang chờ duyệt
- `POST /api/v1/admin/users/{user_id}/approve` → Phê duyệt tài khoản
- `POST /api/v1/admin/users/{user_id}/reject` → Từ chối tài khoản

---

## 6. Quản lý Đội thi & Phê duyệt đăng ký
Admin có thể xem và quản lý danh sách tất cả các đội đã đăng ký:

- **Xem danh sách đội:** Hiển thị tên đội, số thành viên, đề tài đã chọn (nếu có), trạng thái (Chờ duyệt / Đã duyệt / Bị từ chối).
- **Phê duyệt đăng ký:** Admin duyệt từng đội hoặc duyệt hàng loạt. Sau khi được duyệt, đội mới có thể tham gia đầy đủ các hoạt động (chọn đề tài, nộp checkpoint,...).
- **Từ chối đăng ký:** Kèm theo lý do từ chối, hệ thống gửi thông báo đến nhóm trưởng của đội đó.
- **Xem chi tiết đội:** Tên đội, mô tả, danh sách thành viên kèm thông tin cá nhân (họ tên, email, trường, kỹ năng).

---

## 6. Quản lý Danh sách Đề tài (Chủ đề thi)
Admin tạo và quản lý danh sách đề tài để các đội lựa chọn. Cấu trúc gồm **Chủ đề lớn** chứa các **Chủ đề nhỏ (Sub-topic)**:

### Tạo Chủ đề lớn:
- **Tên chủ đề** *(bắt buộc)*
- **Mô tả tổng quan chủ đề** *(bắt buộc)*
- **Mentor phụ trách chủ đề:** Chọn từ danh sách mentor đã được thêm vào hệ thống. Mỗi chủ đề có thể có nhiều mentor.

### Tạo Chủ đề nhỏ (bên trong Chủ đề lớn):
- **Tên chủ đề nhỏ** *(bắt buộc)*
- **Mô tả chi tiết vấn đề cần giải quyết** *(bắt buộc)*
- **Dữ liệu mẫu:** Upload file hoặc dán link dữ liệu mẫu (nếu có).
- **Tài liệu tham khảo:** Danh sách link đến bài viết, paper, hoặc tài liệu kỹ thuật liên quan.
- **Giới hạn số nhóm:** Cấu hình số lượng nhóm tối đa có thể chọn mỗi chủ đề nhỏ (ví dụ: tối đa 3 nhóm/đề tài). Hệ thống tự động đóng đề tài khi đã đủ số nhóm.

---

## 7. Thống kê Lựa chọn Đề tài (Dashboard Đề tài)
Màn hình thống kê trực quan giúp Admin nắm toàn bộ tình trạng đăng ký đề tài của các đội thi. Đây là công cụ để phát hiện đề tài bị bỏ trống, đề tài bị quá tải, và hỗ trợ quyết định điều phối.

### Bảng tổng quan (Nhìn nhanh):
- **Tổng số đội đã chọn đề tài** / Tổng số đội đã được duyệt.
- **Tổng số đề tài còn trống** (chưa có đội nào đăng ký).
- **Đề tài gần hết suất** (còn 1 suất cuối).

### Biểu đồ phân bố đề tài:
- **Biểu đồ cột / thanh ngang:** Mỗi chủ đề lớn là một nhóm cột, mỗi cột con là một chủ đề nhỏ. Chiều cao cột = số đội đã chọn đề tài đó. Màu cột thay đổi theo mức độ lấp đầy (xanh lá = còn trống, vàng = gần đủ, đỏ = đã hết).
- **Chú thích ngay trên cột:** Hiển thị `[x / tối đa]` (ví dụ: `2 / 3 suất`).

### Bảng chi tiết từng đề tài:
Danh sách dạng bảng, mỗi hàng là một chủ đề nhỏ:

| Chủ đề lớn | Chủ đề nhỏ | Mentor phụ trách | Số đội đăng ký | Tối đa | Trạng thái | Danh sách đội |
|---|---|---|---|---|---|---|

- **Cột Trạng thái:** `🟢 Còn suất` / `🟡 Gần đủ` / `🔴 Đã hết` / `⬜ Trống`.
- **Cột Danh sách đội:** Nhấn vào để xổ ra danh sách tên các đội đã chọn đề tài đó, kèm thời điểm đăng ký.
- **Bộ lọc:** Lọc theo chủ đề lớn, lọc theo trạng thái (Còn suất / Hết suất / Trống).
- **Sắp xếp:** Theo số đội đăng ký (nhiều → ít / ít → nhiều), theo tên chủ đề.

### Danh sách đội chưa chọn đề tài:
- Hiển thị danh sách các đội đã được duyệt nhưng **chưa chọn đề tài**.
- Mỗi hàng: Tên đội, thời gian được duyệt, nhóm trưởng (email liên hệ).
- Nút **[Xuất danh sách]**: Xuất ra file CSV để gửi nhắc nhở hàng loạt.

### API / Backend cần hỗ trợ:
- `GET /api/admin/topics/stats` → Trả về JSON thống kê số đội đăng ký theo từng sub-topic.
- `GET /api/admin/topics/:subTopicId/teams` → Danh sách đội đã chọn đề tài đó.
- `GET /api/admin/teams/no-topic` → Danh sách đội chưa chọn đề tài.

---

## 8. Quản lý Checkpoint
Tạo và quản lý các mốc nộp bài định kỳ trong quá trình làm sản phẩm:

### Thông tin mỗi checkpoint:
- **Tên checkpoint** *(bắt buộc)* (ví dụ: "Checkpoint 1 - Báo cáo ý tưởng")
- **Mô tả & yêu cầu chi tiết:** Các đội cần nộp gì, định dạng nào (link GitHub, link slide, link video,...).
- **Thời gian bắt đầu nhận bài:** Trước mốc này, nút nộp bài bị ẩn hoàn toàn.
- **Thời gian kết thúc (Deadline):** Sau mốc này, nút nộp bài bị khóa, không thể chỉnh sửa.
- **Điểm cho từng checkpoint ** Điểm này sẽ được cộng cho các đội thi nếu đội này nộp đúng thời hạn , đưa ra cơ chế trừ nếu nộp muộn hoặc không nộp.
- Đưa thêm vào cơ chế block ( có thể bật tắt ) đưa vào số lượng checkpoint liên tiếp không nộp sẽ bị block khỏi hệ thống .

### Quản lý trạng thái nộp bài:
- Xem danh sách các đội đã nộp / chưa nộp cho từng checkpoint.
- Bộ lọc nhanh: Lọc theo trạng thái (Đã nộp / Chưa nộp) để biết đội nào cần nhắc nhở.

---

## 9. Quản lý Tiêu chí Chấm điểm
Tạo và quản lý bộ tiêu chí chấm điểm động. Mỗi cuộc thi có thể có bộ tiêu chí riêng, không cần sửa code:

- **Tên tiêu chí** *(bắt buộc)* (ví dụ: "Tính đột phá của ý tưởng")
- **Mô tả tiêu chí:** Hướng dẫn giám khảo hiểu rõ cần đánh giá điều gì.
- **Điểm tối đa** *(bắt buộc)* (ví dụ: 10 điểm)
- **Trọng số (%)** *(bắt buộc)* (ví dụ: 30%): Tổng trọng số của tất cả tiêu chí phải bằng 100%, hệ thống cảnh báo nếu vi phạm.
- Điểm tổng của từng đội được **tự động tính** theo công thức: `Tổng điểm = Σ (điểm tiêu chí × trọng số)`.
- Có thể **bật chế độ Blind Judging:** Khi bật, giám khảo sẽ không thấy tên đội khi chấm, chỉ thấy mã đội thi ẩn danh — đảm bảo chấm điểm khách quan.

---

## 10. Quản lý Mentor
Thêm mentor vào hệ thống và phân công theo chủ đề:

- **Thêm mentor:** Nhập email mentor. Hệ thống tự gửi email mời và cấp tài khoản đăng nhập (username + password tạm thời).
- **Xem danh sách mentor:** Thông tin hồ sơ, chủ đề phụ trách, số ticket đang xử lý.
- **Phân công mentor vào chủ đề:** Mỗi chủ đề có thể có nhiều mentor. Mentor chỉ thấy thông tin liên quan đến chủ đề mình phụ trách.

---

## 11. Quản lý Giám khảo
Thêm giám khảo vào hệ thống và phân công chấm thi:

- **Thêm giám khảo:** Nhập email. Hệ thống gửi email mời và cấp tài khoản.
- **Phân công chấm bài:** Admin chỉ định giám khảo nào chấm đội nào (hoặc để hệ thống phân công ngẫu nhiên). Đảm bảo nguyên tắc: mentor của đội không được phân công chấm đội đó.

---

## 12. Xem kết quả & Xuất dữ liệu
- **Bảng xếp hạng tổng:** Xem điểm tổng của tất cả đội thi, sắp xếp từ cao xuống thấp. Lọc theo trạng thái đã chấm đầy đủ hay chưa.
- **Xem chi tiết điểm từng đội:** Điểm từng tiêu chí từ từng giám khảo, nhận xét.
- **Xuất dữ liệu (Export CSV):** Xuất toàn bộ bảng điểm, danh sách đội, thông tin thành viên ra file CSV/Excel để lưu trữ hồ sơ chính thức.
