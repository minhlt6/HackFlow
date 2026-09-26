export type UserRole = 'admin' | 'judge' | 'mentor' | 'participant';

export interface User {
  id: string;
  email: string;
  full_name: string;
  student_id?: string;
  role: UserRole;
  avatar_url?: string;
  github_username?: string;
  is_active: boolean;
  team_id?: string;
  school?: string;
  major_direction?: string;
  skills?: string[];
  bio?: string;
  profile_completed?: boolean;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'leader' | 'member';            // actual field from BE
  role_in_team: 'leader' | 'member';    // alias populated by BE validator
  status: 'pending' | 'accepted' | 'rejected' | 'left';
  invited_at?: string;
  user?: User;
}

export interface SubTopic {
  id: string;
  topic_id: string;
  title: string;
  name?: string;
  description: string;
  max_teams: number;
  current_registered_count: number;
  mentor_names?: string[];
  sample_data_url?: string;
  reference_links?: string[];
}

export interface Topic {
  id: string;
  title: string;
  name?: string;
  description: string;
  subtopics: SubTopic[];
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  invite_code?: string;                 // C-5: now returned by BE
  status: 'forming' | 'ready' | 'approved' | 'disqualified' | 'rejected' | 'pending';
  selected_subtopic_id?: string;
  subtopic_id?: string;
  subtopic?: SubTopic;
  leader_id?: string;                   // C-1: populated by BE model_validator
  created_by: string;
  members: TeamMember[];
  final_submission?: FinalSubmission;
}


export interface Checkpoint {
  id: string;
  name: string;
  description: string;
  // FIX P1-1: Backend trả open_at/close_at — đã đổi từ start_time/deadline
  open_at: string;
  close_at: string;
  display_order: number;
  is_required: boolean;
  status?: 'upcoming' | 'open' | 'closed';
  // Điểm checkpoint (Phase 2 — optional đến khi model migration xong)
  points?: number;
  late_penalty?: number;
  block_enabled?: boolean;
  block_threshold?: number;
  required_fields?: string[];
}

export interface CheckpointSubmission {
  id: string;
  checkpoint_id: string;
  team_id: string;
  repo_url: string;
  commit_sha: string;
  branch: string;
  notes?: string;
  submitted_at: string;
  is_late: boolean;
  score_awarded?: number;
  custom_fields?: Record<string, string>;
}

export interface FinalSubmission {
  id: string;
  team_id: string;
  repo_url: string;
  commit_sha: string;
  demo_url?: string;
  video_url?: string;
  description?: string;
  submitted_at: string;
  is_frozen: boolean;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  // FIX BUG-M3: Backend trả về 'sent_at', không phải 'created_at'
  sent_at: string;
  created_at?: string; // backward compat alias
  sender?: User;
}

export interface Ticket {
  id: string;
  team_id: string;
  team_name?: string;        // populated by API serializer
  created_by?: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high'; // 🔴 Cao / 🟡 Trung bình / 🟢 Thấp
  // FIX BUG-M1: backend dùng 'open' (không phải 'pending'), 'cancelled' (không phải 'closed')
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  assigned_mentor_id?: string;
  assigned_mentor?: User;
  created_at: string;
  assigned_at?: string;
  resolved_at?: string;      // FIX BUG-M2: dùng thay 'updated_at' (không tồn tại)
  messages: TicketMessage[];
}

export interface RubricScore {
  id: string;
  team_id: string;
  judge_id: string;
  criteria_innovation: number;
  criteria_technical: number;
  criteria_completeness: number;
  criteria_presentation: number;
  total_score: number;
  feedback?: string;
  created_at: string;
}

export interface LeaderboardItem {
  team_id: string;
  team_name: string;
  subtopic_title: string;
  judge_count: number;
  average_score: number;
  rank: number;
}

// ── Mentor-specific types ──────────────────────────────────────────────────

export interface MentorStats {
  pool_count: number;
  in_progress_count: number;
  resolved_count: number;
}

export interface MentorSubtopicTeam {
  team_id: string;
  team_name: string;
  leader_name: string;
  selected_at: string | null;
}

export interface MentorSubtopic {
  subtopic_id: string;
  subtopic_name: string;
  topic_name: string;
  max_teams: number;
  registered_count: number;
  teams: MentorSubtopicTeam[];
  assigned_at: string | null;
}

export interface CheckpointOverviewCheckpoint {
  id: string;
  name: string;
  display_order: number;
}

export interface CheckpointOverviewTeamRow {
  team_id: string;
  team_name: string;
  subtopic_name: string | null;
  checkpoints: Array<{ checkpoint_id: string; submitted: boolean }>;
}

export interface CheckpointOverview {
  checkpoints: CheckpointOverviewCheckpoint[];
  teams: CheckpointOverviewTeamRow[];
}

export interface HackathonConfig {
  id: number;
  name: string;
  description?: string;
  logo_url?: string;
  banner_url?: string;
  rules?: string;
  prizes?: Array<{ name: string; reward: string; description?: string }>;
  contact_channels?: Record<string, string>;
  min_team_size: number;
  max_team_size: number;
  topic_mode: string;
  registration_start: string;
  registration_end: string;
  topic_selection_deadline?: string;
  contest_start: string;
  contest_end: string;
  blind_judging: boolean;
  results_published: boolean;
  ticket_enabled: boolean;
}
