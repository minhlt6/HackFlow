import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Users,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  X,
  Download,
  AlertTriangle,
  FolderPlus,
} from 'lucide-react';

interface SubtopicStatsItem {
  topic_id: string;
  topic_name: string;
  subtopic_id: string;
  subtopic_name: string;
  mentor_names: string[];
  max_teams: number;
  current_registered_count: number;
  status: 'empty' | 'available' | 'almost_full' | 'full';
  registered_teams: Array<{
    team_id: string;
    team_name: string;
    selected_at: string;
  }>;
}

interface TeamWithoutTopic {
  id: string;
  name: string;
  leader_email: string;
  leader_name?: string;
  members_count: number;
  created_at: string;
}

interface TopicsStatsData {
  summary: {
    total_approved_teams: number;
    teams_with_topic: number;
    teams_without_topic_count: number;
    total_subtopics: number;
    empty_subtopics: number;
    almost_full_subtopics: number;
    full_subtopics: number;
  };
  subtopics: SubtopicStatsItem[];
  teams_without_topic: TeamWithoutTopic[];
}

interface AdminTopicItem {
  id: string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  subtopics: Array<{
    id: string;
    topic_id: string;
    name: string;
    description?: string;
    sample_data_url?: string;
    reference_links: string[];
    max_teams: number;
    current_registered_count: number;
    display_order: number;
    is_active: boolean;
    mentors: Array<{ id: string; full_name: string; email: string }>;
  }>;
}

