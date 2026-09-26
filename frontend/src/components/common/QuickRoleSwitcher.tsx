import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Zap, ChevronRight, ChevronLeft, Shield, Award, HelpCircle, Users, User, Check } from 'lucide-react';

export const QuickRoleSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const { user, quickLogin } = useAuthStore();
  const [isOpen, setIsOpen] = useState(true);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const handleSwitch = async (role: string) => {
    setLoadingRole(role);
    try {
      const success = await quickLogin(role);
      if (success) {
        if (role === 'admin') navigate('/admin');
        else if (role === 'mentor') navigate('/mentor');
        else if (role === 'judge') navigate('/scoring');
        else navigate('/');
      }
    } finally {
      setLoadingRole(null);
    }
  };

  const roles = [
    {
      id: 'admin',
      name: 'Admin',
      title: 'BTC VinUni',
      icon: Shield,
      color: 'hover:bg-red-50 hover:text-red-700 border-slate-200 text-slate-700',
      activeColor: 'bg-red-50 border-red-300 text-red-700 font-bold',
    },
    {
      id: 'judge',
      name: 'Judge',
      title: 'Giám khảo',
      icon: Award,
      color: 'hover:bg-purple-50 hover:text-purple-700 border-slate-200 text-slate-700',
      activeColor: 'bg-purple-50 border-purple-300 text-purple-700 font-bold',
    },
    {
      id: 'mentor',
      name: 'Mentor',
      title: 'Cố vấn Vingroup',
      icon: HelpCircle,
      color: 'hover:bg-amber-50 hover:text-amber-700 border-slate-200 text-slate-700',
      activeColor: 'bg-amber-50 border-amber-300 text-amber-700 font-bold',
    },
    {
      id: 'leader',
      name: 'Leader',
      title: 'Trưởng nhóm',
      icon: Users,
      color: 'hover:bg-blue-50 hover:text-blue-700 border-slate-200 text-slate-700',
      activeColor: 'bg-blue-50 border-blue-300 text-blue-700 font-bold',
    },
    {
      id: 'member',
      name: 'Member',
      title: 'Học viên',
      icon: User,
      color: 'hover:bg-teal-50 hover:text-teal-700 border-slate-200 text-slate-700',
      activeColor: 'bg-teal-50 border-teal-300 text-teal-700 font-bold',
    },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center shadow-xl transition-all duration-200">
      {isOpen ? (
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl p-2 flex items-center space-x-1.5 shadow-xl">
          <div className="flex items-center space-x-1 px-2 py-1 border-r border-slate-100 mr-1 text-slate-600">
            <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-slate-700">
              Role:
            </span>
          </div>

          <div className="flex items-center space-x-1">
            {roles.map((r) => {
              const Icon = r.icon;
              const isCurrent =
                (r.id === 'admin' && user?.role === 'admin') ||
                (r.id === 'judge' && user?.role === 'judge') ||
                (r.id === 'mentor' && user?.role === 'mentor') ||
                (r.id === 'leader' && user?.role === 'participant' && user?.email.includes('leader')) ||
                (r.id === 'member' && user?.role === 'participant' && user?.email.includes('member'));

              const isLoading = loadingRole === r.id;

              return (
                <button
                  key={r.id}
                  disabled={loadingRole !== null}
                  onClick={() => handleSwitch(r.id)}
                  title={`Chuyển sang vai trò ${r.title} tức thì (1-click)`}
                  className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
                    isCurrent
                      ? r.activeColor
                      : `bg-slate-50 border-slate-200 ${r.color}`
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                  ) : isCurrent ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  <span>{r.name}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setIsOpen(false)}
            title="Thu gọn thanh chuyển vai trò"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition ml-1"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          title="Mở thanh chuyển đổi vai trò kiểm thử 1-chạm"
          className="flex items-center space-x-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-full text-xs font-bold shadow-xl transition"
        >
          <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span>Đổi Role ({user ? user.role : 'Guest'})</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
