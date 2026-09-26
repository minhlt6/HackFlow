import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import {
  Users,
  Plus,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  X,
  Mail,
  School,
  Link,
  Edit2,
} from 'lucide-react';

interface AssignedSubtopic {
  id: string;
  name: string;
}

interface MentorItem {
  id: string;
  full_name: string;
  email: string;
  school?: string;
  skills: string[];
  is_active: boolean;
  active_tickets_count: number;
  assigned_subtopics: AssignedSubtopic[];
  created_at?: string;
}

interface TopicOption {
  id: string;
  name: string;
  subtopics: Array<{ id: string; name: string }>;
}

export const AdminMentorsPanel: React.FC = () => {
  const [mentors, setMentors] = useState<MentorItem[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Mentor Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFullName, setAddFullName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('Mentor@123');
  const [addSchool, setAddSchool] = useState('');
  const [addSkills, setAddSkills] = useState('');

  // Edit Mentor Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMentorId, setEditingMentorId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editSchool, setEditSchool] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Assign Subtopic Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<MentorItem | null>(null);
  const [selectedSubtopicId, setSelectedSubtopicId] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mentorsRes, topicsRes] = await Promise.all([
        apiClient.get('/admin/mentors'),
        apiClient.get('/admin/topics').catch(() => ({ data: { success: true, data: [] } })),
      ]);
      if (mentorsRes.data?.success) setMentors(mentorsRes.data.data);
      if (topicsRes.data?.success) setTopics(topicsRes.data.data);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Không thể tải danh sách Mentor.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const skillsList = addSkills
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      const res = await apiClient.post('/admin/mentors', {
        full_name: addFullName.trim(),
        email: addEmail.trim().toLowerCase(),
        password: addPassword.trim(),
        school: addSchool.trim() || undefined,
        skills: skillsList,
      });

      if (res.data?.success) {
        setMessage({
          type: 'success',
          text: `Đã cấp tài khoản Mentor cho ${addFullName}. Mật khẩu: ${addPassword}`,
        });
        setShowAddModal(false);
        setAddFullName('');
        setAddEmail('');
        setAddPassword('Mentor@123');
        setAddSchool('');
        setAddSkills('');
        fetchData();
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Tạo Mentor thất bại.' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (m: MentorItem) => {
    setEditingMentorId(m.id);
    setEditFullName(m.full_name);
    setEditSchool(m.school || '');
    setEditSkills((m.skills || []).join(', '));
    setEditIsActive(m.is_active);
    setShowEditModal(true);
  };

  const handleUpdateMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMentorId) return;
    setSubmitting(true);
    const skillsList = editSkills
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      await apiClient.put(`/admin/mentors/${editingMentorId}`, {
        full_name: editFullName.trim(),
        school: editSchool.trim() || undefined,
        skills: skillsList,
        is_active: editIsActive,
      });
      setMessage({ type: 'success', text: 'Đã cập nhật thông tin Mentor thành công.' });
      setShowEditModal(false);
      fetchData();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Cập nhật thất bại.' });
    } finally {
      setSubmitting(false);
    }
  };

  const openAssignModal = (m: MentorItem) => {
    setSelectedMentor(m);
    setSelectedSubtopicId('');
    setShowAssignModal(true);
  };

  const handleAssignSubtopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMentor || !selectedSubtopicId) return;
    setSubmitting(true);

    try {
      await apiClient.post(`/admin/subtopics/${selectedSubtopicId}/mentors`, {
        mentor_id: selectedMentor.id,
      });
      setMessage({
        type: 'success',
        text: `Đã phân công ${selectedMentor.full_name} phụ trách đề tài.`,
      });
      setShowAssignModal(false);
      fetchData();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Phân công đề tài thất bại.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassignSubtopic = async (mentorId: string, subtopicId: string) => {
    if (!window.confirm('Xác nhận gỡ phân công mentor khỏi đề tài này?')) return;
    try {
      await apiClient.delete(`/admin/subtopics/${subtopicId}/mentors/${mentorId}`);
      setMessage({ type: 'success', text: 'Đã gỡ phân công đề tài.' });
      fetchData();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Gỡ phân công thất bại.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-violet-400" />
            <span>Quản Lý Cố Vấn (Mentors)</span>
          </h2>
          <p className="text-sm text-slate-400">
            Thêm cố vấn, phân công chuyên gia theo đề tài và theo dõi khối lượng ticket hỗ trợ.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Tải lại danh sách"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold shadow-lg shadow-violet-950/50 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Cố Vấn Mới</span>
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

      {/* Mentors Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-mono tracking-wider">
              <tr>
                <th className="px-6 py-3">Họ Tên &amp; Email</th>
                <th className="px-6 py-3">Đơn Vị / Trường</th>
                <th className="px-6 py-3">Kỹ Năng &amp; Lĩnh Vực</th>
                <th className="px-6 py-3">Đề Tài Phụ Trách</th>
                <th className="px-6 py-3">Tickets Chờ</th>
                <th className="px-6 py-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-violet-400"></div>
                  </td>
                </tr>
              ) : mentors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Chưa có cố vấn nào trong hệ thống. Nhấn "Thêm Cố Vấn Mới" để tạo tài khoản.
                  </td>
                </tr>
              ) : (
                mentors.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white flex items-center space-x-2">
                        <span>{m.full_name}</span>
                        {!m.is_active && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-500">
                            Vô hiệu
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono flex items-center space-x-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span>{m.email}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-300">
                      {m.school ? (
                        <div className="flex items-center space-x-1.5">
                          <School className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{m.school}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {m.skills && m.skills.length > 0 ? (
                          m.skills.map((skill, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-1 max-w-[220px]">
                        {m.assigned_subtopics && m.assigned_subtopics.length > 0 ? (
                          m.assigned_subtopics.map((st) => (
                            <div
                              key={st.id}
                              className="flex items-center justify-between text-xs px-2 py-1 rounded bg-violet-950/40 text-violet-300 border border-violet-800/40 group"
                            >
                              <span className="truncate">{st.name}</span>
                              <button
                                onClick={() => handleUnassignSubtopic(m.id, st.id)}
                                className="text-slate-500 hover:text-rose-400 ml-1 shrink-0"
                                title="Gỡ phân công đề tài này"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500 italic">Chưa phân công</span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 font-mono">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          m.active_tickets_count > 0
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {m.active_tickets_count} ticket
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right space-x-1.5">
                      <button
                        onClick={() => openAssignModal(m)}
                        className="px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs font-semibold border border-violet-500/30"
                      >
                        Phân công
                      </button>
                      <button
                        onClick={() => openEditModal(m)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400"
                        title="Sửa thông tin"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Mentor */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-violet-400" />
                <span>Thêm Cố Vấn (Mentor) Mới</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMentor} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Họ và Tên Cố Vấn *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TS. Nguyễn Văn A"
                  value={addFullName}
                  onChange={(e) => setAddFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Địa Chỉ Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="mentor@university.edu.vn"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mật Khẩu Tạm Thời
                </label>
                <input
                  type="text"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Đơn Vị Công Tác / Trường
                </label>
                <input
                  type="text"
                  placeholder="e.g. Đại học Bách Khoa Hà Nội"
                  value={addSchool}
                  onChange={(e) => setAddSchool(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kỹ Năng &amp; Lĩnh Vực (Phân cách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  placeholder="AI, Machine Learning, Computer Vision, FastAPI..."
                  value={addSkills}
                  onChange={(e) => setAddSkills(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-violet-950/40"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo Tài Khoản Mentor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Mentor */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-amber-400" />
                <span>Cập Nhật Thông Tin Cố Vấn</span>
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateMentor} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Họ và Tên</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Đơn Vị Công Tác
                </label>
                <input
                  type="text"
                  value={editSchool}
                  onChange={(e) => setEditSchool(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kỹ Năng (Phân cách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  value={editSkills}
                  onChange={(e) => setEditSkills(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="mentor_active"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-amber-600 focus:ring-0"
                />
                <label
                  htmlFor="mentor_active"
                  className="text-xs text-slate-300 font-semibold cursor-pointer"
                >
                  Tài khoản đang hoạt động (Active)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Mentor to Subtopic */}
      {showAssignModal && selectedMentor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Link className="w-5 h-5 text-violet-400" />
                <span>Phân Công Đề Tài Cho Mentor</span>
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Chọn đề tài giao cho{' '}
              <strong className="text-white">{selectedMentor.full_name}</strong> phụ trách chuyên
              môn:
            </p>

            <form onSubmit={handleAssignSubtopic} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Chọn Đề Tài Cụ Thể *
                </label>
                <select
                  required
                  value={selectedSubtopicId}
                  onChange={(e) => setSelectedSubtopicId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="">-- Chọn đề tài con --</option>
                  {topics.map((t) => (
                    <optgroup key={t.id} label={t.name}>
                      {t.subtopics.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedSubtopicId}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  {submitting ? 'Đang phân công...' : 'Xác Nhận Phân Công'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
