import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { Checkpoint, CheckpointSubmission } from '../../types';
import {
  Flag,
  Clock,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Lock,
  ArrowRight,
} from 'lucide-react';

export const CheckpointTimeline: React.FC = () => {
  const { user } = useAuthStore();
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Record<string, CheckpointSubmission>>({});
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [isLeader, setIsLeader] = useState(false);

  // Submit modal / form state
  const [activeCpId, setActiveCpId] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [branch, setBranch] = useState('main');
  const [notes, setNotes] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [ideaSummary, setIdeaSummary] = useState('');
  const [slideUrl, setSlideUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // C-3 fix: fetch team info để lấy team_id cho submit
      const [teamRes, cpRes] = await Promise.allSettled([
        apiClient.get('/teams/my-team').catch(() => null),
        apiClient.get('/checkpoints'),
      ]);

      if (teamRes.status === 'fulfilled' && teamRes.value?.data?.success && teamRes.value.data.data) {
        const t = teamRes.value.data.data;
        setMyTeamId(t?.id ?? null);
        const lid = t?.leader_id ?? t?.members?.find((m: any) => m.role === 'leader' || m.role_in_team === 'leader')?.user_id;
        setIsLeader(!!lid && !!user?.id && lid === user.id);
      } else {
        setMyTeamId(null);
        setIsLeader(false);
      }

      if (cpRes.status === 'fulfilled' && cpRes.value?.data?.success) {
        const data: Checkpoint[] = cpRes.value.data.data;
        setCheckpoints(data);

        // Populate submissions từ latest_submission trong mỗi checkpoint
        const loadedSubs: Record<string, CheckpointSubmission> = {};
        data.forEach((cp) => {
          if ((cp as any).latest_submission) {
            loadedSubs[cp.id] = (cp as any).latest_submission as CheckpointSubmission;
          }
        });
        setSubmissions(loadedSubs);
      }
    } catch (err) {
      console.error('Failed to load checkpoint data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCheckpointStatus = (cp: Checkpoint): 'upcoming' | 'open' | 'closed' => {
    if (cp.status) return cp.status;
    const now = Date.now();
    const start = new Date(cp.open_at).getTime();
    const end = new Date(cp.close_at).getTime();
    if (now < start) return 'upcoming';
    if (now > end) return 'closed';
    return 'open';
  };

  const handleOpenSubmit = (cp: Checkpoint) => {
    setActiveCpId(cp.id);
    setSubmitMessage(null);
    setRepoUrl('');
    setCommitSha('');
    setBranch('main');
    setNotes('');
    setProjectTitle('');
    setIdeaSummary('');
    setSlideUrl('');
    setVideoUrl('');
  };

  const handleSubmitCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCpId) return;
    setSubmitting(true);
    setSubmitMessage(null);

    const customFields: Record<string, string> = {};
    if (projectTitle.trim()) customFields['project_title'] = projectTitle.trim();
    if (ideaSummary.trim()) customFields['idea_summary'] = ideaSummary.trim();
    if (slideUrl.trim()) customFields['slide_url'] = slideUrl.trim();
    if (videoUrl.trim()) customFields['video_url'] = videoUrl.trim();
    if (commitSha.trim()) customFields['commit_sha'] = commitSha.trim();
    if (branch.trim()) customFields['branch'] = branch.trim();

    try {
      // C-3 fix: truyền team_id query param bắt buộc
      const url = `/checkpoints/${activeCpId}/submit${myTeamId ? `?team_id=${myTeamId}` : ''}`;
      const res = await apiClient.post(url, {
        submission_url: repoUrl || slideUrl || 'https://hackflow.local/submission',
        note: notes || undefined,
        custom_fields: customFields,
      });

      if (res?.data?.success) {
        setSubmitMessage({ text: 'Nộp checkpoint thành công! ✓', type: 'success' });
        setSubmissions((prev) => ({
          ...prev,
          [activeCpId]: res.data.data,
        }));
        setTimeout(() => setActiveCpId(null), 1500);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Không thể nộp checkpoint. Vui lòng thử lại.';
      setSubmitMessage({ text: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <Flag className="w-4 h-4" />
          <span>Tiến độ &amp; Mốc kiểm soát</span>
        </div>
        <h1 className="text-3xl font-black text-white">Checkpoints Timeline</h1>
        <p className="text-sm text-slate-400 mt-1">
          Mỗi mốc kiểm soát mở và đóng chính xác theo thời gian thực (Time-gated UTC).
          Thí sinh nộp Commit SHA để chứng minh tiến độ phát triển phần mềm định kỳ.
        </p>
      </div>

      {/* Team Status Banner */}
      {!myTeamId && user?.role === 'participant' && (
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-300">
                Chế độ theo dõi tiến độ các mốc kiểm soát của Ban Tổ Chức
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                Bạn chưa tham gia đội thi nào. Bạn có thể theo dõi thời gian mở/đóng và các yêu cầu tiến độ của từng mốc bên dưới. Để nộp bài và ghi nhận Commit SHA định kỳ, bạn cần lập hoặc tham gia một đội thi.
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
      )}

      {checkpoints.length === 0 ? (
        <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-2xl">
          <Flag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-semibold">Chưa có checkpoint nào</p>
          <p className="text-slate-500 text-sm mt-1">Ban Tổ Chức sẽ tạo các mốc kiểm soát trước ngày thi bắt đầu.</p>
        </div>
      ) : (
        <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-8">
          {checkpoints.map((cp, idx) => {
            const status = getCheckpointStatus(cp);
            const sub = submissions[cp.id];

            return (
              <div key={cp.id} className="relative group">
                {/* Dot (ping animation for open) */}
                {status === 'open' && (
                  <div className="absolute -left-[35px] top-1.5 w-5 h-5 rounded-full border-4 border-slate-950 bg-emerald-400 animate-ping" />
                )}
                <div
                  className={`absolute -left-[35px] top-1.5 w-5 h-5 rounded-full border-4 border-slate-950 ${
                    status === 'open'
                      ? 'bg-emerald-400'
                      : status === 'closed'
                      ? 'bg-slate-600'
                      : 'bg-slate-700'
                  }`}
                />

                {/* Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        #{idx + 1}
                      </span>
                      <h2 className="text-lg font-bold text-white">{cp.name}</h2>
                      {cp.is_required && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 border border-rose-800/40">
                          Bắt buộc
                        </span>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div>
                      {status === 'open' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>ĐANG MỞ</span>
                        </span>
                      )}
                      {status === 'closed' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          ĐÃ KẾT THÚC
                        </span>
                      )}
                      {status === 'upcoming' && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          SẮP DIỄN RA
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-slate-400 mb-4">{cp.description}</p>

                  {/* Times */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 border-t border-slate-800/80 pt-3">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Mở: {new Date(cp.open_at).toLocaleString('vi-VN')}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-rose-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Hạn chót: {new Date(cp.close_at).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>

                  {/* Actions — chỉ participant */}
                  {user?.role === 'participant' && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      {!myTeamId ? (
                        <>
                          <span className="text-xs text-slate-500 flex items-center space-x-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Chưa tham gia đội thi</span>
                          </span>
                          <Link
                            to="/team"
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1.5 transition"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Cần đội để nộp bài</span>
                          </Link>
                        </>
                      ) : !isLeader ? (
                        <>
                          {sub ? (
                            <div className="flex items-center space-x-2 text-xs text-emerald-400 font-mono">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Đã nộp lúc {new Date(sub.submitted_at).toLocaleTimeString('vi-VN')}</span>
                              <span className="text-slate-500">({(sub.commit_sha ?? '').substring(0, 7)})</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Chỉ Nhóm trưởng mới được nộp bài. Bạn đang theo dõi tiến độ.
                            </span>
                          )}
                          <button
                            disabled
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-500 cursor-not-allowed flex items-center space-x-1.5"
                            title="Chỉ nhóm trưởng mới có quyền nộp checkpoint"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Chỉ Nhóm trưởng được nộp</span>
                          </button>
                        </>
                      ) : (
                        <>
                          {sub ? (
                            <div className="flex items-center space-x-2 text-xs text-emerald-400 font-mono">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Đã nộp lúc {new Date(sub.submitted_at).toLocaleTimeString('vi-VN')}</span>
                              <span className="text-slate-500">({(sub.commit_sha ?? '').substring(0, 7)})</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">Chưa ghi nhận bài nộp</span>
                          )}

                          <button
                            onClick={() => handleOpenSubmit(cp)}
                            disabled={status !== 'open'}
                            title={
                              status === 'upcoming'
                                ? `Checkpoint mở lúc ${new Date(cp.open_at).toLocaleString('vi-VN')}`
                                : status === 'closed'
                                ? 'Checkpoint đã đóng'
                                : undefined
                            }
                            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                              status !== 'open'
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40'
                            }`}
                          >
                            <GitCommit className="w-3.5 h-3.5" />
                            <span>
                              {status === 'upcoming'
                                ? 'Chưa đến giờ mở'
                                : status === 'closed'
                                ? 'Đã đóng'
                                : sub
                                ? 'Nộp lại / Cập nhật'
                                : 'Nộp Checkpoint này'}
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Modal */}
      {activeCpId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <GitCommit className="w-5 h-5 text-emerald-400" />
                <span>Nộp Tiến Độ Checkpoint</span>
              </h3>
              <button
                onClick={() => setActiveCpId(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {submitMessage && (
              <div
                className={`p-3 rounded-lg flex items-center space-x-2 text-xs ${
                  submitMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}
              >
                {submitMessage.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{submitMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmitCheckpoint} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tên Dự Án
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nền tảng Tele-Health chẩn đoán sớm"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tóm tắt ý tưởng & giải pháp
                </label>
                <textarea
                  rows={2}
                  placeholder="Tóm tắt ý tưởng, vấn đề giải quyết..."
                  value={ideaSummary}
                  onChange={(e) => setIdeaSummary(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Repository URL (GitHub / GitLab)
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/myteam/project"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Link Slide thuyết trình
                </label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/presentation/d/..."
                  value={slideUrl}
                  onChange={(e) => setSlideUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Link Video Demo (YouTube / Drive)
                </label>
                <input
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Commit SHA</label>
                  <input
                    type="text"
                    maxLength={40}
                    placeholder="e.g. 3a1b4c7d..."
                    value={commitSha}
                    onChange={(e) => setCommitSha(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Nhánh (Branch)</label>
                  <input
                    type="text"
                    placeholder="main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Ghi chú tiến độ</label>
                <textarea
                  rows={2}
                  placeholder="Mô tả tóm tắt tiến độ hoặc ghi chú cho Ban Giám Khảo..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveCpId(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-950/40"
                >
                  {submitting ? 'Đang gửi...' : 'Xác Nhận Nộp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};