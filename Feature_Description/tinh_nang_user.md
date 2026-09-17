# Tính năng dành cho Thí sinh (Participant)

## Tổng quan
Thí sinh là người tham gia cuộc thi. Sau khi đăng nhập và hoàn thiện hồ sơ cá nhân, thí sinh có thể tạo/tham gia đội thi, chọn đề tài, nộp bài theo từng checkpoint, theo dõi tiến độ thi, và gửi ticket nhờ mentor hỗ trợ khi gặp khó khăn. Tùy vào vai trò trong đội (**Nhóm trưởng** hoặc **Thành viên**), mức độ quyền hạn trên hệ thống sẽ khác nhau.

---

## 1. Đăng nhập bằng GitHub OAuth
- Trang đăng nhập hiển thị **một nút duy nhất**: **[Đăng nhập bằng GitHub]**.
- Nhấn vào nút này, hệ thống chuyển hướng đến trang xác thực của GitHub. Thí sinh đăng nhập bằng tài khoản GitHub cá nhân của mình.
- Sau khi GitHub xác nhận thành công, hệ thống tự động tạo tài khoản HackFlow và chuyển thí sinh đến màn hình **Hoàn thiện hồ sơ**.

---

## 2. Hoàn thiện hồ sơ cá nhân (Bắt buộc khi lần đầu đăng nhập)
Thí sinh phải điền đầy đủ trước khi có thể sử dụng các tính năng khác:

### Thông tin cơ bản (Tất cả đều bắt buộc):
- **Họ và tên đầy đủ**
- **Ngày sinh**
- **Giới tính** (Nam / Nữ / Khác)
- **Tỉnh / Thành phố**
- **Quận / Huyện**
- **Số điện thoại**
- **Trường học** *(không bắt buộc)*

### Thông tin chuyên môn (Bắt buộc):
- **Kỹ năng kỹ thuật chính:** Chọn một hoặc nhiều từ danh sách (Frontend, Backend, AI/ML, IoT, UI/UX, Blockchain, Data Science, Mobile,...). Phần này sẽ hiển thị cho các đội thi khác xem khi tìm thành viên.
- **Hướng chuyên sâu:** Chọn định hướng chính (tương tự kỹ năng, nhưng chọn 1 hướng ưu tiên nhất).

Sau khi lưu thông tin, hệ thống chuyển đến **Trang chủ** của ứng dụng.

---

## 3. Trang chủ
Trang chủ hiển thị tổng quan các thông tin quan trọng nhất:

- **Thông báo mới nhất** từ BTC (tin tức, sự kiện, thay đổi lịch thi,...).
- **Mốc thời gian sắp tới:** Countdown đến deadline gần nhất (đăng ký đội, checkpoint, nộp sản phẩm).
- **Trạng thái đội của tôi:** Đã vào đội chưa, đề tài đã chọn chưa, checkpoint tiếp theo cần nộp.
- Các đường dẫn nhanh đến các tính năng chính.

---

## 4. Tạo đội thi
*(Chỉ thí sinh chưa thuộc đội nào mới thấy tính năng này)*

1. Nhấn **[Tạo đội mới]**.
2. Điền thông tin:
   - **Tên đội** *(bắt buộc)*: Tên độc đáo, không trùng với đội khác đã đăng ký.
   - **Mô tả ngắn về đội** *(bắt buộc)*: Giới thiệu định hướng, thế mạnh hoặc mục tiêu của đội.
3. Nhấn **[Tạo đội]**. Thí sinh tạo đội sẽ tự động trở thành **Nhóm trưởng**.
4. Đội vừa tạo sẽ ở trạng thái **"Chờ BTC phê duyệt"**. Sau khi BTC duyệt, đội mới có thể tham gia các hoạt động.

---

## 5. Tham gia đội thi
*(Chỉ thí sinh chưa thuộc đội nào mới thấy tính năng này)*

