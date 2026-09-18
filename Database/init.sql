-- ============================================================
-- HackFlow — Script khởi tạo toàn bộ CSDL
-- Hệ quản trị: PostgreSQL (Supabase)
-- Chạy file này 1 lần duy nhất khi setup project
-- ============================================================

-- Kích hoạt extension UUID (Supabase đã có sẵn)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role        AS ENUM ('participant', 'mentor', 'judge', 'admin');
CREATE TYPE gender_type      AS ENUM ('male', 'female', 'other');
CREATE TYPE team_status      AS ENUM ('pending', 'approved', 'rejected', 'disqualified');
CREATE TYPE member_role      AS ENUM ('leader', 'member');
CREATE TYPE member_status    AS ENUM ('pending', 'accepted', 'rejected', 'left');
CREATE TYPE topic_mode       AS ENUM ('closed', 'open', 'hybrid');
CREATE TYPE ticket_priority  AS ENUM ('low', 'medium', 'high');
CREATE TYPE ticket_status    AS ENUM ('open', 'in_progress', 'resolved', 'cancelled');
CREATE TYPE eval_status      AS ENUM ('draft', 'submitted');
CREATE TYPE proposal_status  AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'revision_requested');

-- ============================================================
-- NHÓM 1: NGƯỜI DÙNG
-- ============================================================

