import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import {
  Flag,
  Plus,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  ExternalLink,
  Award,
  ShieldAlert,
  ListChecks,
} from 'lucide-react';

interface CheckpointItem {
  id: string;
  name: string;
  description?: string;
  open_at: string;
  close_at: string;
  display_order: number;
  is_required: boolean;
  points?: number;
  late_penalty?: number;
  block_enabled?: boolean;
  block_threshold?: number;
  required_fields?: string[];
  status: 'upcoming' | 'open' | 'closed';
  submitted_teams: number;
  unsubmitted_teams: number;
  created_at: string;
}

interface TeamSubmissionDetail {
  team_id: string;
  team_name: string;
  submitted: boolean;
  submission_url?: string;
  submitted_at?: string;
  submitted_by_name?: string;
  note?: string;
  version: number;
  custom_fields?: Record<string, any>;
  score_awarded?: number;
  is_late?: boolean;
}

const AVAILABLE_FIELDS = [
  { id: 'repo_url', label: 'Link Repository (GitHub/GitLab)' },
  { id: 'slide_url', label: 'Link Slide Thuyết Trình' },
  { id: 'video_url', label: 'Link Video Demo / Pitch' },
  { id: 'project_title', label: 'Tên Đề Án / Dự Án' },
  { id: 'idea_summary', label: 'Ý Tưởng & Giải Pháp Hướng Đến' },
];

