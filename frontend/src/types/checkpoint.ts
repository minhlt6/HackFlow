import type { BadgeVariant } from '../components/Badge';

export type CheckpointStatus = 'upcoming' | 'open' | 'grace_period' | 'closed';

export type SubmissionStatus =
  | 'submitted'
  | 'pending_sha_freeze'
  | 'sha_verification_failed'
  | 'evaluated'
  | 'late'
  | 'invalid'
  | 'SUBMITTED'
  | 'PENDING_SHA_FREEZE'
  | 'SHA_VERIFICATION_FAILED'
  | 'EVALUATED'
  | 'LATE'
  | 'INVALID';

export type CheckpointErrorCode =
  | 'FORBIDDEN_NOT_TEAM_LEADER'
  | 'ACCOUNT_NOT_APPROVED'
  | 'INVALID_CHECKPOINT_STATUS'
  | 'CHECKPOINT_NOT_OPEN'
  | 'CHECKPOINT_INACTIVE'
  | 'DEADLINE_EXCEEDED'
  | 'MISSING_REQUIRED_FIELD'
  | 'GITHUB_REPO_INACCESSIBLE'
  | 'INVALID_GITHUB_URL'
  | 'GITHUB_REPO_EMPTY'
  | 'GITHUB_API_UNAVAILABLE';

export interface SubmissionFieldConfig {
  field_key: string;
  field_label: string;
  required: boolean;
  apply_sha_freeze?: boolean;
}

export interface Checkpoint {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  deadline: string;
  requirements?: string | null;
  is_active: boolean;
  is_final_checkpoint?: boolean;
  grace_period_seconds?: number;
  submission_fields?: SubmissionFieldConfig[] | null;
  order?: number;
  status?: CheckpointStatus;
  is_open?: boolean;
  can_submit?: boolean;
  time_remaining_seconds?: number;
  time_until_start_seconds?: number;
  server_time?: string;
}

export interface Submission {
  id: string;
  checkpoint_id: string;
  team_id: string;
  repo_url?: string | null;
  demo_url?: string | null;
  commit_sha?: string | null;
  submission_data?: Record<string, string> | null;
  status: SubmissionStatus;
  grace_period_applied?: boolean;
  submitted_at: string;
  feedback?: string | null;
  note?: string | null;
}

export interface CheckpointSubmissionPayload {
  repo_url?: string;
  demo_url?: string;
  note?: string;
  submission_data?: Record<string, string>;
  [key: string]: unknown;
}

export interface CheckpointWithSubmission extends Checkpoint {
  latest_submission?: Submission | null;
}

/**
 * Bảng ánh xạ mã lỗi chuẩn từ Backend sang thông báo tiếng Việt rõ ràng
 */
export const SRS_HF23_ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN_NOT_TEAM_LEADER:
    'Chỉ Đội trưởng (TEAM_LEADER) mới có quyền nộp hoặc cập nhật bài thi cho đội (Mã lỗi: 403 FORBIDDEN_NOT_TEAM_LEADER).',
  ACCOUNT_NOT_APPROVED:
    'Tài khoản của bạn chưa được Ban tổ chức phê duyệt (APPROVED) để thực hiện nộp bài (Mã lỗi: 403 ACCOUNT_NOT_APPROVED).',
  INVALID_CHECKPOINT_STATUS:
    'Cổng nộp bài cho chặng thi này chưa mở hoặc đang tạm khóa bởi Ban tổ chức (Mã lỗi: 400 INVALID_CHECKPOINT_STATUS).',
  CHECKPOINT_NOT_OPEN:
    'Cổng nộp bài cho chặng thi này hiện chưa đến giờ mở hoặc đã bị khóa (Mã lỗi: 403 CHECKPOINT_NOT_OPEN).',
  CHECKPOINT_INACTIVE:
    'Checkpoint này đang tạm khóa hoặc đã bị vô hiệu hóa bởi Ban tổ chức (Mã lỗi: 403 CHECKPOINT_INACTIVE).',
  DEADLINE_EXCEEDED:
    'Đã quá thời hạn nộp bài cho chặng thi này (kể cả thời gian ân hạn mạng). Hệ thống đã đóng cổng tiếp nhận (Mã lỗi: DEADLINE_EXCEEDED).',
  MISSING_REQUIRED_FIELD:
    'Thiếu trường dữ liệu bắt buộc theo cấu hình của chặng thi. Vui lòng kiểm tra và điền đầy đủ các mục có dấu * (Mã lỗi: 422 MISSING_REQUIRED_FIELD).',
  GITHUB_REPO_INACCESSIBLE:
    'Không thể truy cập kho mã nguồn GitHub. Vui lòng kiểm tra lại đường dẫn URL (Mã lỗi: 422 GITHUB_REPO_INACCESSIBLE).',
  INVALID_GITHUB_URL:
    'Đường dẫn GitHub repository không đúng định dạng chuẩn https://github.com/{owner}/{repo} (Mã lỗi: 422 INVALID_GITHUB_URL).',
  GITHUB_REPO_EMPTY:
    'Kho mã nguồn GitHub hiện đang rỗng. Vui lòng đẩy mã nguồn lên repository trước khi nộp bài (Mã lỗi: 422 GITHUB_REPO_EMPTY).',
  GITHUB_API_UNAVAILABLE:
    'Dịch vụ kết nối tạm thời gián đoạn. Vui lòng thử lại sau (Mã lỗi: 503 GITHUB_API_UNAVAILABLE).',
};

