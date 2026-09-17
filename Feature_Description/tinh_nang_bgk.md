# Tính năng dành cho Ban Giám Khảo (Judge)

## Tổng quan
Giám khảo là người được Ban Tổ Chức mời vào hệ thống để đánh giá và chấm điểm sản phẩm của các đội thi. Giám khảo có quyền xem thông tin bài nộp và nhập điểm theo bộ tiêu chí mà BTC đã thiết lập sẵn. Giám khảo **không có quyền** xem kết quả của giám khảo khác (cho đến khi BTC công bố) và **không được phép** chấm điểm các đội mà mentor của họ là chính mình.

---

## 1. Đăng nhập
- Đăng nhập bằng **tài khoản nội bộ** (username + password do BTC cấp, không dùng GitHub OAuth).
- Sau khi đăng nhập, hệ thống chuyển thẳng đến **trang Dashboard của Giám khảo**.

---

## 2. Dashboard tổng quan
Màn hình đầu tiên sau khi đăng nhập. Hiển thị tóm tắt công việc cần làm:

- Số đội đã được phân công chấm / số đội đã chấm xong / số đội còn chưa chấm.
- Danh sách nhanh các đội còn thiếu điểm.
- Thông báo từ BTC (nếu có).

---

## 3. Xem danh sách đội thi
Giám khảo chỉ thấy các đội được BTC **phân công** cho mình, không thấy toàn bộ danh sách.

Mỗi đội trong danh sách hiển thị:
- **Tên đội** (hoặc **Mã đội ẩn danh** nếu BTC bật chế độ Blind Judging).
- **Đề tài đã chọn** (tên chủ đề nhỏ).
- **Trạng thái chấm điểm:** Chưa chấm / Đang chấm / Đã hoàn thành.
- **Điểm tổng hiện tại** (nếu đã chấm xong).

Nhấn vào một đội để xem trang chi tiết của đội đó.

---

## 4. Trang chi tiết đội thi
Trang thông tin đầy đủ của một đội, hiển thị tất cả dữ liệu giám khảo cần để đánh giá:

### 4.1 Thông tin đội
- Tên đội, mô tả ngắn về đội.
- Danh sách thành viên: Họ tên và vai trò kỹ thuật chính (Frontend, Backend, AI,...).
- Đề tài đã chọn.

### 4.2 Thông tin các Checkpoint đã qua
- Danh sách tất cả checkpoint của chương trình.
- Với mỗi checkpoint: Thời gian bắt đầu, thời gian kết thúc, trạng thái nộp của đội (Đã nộp / Không nộp).
- Nếu đội đã nộp: Hiển thị **link bài nộp** (link GitHub, Google Drive, Slide,...) và thời điểm nộp chính xác (ngày/giờ/phút).

### 4.3 Thông tin Sản phẩm cuối
- Thời gian bắt đầu và deadline nộp sản phẩm.
- Trạng thái nộp sản phẩm (Đã nộp / Chưa nộp).
- Nếu đã nộp: Hiển thị **link sản phẩm** (link GitHub, link demo, video,...) và thời điểm nộp chính xác.
- **Cảnh báo chỉnh sửa sau deadline (nếu có):** Nếu hệ thống phát hiện repo GitHub có commit mới sau thời điểm nộp, hiển thị cảnh báo màu đỏ kèm thông tin chi tiết về các commit đó.

---

## 5. Chấm điểm
Đây là tính năng cốt lõi của Giám khảo. Bố cục màn hình chấm được chia đôi:

- **Bên trái:** Toàn bộ thông tin bài nộp (link GitHub, link demo, slide,...) để giám khảo xem trực tiếp mà không cần chuyển tab.
- **Bên phải:** Form nhập điểm theo từng tiêu chí.

### Quy trình chấm:
1. Hệ thống tự động hiển thị đúng số ô nhập điểm tương ứng với số tiêu chí mà BTC đã cấu hình.
2. Với mỗi tiêu chí, giám khảo nhập:
   - **Điểm số** (từ 0 đến điểm tối đa của tiêu chí đó — hệ thống cảnh báo nếu nhập vượt quá).
   - **Nhận xét chi tiết** *(không bắt buộc)*: Giám khảo có thể ghi chú lý do cho điểm, phản hồi cụ thể về tiêu chí đó.
3. Nhập **nhận xét chung** cho toàn bộ bài thi *(không bắt buộc)*.
4. **Điểm tổng** được tính tự động theo trọng số và hiển thị real-time khi giám khảo nhập từng điểm tiêu chí.
5. Bấm **[Lưu điểm]** để xác nhận. Sau khi lưu, giám khảo vẫn có thể quay lại chỉnh sửa điểm cho đến khi BTC **khóa bảng điểm** (chức năng do Admin kiểm soát).

### Lưu ý về Blind Judging:
- Nếu BTC bật chế độ Blind Judging, giám khảo chỉ thấy **Mã đội** (ví dụ: "Đội #07") thay vì tên đội thật. Tên thật chỉ được hiển thị sau khi BTC công bố kết quả.

---

## 6. Tổng quan kết quả (sau khi BTC công bố)
Sau khi BTC khóa bảng điểm và công bố kết quả:
- Giám khảo có thể xem bảng xếp hạng tổng.
- Xem điểm của tất cả giám khảo khác cho từng đội (không còn ẩn danh nữa).
