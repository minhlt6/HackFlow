import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type { CheckpointOverview } from '../../types';
import { Flag, CheckCircle2, Circle, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';

export const MentorCheckpointPanel: React.FC = () => {
  const [overview, setOverview] = useState<CheckpointOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subtopicFilter, setSubtopicFilter] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get('/mentor/checkpoint-overview');
        if (res.data?.success) {
          setOverview(res.data.data);
        } else {
          setError('Không thể tải dữ liệu checkpoint.');
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Lỗi kết nối máy chủ.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
        <span className="ml-3 text-slate-400 text-sm">Đang tải dữ liệu tiến độ...</span>
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

  if (!overview || overview.teams.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <Flag className="w-10 h-10 text-slate-600 mx-auto" />
        <p className="text-slate-400 text-sm">Chưa có đội thi nào hoặc chưa có checkpoint nào.</p>
      </div>
    );
  }

  // Get unique subtopic names for filter
  const subtopicNames = Array.from(
    new Set(overview.teams.map((t) => t.subtopic_name).filter(Boolean) as string[])
  ).sort();

  const filteredTeams = subtopicFilter === 'all'
    ? overview.teams
    : overview.teams.filter((t) => t.subtopic_name === subtopicFilter);

  // Calculate stats per checkpoint
  const cpStats = overview.checkpoints.map((cp) => {
    const submitted = filteredTeams.filter((t) =>
      t.checkpoints.find((c) => c.checkpoint_id === cp.id)?.submitted
    ).length;
    return { ...cp, submitted, total: filteredTeams.length };
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          <Flag className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-bold text-slate-900">Tiến độ nộp Checkpoint</h2>
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
            {filteredTeams.length} đội
          </span>
        </div>

        {/* Subtopic filter */}
        {subtopicNames.length > 1 && (
          <select
            value={subtopicFilter}
            onChange={(e) => setSubtopicFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-amber-500 shadow-2xs"
          >
            <option value="all">Tất cả đề tài</option>
            {subtopicNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Security Notice */}
      <div className="flex items-start space-x-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
        <div className="flex items-center space-x-1 shrink-0 mt-0.5">
          <EyeOff className="w-3.5 h-3.5 text-amber-600" />
        </div>
        <p>
          <span className="font-bold">Giới hạn xem:</span> Màn hình này chỉ hiển thị trạng thái nộp bài (✅ Đã nộp / ○ Chưa nộp).
          Nội dung bài nộp, link GitHub và các tài nguyên bảo mật khác bị ẩn để đảm bảo tính khách quan khi chấm điểm.
        </p>
      </div>

      {/* Checkpoint summary bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cpStats.map((cp) => {
          const pct = cp.total > 0 ? Math.round((cp.submitted / cp.total) * 100) : 0;
          return (
            <div key={cp.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 truncate">{cp.name}</span>
                <span className="text-xs font-mono font-bold text-slate-600 ml-2 shrink-0">
                  {cp.submitted}/{cp.total}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-500 font-medium">{pct}% đã nộp bài</div>
            </div>
          );
        })}
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-slate-700 font-bold uppercase tracking-wider text-[10px] w-48 min-w-[180px]">
                Đội thi
              </th>
              <th className="text-left px-3 py-3 text-slate-700 font-bold uppercase tracking-wider text-[10px] min-w-[130px]">
                Đề tài
              </th>
              {overview.checkpoints.map((cp) => (
                <th
                  key={cp.id}
                  className="text-center px-3 py-3 text-slate-700 font-bold uppercase tracking-wider text-[10px] min-w-[90px]"
                  title={cp.name}
                >
                  <div className="flex flex-col items-center space-y-0.5">
                    <Flag className="w-3 h-3 text-amber-600" />
                    <span className="truncate max-w-[80px]">{cp.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTeams.map((team) => (
              <tr key={team.team_id} className="hover:bg-slate-50/70 transition-none">
                <td className="px-4 py-3 font-bold text-slate-900">{team.team_name}</td>
                <td className="px-3 py-3 text-slate-600 text-xs">
                  {team.subtopic_name || <span className="text-slate-400 italic">Chưa chọn</span>}
                </td>
                {overview.checkpoints.map((cp) => {
                  const cell = team.checkpoints.find((c) => c.checkpoint_id === cp.id);
                  return (
                    <td key={cp.id} className="px-3 py-3 text-center">
                      {cell?.submitted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center space-x-4 text-xs text-slate-500 pt-1 font-medium">
        <div className="flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Đã nộp</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <Circle className="w-3.5 h-3.5 text-slate-300" />
          <span>Chưa nộp</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <Eye className="w-3.5 h-3.5 text-slate-400" />
          <span>Chỉ xem trạng thái — nội dung bài nộp được bảo mật</span>
        </div>
      </div>
    </div>
  );
};
