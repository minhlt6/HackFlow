import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type { Team, LeaderboardItem } from '../../types';
import { HackathonConfigPanel } from './HackathonConfigPanel';
import { JudgeAssignmentPanel } from './JudgeAssignmentPanel';
import { ParticipantApprovalPanel } from './ParticipantApprovalPanel';
import { WhitelistPanel } from './WhitelistPanel';
import { AdminCheckpointPanel } from './AdminCheckpointPanel';
import { AdminTopicsPanel } from './AdminTopicsPanel';
import { AdminMentorsPanel } from './AdminMentorsPanel';
import {
  Users,
  CheckCircle2,
  Download,
  Award,
  ShieldAlert,
  RefreshCw,
  Settings,
  Shield,
  LayoutDashboard,
  Clock,
  ListChecks,
  Flag,
  BookOpen,
  Ticket,
} from 'lucide-react';

type AdminTab =
  | 'dashboard'
  | 'approvals'
  | 'whitelist'
  | 'checkpoints'
  | 'topics'
  | 'mentors'
  | 'judges'
  | 'criteria'
  | 'config';

interface DashboardStats {
  teams: { total: number; approved: number; pending: number };
  participants: number;
  tickets: { open: number; in_progress: number; resolved: number };
  checkpoints: Array<{
    checkpoint_id: string;
    name: string;
    submitted_teams: number;
    unsubmitted_teams: number;
  }>;
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, teamsRes, lbRes] = await Promise.all([
        // FIX P1-3: Gọi đúng /admin/dashboard/stats thay vì chỉ /teams
        apiClient.get('/admin/dashboard/stats').catch(() => ({ data: null })),
        apiClient.get('/teams').catch(() => ({ data: { success: true, data: [] } })),
        apiClient.get('/scoring/leaderboard').catch(() => ({ data: { success: true, data: [] } })),
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (teamsRes.data?.success) setTeams(teamsRes.data.data);
      if (lbRes.data?.success) setLeaderboard(lbRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleUpdateTeamStatus = async (teamId: string, action: 'approve' | 'reject') => {
    try {
      const endpoint = action === 'approve'
        ? `/admin/teams/${teamId}/approve`
        : `/admin/teams/${teamId}/reject`;
      const res = await apiClient.post(endpoint);
      if (res?.data?.success) {
        const label = action === 'approve' ? 'phê duyệt' : 'từ chối';
        setActionMsg(`Đã ${label} đội thành công.`);
        fetchAdminData();
        setTimeout(() => setActionMsg(null), 4000);
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Cập nhật thất bại');
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await apiClient.get('/admin/export/scores.csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `hackflow_scores_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: client-side CSV từ leaderboard
      let csvContent = 'data:text/csv;charset=utf-8,Xep_hang,Ten_doi,So_giam_khao,Diem_trung_binh\n';
      leaderboard.forEach((item, index) => {
        csvContent += `${item.rank || index + 1},"${item.team_name}",${item.judge_count || 0},${item.average_score}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', 'hackflow_scores.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-400"></div>
      </div>
    );
  }

  const TAB_CONFIG: Array<{ id: AdminTab; label: string; icon: React.ElementType }> = [
    { id: 'dashboard',   label: 'Tổng quan',    icon: LayoutDashboard },
    { id: 'approvals',   label: 'Duyệt TK',     icon: Clock },
    { id: 'whitelist',   label: 'Whitelist',     icon: ListChecks },
    { id: 'checkpoints', label: 'Checkpoints',   icon: Flag },
    { id: 'topics',      label: 'Đề tài',        icon: BookOpen },
    { id: 'mentors',     label: 'Mentors',       icon: Users },
    { id: 'judges',      label: 'Phân công GK',  icon: Shield },
    { id: 'criteria',    label: 'Tiêu chí',      icon: Award },
    { id: 'config',      label: 'Cấu hình',      icon: Settings },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-red-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Ban Tổ Chức Hackathon</span>
          </div>
          <h1 className="text-3xl font-black text-white">Bảng Điều Khiển Quản Trị (Admin)</h1>
          <p className="text-sm text-slate-400">
            Giám sát thời gian thực, quản lý hội đồng giám khảo, cấu hình checkpoint và tiêu chí chấm thi.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAdminData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-950/50 transition"
          >
            <Download className="w-4 h-4" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {actionMsg}
        </div>
      )}

      {/* Main Container: Left Sidebar Tabbar + Right Content Area */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Sidebar Tab Navigation */}
        <aside className="w-full lg:w-64 shrink-0 bg-white border border-slate-200 rounded-2xl p-3 lg:sticky lg:top-20 space-y-1 shadow-xs">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 mb-2">
            Danh Mục Quản Trị
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1">
            {TAB_CONFIG.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm transition-none text-left ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent font-medium'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden lg:block pt-4 mt-4 border-t border-slate-100 px-3 text-xs text-slate-500">
            <div className="flex items-center justify-between mb-1">
              <span>Hệ thống:</span>
              <span className="text-emerald-600 font-mono font-bold">Trực tuyến</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Đội thi:</span>
              <span className="text-slate-800 font-mono font-bold">{teams.length}</span>
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 min-w-0 w-full space-y-6">

      {/* ── Tab: Tổng quan ─────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <>
          {/* Stats Cards — từ /admin/dashboard/stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Tổng Đội Thi"
              value={stats?.teams.total ?? teams.length}
              sub={`${stats?.teams.approved ?? 0} đã duyệt · ${stats?.teams.pending ?? 0} chờ`}
              icon={<Users className="w-5 h-5 text-emerald-400" />}
            />
            <StatCard
              label="Thí Sinh"
              value={stats?.participants ?? 0}
              sub="Tất cả đã đăng nhập"
              icon={<CheckCircle2 className="w-5 h-5 text-teal-400" />}
            />
            <StatCard
              label="Tickets Chờ"
              value={stats?.tickets.open ?? 0}
              sub={`${stats?.tickets.in_progress ?? 0} đang xử lý · ${stats?.tickets.resolved ?? 0} xong`}
              icon={<Ticket className="w-5 h-5 text-amber-400" />}
            />
            <StatCard
              label="Đã Chấm Điểm"
              value={leaderboard.length}
              sub="Đội có điểm từ Hội đồng"
              icon={<Award className="w-5 h-5 text-purple-400" />}
            />
          </div>

          {/* Checkpoint Progress */}
          {stats?.checkpoints && stats.checkpoints.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-base font-bold text-white mb-4 flex items-center space-x-2">
                <Flag className="w-4 h-4 text-emerald-400" />
                <span>Tiến Độ Nộp Checkpoint</span>
              </h2>
              <div className="space-y-3">
                {stats.checkpoints.map((cp) => {
                  const total = cp.submitted_teams + cp.unsubmitted_teams;
                  const pct = total > 0 ? Math.round((cp.submitted_teams / total) * 100) : 0;
                  return (
                    <div key={cp.checkpoint_id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300 font-medium">{cp.name}</span>
                        <span className="text-slate-400 font-mono">
                          {cp.submitted_teams}/{total} đội ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct === 100
                              ? 'bg-emerald-500'
                              : pct >= 60
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Teams Management Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Quản Lý & Phê Duyệt Đội Thi</h2>
              <span className="text-xs text-slate-400">{teams.length} đội</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-mono tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Tên Đội</th>
                    <th className="px-6 py-3">Đề Tài</th>
                    <th className="px-6 py-3">Thành Viên</th>
                    <th className="px-6 py-3">Trạng Thái</th>
                    <th className="px-6 py-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {teams.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-500 text-sm">
                        Chưa có đội nào đăng ký.
                      </td>
                    </tr>
                  ) : (
                    teams.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-6 py-4 font-semibold text-white">{t.name}</td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {t.subtopic?.title || (
                            <span className="text-amber-500 italic">Chưa chọn</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono">
                          {t.members?.length || 0} người
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                              t.status === 'approved'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : t.status === 'rejected'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : 'bg-amber-950 text-amber-400 border border-amber-800'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {t.status !== 'approved' && t.status !== 'disqualified' && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Xác nhận PHÊ DUYỆT đội "${t.name}"?`)) {
                                  handleUpdateTeamStatus(t.id, 'approve');
                                }
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-semibold border border-emerald-500/30"
                            >
                              Phê duyệt
                            </button>
                          )}
                          {t.status !== 'rejected' && t.status !== 'disqualified' && (
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Xác nhận TỪ CHỐI đội "${t.name}"?\nHành động này sẽ loại đội khỏi cuộc thi.`
                                  )
                                ) {
                                  handleUpdateTeamStatus(t.id, 'reject');
                                }
                              }}
                              className="px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 text-xs font-semibold border border-rose-500/30"
                            >
                              Từ chối
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Tab: Duyệt TK ─────────────────────────────── */}
      {activeTab === 'approvals' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <ParticipantApprovalPanel />
        </div>
      )}

      {/* ── Tab: Whitelist ────────────────────────────── */}
      {activeTab === 'whitelist' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <WhitelistPanel />
        </div>
      )}

      {/* ── Tab: Checkpoints ─────────────────────────── */}
      {activeTab === 'checkpoints' && <AdminCheckpointPanel />}

      {/* ── Tab: Đề tài ──────────────────────────────── */}
      {activeTab === 'topics' && <AdminTopicsPanel />}

      {/* ── Tab: Mentors ─────────────────────────────── */}
      {activeTab === 'mentors' && <AdminMentorsPanel />}

      {/* ── Tab: Phân công GK ────────────────────────── */}
      {activeTab === 'judges' && <JudgeAssignmentPanel />}

      {/* ── Tab: Tiêu chí ────────────────────────────── */}
      {activeTab === 'criteria' && <HackathonConfigPanel criteriaOnly />}

      {/* ── Tab: Cấu hình ────────────────────────────── */}
      {activeTab === 'config' && <HackathonConfigPanel />}
        </main>
      </div>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────────────
 * StatCard helper
 * ──────────────────────────────────────────────────────────────────────────── */
const StatCard: React.FC<{
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
}> = ({ label, value, sub, icon }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      {icon}
    </div>
    <div className="text-3xl font-black text-white mt-2 font-mono">{value}</div>
    <span className="text-xs text-slate-500 mt-1 block">{sub}</span>
  </div>
);
