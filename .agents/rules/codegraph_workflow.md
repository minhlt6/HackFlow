# Quy tắc bắt buộc: Sử dụng và Cập nhật CodeGraph

Dự án HackFlow đã tích hợp cơ sở dữ liệu tri thức mã nguồn **CodeGraph** (SQLite index tại `.codegraph/codegraph.db`).
Mọi AI Agent khi nhận nhiệm vụ **khảo sát, phát triển tính năng mới, tái cấu trúc (refactoring), sửa lỗi (bugfix) hoặc kiểm thử (testing)** BẮT BUỘC phải truy cập và cập nhật cơ sở dữ liệu này theo quy trình sau:

---

## 1. Trước khi code / phát triển tính năng: BẮT BUỘC TRUY CẬP CODEGRAPH

Tuyệt đối không đoán mò cấu trúc codebase hoặc lặp đi lặp lại việc grep/read thủ công:

1. **Truy vấn qua MCP tool `codegraph_explore`** (Ưu tiên):
   - **Server:** `codegraph`
   - **Tool:** `codegraph_explore`
   - **Tham số:**
     - `projectPath`: `f:/E/Daihoc/Nam 4/Chuyên đề CNTT/HackFlow` (hoặc đường dẫn thư mục project)
     - `query`: Tên symbol (function, class, endpoint, schema), tên file, hoặc mô tả luồng tính năng cần phát triển (ví dụ: `"topic selection concurrency lock"`, `"create_submission checkpoint"`, `"TicketKanban support ticket"`).
   - **Phân tích Blast Radius:** Đọc kỹ danh sách caller/callee và mức độ ảnh hưởng (blast radius) mà CodeGraph trả về để biết chính xác những file và module nào phụ thuộc vào code sắp sửa.

2. **Dùng CLI nếu cần tra cứu sâu:**
   - `codegraph explore "<symbol hoặc truy vấn>"`: Xem source verbatim và luồng gọi.
   - `codegraph context "<tên tính năng>"`: Tổng hợp toàn diện context cho tính năng.
   - `codegraph impact <symbol>`: Phân tích chi tiết rủi ro khi sửa một symbol cụ thể.

---

## 2. Sau khi chỉnh sửa mã nguồn: BẮT BUỘC CẬP NHẬT CSDL CODEGRAPH

Mỗi khi tạo mới, chỉnh sửa, tái cấu trúc hoặc xóa các file mã nguồn:

1. **Đồng bộ hóa dữ liệu (Bắt buộc sau mỗi bước code xong):**
   ```powershell
   codegraph sync
   ```
   Lệnh này cập nhật nhanh các file bị thay đổi vào SQLite database `.codegraph/codegraph.db`.

2. **Re-index toàn diện (Khi có thay đổi cấu trúc lớn):**
   ```powershell
   codegraph index
   ```
   Sử dụng khi refactor quy mô lớn, di chuyển/đổi tên nhiều thư mục hoặc thêm hàng loạt module mới.

---

## 3. Khi kiểm thử (Testing) tính năng

1. **Xác định các test bị ảnh hưởng:**
   - Trước và trong khi viết test, chạy:
     ```powershell
     codegraph affected [danh_sách_file_nguồn_đã_sửa]
     ```
     *Ví dụ:* `codegraph affected backend/app/api/v1/topics.py backend/app/services/topic_service.py`
   - CodeGraph sẽ phân tích đồ thị phụ thuộc và chỉ ra chính xác các file test cần kiểm tra hoặc chạy lại.

2. **Cập nhật CSDL sau khi viết test:**
   - Sau khi hoàn thành viết test mới (trong `backend/tests/` hoặc frontend), BẮT BUỘC chạy:
     ```powershell
     codegraph sync
     ```
   - Giúp đồ thị luôn ghi nhận các node test mới và liên kết của chúng tới các hàm nghiệp vụ.

3. **Chạy kiểm thử:**
   - Chạy `pytest` (với backend) để xác nhận mọi test case đều pass và không bị hồi quy trước khi báo cáo kết quả.
