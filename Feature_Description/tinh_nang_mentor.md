# Tính năng dành cho Mentor (Người hướng dẫn)

## Tổng quan
Mentor là chuyên gia được BTC mời vào hệ thống để hỗ trợ kỹ thuật và tư vấn cho các đội thi trong suốt quá trình làm bài. Mentor **không có quyền chấm điểm** và **không thể xem link bài nộp** (để đảm bảo tính khách quan khi chấm thi). Mentor chỉ có thể xem trạng thái tiến độ tổng quan và xử lý các yêu cầu hỗ trợ (ticket) từ các đội thi.

---

## 1. Đăng nhập
- Đăng nhập bằng **tài khoản nội bộ** (username + password do BTC cấp sẵn qua email, không dùng GitHub OAuth).
- Lần đầu đăng nhập, hệ thống yêu cầu đổi mật khẩu.
- Sau khi đăng nhập thành công, hệ thống chuyển đến trang **Hoàn thiện hồ sơ** (nếu chưa điền) hoặc thẳng đến **Dashboard** (nếu đã có hồ sơ đầy đủ).

---

## 2. Hoàn thiện hồ sơ cá nhân (Bắt buộc trước khi sử dụng hệ thống)
Mentor phải điền đầy đủ thông tin hồ sơ trước khi bắt đầu nhận ticket. Tất cả các trường đều **bắt buộc**:

- **Họ và tên đầy đủ**
- **Email liên hệ chính thức**
- **Đơn vị công tác / Tổ chức** (Ví dụ: Công ty ABC, Trường Đại học XYZ)
- **Chức danh / Vị trí** (Ví dụ: Senior Software Engineer, Giảng viên AI)
- **Lĩnh vực chuyên môn chính** (chọn từ danh sách: Frontend, Backend, AI/ML, IoT, UI/UX, Blockchain, Data Science,...)
- **Giới thiệu ngắn về bản thân** *(không bắt buộc)*: Hiển thị cho thí sinh xem khi họ tra cứu mentor phụ trách đề tài.

---

## 3. Dashboard tổng quan
Màn hình đầu tiên sau khi đăng nhập. Hiển thị tóm tắt công việc cần xử lý:

- Số ticket đang chờ xử lý (của tất cả các đội, chưa có mentor nhận).
- Số ticket mình đang xử lý.
- Số ticket mình đã hoàn thành.
- Thông báo từ BTC (nếu có).

---

## 4. Xem danh sách đội thi
Mentor có thể xem toàn bộ danh sách đội tham gia cuộc thi. Đây là thông tin để mentor nắm bối cảnh và nhận ra đội thi khi xử lý ticket:

- Danh sách hiển thị: Tên đội, mô tả ngắn, đề tài đã chọn.
- Nhấn vào từng đội để xem chi tiết:
  - Tên đội và mô tả.
  - Danh sách thành viên: Họ tên và **1-2 vai trò kỹ thuật chính** (Frontend, Backend, AI,...).
  - Đề tài đã chọn (nếu có).
  - **Mentor phụ trách đề tài của đội đó** là ai (hiển thị để thí sinh và các mentor khác biết ai đang phụ trách).

---

## 5. Xem thông tin Checkpoint và tiến độ nộp bài
Mentor có thể theo dõi tiến độ nộp bài tổng quan của các đội để kịp thời hỗ trợ:

- Danh sách tất cả checkpoint của chương trình (tên, thời gian, yêu cầu).
- Với mỗi checkpoint: Xem trạng thái nộp của từng đội (Đã nộp / Chưa nộp).
- **Giới hạn quan trọng:** Mentor **chỉ xem được trạng thái** (Đã nộp / Chưa nộp), **không xem được nội dung bài nộp** (link GitHub, link slide,...). Quy định này nhằm đảm bảo mentor không bị ảnh hưởng bởi nội dung bài khi hỗ trợ.

---

## 6. Hệ thống Ticket hỗ trợ (Tính năng cốt lõi của Mentor)
Đây là kênh chính thức để đội thi liên lạc và nhờ mentor hỗ trợ trong quá trình làm bài. Toàn bộ lịch sử hỗ trợ được lưu lại có tổ chức trên hệ thống.

### Giao diện 3 tab:

#### Tab 1: "Chờ xử lý" (Ticket Pool)
- Hiển thị **tất cả ticket** của tất cả đội thi đang chờ có mentor nhận.
- **Thông tin mỗi ticket:**
  - Tên đội gửi ticket.
  - Tiêu đề vấn đề.
  - Mô tả ngắn vấn đề.
  - Mức độ ưu tiên: 🔴 Cao / 🟡 Trung bình / 🟢 Thấp (do đội thi tự đánh giá khi tạo ticket).
  - Thời gian tạo ticket.
- **Bộ lọc và sắp xếp:**
  - Lọc theo mức độ ưu tiên (Cao / Trung bình / Thấp).
  - Sắp xếp theo thời gian tạo (mới nhất / cũ nhất).
- **Hành động:** Mentor nhấn **[Nhận ticket]** nếu vấn đề nằm trong lĩnh vực chuyên môn và khả năng giải quyết của mình. Sau khi nhận, ticket chuyển sang Tab 2 và **biến mất khỏi Tab 1** để tránh nhiều mentor cùng nhận một ticket.

#### Tab 2: "Đang xử lý" (My Active Tickets)
- Hiển thị **các ticket mà chính mentor này đã nhận** và đang trong quá trình giải quyết.
- Với mỗi ticket, mentor có thể:
  - Xem toàn bộ thông tin chi tiết của ticket (mô tả đầy đủ, file đính kèm nếu có).
  - **Nhập phản hồi / hướng dẫn giải quyết:** Mentor nhập câu trả lời, hướng dẫn hoặc gợi ý vào ô phản hồi. Đội thi sẽ thấy phản hồi này trong màn hình ticket của họ.
  - Nhấn **[Đánh dấu Hoàn thành]** khi vấn đề đã được giải quyết. Ticket chuyển sang Tab 3.

#### Tab 3: "Đã hoàn thành" (Resolved Tickets)
- Hiển thị **toàn bộ lịch sử ticket mà chính mentor này đã giải quyết thành công.**
- Dùng để tra cứu lại các vấn đề đã giải quyết trước đó (tránh giải đáp trùng lặp).
- Mentor không thể chỉnh sửa ticket đã hoàn thành.

---

## 7. Thông tin cá nhân
- Xem lại thông tin hồ sơ đã khai báo.
- Chỉnh sửa bất kỳ trường nào (tương tự màn hình hoàn thiện hồ sơ ban đầu).
- Đổi mật khẩu đăng nhập.
