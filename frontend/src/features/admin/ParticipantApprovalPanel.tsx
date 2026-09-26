import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { UserCheck, UserX, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface PendingUser {
  id: string;
  email: string;
  full_name: string;
  student_id?: string;
  approval_status: string;
  created_at: string;
}

export const ParticipantApprovalPanel: React.FC = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null); // id đang xử lý
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const msgTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.get('/admin/pending-users');
        if (!cancelled && res.data?.success) setUsers(res.data.data);
      } catch (err) {
        if (!cancelled) console.error(err);
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
    msgTimerRef.current = setTimeout(() => setMessage(null), 4000);
  };

  const handleApprove = async (userId: string) => {
    setProcessing(userId);
    try {
      const res = await apiClient.post(`/admin/users/${userId}/approve`);
      if (res.data?.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        showMsg('success', res.data.message);
      }
    } catch (err: any) {
      showMsg('error', err.response?.data?.detail || 'Phê duyệt thất bại.');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (userId: string, email: string) => {
    if (!window.confirm(`Từ chối tài khoản "${email}"? Người dùng sẽ không thể đăng nhập.`)) return;
    setProcessing(userId);
    try {
      const res = await apiClient.post(`/admin/users/${userId}/reject`);
      if (res.data?.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        showMsg('success', res.data.message);
      }
    } catch (err: any) {
      showMsg('error', err.response?.data?.detail || 'Từ chối thất bại.');
    } finally {
      setProcessing(null);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/pending-users');
      if (res.data?.success) setUsers(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white">Duyệt Tài Khoản Thí Sinh</h2>
          {users.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/30">
              {users.length} chờ duyệt
            </span>
          )}
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

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && users.length === 0 && (
        <div className="text-center py-10 text-slate-500 text-sm bg-slate-900 rounded-xl border border-slate-800">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-500/50" />
          <p className="font-medium text-slate-400">Không có tài khoản nào đang chờ duyệt</p>
          <p className="text-xs mt-1">Tất cả đăng ký đã được xử lý.</p>
        </div>
      )}

      {/* Danh sách */}
      {!loading && users.length > 0 && (
        <div className="space-y-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-amber-500/30 transition"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-white text-sm truncate">{u.full_name}</span>
                  {u.student_id && (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                      MSV: {u.student_id}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">{u.email}</p>
                <p className="text-[11px] text-slate-600">
                  Đăng ký: {new Date(u.created_at).toLocaleString('vi-VN')}
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => handleApprove(u.id)}
                  disabled={processing === u.id}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{processing === u.id ? '...' : 'Phê duyệt'}</span>
                </button>
                <button
                  onClick={() => handleReject(u.id, u.email)}
                  disabled={processing === u.id}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-rose-900/60 hover:bg-rose-800/60 disabled:opacity-50 text-rose-400 text-xs font-semibold border border-rose-800/50 transition"
                >
                  <UserX className="w-3.5 h-3.5" />
                  <span>Từ chối</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