- **Tìm kiếm đội:** Vào danh sách đội thi, tìm kiếm theo tên đội.
- **Gửi yêu cầu tham gia:** Nhấn **[Xin vào đội]** vào đội mong muốn. Yêu cầu sẽ được gửi đến Nhóm trưởng của đội đó.
- **Nhóm trưởng phê duyệt:** Nhóm trưởng vào hệ thống, xem danh sách yêu cầu tham gia, nhấn **[Chấp nhận]** hoặc **[Từ chối]**.
- Sau khi được chấp nhận, thí sinh chính thức trở thành **Thành viên** của đội.
- **Lưu ý:** Hệ thống tự động kiểm tra số lượng thành viên tối đa do BTC cấu hình. Nếu đội đã đủ người, nút **[Xin vào đội]** sẽ bị vô hiệu hóa.

---

## 6. Quản lý đội thi
*(Chỉ Nhóm trưởng mới có đầy đủ quyền)*

- **Xem danh sách thành viên:** Tất cả thành viên đều xem được.
- **Xem và quản lý yêu cầu tham gia:** Chấp nhận hoặc từ chối. *(Chỉ Nhóm trưởng)*
- **Xóa thành viên khỏi đội.** *(Chỉ Nhóm trưởng)*
- **Chuyển quyền Nhóm trưởng** sang một thành viên khác. *(Chỉ Nhóm trưởng)*
- **Rời khỏi đội.** *(Chỉ Thành viên — Nhóm trưởng phải chuyển quyền trước khi rời)*

---

## 7. Xem thông tin cuộc thi
Trang thông tin chính thức về chương trình, do BTC cập nhật:

- **Kênh thông tin chính thức:** Đường dẫn đến fanpage, group, Discord, email của BTC.
- **Tin tức & Thông báo:** Danh sách các thông báo quan trọng theo thứ tự thời gian.
- **Giải thưởng:** Chi tiết các hạng giải và phần thưởng.
- **Thể lệ & Quy định tham gia.**
- **Timeline cuộc thi:** Hiển thị toàn bộ các mốc thời gian quan trọng dưới dạng lịch trình trực quan.

---

## 8. Danh sách Đề tài
*(Chỉ đội đã được BTC phê duyệt mới có thể chọn đề tài)*

- **Xem tất cả chủ đề lớn:** Danh sách các chủ đề lớn, mỗi chủ đề hiển thị tên, mô tả tổng quan và mentor phụ trách.
- **Xem chi tiết chủ đề lớn:** Danh sách các chủ đề nhỏ bên trong. Với mỗi chủ đề nhỏ:
  - Tên và mô tả chi tiết vấn đề cần giải quyết.
  - Dữ liệu mẫu (nếu có): Link download hoặc xem trực tuyến.
  - Tài liệu tham khảo: Danh sách link đến bài viết, paper liên quan.
  - Số nhóm còn có thể đăng ký (ví dụ: "Còn 2/3 suất").
- **Chọn đề tài:** Nút **[Chọn đề tài này]** chỉ hiển thị cho **Nhóm trưởng**. Sau khi nhấn, hệ thống hiển thị hộp thoại xác nhận: *"Bạn có chắc chắn muốn chọn đề tài này? Bạn chỉ được chọn một đề tài và có thể thay đổi trước [thời gian khóa đề tài]."*
- Nếu đề tài đã đủ số nhóm đăng ký, nút **[Chọn đề tài này]** bị vô hiệu hóa và hiển thị nhãn **"Đã hết suất"**.

---

## 9. Nộp bài Checkpoint
*(Nút checkpoint chỉ xuất hiện và có thể nhấn trong đúng khoảng thời gian BTC quy định)*

- **Danh sách checkpoint** hiển thị dưới dạng các nút trên timeline:
  - **Xám / Khóa:** Checkpoint chưa đến giờ mở, hoặc đã qua hạn nộp.
  - **Xanh dương / Mở:** Đang trong thời gian nhận bài.
  - **Xanh lá / Đã nộp:** Đội đã nộp thành công cho checkpoint này.

- **Màn hình nộp checkpoint** (sau khi nhấn vào một checkpoint đang mở):
  - Hiển thị: Tên checkpoint, thời gian bắt đầu, thời gian kết thúc và **đồng hồ đếm ngược** thời gian còn lại.
  - Hiển thị: Mô tả chi tiết yêu cầu của checkpoint (cần nộp những gì, định dạng nào).
  - **Ô nhập link bài nộp:** Thí sinh dán link (GitHub, Google Drive, Slide, video,...).
  - **Nút [Nộp bài]:** Chỉ hiển thị cho **Nhóm trưởng**.
  - Sau khi nộp thành công: Nút đổi sang **[Xem lại bài nộp]** màu xanh lá.
  - **Nhóm trưởng** có thể nhấn **[Xem lại]** để cập nhật link bài nộp trước khi hết hạn.
  - **Thành viên** chỉ xem được link đã nộp, không được sửa.

