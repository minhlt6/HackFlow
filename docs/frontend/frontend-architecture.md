# 🖥️ Tài liệu Kiến trúc Giao diện Người dùng (Frontend Architecture Document)

> **Dự án:** HackFlow — Nền tảng Quản lý Hackathon Khép kín  
> **Tech Stack:** React 19 · TypeScript · Vite 8 · Tailwind CSS · React Router v7 · Zustand · Axios · Lucide Icons  
> **Môi trường chạy:** Local Development (`http://localhost:5173` kết nối `http://localhost:8000/api/v1`)

---

## 1. Tổng quan Kiến trúc Frontend

Frontend của **HackFlow** được thiết kế theo mô hình **Role-Based Single Page Application (SPA)** kết hợp kiến trúc **Reactive Dual-Store**:
- **3 Cổng Vai trò (Role Portals)**: Phân tách rõ ràng trải nghiệm và quyền hạn của **Thí sinh (`candidate`)**, **Ban Tổ Chức (`admin`)**, và **Cố vấn (`mentor`)** trên cùng một ứng dụng thống nhất.
- **Tầng Giao tiếp API Tập trung (`src/api/` & `src/services/`)**: Toàn bộ lời gọi HTTP REST đều đi qua `axiosClient` có Request/Response Interceptor tự động đính kèm Bearer JWT Token và xử lý mã lỗi chuẩn hóa từ Backend.
- **Đồng bộ Đa Tab Thời gian thực (`BroadcastChannel`)**: Khi người dùng hoặc kiểm thử viên thao tác ở một tab (ví dụ: Admin duyệt thí sinh, công bố thông báo khẩn hoặc Mentor trả lời Ticket), các tab khác đang mở tự động đồng bộ trạng thái tức thì.

---

## 2. Cấu trúc Thư mục Frontend (`frontend/src/`)

```text
frontend/src/
├── api/
│   ├── axiosClient.ts                   # Axios instance (baseURL: http://localhost:8000/api/v1), JWT Interceptor
│   ├── checkpointApi.ts                 # API quản lý & kiểm tra cửa sổ Checkpoint Time-gated
│   ├── notificationsApi.ts              # API thông báo chung (Announcements CRUD)
│   ├── profileApi.ts                    # API lưu & đồng bộ hồ sơ Onboarding cá nhân
│   ├── teamsApi.ts                      # API tạo đội, gia nhập bằng mã mời 6 ký tự, thông tin đội
│   └── topicsApi.ts                     # API danh sách đề tài, đăng ký nguyên tử & hủy đề tài
├── services/
│   ├── evaluationService.ts             # Dịch vụ lấy Barem Rubric & Bảng xếp hạng Leaderboard
│   └── ticketService.ts                 # Dịch vụ tạo, lọc, nhận xử lý, phản hồi, đóng/mở lại Support Ticket
├── store/
│   ├── useAuthStore.ts                  # Quản lý phiên đăng nhập, JWT Token & thông tin User
│   ├── useMockStore.ts                  # Kho dữ liệu tương tác đa vai trò & Role/Member Switcher
│   ├── useNotificationStore.ts          # Quản lý danh sách thông báo, trạng thái đã đọc & modal khẩn cấp
│   └── realtimeSync.ts                  # Đồng bộ trạng thái tức thời giữa các tab qua BroadcastChannel
├── layouts/
│   └── MainLayout.tsx                   # Bố cục chính: Sidebar động theo Role, Top Header, Notification Bell, Role Switcher
├── components/
│   ├── ProtectedRoute.tsx               # Route Guard kiểm tra Authentication, Approval Status & RBAC Role
│   ├── Badge.tsx, Button.tsx, Card.tsx  # Bộ Design System Components
│   ├── Input.tsx, Modal.tsx             # Form & Dialog Components
│   ├── CheckpointSubmissionForm.tsx     # Form nộp bài Checkpoint & kiểm tra GitHub URL
│   ├── SubmissionHistoryTable.tsx       # Bảng lịch sử bài nộp & trạng thái đóng băng Commit SHA
│   ├── NotificationBanner.tsx           # Banner thông báo ghim đầu trang
│   ├── NotificationBell.tsx             # Chuông thông báo kèm dropdown
│   ├── UrgentNotificationModal.tsx      # Popup thông báo khẩn cấp từ Ban Tổ Chức
│   └── common/                          # CountdownTimer, StatCard, RaceConditionModal, RbacForbiddenModal...
├── pages/
│   ├── LoginPage.tsx                    # Đăng nhập hợp nhất (Tài khoản nội bộ + GitHub OAuth 2.0)
│   ├── AuthCallback.tsx                 # Xử lý callback từ GitHub OAuth 2.0
│   ├── OnboardingPage.tsx               # Hoàn thiện hồ sơ cá nhân & kỹ năng cho thí sinh mới
│   ├── RejectedAccountPage.tsx          # Màn hình thông báo hồ sơ bị từ chối
│   ├── TeamsPage.tsx                    # Quản lý Đội thi, Mã mời 6 ký tự, Chuyển quyền Đội trưởng
│   ├── TopicsPage.tsx                   # Khám phá & Đăng ký Đề tài giới hạn Quota
│   ├── Scoreboard.tsx                   # Bảng xếp hạng chung cuộc & Công bố kết quả
│   ├── SupportTickets.tsx               # Không gian Helpdesk Ticket cho Thí sinh, Mentor & Admin
│   ├── candidate/                       # Các trang chuyên biệt của cổng Thí sinh
│   ├── admin/                           # 11 trang quản trị của cổng Ban Tổ Chức
│   └── mentor/                          # 4 trang chuyên biệt của cổng Cố vấn
└── App.tsx                              # Định nghĩa bảng định tuyến (React Router v7) & tiêu đề động
```

