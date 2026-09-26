import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { Ticket, TicketMessage, Team } from '../../types';
import {
  LifeBuoy,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Send,
  MessageSquare,
  Users,
  RefreshCw,
  X,
  ChevronRight,
  ShieldCheck,
  User,
} from 'lucide-react';

export const ParticipantTicketPortal: React.FC = () => {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Modal create ticket state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [submitting, setSubmitting] = useState(false);

  // Chat message state
  const [chatMessage, setChatMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTicketsAndTeam = async () => {
    setLoading(true);
    try {
      const [ticketsRes, teamRes] = await Promise.allSettled([
        apiClient.get('/tickets'),
        apiClient.get('/teams/my-team').catch(() => null),
      ]);

      if (ticketsRes.status === 'fulfilled' && ticketsRes.value?.data?.success) {
        setTickets(ticketsRes.value.data.data);
      }
      if (teamRes.status === 'fulfilled' && teamRes.value?.data?.success && teamRes.value.data.data) {
        setMyTeam(teamRes.value.data.data);
      }
    } catch (err) {
      console.error('Cannot load participant tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketsAndTeam();
  }, []);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      showNotice('error', 'Vui lòng điền đầy đủ tiêu đề và nội dung cần hỗ trợ.');
      return;
    }

    setSubmitting(true);
    try {
      const queryParam = myTeam?.id ? `?team_id=${myTeam.id}` : '';
      const res = await apiClient.post(`/tickets${queryParam}`, {
        title: title.trim(),
        description: description.trim(),
        priority,
      });

      if (res.data?.success) {
        showNotice('success', 'Gửi yêu cầu hỗ trợ thành công! Mentor sẽ phản hồi sớm.');
        setShowCreateModal(false);
        setTitle('');
        setDescription('');
        setPriority('medium');
        await fetchTicketsAndTeam();
      }
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || err.response?.data?.error?.message || 'Gửi ticket thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !chatMessage.trim()) return;

    setSendingMsg(true);
    try {
      const res = await apiClient.post(`/tickets/${selectedTicket.id}/messages`, {
        content: chatMessage.trim(),
      });
      if (res.data?.success) {
        const newMsg: TicketMessage = res.data.data;
        setSelectedTicket((prev: Ticket | null) =>
          prev
            ? {
                ...prev,
                messages: [...(prev.messages || []), newMsg],
              }
            : null
        );
        setChatMessage('');
        fetchTicketsAndTeam();
      }
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Không thể gửi tin nhắn.');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleCancelTicket = async (ticketId: string) => {
    if (!window.confirm('Bạn có chắc muốn hủy ticket yêu cầu này?')) return;
    try {
      const res = await apiClient.post(`/tickets/${ticketId}/cancel`);
      if (res.data?.success) {
        showNotice('success', 'Đã hủy ticket hỗ trợ.');
        await fetchTicketsAndTeam();
        setSelectedTicket(null);
      }
    } catch (err: any) {
      showNotice('error', err.response?.data?.detail || 'Không thể hủy ticket.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2 text-blue-600 text-xs font-bold uppercase tracking-wider mb-2">
            <LifeBuoy className="w-4 h-4" />
            <span>Kênh Hỗ Trợ Kỹ Thuật &amp; Chuyên Môn • VinUni AI Mentors</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900">Yêu Cầu Hỗ Trợ (Mentor Tickets)</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Gặp vấn đề về cài đặt môi trường, lỗi mô hình AI, dữ liệu bài toán hay kiến trúc hệ thống? 
            Hãy tạo ticket để kết nối trực tiếp với đội ngũ Cố vấn chuyên gia từ VinUni &amp; Vingroup.
          </p>

          <div className="flex items-center space-x-3 mt-4 text-xs text-slate-500">
            {myTeam ? (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                <Users className="w-3.5 h-3.5" />
                <span>Đội: {myTeam.name}</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                <User className="w-3.5 h-3.5" />
                <span>Thí sinh tự do (Chưa có đội)</span>
              </span>
            )}
            <span>Thời gian phản hồi thông thường: 10 - 30 phút</span>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-none shrink-0 self-start sm:self-center"
        >
          <Plus className="w-5 h-5" />
          <span>Tạo Yêu Cầu Hỗ Trợ</span>
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
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Main Grid: Tickets List & Active Chat Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Tickets List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <span>Lịch Sử Yêu Cầu Hỗ Trợ Của Bạn</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-mono">
                {tickets.length}
              </span>
            </h2>

            <button
              onClick={fetchTicketsAndTeam}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Cập nhật</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-semibold">Đang tải danh sách yêu cầu...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-3xl p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Chưa có yêu cầu hỗ trợ nào</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Khi gặp sự cố kỹ thuật hoặc cần định hướng kiến trúc bài toán AI, bạn có thể tạo ticket để trao đổi trực tiếp với Mentor.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-none shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo Ticket Đầu Tiên</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                const msgCount = t.messages?.length || 0;

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-5 rounded-2xl border transition-none cursor-pointer bg-white ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-xs'
                        : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-bold text-slate-900 hover:text-blue-600">
                            {t.title}
                          </h3>
                          {t.priority === 'high' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Khẩn cấp
                            </span>
                          )}
                          {t.priority === 'medium' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Bình thường
                            </span>
                          )}
                          {t.priority === 'low' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Thấp
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {t.description}
                        </p>
                      </div>

                      <div className="text-right shrink-0 space-y-1">
                        {t.status === 'open' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Chờ Mentor nhận</span>
                          </span>
                        )}
                        {t.status === 'in_progress' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <ShieldCheck className="w-3 h-3 text-blue-600" />
                            <span>Đang hỗ trợ</span>
                          </span>
                        )}
                        {t.status === 'resolved' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            <span>Đã hoàn thành</span>
                          </span>
                        )}
                        {t.status === 'cancelled' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3 h-3" />
                            <span>Đã hủy</span>
                          </span>
                        )}

                        <div className="text-[11px] text-slate-400 font-mono">
                          {new Date(t.created_at).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
                      <div className="flex items-center space-x-3">
                        {t.assigned_mentor ? (
                          <span className="inline-flex items-center space-x-1 text-slate-700 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            <span>Mentor: {t.assigned_mentor.full_name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Chưa phân công cố vấn</span>
                        )}

                        {t.team_name && (
                          <span className="text-slate-500">
                            Đội: <strong>{t.team_name}</strong>
                          </span>
                        )}
                      </div>

                      <div className="inline-flex items-center space-x-1 text-blue-600 font-bold">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{msgCount} tin nhắn</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Active Ticket Details & Direct Chat with Mentor */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5 lg:sticky lg:top-20">
          {selectedTicket ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Chi Tiết Yêu Cầu Hỗ Trợ
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5 line-clamp-2">
                    {selectedTicket.title}
                  </h3>
                </div>

                {selectedTicket.status === 'open' && (
                  <button
                    onClick={() => handleCancelTicket(selectedTicket.id)}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 border border-rose-200 bg-rose-50 px-2.5 py-1 rounded-lg"
                  >
                    Hủy ticket
                  </button>
                )}
              </div>

              {/* Status Banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Trạng thái:</span>
                  <strong className="text-slate-800 uppercase font-bold text-[11px]">
                    {selectedTicket.status}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Mentor tiếp nhận:</span>
                  <strong className="text-blue-700">
                    {selectedTicket.assigned_mentor?.full_name || 'Đang chờ Mentor nhận...'}
                  </strong>
                </div>
                <div className="pt-1 text-[11px] text-slate-600 leading-relaxed border-t border-slate-200/50">
                  {selectedTicket.description}
                </div>
              </div>

              {/* Chat Thread */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Trao Đổi Trực Tiếp ({selectedTicket.messages?.length || 0})
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 max-h-72 overflow-y-auto space-y-3">
                  {(!selectedTicket.messages || selectedTicket.messages.length === 0) ? (
                    <div className="text-center py-6 text-xs text-slate-400 italic">
                      Chưa có tin nhắn trao đổi. Hãy nhập nội dung bên dưới để chat với Mentor.
                    </div>
                  ) : (
                    selectedTicket.messages.map((m: TicketMessage) => {
                      const isMe = m.sender_id === user?.id;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="text-[10px] text-slate-400 font-semibold mb-0.5 px-1">
                            {isMe ? 'Bạn' : m.sender?.full_name || 'Mentor'} •{' '}
                            {new Date(m.sent_at).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div
                            className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                              isMe
                                ? 'bg-blue-600 text-white rounded-tr-xs'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs shadow-2xs'
                            }`}
                          >
                            {m.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Send message form */}
                <form onSubmit={handleSendMessage} className="flex items-center space-x-2 pt-1">
                  <input
                    type="text"
                    placeholder="Gõ tin nhắn gửi cho Mentor..."
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    disabled={sendingMsg || selectedTicket.status === 'resolved' || selectedTicket.status === 'cancelled'}
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={sendingMsg || !chatMessage.trim() || selectedTicket.status === 'resolved' || selectedTicket.status === 'cancelled'}
                    className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-none disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700">Chọn một ticket để xem chi tiết</div>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Bấm vào bất kỳ yêu cầu nào ở cột bên trái để đọc phản hồi và trao đổi trực tiếp với Mentor.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Support Ticket */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center space-x-1.5">
                  <LifeBuoy className="w-4 h-4" />
                  <span>VinUni AI • Ticket Support</span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-1">Gửi Yêu Cầu Hỗ Trợ Mới</h3>
              </div>

              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tiêu đề tóm tắt vấn đề *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lỗi Out of Memory khi train YOLOv8, thắc mắc về schema dataset..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mức độ ưu tiên
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'low', label: 'Thấp' },
                    { id: 'medium', label: 'Bình thường' },
                    { id: 'high', label: 'Khẩn cấp' },
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setPriority(p.id as any)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-none ${
                        priority === p.id
                          ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô tả chi tiết vấn đề &amp; lỗi gặp phải *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Mô tả cụ thể lỗi gặp phải, log báo lỗi (nếu có), các bước bạn đã thử giải quyết, và tài liệu/link repo liên quan..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {myTeam && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    Ticket này sẽ tự động được liên kết với đội thi:{' '}
                    <strong className="text-slate-800">{myTeam.name}</strong>
                  </span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Đang gửi...' : 'Gửi Yêu Cầu Cho Mentor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
