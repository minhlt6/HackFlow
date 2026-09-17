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

## 5. Quản lý Đội thi & Phê duyệt đăng ký
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

## 7. Quản lý Checkpoint
Tạo và quản lý các mốc nộp bài định kỳ trong quá trình làm sản phẩm:

### Thông tin mỗi checkpoint:
- **Tên checkpoint** *(bắt buộc)* (ví dụ: "Checkpoint 1 - Báo cáo ý tưởng")
- **Mô tả & yêu cầu chi tiết:** Các đội cần nộp gì, định dạng nào (link GitHub, link slide, link video,...).
- **Thời gian bắt đầu nhận bài:** Trước mốc này, nút nộp bài bị ẩn hoàn toàn.
- **Thời gian kết thúc (Deadline):** Sau mốc này, nút nộp bài bị khóa, không thể chỉnh sửa.

### Quản lý trạng thái nộp bài:
- Xem danh sách các đội đã nộp / chưa nộp cho từng checkpoint.
- Bộ lọc nhanh: Lọc theo trạng thái (Đã nộp / Chưa nộp) để biết đội nào cần nhắc nhở.

---

## 8. Quản lý Tiêu chí Chấm điểm
Tạo và quản lý bộ tiêu chí chấm điểm động. Mỗi cuộc thi có thể có bộ tiêu chí riêng, không cần sửa code:

- **Tên tiêu chí** *(bắt buộc)* (ví dụ: "Tính đột phá của ý tưởng")
- **Mô tả tiêu chí:** Hướng dẫn giám khảo hiểu rõ cần đánh giá điều gì.
- **Điểm tối đa** *(bắt buộc)* (ví dụ: 10 điểm)
- **Trọng số (%)** *(bắt buộc)* (ví dụ: 30%): Tổng trọng số của tất cả tiêu chí phải bằng 100%, hệ thống cảnh báo nếu vi phạm.
- Điểm tổng của từng đội được **tự động tính** theo công thức: `Tổng điểm = Σ (điểm tiêu chí × trọng số)`.
- Có thể **bật chế độ Blind Judging:** Khi bật, giám khảo sẽ không thấy tên đội khi chấm, chỉ thấy mã đội thi ẩn danh — đảm bảo chấm điểm khách quan.

---

## 9. Quản lý Mentor
Thêm mentor vào hệ thống và phân công theo chủ đề:

- **Thêm mentor:** Nhập email mentor. Hệ thống tự gửi email mời và cấp tài khoản đăng nhập (username + password tạm thời).
- **Xem danh sách mentor:** Thông tin hồ sơ, chủ đề phụ trách, số ticket đang xử lý.
- **Phân công mentor vào chủ đề:** Mỗi chủ đề có thể có nhiều mentor. Mentor chỉ thấy thông tin liên quan đến chủ đề mình phụ trách.

---

## 10. Quản lý Giám khảo
Thêm giám khảo vào hệ thống và phân công chấm thi:

- **Thêm giám khảo:** Nhập email. Hệ thống gửi email mời và cấp tài khoản.
- **Phân công chấm bài:** Admin chỉ định giám khảo nào chấm đội nào (hoặc để hệ thống phân công ngẫu nhiên). Đảm bảo nguyên tắc: mentor của đội không được phân công chấm đội đó.

---

## 11. Xem kết quả & Xuất dữ liệu
- **Bảng xếp hạng tổng:** Xem điểm tổng của tất cả đội thi, sắp xếp từ cao xuống thấp. Lọc theo trạng thái đã chấm đầy đủ hay chưa.
- **Xem chi tiết điểm từng đội:** Điểm từng tiêu chí từ từng giám khảo, nhận xét.
- **Xuất dữ liệu (Export CSV):** Xuất toàn bộ bảng điểm, danh sách đội, thông tin thành viên ra file CSV/Excel để lưu trữ hồ sơ chính thức.
