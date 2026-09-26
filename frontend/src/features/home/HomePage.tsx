import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../api/client';
import type { Team, HackathonConfig, Checkpoint, CheckpointSubmission } from '../../types';
import {
  Clock,
  Users,
  BookOpen,
  Flag,
  LifeBuoy,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Bell,
  ChevronDown,
  GitCommit,
  Check,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const [config, setConfig] = useState<HackathonConfig | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, CheckpointSubmission>>({});

  // Table filter states
  const [hideClosed, setHideClosed] = useState(false);
  const [pageSize, setPageSize] = useState(5);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useEffect(() => {
    const loadContestData = async () => {
      try {
        const [configRes, teamRes, cpRes] = await Promise.allSettled([
          apiClient.get('/admin/config'),
          isAuthenticated ? apiClient.get('/teams/my-team').catch(() => null) : Promise.resolve(null),
          apiClient.get('/checkpoints').catch(() => null),
        ]);

        if (configRes.status === 'fulfilled' && configRes.value?.data?.success) {
          setConfig(configRes.value.data.data);
        }

        if (
          teamRes.status === 'fulfilled' &&
          teamRes.value &&
          'data' in teamRes.value &&
          teamRes.value.data?.success &&
          teamRes.value.data?.data
        ) {
          setMyTeam(teamRes.value.data.data);
        } else {
          setMyTeam(null);
        }

        if (
          cpRes.status === 'fulfilled' &&
          cpRes.value &&
          'data' in cpRes.value &&
          cpRes.value.data?.success &&
          Array.isArray(cpRes.value.data?.data)
        ) {
          const cpData: Checkpoint[] = cpRes.value.data.data;
          setCheckpoints(cpData);
          const subs: Record<string, CheckpointSubmission> = {};
          cpData.forEach((cp) => {
            if ((cp as any).latest_submission) {
              subs[cp.id] = (cp as any).latest_submission;
            }
          });
          setSubmissions(subs);
        }
      } catch (err) {
        console.error('Failed to load contest info', err);
      }
    };

    loadContestData();
  }, [isAuthenticated]);

  const getCheckpointStatus = (cp: Checkpoint): 'upcoming' | 'open' | 'closed' => {
    if (cp.status) return cp.status;
    const now = Date.now();
    const openTime = new Date(cp.open_at).getTime();
    const closeTime = new Date(cp.close_at).getTime();
    if (now < openTime) return 'upcoming';
    if (now > closeTime) return 'closed';
    return 'open';
  };

  const getTodayString = () => {
    const now = new Date();
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dayName = days[now.getDay()];
    const dateStr = now.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `Hôm nay · ${dayName} · ${dateStr}`;
  };

  const contactChannels = config?.contact_channels || {};
  const isLeader =
    myTeam?.leader_id === user?.id ||
    myTeam?.members?.find((m) => (m.role === 'leader' || m.role_in_team === 'leader'))?.user_id === user?.id;

  const submittedCount = Object.keys(submissions).length;

  const filteredCheckpoints = checkpoints
    .filter((cp) => {
      if (hideClosed && getCheckpointStatus(cp) === 'closed') return false;
      return true;
    })
    .slice(0, pageSize);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* ── 1. Page Header (VinUni AI Thực Chiến) ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>VinUni AI Thực Chiến</span>
              <span className="text-blue-700 text-lg font-bold bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                Mini Hackathon
              </span>
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {getTodayString()}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            Chào mừng{' '}
            <strong className="text-blue-800 font-bold">
              {user?.full_name || (isAuthenticated ? 'Học viên' : 'Khách tham quan')}
            </strong>
            . Chương trình Đào tạo Nhân tài AI Thực chiến (Vingroup x Đại học VinUni) — 12 tuần thực học, giải quyết bài toán thật với dữ liệu thật.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <Link
            to="/checkpoints"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition shadow-xs"
          >
            <Bell className="w-4 h-4 text-amber-500" />
            <span>Thông báo mốc thi</span>
          </Link>
        </div>
      </div>

      {/* ── 2. Three Metric Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Team Status (VinUni Navy Border) */}
        <div className="p-5 rounded-2xl bg-white border-2 border-blue-600 shadow-sm flex items-center justify-between transition hover:shadow-md">
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Nhóm thi thực chiến
            </div>
            <div className="text-2xl font-black text-slate-900 truncate max-w-[200px]">
              {myTeam ? myTeam.name : 'Chưa có nhóm'}
            </div>
            <div className="text-xs text-blue-700 font-medium flex items-center space-x-1.5 pt-0.5">
              <span>{myTeam ? `${myTeam.members?.length || 1} thành viên` : 'Cần lập hoặc vào đội'}</span>
              {myTeam && <span className="text-slate-400">• {isLeader ? 'Trưởng nhóm' : 'Thành viên'}</span>}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Topic Status */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md">
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Đề tài AI Vingroup
            </div>
            <div className="text-2xl font-black text-slate-900 truncate max-w-[200px]">
              {myTeam?.subtopic ? myTeam.subtopic.title : 'Chưa chọn'}
            </div>
            <div className="text-xs text-amber-600 font-medium flex items-center space-x-1.5 pt-0.5">
              <span>{myTeam?.subtopic ? 'Đã khóa slot đề tài' : 'Chưa đăng ký đề tài'}</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Checkpoints Submitted */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md">
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Tiến độ Checkpoints
            </div>
            <div className="text-2xl font-black text-emerald-600 font-mono">
              {submittedCount}{' '}
              <span className="text-sm font-normal text-slate-500">/ {checkpoints.length} mốc</span>
            </div>
            <div className="text-xs text-emerald-600 font-medium flex items-center space-x-1.5 pt-0.5">
              <span>{submittedCount > 0 ? 'Duy trì tiến độ tốt' : 'Chưa nộp mốc nào'}</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── 3. Unteamed Notice Banner (if user has no team) ────────────────── */}
      {isAuthenticated && user?.role === 'participant' && !myTeam && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-800 shadow-2xs">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-900">
                Bạn chưa tham gia đội thi nào
              </div>
              <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Học viên <strong>có thể xem toàn bộ</strong> lịch trình mốc checkpoints và danh mục đề tài AI bên dưới. Để nộp bài và khóa slot đề tài, bạn cần lập hoặc tham gia một đội thi.
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <Link
              to="/team"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs transition shadow-sm"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Tạo / Tham gia đội</span>
            </Link>
          </div>
        </div>
      )}

      {/* ── 4. Filter Row ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <label className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer select-none font-medium">
          <input
            type="checkbox"
            checked={hideClosed}
            onChange={(e) => setHideClosed(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 bg-white border-slate-300 focus:ring-blue-500"
          />
          <span>Ẩn mốc đã kết thúc</span>
        </label>

        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <span>Hiển thị</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-white border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500 shadow-2xs"
          >
            <option value={3}>3 mốc / trang</option>
            <option value={5}>5 mốc / trang</option>
            <option value={10}>10 mốc / trang</option>
          </select>
        </div>
      </div>

      {/* ── 5. Main Table (Light Theme) ────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-5 w-48">Thời gian</th>
                <th className="py-3.5 px-5 w-24">Buổi</th>
                <th className="py-3.5 px-5">Mốc trong cuộc thi &amp; Yêu cầu tiến độ</th>
                <th className="py-3.5 px-5 w-36 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCheckpoints.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <Flag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">Chưa có mốc kiểm soát nào phù hợp</p>
                    <p className="text-xs text-slate-400 mt-0.5">Ban Tổ Chức VinUni đang thiết lập lịch trình thi đấu.</p>
                  </td>
                </tr>
              ) : (
                filteredCheckpoints.map((cp, idx) => {
                  const status = getCheckpointStatus(cp);
                  const sub = submissions[cp.id];
                  const openDate = new Date(cp.open_at);
                  const closeDate = new Date(cp.close_at);
                  const isDaySession = openDate.getHours() < 12;

                  return (
                    <tr
                      key={cp.id}
                      className="hover:bg-slate-50/80 transition group relative"
                    >
                      {/* Column 1: Ngày / Hạn chót */}
                      <td className="py-4 px-5 align-top">
                        <div className="space-y-1">
                          <div className="font-bold text-sm text-slate-900">
                            Mốc #{idx + 1}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {openDate.toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </div>
                          {status === 'open' && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Đang diễn ra
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 2: Buổi */}
                      <td className="py-4 px-5 align-top font-bold text-xs text-slate-500 uppercase font-mono">
                        {isDaySession ? 'SÁNG' : 'CHIỀU'}
                      </td>

                      {/* Column 3: Mốc kiểm soát & Chi tiết */}
                      <td className="py-4 px-5 align-top space-y-2">
                        {/* Status tag & Checkpoint Name */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {cp.name}
                          </span>

                          {status === 'open' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Hiện tại · Đang mở</span>
                            </span>
                          )}

                          {status === 'closed' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Đã kết thúc
                            </span>
                          )}

                          {status === 'upcoming' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Sắp diễn ra
                            </span>
                          )}

                          {sub ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center space-x-1">
                              <Check className="w-3 h-3" />
                              <span>Đã nộp bài</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              Chưa nộp
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                          {cp.description || 'Yêu cầu thí sinh nộp Commit SHA chứng minh tiến độ phát triển.'}
                        </p>

                        {/* Checklist & Times meta */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono pt-1">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Hạn chót: {closeDate.toLocaleTimeString('vi-VN')}</span>
                          </div>
                          {sub && (
                            <div className="flex items-center space-x-1 text-emerald-700 font-semibold">
                              <GitCommit className="w-3.5 h-3.5" />
                              <span>Commit: {(sub.commit_sha || '').substring(0, 7)}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1 text-slate-400">
                            <span>Checklist: {cp.is_required ? 'Bắt buộc' : 'Tùy chọn'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Column 4: Thao tác */}
                      <td className="py-4 px-5 align-top text-right">
                        <div className="relative inline-block text-left">
                          <button
                            onClick={() =>
                              setOpenDropdownId(openDropdownId === cp.id ? null : cp.id)
                            }
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition shadow-2xs"
                          >
                            <span>••• Thao tác</span>
                            <ChevronDown className="w-3 h-3 opacity-70" />
                          </button>

                          {/* Dropdown Menu */}
                          {openDropdownId === cp.id && (
                            <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                              <Link
                                to="/checkpoints"
                                className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
                              >
                                {status === 'open' && myTeam && isLeader
                                  ? '🚀 Nộp bài ngay'
                                  : '🔍 Xem chi tiết mốc'}
                              </Link>
                              <Link
                                to="/topics"
                                className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition"
                              >
                                📚 Xem đề tài AI
                              </Link>
                              <Link
                                to="/tickets"
                                className="block px-3 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition"
                              >
                                💬 Yêu cầu Mentor
                              </Link>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 6. Official Rules & Tech Pillars (VinUni x Vingroup) ───────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {/* Rules Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Quy Chế &amp; Khung Năng Lực SFIA</h3>
              <p className="text-xs text-slate-500">Chuẩn mực đào tạo &amp; thực chiến AI quốc tế</p>
            </div>
          </div>
          <ul className="text-xs text-slate-600 space-y-2.5 list-disc list-inside leading-relaxed">
            <li>Mô hình <strong>12 tuần</strong>: 3 tuần thực học tại VinUni + 9 tuần thực chiến tại Vingroup.</li>
            <li>Đóng băng mã nguồn tại thời điểm nộp bài với cơ chế <strong>Commit SHA Freeze</strong>.</li>
            <li>Hội đồng Giám khảo độc lập đánh giá sản phẩm theo <strong>Blind Rubric 4 tiêu chí</strong>.</li>
            <li>Hỗ trợ trực tiếp từ đội ngũ Quản lý dự án AI và Kỹ sư trưởng của hệ sinh thái Vingroup.</li>
          </ul>
        </div>

        {/* Contact Support Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Ban Tổ Chức VinUni AI Bootcamp</h3>
              <p className="text-xs text-slate-500">Đầu mối hỗ trợ học viên &amp; đội thi</p>
            </div>
          </div>
          <div className="space-y-2 text-xs text-slate-700">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500">Email BTC:</span>
              <span className="font-semibold text-slate-800">{(contactChannels.email as string) || 'ai.bootcamp@vinuni.edu.vn'}</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500">Địa điểm thực học:</span>
              <span className="font-semibold text-slate-800">Trường Đại học VinUni, Vinhomes Ocean Park, Gia Lâm, Hà Nội</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
