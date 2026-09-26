import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type { Team } from '../../types';
import {
  Award,
  ExternalLink,
  GitCommit,
  CheckCircle,
  Send,
  Layers,
  Video,
  Code2,
  AlertCircle,
} from 'lucide-react';

interface ScoringCriteria {
  id: string;
  name: string;
  description?: string;
  max_score: number;
  weight: number;
  display_order: number;
  is_active: boolean;
}

export const JudgeSplitScreen: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [criteria, setCriteria] = useState<ScoringCriteria[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [generalComment, setGeneralComment] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');

  // Tải danh sách đội và tiêu chí chấm điểm
  const refreshAssignedTeams = async () => {
    try {
      const res = await apiClient.get('/scoring/assigned-teams').catch(() => apiClient.get('/teams'));
      if (res.data?.success) {
        setTeams(res.data.data);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách đội:', err);
    }
  };

  const loadTeamEvaluation = async (teamId: string, currentCriteria: ScoringCriteria[]) => {
    try {
      const [evalRes, teamDetailRes] = await Promise.all([
        apiClient.get(`/scoring/evaluations/team/${teamId}`).catch(() => null),
        apiClient.get(`/teams/${teamId}`).catch(() => null),
      ]);

      if (teamDetailRes?.data?.success && teamDetailRes.data.data) {
        setSelectedTeam(teamDetailRes.data.data);
      }

      if (evalRes?.data?.success && evalRes.data.data) {
        const ev = evalRes.data.data;
        const newScores: Record<string, number> = {};
        currentCriteria.forEach((c) => {
          const detail = ev.details?.find((d: any) => d.criteria_id === c.id);
          newScores[c.id] = detail ? detail.score : 0;
        });
        setScores(newScores);
        setGeneralComment(ev.general_comment || '');
        setStatusType('success');
        setStatusMessage(
          ev.is_draft
            ? `Đang mở bản nháp của đội này (Điểm tạm: ${ev.total_score} đ)`
            : `Đội này đã được xác nhận chấm điểm (Tổng điểm: ${ev.total_score} đ)`
        );
      } else {
        const defaultScores: Record<string, number> = {};
        currentCriteria.forEach((c) => { defaultScores[c.id] = 0; });
        setScores(defaultScores);
        setGeneralComment('');
        setStatusMessage(null);
      }
    } catch (err) {
      console.error('Error loading team evaluation:', err);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [teamsRes, criteriaRes] = await Promise.all([
          apiClient.get('/scoring/assigned-teams').catch(() => apiClient.get('/teams')),
          apiClient.get('/scoring/criteria'),
        ]);

        let loadedCriteria: ScoringCriteria[] = [];
        if (criteriaRes.data?.success) {
          loadedCriteria = criteriaRes.data.data;
          setCriteria(loadedCriteria);
          const defaultScores: Record<string, number> = {};
          loadedCriteria.forEach((c) => { defaultScores[c.id] = 0; });
          setScores(defaultScores);
        }

        if (teamsRes.data?.success) {
          const list: Team[] = teamsRes.data.data;
          setTeams(list);
          if (list.length > 0) {
            setSelectedTeam(list[0]);
            await loadTeamEvaluation(list[0].id, loadedCriteria);
          }
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu ban đầu:', err);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const handleSelectTeam = async (team: any) => {
    setSelectedTeam(team);
    await loadTeamEvaluation(team.id, criteria);
  };

  // Tính tổng điểm có trọng số: Σ (score * weight)
  const totalScore = criteria.reduce((sum, c) => {
    return sum + (scores[c.id] || 0) * c.weight;
  }, 0);

  const maxPossibleScore = criteria.reduce((sum, c) => sum + c.max_score * c.weight, 0);

  const handleSaveScore = async (e: React.FormEvent, isDraft: boolean = false) => {
    e.preventDefault();
    if (!selectedTeam) return;

    setSaving(true);
    setStatusMessage(null);

    try {
      const details = criteria.map((c) => ({
        criteria_id: c.id,
        score: scores[c.id] || 0,
        note: '',
      }));

      const res = await apiClient.post('/scoring/evaluate', {
        team_id: selectedTeam.id,
        details,
        general_comment: generalComment || undefined,
        is_draft: isDraft,
      });

      if (res.data?.success) {
        setStatusType('success');
        setStatusMessage(
          isDraft
            ? `Đã lưu nháp cho đội "${selectedTeam.name}". Tổng điểm tạm: ${totalScore.toFixed(1)}`
            : `✅ Đã xác nhận chấm điểm cho đội "${selectedTeam.name}"! Tổng điểm: ${totalScore.toFixed(1)}`
        );
        await refreshAssignedTeams();
      }
    } catch (err: any) {
      setStatusType('error');
      const errMsg = err.response?.data?.error?.message
        || err.response?.data?.detail
        || 'Không thể lưu điểm chấm. Kiểm tra lại quyền phân công.';
      setStatusMessage(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedTeam || saving) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      const details = criteria.map((c) => ({
        criteria_id: c.id,
        score: scores[c.id] || 0,
        note: '',
      }));
      const res = await apiClient.post('/scoring/evaluate', {
        team_id: selectedTeam.id,
        details,
        general_comment: generalComment || undefined,
        is_draft: true,
      });
      if (res.data?.success) {
        setStatusType('success');
        setStatusMessage(`Đã lưu nháp cho đội "${selectedTeam.name}". Tổng điểm tạm: ${totalScore.toFixed(1)}`);
        await refreshAssignedTeams();
      }
    } catch (err: any) {
      setStatusType('error');
      const errMsg = err.response?.data?.error?.message || err.response?.data?.detail || 'Không thể lưu nháp.';
      setStatusMessage(errMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
      </div>
    );
  }

  if (criteria.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <AlertCircle className="w-12 h-12 text-amber-500" />
        <h2 className="text-lg font-bold text-slate-900">Chưa có tiêu chí chấm điểm</h2>
        <p className="text-slate-600 text-sm text-center max-w-md">
          Admin cần thiết lập các tiêu chí chấm điểm trước khi giám khảo có thể bắt đầu chấm.
          Vào <span className="text-blue-600 font-mono font-bold">/admin</span> → Thiết lập tiêu chí.
        </p>
      </div>
    );
  }

  const submission = selectedTeam?.final_submission;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Bar: Team selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center space-x-2 shrink-0">
          <Award className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">Hội đồng Giám khảo • Chấm điểm theo đội</span>
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto py-1 max-w-full">
          {teams.map((t: any) => {
            const isSelected = selectedTeam?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleSelectTeam(t)}
                className={`px-3 py-1.5 rounded-xl text-xs shrink-0 transition-none flex items-center space-x-2 border font-semibold ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 border-blue-400 font-bold shadow-xs ring-1 ring-blue-400/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{t.name}</span>
                {t.scoring_status === 'submitted' && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    {t.total_score != null ? `${Number(t.total_score).toFixed(1)} đ` : 'Đã chấm'}
                  </span>
                )}
                {t.scoring_status === 'draft' && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                    Nháp
                  </span>
                )}
                {(!t.scoring_status || t.scoring_status === 'not_scored') && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-medium">
                    Chưa chấm
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center space-x-2 shadow-xs ${
            statusType === 'success'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusType === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-blue-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Split-Screen Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Side: Submission & Project Proof */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-black text-slate-900">{selectedTeam?.name || 'Chọn đội thi'}</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold uppercase">
                {selectedTeam?.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Đề tài: <span className="text-slate-800 font-bold">{selectedTeam?.subtopic?.title || 'Chưa đăng ký'}</span>
            </p>
          </div>

          {/* Submission Verification Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
              <GitCommit className="w-4 h-4 text-blue-600" />
              <span>Bằng Chứng Mã Nguồn &amp; Freeze Commit SHA</span>
            </div>

            {submission ? (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs font-mono text-blue-700 flex items-center justify-between shadow-2xs">
                  <span className="truncate font-bold">SHA: {submission.commit_sha}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">FROZEN</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {submission.repo_url && (
                    <a
                      href={submission.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-none shadow-2xs"
                    >
                      <Code2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Xem Repository</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  )}
                  {submission.demo_url && (
                    <a
                      href={submission.demo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-none shadow-2xs"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Mở Live Demo</span>
                      <ExternalLink className="w-3 h-3 text-emerald-600" />
                    </a>
                  )}
                  {submission.video_url && (
                    <a
                      href={submission.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition-none shadow-2xs"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Video Pitch</span>
                      <ExternalLink className="w-3 h-3 text-indigo-600" />
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-800 py-3 text-center bg-amber-50 rounded-xl border border-amber-200 font-medium">
                Đội này chưa nộp sản phẩm chung cuộc hoặc chưa đến hạn đóng băng.
              </div>
            )}
          </div>

          {/* Members List */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Thành viên ({selectedTeam?.members?.length || 0})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {selectedTeam?.members?.map((m) => (
                <div key={m.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs shadow-2xs">
                  <div className="font-bold text-slate-900">{m.user?.full_name}</div>
                  <div className="text-slate-500 capitalize text-[11px] mt-0.5">{m.role_in_team}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Dynamic Rubric Scoring Form */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Phiếu Đánh Giá Rubric</h2>
              <p className="text-xs text-slate-500 mt-0.5">{criteria.length} tiêu chí • Tổng trọng số: {(criteria.reduce((s, c) => s + c.weight, 0) * 100).toFixed(0)}%</p>
            </div>

            {/* Total Score Badge */}
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Tổng điểm</div>
              <div className="text-2xl font-black font-mono text-blue-700">
                {totalScore.toFixed(1)}{' '}
                <span className="text-xs text-slate-400 font-normal">/ {maxPossibleScore.toFixed(0)}</span>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => handleSaveScore(e, false)} className="space-y-5">
            {/* Dynamic criteria từ DB */}
            {criteria.map((criterion, index) => (
              <div key={criterion.id} className="space-y-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-slate-900">
                    {index + 1}. {criterion.name} (Tối đa {criterion.max_score}đ · Trọng số {(criterion.weight * 100).toFixed(0)}%)
                  </label>
                  <span className="font-mono font-bold text-blue-700 text-sm">{scores[criterion.id] || 0} đ</span>
                </div>
                {criterion.description && (
                  <p className="text-[11px] text-slate-500 leading-relaxed">{criterion.description}</p>
                )}
                <input
                  type="range"
                  min="0"
                  max={criterion.max_score}
                  step="0.5"
                  value={scores[criterion.id] || 0}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, [criterion.id]: Number(e.target.value) }))
                  }
                  className="w-full accent-blue-600 cursor-pointer"
                />
                {/* Mini tick marks */}
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>0</span>
                  <span>{(criterion.max_score / 2).toFixed(0)}</span>
                  <span>{criterion.max_score}</span>
                </div>
              </div>
            ))}

            {/* General comment */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nhận xét &amp; Góp ý của Giám khảo
              </label>
              <textarea
                rows={3}
                placeholder="Ghi lại điểm mạnh, điểm hạn chế và lời khuyên phát triển thêm cho đội thi..."
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-500 shadow-2xs leading-relaxed"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={saving || !selectedTeam}
                onClick={handleSaveDraft}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs transition-none border border-slate-200 shadow-2xs"
              >
                Lưu Nháp
              </button>

              <button
                type="submit"
                disabled={saving || !selectedTeam}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs transition-none shadow-xs flex items-center justify-center space-x-2"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{saving ? 'Đang lưu...' : 'Xác Nhận Điểm'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
