import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import {
  Shield,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle,
  UserCheck,
  Mail,
  School,
  X,
  RefreshCw,
} from 'lucide-react';

interface JudgeUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  school?: string;
  skills?: string[];
}

interface TeamInfo {
  id: string;
  name: string;
  status: string;
}

interface JudgeAssignment {
  id: string;
  judge_id: string;
  team_id: string;
  assigned_at: string;
  judge?: JudgeUser;
  team?: TeamInfo;
}

export const JudgeAssignmentPanel: React.FC = () => {
  const [judges, setJudges] = useState<JudgeUser[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [assignments, setAssignments] = useState<JudgeAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Create Judge State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [judgeFullName, setJudgeFullName] = useState('');
  const [judgeEmail, setJudgeEmail] = useState('');
  const [judgePassword, setJudgePassword] = useState('Judge@123');
  const [judgeSchool, setJudgeSchool] = useState('');
  const [judgeSkills, setJudgeSkills] = useState('');
  const [creatingJudge, setCreatingJudge] = useState(false);

  // Active sub-tab: 'assignments' | 'judges_list'
  const [activeTab, setActiveTab] = useState<'assignments' | 'judges_list'>('assignments');

  const msgTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, teamsRes, assignmentsRes] = await Promise.all([
        apiClient.get('/admin/judges'),
        apiClient.get('/teams?status=approved'),
        apiClient.get('/admin/judge-assignments'),
      ]);
      if (usersRes.data?.success) setJudges(usersRes.data.data);
      if (teamsRes.data?.success) setTeams(teamsRes.data.data);
      if (assignmentsRes.data?.success) setAssignments(assignmentsRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    };
  }, []);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(() => setMessage(null), 4000);
  };

  const handleCreateJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingJudge(true);
    const skillsList = judgeSkills
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      const res = await apiClient.post('/admin/judges', {
        full_name: judgeFullName.trim(),
        email: judgeEmail.trim().toLowerCase(),
        password: judgePassword.trim(),
        school: judgeSchool.trim() || undefined,
        skills: skillsList,
      });

      if (res.data?.success) {
        showMsg('success', `Đã tạo tài khoản Giám Khảo cho ${judgeFullName}. Mật khẩu: ${judgePassword}`);
        setShowCreateModal(false);
        setJudgeFullName('');
        setJudgeEmail('');
        setJudgePassword('Judge@123');
        setJudgeSchool('');
        setJudgeSkills('');
        await loadData();
      }
    } catch (err: any) {
      showMsg('error', err.response?.data?.detail || 'Tạo tài khoản Giám Khảo thất bại.');
    } finally {
      setCreatingJudge(false);
    }
  };

  const handleDeleteJudge = async (id: string, name: string) => {
    if (!window.confirm(`Xác nhận xóa tài khoản Giám Khảo "${name}"?`)) return;
    try {
      await apiClient.delete(`/admin/judges/${id}`);
      showMsg('success', `Đã xóa tài khoản Giám Khảo "${name}".`);
      await loadData();
    } catch (err: any) {
      showMsg('error', err.response?.data?.detail || 'Xóa giám khảo thất bại.');
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJudgeId || !selectedTeamId) return;

    setSaving(true);
    try {
      const res = await apiClient.post('/admin/judge-assignments', {
        judge_id: selectedJudgeId,
        team_id: selectedTeamId,
      });

      if (res.data?.success) {
        showMsg('success', 'Đã phân công giám khảo chấm đội thành công.');
        setSelectedJudgeId('');
        setSelectedTeamId('');
        await loadData();
      }
    } catch (err: any) {
      showMsg('error', err.response?.data?.detail || 'Phân công giám khảo thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    try {
      const res = await apiClient.delete(`/admin/judge-assignments/${id}`);
      if (res.data?.success) {
        showMsg('success', 'Đã hủy phân công thành công.');
        await loadData();
      }
    } catch (err: any) {
      showMsg('error', err.response?.data?.detail || 'Hủy phân công thất bại.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span>Ban Giám Khảo &amp; Phân Công Chấm Điểm</span>
          </h2>
          <p className="text-sm text-slate-400">
            Tạo tài khoản Giám khảo, quản lý hội đồng BGK và phân công đội thi theo từng giám khảo.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Làm mới"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-950/50 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Tài Khoản Giám Khảo</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center space-x-2 p-3.5 rounded-xl border text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition-none ${
            activeTab === 'assignments'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent font-medium'
          }`}
        >
          Phân Công Chấm Bài ({assignments.length})
        </button>
        <button
          onClick={() => setActiveTab('judges_list')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition-none ${
            activeTab === 'judges_list'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent font-medium'
          }`}
        >
          Hội Đồng Giám Khảo ({judges.length})
        </button>
      </div>

      {/* ── Sub-tab: Phân Công ──────────────────────────────── */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          {/* Assignment Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-indigo-400" />
              <span>Giao Đội Thi Cho Giám Khảo</span>
            </h3>

            <form onSubmit={handleAssign} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Chọn Giám Khảo *
                </label>
                <select
                  required
                  value={selectedJudgeId}
                  onChange={(e) => setSelectedJudgeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Chọn giám khảo --</option>
                  {judges.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.full_name} ({j.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Chọn Đội Thi Cần Chấm *
                </label>
                <select
                  required
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Chọn đội thi --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving || !selectedJudgeId || !selectedTeamId}
                  className="w-full px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition"
                >
                  {saving ? 'Đang giao...' : 'Xác Nhận Phân Công'}
                </button>
              </div>
            </form>
          </div>

          {/* Assignments Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Giám Khảo</th>
                    <th className="px-5 py-3">Đội Thi Được Giao</th>
                    <th className="px-5 py-3">Thời Gian Giao</th>
                    <th className="px-5 py-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center">
                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-400"></div>
                      </td>
                    </tr>
                  ) : assignments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                        Chưa có phân công nào. Chọn giám khảo và đội thi bên trên để bắt đầu.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/40">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-white">
                            {a.judge?.full_name || 'Giám khảo'}
                          </div>
                          <div className="text-slate-400 font-mono text-[11px]">
                            {a.judge?.email || a.judge_id}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-semibold text-white">
                            {a.team?.name || a.team_id}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-400">
                          {new Date(a.assigned_at).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleRemoveAssignment(a.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 transition"
                            title="Hủy phân công"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-tab: Danh Sách Giám Khảo ──────────────────────── */}
      {activeTab === 'judges_list' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono tracking-wider">
                <tr>
                  <th className="px-5 py-3">Họ Tên &amp; Email</th>
                  <th className="px-5 py-3">Đơn Vị / Trường</th>
                  <th className="px-5 py-3">Chuyên Môn</th>
                  <th className="px-5 py-3">Số Đội Được Giao</th>
                  <th className="px-5 py-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {judges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                      Chưa có tài khoản giám khảo nào. Nhấn "Tạo Tài Khoản Giám Khảo" để thêm.
                    </td>
                  </tr>
                ) : (
                  judges.map((j) => {
                    const assignedCount = assignments.filter((a) => a.judge_id === j.id).length;
                    return (
                      <tr key={j.id} className="hover:bg-slate-800/40">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-white">{j.full_name}</div>
                          <div className="text-slate-400 font-mono text-[11px] flex items-center space-x-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{j.email}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-300">
                          {j.school ? (
                            <div className="flex items-center space-x-1">
                              <School className="w-3.5 h-3.5 text-slate-500" />
                              <span>{j.school}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {j.skills && j.skills.length > 0 ? (
                              j.skills.map((s, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700"
                                >
                                  {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 font-mono">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              assignedCount > 0
                                ? 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {assignedCount} đội
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleDeleteJudge(j.id, j.full_name)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 transition"
                            title="Xóa giám khảo này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Judge */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Shield className="w-5 h-5 text-indigo-400" />
                <span>Tạo Tài Khoản Giám Khảo (Judge)</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJudge} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Họ và Tên Giám Khảo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PGS. TS. Trần Văn B"
                  value={judgeFullName}
                  onChange={(e) => setJudgeFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Đăng Nhập *
                </label>
                <input
                  type="email"
                  required
                  placeholder="judge@university.edu.vn"
                  value={judgeEmail}
                  onChange={(e) => setJudgeEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mật Khẩu Tạm Thời
                </label>
                <input
                  type="text"
                  value={judgePassword}
                  onChange={(e) => setJudgePassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Đơn Vị / Tổ Chức Công Tác
                </label>
                <input
                  type="text"
                  placeholder="e.g. Viện CNTT - Đại học Quốc gia"
                  value={judgeSchool}
                  onChange={(e) => setJudgeSchool(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lĩnh Vực Chuyên Môn (Phân cách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  placeholder="AI, Software Architecture, Product Management..."
                  value={judgeSkills}
                  onChange={(e) => setJudgeSkills(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingJudge}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-950/40"
                >
                  {creatingJudge ? 'Đang tạo...' : 'Tạo Tài Khoản Giám Khảo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