/**
 * Lấy danh sách trường nộp bài hiệu lực theo cấu hình động `checkpoint.submission_fields`.
 * Nếu `submission_fields` chưa được cấu hình:
 * - Chặng cuối (`is_final_checkpoint === true`): Bắt buộc `repo_url` + tùy chọn `demo_url`.
 * - Chặng trung gian (`is_final_checkpoint === false`): Chỉ hiển thị trường nộp link báo cáo/tài liệu/demo (`demo_url`).
 */
export function getEffectiveSubmissionFields(checkpoint: Checkpoint): SubmissionFieldConfig[] {
  if (Array.isArray(checkpoint.submission_fields) && checkpoint.submission_fields.length > 0) {
    return checkpoint.submission_fields;
  }

  if (checkpoint.is_final_checkpoint) {
    return [
      {
        field_key: 'repo_url',
        field_label: 'GitHub Repository URL',
        required: true,
        apply_sha_freeze: false,
      },
      {
        field_key: 'demo_url',
        field_label: 'Link Live Demo / Video Pitch Deck',
        required: false,
        apply_sha_freeze: false,
      },
    ];
  }

  return [
    {
      field_key: 'demo_url',
      field_label: 'Link Báo cáo / Slide / Wireframe / Demo',
      required: true,
      apply_sha_freeze: false,
    },
  ];
}

/**
 * Phân tích trạng thái bài nộp (`Submission.status`)
 */
export function getSubmissionStatusMeta(status: SubmissionStatus, isFinal: boolean): {
  normalizedStatus: string;
  badgeVariant: BadgeVariant;
  badgeLabel: string;
  containerClass: string;
  iconBgClass: string;
  title: string;
  statusNote?: string;
} {
  const normalizedStatus = String(status || 'submitted').toLowerCase();

  switch (normalizedStatus) {
    case 'evaluated':
      return {
        normalizedStatus,
        badgeVariant: 'success',
        badgeLabel: 'Đã chấm điểm',
        containerClass: 'bg-emerald-500/10 border-emerald-500/30',
        iconBgClass: 'bg-emerald-500/20 text-emerald-400',
        title: isFinal
          ? 'Đã ghi nhận & chấm điểm bài nộp sản phẩm!'
          : 'Đã ghi nhận & chấm điểm báo cáo tiến độ!',
      };
    case 'late':
      return {
        normalizedStatus,
        badgeVariant: 'warning',
        badgeLabel: 'Nộp muộn',
        containerClass: 'bg-amber-500/10 border-amber-500/30',
        iconBgClass: 'bg-amber-500/20 text-amber-400',
        title: 'Đã ghi nhận bài nộp (Sau thời hạn chuẩn)',
      };
    case 'invalid':
      return {
        normalizedStatus,
        badgeVariant: 'danger',
        badgeLabel: 'Không hợp lệ',
        containerClass: 'bg-rose-500/10 border-rose-500/30',
        iconBgClass: 'bg-rose-500/20 text-rose-400',
        title: 'Bài nộp không hợp lệ — Vui lòng kiểm tra và nộp lại',
        statusNote:
          'Bản nộp này không hợp lệ (Sai định dạng đường dẫn yêu cầu).',
      };
    case 'submitted':
    default:
      return {
        normalizedStatus: 'submitted',
        badgeVariant: 'success',
        badgeLabel: 'Đã nộp',
        containerClass: 'bg-emerald-500/10 border-emerald-500/30',
        iconBgClass: 'bg-emerald-500/20 text-emerald-400',
        title: isFinal
          ? 'Đã ghi nhận bài nộp sản phẩm thành công!'
          : 'Đã ghi nhận báo cáo tiến độ thành công!',
      };
  }
}

/**
 * Định dạng nhãn thời gian nộp bài gồm cả thời gian tương đối và tuyệt đối (HF-31 AC-3)
 * Ví dụ: "2 phút trước", "12/10/2026 15:30"
 */
export function formatSubmissionTime(dateString: string): {
  relative: string;
  absolute: string;
  combined: string;
} {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return { relative: 'Vừa xong', absolute: dateString, combined: dateString };
  }

  const now = new Date();
  const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  let relative: string;
  if (diffSeconds < 15) {
    relative = 'Vừa xong';
  } else if (diffSeconds < 60) {
    relative = `${diffSeconds} giây trước`;
  } else if (diffSeconds < 3600) {
    const mins = Math.floor(diffSeconds / 60);
    relative = `${mins} phút trước`;
  } else if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    relative = `${hours} giờ trước`;
  } else if (diffSeconds < 86400 * 30) {
    const days = Math.floor(diffSeconds / 86400);
    relative = `${days} ngày trước`;
  } else {
    const months = Math.floor(diffSeconds / (86400 * 30));
    relative = `${months} tháng trước`;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  const absolute = `${day}/${month}/${year} ${hours}:${minutes}`;
  return {
    relative,
    absolute,
    combined: `${relative} (${absolute})`,
  };
}
