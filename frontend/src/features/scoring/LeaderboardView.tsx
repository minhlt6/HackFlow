import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type { LeaderboardItem } from '../../types';
import { Trophy, AlertCircle } from 'lucide-react';

export const LeaderboardView: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  // FIX BUG-11: Thêm error state — phân biệt "chưa có data" vs "API lỗi"
  const [error, setError] = useState<string | null>(null);

  // FIX BUG-18: Thêm cleanup flag — tránh setState trên unmounted component
  useEffect(() => {
    let cancelled = false;

    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get('/scoring/leaderboard');
        if (cancelled) return;
        if (res.data?.success) {
          setLeaderboard(res.data.data);
        }
      } catch (err: any) {
        if (cancelled) return;
        const msg = err.response?.data?.detail
          || err.response?.data?.error?.message
          || 'Không thể tải bảng xếp hạng. Vui lòng thử lại.';
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLeaderboard();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  // FIX BUG-11: Hiện error message thay vì bảng rỗng khi fetch fail
  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center space-x-3 p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase tracking-wider">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          <span>Bảng Xếp Hạng Chính Thức</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900">Bảng Xếp Hạng VinUni AI Hackathon</h1>
        <p className="text-sm text-slate-600 max-w-xl mx-auto">
          Điểm số được tổng hợp tự động từ Phiếu chấm Rubric của Hội đồng Giám khảo độc lập theo cơ chế Blind Judging.
        </p>
      </div>

      {/* Top 3 Podium if at least 3 teams scored */}
      {leaderboard.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {/* Rank 2 */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center flex flex-col justify-between order-2 md:order-1 shadow-xs">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 mx-auto flex items-center justify-center text-slate-700 font-bold text-lg mb-3 shadow-2xs">
                🥈 2
              </div>
              <h3 className="font-bold text-lg text-slate-900">{leaderboard[1].team_name}</h3>
              <p className="text-xs text-slate-500 mb-4">{leaderboard[1].subtopic_title || 'N/A'}</p>
            </div>
            <div className="text-2xl font-black font-mono text-slate-800">
              {leaderboard[1].average_score.toFixed(2)} <span className="text-xs text-slate-400 font-normal">đ</span>
            </div>
          </div>

          {/* Rank 1 */}
          <div className="bg-gradient-to-b from-amber-50 to-white border border-amber-300 rounded-3xl p-6 text-center flex flex-col justify-between order-1 md:order-2 shadow-md shadow-amber-500/10">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 mx-auto flex items-center justify-center text-amber-700 font-black text-2xl mb-3 shadow-2xs">
                🥇 1
              </div>
              <h3 className="font-black text-xl text-slate-900">{leaderboard[0].team_name}</h3>
              <p className="text-xs text-amber-800 mb-4 font-medium">{leaderboard[0].subtopic_title || 'N/A'}</p>
            </div>
            <div className="text-3xl font-black font-mono text-amber-600">
              {leaderboard[0].average_score.toFixed(2)} <span className="text-xs text-slate-500 font-normal">đ</span>
            </div>
          </div>

          {/* Rank 3 */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center flex flex-col justify-between order-3 shadow-xs">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 mx-auto flex items-center justify-center text-amber-800 font-bold text-lg mb-3 shadow-2xs">
                🥉 3
              </div>
              <h3 className="font-bold text-lg text-slate-900">{leaderboard[2].team_name}</h3>
              <p className="text-xs text-slate-500 mb-4">{leaderboard[2].subtopic_title || 'N/A'}</p>
            </div>
            <div className="text-2xl font-black font-mono text-slate-800">
              {leaderboard[2].average_score.toFixed(2)} <span className="text-xs text-slate-400 font-normal">đ</span>
            </div>
          </div>
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-900">Toàn Bộ Bảng Điểm</h2>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Chưa có đội thi nào được chấm điểm. Hãy chuyển sang vai trò "Giám khảo (Judge)" để bắt đầu chấm điểm!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Hạng</th>
                  <th className="px-6 py-3.5">Tên Đội</th>
                  <th className="px-6 py-3.5">Đề Tài</th>
                  <th className="px-6 py-3.5">Số Giám Khảo</th>
                  <th className="px-6 py-3.5 text-right">Điểm Trung Bình</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboard.map((item, idx) => (
                  <tr key={item.team_id} className="hover:bg-slate-50/70 transition-none">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">
                      {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{item.team_name}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">{item.subtopic_title || 'N/A'}</td>
                    <td className="px-6 py-4 text-xs font-mono font-semibold text-slate-500">{item.judge_count} GK</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-blue-700 text-sm">
                      {item.average_score.toFixed(2)} đ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