export const AdminTopicsPanel: React.FC = () => {
  const [statsData, setStatsData] = useState<TopicsStatsData | null>(null);
  const [topics, setTopics] = useState<AdminTopicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tab view: 'manage' | 'stats' | 'no_topic'
  const [activeSubTab, setActiveSubTab] = useState<'manage' | 'stats' | 'no_topic'>('manage');
  const [expandedTopicIds, setExpandedTopicIds] = useState<Record<string, boolean>>({});
  const [expandedSubtopicIds, setExpandedSubtopicIds] = useState<Record<string, boolean>>({});

  // Modals
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicName, setTopicName] = useState('');
  const [topicDesc, setTopicDesc] = useState('');
  const [topicOrder, setTopicOrder] = useState(0);

  const [showSubtopicModal, setShowSubtopicModal] = useState(false);
  const [parentTopicId, setParentTopicId] = useState<string>('');
  const [editingSubtopicId, setEditingSubtopicId] = useState<string | null>(null);
  const [subtopicName, setSubtopicName] = useState('');
  const [subtopicDesc, setSubtopicDesc] = useState('');
  const [subtopicMaxTeams, setSubtopicMaxTeams] = useState(3);
  const [subtopicDataUrl, setSubtopicDataUrl] = useState('');
  const [subtopicLinks, setSubtopicLinks] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, topicsRes] = await Promise.all([
        apiClient.get('/admin/topics/stats'),
        apiClient.get('/admin/topics'),
      ]);
      if (statsRes.data?.success) setStatsData(statsRes.data.data);
      if (topicsRes.data?.success) {
        setTopics(topicsRes.data.data);
        // Default expand all topics
        const exp: Record<string, boolean> = {};
        topicsRes.data.data.forEach((t: AdminTopicItem) => {
          exp[t.id] = true;
        });
        setExpandedTopicIds(exp);
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Không thể tải dữ liệu đề tài.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleTopic = (id: string) => {
    setExpandedTopicIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSubtopic = (id: string) => {
    setExpandedSubtopicIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Open Topic Modal
  const openCreateTopic = () => {
    setEditingTopicId(null);
    setTopicName('');
    setTopicDesc('');
    setTopicOrder(topics.length + 1);
    setShowTopicModal(true);
  };

  const openEditTopic = (t: AdminTopicItem) => {
    setEditingTopicId(t.id);
    setTopicName(t.name);
    setTopicDesc(t.description || '');
    setTopicOrder(t.display_order);
    setShowTopicModal(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingTopicId) {
        await apiClient.put(`/admin/topics/${editingTopicId}`, {
          name: topicName.trim(),
          description: topicDesc.trim() || undefined,
          display_order: Number(topicOrder),
        });
        setMessage({ type: 'success', text: 'Đã cập nhật chủ đề lớn thành công.' });
      } else {
        await apiClient.post('/admin/topics', {
          name: topicName.trim(),
          description: topicDesc.trim() || undefined,
          display_order: Number(topicOrder),
        });
        setMessage({ type: 'success', text: 'Đã tạo chủ đề lớn mới thành công.' });
      }
      setShowTopicModal(false);
      fetchData();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Lưu chủ đề thất bại.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTopic = async (id: string, name: string) => {
    if (!window.confirm(`Xác nhận XÓA chủ đề "${name}"? Toàn bộ chủ đề nhỏ bên trong cũng sẽ bị xóa.`)) {
      return;
    }
    try {
      await apiClient.delete(`/admin/topics/${id}`);
      setMessage({ type: 'success', text: `Đã xóa chủ đề "${name}".` });
      fetchData();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Xóa thất bại.' });
    }
  };

  // Open Subtopic Modal
  const openCreateSubtopic = (topId: string) => {
    setParentTopicId(topId);
    setEditingSubtopicId(null);
    setSubtopicName('');
    setSubtopicDesc('');
    setSubtopicMaxTeams(3);
    setSubtopicDataUrl('');
    setSubtopicLinks('');
    setShowSubtopicModal(true);
  };

  const openEditSubtopic = (st: any) => {
    setParentTopicId(st.topic_id);
    setEditingSubtopicId(st.id);
    setSubtopicName(st.name);
    setSubtopicDesc(st.description || '');
    setSubtopicMaxTeams(st.max_teams);
    setSubtopicDataUrl(st.sample_data_url || '');
    setSubtopicLinks((st.reference_links || []).join('\n'));
    setShowSubtopicModal(true);
  };

  const handleSaveSubtopic = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const refLinks = subtopicLinks
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const payload = {
      name: subtopicName.trim(),
      description: subtopicDesc.trim() || undefined,
      max_teams: Number(subtopicMaxTeams),
      sample_data_url: subtopicDataUrl.trim() || undefined,
      reference_links: refLinks,
    };

    try {
      if (editingSubtopicId) {
        await apiClient.put(`/admin/subtopics/${editingSubtopicId}`, payload);
        setMessage({ type: 'success', text: 'Đã cập nhật chủ đề nhỏ thành công.' });
      } else {
        await apiClient.post(`/admin/topics/${parentTopicId}/subtopics`, payload);
        setMessage({ type: 'success', text: 'Đã thêm chủ đề nhỏ mới thành công.' });
      }
      setShowSubtopicModal(false);
      fetchData();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Lưu thất bại.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubtopic = async (id: string, name: string) => {
    if (!window.confirm(`Xác nhận XÓA chủ đề nhỏ "${name}"?`)) return;
    try {
      await apiClient.delete(`/admin/subtopics/${id}`);
      setMessage({ type: 'success', text: `Đã xóa chủ đề nhỏ "${name}".` });
      fetchData();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Xóa thất bại.' });
    }
  };

  const handleExportNoTopicCSV = () => {
    if (!statsData?.teams_without_topic || statsData.teams_without_topic.length === 0) {
      alert('Không có đội nào chưa chọn đề tài.');
      return;
    }
    let csv = 'data:text/csv;charset=utf-8,ID,Ten_Doi,Email_Nhom_Truong,So_Thanh_Vien,Ngay_Dang_Ky\n';
    statsData.teams_without_topic.forEach((t) => {
      csv += `"${t.id}","${t.name}","${t.leader_email}",${t.members_count},"${t.created_at}"\n`;
    });
    const encoded = encodeURI(csv);
    const link = document.createElement('a');
    link.href = encoded;
    link.download = `doi_chua_chon_de_tai_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (loading && !statsData) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <span>Quản Lý &amp; Thống Kê Đề Tài Thi</span>
          </h2>
          <p className="text-sm text-slate-400">
            Cấu hình chủ đề lớn, chủ đề nhỏ, giới hạn số nhóm và theo dõi phân bố đăng ký theo thời gian thực.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateTopic}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-950/50 transition"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Tạo Chủ Đề Lớn</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center space-x-2 p-3.5 rounded-xl border text-sm ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Summary KPI Stats */}
      {statsData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 uppercase font-semibold">Đã Chọn Đề Tài</span>
            <div className="text-2xl font-black text-white mt-1 font-mono">
              {statsData.summary.teams_with_topic}
              <span className="text-sm text-slate-500 font-normal">
                /{statsData.summary.total_approved_teams} đội
              </span>
            </div>
            <span className="text-[11px] text-emerald-400 mt-0.5 block">
              {statsData.summary.total_approved_teams > 0
                ? `${Math.round(
                    (statsData.summary.teams_with_topic / statsData.summary.total_approved_teams) * 100
                  )}% đã chọn`
                : '0%'}
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 uppercase font-semibold">Chưa Chọn Đề Tài</span>
            <div className="text-2xl font-black text-amber-400 mt-1 font-mono">
              {statsData.summary.teams_without_topic_count}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Đội cần gửi nhắc nhở</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 uppercase font-semibold">Chủ Đề Nhỏ Trống</span>
            <div className="text-2xl font-black text-slate-300 mt-1 font-mono">
              {statsData.summary.empty_subtopics}
              <span className="text-sm text-slate-500 font-normal">
                /{statsData.summary.total_subtopics}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Chưa có đội nào chọn</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-xs text-slate-400 uppercase font-semibold">Đã Hết Suất</span>
            <div className="text-2xl font-black text-rose-400 mt-1 font-mono">
              {statsData.summary.full_subtopics}
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {statsData.summary.almost_full_subtopics} đề tài gần hết
            </span>
          </div>
        </div>
      )}

      {/* Sub-tab navigation */}
      <div className="flex space-x-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubTab('manage')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition-none ${
            activeSubTab === 'manage'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent font-medium'
          }`}
        >
          Cấu Trúc &amp; Quản Lý ({topics.length} Chủ Đề Lớn)
        </button>
        <button
          onClick={() => setActiveSubTab('stats')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition-none ${
            activeSubTab === 'stats'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent font-medium'
          }`}
        >
          Thống Kê Chi Tiết ({statsData?.subtopics.length || 0} Đề Tài)
        </button>
        <button
          onClick={() => setActiveSubTab('no_topic')}
          className={`px-3.5 py-1.5 rounded-lg text-xs transition-none flex items-center space-x-1.5 ${
            activeSubTab === 'no_topic'
              ? 'bg-amber-50 text-amber-800 border border-amber-300 font-bold shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent font-medium'
          }`}
        >
          <span>Đội Chưa Chọn Đề Tài</span>
          {statsData && statsData.summary.teams_without_topic_count > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold text-[10px]">
              {statsData.summary.teams_without_topic_count}
            </span>
          )}
        </button>
      </div>

      {/* ── Sub-tab: Quản Lý ──────────────────────────────────── */}
      {activeSubTab === 'manage' && (
        <div className="space-y-4">
          {topics.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500">
              Chưa có chủ đề nào được tạo. Nhấn "Tạo Chủ Đề Lớn" để bắt đầu.
            </div>
          ) : (
            topics.map((t) => {
              const isExpanded = !!expandedTopicIds[t.id];
              return (
                <div
                  key={t.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
                >
                  {/* Topic Header Bar */}
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-slate-950/60 border-b border-slate-800/80">
                    <button
                      onClick={() => toggleTopic(t.id)}
                      className="flex items-center space-x-3 text-left flex-1"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-blue-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            #{t.display_order}
                          </span>
                          <h3 className="font-bold text-white text-base">{t.name}</h3>
                          <span className="text-xs text-slate-400">
                            ({t.subtopics.length} chủ đề con)
                          </span>
                        </div>
                        {t.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                            {t.description}
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => openCreateSubtopic(t.id)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-semibold border border-emerald-500/30"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm Subtopic</span>
                      </button>
                      <button
                        onClick={() => openEditTopic(t)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400"
                        title="Sửa chủ đề lớn"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTopic(t.id, t.name)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400"
                        title="Xóa chủ đề lớn"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subtopics List */}
                  {isExpanded && (
                    <div className="p-4 space-y-3">
                      {t.subtopics.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl">
                          Chưa có chủ đề nhỏ nào trong mục này. Nhấn "Thêm Subtopic" để tạo đề tài chi tiết.
                        </div>
                      ) : (
                        t.subtopics.map((st) => {
                          const pct =
                            st.max_teams > 0
                              ? Math.round((st.current_registered_count / st.max_teams) * 100)
                              : 0;
                          return (
                            <div
                              key={st.id}
                              className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-semibold text-white text-sm">{st.name}</h4>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      st.current_registered_count >= st.max_teams
                                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                        : st.current_registered_count === st.max_teams - 1
                                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                        : st.current_registered_count === 0
                                        ? 'bg-slate-800 text-slate-400'
                                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                    }`}
                                  >
                                    {st.current_registered_count}/{st.max_teams} đội
                                  </span>
                                </div>
                                {st.description && (
                                  <p className="text-xs text-slate-400 line-clamp-2">
                                    {st.description}
                                  </p>
                                )}
                                {st.mentors && st.mentors.length > 0 && (
                                  <div className="flex items-center space-x-1.5 text-xs text-violet-400 pt-1">
                                    <Users className="w-3.5 h-3.5" />
                                    <span>
                                      Mentor: {st.mentors.map((m) => m.full_name).join(', ')}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center space-x-4 shrink-0">
                                <div className="w-28 space-y-1">
                                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        pct >= 100
                                          ? 'bg-rose-500'
                                          : pct >= 66
                                          ? 'bg-amber-500'
                                          : 'bg-emerald-500'
                                      }`}
                                      style={{ width: `${Math.min(100, pct)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-slate-500 block text-right font-mono">
                                    {pct}% đầy
                                  </span>
                                </div>

                                <div className="flex items-center space-x-1.5">
                                  <button
                                    onClick={() => openEditSubtopic(st)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400"
                                    title="Sửa đề tài"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSubtopic(st.id, st.name)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400"
                                    title="Xóa đề tài"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Sub-tab: Thống Kê Chi Tiết ────────────────────────── */}
      {activeSubTab === 'stats' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Bảng Phân Bố Đăng Ký Từng Đề Tài</h3>
            <span className="text-xs text-slate-400">
              {statsData?.subtopics.length || 0} chủ đề nhỏ
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono tracking-wider">
                <tr>
                  <th className="px-5 py-3">Chủ Đề Lớn</th>
                  <th className="px-5 py-3">Đề Tài Chi Tiết</th>
                  <th className="px-5 py-3">Mentor Phụ Trách</th>
                  <th className="px-5 py-3">Đã Đăng Ký</th>
                  <th className="px-5 py-3">Trạng Thái</th>
                  <th className="px-5 py-3">Danh Sách Đội</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {statsData?.subtopics.map((st) => {
                  const isExp = !!expandedSubtopicIds[st.subtopic_id];
                  return (
                    <React.Fragment key={st.subtopic_id}>
                      <tr className="hover:bg-slate-800/40">
                        <td className="px-5 py-3 font-medium text-slate-400">{st.topic_name}</td>
                        <td className="px-5 py-3 font-semibold text-white">{st.subtopic_name}</td>
                        <td className="px-5 py-3 text-slate-400">
                          {st.mentor_names.length > 0 ? st.mentor_names.join(', ') : '—'}
                        </td>
                        <td className="px-5 py-3 font-mono">
                          {st.current_registered_count} / {st.max_teams} đội
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              st.status === 'full'
                                ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                : st.status === 'almost_full'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : st.status === 'empty'
                                ? 'bg-slate-800 text-slate-400'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}
                          >
                            {st.status === 'full'
                              ? '🔴 Đã hết'
                              : st.status === 'almost_full'
                              ? '🟡 Gần đủ'
                              : st.status === 'empty'
                              ? '⬜ Trống'
                              : '🟢 Còn suất'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {st.registered_teams.length > 0 ? (
                            <button
                              onClick={() => toggleSubtopic(st.subtopic_id)}
                              className="text-blue-400 hover:text-blue-300 underline font-mono flex items-center space-x-1"
                            >
                              <span>{st.registered_teams.length} đội</span>
                              {isExp ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-600">Chưa có</span>
                          )}
                        </td>
                      </tr>
                      {isExp && st.registered_teams.length > 0 && (
                        <tr className="bg-slate-950/80">
                          <td colSpan={6} className="px-8 py-3">
                            <div className="space-y-1">
                              <span className="text-[11px] text-slate-400 font-semibold uppercase">
                                Các đội đã chọn:
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {st.registered_teams.map((rm) => (
                                  <span
                                    key={rm.team_id}
                                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-medium"
                                  >
                                    {rm.team_name}
                                    {rm.selected_at && (
                                      <span className="text-slate-500 font-mono text-[10px] ml-1.5">
                                        ({new Date(rm.selected_at).toLocaleTimeString('vi-VN')})
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Sub-tab: Đội Chưa Chọn Đề Tài ────────────────────────── */}
      {activeSubTab === 'no_topic' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Danh Sách Đội Chưa Đăng Ký Đề Tài</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Các đội đã được duyệt nhưng chưa chọn chủ đề thi nào.
              </p>
            </div>
            <button
              onClick={handleExportNoTopicCSV}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono tracking-wider">
                <tr>
                  <th className="px-5 py-3">Tên Đội</th>
                  <th className="px-5 py-3">Email Nhóm Trưởng</th>
                  <th className="px-5 py-3">Số Thành Viên</th>
                  <th className="px-5 py-3">Thời Gian Đăng Ký</th>
                  <th className="px-5 py-3 text-right">Nhắc Nhở</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {!statsData?.teams_without_topic || statsData.teams_without_topic.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                      Tất cả các đội được duyệt đều đã hoàn thành chọn đề tài! 🎉
                    </td>
                  </tr>
                ) : (
                  statsData.teams_without_topic.map((tm) => (
                    <tr key={tm.id} className="hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-semibold text-white">{tm.name}</td>
                      <td className="px-5 py-3 font-mono text-slate-300">
                        {tm.leader_email || '—'}
                      </td>
                      <td className="px-5 py-3 font-mono">{tm.members_count} người</td>
                      <td className="px-5 py-3 font-mono text-slate-400">
                        {new Date(tm.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {tm.leader_email && (
                          <a
                            href={`mailto:${tm.leader_email}?subject=[HackFlow] Nhắc nhở: Hạn chót chọn đề tài cuộc thi&body=Chào nhóm trưởng đội ${tm.name}, Ban Tổ Chức xin nhắc bạn vui lòng truy cập hệ thống để chọn đề tài trước khi cổng đăng ký đóng.`}
                            className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-semibold border border-blue-500/30 inline-block"
                          >
                            Gửi Email
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Topic Create / Edit */}
      {showTopicModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <FolderPlus className="w-5 h-5 text-blue-400" />
                <span>{editingTopicId ? 'Cập Nhật Chủ Đề Lớn' : 'Tạo Chủ Đề Lớn'}</span>
              </h3>
              <button
                onClick={() => setShowTopicModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTopic} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tên Chủ Đề Lớn *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI & Ứng dụng Học Máy trong Y tế"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mô Tả Tổng Quan
                </label>
                <textarea
                  rows={3}
                  placeholder="Mô tả bối cảnh và định hướng phát triển của chủ đề..."
                  value={topicDesc}
                  onChange={(e) => setTopicDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Thứ Tự Hiển Thị
                </label>
                <input
                  type="number"
                  min={0}
                  value={topicOrder}
                  onChange={(e) => setTopicOrder(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTopicModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-950/40"
                >
                  {submitting ? 'Đang lưu...' : editingTopicId ? 'Lưu Thay Đổi' : 'Tạo Chủ Đề'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Subtopic Create / Edit */}
      {showSubtopicModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-emerald-400" />
                <span>{editingSubtopicId ? 'Cập Nhật Đề Tài Chi Tiết' : 'Thêm Đề Tài Chi Tiết'}</span>
              </h3>
              <button
                onClick={() => setShowSubtopicModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubtopic} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tên Đề Tài Nhỏ *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chẩn đoán tự động tổn thương phổi từ ảnh X-quang"
                  value={subtopicName}
                  onChange={(e) => setSubtopicName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mô Tả &amp; Vấn Đề Cần Giải Quyết *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Mô tả cụ thể bài toán, mục tiêu và tiêu chuẩn đầu ra..."
                  value={subtopicDesc}
                  onChange={(e) => setSubtopicDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Giới Hạn Số Nhóm Đăng Ký (Max Teams) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={subtopicMaxTeams}
                  onChange={(e) => setSubtopicMaxTeams(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Hệ thống tự động khóa đề tài khi số nhóm đạt mức tối đa này.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Link Dữ Liệu Mẫu (Sample Dataset URL)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... hoặc Kaggle link"
                  value={subtopicDataUrl}
                  onChange={(e) => setSubtopicDataUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tài Liệu Tham Khảo (Mỗi link 1 dòng)
                </label>
                <textarea
                  rows={2}
                  placeholder="https://arxiv.org/abs/...&#10;https://github.com/..."
                  value={subtopicLinks}
                  onChange={(e) => setSubtopicLinks(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSubtopicModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-950/40"
                >
                  {submitting ? 'Đang lưu...' : editingSubtopicId ? 'Lưu Thay Đổi' : 'Thêm Đề Tài'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
