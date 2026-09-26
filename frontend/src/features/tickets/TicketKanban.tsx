import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { Ticket, TicketMessage, Team } from '../../types';
import {
  LifeBuoy,
  Plus,
  UserCheck,
  MessageSquare,
  CheckCircle,
  Send,
  Filter,
  Lock,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

// Priority display helpers
const PRIORITY_BADGE: Record<string, string> = {
  high:   'bg-rose-50 text-rose-700 border-rose-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low:    'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const PRIORITY_LABEL: Record<string, string> = {
  high: '🔴 Cao',
  medium: '🟡 Trung bình',
  low: '🟢 Thấp',
};

export const TicketKanban: React.FC = () => {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // Active ticket for details/chat modal
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Inline error banner
  const [inlineError, setInlineError] = useState<string | null>(null);

  // New ticket modal (participant only)
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [creatingTicket, setCreatingTicket] = useState(false);

  const [myTeam, setMyTeam] = useState<Team | null>(null);

  // Priority filter (mentor/admin)
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const isMentor = user?.role === 'mentor' || user?.role === 'admin';

  const fetchTickets = async () => {
    try {
      const res = await apiClient.get('/tickets');
      if (res.data?.success) {
        setTickets(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    if (user?.role === 'participant') {
      apiClient.get('/teams/my-team').then(res => {
        if (res.data?.success && res.data.data) {
          setMyTeam(res.data.data);
        }
      }).catch(() => null);
    }
  }, [user]);

  const showError = (msg: string) => {
    setInlineError(msg);
    setTimeout(() => setInlineError(null), 5000);
  };

  const handleClaimTicket = async (ticketId: string) => {
    setInlineError(null);
    try {
      const res = await apiClient.post(`/tickets/${ticketId}/claim`);
      if (res.data?.success) {
        await fetchTickets();
        if (activeTicket?.id === ticketId) {
          setActiveTicket(res.data.data);
        }
      }
    } catch (err: any) {
      showError(err.response?.data?.detail || err.response?.data?.error?.message || 'Không thể nhận ticket. Vui lòng thử lại.');
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    setInlineError(null);
    try {
      const res = await apiClient.post(`/tickets/${ticketId}/resolve`);
      if (res.data?.success) {
        await fetchTickets();
        if (activeTicket?.id === ticketId) {
          setActiveTicket((prev) => prev ? { ...prev, status: 'resolved' } : null);
        }
      }
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Không thể hoàn tất ticket.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !chatMessage.trim()) return;

    setSendingMsg(true);
    setInlineError(null);
    try {
      const res = await apiClient.post(`/tickets/${activeTicket.id}/messages`, {
        content: chatMessage.trim(),
      });
      if (res.data?.success) {
        const newMsg: TicketMessage = res.data.data;
        setActiveTicket({
          ...activeTicket,
          messages: [...(activeTicket.messages || []), newMsg],
        });
        setChatMessage('');
        fetchTickets(); // không cần await
      }
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Gửi tin nhắn thất bại. Kiểm tra kết nối mạng.');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingTicket(true);
    setInlineError(null);
    try {
      // Lấy team_id từ user (nếu participant)
      const meRes = await apiClient.get('/users/me');
      const teamId = meRes.data?.data?.team_id;
      if (!teamId) {
        showError('Bạn chưa thuộc nhóm nào. Hãy tạo hoặc tham gia nhóm trước.');
        return;
      }

      const res = await apiClient.post(`/tickets?team_id=${teamId}`, {
        title: newTitle,
        description: newDescription,
        priority: newPriority,
      });
      if (res.data?.success) {
        setShowNewModal(false);
        setNewTitle('');
        setNewDescription('');
        setNewPriority('medium');
        fetchTickets();
      }
    } catch (err: any) {
      showError(err.response?.data?.detail || err.response?.data?.error?.message || 'Tạo ticket thất bại');
    } finally {
      setCreatingTicket(false);
    }
  };

  // FIX BUG-M1: dùng 'open' thay vì 'pending'
  const openTickets = tickets.filter((t) => t.status === 'open');
  const inProgressTickets = tickets.filter((t) => t.status === 'in_progress');
  const resolvedTickets = tickets.filter((t) => t.status === 'resolved' || t.status === 'cancelled');

  // Priority filter (mentor/admin only, applies to open pool)
  const filteredOpen = priorityFilter === 'all'
    ? openTickets
    : openTickets.filter((t) => t.priority === priorityFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
            <LifeBuoy className="w-4 h-4" />
            <span>Kênh Điều Phối Hỗ Trợ Kỹ Thuật • VinUni AI</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900">Điều Phối &amp; Xử Lý Tickets</h1>
          <p className="text-sm text-slate-600">
            Hệ thống điều phối Ticket tập trung kết nối thí sinh với đội ngũ Cố vấn chuyên môn Vingroup.
          </p>
        </div>

        {user?.role === 'participant' && (
          !myTeam ? (
            <Link
              to="/team"
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition-none shadow-2xs"
            >
              <Lock className="w-4 h-4" />
              <span>Cần tham gia đội để tạo ticket</span>
            </Link>
          ) : (
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-none"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Yêu Cầu Hỗ Trợ</span>
            </button>
          )
        )}
      </div>

      {/* Notice Banner for participants without a team */}
      {user?.role === 'participant' && !myTeam && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-700 shadow-xs">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-900">
                Kênh hỗ trợ chuyên môn của Ban Tổ Chức &amp; Mentor
              </div>
              <div className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Bạn chưa tham gia đội thi nào. Bạn có thể theo dõi tiến trình các yêu cầu hỗ trợ chung bên dưới. Để gửi ticket yêu cầu Mentor hỗ trợ giải quyết vấn đề kỹ thuật cho đội của mình, bạn cần lập hoặc tham gia một đội thi.
              </div>
            </div>
          </div>
          <Link
            to="/team"
            className="shrink-0 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-none shadow-xs"
          >
            <span>Tạo / Tham gia đội</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Priority Filter — mentor/admin only */}
      {isMentor && (
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-600 font-bold">Lọc ưu tiên:</span>
          {(['all', 'high', 'medium', 'low'] as const).map((p) => {
            const isSelected = priorityFilter === p;
            return (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1 rounded-full text-xs border transition-none font-semibold ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 border-blue-300 font-bold shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {p === 'all' ? 'Tất cả' : PRIORITY_LABEL[p]}
              </button>
            );
          })}
        </div>
      )}

      {/* Inline error banner */}
      {inlineError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between shadow-xs">
          <span>{inlineError}</span>
          <button onClick={() => setInlineError(null)} className="text-rose-500 hover:text-rose-700 ml-4 text-base font-bold leading-none">×</button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Column 1: Open / Chờ tiếp nhận */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-3xl p-4 flex flex-col shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Chờ tiếp nhận</h2>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {filteredOpen.length}
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
            {filteredOpen.map((t) => (
              <div
                key={t.id}
                onClick={() => setActiveTicket(t)}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md cursor-pointer transition-none space-y-3 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2">{t.title}</h3>
                  <span className={`shrink-0 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border font-semibold ${PRIORITY_BADGE[t.priority] || PRIORITY_BADGE.medium}`}>
                    {PRIORITY_LABEL[t.priority] || t.priority}
                  </span>
                </div>
                {t.team_name && (
                  <p className="text-[11px] text-slate-500">Đội: <span className="text-slate-800 font-bold">{t.team_name}</span></p>
                )}
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{t.description}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                  <span>{new Date(t.created_at).toLocaleString('vi-VN')}</span>
                  {isMentor && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClaimTicket(t.id);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold flex items-center space-x-1 transition-none"
                    >
                      <UserCheck className="w-3 h-3" />
                      <span>Nhận hỗ trợ</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredOpen.length === 0 && (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">
                {priorityFilter !== 'all' ? 'Không có ticket nào với mức ưu tiên này' : 'Không có ticket nào chờ tiếp nhận'}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: In Progress */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-3xl p-4 flex flex-col shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Đang hỗ trợ</h2>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {inProgressTickets.length}
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
            {inProgressTickets.map((t) => (
              <div
                key={t.id}
                onClick={() => setActiveTicket(t)}
                className="p-4 rounded-2xl bg-white border border-amber-200 hover:border-amber-400 hover:shadow-md cursor-pointer transition-none space-y-3 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2">{t.title}</h3>
                  <span className={`shrink-0 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border font-semibold ${PRIORITY_BADGE[t.priority] || PRIORITY_BADGE.medium}`}>
                    {PRIORITY_LABEL[t.priority] || t.priority}
                  </span>
                </div>
                {t.team_name && (
                  <p className="text-[11px] text-slate-500">Đội: <span className="text-slate-800 font-bold">{t.team_name}</span></p>
                )}
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{t.description}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span className="text-amber-700 font-bold">
                    Mentor: {t.assigned_mentor?.full_name || 'Đã tiếp nhận'}
                  </span>
                  <div className="flex items-center space-x-1 text-slate-400 font-semibold">
                    <MessageSquare className="w-3 h-3" />
                    <span>{t.messages?.length || 0}</span>
                  </div>
                </div>
              </div>
            ))}
            {inProgressTickets.length === 0 && (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">Chưa có ticket nào đang xử lý</div>
            )}
          </div>
        </div>

        {/* Column 3: Resolved */}
        <div className="bg-slate-50/80 border border-slate-200 rounded-3xl p-4 flex flex-col shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Đã giải quyết</h2>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {resolvedTickets.length}
            </span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-1">
            {resolvedTickets.map((t) => (
              <div
                key={t.id}
                onClick={() => setActiveTicket(t)}
                className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 cursor-pointer transition-none space-y-3 opacity-90 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-800 line-clamp-2">{t.title}</h3>
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
                {t.team_name && (
                  <p className="text-[11px] text-slate-500">Đội: {t.team_name}</p>
                )}
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{t.description}</p>
                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex justify-between">
                  <span>
                    Hoàn tất: {new Date(t.resolved_at || t.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>
            ))}
            {resolvedTickets.length === 0 && (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">Chưa có ticket nào hoàn tất</div>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Details & Chat Modal */}
      {activeTicket && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2 mb-1">
                  <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border font-semibold ${PRIORITY_BADGE[activeTicket.priority] || PRIORITY_BADGE.medium}`}>
                    {PRIORITY_LABEL[activeTicket.priority] || activeTicket.priority}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Trạng thái: <span className="text-slate-900 font-bold">{activeTicket.status}</span>
                  </span>
                  {activeTicket.team_name && (
                    <span className="text-xs text-slate-500 font-medium">
                      Đội: <span className="text-blue-700 font-bold">{activeTicket.team_name}</span>
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-900">{activeTicket.title}</h3>
              </div>
              <button onClick={() => setActiveTicket(null)} className="text-slate-400 hover:text-slate-700 ml-4 shrink-0 text-lg">✕</button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Mô tả vấn đề:</div>
                <p className="text-xs text-slate-700 leading-relaxed">{activeTicket.description}</p>
              </div>

              {/* Chat Thread */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Trao đổi trực tiếp ({activeTicket.messages?.length || 0} tin nhắn)
                </div>
                {activeTicket.messages?.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-400 italic">Chưa có tin nhắn nào</div>
                )}
                {activeTicket.messages?.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                          isMine
                            ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                            : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className="text-[10px] opacity-75 font-semibold mb-0.5">
                          {isMine ? 'Bạn' : msg.sender?.full_name || 'Người gửi'}
                        </div>
                        <div>{msg.content}</div>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1">
                        {new Date(msg.sent_at || msg.created_at || '').toLocaleTimeString('vi-VN')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/70 space-y-3">
              {activeTicket.status !== 'resolved' && activeTicket.status !== 'cancelled' && (
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <input
                    type="text"
                    required
                    placeholder="Nhập nội dung phản hồi hoặc hướng dẫn..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                  />
                  <button
                    type="submit"
                    disabled={sendingMsg}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 transition-none shadow-xs flex items-center space-x-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi</span>
                  </button>
                </form>
              )}

              <div className="flex justify-between items-center pt-1">
                <div>
                  {isMentor && activeTicket.status === 'open' && (
                    <button
                      onClick={() => handleClaimTicket(activeTicket.id)}
                      className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold transition-none shadow-2xs"
                    >
                      Tiếp nhận Ticket Này
                    </button>
                  )}
                  {isMentor && activeTicket.status === 'in_progress' && (
                    <button
                      onClick={() => {
                        if (window.confirm('Xác nhận đánh dấu ticket này là Đã Giải Quyết?\nTeam sẽ không thể gửi thêm tin nhắn sau khi đóng.')) {
                          handleResolveTicket(activeTicket.id);
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-none shadow-2xs"
                    >
                      Đánh dấu Đã Giải Quyết ✓
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setActiveTicket(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-none"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create New Ticket Modal (participant only) */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 flex items-center space-x-2">
                <LifeBuoy className="w-5 h-5 text-blue-600" />
                <span>Tạo Yêu Cầu Hỗ Trợ (Ticket)</span>
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-700 text-lg">✕</button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề yêu cầu *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lỗi cấu hình Docker / Thắc mắc nghiệp vụ..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mức độ ưu tiên *</label>
                <div className="flex space-x-2">
                  {(['high', 'medium', 'low'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-none ${
                        newPriority === p
                          ? PRIORITY_BADGE[p]
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả chi tiết khó khăn *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Mô tả cụ thể lỗi gặp phải hoặc câu hỏi cần cố vấn hướng dẫn..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-none"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creatingTicket}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-none shadow-xs"
                >
                  {creatingTicket ? 'Đang gửi...' : 'Gửi Yêu Cầu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
