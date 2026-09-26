import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { Topic, SubTopic, Team } from '../../types';
import { BookOpen, CheckCircle, AlertCircle, Users, Check, Lock, AlertTriangle, ArrowRight } from 'lucide-react';

export const TopicSelection: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [topicsRes, teamRes] = await Promise.all([
        apiClient.get('/topics'),
        // FIX F-BUG-02: Đúng endpoint là /teams/my-team (không phải /teams/my)
        // Lỗi cũ khiến myTeam luôn null → mọi user đều thấy "cần tạo nhóm"
        apiClient.get('/teams/my-team').catch(() => null),
      ]);

      if (topicsRes.data?.success) {
        setTopics(topicsRes.data.data);
      }
      if (teamRes?.data?.success) {
        setMyTeam(teamRes.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectSubtopic = async (subtopic: SubTopic) => {
    if (!myTeam) {
      setMessage({ text: 'Bạn cần tạo hoặc tham gia một nhóm trước khi chọn đề tài!', type: 'error' });
      return;
    }
    if (!user) {
      setMessage({ text: 'Đang tải thông tin người dùng, vui lòng thử lại sau giây lát.', type: 'error' });
      return;
    }
    // C-1 fix: dùng leader_id từ TeamResponse (được populate từ members)
    const leaderId = myTeam.leader_id ?? myTeam.members?.find(m => m.role_in_team === 'leader')?.user_id;
    if (leaderId !== user.id) {
      setMessage({ text: 'Chỉ Trưởng nhóm (Leader) mới có quyền chọn đề tài cho nhóm!', type: 'error' });
      return;
    }

    if (!window.confirm(`Xác nhận đăng ký đề tài nhánh: "${subtopic.title}"?\n\nBạn chỉ được chọn 1 đề tài. Có thể thay đổi trước thời gian khóa đề tài.`)) {
      return;
    }

    setSelectingId(subtopic.id);
    setMessage(null);

    try {
      // C-2 fix: dùng đúng endpoint /topics/subtopics/{id}/select?team_id=...
      const res = await apiClient.post(
        `/topics/subtopics/${subtopic.id}/select?team_id=${myTeam.id}`
      );

      if (res.data?.success) {
        setMessage({
          text: `Đăng ký thành công đề tài: "${subtopic.title}"! Đã khóa slot an toàn.`,
          type: 'success',
        });
        setTimeout(() => setMessage(null), 5000);
        fetchData();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Đề tài này đã hết suất hoặc có lỗi xảy ra.';
      setMessage({ text: msg, type: 'error' });
      setTimeout(() => setMessage(null), 6000);
    } finally {
      setSelectingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  const isLeader = myTeam?.leader_id === user?.id;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <BookOpen className="w-4 h-4" />
          <span>Danh mục Đề tài Hackathon</span>
        </div>
        <h1 className="text-3xl font-black text-white">Lựa chọn Đề tài & Chủ đề</h1>
        <p className="text-sm text-slate-400 mt-1">
          Mỗi đề tài nhánh có giới hạn số lượng đội thi đăng ký tối đa nhằm đảm bảo tính cạnh tranh công bằng. 
          Hệ thống áp dụng cơ chế Conditional Concurrency Lock chống vượt slot.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl flex items-center space-x-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Team Selection Status / Reminder */}
      {!myTeam ? (
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-300">
                Chế độ xem thông tin đề tài của Ban Tổ Chức
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                Bạn chưa tham gia đội thi nào. Bạn có thể nghiên cứu các bài toán, tải dữ liệu mẫu và xem tài liệu tham khảo bên dưới. Để đăng ký và giữ slot cho kỳ thi, bạn cần lập hoặc tham gia một đội thi.
              </div>
            </div>
          </div>
          <Link
            to="/team"
            className="shrink-0 inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-md shadow-emerald-950/40"
          >
            <span>Tạo / Tham gia đội</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : myTeam.subtopic ? (
        <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">Đề tài hiện tại của nhóm bạn:</div>
            <div className="text-base font-bold text-emerald-400">{myTeam.subtopic.title}</div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 text-xs font-semibold border border-emerald-800">
            Đã đăng ký
          </span>
        </div>
      ) : null}

      {/* Topics list — FIX BUG-19: Empty state khi chưa có đề tài */}
      <div className="space-y-8">
        {topics.length === 0 ? (
          <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-2xl">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-semibold">Chưa có đề tài nào</p>
            <p className="text-slate-500 text-sm mt-1">Ban Tổ Chức sẽ công bố danh sách đề tài trước khi kỳ thi bắt đầu.</p>
          </div>
        ) : topics.map((topic) => (
          <div key={topic.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-1">{topic.title}</h2>
              <p className="text-sm text-slate-400">{topic.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topic.subtopics?.map((sub) => {
                const isFull = sub.current_registered_count >= sub.max_teams;
                const isSelected = myTeam?.subtopic_id === sub.id;
                const pct = Math.min(100, (sub.current_registered_count / sub.max_teams) * 100);

                return (
                  <div
                    key={sub.id}
                    className={`p-5 rounded-xl border flex flex-col justify-between transition ${
                      isSelected
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : isFull
                        ? 'bg-slate-950/40 border-slate-800/40 opacity-70'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-base font-semibold text-white">{sub.title}</h3>
                        {isSelected && (
                          <span className="shrink-0 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold uppercase flex items-center space-x-1">
                            <Check className="w-3 h-3" />
                            <span>Đã chọn</span>
                          </span>
                        )}
                        {isFull && !isSelected && (
                          <span className="shrink-0 px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-semibold uppercase">
                            Hết suất (Full)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mb-3">{sub.description}</p>

                      {/* Phase 5: sample data + reference links */}
                      {(sub.sample_data_url || (sub.reference_links && sub.reference_links.length > 0)) && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {sub.sample_data_url && (
                            <a
                              href={sub.sample_data_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition"
                            >
                              <span>📁</span><span>Dữ liệu mẫu</span>
                            </a>
                          )}
                          {sub.reference_links?.map((link, i) => (
                            <a
                              key={i}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1 text-[11px] px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition"
                            >
                              <span>🔗</span><span>Tài liệu {i + 1}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      {/* Slot bar */}
                      <div className="space-y-1 mb-4">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span className="flex items-center space-x-1">
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            <span>Đã đăng ký:</span>
                          </span>
                          <span className="font-mono font-medium text-slate-300">
                            {sub.current_registered_count} / {sub.max_teams} đội
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isFull ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Button */}
                      {isSelected ? (
                        <button
                          disabled
                          className="w-full py-2 rounded-lg bg-emerald-900/40 text-emerald-400 text-xs font-semibold cursor-default border border-emerald-700/50"
                        >
                          Đang chọn đề tài này
                        </button>
                      ) : !myTeam ? (
                        <button
                          onClick={() => navigate('/team')}
                          className="w-full py-2 rounded-lg text-xs font-semibold transition bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center space-x-1.5 shadow-sm"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Cần tham gia đội để chọn</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSelectSubtopic(sub)}
                          disabled={isFull || selectingId === sub.id || !isLeader}
                          className={`w-full py-2 rounded-lg text-xs font-semibold transition ${
                            isFull
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : !isLeader
                              ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/50'
                          }`}
                        >
                          {selectingId === sub.id
                            ? 'Đang khóa slot...'
                            : isFull
                            ? 'Hết suất'
                            : !isLeader
                            ? 'Chỉ Nhóm trưởng được chọn'
                            : 'Đăng ký đề tài này'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
