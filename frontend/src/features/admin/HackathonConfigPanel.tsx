import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { Settings, Eye, EyeOff, Lock, Unlock, CheckCircle, AlertCircle, Users, Award, Trash2, RefreshCw } from 'lucide-react';

interface HackathonConfig {
  id: number;
  name: string;
  description?: string;
  min_team_size: number;
  max_team_size: number;
  blind_judging: boolean;
  results_published: boolean;
  ticket_enabled: boolean;
  registration_start: string;
  registration_end: string;
  contest_start: string;
  contest_end: string;
  topic_selection_deadline?: string;
}

interface ScoringCriteria {
  id: string;
  name: string;
  description?: string;
  max_score: number;
  weight: number;
  display_order: number;
  is_active: boolean;
}

export const HackathonConfigPanel: React.FC<{ criteriaOnly?: boolean }> = ({ criteriaOnly = false }) => {
  const [config, setConfig] = useState<HackathonConfig | null>(null);
  const [criteria, setCriteria] = useState<ScoringCriteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Criteria form state
  const [newCriteriaName, setNewCriteriaName] = useState('');
  const [newCriteriaDesc, setNewCriteriaDesc] = useState('');
  const [newCriteriaMaxScore, setNewCriteriaMaxScore] = useState(10);
  const [newCriteriaWeight, setNewCriteriaWeight] = useState(0.25);
  const [addingCriteria, setAddingCriteria] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, criteriaRes] = await Promise.all([
        apiClient.get('/admin/config'),
        apiClient.get('/scoring/criteria'),
      ]);
      if (configRes.data?.success) setConfig(configRes.data.data);
      if (criteriaRes.data?.success) setCriteria(criteriaRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (field: keyof HackathonConfig, value: boolean) => {
    // FIX BUG-42: Guard khi config chưa load — không gửi giá trị sai
    if (!config) {
      setMessage({ type: 'error', text: 'Cấu hình chưa được tải. Vui lòng đợi hoặc refresh.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiClient.put('/admin/config', { [field]: value });
      if (res.data?.success) {
        setConfig(res.data.data);
        setMessage({ type: 'success', text: `Đã cập nhật: ${field} = ${value}` });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Cập nhật thất bại.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddCriteria = async (e: React.FormEvent) => {
    e.preventDefault();

    // FIX BUG-43: Validate tổng weight trước khi submit
    const currentTotalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    const newTotal = currentTotalWeight + newCriteriaWeight;
    if (newTotal > 1.001) { // epsilon nhỏ để tránh floating point
      setMessage({
        type: 'error',
        text: `Tổng trọng số sẽ vượt quá 100% (hiện tại ${(currentTotalWeight * 100).toFixed(0)}% + ${(newCriteriaWeight * 100).toFixed(0)}% = ${(newTotal * 100).toFixed(0)}%). Hãy giảm trọng số.`,
      });
      return;
    }

    setAddingCriteria(true);
    setMessage(null);
    try {
      const res = await apiClient.post('/admin/criteria', {
        name: newCriteriaName.trim(),
        description: newCriteriaDesc.trim() || undefined,
        max_score: newCriteriaMaxScore,
        weight: newCriteriaWeight,
        display_order: criteria.length,
      });
      if (res.data?.success) {
        setMessage({ type: 'success', text: `Đã thêm tiêu chí: "${newCriteriaName}"` });
        setTimeout(() => setMessage(null), 3000);
        setNewCriteriaName('');
        setNewCriteriaDesc('');
        setNewCriteriaMaxScore(10);
        setNewCriteriaWeight(0.25);
        await loadData();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Thêm tiêu chí thất bại.' });
    } finally {
      setAddingCriteria(false);
    }
  };

  const handleDeleteCriteria = async (id: string, name: string) => {
    if (!window.confirm(`Xác nhận xóa tiêu chí "${name}"?`)) return;
    try {
      await apiClient.delete(`/admin/criteria/${id}`);
      setMessage({ type: 'success', text: `Đã xóa tiêu chí "${name}".` });
      await loadData();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Xóa tiêu chí thất bại.' });
    }
  };

  const handleUpdateWeight = async (id: string, newPct: number) => {
    try {
      const weightVal = Math.max(0.01, Math.min(1.0, newPct / 100));
      await apiClient.put(`/admin/criteria/${id}`, { weight: weightVal });
      await loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Cập nhật trọng số thất bại.' });
    }
  };

  const handleRebalanceAll = async () => {
    try {
      await apiClient.put('/admin/criteria/rebalance/all');
      setMessage({ type: 'success', text: 'Đã tự động cân bằng lại toàn bộ trọng số tiêu chí (tổng = 100%).' });
      await loadData();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Cân bằng thất bại.' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-400" />
      </div>
    );
  }

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);

  return (
    <div className="space-y-6">
      {!criteriaOnly && (
        <div className="flex items-center space-x-2 mb-2">
          <Settings className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-bold text-white">Cấu hình Cuộc thi</h2>
        </div>
      )}
      {criteriaOnly && (
        <div className="flex items-center space-x-2 mb-2">
          <Award className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-bold text-white">Tiêu Chí Chấm Điểm</h2>
        </div>
      )}

      {message && (
        <div
          className={`flex items-center space-x-2 p-3 rounded-xl border text-sm ${
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

      {/* Toggle Controls — chỉ hiển thị trong tab Cấu hình */}
      {!criteriaOnly && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Blind Judging */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-start justify-between space-x-3">
          <div>
            <div className="text-sm font-semibold text-white flex items-center space-x-1.5">
              {config?.blind_judging ? (
                <EyeOff className="w-4 h-4 text-purple-400" />
              ) : (
                <Eye className="w-4 h-4 text-slate-400" />
              )}
              <span>Chấm mù (Blind Judging)</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Ẩn tên đội với giám khảo khi bật.</p>
          </div>
          <button
            onClick={() => handleToggle('blind_judging', !config?.blind_judging)}
            disabled={saving}
            className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config?.blind_judging ? 'bg-purple-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config?.blind_judging ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Results Published */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-start justify-between space-x-3">
          <div>
            <div className="text-sm font-semibold text-white flex items-center space-x-1.5">
              {config?.results_published ? (
                <Unlock className="w-4 h-4 text-emerald-400" />
              ) : (
                <Lock className="w-4 h-4 text-slate-400" />
              )}
              <span>Công bố kết quả</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Tất cả thí sinh xem được bảng xếp hạng.</p>
          </div>
          <button
            onClick={() => handleToggle('results_published', !config?.results_published)}
            disabled={saving}
            className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config?.results_published ? 'bg-emerald-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config?.results_published ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Ticket Enabled */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-start justify-between space-x-3">
          <div>
            <div className="text-sm font-semibold text-white flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-teal-400" />
              <span>Hỗ trợ Ticket</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Cho phép đội thi gửi yêu cầu hỗ trợ.</p>
          </div>
          <button
            onClick={() => handleToggle('ticket_enabled', !config?.ticket_enabled)}
            disabled={saving}
            className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              config?.ticket_enabled ? 'bg-teal-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config?.ticket_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
      )} {/* end !criteriaOnly toggles */}

      {/* Scoring Criteria Management */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Danh sách tiêu chí chấm điểm</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Điều chỉnh trọng số (%) của từng tiêu chí hoặc bấm cân bằng tự động để tổng đúng 100%.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleRebalanceAll}
              className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold border border-purple-500/30 transition"
              title="Chia đều 100% cho tất cả tiêu chí"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Cân Bằng Trọng Số (100%)</span>
            </button>
            <span
              className={`text-xs font-mono px-2.5 py-1 rounded-lg border font-bold ${
                Math.abs(totalWeight - 1.0) < 0.01
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border-amber-800 animate-pulse'
              }`}
            >
              Tổng: {(totalWeight * 100).toFixed(0)}%
              {Math.abs(totalWeight - 1.0) < 0.01 ? ' ✓' : ' (Cần = 100%)'}
            </span>
          </div>
        </div>

        {criteria.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6 bg-slate-900/50 rounded-xl">
            Chưa có tiêu chí nào. Thêm tiêu chí mới bên dưới.
          </p>
        ) : (
          <div className="space-y-2.5 mb-5">
            {criteria.map((c) => (
              <div
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">{c.name}</span>
                    <span className="font-mono text-purple-400 font-semibold">({c.max_score} điểm tối đa)</span>
                  </div>
                  {c.description && <p className="text-slate-400 mt-1">{c.description}</p>}
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <label className="text-slate-400 text-[11px] font-semibold">Trọng số:</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      defaultValue={Math.round(c.weight * 100)}
                      onBlur={(e) => {
                        const val = Number(e.target.value);
                        if (val > 0 && val <= 100) {
                          handleUpdateWeight(c.id, val);
                        }
                      }}
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs font-mono font-bold text-white focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-slate-400 font-bold">%</span>
                  </div>

                  <button
                    onClick={() => handleDeleteCriteria(c.id, c.name)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400 transition"
                    title="Xóa tiêu chí này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add new criteria */}
        <form onSubmit={handleAddCriteria} className="border-t border-slate-800 pt-4 space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Thêm tiêu chí mới</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Tên tiêu chí (VD: Đổi mới & Sáng tạo)"
              value={newCriteriaName}
              onChange={(e) => setNewCriteriaName(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Mô tả ngắn (tùy chọn)"
              value={newCriteriaDesc}
              onChange={(e) => setNewCriteriaDesc(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <div className="flex items-center space-x-2">
              <label className="text-xs text-slate-400 shrink-0">Điểm tối đa:</label>
              <input
                type="number"
                required
                min={1}
                max={100}
                value={newCriteriaMaxScore}
                onChange={(e) => setNewCriteriaMaxScore(Number(e.target.value))}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs text-slate-400 shrink-0">Trọng số (0-1):</label>
              <input
                type="number"
                required
                min={0.01}
                max={1}
                step={0.05}
                value={newCriteriaWeight}
                onChange={(e) => setNewCriteriaWeight(Number(e.target.value))}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={addingCriteria}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition"
          >
            {addingCriteria ? 'Đang thêm...' : '+ Thêm tiêu chí'}
          </button>
        </form>
      </div>
    </div>
  );
};
