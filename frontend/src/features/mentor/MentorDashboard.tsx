import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { MentorStats } from '../../types';
import { TicketKanban } from '../tickets/TicketKanban';
import { MentorTopicsPanel } from './MentorTopicsPanel';
import { MentorCheckpointPanel } from './MentorCheckpointPanel';
import {
  LifeBuoy,
  BookOpen,
  Flag,
  LayoutDashboard,
} from 'lucide-react';

type ActiveTab = 'tickets' | 'topics' | 'checkpoints';

interface StatCardProps {
  label: string;
  value: number;
  color?: string;
  icon: React.ReactNode;
  description: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, description }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 flex flex-col shadow-xs">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      {icon}
    </div>
    <div className="text-4xl font-black text-slate-900">{value}</div>
    <p className="text-xs text-slate-500">{description}</p>
  </div>
);

export const MentorDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<MentorStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('tickets');

  const loadStats = async () => {
    try {
      const res = await apiClient.get('/mentor/stats');
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Cannot load mentor stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const tabs: { key: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    {
      key: 'tickets',
      label: 'Ticket Hỗ Trợ',
      icon: <LifeBuoy className="w-4 h-4" />,
      badge: stats?.pool_count,
    },
    {
      key: 'topics',
      label: 'Đề tài phụ trách',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      key: 'checkpoints',
      label: 'Tiến độ Checkpoint',
      icon: <Flag className="w-4 h-4" />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center space-x-2 text-amber-600 text-xs font-bold uppercase tracking-wider">
          <LayoutDashboard className="w-4 h-4" />
          <span>Bàn Làm Việc Cố Vấn • VinUni AI Thực Chiến</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900">
          Xin chào, <span className="text-amber-600">{user?.full_name || 'Mentor'}</span> 👋
        </h1>
        <p className="text-slate-600 text-sm">
          Kênh hỗ trợ kỹ thuật, giải đáp vướng mắc và theo dõi tiến độ các đội thi trong chương trình.
        </p>
      </div>

      {/* Stats Row */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse h-28 shadow-xs" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Ticket chờ nhận"
            value={stats.pool_count}
            color="border-rose-200"
            icon={<div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />}
            description="Ticket mở chưa có mentor nào tiếp nhận"
          />
          <StatCard
            label="Đang hỗ trợ"
            value={stats.in_progress_count}
            color="border-amber-200"
            icon={<div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
            description="Yêu cầu bạn đang đồng hành giải quyết"
          />
          <StatCard
            label="Đã hoàn thành"
            value={stats.resolved_count}
            color="border-emerald-200"
            icon={<div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
            description="Ticket bạn đã hỗ trợ giải quyết thành công"
          />
        </div>
      ) : null}

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center space-x-2 px-4 py-2.5 text-sm border-b-2 transition-none relative ${
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-blue-50/60 rounded-t-xl font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 rounded-t-xl font-medium'
                }`}
              >
                <span className={isActive ? 'text-blue-700' : 'text-slate-500'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'tickets' && <TicketKanban />}
        {activeTab === 'topics' && <MentorTopicsPanel />}
        {activeTab === 'checkpoints' && <MentorCheckpointPanel />}
      </div>
    </div>
  );
};
