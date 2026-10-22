import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  User,
  Team,
  MajorTopic,
  Checkpoint,
  CheckpointSubmission,
  FinalSubmission,
  RubricCriteria,
  TeamEvaluation,
  SupportTicket,
  WhitelistEntry,
  Announcement,
  HackathonConfig,
  RoomConfig,
  PeerEvaluationBallot,
  JudgingStage,
} from '../types';
import {
  mockUsers,
  initialHackathonConfig,
  initialWhitelist,
  initialPendingCandidates,
  initialMajorTopics,
  initialTeams,
  initialCheckpoints,
  initialSubmissions,
  initialFinalSubmissions,
  initialRubricCriteria,
  initialEvaluations,
  initialSupportTickets,
  initialAnnouncements,
  initialRooms,
  initialPeerEvaluations,
} from '../mock/mockData';

/**
 * Standard utility to ensure any score is strictly normalized to the 100-point rubric scale.
 * If scores map and criteria are present, computes: sum((clampedScore / maxScore) * weight) / totalWeight * 100.
 * Also defensively catches legacy cached values > 100 (e.g. 229.5) and restores them to 100-point scale.
 */
export const normalizeScoreTo100 = (
  totalScore?: number,
  scores?: Record<string, number>,
  criteria?: RubricCriteria[]
): number => {
  if (scores && criteria && criteria.length > 0) {
    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0) || 100;
    let weightedSum = 0;
    for (const c of criteria) {
      const raw = scores[c.id] ?? 0;
      const max = c.maxScore > 0 ? c.maxScore : 10;
      const clamped = Math.max(0, Math.min(raw, max));
      weightedSum += (clamped / max) * (c.weight || 0);
    }
    return Math.round(((weightedSum / totalWeight) * 100) * 10) / 10;
  }
  if (totalScore !== undefined && totalScore >= 0 && totalScore <= 100) {
    return Math.round(totalScore * 10) / 10;
  }
  if (totalScore !== undefined && totalScore > 100) {
    return Math.min(100, Math.round((totalScore / 10) * 10) / 10);
  }
  return totalScore ?? 0;
};

interface MockStoreState {
  // Current user & authentication
  currentUser: User;
  activeRolePersona: 'admin' | 'leader' | 'member' | 'pending' | 'rejected' | 'mentor';
  isAuthenticated: boolean;
  switchPersona: (persona: 'admin' | 'leader' | 'member' | 'pending' | 'rejected' | 'mentor') => void;
  logout: () => void;
  updateCurrentUserProfile: (profile: Partial<User>) => void;

  // Hackathon Configuration
  config: HackathonConfig;
  updateConfig: (newConfig: Partial<HackathonConfig>) => void;
  toggleBlindJudging: () => void;
  toggleResultsPublished: () => void;
  toggleContestStarted: () => void;

  // Whitelist
  whitelist: WhitelistEntry[];
  addWhitelistEntry: (email: string, note?: string) => void;
  bulkImportWhitelist: (emails: string[], note?: string) => number;
  toggleWhitelistActive: (id: string) => void;
  removeWhitelistEntry: (id: string) => void;

  // Pending Candidates
  pendingCandidates: User[];
  approveCandidate: (userId: string, note?: string) => void;
  rejectCandidate: (userId: string, reason: string) => void;

  // Teams
  teams: Team[];
  createTeam: (name: string, description: string) => { success: boolean; team?: Team; message: string };
  joinTeamWithCode: (inviteCode: string) => { success: boolean; team?: Team; message: string };
  transferTeamLeader: (teamId: string, newLeaderId: string) => boolean;
  removeTeamMember: (teamId: string, memberId: string) => boolean;
  leaveTeam: (teamId: string) => boolean;
  approveTeamRegistration: (teamId: string) => void;
  rejectTeamRegistration: (teamId: string, reason: string) => void;

  // Topics
  majorTopics: MajorTopic[];
  addMajorTopic: (title: string, description: string) => void;
  deleteMajorTopic: (id: string) => void;
  selectTopicForTeam: (teamId: string, subTopicId: string) => { success: boolean; message: string };
  cancelTopicForTeam: (teamId: string) => { success: boolean; message: string };
  addSubTopic: (majorTopicId: string, subTopic: { title: string; description: string; quota: number; mentorName?: string }) => void;
  updateSubTopicQuota: (subTopicId: string, newQuota: number) => void;

  // Checkpoints & Submissions
  checkpoints: Checkpoint[];
  submissions: CheckpointSubmission[];
  finalSubmissions: FinalSubmission[];
  addCheckpoint: (cp: Omit<Checkpoint, 'id'>, insertIndex?: number) => void;
  updateCheckpoint: (id: string, updates: Partial<Checkpoint>) => void;
  deleteCheckpoint: (id: string) => void;
  reorderCheckpoints: (fromIndex: number, toIndex: number) => void;
  sortCheckpointsByDeadline: () => void;
  submitCheckpoint: (
    checkpointId: string,
    teamId: string,
    dataOrRepoUrl: string | Partial<CheckpointSubmission>,
    demoUrl?: string
  ) => { success: boolean; commitSha: string };
  submitFinalProject: (
    teamId: string,
    repoUrl: string,
    demoVideoUrl: string,
    slideUrl: string,
    summary: string
  ) => { success: boolean; commitSha: string };

  // Rubrics & Evaluations
  rubricCriteria: RubricCriteria[];
  evaluations: TeamEvaluation[];
  addRubricCriterion: (
    name: string,
    description: string,
    maxScore: number,
    weight: number,
    rebalanceMode?: 'none' | 'proportional' | 'equal'
  ) => void;
  rebalanceRubricWeights: (mode: 'equal' | 'proportional') => void;
  updateRubricCriterion: (id: string, updates: Partial<RubricCriteria>) => void;
  deleteRubricCriterion: (id: string) => void;
  saveEvaluation: (teamId: string, judgeId: string, judgeName: string, scores: Record<string, number>, generalComment: string, isDraft: boolean) => void;

  // Support Tickets
  tickets: SupportTicket[];
  createTicket: (
    title: string,
    description: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' | 'medium',
    category?: string,
  ) => { success: boolean; ticket?: SupportTicket };
  claimTicket: (ticketId: string) => void;
  replyTicket: (ticketId: string, content: string) => void;
  resolveTicket: (ticketId: string, responseText?: string) => void;
  closeTicket: (ticketId: string) => void;
  reopenTicket: (ticketId: string) => void;
  cancelTicket: (ticketId: string) => void;

