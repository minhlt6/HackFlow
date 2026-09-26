import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type { Team } from '../../types';
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ShieldAlert,
  ChevronRight,
  X,
  Mail,
  GraduationCap,
  Sparkles,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export const AdminTeamsManagement: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/teams');
      if (res.data?.success) {
        setTeams(res.data.data);
      }
    } catch (err) {
      console.error('Cannot load teams:', err);
      showNotice('error', 'Không thể tải danh sách đội thi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleApprove = async (teamId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProcessingId(teamId);
    try {
      const res = await apiClient.post(`/admin/teams/${teamId}/approve`);
      if (res.data?.success) {
        showNotice('success', 'Đã phê duyệt đội thi thành công.');
        await fetchTeams();
        if (selectedTeam?.id === teamId) {
          setSelectedTeam((prev) => (prev ? { ...prev, status: 'approved' } : null));
        }
      }
    } catch (err: any) {
      showNotice('error', err.response?.data?.error?.message || err.response?.data?.detail || 'Phê duyệt thất bại.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (teamId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Bạn có chắc chắn muốn từ chối đội thi này?')) return;
    setProcessingId(teamId);
    try {
      const res = await apiClient.post(`/admin/teams/${teamId}/reject`);
      if (res.data?.success) {
        showNotice('success', 'Đã từ chối đội thi.');
        await fetchTeams();
        if (selectedTeam?.id === teamId) {
          setSelectedTeam((prev) => (prev ? { ...prev, status: 'rejected' } : null));
        }
      }
    } catch (err: any) {
      showNotice('error', err.response?.data?.error?.message || err.response?.data?.detail || 'Từ chối thất bại.');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = teams.filter((t) => t.status === 'pending').length;
  const approvedCount = teams.filter((t) => t.status === 'approved').length;
  const rejectedCount = teams.filter((t) => t.status === 'rejected').length;

  const filteredTeams = teams.filter((t) => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchQuery =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.members?.some((m) => m.user?.full_name?.toLowerCase().includes(search.toLowerCase())) ||
      t.subtopic?.title?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchQuery;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Ban Tổ Chức • Quản trị Cuộc thi</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900">Danh Sách &amp; Quản Lý Đội Thi</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Xem hồ sơ, kiểm duyệt danh sách thành viên và phân bổ đề tài cho các đội tham gia.
          </p>
        </div>

        <button
          onClick={fetchTeams}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-none shadow-xs shrink-0 self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center space-x-2 text-sm font-semibold border ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Đội Thi</div>
          <div className="text-3xl font-black text-slate-900 mt-1">{teams.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Toàn bộ hồ sơ tạo trên hệ thống</div>
        </div>

        <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs bg-amber-50/30">
          <div className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Chờ Phê Duyệt</span>
          </div>
          <div className="text-3xl font-black text-amber-700 mt-1">{pendingCount}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Cần BTC xem xét &amp; duyệt</div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-xs bg-emerald-50/30">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center space-x-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Đã Phê Duyệt</span>
          </div>
          <div className="text-3xl font-black text-emerald-700 mt-1">{approvedCount}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Đủ điều kiện chọn đề tài &amp; thi</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center space-x-1">
            <XCircle className="w-3.5 h-3.5" />
            <span>Bị Từ Chối</span>
          </div>
          <div className="text-3xl font-black text-rose-700 mt-1">{rejectedCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Không đạt yêu cầu ban đầu</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên đội, thành viên, đề tài..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'pending', label: `Chờ duyệt (${pendingCount})` },
            { id: 'approved', label: `Đã duyệt (${approvedCount})` },
            { id: 'rejected', label: `Từ chối (${rejectedCount})` },
          ].map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-none shrink-0 ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Teams Table */}
      {loading ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-semibold">Đang tải danh sách đội thi...</p>
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Không tìm thấy đội thi nào</p>
          <p className="text-xs text-slate-500 mt-1">Hãy thử đổi bộ lọc hoặc từ khóa tìm kiếm</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Tên Đội</th>
                  <th className="py-3.5 px-4">Trạng Thái</th>
                  <th className="py-3.5 px-4">Đề Tài Đăng Ký</th>
                  <th className="py-3.5 px-4">Thành Viên</th>
                  <th className="py-3.5 px-4">Trưởng Nhóm (Leader)</th>
                  <th className="py-3.5 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeams.map((team) => {
                  const leader = team.members?.find((m) => m.role === 'leader' || m.role_in_team === 'leader');
                  const acceptedCount = team.members?.filter((m) => m.status === 'accepted').length || 0;

                  return (
                    <tr
                      key={team.id}
                      onClick={() => setSelectedTeam(team)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-none group"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 group-hover:text-blue-700">
                        <div className="flex items-center space-x-2">
                          <span>{team.name}</span>
                          {team.invite_code && (
                            <span className="font-mono text-[10px] text-slate-400 font-normal">
                              ({team.invite_code})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {team.status === 'approved' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            <span>Đã duyệt</span>
                          </span>
                        )}
                        {team.status === 'pending' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Chờ duyệt</span>
                          </span>
                        )}
                        {team.status === 'rejected' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            <span>Từ chối</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {team.subtopic ? (
                          <span className="text-slate-900 font-semibold">{team.subtopic.title}</span>
                        ) : (
                          <span className="text-slate-400 italic">Chưa đăng ký</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {acceptedCount} / 5 TV
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {leader?.user ? (
                          <div>
                            <div className="font-semibold text-slate-800">{leader.user.full_name}</div>
                            <div className="text-[10px] text-slate-400">{leader.user.email}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa xác định</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                        {team.status === 'pending' && (
                          <>
                            <button
                              onClick={(e) => handleApprove(team.id, e)}
                              disabled={processingId === team.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs transition-none"
                            >
                              Duyệt
                            </button>
                            <button
                              onClick={(e) => handleReject(team.id, e)}
                              disabled={processingId === team.id}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition-none"
                            >
                              Từ chối
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedTeam(team)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] transition-none inline-flex items-center space-x-1"
                        >
                          <span>Xem thành viên</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Details & Members Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
              <div>
                <div className="flex items-center space-x-3 mb-1">
                  <h2 className="text-2xl font-black text-slate-900">{selectedTeam.name}</h2>
                  {selectedTeam.status === 'approved' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Đã phê duyệt
                    </span>
                  )}
                  {selectedTeam.status === 'pending' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Chờ phê duyệt
                    </span>
                  )}
                  {selectedTeam.status === 'rejected' && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Bị từ chối
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  {selectedTeam.invite_code && (
                    <span>
                      Mã mời: <strong className="font-mono text-slate-800">{selectedTeam.invite_code}</strong>
                    </span>
                  )}
                  <span>
                    Đề tài:{' '}
                    <strong className="text-slate-800">
                      {selectedTeam.subtopic?.title || 'Chưa đăng ký đề tài nhánh'}
                    </strong>
                  </span>
                  <span>
                    Số lượng:{' '}
                    <strong className="text-slate-800">
                      {selectedTeam.members?.length || 0}/5 thành viên
                    </strong>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedTeam(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Members List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Danh sách Thành viên Chi tiết</span>
                <span>{selectedTeam.members?.length || 0} người</span>
              </div>

              {(!selectedTeam.members || selectedTeam.members.length === 0) ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 text-slate-500 text-xs">
                  Chưa có dữ liệu thành viên trong đội này.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedTeam.members.map((member) => {
                    const u = member.user;
                    const isLeader = member.role === 'leader' || member.role_in_team === 'leader';

                    return (
                      <div
                        key={member.id}
                        className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-200 shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold flex items-center justify-center text-sm shrink-0">
                              {u?.full_name ? u.full_name[0].toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-bold text-slate-900">
                                  {u?.full_name || 'Chưa cập nhật tên'}
                                </span>
                                {isLeader && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Trưởng nhóm
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5">
                                <span className="inline-flex items-center space-x-1">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{u?.email}</span>
                                </span>
                                {u?.student_id && (
                                  <span>
                                    MSSV: <strong className="font-mono text-slate-700">{u.student_id}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              member.status === 'accepted'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {member.status === 'accepted' ? 'Chính thức' : member.status}
                          </span>
                        </div>

                        {/* Extra profile details: school, skills, major */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          {u?.school && (
                            <div className="inline-flex items-center space-x-1 text-slate-700">
                              <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                              <span>{u.school}</span>
                            </div>
                          )}

                          {u?.major_direction && (
                            <div className="inline-flex items-center space-x-1 text-slate-700">
                              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                              <span>Hướng: {u.major_direction}</span>
                            </div>
                          )}

                          {u?.skills && u.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center ml-auto">
                              {u.skills.slice(0, 4).map((skill, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Thao tác kiểm duyệt có hiệu lực ngay lập tức.
              </div>

              <div className="flex items-center space-x-2">
                {selectedTeam.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(selectedTeam.id)}
                      disabled={processingId === selectedTeam.id}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-none"
                    >
                      Phê Duyệt Đội
                    </button>
                    <button
                      onClick={() => handleReject(selectedTeam.id)}
                      disabled={processingId === selectedTeam.id}
                      className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-none"
                    >
                      Từ Chối Đội
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-none"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