---

## 3. Bản đồ Định tuyến & Phân quyền 3 Cổng Vai trò (Routing Matrix)

| Đường dẫn (Route) | Component Trang | Vai trò truy cập | Mô tả chức năng chính |
|---|---|---|---|
| `/login` | `LoginPage` | Công khai | Đăng nhập Email/Alias hoặc GitHub OAuth 2.0 |
| `/auth/callback` | `AuthCallback` | Công khai | Xử lý mã ủy quyền GitHub OAuth trả về |
| `/onboarding` | `OnboardingPage` | `candidate` (`pending`) | Khai báo MSSV, Trường, SĐT, Kỹ năng chuyên môn |
| `/rejected` | `RejectedAccountPage` | `candidate` (`rejected`) | Thông báo trạng thái đơn đăng ký không được duyệt |
| `/dashboard` | `CandidateDashboardPage` | `candidate` (`approved`) | Tổng quan tiến độ đội thi, mốc Checkpoint & thông báo |
| `/teams` | `TeamsPage` | `candidate` (`approved`) | Tạo đội, nhập mã mời 6 ký tự, chuyển quyền Leader |
| `/topics` | `TopicsPage` | `candidate` (`approved`) | Xem danh mục đề tài, bộ lọc Quota & đăng ký đề tài |
| `/checkpoints` | `CandidateCheckpointsPage` | `candidate` (`approved`) | Đồng hồ đếm ngược, nộp bài theo chặng & đóng băng SHA |
| `/final-submission` | `CandidateFinalSubmissionPage` | `candidate` (`approved`) | Nộp sản phẩm chung cuộc (Repo, Demo Video, Slide Deck) |
| `/scoreboard` | `Scoreboard` | Mọi vai trò đã duyệt | Bảng xếp hạng điểm số trọng số & vinh danh Top 3 |
| `/tickets` | `SupportTickets` | `candidate`, `mentor`, `admin` | Gửi yêu cầu hỗ trợ, tiếp nhận, phản hồi & đóng/mở lại |
| `/admin/dashboard` | `AdminDashboardPage` | `admin` | Thống kê toàn cuộc thi theo thời gian thực |
| `/admin/approvals` | `AdminApprovalsPage` | `admin` | Phê duyệt hoặc từ chối hồ sơ thí sinh `pending` |
| `/admin/whitelist` | `AdminWhitelistPage` | `admin` | Quản lý danh sách email Whitelist (thêm đơn lẻ / hàng loạt) |
| `/admin/teams` | `AdminTeamsPage` | `admin` | Giám sát danh sách đội thi, thành viên & trạng thái khóa |
| `/admin/topics` | `AdminTopicsPage` | `admin` | Tạo/sửa/xóa đề tài và cấu hình hạn ngạch Quota |
| `/admin/checkpoints` | `AdminCheckpointsPage` | `admin` | Cấu hình cửa sổ thời gian mở/đóng các chặng Checkpoint |
| `/admin/criteria` | `AdminCriteriaPage` | `admin` | Thiết lập Barem tiêu chí chấm điểm Rubric & trọng số |
| `/admin/personnel` | `AdminMentorsJudgesPage` | `admin` | Phân công Cố vấn chuyên môn (Mentor) phụ trách đề tài |
| `/admin/results` | `AdminResultsPage` | `admin` | Rà soát điểm số & Công bố kết quả bảng xếp hạng |
| `/admin/announcements` | `AdminAnnouncementsPage` | `admin` | Phát thông báo chung, ghim tin hoặc gửi cảnh báo khẩn |
| `/admin/config` | `AdminConfigPage` | `admin` | Cấu hình thông số toàn cục của kỳ thi Hackathon |
| `/mentor/dashboard` | `MentorDashboardPage` | `mentor` | Tổng quan số lượng Ticket và đội thi phụ trách |
| `/mentor/tickets` | `SupportTickets` | `mentor`, `admin` | Hàng chờ Ticket mới & Ticket đang xử lý của Mentor |
| `/mentor/teams` | `MentorTeamsPage` | `mentor` | Theo dõi thông tin các đội thi thuộc đề tài hướng dẫn |
| `/mentor/checkpoints` | `MentorCheckpointsPage` | `mentor` | Theo dõi tiến độ nộp bài Checkpoint của các đội |