  // Announcements
  announcements: Announcement[];
  addAnnouncement: (title: string, content: string, isPinned?: boolean) => void;
  broadcastAnnouncement: (title: string, content: string, targetRole?: 'all' | 'candidates' | 'mentors') => void;
  deleteAnnouncement: (id: string) => void;
  _legacyDeleteAnnouncement?: (id: string) => void;

  // AI Thực Chiến: Rooms, Zones, Per-Room Checkpoint Schedules & 3-Stage Peer Grading
  rooms: RoomConfig[];
  peerEvaluations: PeerEvaluationBallot[];
  addRoom: (payload: {
    code: string;
    name: string;
    description?: string;
    managerName: string;
    capacity: number;
    startTime: string;
    endTime: string;
    roomTopN: number;
    zoneCount: number;
  }) => void;
  updateRoom: (roomId: string, updates: Partial<RoomConfig>) => void;
  addZoneToRoom: (roomId: string, name: string, maxTeams: number) => void;
  assignTeamToRoomZone: (teamId: string, roomId?: string, zoneId?: string) => void;
  autoDivideRoomZones: (roomId: string) => void;
  upsertRoomCheckpointSchedule: (
    roomId: string,
    checkpointId: string,
    startTime: string,
    deadline: string,
    isActive?: boolean
  ) => void;
  advanceRoomJudgingStage: (
    roomId: string,
    targetStage: JudgingStage,
    roomTopN?: number
  ) => void;
  submitPeerEvaluation: (payload: {
    stage: 'stage_1_zone' | 'stage_2_room' | 'stage_3_cross_room';
    evaluatorTeamId: string;
    targetTeamId: string;
    scores: Record<string, number>;
    comment: string;
  }) => { success: boolean; message: string };

  // Reset
  resetAllMockData: () => void;

  // Onboarding Wizard & Guided Setup
  isWizardOpen: boolean;
  setWizardOpen: (open: boolean) => void;
  wizardStep: number;
  openWizardAtStep: (step: number) => void;
  onboardingCompletedUsers: Record<string, boolean>;
  pledgedUsers: Record<string, boolean>;
  finishUserOnboarding: (userId: string) => void;
  resetUserOnboarding: (userId: string) => void;
  setUserPledge: (userId: string, pledged: boolean) => void;
}

const getInitialTabSession = () => {
  if (typeof window === 'undefined') {
    return {
      currentUser: mockUsers.admin,
      activeRolePersona: 'admin' as const,
      isAuthenticated: false,
    };
  }
  try {
    const sessionPersona = sessionStorage.getItem('hackflow_session_persona');
    const sessionAuth = sessionStorage.getItem('hackflow_session_auth');
    if (sessionPersona && mockUsers[sessionPersona]) {
      return {
        currentUser: mockUsers[sessionPersona],
        activeRolePersona: sessionPersona as MockStoreState['activeRolePersona'],
        isAuthenticated: sessionAuth === 'true',
      };
    }
    const localPersona = localStorage.getItem('hackflow_session_persona');
    const localAuth = localStorage.getItem('hackflow_session_auth');
    if (localPersona && mockUsers[localPersona]) {
      return {
        currentUser: mockUsers[localPersona],
        activeRolePersona: localPersona as MockStoreState['activeRolePersona'],
        isAuthenticated: localAuth === 'true',
      };
    }
  } catch {
    // ignore
  }
  return {
    currentUser: mockUsers.admin,
    activeRolePersona: 'admin' as const,
    isAuthenticated: false,
  };
};

const initialSession = getInitialTabSession();

