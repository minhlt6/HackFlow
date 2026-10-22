import React, { useCallback, useMemo, useState } from 'react';
import { useMockStore } from '../store/useMockStore';
import { useAuthStore } from '../store/useAuthStore';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import {
  Trophy,
  Award,
  Medal,
  Building2,
  Layers,
  Clock,
  CheckCircle2,
  Send,
  Crown,
  Sparkles,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

type ActiveStageTab = 'stage_1_zone' | 'stage_2_room' | 'stage_3_cross_room';

export const Scoreboard: React.FC = () => {
  const {
    currentUser,
    teams,
    rooms,
    checkpoints,
    rubricCriteria,
    peerEvaluations,
    submitPeerEvaluation,
  } = useMockStore();
  const { user } = useAuthStore();

  // Xác định đội hiện tại của thí sinh đang đăng nhập (mặc định CyberSamurai trong demo)
  const myTeam = useMemo(() => {
    const email = (user?.email || currentUser.email || '').toLowerCase();
    const matched = teams.find((t) =>
      t.members.some((m) => m.email.toLowerCase() === email)
    );
    return matched || teams[0];
  }, [teams, user, currentUser]);

  const myRoom = useMemo(
    () => rooms.find((r) => r.id === myTeam?.roomId) || rooms[0],
    [rooms, myTeam]
  );

  const myZone = useMemo(
    () => myRoom?.zones.find((z) => z.id === myTeam?.zoneId) || myRoom?.zones[0],
    [myRoom, myTeam]
  );

  const [activeStage, setActiveStage] = useState<ActiveStageTab>('stage_1_zone');
  const [selectedTargetTeamId, setSelectedTargetTeamId] = useState<string>('');
  const [criteriaScores, setCriteriaScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    rubricCriteria.forEach((c) => {
      init[c.id] = Math.round(c.maxScore * 0.85);
    });
    return init;
  });
  const [comment, setComment] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Danh sách đội được phép chấm ở từng Giai đoạn (tự động loại trừ đội của chính mình)
  const eligibleTargetTeams = useMemo(() => {
    if (!myTeam) return [];
    if (activeStage === 'stage_1_zone') {
      return teams.filter(
        (t) =>
          t.roomId === myTeam.roomId &&
          t.zoneId === myTeam.zoneId &&
          t.id !== myTeam.id
      );
    }
    if (activeStage === 'stage_2_room') {
      return teams.filter(
        (t) =>
          t.roomId === myTeam.roomId &&
          t.isZoneWinner &&
          t.id !== myTeam.id
      );
    }
    return teams.filter((t) => t.isRoomWinner && t.id !== myTeam.id);
  }, [teams, myTeam, activeStage]);

  const effectiveTargetTeam = useMemo(() => {
    if (
      selectedTargetTeamId &&
      eligibleTargetTeams.some((t) => t.id === selectedTargetTeamId)
    ) {
      return eligibleTargetTeams.find((t) => t.id === selectedTargetTeamId) || null;
    }
    return eligibleTargetTeams[0] || null;
  }, [eligibleTargetTeams, selectedTargetTeamId]);

  const handleCriterionChange = (critId: string, val: number, maxScore: number) => {
    const clamped = Math.max(0, Math.min(maxScore, val));
    setCriteriaScores((prev) => ({ ...prev, [critId]: clamped }));
  };

  const handleSubmitPeerBallot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTeam || !effectiveTargetTeam) return;

    const result = submitPeerEvaluation({
      stage: activeStage,
      evaluatorTeamId: myTeam.id,
      targetTeamId: effectiveTargetTeam.id,
      scores: criteriaScores,
      comment: comment || 'Phần trình bày và sản phẩm thực chiến rất thuyết phục!',
    });

    setFeedbackBanner({
      type: result.success ? 'success' : 'error',
      text: result.message,
    });
    if (result.success) {
      setComment('');
    }
    setTimeout(() => setFeedbackBanner(null), 4000);
  };

  // Tính điểm trung bình của 1 đội ở 1 giai đoạn
  const calcStageStats = useCallback((
    teamId: string,
    stage: 'stage_1_zone' | 'stage_2_room' | 'stage_3_cross_room'
  ) => {
    const ballots = peerEvaluations.filter(
      (b) => b.stage === stage && b.targetTeamId === teamId
    );
    if (ballots.length === 0) return { avg: 0, count: 0 };
    const sum = ballots.reduce((acc, b) => acc + b.totalScore, 0);
    return {
      avg: Math.round((sum / ballots.length) * 10) / 10,
      count: ballots.length,
    };
  }, [peerEvaluations]);

  const stage1ZoneRows = useMemo(() => {
    if (!myRoom) return [];
    return myRoom.zones.map((z) => {
      const rows = teams
        .filter((t) => t.roomId === myRoom.id && t.zoneId === z.id)
        .map((t) => ({
          team: t,
          ...calcStageStats(t.id, 'stage_1_zone'),
        }))
        .sort((a, b) => b.avg - a.avg);
      return { zone: z, rows };
    });
  }, [myRoom, teams, calcStageStats]);

  const stage2RoomRows = useMemo(() => {
    if (!myRoom) return [];
    return teams
      .filter((t) => t.roomId === myRoom.id && t.isZoneWinner)
      .map((t) => {
        const z = myRoom.zones.find((zn) => zn.id === t.zoneId);
        return {
          team: t,
          zoneName: z?.name || 'Zone',
          s1: calcStageStats(t.id, 'stage_1_zone'),
          s2: calcStageStats(t.id, 'stage_2_room'),
        };
      })
      .sort((a, b) => b.s2.avg - a.s2.avg || b.s1.avg - a.s1.avg);
  }, [myRoom, teams, calcStageStats]);

  const stage3CrossRoomRows = useMemo(() => {
    return teams
      .filter((t) => t.isRoomWinner)
      .map((t) => {
        const rm = rooms.find((r) => r.id === t.roomId);
        return {
          team: t,
          roomCode: rm?.code || 'ROOM',
          roomName: rm?.name || 'Phòng học',
          s2: calcStageStats(t.id, 'stage_2_room'),
          s3: calcStageStats(t.id, 'stage_3_cross_room'),
        };
      })
      .sort((a, b) => b.s3.avg - a.s3.avg || b.s2.avg - a.s2.avg);
  }, [teams, rooms, calcStageStats]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="indigo">AI THỰC CHIẾN — CHẤM CHÉO 3 GIAI ĐOẠN</Badge>
            {myRoom && <Badge variant="success">{myRoom.code}</Badge>}
            {myZone && <Badge variant="warning">{myZone.name}</Badge>}
          </div>
          <h1 className="font-semibold tracking-tight text-foreground text-2xl sm:text-3xl">
            Chấm Điểm Chéo Giữa Các Đội & Bảng Xếp Hạng 3 Vòng
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Sau khi hết giờ làm bài, các đội thực hiện chấm điểm chéo qua 3 giai đoạn: (1) Chấm trong cùng Zone → Chọn Top 1 mỗi Zone lên thuyết trình Phòng → (2) Chấm cấp Phòng → Chọn Top 1/Top 3 Phòng lên thuyết trình chéo Liên Phòng → (3) Chung kết Liên Phòng.
          </p>
        </div>
      </div>

      {/* Room, Zone & Custom Checkpoint Schedule Banner for Current Team */}
      {myRoom && myTeam && (
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Building2 size={14} />
              <span>Phòng Học & Zone Của Đội Bạn</span>
            </div>
            <div className="text-base font-bold text-foreground">
              {myTeam.name} • {myRoom.name}
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Layers size={13} className="text-amber-500" />
                Khu vực: <strong className="text-foreground">{myZone?.name || 'Zone A'}</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <UserCheck size={13} className="text-emerald-500" />
                Quản lý phòng: <strong className="text-foreground">{myRoom.managerName}</strong>
              </span>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock size={14} className="text-primary" />
              <span>Cấu Hình Khung Giờ Nộp Checkpoint Riêng Của {myRoom.code}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {myRoom.checkpointSchedules.map((sched) => {
                const cp = checkpoints.find((c) => c.id === sched.checkpointId);
                return (
                  <div
                    key={sched.id}
                    className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-foreground line-clamp-1">
                        {cp?.title || cp?.name || sched.checkpointId}
                      </div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                        {new Date(sched.startTime).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        →{' '}
                        {new Date(sched.deadline).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        ({new Date(sched.deadline).toLocaleDateString('vi-VN')})
                      </div>
                    </div>
                    <Badge variant="success" size="sm">
                      Theo ca phòng
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stage Switcher Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setActiveStage('stage_1_zone')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeStage === 'stage_1_zone'
              ? 'border-primary bg-primary/10 shadow-sm'
              : 'border-border bg-card hover:bg-accent/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase text-primary">
              GIAI ĐOẠN 1
            </span>
            <Badge variant="indigo" size="sm">Trong cùng Zone</Badge>
          </div>
          <h3 className="font-bold text-foreground text-sm mt-1">
            Chấm Chéo Nội Bộ Trong Zone
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Các đội trong cùng {myZone?.name || 'Zone'} chấm chéo lẫn nhau → Chọn <strong>Top 1 mỗi Zone</strong> lên thuyết trình Phòng.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveStage('stage_2_room')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeStage === 'stage_2_room'
              ? 'border-primary bg-primary/10 shadow-sm'
              : 'border-border bg-card hover:bg-accent/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase text-amber-500">
              GIAI ĐOẠN 2
            </span>
            <Badge variant="warning" size="sm">Cấp Phòng học</Badge>
          </div>
          <h3 className="font-bold text-foreground text-sm mt-1">
            Thuyết Trình & Chấm Điểm Cấp Phòng
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Top 1 của mỗi Zone lên thuyết trình trước {myRoom?.code} → Chọn <strong>Top {myRoom?.roomTopN || 1} của Phòng</strong>.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setActiveStage('stage_3_cross_room')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
            activeStage === 'stage_3_cross_room'
              ? 'border-primary bg-primary/10 shadow-sm'
              : 'border-border bg-card hover:bg-accent/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase text-emerald-500">
              GIAI ĐOẠN 3
            </span>
            <Badge variant="success" size="sm">Liên Phòng</Badge>
          </div>
          <h3 className="font-bold text-foreground text-sm mt-1">
            Thuyết Trình Chéo Liên Phòng (Chung Cuộc)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Top 1 / Top 3 đại diện mỗi Phòng lên thuyết trình chéo để các thành viên nhóm khác chấm điểm.
          </p>
        </button>
      </div>

      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
          }`}
        >
          {feedbackBanner.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{feedbackBanner.text}</span>
        </div>
      )}

      {/* Peer Evaluation Form + Stage Standings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Peer Grading Ballot Form (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase text-primary font-bold">
                PHIẾU CHẤM ĐIỂM CHÉO ĐỘI BẠN
              </span>
              <h3 className="font-bold text-foreground text-base">
                {activeStage === 'stage_1_zone'
                  ? `Chấm Chéo Trong ${myZone?.name || 'Zone'}`
                  : activeStage === 'stage_2_room'
                  ? `Chấm Đội Top 1 Zone Thuyết Trình (${myRoom?.code})`
                  : 'Chấm Đội Đại Diện Thuyết Trình Chéo Liên Phòng'}
              </h3>
            </div>
            <Sparkles size={18} className="text-primary" />
          </div>

          <p className="text-xs text-muted-foreground">
            Đội chấm điểm: <strong className="text-foreground">{myTeam?.name}</strong> (Hệ thống tự động khóa tự chấm đội mình).
          </p>

          {eligibleTargetTeams.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
              Chưa có đội mục tiêu khả dụng để chấm ở giai đoạn này.
            </div>
          ) : (
            <form onSubmit={handleSubmitPeerBallot} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Chọn đội bạn đang thuyết trình để chấm điểm:
                </label>
                <select
                  value={effectiveTargetTeam?.id || ''}
                  onChange={(e) => setSelectedTargetTeamId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                >
                  {eligibleTargetTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — Đội trưởng: {t.leaderName || 'Thí sinh'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {rubricCriteria.map((crit) => {
                  const val = criteriaScores[crit.id] ?? 0;
                  return (
                    <div
                      key={crit.id}
                      className="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{crit.name}</span>
                        <span className="font-mono font-bold text-primary">
                          {val} / {crit.maxScore}đ (Trọng số {crit.weight}%)
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={crit.maxScore}
                        value={val}
                        onChange={(e) =>
                          handleCriterionChange(crit.id, Number(e.target.value), crit.maxScore)
                        }
                        className="w-full accent-indigo-500 cursor-pointer"
                      />
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Nhận xét & Góp ý cho đội bạn:
                </label>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Nhập nhận xét về giải pháp, demo và phần thuyết trình của đội bạn..."
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground"
                />
              </div>

              <Button type="submit" variant="primary" className="w-full gap-2">
                <Send size={15} />
                <span>Gửi Phiếu Chấm Điểm Chéo Cho {effectiveTargetTeam?.name}</span>
              </Button>
            </form>
          )}
        </div>

        {/* Right: 3-Stage Standings Display (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Stage 1 Standings */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="indigo">VÒNG 1 — KẾT QUẢ TRONG TỪNG ZONE ({myRoom?.code})</Badge>
                <h3 className="font-bold text-foreground text-base mt-1">
                  Bảng Xếp Hạng Chấm Chéo Nội Bộ Zone → Chọn Top 1 Mỗi Zone
                </h3>
              </div>
              <Trophy size={20} className="text-amber-500" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stage1ZoneRows.map(({ zone, rows }) => (
                <div key={zone.id} className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">
                      {zone.name}
                    </span>
                    <Badge variant="neutral" size="sm">{rows.length} đội</Badge>
                  </div>
                  {rows.map((r, idx) => (
                    <div
                      key={r.team.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <span>#{idx + 1} {r.team.name}</span>
                          {r.team.isZoneWinner && (
                            <Badge variant="success" size="sm">
                              <Crown size={10} className="mr-0.5 inline" />
                              Top 1 Zone
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {r.count} phiếu chấm trong Zone
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {r.avg}đ
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Stage 2 Standings */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="warning">VÒNG 2 — THUYẾT TRÌNH CẤP PHÒNG ({myRoom?.code})</Badge>
                <h3 className="font-bold text-foreground text-base mt-1">
                  Top 1 Các Zone Thuyết Trình Trước Phòng → Chọn Top {myRoom?.roomTopN || 1} Phòng
                </h3>
              </div>
              <Award size={20} className="text-primary" />
            </div>

            <div className="space-y-2">
              {stage2RoomRows.map((row, idx) => (
                <div
                  key={row.team.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-primary">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-foreground flex items-center gap-2">
                        <span>{row.team.name}</span>
                        <Badge variant="indigo" size="sm">{row.zoneName}</Badge>
                        {row.team.isRoomWinner && (
                          <Badge variant="success" size="sm">
                            Đại diện Phòng → Vòng 3 Liên Phòng
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Điểm Vòng 1 Zone: {row.s1.avg}đ • {row.s2.count} phiếu chấm cấp Phòng
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {row.s2.avg} / 100
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Stage 3 Cross-Room Grand Final Standings */}
          <div className="rounded-2xl border border-amber-500/40 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="success">VÒNG 3 — THUYẾT TRÌNH CHÉO LIÊN PHÒNG (CHUNG KẾT)</Badge>
                <h3 className="font-bold text-foreground text-base mt-1">
                  Bảng Xếp Hạng Liên Phòng (Top 1 / Top 3 Mỗi Phòng Chấm Chéo)
                </h3>
              </div>
              <Medal size={20} className="text-amber-500" />
            </div>

            <div className="space-y-2">
              {stage3CrossRoomRows.map((row, idx) => (
                <div
                  key={row.team.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                    <div>
                      <div className="font-bold text-foreground flex items-center gap-2">
                        <span>{row.team.name}</span>
                        <Badge variant="indigo" size="sm">{row.roomCode}</Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {row.roomName} • {row.s3.count} phiếu chấm liên phòng
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {row.s3.avg} / 100
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Scoreboard;