export const AdminCheckpointPanel: React.FC = () => {
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form modal state (Create / Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    open_at: '',
    close_at: '',
    display_order: 0,
    is_required: true,
    points: 10,
    late_penalty: 2,
    block_enabled: false,
    block_threshold: 2,
    required_fields: ['repo_url'],
  });
  const [submitting, setSubmitting] = useState(false);

  // Submissions detail modal
  const [selectedCp, setSelectedCp] = useState<CheckpointItem | null>(null);
  const [submissionsList, setSubmissionsList] = useState<TeamSubmissionDetail[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const fetchCheckpoints = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/checkpoints');
      if (res.data?.success) {
        setCheckpoints(res.data.data);
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Không thể tải danh sách checkpoint.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckpoints();
  }, []);

  const openCreateModal = () => {
    const now = new Date();
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      open_at: now.toISOString().slice(0, 16),
      close_at: future.toISOString().slice(0, 16),
      display_order: checkpoints.length + 1,
      is_required: true,
      points: 10,
      late_penalty: 2,
      block_enabled: false,
      block_threshold: 2,
      required_fields: ['repo_url', 'project_title'],
    });
    setShowModal(true);
  };

  const openEditModal = (cp: CheckpointItem) => {
    setEditingId(cp.id);
    setFormData({
      name: cp.name,
      description: cp.description || '',
      open_at: new Date(cp.open_at).toISOString().slice(0, 16),
      close_at: new Date(cp.close_at).toISOString().slice(0, 16),
      display_order: cp.display_order,
      is_required: cp.is_required,
      points: cp.points ?? 10,
      late_penalty: cp.late_penalty ?? 2,
      block_enabled: cp.block_enabled ?? false,
      block_threshold: cp.block_threshold ?? 2,
      required_fields: cp.required_fields && cp.required_fields.length > 0 ? cp.required_fields : ['repo_url'],
    });
    setShowModal(true);
  };

  const toggleRequiredField = (fieldId: string) => {
    setFormData((prev) => {
      const exists = prev.required_fields.includes(fieldId);
      if (exists) {
        return { ...prev, required_fields: prev.required_fields.filter((f) => f !== fieldId) };
      } else {
        return { ...prev, required_fields: [...prev.required_fields, fieldId] };
      }
    });
  };

  const handleSaveCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      open_at: new Date(formData.open_at).toISOString(),
      close_at: new Date(formData.close_at).toISOString(),
      display_order: Number(formData.display_order),
      is_required: Boolean(formData.is_required),
      points: Number(formData.points),
      late_penalty: Number(formData.late_penalty),
      block_enabled: Boolean(formData.block_enabled),
      block_threshold: Number(formData.block_threshold),
      required_fields: formData.required_fields,
    };

    try {
      if (editingId) {
        await apiClient.put(`/admin/checkpoints/${editingId}`, payload);
        setMessage({ type: 'success', text: 'Đã cập nhật checkpoint thành công.' });
      } else {
        await apiClient.post('/admin/checkpoints', payload);
        setMessage({ type: 'success', text: 'Đã tạo checkpoint mới thành công.' });
      }
      setShowModal(false);
      fetchCheckpoints();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Thao tác thất bại. Vui lòng kiểm tra lại.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCheckpoint = async (id: string, name: string) => {
    if (!window.confirm(`Xác nhận XÓA checkpoint "${name}"? Toàn bộ bài nộp của checkpoint này cũng sẽ bị xóa.`)) {
      return;
    }
    try {
      await apiClient.delete(`/admin/checkpoints/${id}`);
      setMessage({ type: 'success', text: `Đã xóa checkpoint "${name}".` });
      fetchCheckpoints();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Xóa thất bại.' });
    }
  };

  const handleViewSubmissions = async (cp: CheckpointItem) => {
    setSelectedCp(cp);
    setLoadingSubs(true);
    try {
      const res = await apiClient.get(`/admin/checkpoints/${cp.id}/submissions`);
      if (res.data?.success) {
        setSubmissionsList(res.data.data);
      }
    } catch (err: any) {
      console.error(err);
      alert('Không thể tải chi tiết bài nộp.');
    } finally {
      setLoadingSubs(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Flag className="w-5 h-5 text-emerald-400" />
            <span>Quản Lý Checkpoints &amp; Điểm Tiến Độ</span>
          </h2>
          <p className="text-sm text-slate-400">
            Cấu hình thời gian, thang điểm thưởng/trừ, trường yêu cầu nộp bài và giám sát tiến độ nộp bài của các đội.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchCheckpoints}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-950/50 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Checkpoint Mới</span>
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

      {/* Checkpoints Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-mono tracking-wider">
              <tr>
                <th className="px-6 py-3">STT</th>
                <th className="px-6 py-3">Tên &amp; Yêu Cầu Nộp</th>
                <th className="px-6 py-3">Điểm / Trừ Hạn</th>
                <th className="px-6 py-3">Thời Gian Mở / Đóng</th>
                <th className="px-6 py-3">Trạng Thái</th>
                <th className="px-6 py-3">Tiến Độ Nộp</th>
                <th className="px-6 py-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-400"></div>
                  </td>
                </tr>
              ) : checkpoints.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    Chưa có checkpoint nào. Hãy nhấn "Tạo Checkpoint Mới" để bắt đầu.
                  </td>
                </tr>
              ) : (
                checkpoints.map((cp) => {
                  const total = cp.submitted_teams + cp.unsubmitted_teams;
                  const pct = total > 0 ? Math.round((cp.submitted_teams / total) * 100) : 0;
                  return (
                    <tr key={cp.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400">
                        #{cp.display_order}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{cp.name}</div>
                        {cp.description && (
                          <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                            {cp.description}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {cp.required_fields && cp.required_fields.map((rf, idx) => (
                            <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              {rf}
                            </span>
                          ))}
                          {cp.block_enabled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-semibold flex items-center space-x-1">
                              <ShieldAlert className="w-3 h-3" />
                              <span>Block {cp.block_threshold}x</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-emerald-400 font-bold">
                          +{cp.points ?? 10}đ đúng hạn
                        </div>
                        {(cp.late_penalty ?? 0) > 0 && (
                          <div className="font-mono text-[11px] text-amber-400">
                            -{cp.late_penalty}đ nếu muộn
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono space-y-0.5 text-slate-400">
                        <div className="flex items-center space-x-1 text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{new Date(cp.open_at).toLocaleString('vi-VN')}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-rose-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{new Date(cp.close_at).toLocaleString('vi-VN')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                            cp.status === 'open'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : cp.status === 'upcoming'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {cp.status === 'open'
                            ? 'Đang mở'
                            : cp.status === 'upcoming'
                            ? 'Sắp mở'
                            : 'Đã đóng'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-32 space-y-1">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-slate-300 font-bold">{cp.submitted_teams} đội</span>
                            <span className="text-slate-500">/{total} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct === 100
                                  ? 'bg-emerald-500'
                                  : pct >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5">
                        <button
                          onClick={() => handleViewSubmissions(cp)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition"
                          title="Xem chi tiết bài nộp"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(cp)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition"
                          title="Sửa checkpoint"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCheckpoint(cp.id, cp.name)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 hover:text-rose-300 transition"
                          title="Xóa checkpoint"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Modal: Create / Edit Checkpoint */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Flag className="w-5 h-5 text-emerald-400" />
                <span>{editingId ? 'Cập Nhật Checkpoint' : 'Tạo Checkpoint Mới'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCheckpoint} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tên Checkpoint *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Checkpoint 1: Đề Cương & Kiến Trúc Dự Án"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mô tả yêu cầu
                </label>
                <textarea
                  rows={2}
                  placeholder="Yêu cầu cụ thể: Mô tả mục tiêu, tiêu chuẩn đánh giá..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Điểm & Quy chế phạt nộp muộn */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <span>Cơ Chế Điểm Thưởng &amp; Phạt Muộn</span>
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Điểm Nộp Đúng Hạn:
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={formData.points}
                      onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Trừ Điểm Nộp Muộn:
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={formData.late_penalty}
                      onChange={(e) => setFormData({ ...formData, late_penalty: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="block_enabled"
                      checked={formData.block_enabled}
                      onChange={(e) => setFormData({ ...formData, block_enabled: e.target.checked })}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-rose-600 focus:ring-0"
                    />
                    <label htmlFor="block_enabled" className="text-xs text-slate-300 font-semibold cursor-pointer">
                      Tự động Block đội bỏ nộp bài
                    </label>
                  </div>
                  {formData.block_enabled && (
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] text-slate-400">Sau:</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={formData.block_threshold}
                        onChange={(e) => setFormData({ ...formData, block_threshold: Number(e.target.value) })}
                        className="w-14 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                      <span className="text-[11px] text-slate-400">lần liên tiếp</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Các trường bắt buộc nộp */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <ListChecks className="w-4 h-4 text-blue-400" />
                  <span>Các Trường Bắt Buộc Nhóm Phải Nộp</span>
                </span>
                <p className="text-[11px] text-slate-400">
                  Chọn các trường dữ liệu hệ thống sẽ yêu cầu nhóm điền khi nộp bài checkpoint này:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {AVAILABLE_FIELDS.map((f) => {
                    const isChecked = formData.required_fields.includes(f.id);
                    return (
                      <label
                        key={f.id}
                        className={`flex items-center space-x-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                          isChecked
                            ? 'bg-blue-600/10 border-blue-500/40 text-blue-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRequiredField(f.id)}
                          className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                        />
                        <span>{f.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Thời gian mở nộp *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.open_at}
                    onChange={(e) => setFormData({ ...formData, open_at: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Hạn chót (Deadline) *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.close_at}
                    onChange={(e) => setFormData({ ...formData, close_at: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Thứ tự hiển thị
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <input
                    type="checkbox"
                    id="is_required"
                    checked={formData.is_required}
                    onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-emerald-600 focus:ring-0"
                  />
                  <label htmlFor="is_required" className="text-xs text-slate-300 font-semibold cursor-pointer">
                    Bắt buộc nộp bài
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-950/40"
                >
                  {submitting ? 'Đang lưu...' : editingId ? 'Lưu Thay Đổi' : 'Tạo Checkpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Submissions Detail */}
      {selectedCp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Eye className="w-5 h-5 text-blue-400" />
                  <span>Chi Tiết Nộp Bài: {selectedCp.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Đã nộp: {submissionsList.filter((s) => s.submitted).length} / {submissionsList.length} đội | Điểm chuẩn: +{selectedCp.points ?? 10}đ
                </p>
              </div>
              <button
                onClick={() => setSelectedCp(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Tên Đội</th>
                    <th className="px-4 py-2.5">Trạng Thái</th>
                    <th className="px-4 py-2.5">Điểm Nhận</th>
                    <th className="px-4 py-2.5">Link / Dữ Liệu Nộp</th>
                    <th className="px-4 py-2.5">Người Nộp &amp; Thời Gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loadingSubs ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                      </td>
                    </tr>
                  ) : submissionsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Chưa có đội nào trong hệ thống.
                      </td>
                    </tr>
                  ) : (
                    submissionsList.map((item) => (
                      <tr key={item.team_id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-semibold text-white">{item.team_name}</td>
                        <td className="px-4 py-3">
                          {item.submitted ? (
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                                ĐÃ NỘP (v{item.version})
                              </span>
                              {item.is_late && (
                                <span className="block text-[10px] font-bold text-amber-400">
                                  ⚠️ Nộp muộn
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800">
                              CHƯA NỘP
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {item.score_awarded !== undefined && item.score_awarded !== null ? (
                            <span className="font-bold text-emerald-400">
                              +{item.score_awarded}đ
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.submission_url && (
                            <div className="font-mono mb-1">
                              <a
                                href={item.submission_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline inline-flex items-center space-x-1"
                              >
                                <span className="max-w-[200px] truncate">{item.submission_url}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            </div>
                          )}
                          {item.custom_fields && Object.keys(item.custom_fields).length > 0 && (
                            <div className="space-y-0.5 text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                              {Object.entries(item.custom_fields).map(([k, v]) => (
                                <div key={k}>
                                  <strong className="text-slate-300">{k}:</strong> {String(v)}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          <div>{item.submitted_by_name || '—'}</div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {item.submitted_at ? new Date(item.submitted_at).toLocaleString('vi-VN') : '—'}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 shrink-0">
              <button
                onClick={() => setSelectedCp(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