export const useMockStore = create<MockStoreState>()(
  persist(
    (set, get) => ({
      currentUser: initialSession.currentUser,
      activeRolePersona: initialSession.activeRolePersona,
      isAuthenticated: initialSession.isAuthenticated,

      switchPersona: (persona) => {
        const targetUser = mockUsers[persona] || mockUsers.admin;
        const isDone = !!get().onboardingCompletedUsers[targetUser.id];
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('hackflow_session_persona', persona);
          sessionStorage.setItem('hackflow_session_auth', 'true');
          localStorage.setItem('hackflow_session_persona', persona);
          localStorage.setItem('hackflow_session_auth', 'true');
        }
        set({
          currentUser: targetUser,
          activeRolePersona: persona,
          isAuthenticated: true,
          isWizardOpen: !isDone,
          wizardStep: 1,
        });
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('hackflow_session_persona');
          sessionStorage.removeItem('hackflow_session_auth');
          localStorage.removeItem('hackflow_session_persona');
          localStorage.removeItem('hackflow_session_auth');
        }
        set({
          isAuthenticated: false,
          isWizardOpen: false,
        });
      },

      updateCurrentUserProfile: (profile) => {
        set((state) => ({
          currentUser: { ...state.currentUser, ...profile },
        }));
      },

      // Onboarding Wizard & Guided Setup
      isWizardOpen: false,
      setWizardOpen: (open) => set({ isWizardOpen: open }),
      wizardStep: 1,
      openWizardAtStep: (step) => set({ isWizardOpen: true, wizardStep: step }),
      onboardingCompletedUsers: {},
      pledgedUsers: {},
      finishUserOnboarding: (userId) =>
        set((state) => ({
          onboardingCompletedUsers: { ...state.onboardingCompletedUsers, [userId]: true },
          isWizardOpen: false,
        })),
      resetUserOnboarding: (userId) =>
        set((state) => ({
          onboardingCompletedUsers: { ...state.onboardingCompletedUsers, [userId]: false },
          pledgedUsers: { ...state.pledgedUsers, [userId]: false },
          isWizardOpen: true,
          wizardStep: 1,
        })),
      setUserPledge: (userId, pledged) =>
        set((state) => ({
          pledgedUsers: { ...state.pledgedUsers, [userId]: pledged },
        })),

      // Config
      config: initialHackathonConfig,
      updateConfig: (newConfig) => {
        set((state) => ({
          config: { ...state.config, ...newConfig },
        }));
      },
      toggleBlindJudging: () => {
        set((state) => {
          const next = !state.config.blindJudgingMode;
          return {
            config: { ...state.config, blindJudging: next, blindJudgingMode: next },
          };
        });
      },
      toggleResultsPublished: () => {
        set((state) => ({
          config: { ...state.config, resultsPublished: !state.config.resultsPublished },
        }));
      },
      toggleContestStarted: () => {
        set((state) => {
          const nextStarted = !state.config.isContestStarted;
          const now = Date.now();
          const updatedCheckpoints = nextStarted
            ? state.checkpoints.map((cp) => {
                const duration = cp.durationMinutes || 180;
                return {
                  ...cp,
                  deadline: new Date(now + duration * 60 * 1000).toISOString(),
                  status: 'open' as const,
                };
              })
            : state.checkpoints;

          return {
            config: {
              ...state.config,
              isContestStarted: nextStarted,
              contestStartedAt: nextStarted ? new Date(now).toISOString() : undefined,
              currentPhase: nextStarted
                ? 'Giai đoạn 2: Lập trình tập trung & Chạy nước rút'
                : 'Giai đoạn 1: Mở đăng ký & Thành lập Đội thi',
            },
            checkpoints: updatedCheckpoints,
          };
        });
      },

      // Whitelist
      whitelist: initialWhitelist,
      addWhitelistEntry: (email, note = 'Thêm thủ công từ Admin') => {
        const cleaned = email.trim().toLowerCase();
        if (!cleaned) return;
        const exists = get().whitelist.some((w) => w.email.toLowerCase() === cleaned);
        if (exists) return;

        const newEntry: WhitelistEntry = {
          id: `wl-${Date.now()}`,
          email: cleaned,
          note,
          isActive: true,
          addedAt: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString().split('T')[0],
        };

        set((state) => ({ whitelist: [newEntry, ...state.whitelist] }));
      },

      bulkImportWhitelist: (emails, note = 'Import danh sách hàng loạt') => {
        const currentList = get().whitelist;
        const currentEmails = new Set(currentList.map((w) => w.email.toLowerCase()));

        const validEntries: WhitelistEntry[] = [];
        const dateStr = new Date().toISOString().split('T')[0];

        emails.forEach((raw) => {
          const email = raw.trim().toLowerCase();
          if (email && email.includes('@') && !currentEmails.has(email)) {
            currentEmails.add(email);
            validEntries.push({
              id: `wl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              email,
              note,
              isActive: true,
              addedAt: dateStr,
              createdAt: dateStr,
            });
          }
        });

        if (validEntries.length > 0) {
          set((state) => ({ whitelist: [...validEntries, ...state.whitelist] }));
        }

        return validEntries.length;
      },

      toggleWhitelistActive: (id) => {
        set((state) => ({
          whitelist: state.whitelist.map((w) => (w.id === id ? { ...w, isActive: !w.isActive } : w)),
        }));
      },

      removeWhitelistEntry: (id) => {
        set((state) => ({
          whitelist: state.whitelist.filter((w) => w.id !== id),
        }));
      },

      // Candidates
      pendingCandidates: initialPendingCandidates,
      approveCandidate: (userId, note = 'Hồ sơ hợp lệ') => {
        const candidate = get().pendingCandidates.find((c) => c.id === userId);
        if (candidate) {
          // Add to whitelist automatically
          get().addWhitelistEntry(candidate.email, `Đã phê duyệt tài khoản (${note})`);
        }
        set((state) => ({
          pendingCandidates: state.pendingCandidates.filter((c) => c.id !== userId),
        }));
      },

      rejectCandidate: (userId) => {
        set((state) => ({
          pendingCandidates: state.pendingCandidates.filter((c) => c.id !== userId),
        }));
      },

      // Teams
      teams: initialTeams,
      createTeam: (name, description) => {
        const user = get().currentUser;
        if (!name.trim()) {
          return { success: false, message: 'Tên đội thi không được để trống.' };
        }
        // Check if name is taken
        const isTaken = get().teams.some((t) => t.name.toLowerCase() === name.trim().toLowerCase());
        if (isTaken) {
          return { success: false, message: 'Tên đội đã tồn tại trong cuộc thi.' };
        }

        // Generate 6-char unique invite code
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let inviteCode = '';
        for (let i = 0; i < 6; i++) {
          inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const newTeam: Team = {
          id: `team-${Date.now()}`,
          name: name.trim(),
          description: description.trim() || 'Dự án AI thế hệ mới.',
          inviteCode,
          leaderId: user.id,
          topicId: null,
          status: 'INCOMPLETE',
          memberCount: 1,
          createdAt: new Date().toISOString().split('T')[0],
          members: [
            {
              id: user.id,
              userId: user.id,
              fullName: user.fullName,
              email: user.email,
              role: 'leader',
              roleInTeam: 'leader',
              studentId: user.studentId,
              school: user.school,
              skills: user.skills,
              joinedAt: new Date().toISOString().split('T')[0],
            },
          ],
        };

        set((state) => ({
          teams: [...state.teams, newTeam],
          currentUser: {
            ...state.currentUser,
            teamId: newTeam.id,
            roleInTeam: 'leader',
          },
        }));

        return { success: true, team: newTeam, message: 'Tạo đội thành công!' };
      },

      joinTeamWithCode: (inviteCode) => {
        const code = inviteCode.trim().toUpperCase();
        const team = get().teams.find((t) => t.inviteCode.toUpperCase() === code);

        if (!team) {
          return { success: false, message: 'Mã mời 6 ký tự không chính xác hoặc đội không tồn tại.' };
        }

        if (team.members.length >= 5) {
          return { success: false, message: 'Đội thi đã đạt số lượng tối đa 5 thành viên (Quy định BA-01).' };
        }

        const user = get().currentUser;
        if (team.members.some((m) => m.userId === user.id)) {
          return { success: false, message: 'Bạn đã là thành viên của đội này.' };
        }

        const updatedMembers = [
          ...team.members,
          {
            id: user.id,
            userId: user.id,
            fullName: user.fullName,
            email: user.email,
            role: 'member' as const,
            roleInTeam: 'member' as const,
            studentId: user.studentId,
            school: user.school,
            skills: user.skills,
            joinedAt: new Date().toISOString().split('T')[0],
          },
        ];

        const updatedTeam: Team = {
          ...team,
          members: updatedMembers,
          memberCount: updatedMembers.length,
          status: updatedMembers.length >= 3 ? 'VALID' : 'INCOMPLETE',
        };

        set((state) => ({
          teams: state.teams.map((t) => (t.id === team.id ? updatedTeam : t)),
          currentUser: {
            ...state.currentUser,
            teamId: team.id,
            roleInTeam: 'member',
          },
        }));

        return { success: true, team: updatedTeam, message: `Gia nhập đội ${team.name} thành công!` };
      },

      transferTeamLeader: (teamId, newLeaderId) => {
        const team = get().teams.find((t) => t.id === teamId);
        if (!team) return false;

        const updatedMembers = team.members.map((m) => {
          if (m.userId === newLeaderId) {
            return { ...m, roleInTeam: 'leader' as const };
          }
          if (m.roleInTeam === 'leader') {
            return { ...m, roleInTeam: 'member' as const };
          }
          return m;
        });

        set((state) => ({
          teams: state.teams.map((t) =>
            t.id === teamId ? { ...t, leaderId: newLeaderId, members: updatedMembers } : t
          ),
          currentUser:
            state.currentUser.id === newLeaderId
              ? { ...state.currentUser, roleInTeam: 'leader' }
              : state.currentUser.teamId === teamId && state.currentUser.roleInTeam === 'leader'
              ? { ...state.currentUser, roleInTeam: 'member' }
              : state.currentUser,
        }));

        return true;
      },

      removeTeamMember: (teamId, memberId) => {
        const team = get().teams.find((t) => t.id === teamId);
        if (!team) return false;

        const updatedMembers = team.members.filter((m) => m.userId !== memberId);
        set((state) => ({
          teams: state.teams.map((t) =>
            t.id === teamId
              ? {
                  ...t,
                  members: updatedMembers,
                  memberCount: updatedMembers.length,
                  status: updatedMembers.length >= 3 ? 'VALID' : 'INCOMPLETE',
                }
              : t
          ),
        }));
        return true;
      },

      leaveTeam: (teamId) => {
        const user = get().currentUser;
        const team = get().teams.find((t) => t.id === teamId);
        if (!team) return false;

        const updatedMembers = team.members.filter((m) => m.userId !== user.id);
        set((state) => ({
          teams: state.teams.map((t) =>
            t.id === teamId
              ? {
                  ...t,
                  members: updatedMembers,
                  memberCount: updatedMembers.length,
                  status: updatedMembers.length >= 3 ? 'VALID' : 'INCOMPLETE',
                }
              : t
          ),
          currentUser: {
            ...state.currentUser,
            teamId: undefined,
            roleInTeam: undefined,
          },
        }));
        return true;
      },

      approveTeamRegistration: (teamId) => {
        set((state) => ({
          teams: state.teams.map((t) => (t.id === teamId ? { ...t, status: 'APPROVED' } : t)),
        }));
      },

      rejectTeamRegistration: (teamId, reason) => {
        set((state) => ({
          teams: state.teams.map((t) =>
            t.id === teamId ? { ...t, status: 'REJECTED', rejectionReason: reason } : t
          ),
        }));
      },

      // Topics Selection with Atomic Quota Tracking
      majorTopics: initialMajorTopics,

      addMajorTopic: (title, description) => {
        const newMajor: MajorTopic = {
          id: `major-${Date.now()}`,
          title,
          domain: title,
          description,
          mentorIds: [],
          subTopics: [],
        };
        set((state) => ({ majorTopics: [...state.majorTopics, newMajor] }));
      },

      deleteMajorTopic: (id) => {
        set((state) => ({
          majorTopics: state.majorTopics.filter((m) => m.id !== id),
        }));
      },

      selectTopicForTeam: (teamId, subTopicId) => {
        const team = get().teams.find((t) => t.id === teamId);
        if (!team) return { success: false, message: 'Đội thi không tồn tại.' };

        // Find the subtopic
        let targetSubTopic: MockStoreState['majorTopics'][number]['subTopics'][number] | null = null;
        for (const major of get().majorTopics) {
          const sub = major.subTopics.find((s) => s.id === subTopicId);
          if (sub) {
            targetSubTopic = sub;
            break;
          }
        }

        if (!targetSubTopic) return { success: false, message: 'Đề tài không tồn tại.' };

        const targetCurTeams = targetSubTopic.currentTeams ?? targetSubTopic.registeredTeamsCount ?? 0;
        const targetMaxQuota = targetSubTopic.maxTeamsQuota ?? targetSubTopic.quota ?? 3;

        if (targetCurTeams >= targetMaxQuota) {
          return {
            success: false,
            message: `Đề tài "${targetSubTopic.title}" đã đạt giới hạn tối đa ${targetMaxQuota} đội. Vui lòng chọn đề tài khác.`,
          };
        }

        // If team already has an old topic, release old quota
        const oldTopicId = team.topicId;

        const updatedMajors = get().majorTopics.map((major) => ({
          ...major,
          subTopics: major.subTopics.map((sub) => {
            const curTeams = sub.currentTeams ?? sub.registeredTeamsCount ?? 0;
            const maxQuota = sub.maxTeamsQuota ?? sub.quota ?? 3;

            if (sub.id === oldTopicId && oldTopicId !== subTopicId) {
              const newCount = Math.max(0, curTeams - 1);
              return {
                ...sub,
                currentTeams: newCount,
                registeredTeamsCount: newCount,
                status: (newCount < maxQuota ? 'OPEN' : 'CLOSED') as 'OPEN' | 'CLOSED',
              };
            }
            if (sub.id === subTopicId) {
              const newCount = curTeams + 1;
              return {
                ...sub,
                currentTeams: newCount,
                registeredTeamsCount: newCount,
                status: (newCount >= maxQuota ? 'CLOSED' : 'OPEN') as 'OPEN' | 'CLOSED',
              };
            }
            return sub;
          }),
        }));

        set((state) => ({
          majorTopics: updatedMajors,
          teams: state.teams.map((t) => (t.id === teamId ? { ...t, topicId: subTopicId } : t)),
        }));

        return { success: true, message: `Chọn đề tài "${targetSubTopic.title}" thành công!` };
      },

      cancelTopicForTeam: (teamId) => {
        const team = get().teams.find((t) => t.id === teamId);
        if (!team || !team.topicId) return { success: false, message: 'Đội chưa đăng ký đề tài nào.' };

        const oldTopicId = team.topicId;
        const updatedMajors = get().majorTopics.map((major) => ({
          ...major,
          subTopics: major.subTopics.map((sub) => {
            if (sub.id === oldTopicId) {
              const curTeams = sub.currentTeams ?? sub.registeredTeamsCount ?? 0;
              const newCount = Math.max(0, curTeams - 1);
              return {
                ...sub,
                currentTeams: newCount,
                registeredTeamsCount: newCount,
                status: 'OPEN' as const,
              };
            }
            return sub;
          }),
        }));

        set((state) => ({
          majorTopics: updatedMajors,
          teams: state.teams.map((t) => (t.id === teamId ? { ...t, topicId: null } : t)),
        }));

        return { success: true, message: 'Đã hủy đề tài thành công. Quota đã được giải phóng.' };
      },

      addSubTopic: (majorTopicId, newSub) => {
        const id = `sub-${Date.now()}`;
        set((state) => ({
          majorTopics: state.majorTopics.map((m) =>
            m.id === majorTopicId
              ? {
                  ...m,
                  subTopics: [
                    ...m.subTopics,
                    {
                      id,
                      majorTopicId,
                      title: newSub.title,
                      description: newSub.description,
                      maxTeamsQuota: newSub.quota,
                      currentTeams: 0,
                      quota: newSub.quota,
                      registeredTeamsCount: 0,
                      mentorName: newSub.mentorName || 'TS. Ban Cố Vấn',
                      status: 'OPEN',
                    },
                  ],
                }
              : m
          ),
        }));
      },

      updateSubTopicQuota: (subTopicId, newQuota) => {
        set((state) => ({
          majorTopics: state.majorTopics.map((m) => ({
            ...m,
            subTopics: m.subTopics.map((s) => {
              if (s.id === subTopicId) {
                const cur = s.currentTeams ?? s.registeredTeamsCount ?? 0;
                return {
                  ...s,
                  maxTeamsQuota: newQuota,
                  quota: newQuota,
                  status: (cur >= newQuota ? 'CLOSED' : 'OPEN') as 'OPEN' | 'CLOSED',
                };
              }
              return s;
            }),
          })),
        }));
      },

      // Checkpoints
      checkpoints: initialCheckpoints,
      submissions: initialSubmissions,
      finalSubmissions: initialFinalSubmissions,

      addCheckpoint: (cp) => {
        const duration = cp.durationMinutes || 180;
        const startedAt = get().config.contestStartedAt;
        const baseTime = startedAt ? new Date(startedAt).getTime() : Date.now();
        const calculatedDeadline = cp.deadline || new Date(baseTime + duration * 60 * 1000).toISOString();

        const newCp: Checkpoint = {
          ...cp,
          durationMinutes: duration,
          deadline: calculatedDeadline,
          id: `cp-${Date.now()}`,
        };
        set((state) => ({ checkpoints: [...state.checkpoints, newCp] }));
      },

      reorderCheckpoints: (fromIndex, toIndex) => {
        set((state) => {
          if (
            fromIndex < 0 ||
            fromIndex >= state.checkpoints.length ||
            toIndex < 0 ||
            toIndex >= state.checkpoints.length
          ) {
            return state;
          }
          const updated = [...state.checkpoints];
          const [moved] = updated.splice(fromIndex, 1);
          updated.splice(toIndex, 0, moved);
          return { checkpoints: updated };
        });
      },

      sortCheckpointsByDeadline: () => {
        set((state) => ({
          checkpoints: [...state.checkpoints].sort(
            (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
          ),
        }));
      },

      updateCheckpoint: (id, updates) => {
        set((state) => ({
          checkpoints: state.checkpoints.map((c) => {
            if (c.id !== id) return c;
            const newDuration =
              updates.durationMinutes !== undefined ? updates.durationMinutes : c.durationMinutes || 180;
            const startedAt = state.config.contestStartedAt;
            const baseTime = startedAt ? new Date(startedAt).getTime() : Date.now();
            const calculatedDeadline =
              updates.deadline ||
              (updates.durationMinutes !== undefined
                ? new Date(baseTime + newDuration * 60 * 1000).toISOString()
                : c.deadline);

            return {
              ...c,
              ...updates,
              durationMinutes: newDuration,
              deadline: calculatedDeadline,
            };
          }),
        }));
      },

      deleteCheckpoint: (id) => {
        set((state) => ({
          checkpoints: state.checkpoints.filter((c) => c.id !== id),
        }));
      },

      submitCheckpoint: (checkpointId, teamId, dataOrRepoUrl, demoUrl) => {
        const commitSha = Math.random().toString(16).substring(2, 9);
        const dataObj: Partial<CheckpointSubmission> =
          typeof dataOrRepoUrl === 'string'
            ? { repoUrl: dataOrRepoUrl, demoUrl }
            : dataOrRepoUrl;

        const newSubm: CheckpointSubmission = {
          id: `subm-${Date.now()}`,
          checkpointId,
          teamId,
          commitSha,
          submittedAt: new Date().toISOString(),
          isAfterDeadline: false,
          status: 'submitted',
          ...dataObj,
        };

        set((state) => ({
          submissions: [
            ...state.submissions.filter((s) => !(s.checkpointId === checkpointId && s.teamId === teamId)),
            newSubm,
          ],
        }));

        return { success: true, commitSha };
      },

      submitFinalProject: (teamId, repoUrl, demoVideoUrl, slideUrl, summary) => {
        const commitSha = Math.random().toString(16).substring(2, 10);
        const newFinal: FinalSubmission = {
          teamId,
          repoUrl,
          demoVideoUrl,
          slideUrl,
          summary,
          commitSha,
          submittedAt: new Date().toISOString(),
          isLate: false,
          status: 'submitted',
        };

        set((state) => ({
          finalSubmissions: [
            ...state.finalSubmissions.filter((f) => f.teamId !== teamId),
            newFinal,
          ],
        }));

        return { success: true, commitSha };
      },

      // Rubrics & Evaluations
      rubricCriteria: initialRubricCriteria,
      evaluations: initialEvaluations,

      addRubricCriterion: (name, description, maxScore, weight, rebalanceMode = 'none') => {
        const existing = get().rubricCriteria;
        const newCrit: RubricCriteria = {
          id: `crit-${Date.now()}`,
          name,
          description,
          maxScore,
          weight,
          displayOrder: existing.length + 1,
        };

        if (rebalanceMode === 'equal') {
          const all = [...existing, newCrit];
          const n = all.length;
          const base = Math.floor(100 / n);
          const remainder = 100 - base * n;
          const updated = all.map((c, idx) => ({
            ...c,
            weight: idx < remainder ? base + 1 : base,
          }));
          set({ rubricCriteria: updated });
          return;
        }

        if (rebalanceMode === 'proportional' && existing.length > 0) {
          const clampedWeight = Math.min(100, Math.max(1, weight));
          newCrit.weight = clampedWeight;
          const remainingTarget = Math.max(0, 100 - clampedWeight);
          const currentSum = existing.reduce((sum, c) => sum + c.weight, 0);

          let updatedExisting: RubricCriteria[];
          if (currentSum === 0 || remainingTarget === 0) {
            updatedExisting = existing.map((c) => ({ ...c, weight: 0 }));
          } else {
            const rawWeights = existing.map((c) => (c.weight / currentSum) * remainingTarget);
            const floored = rawWeights.map((w) => Math.floor(w));
            const allocated = floored.reduce((a, b) => a + b, 0);
            const remainder = remainingTarget - allocated;

            const fractions = rawWeights.map((w, idx) => ({
              idx,
              fraction: w - floored[idx],
            }));
            fractions.sort((a, b) => b.fraction - a.fraction);

            const finalWeights = [...floored];
            for (let i = 0; i < remainder; i++) {
              finalWeights[fractions[i].idx] += 1;
            }

            updatedExisting = existing.map((c, idx) => ({
              ...c,
              weight: Math.max(1, finalWeights[idx]),
            }));
          }

          set({ rubricCriteria: [...updatedExisting, newCrit] });
          return;
        }

        // Default 'none': append directly
        set((state) => ({ rubricCriteria: [...state.rubricCriteria, newCrit] }));
      },

      rebalanceRubricWeights: (mode: 'equal' | 'proportional') => {
        const criteria = get().rubricCriteria;
        const n = criteria.length;
        if (n === 0) return;

        if (mode === 'equal') {
          const base = Math.floor(100 / n);
          const remainder = 100 - base * n;
          const updated = criteria.map((c, idx) => ({
            ...c,
            weight: idx < remainder ? base + 1 : base,
          }));
          set({ rubricCriteria: updated });
          return;
        }

        // Proportional normalization to exactly 100%
        const currentSum = criteria.reduce((sum, c) => sum + c.weight, 0);
        if (currentSum === 0) {
          get().rebalanceRubricWeights('equal');
          return;
        }

        const rawWeights = criteria.map((c) => (c.weight / currentSum) * 100);
        const floored = rawWeights.map((w) => Math.floor(w));
        const allocated = floored.reduce((a, b) => a + b, 0);
        const remainder = 100 - allocated;

        const fractions = rawWeights.map((w, idx) => ({
          idx,
          fraction: w - floored[idx],
        }));
        fractions.sort((a, b) => b.fraction - a.fraction);

        const finalWeights = [...floored];
        for (let i = 0; i < remainder; i++) {
          finalWeights[fractions[i].idx] += 1;
        }

        const updated = criteria.map((c, idx) => ({
          ...c,
          weight: Math.max(1, finalWeights[idx]),
        }));
        set({ rubricCriteria: updated });
      },

      updateRubricCriterion: (id, updates) => {
        set((state) => ({
          rubricCriteria: state.rubricCriteria.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        }));
      },

      deleteRubricCriterion: (id) => {
        set((state) => ({
          rubricCriteria: state.rubricCriteria.filter((c) => c.id !== id),
        }));
      },

      saveEvaluation: (teamId, judgeId, judgeName, scoresMap, generalComment, isDraft) => {
        const criteria = get().rubricCriteria;
        const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0) || 100;
        let weightedSum = 0;

        const details = criteria.map((c) => {
          const rawScore = scoresMap[c.id] !== undefined ? scoresMap[c.id] : 0;
          const max = c.maxScore > 0 ? c.maxScore : 10;
          const clamped = Math.max(0, Math.min(rawScore, max));
          // Normalized weighted contribution: (clamped / max) * weight
          const weightedContrib = (clamped / max) * c.weight;
          weightedSum += weightedContrib;
          return { criteriaId: c.id, score: clamped };
        });

        // Exact 100-point scale: (weightedSum / totalWeight) * 100
        const totalScore = Math.round(((weightedSum / totalWeight) * 100) * 10) / 10;

        const evalRecord: TeamEvaluation = {
          id: `eval-${teamId}`,
          teamId,
          judgeId,
          judgeName,
          totalScore,
          scores: scoresMap,
          generalComment,
          isDraft,
          confirmedAt: isDraft ? undefined : new Date().toISOString(),
          details,
        };

        set((state) => ({
          evaluations: [
            ...state.evaluations.filter((e) => !(e.teamId === teamId && e.judgeId === judgeId)),
            evalRecord,
          ],
        }));
      },

      // Tickets
      tickets: initialSupportTickets,
      createTicket: (title, description, priority, category) => {
        const user = get().currentUser;
        const team = get().teams.find((t) => t.id === user.teamId) || get().teams[0];
        const nextNum = get().tickets.length + 1;
        const ticketCode = `TK-${String(nextNum).padStart(2, '0')}`;

        const newTicket: SupportTicket = {
          id: `tk-${Date.now()}`,
          ticketCode,
          teamId: team.id,
          teamName: team.name,
          creatorId: user.id,
          creatorName: user.fullName,
          senderId: user.id,
          senderName: user.fullName,
          title,
          description,
          content: description,
          category: category || 'technical',
          priority: priority || 'normal',
          status: 'open',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          replies: [],
          messages: [
            {
              id: `msg-${Date.now()}`,
              senderId: user.id,
              senderName: user.fullName,
              senderRole: user.role,
              content: description,
              sentAt: new Date().toISOString(),
            },
          ],
        };

        set((state) => ({ tickets: [newTicket, ...state.tickets] }));
        return { success: true, ticket: newTicket };
      },

      claimTicket: (ticketId) => {
        const mentor = get().currentUser;
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.id === ticketId
              ? {
                  ...t,
                  status: 'in_progress',
                  mentorId: mentor.id,
                  mentorName: mentor.fullName,
                  assignedMentorId: mentor.id,
                  assignedMentorName: mentor.fullName,
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        }));
      },

      replyTicket: (ticketId, content) => {
        const user = get().currentUser;
        const newMsg = {
          id: `msg-${Date.now()}`,
          senderId: user.id,
          senderName: user.fullName,
          senderRole: user.role,
          content,
          sentAt: new Date().toISOString(),
        };
        const newReply = {
          id: `rep-${Date.now()}`,
          authorName: user.fullName,
          authorRole: user.role,
          content,
          createdAt: new Date().toLocaleTimeString('vi-VN'),
        };

        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.id === ticketId
              ? {
                  ...t,
                  updatedAt: new Date().toISOString(),
                  messages: [...(t.messages || []), newMsg],
                  replies: [...(t.replies || []), newReply],
                }
              : t
          ),
        }));
      },

      resolveTicket: (ticketId, responseText) => {
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.id === ticketId
              ? {
                  ...t,
                  status: 'resolved',
                  response: responseText || t.response || 'Vấn đề đã được hỗ trợ và giải quyết hoàn tất.',
                  resolvedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        }));
      },

      closeTicket: (ticketId) => {
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.id === ticketId
              ? {
                  ...t,
                  status: 'closed',
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        }));
      },

      reopenTicket: (ticketId) => {
        set((state) => ({
          tickets: state.tickets.map((t) =>
            t.id === ticketId
              ? {
                  ...t,
                  status: 'in_progress',
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        }));
      },

      cancelTicket: (ticketId) => {
        set((state) => ({
          tickets: state.tickets.filter((t) => t.id !== ticketId),
        }));
      },

      // Announcements
      announcements: initialAnnouncements,
      addAnnouncement: (title, content, isPinned = false) => {
        const newAnn: Announcement = {
          id: `ann-${Date.now()}`,
          title,
          content,
          sender: get().currentUser.fullName,
          author: get().currentUser.fullName,
          createdAt: new Date().toLocaleTimeString('vi-VN') + ' - ' + new Date().toLocaleDateString('vi-VN'),
          publishedAt: new Date().toISOString(),
          isPinned,
        };
        set((state) => ({ announcements: [newAnn, ...state.announcements] }));
      },

      broadcastAnnouncement: (title, content, targetRole = 'all') => {
        const newAnn: Announcement = {
          id: `ann-${Date.now()}`,
          title,
          content,
          sender: get().currentUser.fullName,
          author: get().currentUser.fullName,
          targetRole,
          createdAt: new Date().toLocaleTimeString('vi-VN') + ' - ' + new Date().toLocaleDateString('vi-VN'),
          publishedAt: new Date().toISOString(),
          isPinned: false,
        };
        set((state) => ({ announcements: [newAnn, ...state.announcements] }));
      },

      deleteAnnouncement: (id) => {
        set((state) => ({ announcements: state.announcements.filter((a) => a.id !== id) }));
      },

      rooms: initialRooms,
      peerEvaluations: initialPeerEvaluations,

      addRoom: (payload) => {
        const roomId = `room-${Date.now()}`;
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const zones = Array.from({ length: Math.max(1, payload.zoneCount || 2) }).map((_, idx) => {
          const letter = alphabet[idx] || String(idx + 1);
          return {
            id: `${roomId}-zone-${letter.toLowerCase()}`,
            roomId,
            code: `ZONE-${letter}`,
            name: `Zone ${letter}`,
            maxTeams: 5,
          };
        });
        const newRoom: RoomConfig = {
          id: roomId,
          code: payload.code.trim().toUpperCase(),
          name: payload.name.trim(),
          description: payload.description || 'Cùng đề thi & tài nguyên dữ liệu Mentor • Chia Zone chấm chéo',
          managerName: payload.managerName.trim() || 'Quản lý phòng BTC',
          capacity: payload.capacity || 40,
          startTime: payload.startTime,
          endTime: payload.endTime,
          judgingStage: 'stage_1_zone',
          roomTopN: payload.roomTopN || 1,
          isActive: true,
          zones,
          checkpointSchedules: [],
        };
        set((state) => ({ rooms: [...state.rooms, newRoom] }));
      },

      updateRoom: (roomId, updates) => {
        set((state) => ({
          rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r)),
        }));
      },

      addZoneToRoom: (roomId, name, maxTeams) => {
        set((state) => ({
          rooms: state.rooms.map((r) => {
            if (r.id !== roomId) return r;
            const nextIdx = r.zones.length + 1;
            const newZone = {
              id: `${roomId}-z-${Date.now()}`,
              roomId,
              code: `ZONE-${nextIdx}`,
              name: name.trim(),
              maxTeams: maxTeams || 5,
            };
            return { ...r, zones: [...r.zones, newZone] };
          }),
        }));
      },

      assignTeamToRoomZone: (teamId, roomId, zoneId) => {
        set((state) => ({
          teams: state.teams.map((t) =>
            t.id === teamId ? { ...t, roomId, zoneId } : t
          ),
        }));
      },

      autoDivideRoomZones: (roomId) => {
        set((state) => {
          const room = state.rooms.find((r) => r.id === roomId);
          if (!room || room.zones.length === 0) return state;
          const roomTeams = state.teams.filter((t) => t.roomId === roomId);
          const zoneByTeamId: Record<string, string> = {};
          roomTeams.forEach((t, idx) => {
            const z = room.zones[idx % room.zones.length];
            zoneByTeamId[t.id] = z.id;
          });
          return {
            teams: state.teams.map((t) =>
              zoneByTeamId[t.id] ? { ...t, zoneId: zoneByTeamId[t.id] } : t
            ),
          };
        });
      },

      upsertRoomCheckpointSchedule: (roomId, checkpointId, startTime, deadline, isActive = true) => {
        set((state) => ({
          rooms: state.rooms.map((r) => {
            if (r.id !== roomId) return r;
            const existingIdx = r.checkpointSchedules.findIndex(
              (s) => s.checkpointId === checkpointId
            );
            const nextSchedules = [...r.checkpointSchedules];
            if (existingIdx >= 0) {
              nextSchedules[existingIdx] = {
                ...nextSchedules[existingIdx],
                startTime,
                deadline,
                isActive,
              };
            } else {
              nextSchedules.push({
                id: `rcs-${roomId}-${checkpointId}`,
                roomId,
                checkpointId,
                startTime,
                deadline,
                isActive,
              });
            }
            return { ...r, checkpointSchedules: nextSchedules };
          }),
        }));
      },

      advanceRoomJudgingStage: (roomId, targetStage, roomTopN) => {
        set((state) => {
          const room = state.rooms.find((r) => r.id === roomId);
          if (!room) return state;
          const effectiveTopN = roomTopN ?? room.roomTopN ?? 1;
          const evals = state.peerEvaluations;

          const getAvg = (teamId: string, stg: string) => {
            const ballots = evals.filter(
              (b) => b.stage === stg && b.targetTeamId === teamId
            );
            if (ballots.length === 0) return 0;
            return (
              ballots.reduce((acc, b) => acc + b.totalScore, 0) / ballots.length
            );
          };

          let updatedTeams = [...state.teams];

          // Khi chuyển sang Vòng 2 (stage_2_room) -> Chốt Top 1 của mỗi Zone trong phòng
          if (
            targetStage === 'stage_2_room' ||
            targetStage === 'stage_3_cross_room' ||
            targetStage === 'completed'
          ) {
            const zoneWinnerIds = new Set<string>();
            for (const zone of room.zones) {
              const zTeams = updatedTeams.filter(
                (t) => t.roomId === roomId && t.zoneId === zone.id
              );
              if (zTeams.length > 0) {
                const sorted = [...zTeams].sort(
                  (a, b) => getAvg(b.id, 'stage_1_zone') - getAvg(a.id, 'stage_1_zone')
                );
                zoneWinnerIds.add(sorted[0].id);
              }
            }
            updatedTeams = updatedTeams.map((t) =>
              t.roomId === roomId
                ? { ...t, isZoneWinner: zoneWinnerIds.has(t.id) }
                : t
            );
          }

          // Khi chuyển sang Vòng 3 (stage_3_cross_room) hoặc completed -> Chốt Top 1 hoặc Top 3 của Phòng
          if (targetStage === 'stage_3_cross_room' || targetStage === 'completed') {
            const candidates = updatedTeams.filter(
              (t) => t.roomId === roomId && t.isZoneWinner
            );
            const sortedRoom = [...candidates].sort((a, b) => {
              const s2Diff = getAvg(b.id, 'stage_2_room') - getAvg(a.id, 'stage_2_room');
              if (s2Diff !== 0) return s2Diff;
              return getAvg(b.id, 'stage_1_zone') - getAvg(a.id, 'stage_1_zone');
            });
            const roomWinnerIds = new Set(
              sortedRoom.slice(0, effectiveTopN).map((t) => t.id)
            );
            updatedTeams = updatedTeams.map((t) =>
              t.roomId === roomId
                ? { ...t, isRoomWinner: roomWinnerIds.has(t.id) }
                : t
            );
          }

          return {
            teams: updatedTeams,
            rooms: state.rooms.map((r) =>
              r.id === roomId
                ? { ...r, judgingStage: targetStage, roomTopN: effectiveTopN }
                : r
            ),
          };
        });
      },

      submitPeerEvaluation: ({ stage, evaluatorTeamId, targetTeamId, scores, comment }) => {
        const state = get();
        if (evaluatorTeamId === targetTeamId) {
          return {
            success: false,
            message: 'Đội thi không được phép tự chấm điểm cho chính đội của mình.',
          };
        }
        const evaluatorTeam = state.teams.find((t) => t.id === evaluatorTeamId);
        const targetTeam = state.teams.find((t) => t.id === targetTeamId);
        if (!evaluatorTeam || !targetTeam) {
          return {
            success: false,
            message: 'Không tìm thấy thông tin đội chấm hoặc đội được chấm.',
          };
        }
        if (stage === 'stage_1_zone' && evaluatorTeam.zoneId !== targetTeam.zoneId) {
          return {
            success: false,
            message: 'Ở Vòng 1 (Chấm trong Zone), các đội chỉ chấm chéo các đội trong cùng Zone.',
          };
        }
        if (stage === 'stage_2_room') {
          if (evaluatorTeam.roomId !== targetTeam.roomId) {
            return {
              success: false,
              message: 'Ở Vòng 2 (Cấp Phòng), chỉ chấm các đội Top 1 Zone trong cùng Phòng.',
            };
          }
          if (!targetTeam.isZoneWinner) {
            return {
              success: false,
              message: 'Đội này không thuộc danh sách Top 1 Zone thuyết trình cấp Phòng.',
            };
          }
        }
        if (stage === 'stage_3_cross_room' && !targetTeam.isRoomWinner) {
          return {
            success: false,
            message: 'Ở Vòng 3 (Liên Phòng), chỉ chấm các đội Top 1/Top 3 đại diện từ các Phòng.',
          };
        }

        const totalScore = normalizeScoreTo100(undefined, scores, state.rubricCriteria);
        const existingIdx = state.peerEvaluations.findIndex(
          (b) =>
            b.stage === stage &&
            b.evaluatorTeamId === evaluatorTeamId &&
            b.targetTeamId === targetTeamId
        );
        const ballot: PeerEvaluationBallot = {
          id: existingIdx >= 0 ? state.peerEvaluations[existingIdx].id : `pe-${Date.now()}`,
          stage,
          roomId: targetTeam.roomId,
          zoneId: targetTeam.zoneId,
          evaluatorTeamId,
          evaluatorTeamName: evaluatorTeam.name,
          targetTeamId,
          targetTeamName: targetTeam.name,
          scores,
          totalScore,
          comment: comment.trim(),
          submittedAt: new Date().toISOString(),
        };

        const nextEvals = [...state.peerEvaluations];
        if (existingIdx >= 0) {
          nextEvals[existingIdx] = ballot;
        } else {
          nextEvals.unshift(ballot);
        }
        set({ peerEvaluations: nextEvals });
        return {
          success: true,
          message: `Đã gửi phiếu chấm chéo cho đội ${targetTeam.name} (${totalScore}/100 điểm).`,
        };
      },
      _legacyDeleteAnnouncement: (id: string) => {
        set((state) => ({ announcements: state.announcements.filter((a) => a.id !== id) }));
      },

      // Reset
      resetAllMockData: () => {
        set({
          currentUser: mockUsers.admin,
          activeRolePersona: 'admin',
          isAuthenticated: false,
          config: initialHackathonConfig,
          whitelist: initialWhitelist,
          pendingCandidates: initialPendingCandidates,
          majorTopics: initialMajorTopics,
          teams: initialTeams,
          checkpoints: initialCheckpoints,
          submissions: initialSubmissions,
          finalSubmissions: initialFinalSubmissions,
          rubricCriteria: initialRubricCriteria,
          evaluations: initialEvaluations,
          tickets: initialSupportTickets,
          announcements: initialAnnouncements,
          rooms: initialRooms,
          peerEvaluations: initialPeerEvaluations,
          isWizardOpen: false,
          wizardStep: 1,
          onboardingCompletedUsers: {},
          pledgedUsers: {},
        });
      },
    }),
    {
      name: 'hackflow-full-setup-v3', // Full contest setup mock data
      onRehydrateStorage: () => (state) => {
        if (typeof window !== 'undefined' && state) {
          const tabPersona = sessionStorage.getItem('hackflow_session_persona');
          const tabAuth = sessionStorage.getItem('hackflow_session_auth');
          if (tabPersona && mockUsers[tabPersona]) {
            state.activeRolePersona = tabPersona as MockStoreState['activeRolePersona'];
            state.currentUser = mockUsers[tabPersona];
            state.isAuthenticated = tabAuth === 'true';
          }
        }
      },
    }
  )
);
