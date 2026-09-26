import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import type { Topic } from '../../types';
import {
  BookOpen,
  Users,
  Layers,
  FileText,
  FolderArchive,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Search,
} from 'lucide-react';

export const TopicsOverview: React.FC = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/topics');
      if (res.data?.success) {
        setTopics(res.data.data);
      }
    } catch (err) {
      console.error('Cannot load topics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const totalSubtopics = topics.reduce((acc, t) => acc + (t.subtopics?.length || 0), 0);
  const totalRegistered = topics.reduce(
    (acc, t) => acc + (t.subtopics?.reduce((sum, s) => sum + s.current_registered_count, 0) || 0),
    0
  );
  const totalSlots = topics.reduce(
    (acc, t) => acc + (t.subtopics?.reduce((sum, s) => sum + s.max_teams, 0) || 0),
    0
  );

  const filteredTopics = topics.filter((t) => {
    const matchTopic =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchSub = t.subtopics?.some(
      (s) =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
    );
    return matchTopic || matchSub;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Danh Mục Đề Tài Hackathon • Giám Khảo &amp; Mentor</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900">Tổng Quan Đề Tài &amp; Phân Bổ Đội Thi</h1>
          <p className="text-sm text-slate-600 mt-1">
            Tra cứu cấu trúc đề bài, yêu cầu kỹ thuật và thống kê số lượng đội thi đăng ký trên từng đề tài nhánh.
          </p>
        </div>

        <button
          onClick={fetchTopics}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-none shadow-xs shrink-0 self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Lĩnh Vực / Chủ Đề Lớn</span>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">{topics.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Các mảng ứng dụng AI thực tế</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1.5">
            <FileText className="w-4 h-4 text-purple-600" />
            <span>Tổng Đề Tài Nhánh (Bài toán)</span>
          </div>
          <div className="text-3xl font-black text-slate-900 mt-2">{totalSubtopics}</div>
          <div className="text-[11px] text-slate-500 mt-1">Đề tài thi chi tiết do BTC ban hành</div>
        </div>

        <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-xs bg-blue-50/20">
          <div className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center space-x-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Đội Đã Đăng Ký Slot</span>
          </div>
          <div className="text-3xl font-black text-blue-700 mt-2">
            {totalRegistered} <span className="text-base font-normal text-slate-500">/ {totalSlots} suất</span>
          </div>
          <div className="text-[11px] text-blue-600 mt-1">Tỷ lệ lấp đầy toàn cuộc thi</div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Tìm kiếm theo chủ đề, đề tài nhánh, từ khóa bài toán..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500 shadow-xs"
        />
      </div>

      {/* Topics list */}
      {loading ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-semibold">Đang tải danh sách đề tài...</p>
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Không tìm thấy đề tài nào</p>
          <p className="text-xs text-slate-500 mt-1">Vui lòng thử lại với từ khóa tìm kiếm khác</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredTopics.map((topic) => (
            <div
              key={topic.id}
              className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center space-x-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Chủ Đề Lớn</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900">{topic.title}</h2>
                <p className="text-xs text-slate-600 mt-1">{topic.description}</p>
              </div>

              {/* Subtopics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topic.subtopics?.map((sub) => {
                  const isFull = sub.current_registered_count >= sub.max_teams;
                  const pct = sub.max_teams > 0 ? Math.min(100, (sub.current_registered_count / sub.max_teams) * 100) : 0;

                  return (
                    <div
                      key={sub.id}
                      className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-blue-200 transition-none shadow-2xs flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-bold text-slate-900">{sub.title}</h3>
                          <span
                            className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isFull
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {isFull ? 'Hết slot' : 'Còn slot'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {sub.description}
                        </p>

                        {/* Resource Links */}
                        {(sub.sample_data_url || (sub.reference_links && sub.reference_links.length > 0)) && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {sub.sample_data_url && (
                              <a
                                href={sub.sample_data_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold hover:bg-blue-100 transition-none"
                              >
                                <FolderArchive className="w-3.5 h-3.5" />
                                <span>Dataset mẫu</span>
                                <ExternalLink className="w-3 h-3 text-blue-400" />
                              </a>
                            )}

                            {sub.reference_links?.map((link, idx) => (
                              <a
                                key={idx}
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold hover:bg-slate-200 transition-none"
                              >
                                <span>Tài liệu #{idx + 1}</span>
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Registration Slots Bar */}
                      <div className="pt-3 border-t border-slate-200/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-600 flex items-center space-x-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>Đội thi đăng ký:</span>
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {sub.current_registered_count} / {sub.max_teams} đội
                          </span>
                        </div>

                        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full ${isFull ? 'bg-rose-500' : 'bg-blue-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
