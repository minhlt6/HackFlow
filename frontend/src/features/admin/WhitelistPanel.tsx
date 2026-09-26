import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { CheckCircle, Trash2, Plus, RefreshCw, AlertCircle, Mail, Shield } from 'lucide-react';

interface WhitelistEntry {
  id: string;
  email: string;
  used: boolean;
  note?: string;
  created_at: string;
}

export const WhitelistPanel: React.FC = () => {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkText, setBulkText] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const msgTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get('/admin/whitelist');
        if (!cancelled && res.data?.success) setEntries(res.data.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current); };
  }, []);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(() => setMessage(null), 5000);
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/whitelist');
      if (res.data?.success) setEntries(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBulk = async () => {
    const emails = bulkText
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes('@'));

    if (emails.length === 0) {
      showMsg('error', 'Không tìm thấy email hợp lệ. Mỗi dòng 1 email hoặc cách nhau bởi dấu phẩy.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiClient.post('/admin/whitelist', { emails, note: note || undefined });
      if (res.data?.success) {
        showMsg('success', res.data.message);
        setBulkText('');
        setNote('');
        await handleRefresh();
      }
    } catch (err: any) {
      showMsg('error', err.response?.data?.detail || 'Thêm whitelist thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: WhitelistEntry) => {
    if (!window.confirm(`Xóa "${entry.email}" khỏi whitelist?`)) return;
    try {
      const res = await apiClient.delete(`/admin/whitelist/${entry.id}`);
      if (res.data?.success) {
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        showMsg('success', res.data.message);
      }
    } catch (err: any) {
      showMsg('error', err.response?.data?.detail || 'Xóa thất bại.');
    }
  };

  const usedCount = entries.filter((e) => e.used).length;
  const pendingCount = entries.length - usedCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">Email Whitelist</h2>
          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
            {entries.length} email | {usedCount} đã đăng ký | {pendingCount} chưa dùng
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Giải thích */}
      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-400/80 text-xs flex items-start space-x-2">
        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Email trong whitelist được <strong>tự động phê duyệt</strong> khi đăng ký — kể cả qua form email/password lẫn GitHub OAuth. Email không trong whitelist → tài khoản ở trạng thái <strong>pending</strong>, cần duyệt thủ công tại tab "Duyệt TK".
        </span>
      </div>

      {/* Message */}
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

      {/* Thêm bulk email */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center space-x-1.5">
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Thêm Email vào Whitelist</span>
        </h3>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">
            Danh sách email <span className="text-slate-500">(mỗi dòng 1 email, hoặc cách nhau bởi dấu phẩy)</span>
          </label>
          <textarea
            rows={5}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"sv1@hus.edu.vn\nsv2@hus.edu.vn\nsv3@gmail.com"}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Ghi chú (tùy chọn)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Danh sách sinh viên K67 đã qua vòng sơ tuyển"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button
          onClick={handleAddBulk}
          disabled={saving || !bulkText.trim()}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" />
          <span>{saving ? 'Đang thêm...' : 'Thêm vào Whitelist'}</span>
        </button>
      </div>

      {/* Danh sách */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Danh sách Whitelist</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Chưa có email nào trong whitelist.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/40">
                <div className="flex items-center space-x-3 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${e.used ? 'bg-emerald-400' : 'bg-slate-600'}`}
                    title={e.used ? 'Đã đăng ký' : 'Chưa dùng'}
                  />
                  <span className="text-sm font-mono text-slate-200 truncate">{e.email}</span>
                  {e.note && (
                    <span className="text-xs text-slate-500 truncate hidden sm:block">— {e.note}</span>
                  )}
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  {e.used ? (
                    <span className="text-[11px] text-emerald-500 font-medium">✓ Đã dùng</span>
                  ) : (
                    <span className="text-[11px] text-slate-600">Chưa dùng</span>
                  )}
                  <button
                    onClick={() => handleDelete(e)}
                    className="p-1.5 rounded hover:bg-rose-900/40 text-slate-600 hover:text-rose-400 transition"
                    title="Xóa khỏi whitelist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