CREATE TABLE users (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    github_id        VARCHAR(50)  UNIQUE,
    github_username  VARCHAR(100) UNIQUE,
    email            VARCHAR(255) NOT NULL UNIQUE,
    password_hash    VARCHAR(255),                          -- NULL với participant (dùng OAuth)
    role             user_role    NOT NULL DEFAULT 'participant',
    full_name        VARCHAR(255) NOT NULL,
    date_of_birth    DATE,
    gender           gender_type,
    province         VARCHAR(100),
    district         VARCHAR(100),
    phone            VARCHAR(20),
    school           VARCHAR(255),
    skills           TEXT[]       NOT NULL DEFAULT '{}',    -- Mảng kỹ năng: ['Frontend','AI/ML',...]
    major_direction  VARCHAR(100),
    bio              TEXT,
    avatar_url       VARCHAR(500),
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    profile_completed BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email        ON users(email);
CREATE INDEX idx_users_github_id    ON users(github_id);
CREATE INDEX idx_users_role         ON users(role);

-- ============================================================
-- NHÓM 2: CẤU HÌNH CUỘC THI (Singleton)
-- ============================================================

CREATE TABLE hackathon_config (
    id                       INTEGER      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name                     VARCHAR(255) NOT NULL DEFAULT 'HackFlow 2025',
    description              TEXT,
    logo_url                 VARCHAR(500),
    banner_url               VARCHAR(500),
    rules                    TEXT,
    prizes                   JSONB        NOT NULL DEFAULT '[]',   -- [{"rank":1,"title":"Nhất","value":"10tr"}]
    contact_channels         JSONB        NOT NULL DEFAULT '{}',   -- {"fanpage":"...","discord":"..."}
    min_team_size            SMALLINT     NOT NULL DEFAULT 2,
    max_team_size            SMALLINT     NOT NULL DEFAULT 5,
    topic_mode               topic_mode   NOT NULL DEFAULT 'closed',
    registration_start       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    registration_end         TIMESTAMPTZ  NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    topic_selection_deadline TIMESTAMPTZ,
    contest_start            TIMESTAMPTZ  NOT NULL DEFAULT NOW() + INTERVAL '8 days',
    contest_end              TIMESTAMPTZ  NOT NULL DEFAULT NOW() + INTERVAL '15 days',
    blind_judging            BOOLEAN      NOT NULL DEFAULT FALSE,
    results_published        BOOLEAN      NOT NULL DEFAULT FALSE,
    ticket_enabled           BOOLEAN      NOT NULL DEFAULT TRUE,
    updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by               UUID         REFERENCES users(id) ON DELETE SET NULL
);

-- Chèn dòng cấu hình mặc định (singleton)
INSERT INTO hackathon_config (id) VALUES (1);

-- ============================================================
-- NHÓM 3: ĐỘI THI
-- ============================================================

CREATE TABLE teams (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    status      team_status NOT NULL DEFAULT 'pending',
    blind_code  VARCHAR(20) UNIQUE,                        -- "Đội #07" khi Blind Judging bật
    created_by  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teams_name   ON teams(name);
CREATE INDEX idx_teams_status ON teams(status);

-- ----

CREATE TABLE team_members (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id      UUID          NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         member_role   NOT NULL DEFAULT 'member',
    status       member_status NOT NULL DEFAULT 'pending',
    invited_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    UNIQUE (team_id, user_id)
);

CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- ============================================================
-- NHÓM 4: ĐỀ TÀI
-- ============================================================

CREATE TABLE topics (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    display_order SMALLINT     NOT NULL DEFAULT 0,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ----

CREATE TABLE subtopics (
    id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id                 UUID         NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    name                     VARCHAR(255) NOT NULL,
    description              TEXT,
    sample_data_url          VARCHAR(500),
    reference_links          TEXT[]       NOT NULL DEFAULT '{}',
    max_teams                SMALLINT     NOT NULL DEFAULT 3,
    current_registered_count SMALLINT     NOT NULL DEFAULT 0
                                          CHECK (current_registered_count >= 0),
    display_order            SMALLINT     NOT NULL DEFAULT 0,
    is_active                BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subtopics_topic_id ON subtopics(topic_id);

-- ----

CREATE TABLE topic_mentors (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    subtopic_id UUID        NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
    mentor_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (subtopic_id, mentor_id)
);

-- ----

CREATE TABLE team_topic_selection (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID        NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,  -- Mỗi đội chọn đúng 1 đề tài
    subtopic_id UUID        NOT NULL REFERENCES subtopics(id) ON DELETE RESTRICT,
    selected_by UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----

-- Bảng đề xuất ý tưởng (dùng khi topic_mode = 'open' hoặc 'hybrid')
CREATE TABLE team_proposals (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id           UUID            NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
    submitted_by      UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title             VARCHAR(255)    NOT NULL,
    problem_statement TEXT            NOT NULL,
    proposed_solution TEXT            NOT NULL,
    tech_stack        TEXT[]          NOT NULL DEFAULT '{}',
    expected_outcome  TEXT,
    status            proposal_status NOT NULL DEFAULT 'draft',
    btc_feedback      TEXT,                                  -- Ghi chú khi yêu cầu sửa/từ chối
    assigned_mentor_id UUID           REFERENCES users(id) ON DELETE SET NULL,
    submitted_at      TIMESTAMPTZ,
    reviewed_at       TIMESTAMPTZ,
    reviewed_by       UUID            REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_team_proposals_status ON team_proposals(status);

-- ============================================================
-- NHÓM 5: CHECKPOINT & NỘP BÀI
-- ============================================================

CREATE TABLE checkpoints (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    open_at       TIMESTAMPTZ  NOT NULL,
    close_at      TIMESTAMPTZ  NOT NULL,
    display_order SMALLINT     NOT NULL DEFAULT 0,
    is_required   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CHECK (close_at > open_at)
);

-- ----

CREATE TABLE checkpoint_submissions (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    checkpoint_id  UUID        NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
    team_id        UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    submitted_by   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    submission_url VARCHAR(500) NOT NULL,
    note           TEXT,
    version        SMALLINT    NOT NULL DEFAULT 1,
    submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),       -- Timestamp UTC từ server
    is_latest      BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_checkpoint_submissions_team_checkpoint
    ON checkpoint_submissions(team_id, checkpoint_id);

-- ----

CREATE TABLE final_submissions (
    id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id                   UUID        NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
    submitted_by              UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    github_url                VARCHAR(500) NOT NULL,
    github_repo_owner         VARCHAR(100) NOT NULL,
    github_repo_name          VARCHAR(100) NOT NULL,
    frozen_commit_sha         VARCHAR(40),                   -- SHA lưu lúc nộp
    latest_commit_sha         VARCHAR(40),                   -- SHA cập nhật bởi cron job sau deadline
    has_post_deadline_changes BOOLEAN     NOT NULL DEFAULT FALSE,
    demo_video_url            VARCHAR(500),
    slide_pdf_url             VARCHAR(500),
    description               TEXT,
    submitted_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version                   SMALLINT    NOT NULL DEFAULT 1
);

-- ============================================================
-- NHÓM 6: CHẤM ĐIỂM
-- ============================================================

CREATE TABLE scoring_criteria (
    id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(255)   NOT NULL,
    description   TEXT,
    max_score     NUMERIC(5,2)   NOT NULL CHECK (max_score > 0),
    weight        NUMERIC(4,3)   NOT NULL CHECK (weight > 0 AND weight <= 1),
    display_order SMALLINT       NOT NULL DEFAULT 0,
    is_active     BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    -- Tổng weight của tất cả tiêu chí active phải = 1.0
    -- Kiểm tra ở tầng ứng dụng (Python) khi Admin lưu
);

-- ----

CREATE TABLE judge_assignments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    judge_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id     UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE (judge_id, team_id)
);

CREATE INDEX idx_judge_assignments_judge ON judge_assignments(judge_id);
CREATE INDEX idx_judge_assignments_team  ON judge_assignments(team_id);

-- ----

CREATE TABLE evaluations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    judge_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id         UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    total_score     NUMERIC(6,3),                            -- Tính bởi Python, lưu lại để query nhanh
    general_comment TEXT,
    status          eval_status NOT NULL DEFAULT 'draft',
    submitted_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (judge_id, team_id)
);

CREATE INDEX idx_evaluations_team_id  ON evaluations(team_id);
CREATE INDEX idx_evaluations_judge_id ON evaluations(judge_id);

-- ----

CREATE TABLE evaluation_details (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID          NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    criteria_id   UUID          NOT NULL REFERENCES scoring_criteria(id) ON DELETE RESTRICT,
    score         NUMERIC(5,2)  NOT NULL CHECK (score >= 0),
    note          TEXT,
    UNIQUE (evaluation_id, criteria_id)
);

CREATE INDEX idx_eval_details_evaluation ON evaluation_details(evaluation_id);

-- ============================================================
-- NHÓM 7: TICKET HỖ TRỢ
-- ============================================================

CREATE TABLE support_tickets (
    id                 UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id            UUID            NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_by         UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title              VARCHAR(500)    NOT NULL,
    description        TEXT            NOT NULL,
    priority           ticket_priority NOT NULL DEFAULT 'medium',
    status             ticket_status   NOT NULL DEFAULT 'open',
    assigned_mentor_id UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    assigned_at        TIMESTAMPTZ,
    resolved_at        TIMESTAMPTZ
);

CREATE INDEX idx_tickets_team_id         ON support_tickets(team_id);
CREATE INDEX idx_tickets_status          ON support_tickets(status);
CREATE INDEX idx_tickets_assigned_mentor ON support_tickets(assigned_mentor_id);

-- ----

CREATE TABLE ticket_messages (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content   TEXT        NOT NULL,
    sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_messages_ticket ON ticket_messages(ticket_id);

-- ============================================================
-- NHÓM 8: THÔNG BÁO
-- ============================================================

CREATE TABLE notifications (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,   -- 'ticket_replied','checkpoint_open','result_published',...
    title      VARCHAR(255) NOT NULL,
    body       TEXT,
    link       VARCHAR(500),
    is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread  ON notifications(user_id, is_read)
    WHERE is_read = FALSE;             -- Partial index: chỉ index các thông báo chưa đọc

-- ============================================================
-- HÀM TỰ ĐỘNG CẬP NHẬT updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gắn trigger vào các bảng có cột updated_at
CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_teams
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_hackathon_config
    BEFORE UPDATE ON hackathon_config
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_final_submissions
    BEFORE UPDATE ON final_submissions
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_evaluations
    BEFORE UPDATE ON evaluations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- NHÓM 9: TIN TỨC / THÔNG BÁO TỪ BTC
-- ============================================================

CREATE TABLE announcements (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by    UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,  -- Admin đăng bài
    title         VARCHAR(500) NOT NULL,
    content       TEXT         NOT NULL,                -- Nội dung bài đăng (hỗ trợ Markdown)
    cover_url     VARCHAR(500),                         -- Ảnh bìa (tuỳ chọn)
    is_pinned     BOOLEAN      NOT NULL DEFAULT FALSE,  -- Ghim lên đầu bảng tin
    is_published  BOOLEAN      NOT NULL DEFAULT FALSE,  -- Draft hay đã xuất bản
    published_at  TIMESTAMPTZ,                          -- Thời điểm xuất bản (NULL nếu còn draft)
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_published ON announcements(is_published, published_at DESC);
CREATE INDEX idx_announcements_pinned    ON announcements(is_pinned) WHERE is_pinned = TRUE;

CREATE TRIGGER set_updated_at_announcements
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- NHÓM 10: PHIÊN ĐĂNG NHẬP (Refresh Token)
-- ============================================================

CREATE TABLE refresh_tokens (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    VARCHAR(255) NOT NULL UNIQUE,         -- Lưu hash của token, không lưu raw
    device_info   VARCHAR(500),                         -- Trình duyệt, hệ điều hành (tuỳ chọn)
    ip_address    VARCHAR(45),                          -- IPv4 hoặc IPv6
    expires_at    TIMESTAMPTZ  NOT NULL,                -- Thời điểm hết hạn (thường 30 ngày)
    revoked       BOOLEAN      NOT NULL DEFAULT FALSE,  -- Token bị thu hồi (đăng xuất thủ công)
    revoked_at    TIMESTAMPTZ,                          -- Thời điểm thu hồi
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
-- Index partial: chỉ giữ token còn hiệu lực để truy vấn nhanh
CREATE INDEX idx_refresh_tokens_active     ON refresh_tokens(user_id, expires_at)
    WHERE revoked = FALSE;

-- ============================================================
-- DỮ LIỆU MẪU (Seed data — chỉ dùng cho môi trường development)
-- Bỏ comment phần này nếu muốn có dữ liệu test sẵn
-- ============================================================

/*
-- Tạo tài khoản Admin mẫu (password: Admin@123 — đã hash bcrypt)
INSERT INTO users (email, password_hash, role, full_name, profile_completed)
VALUES (
    'admin@hackflow.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2NdmoNlvGO',
    'admin',
    'HackFlow Admin',
    TRUE
);

-- Tạo tiêu chí chấm điểm mẫu (tổng weight = 1.0)
INSERT INTO scoring_criteria (name, description, max_score, weight, display_order) VALUES
    ('Tính sáng tạo',     'Ý tưởng có mới lạ, độc đáo, khác biệt so với các giải pháp hiện có', 10, 0.25, 1),
    ('Tính khả thi',      'Giải pháp có thể triển khai thực tế, có kế hoạch rõ ràng',           10, 0.20, 2),
    ('Kỹ thuật',          'Chất lượng code, kiến trúc hệ thống, lựa chọn công nghệ phù hợp',    10, 0.25, 3),
    ('Trình bày',         'Slide rõ ràng, thuyết trình tự tin, demo sản phẩm mượt mà',           10, 0.15, 4),
    ('Tác động xã hội',   'Giải pháp giải quyết vấn đề thực tế, có thể mở rộng quy mô',         10, 0.15, 5);
*/

-- ============================================================
-- KIỂM TRA SAU KHI CHẠY
-- Chạy query này để xác nhận tất cả 21 bảng đã được tạo:
-- ============================================================
/*
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
*/
