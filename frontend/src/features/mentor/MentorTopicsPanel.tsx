import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type { MentorSubtopic } from '../../types';
import { BookOpen, Users, ChevronDown, ChevronRight, AlertTriangle, Loader2 } from 'lucide-react';

export const MentorTopicsPanel: React.FC = () => {
  const [topics, setTopics] = useState<MentorSubtopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get('/mentor/my-topics');
        if (res.data?.success) {
          setTopics(res.data.data);
        } else {
          setError('Không thể tải danh sách đề tài.');
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Lỗi kết nối máy chủ.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        <span className="ml-3 text-slate-400 text-sm">Đang tải đề tài...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-400 text-sm flex items-center space-x-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
        <p className="text-slate-400 text-sm font-medium">Bạn chưa được phân công phụ trách đề tài nào.</p>
        <p className="text-slate-500 text-xs">Liên hệ Ban Tổ Chức để được phân công.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <BookOpen className="w-5 h-5 text-amber-600" />
        <h2 className="text-lg font-bold text-slate-900">Đề tài bạn đang phụ trách</h2>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
          {topics.length} đề tài
        </span>
      </div>

      <div className="space-y-3">
        {topics.map((st) => {
          const isExpanded = expandedIds.has(st.subtopic_id);
          const isFull = st.registered_count >= st.max_teams;
          const noTeams = st.teams.length === 0;

          return (
            <div
              key={st.subtopic_id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
            >
              {/* Subtopic Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                      {st.topic_name}
                    </span>
                    {isFull ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                        Đã đầy
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        Còn chỗ
                      </span>
                    )}
                    {noTeams && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1 font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Chưa có đội chọn</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 truncate">{st.subtopic_name}</h3>
                </div>

                <div className="flex items-center space-x-4 ml-4 shrink-0">
                  {/* Team count */}
                  <div className="flex items-center space-x-1 text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      <span className="text-slate-900 font-bold">{st.registered_count}</span>
                      <span className="text-slate-400">/{st.max_teams}</span>
                    </span>
                  </div>

                  {/* Expand toggle */}
                  {st.teams.length > 0 && (
                    <button
                      onClick={() => toggleExpand(st.subtopic_id)}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-none shadow-2xs"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Ẩn danh sách</span>
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-3.5 h-3.5" />
                          <span>Xem đội ({st.teams.length})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Team List — expanded */}
              {isExpanded && st.teams.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/60 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                        <th className="text-left px-4 py-2 font-bold">#</th>
                        <th className="text-left px-4 py-2 font-bold">Tên đội</th>
                        <th className="text-left px-4 py-2 font-bold">Nhóm trưởng</th>
                        <th className="text-left px-4 py-2 font-bold">Thời gian chọn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {st.teams.map((team, idx) => (
                        <tr key={team.team_id} className="hover:bg-white transition-none">
                          <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900">{team.team_name}</td>
                          <td className="px-4 py-2.5 text-slate-600 font-medium">{team.leader_name}</td>
                          <td className="px-4 py-2.5 text-slate-500 font-mono">
                            {team.selected_at
                              ? new Date(team.selected_at).toLocaleString('vi-VN')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