- **Lịch sử nộp bài:** Xem tất cả các lần nộp (kể cả các lần cập nhật) kèm thời gian chính xác.

---

## 10. Nộp Sản phẩm cuối (Báo cáo sản phẩm)
*(Chỉ hiển thị cho Nhóm trưởng)*

Trang tổng kết toàn bộ quá trình và nộp sản phẩm hoàn chỉnh:

- **Tóm tắt các checkpoint đã qua:** Hiển thị lịch sử nộp bài của tất cả checkpoint.
- **Thông tin nộp sản phẩm cuối:**
  - Thời gian bắt đầu nhận, thời gian kết thúc và **đồng hồ đếm ngược**.
  - Yêu cầu chi tiết sản phẩm cuối cần nộp.
- **Form nộp sản phẩm:**
  - Link GitHub (repository chứa toàn bộ mã nguồn).
  - Link video demo sản phẩm (YouTube Unlisted / Loom).
  - Link slide thuyết trình (PDF hoặc Canva/Figma).
  - Mô tả ngắn sản phẩm (tóm tắt chức năng chính, công nghệ sử dụng).
- **Nút [Nộp sản phẩm]:** Sau khi nộp, hiển thị hộp thoại xác nhận lần cuối. Sau khi xác nhận, bài nộp được ghi lại chính thức với dấu thời gian. Nút chuyển sang **[Xem lại]** màu xanh lá.
- Nhóm trưởng có thể cập nhật lại bài nộp trước khi hết hạn. Mỗi lần cập nhật đều được ghi vào **lịch sử nộp bài**.

---

## 11. Bảng xếp hạng (Leaderboard)
- Hiển thị bảng xếp hạng tổng điểm của các đội thi.
- Thứ hạng chỉ hiển thị công khai sau khi BTC **bật công bố kết quả**.
- Trong thời gian chờ BTC công bố: Thí sinh chỉ thấy điểm và thứ hạng của đội mình.
- Sau khi công bố: Hiển thị đầy đủ bảng xếp hạng kèm điểm tổng, cho phép nhấn vào từng đội để xem nhận xét từ giám khảo.

---

## 12. Hệ thống Ticket hỗ trợ
*(Ticket chỉ có thể tạo trong khoảng thời gian BTC cho phép — thường là trong thời gian cuộc thi đang diễn ra)*

### Tạo ticket mới *(Chỉ Nhóm trưởng)*:
1. Nhấn **[Tạo ticket mới]**.
2. Điền thông tin:
   - **Tiêu đề vấn đề** *(bắt buộc)*: Mô tả ngắn gọn vấn đề.
   - **Mô tả chi tiết** *(bắt buộc)*: Diễn giải đầy đủ vấn đề đang gặp phải, đã thử cách nào chưa, lỗi cụ thể là gì,...
   - **Mức độ ưu tiên** *(bắt buộc)*: 🔴 Cao (chặn tiến độ hoàn toàn) / 🟡 Trung bình / 🟢 Thấp.
3. Nhấn **[Gửi ticket]**. Ticket xuất hiện trong hệ thống ở trạng thái **"Chờ xử lý"**.

### Theo dõi ticket:
- **Tab "Đang chờ xử lý":** Các ticket đội đã gửi nhưng chưa có mentor nhận.
  - Nhóm trưởng có thể nhấn **[Hủy ticket]** nếu vấn đề đã tự giải quyết được.
- **Tab "Đang được xử lý":** Ticket đã có mentor nhận. Thí sinh xem được tên và thông tin của mentor đang phụ trách.
- **Tab "Đã hoàn thành":** Các ticket đã được giải quyết, kèm phản hồi đầy đủ từ mentor.

---

## 13. Màn hình cá nhân
- Xem lại toàn bộ thông tin hồ sơ đã khai báo.
- Chỉnh sửa bất kỳ trường nào (tương tự màn hình hoàn thiện hồ sơ ban đầu).
- Xem thông tin đội đang thuộc về.