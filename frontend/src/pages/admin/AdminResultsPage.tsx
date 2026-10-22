import React, { useCallback, useMemo, useState } from 'react';
import { useMockStore } from '../../store/useMockStore';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import type { JudgingStage } from '../../types';
import {
  Download,
  Eye,
  EyeOff,
  Trophy,
  CheckCircle2,
  Building2,
  Layers,
  Clock,
  Users,
  Plus,
  Shuffle,
  ArrowRight,
  Crown,
  Sparkles,
  CalendarClock,
  UserCheck,
} from 'lucide-react';

const STAGE_LABELS: Record<JudgingStage, string> = {
  not_started: 'Chưa mở chấm',
  stage_1_zone: 'Giai đoạn 1: Chấm chéo trong Zone',
  stage_2_room: 'Giai đoạn 2: Thuyết trình cấp Phòng (Top 1 mỗi Zone)',
  stage_3_cross_room: 'Giai đoạn 3: Thuyết trình chéo Liên Phòng (Top 1 / Top 3 Phòng)',
  completed: 'Đã hoàn tất 3 giai đoạn chấm',
};

export const AdminResultsPage: React.FC = () => {
  const {
    teams,
    rooms,
    checkpoints,
    peerEvaluations,
    config,
    toggleResultsPublished,
    addRoom,
    addZoneToRoom,
    assignTeamToRoomZone,
    autoDivideRoomZones,
    upsertRoomCheckpointSchedule,
    advanceRoomJudgingStage,
  } = useMockStore();

  const [activeTab, setActiveTab] = useState<'rooms_zones' | 'three_stage_results'>('rooms_zones');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || 'room-ca-1');
  const [alert, setAlert] = useState<string | null>(null);

  // Form tạo Phòng học / Ca thi mới
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomManager, setNewRoomManager] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState(45);
  const [newRoomTopN, setNewRoomTopN] = useState<1 | 3>(1);
  const [newRoomZoneCount, setNewRoomZoneCount] = useState(3);
  const [newRoomStart, setNewRoomStart] = useState('2026-11-01T18:00');
  const [newRoomEnd, setNewRoomEnd] = useState('2026-11-01T22:00');

  // Form thêm Zone
  const [newZoneName, setNewZoneName] = useState('');

  // Form cấu hình Checkpoint riêng cho Phòng
  const [schedCpId, setSchedCpId] = useState(checkpoints[0]?.id || 'cp-01');
  const [schedStart, setSchedStart] = useState('2026-11-01T08:15');
  const [schedDeadline, setSchedDeadline] = useState('2026-11-01T10:00');

  const notify = (msg: string) => {
    setAlert(msg);
    setTimeout(() => setAlert(null), 4000);
  };

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) || rooms[0],
    [rooms, selectedRoomId]
  );

  // Điểm trung bình theo từng giai đoạn chấm chéo
  const getStageStats = useCallback((teamId: string, stage: 'stage_1_zone' | 'stage_2_room' | 'stage_3_cross_room') => {
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

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomCode.trim() || !newRoomName.trim()) return;
    addRoom({
      code: newRoomCode,
      name: newRoomName,
      managerName: newRoomManager || 'Quản lý phòng BTC',
      capacity: newRoomCapacity,
      startTime: new Date(newRoomStart).toISOString(),
      endTime: new Date(newRoomEnd).toISOString(),
      roomTopN: newRoomTopN,
      zoneCount: newRoomZoneCount,
    });
    setNewRoomCode('');
    setNewRoomName('');
    setNewRoomManager('');
    notify(`Đã tạo phòng học AI Thực Chiến "${newRoomName}" kèm ${newRoomZoneCount} Zone chấm chéo!`);
  };

  const handleAddZone = () => {
    if (!selectedRoom || !newZoneName.trim()) return;
    addZoneToRoom(selectedRoom.id, newZoneName, 5);
    setNewZoneName('');
    notify(`Đã thêm Zone "${newZoneName}" vào ${selectedRoom.name}.`);
  };

  const handleAutoDivide = () => {
    if (!selectedRoom) return;
    autoDivideRoomZones(selectedRoom.id);
    notify(`Đã tự động chia đều các đội trong "${selectedRoom.name}" vào ${selectedRoom.zones.length} Zone!`);
  };

  const handleSaveRoomCheckpointSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !schedCpId) return;
    upsertRoomCheckpointSchedule(
      selectedRoom.id,
      schedCpId,
      new Date(schedStart).toISOString(),
      new Date(schedDeadline).toISOString(),
      true
    );
    notify(`Đã lưu cấu hình khung giờ nộp Checkpoint riêng cho "${selectedRoom.name}".`);
  };

  const handleAdvanceStage = (targetStage: JudgingStage, customTopN?: number) => {
    if (!selectedRoom) return;
    advanceRoomJudgingStage(selectedRoom.id, targetStage, customTopN);
    if (targetStage === 'stage_2_room') {
      notify(
        `Đã chốt Top 1 của mỗi Zone trong "${selectedRoom.name}" và mở Giai đoạn 2 (Thuyết trình cấp Phòng)!`
      );
    } else if (targetStage === 'stage_3_cross_room') {
      const topN = customTopN ?? selectedRoom.roomTopN;
      notify(
        `Đã chốt Top ${topN} của "${selectedRoom.name}" và mở Giai đoạn 3 (Thuyết trình chéo Liên Phòng)!`
      );
    } else {
      notify(`Đã chuyển "${selectedRoom.name}" sang trạng thái: ${STAGE_LABELS[targetStage]}`);
    }
  };

  const handleExportCsv = () => {
    notify('Đã xuất báo cáo kết quả Chấm chéo 3 Giai đoạn: AI_Thuc_Chien_3Stage_Results_2026.csv');
  };

  // Standings cho Giai đoạn 1, 2, 3
  const stage1ByZone = useMemo(() => {
    if (!selectedRoom) return [];
    return selectedRoom.zones.map((zone) => {
      const zoneTeams = teams
        .filter((t) => t.roomId === selectedRoom.id && t.zoneId === zone.id)
        .map((t) => ({
          team: t,
          ...getStageStats(t.id, 'stage_1_zone'),
        }))
        .sort((a, b) => b.avg - a.avg);
      return { zone, rows: zoneTeams };
    });
  }, [selectedRoom, teams, getStageStats]);

  const stage2RoomRows = useMemo(() => {
    if (!selectedRoom) return [];
    return teams
      .filter((t) => t.roomId === selectedRoom.id && t.isZoneWinner)
      .map((t) => {
        const z = selectedRoom.zones.find((zn) => zn.id === t.zoneId);
        return {
          team: t,
          zoneName: z?.name || 'Zone',
          s1: getStageStats(t.id, 'stage_1_zone'),
          s2: getStageStats(t.id, 'stage_2_room'),
        };
      })
      .sort((a, b) => b.s2.avg - a.s2.avg || b.s1.avg - a.s1.avg);
  }, [selectedRoom, teams, getStageStats]);

  const stage3CrossRoomRows = useMemo(() => {
    return teams
      .filter((t) => t.isRoomWinner)
      .map((t) => {
        const rm = rooms.find((r) => r.id === t.roomId);
        const zn = rm?.zones.find((z) => z.id === t.zoneId);
        return {
          team: t,
          roomName: rm?.name || 'Phòng thi',
          roomCode: rm?.code || 'ROOM',
          zoneName: zn?.name || 'Zone',
          s2: getStageStats(t.id, 'stage_2_room'),
          s3: getStageStats(t.id, 'stage_3_cross_room'),
        };
      })
      .sort((a, b) => b.s3.avg - a.s3.avg || b.s2.avg - a.s2.avg);
  }, [teams, rooms, getStageStats]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="indigo">MÔ HÌNH VẬN HÀNH AI THỰC CHIẾN</Badge>
            <Badge variant={config.resultsPublished ? 'success' : 'warning'}>
              {config.resultsPublished ? 'Đã công bố kết quả' : 'Chế độ điều phối nội bộ'}
            </Badge>
          </div>
          <h1 className="font-semibold tracking-tight text-foreground text-2xl sm:text-3xl">
            Điều Phối Phòng / Zone & Chấm Chéo 3 Giai Đoạn
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Nhiều lớp/phòng thi khác khung giờ nhưng dùng chung Đề thi & Tài nguyên Mentor • Chia Zone chấm chéo nội bộ (Top 1 Zone) → Thuyết trình cấp Phòng (Top 1 hoặc Top 3 Phòng) → Thuyết trình chéo Liên Phòng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="secondary" onClick={handleExportCsv} className="gap-2">
            <Download size={16} />
            <span>Xuất Biên Bản 3 Vòng (CSV)</span>
          </Button>

          <Button
            variant="primary"
            onClick={toggleResultsPublished}
            className="gap-2 shadow-lg shadow-[#6366F1]/20"
          >
            {config.resultsPublished ? <EyeOff size={16} /> : <Eye size={16} />}
            <span>
              {config.resultsPublished ? 'Tạm Khóa Kết Quả' : 'Công Bố Bảng Xếp Hạng'}
            </span>
          </Button>
        </div>
      </div>

      {alert && (
        <div className="p-3.5 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 size={15} />
          <span>{alert}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('rooms_zones')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'rooms_zones'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 size={16} />
          <span>1. Quản Lý Phòng Học, Chia Zone & Lịch Checkpoint Theo Phòng</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('three_stage_results')}
          className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'three_stage_results'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-card border border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Trophy size={16} />
          <span>2. Bảng Điểm Chấm Chéo 3 Giai Đoạn (Zone → Phòng → Liên Phòng)</span>
        </button>
      </div>

      {/* Room Selector Pills */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Building2 size={14} className="text-primary" />
            <span>Chọn Lớp / Phòng học AI Thực Chiến đang điều phối:</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Tất cả các phòng dùng chung Ngân hàng Đề thi & Đội ngũ Mentor hỗ trợ
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rooms.map((rm) => {
            const isSelected = rm.id === selectedRoom?.id;
            const rmTeams = teams.filter((t) => t.roomId === rm.id);
            return (
              <div
                key={rm.id}
                onClick={() => setSelectedRoomId(rm.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border bg-muted/30 hover:bg-accent/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-mono font-bold text-primary">
                      {rm.code}
                    </span>
                    <h3 className="font-bold text-foreground text-sm mt-0.5">
                      {rm.name}
                    </h3>
                  </div>
                  <Badge variant={rm.judgingStage === 'stage_3_cross_room' ? 'success' : 'indigo'}>
                    Top {rm.roomTopN} Phòng
                  </Badge>
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <UserCheck size={13} className="text-emerald-500 shrink-0" />
                    <span>Quản lý: <strong className="text-foreground">{rm.managerName}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users size={13} className="text-indigo-400 shrink-0" />
                    <span>
                      Sức chứa: <strong className="text-foreground">{rm.capacity} người</strong> •{' '}
                      <strong className="text-foreground">{rmTeams.length} đội</strong> trong{' '}
                      <strong className="text-foreground">{rm.zones.length} Zone</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-amber-500 shrink-0" />
                    <span>{STAGE_LABELS[rm.judgingStage]}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeTab === 'rooms_zones' && selectedRoom && (
        <div className="space-y-6">
          {/* 3-Stage Progression Controller for Selected Room */}
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-primary" />
                  <h3 className="font-bold text-foreground text-base">
                    Bộ Điều Khiển 3 Giai Đoạn Chấm Chéo — {selectedRoom.name}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Trạng thái hiện tại: <strong className="text-primary">{STAGE_LABELS[selectedRoom.judgingStage]}</strong> • Cấu hình chọn{' '}
                  <strong className="text-foreground">Top {selectedRoom.roomTopN} đội của Phòng</strong> đi tiếp lên thuyết trình chéo Liên Phòng.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={selectedRoom.judgingStage === 'stage_1_zone' ? 'primary' : 'secondary'}
                  onClick={() => handleAdvanceStage('stage_1_zone')}
                >
                  Vòng 1: Chấm trong Zone
                </Button>
                <ArrowRight size={14} className="text-muted-foreground hidden sm:inline" />
                <Button
                  size="sm"
                  variant={selectedRoom.judgingStage === 'stage_2_room' ? 'primary' : 'secondary'}
                  onClick={() => handleAdvanceStage('stage_2_room')}
                >
                  Chốt Top 1 Mỗi Zone → Vòng 2 (Cấp Phòng)
                </Button>
                <ArrowRight size={14} className="text-muted-foreground hidden sm:inline" />
                <Button
                  size="sm"
                  variant={
                    selectedRoom.judgingStage === 'stage_3_cross_room' && selectedRoom.roomTopN === 1
                      ? 'primary'
                      : 'secondary'
                  }
                  onClick={() => handleAdvanceStage('stage_3_cross_room', 1)}
                >
                  Chốt Top 1 Phòng → Vòng 3 (Liên Phòng)
                </Button>
                <Button
                  size="sm"
                  variant={
                    selectedRoom.judgingStage === 'stage_3_cross_room' && selectedRoom.roomTopN === 3
                      ? 'primary'
                      : 'secondary'
                  }
                  onClick={() => handleAdvanceStage('stage_3_cross_room', 3)}
                >
                  Chốt Top 3 Phòng → Vòng 3 (Liên Phòng)
                </Button>
              </div>
            </div>
          </div>

          {/* Zone Partitioning & Team Assignment inside Selected Room */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                    <Layers size={18} className="text-primary" />
                    <span>Phân Chia Các Zone Chấm Chéo Trong {selectedRoom.code}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Trong mỗi Zone, các đội sẽ chấm điểm chéo cho nhau sau khi hết giờ. Top 1 mỗi Zone sẽ bước lên thuyết trình trước toàn Phòng.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={handleAutoDivide} className="gap-1.5">
                    <Shuffle size={14} />
                    <span>Chia Đều Đội Vào Zone</span>
                  </Button>
                </div>
              </div>

              {/* Add Zone Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="Nhập tên Zone mới (VD: Zone C - Cụm Bàn 9-12)..."
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                />
                <Button size="sm" variant="secondary" onClick={handleAddZone} className="gap-1">
                  <Plus size={14} />
                  <span>Thêm Zone</span>
                </Button>
              </div>

              {/* Zone Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedRoom.zones.map((zone) => {
                  const zTeams = teams.filter(
                    (t) => t.roomId === selectedRoom.id && t.zoneId === zone.id
                  );
                  return (
                    <div
                      key={zone.id}
                      className="rounded-xl border border-border bg-muted/20 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-primary font-bold">
                            {zone.code}
                          </span>
                          <h4 className="font-bold text-sm text-foreground">{zone.name}</h4>
                        </div>
                        <Badge variant="neutral">
                          {zTeams.length} / {zone.maxTeams} đội
                        </Badge>
                      </div>

                      {zTeams.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-2">
                          Chưa có đội nào trong Zone này.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {zTeams.map((t) => {
                            const s1 = getStageStats(t.id, 'stage_1_zone');
                            return (
                              <div
                                key={t.id}
                                className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs"
                              >
                                <div>
                                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                                    <span>{t.name}</span>
                                    {t.isZoneWinner && (
                                      <Badge variant="success" size="sm">
                                        <Crown size={11} className="mr-1 inline" />
                                        Top 1 Zone
                                      </Badge>
                                    )}
                                    {t.isRoomWinner && (
                                      <Badge variant="indigo" size="sm">
                                        Đại diện Phòng
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    Đội trưởng: {t.leaderName || 'Thí sinh'}
                                  </div>
                                </div>
                                <div className="text-right font-mono">
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {s1.avg}đ
                                  </span>
                                  <span className="block text-[10px] text-muted-foreground">
                                    {s1.count} phiếu Zone
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Manual Team -> Room & Zone Assignment Table */}
              <div className="pt-3 border-t border-border space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Phân bổ Đội thi vào Phòng học & Zone
                </h4>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">Đội Thi</th>
                        <th className="py-2.5 px-3">Phòng Học (Lớp)</th>
                        <th className="py-2.5 px-3">Zone Chấm Chéo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {teams.map((t) => {
                        const teamRoom = rooms.find((r) => r.id === t.roomId);
                        const availableZones = teamRoom?.zones || [];
                        return (
                          <tr key={t.id} className="hover:bg-accent/40">
                            <td className="py-2 px-3 font-semibold text-foreground">
                              {t.name}
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={t.roomId || ''}
                                onChange={(e) => {
                                  const nextRoomId = e.target.value || undefined;
                                  const nextRoom = rooms.find((r) => r.id === nextRoomId);
                                  assignTeamToRoomZone(
                                    t.id,
                                    nextRoomId,
                                    nextRoom?.zones[0]?.id
                                  );
                                }}
                                className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                              >
                                <option value="">-- Chưa xếp phòng --</option>
                                {rooms.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.code} — {r.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={t.zoneId || ''}
                                onChange={(e) =>
                                  assignTeamToRoomZone(
                                    t.id,
                                    t.roomId,
                                    e.target.value || undefined
                                  )
                                }
                                className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                              >
                                <option value="">-- Chọn Zone --</option>
                                {availableZones.map((z) => (
                                  <option key={z.id} value={z.id}>
                                    {z.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: Per-Room Checkpoint Schedule + Create Room Form */}
            <div className="space-y-6">
              {/* Per-Room Checkpoint Schedule Config */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                    <CalendarClock size={18} className="text-primary" />
                    <span>Lịch Nộp Checkpoint Riêng — {selectedRoom.code}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mỗi phòng bắt đầu ở khung giờ khác nhau nên có cấu hình thời gian mở/đóng Checkpoint riêng biệt.
                  </p>
                </div>

                <div className="space-y-2">
                  {checkpoints.map((cp) => {
                    const customSched = selectedRoom.checkpointSchedules.find(
                      (s) => s.checkpointId === cp.id
                    );
                    return (
                      <div
                        key={cp.id}
                        className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1"
                      >
                        <div className="font-semibold text-foreground">
                          {cp.title || cp.name}
                        </div>
                        {customSched ? (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                            Lịch riêng phòng: {new Date(customSched.startTime).toLocaleString('vi-VN')} →{' '}
                            {new Date(customSched.deadline).toLocaleString('vi-VN')}
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground">
                            Đang dùng lịch mặc định toàn cục
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleSaveRoomCheckpointSchedule} className="space-y-3 pt-2 border-t border-border">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Chọn Checkpoint cần ghi đè giờ nộp cho {selectedRoom.code}
                    </label>
                    <select
                      value={schedCpId}
                      onChange={(e) => setSchedCpId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                    >
                      {checkpoints.map((cp) => (
                        <option key={cp.id} value={cp.id}>
                          {cp.title || cp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-0.5">
                        Giờ mở cổng nộp của phòng
                      </label>
                      <input
                        type="datetime-local"
                        value={schedStart}
                        onChange={(e) => setSchedStart(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-0.5">
                        Hạn chót (Deadline) của phòng
                      </label>
                      <input
                        type="datetime-local"
                        value={schedDeadline}
                        onChange={(e) => setSchedDeadline(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
                      />
                    </div>
                  </div>
                  <Button type="submit" size="sm" variant="primary" className="w-full">
                    Lưu Khung Giờ Checkpoint Cho Phòng Này
                  </Button>
                </form>
              </div>

              {/* Create New Classroom / Room Form */}
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                    <Plus size={18} className="text-primary" />
                    <span>Tạo Phòng / Lớp Học AI Thực Chiến Mới</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mở thêm ca thi / lớp học mới với người quản lý, sĩ số và cấu hình Top 1 hoặc Top 3 riêng.
                  </p>
                </div>

                <form onSubmit={handleCreateRoom} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Mã Phòng</label>
                      <input
                        type="text"
                        value={newRoomCode}
                        onChange={(e) => setNewRoomCode(e.target.value)}
                        placeholder="VD: AI-TC-CA3"
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Sức chứa (người)</label>
                      <input
                        type="number"
                        value={newRoomCapacity}
                        onChange={(e) => setNewRoomCapacity(Number(e.target.value))}
                        min={10}
                        max={300}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Tên Lớp / Phòng Thi</label>
                    <input
                      type="text"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="VD: Lớp AI Thực Chiến - Ca Tối (Phòng 501)"
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Người Quản Lý Phòng</label>
                    <input
                      type="text"
                      value={newRoomManager}
                      onChange={(e) => setNewRoomManager(e.target.value)}
                      placeholder="VD: ThS. Nguyễn Quản Lý Phòng"
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Số Zone khởi tạo</label>
                      <input
                        type="number"
                        value={newRoomZoneCount}
                        onChange={(e) => setNewRoomZoneCount(Number(e.target.value))}
                        min={1}
                        max={8}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Đại diện lên Liên Phòng</label>
                      <select
                        value={newRoomTopN}
                        onChange={(e) => setNewRoomTopN(Number(e.target.value) as 1 | 3)}
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                      >
                        <option value={1}>Top 1 của Phòng</option>
                        <option value={3}>Top 3 của Phòng</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Bắt đầu ca thi</label>
                      <input
                        type="datetime-local"
                        value={newRoomStart}
                        onChange={(e) => setNewRoomStart(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Kết thúc ca thi</label>
                      <input
                        type="datetime-local"
                        value={newRoomEnd}
                        onChange={(e) => setNewRoomEnd(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[11px]"
                      />
                    </div>
                  </div>

                  <Button type="submit" variant="primary" size="sm" className="w-full">
                    Khởi Tạo Phòng & Chia Zone Mặc Định
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'three_stage_results' && (
        <div className="space-y-6">
          {/* Stage 1: Intra-Zone Standings */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <Badge variant="indigo">GIAI ĐOẠN 1 — CHẤM CHÉO TRONG ZONE</Badge>
                <h3 className="font-bold text-foreground text-lg mt-1">
                  Kết Quả Chấm Chéo Nội Bộ Từng Zone ({selectedRoom?.name})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Các đội trong cùng một Zone chấm điểm chéo cho nhau. Đội Top 1 của mỗi Zone sẽ bước lên thuyết trình trước toàn Phòng ở Giai đoạn 2.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stage1ByZone.map(({ zone, rows }) => (
                <div key={zone.id} className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-foreground">
                      {zone.name} ({zone.code})
                    </h4>
                    <Badge variant="neutral">{rows.length} đội</Badge>
                  </div>
                  <div className="space-y-2">
                    {rows.map((r, idx) => (
                      <div
                        key={r.team.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-muted-foreground">
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span>{r.team.name}</span>
                              {r.team.isZoneWinner && (
                                <Badge variant="success" size="sm">
                                  Top 1 Zone → Lên thuyết trình Phòng
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {r.count} phiếu chấm trong Zone
                            </span>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {r.avg} / 100
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stage 2: Room Presentation Standings */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div>
              <Badge variant="warning">GIAI ĐOẠN 2 — THUYẾT TRÌNH CẤP PHÒNG</Badge>
              <h3 className="font-bold text-foreground text-lg mt-1">
                Bảng Xếp Hạng Thuyết Trình Cấp Phòng ({selectedRoom?.name})
              </h3>
              <p className="text-xs text-muted-foreground">
                Các đội Top 1 của mỗi Zone thuyết trình trước toàn Phòng để các đội khác trong Phòng chấm điểm. Chọn{' '}
                <strong>Top {selectedRoom?.roomTopN || 1} của Phòng</strong> đi tiếp vào Vòng Thuyết trình chéo Liên Phòng.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase">
                  <tr>
                    <th className="py-3 px-4 w-16 text-center">Hạng</th>
                    <th className="py-3 px-4">Đội Thuyết Trình (Top 1 Zone)</th>
                    <th className="py-3 px-4">Đại Diện Zone</th>
                    <th className="py-3 px-4 text-center">Điểm Vòng 1 (Zone)</th>
                    <th className="py-3 px-4 text-center">Số Phiếu Cấp Phòng</th>
                    <th className="py-3 px-4 text-right">Điểm TB Cấp Phòng</th>
                    <th className="py-3 px-4 text-center">Kết Quả Đi Tiếp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stage2RoomRows.map((row, idx) => (
                    <tr key={row.team.id} className="hover:bg-accent/40">
                      <td className="py-3 px-4 text-center font-bold">#{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-foreground">{row.team.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{row.zoneName}</td>
                      <td className="py-3 px-4 text-center font-mono">{row.s1.avg}</td>
                      <td className="py-3 px-4 text-center">{row.s2.count} phiếu</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {row.s2.avg} / 100
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.team.isRoomWinner ? (
                          <Badge variant="success">
                            Đại diện Phòng → Lên Vòng 3 Liên Phòng
                          </Badge>
                        ) : (
                          <Badge variant="neutral">Dừng tại cấp Phòng</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stage 3: Cross-Room Grand Final Standings */}
          <div className="rounded-2xl border border-amber-500/40 bg-card p-6 space-y-4">
            <div>
              <Badge variant="success">GIAI ĐOẠN 3 — THUYẾT TRÌNH CHÉO LIÊN PHÒNG (CHUNG CUỘC)</Badge>
              <h3 className="font-bold text-foreground text-lg mt-1">
                Bảng Xếp Hạng Chung Cuộc Liên Phòng (Top 1 / Top 3 Các Phòng Thi Đấu Chéo)
              </h3>
              <p className="text-xs text-muted-foreground">
                Các đội xuất sắc nhất đại diện từng Phòng thuyết trình chéo để thành viên các nhóm thuộc các Phòng khác chấm điểm.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase">
                  <tr>
                    <th className="py-3 px-4 w-16 text-center">Hạng</th>
                    <th className="py-3 px-4">Đội Thi Đại Diện</th>
                    <th className="py-3 px-4">Phòng / Lớp Học</th>
                    <th className="py-3 px-4 text-center">Điểm Cấp Phòng (Vòng 2)</th>
                    <th className="py-3 px-4 text-center">Số Phiếu Liên Phòng</th>
                    <th className="py-3 px-4 text-right">Điểm Chung Cuộc (Vòng 3)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stage3CrossRoomRows.map((row, idx) => (
                    <tr key={row.team.id} className="hover:bg-accent/40">
                      <td className="py-3.5 px-4 text-center font-bold">
                        {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-foreground">{row.team.name}</td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        <Badge variant="indigo" size="sm">{row.roomCode}</Badge>{' '}
                        <span>{row.roomName}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">{row.s2.avg}</td>
                      <td className="py-3.5 px-4 text-center">{row.s3.count} phiếu liên phòng</td>
                      <td className="py-3.5 px-4 text-right font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {row.s3.avg} / 100
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
