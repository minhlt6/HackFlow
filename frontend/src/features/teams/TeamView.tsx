import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { Team } from '../../types';
import { 
  Users, UserPlus, Copy, Check, Crown, AlertTriangle, 
  GitCommit, Send, ShieldCheck, BookOpen, Trash, LogOut, CheckCircle, XCircle, Search
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeamView: React.FC = () => {
  const { user } = useAuthStore();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Form states
  const [teamName, setTeamName] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Final submission state
  const [repoUrl, setRepoUrl] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Browse teams state
  const [approvedTeams, setApprovedTeams] = useState<Team[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Tabs
  const [activeTab, setActiveTab] = useState<'members' | 'requests'>('members');

  const fetchMyTeam = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/teams/my-team');
      if (res.data?.success && res.data.data) {
        setTeam(res.data.data);
        if (res.data.data.final_submission) {
          setRepoUrl(res.data.data.final_submission.repo_url || '');
          setCommitSha(res.data.data.final_submission.commit_sha || '');
          setDemoUrl(res.data.data.final_submission.demo_url || '');
          setVideoUrl(res.data.data.final_submission.video_url || '');
        }
      } else {
        setTeam(null);
        fetchApprovedTeams();
      }
    } catch {
      setTeam(null);
      fetchApprovedTeams();
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedTeams = async () => {
    try {
      const res = await apiClient.get('/teams/');
      if (res.data?.success) {
        setApprovedTeams(res.data.data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchMyTeam();
  }, []);

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const showError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError(null), 5000);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await apiClient.post('/teams', { name: teamName });
      if (res.data?.success) {
        showSuccess('Tạo nhóm thành công!');
        setTeamName('');
        fetchMyTeam();
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Không thể tạo nhóm.');
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try {
      const res = await apiClient.post('/teams/join', { invite_code: inviteCodeInput.trim() });
      if (res.data?.success) {
        showSuccess('Tham gia nhóm thành công!');
        setInviteCodeInput('');
        fetchMyTeam();
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Mã mời không hợp lệ hoặc nhóm đã đủ người.');
    }
  };

  const handleRequestJoin = async (teamId: string) => {
    setActionError(null);
    try {
      const res = await apiClient.post(`/teams/${teamId}/join`);
      if (res.data?.success) {
        showSuccess('Đã gửi yêu cầu tham gia đội!');
        fetchMyTeam();
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Không thể xin vào đội.');
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm('CẢNH BÁO: Bài thi sau khi nộp sẽ được ĐÓNG BĂNG COMMIT SHA. Bạn có chắc chắn muốn nộp phiên bản này?')) {
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const res = await apiClient.post(`/submissions/final?team_id=${team!.id}`, {
        repo_url: repoUrl,
        commit_sha: commitSha,
        demo_url: demoUrl || undefined,
        video_url: videoUrl || undefined,
      });
      if (res.data?.success) {
        showSuccess('Nộp bài thi chung cuộc thành công! Hệ thống đã ghi nhận Commit SHA.');
        fetchMyTeam();
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Nộp bài thất bại. Có thể đã hết hạn nộp.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptRequest = async (memberId: string) => {
    try {
      const res = await apiClient.post(`/teams/${team!.id}/members/${memberId}/respond?accept=true`);
      if (res.data?.success) {
        showSuccess('Đã chấp nhận thành viên!');
        fetchMyTeam();
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Có lỗi xảy ra.');
    }
  };

  const handleRejectRequest = async (memberId: string) => {
    try {
      const res = await apiClient.post(`/teams/${team!.id}/members/${memberId}/respond?accept=false`);
      if (res.data?.success) {
        showSuccess('Đã từ chối thành viên.');
        fetchMyTeam();
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Có lỗi xảy ra.');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thành viên này khỏi đội?')) return;
    try {
      const res = await apiClient.delete(`/teams/${team!.id}/members/${userId}`);
      if (res.data?.success) {
        showSuccess('Đã xóa thành viên.');
        fetchMyTeam();
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Có lỗi xảy ra.');
    }
  };

  const handleTransferLeader = async (userId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn chuyển quyền Leader cho thành viên này?')) return;
    try {
      const res = await apiClient.post(`/teams/${team!.id}/transfer-leader`, { new_leader_id: userId });
      if (res.data?.success) {
        showSuccess('Đã chuyển quyền Leader thành công.');
        fetchMyTeam();
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Có lỗi xảy ra.');
    }
  };

  const handleLeaveTeam = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn rời khỏi đội?')) return;
    try {
      const res = await apiClient.post(`/teams/${team!.id}/leave`);
      if (res.data?.success) {
        showSuccess('Bạn đã rời khỏi đội.');
        fetchMyTeam();
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Không thể rời đội.');
    }
  };

  const copyInviteCode = () => {
    if (team?.invite_code) {
      navigator.clipboard.writeText(team.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  // Not in a team yet
  if (!team) {
    const filteredTeams = approvedTeams.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Quản lý Đội thi</h1>
          <p className="text-slate-400">Bạn chưa tham gia đội thi nào. Hãy tạo một đội mới hoặc nhập mã mời để vào đội.</p>
        </div>

        {actionError && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            {actionSuccess}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Create Team Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Tạo Đội Mới</h2>
              <p className="text-xs text-slate-400 mb-6">
                Bạn sẽ trở thành Trưởng nhóm (Leader), có quyền đăng ký đề tài và nộp bài thi cho cả nhóm.
              </p>

              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Tên đội thi *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: TechTitans, CyberNova..."
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition"
                >
                  Tạo Đội Ngay
                </button>
              </form>
            </div>
          </div>

          {/* Join Team Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4">
                <UserPlus className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Tham Gia Bằng Mã Mời</h2>
              <p className="text-xs text-slate-400 mb-6">
                Nhận mã mời gồm 8 ký tự từ Trưởng nhóm của bạn để tham gia vào đội thi.
              </p>

              <form onSubmit={handleJoinTeam} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Mã mời nhóm (Invite Code) *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="ABC12345"
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono uppercase tracking-widest focus:outline-none focus:border-teal-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-400 border border-teal-500/30 font-medium text-sm transition"
                >
                  Gia Nhập Đội
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Browse Teams */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Search className="w-5 h-5 text-emerald-400" />
              <span>Danh sách đội đang tuyển thành viên</span>
            </h2>
            <div className="mt-4 md:mt-0 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input 
                type="text" 
                placeholder="Tìm tên đội..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-64 bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeams.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-400 text-sm border border-slate-800 border-dashed rounded-xl">
                Không tìm thấy đội nào.
              </div>
            ) : (
              filteredTeams.map(t => (
                <div key={t.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-white mb-1">{t.name}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-3">{t.description || 'Chưa có mô tả'}</p>
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mb-4">
                      <Users className="w-3.5 h-3.5" />
                      <span>{t.members?.length || 0}/5 thành viên</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRequestJoin(t.id)}
                    className="w-full py-2 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition"
                  >
                    Xin vào đội
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    );
  }

  const leaderId = team.leader_id ?? team.members?.find(m => m.role_in_team === 'leader')?.user_id;
  const isLeader = !!leaderId && leaderId === user?.id;

  const pendingRequests = team.members?.filter(m => m.status === 'pending') || [];
  const acceptedMembers = team.members?.filter(m => m.status === 'accepted' || m.status === 'left' === false && m.status !== 'pending' && m.status !== 'rejected') || []; // Just use accepted, assuming left/rejected are not in team members list or shouldn't be shown normally except maybe as rejected

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Banner trạng thái đội */}
      {team.status === 'pending' && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-medium text-sm">Đội đang chờ BTC phê duyệt — chưa thể chọn đề tài</span>
        </div>
      )}
      {team.status === 'rejected' && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-medium text-sm">Đội bị từ chối. Liên hệ BTC.</span>
        </div>
      )}

      {/* Top Banner: Team Details & Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-black text-white">{team.name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                {team.status}
              </span>
            </div>

            {/* Subtopic info */}
            {team.subtopic ? (
              <div className="flex items-center space-x-2 text-sm text-slate-300 mt-1">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>Đề tài đăng ký:</span>
                <span className="font-semibold text-white">{team.subtopic.title}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-sm text-amber-400 mt-1">
                <AlertTriangle className="w-4 h-4" />
                <span>Chưa chọn đề tài nhánh!</span>
                {isLeader && (
                  <Link to="/topics" className="underline font-medium hover:text-amber-300">
                    Chọn đề tài ngay →
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Invite Code Box */}
            <div className="flex items-center space-x-3 bg-slate-950 border border-slate-800 rounded-xl p-3">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Mã mời thành viên</div>
                <div className="text-lg font-mono font-bold text-emerald-400 tracking-widest">{team.invite_code}</div>
              </div>
              <button
                onClick={copyInviteCode}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                title="Copy mã mời"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            
            {!isLeader && (
              <button 
                onClick={handleLeaveTeam}
                className="flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>Rời khỏi đội</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {actionSuccess}
        </div>
      )}

      {/* Grid: Members & Final Submission */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 1 col: Team Members list */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          {isLeader ? (
            <div className="flex items-center space-x-2 mb-6 border-b border-slate-200 pb-3">
              <button 
                onClick={() => setActiveTab('members')}
                className={`text-xs px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-none ${
                  activeTab === 'members'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent font-medium'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Thành viên ({acceptedMembers.length}/5)</span>
              </button>
              <button 
                onClick={() => setActiveTab('requests')}
                className={`text-xs px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-none relative ${
                  activeTab === 'requests'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent font-medium'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Yêu cầu</span>
                {pendingRequests.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Thành viên ({acceptedMembers.length}/5)</span>
              </h2>
            </div>
          )}

          <div className="space-y-3">
            {(!isLeader || activeTab === 'members') && acceptedMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80"
              >
                <div>
                  <div className="text-sm font-semibold text-white flex items-center space-x-1.5">
                    <span>{member.user?.full_name}</span>
                    {member.role_in_team === 'leader' && (
                      <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{member.user?.email}</div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {isLeader && member.user_id !== user?.id && (
                    <div className="flex items-center space-x-1">
                      <button 
                        onClick={() => handleTransferLeader(member.user_id)}
                        title="Chuyển quyền Leader"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                      >
                        <Crown className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleRemoveMember(member.user_id)}
                        title="Xóa thành viên"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 capitalize font-mono">
                    {member.role_in_team}
                  </span>
                </div>
              </div>
            ))}

            {isLeader && activeTab === 'requests' && pendingRequests.length === 0 && (
              <div className="text-center py-6 text-sm text-slate-400 border border-slate-800 border-dashed rounded-xl">
                Không có yêu cầu nào.
              </div>
            )}

            {isLeader && activeTab === 'requests' && pendingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3"
              >
                <div>
                  <div className="text-sm font-semibold text-white">{req.user?.full_name}</div>
                  <div className="text-xs text-slate-400">{req.user?.email}</div>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleAcceptRequest(req.user_id)} // Need to check if user_id or id is used by API
                    className="flex-1 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center justify-center space-x-1 transition"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Chấp nhận</span>
                  </button>
                  <button 
                    onClick={() => handleRejectRequest(req.user_id)} // Need to check if user_id or id is used by API
                    className="flex-1 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium flex items-center justify-center space-x-1 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Từ chối</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 2 cols: Final Submission with Commit SHA Freeze */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Nộp Sản Phẩm Chung Cuộc (Commit SHA Freeze)</span>
            </h2>
            {team.final_submission?.is_frozen && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                LOCKED & FROZEN
              </span>
            )}
          </div>

          <p className="text-xs text-slate-400 mb-6">
            Cơ chế chống gian lận độc quyền: Bạn bắt buộc phải cung cấp Commit SHA 40 ký tự tại thời điểm nộp. 
            Sau mốc deadline, giám khảo chỉ chấm đúng commit SHA này để đảm bảo tính công bằng tuyệt đối.
          </p>

          <form onSubmit={handleFinalSubmit} className="space-y-4">
            {team.final_submission?.is_frozen && (
              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-400 text-xs text-center">
                ⚠️ Bài thi đã được ĐÓNG BĂNG. Không thể chỉnh sửa sau khi commit SHA đã freeze.
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">GitHub / GitLab Repository URL *</label>
              <input
                type="url"
                required
                disabled={!!team.final_submission?.is_frozen}
                placeholder="https://github.com/myteam/hackflow-project"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Final Commit SHA (40 ký tự hexa) *
              </label>
              <div className="relative">
                <GitCommit className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  disabled={!!team.final_submission?.is_frozen}
                  minLength={7}
                  maxLength={40}
                  pattern="[0-9a-fA-F]{7,40}"
                  title="Commit SHA phải là chuỗi hex từ 7–40 ký tự (0-9, a-f)"
                  placeholder="e.g. 7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1f"
                  value={commitSha}
                  onChange={(e) => setCommitSha(e.target.value.toLowerCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              {commitSha && !/^[0-9a-f]{7,40}$/.test(commitSha) && (
                <p className="text-xs text-rose-400 mt-1">SHA phải là chuỗi hex từ 7–40 ký tự (0-9, a-f)</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Live Demo URL (Tùy chọn)</label>
                <input
                  type="url"
                  disabled={!!team.final_submission?.is_frozen}
                  placeholder="https://my-demo-app.vercel.app"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Video Pitch / Demo URL (Tùy chọn)</label>
                <input
                  type="url"
                  disabled={!!team.final_submission?.is_frozen}
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {isLeader && !team.final_submission?.is_frozen ? (
              <button
                type="submit"
                disabled={submitting || (commitSha.length > 0 && !/^[0-9a-f]{7,40}$/.test(commitSha))}
                className="w-full mt-2 flex items-center justify-center space-x-2 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-semibold text-sm transition shadow-lg shadow-emerald-950/40"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Đang xác thực và đóng băng...' : 'Xác nhận Nộp Sản Phẩm & Đóng Băng SHA'}</span>
              </button>
            ) : !isLeader ? (
              <div className="p-3 rounded-lg bg-slate-950 text-slate-400 text-xs text-center border border-slate-800">
                Chỉ Trưởng nhóm (Leader) mới có quyền nộp sản phẩm chung cuộc.
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
};
