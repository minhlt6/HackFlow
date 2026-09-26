import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../api/client';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Flag,
  LifeBuoy,
  Award,
  Sliders,
  UserCircle2,
  Clock,
  LogOut,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Bot,
  GraduationCap,
} from 'lucide-react';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, quickLogin } = useAuthStore();
  const [timeLeft, setTimeLeft] = useState('--:--:--');
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  // Load deadline & countdown
  useEffect(() => {
    let deadline: number | null = null;
    const loadDeadline = async () => {
      try {
        const res = await apiClient.get('/admin/config');
        if (res.data?.success && res.data.data?.contest_end) {
          deadline = new Date(res.data.data.contest_end).getTime();
        }
      } catch {
        // keep fallback
      }
    };
    loadDeadline();

    const timer = setInterval(() => {
      if (deadline === null) return;
      const diff = Math.max(0, deadline - Date.now());
      if (diff === 0) {
        setTimeLeft('00:00:00');
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRoleSwitch = async (role: string) => {
    setRoleSwitcherOpen(false);
    const success = await quickLogin(role);
    if (success) {
      if (role === 'admin') navigate('/admin');
      else if (role === 'mentor') navigate('/mentor');
      else if (role === 'judge') navigate('/scoring');
      else navigate('/');
      if (onCloseMobile) onCloseMobile();
    }
  };

  const getRoleDisplayName = (role?: string) => {
    if (!isAuthenticated || !user) return 'Chưa đăng nhập';
    switch (role) {
      case 'admin':
        return 'Ban Tổ Chức VinUni';
      case 'judge':
        return 'Hội Đồng Giám Khảo';
      case 'mentor':
        return 'Cố Vấn Kỹ Thuật (Mentor)';
      default:
        return 'Học Viên AI Thực Chiến';
    }
  };

  const getRoleBadgeStyle = (role?: string) => {
    if (!isAuthenticated || !user) return 'bg-slate-100 text-slate-600 border-slate-200';
    switch (role) {
      case 'admin':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'judge':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'mentor':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Build menu sections strictly according to feature markdown docs
  const menuSections = [];

  if (!isAuthenticated || !user) {
    menuSections.push(
      {
        title: 'THÔNG TIN CHƯƠNG TRÌNH',
        items: [
          { title: 'Trang chủ & Lịch trình', path: '/', icon: LayoutDashboard },
          { title: 'Bảng xếp hạng', path: '/leaderboard', icon: Award },
        ],
      },
      {
        title: 'TÀI KHOẢN',
        items: [{ title: 'Đăng nhập / Đăng ký', path: '/login', icon: ShieldCheck }],
      }
    );
  } else if (user.role === 'participant') {
    menuSections.push(
      {
        title: 'VIỆC CHÍNH',
        items: [
          { title: 'Tổng quan thi đấu', path: '/', icon: LayoutDashboard },
          { title: 'Nhóm thi của tôi', path: '/team', icon: Users },
          { title: 'Đề tài Thực chiến', path: '/topics', icon: BookOpen },
        ],
      },
      {
        title: 'TIẾN ĐỘ & HỖ TRỢ',
        items: [
          { title: 'Mốc Checkpoints', path: '/checkpoints', icon: Flag },
          { title: 'Hỗ trợ Mentor Vingroup', path: '/tickets', icon: LifeBuoy },
        ],
      },
      {
        title: 'THAM KHẢO & TÀI KHOẢN',
        items: [
          { title: 'Bảng xếp hạng', path: '/leaderboard', icon: Award },
          { title: 'Hồ sơ cá nhân & SFIA', path: '/profile', icon: UserCircle2 },
        ],
      }
    );
  } else if (user.role === 'mentor') {
    menuSections.push(
      {
        title: 'ĐIỀU HÀNH & HỖ TRỢ',
        items: [
          { title: 'Mentor Dashboard', path: '/mentor', icon: LayoutDashboard },
          { title: 'Hàng đợi Tickets', path: '/tickets', icon: LifeBuoy },
        ],
      },
      {
        title: 'THEO DÕI THI',
        items: [
          { title: 'Tiến độ Checkpoints', path: '/checkpoints', icon: Flag },
          { title: 'Thống kê Đề tài phụ trách', path: '/topics', icon: BookOpen },
        ],
      },
      {
        title: 'THAM KHẢO & TÀI KHOẢN',
        items: [
          { title: 'Bảng xếp hạng', path: '/leaderboard', icon: Award },
          { title: 'Hồ sơ cá nhân', path: '/profile', icon: UserCircle2 },
        ],
      }
    );
  } else if (user.role === 'judge') {
    menuSections.push(
      {
        title: 'CHẤM THI',
        items: [
          { title: 'Chấm điểm Rubric', path: '/scoring', icon: Sliders },
          { title: 'Thống kê Đề tài thi', path: '/topics', icon: BookOpen },
        ],
      },
      {
        title: 'THAM KHẢO & TÀI KHOẢN',
        items: [
          { title: 'Bảng xếp hạng', path: '/leaderboard', icon: Award },
          { title: 'Hồ sơ cá nhân', path: '/profile', icon: UserCircle2 },
        ],
      }
    );
  } else if (user.role === 'admin') {
    menuSections.push(
      {
        title: 'QUẢN TRỊ HỆ THỐNG',
        items: [{ title: 'Admin Dashboard', path: '/admin', icon: LayoutDashboard }],
      },
      {
        title: 'VẬN HÀNH THI',
        items: [
          { title: 'Quản lý Đội thi', path: '/team', icon: Users },
          { title: 'Quản lý Đề tài AI', path: '/topics', icon: BookOpen },
          { title: 'Quản lý Checkpoints', path: '/checkpoints', icon: Flag },
          { title: 'Điều phối Tickets', path: '/tickets', icon: LifeBuoy },
          { title: 'Bảng xếp hạng', path: '/leaderboard', icon: Award },
        ],
      }
    );
  }

  const userInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .slice(-2)
        .join('')
        .toUpperCase()
    : 'VU';

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 z-40 select-none shadow-xs">
      {/* Brand Header - VinUni AI Thực Chiến */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-900 flex items-center justify-center shadow-md shadow-blue-900/20 group-hover:scale-105 transition">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1">
              <span className="text-base font-black tracking-tight text-[#0a2540]">
                VinUni <span className="text-blue-600">AI</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold -mt-0.5">
              AI Thực Chiến • 12W
            </span>
          </div>
        </Link>
      </div>

      {/* User Profile Card */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center font-bold text-sm text-blue-700 shrink-0 shadow-xs">
            {isAuthenticated ? userInitials : <GraduationCap className="w-5 h-5 text-blue-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-900 truncate">
              {isAuthenticated && user?.full_name ? user.full_name : 'Khách tham quan'}
            </div>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border truncate ${getRoleBadgeStyle(
                  user?.role
                )}`}
              >
                {getRoleDisplayName(user?.role)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {menuSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            <div className="px-3 text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              {section.title}
            </div>
            <div className="space-y-0.5 pt-1">
              {section.items.map((item) => {
                const active = isActive(item.path);
                const IconComponent = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onCloseMobile}
                    className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-none ${
                      active
                        ? 'bg-blue-50 text-blue-700 border border-blue-200/70 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent'
                    }`}
                  >
                    <IconComponent
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-blue-700' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sidebar Footer Controls */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/80 space-y-2">
        {/* Countdown Badge */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs shadow-xs">
          <div className="flex items-center space-x-2 text-slate-500">
            <Clock className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
            <span className="font-mono text-[11px] font-semibold">FREEZE:</span>
          </div>
          <span className="font-mono font-bold text-blue-700 text-xs">{timeLeft}</span>
        </div>

        {/* Quick Role Switcher Trigger */}
        <div className="relative">
          <button
            onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 font-medium transition shadow-xs"
          >
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Đổi Role Demo</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

          {roleSwitcherOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                Chọn vai trò thử nghiệm
              </div>
              <button
                onClick={() => handleRoleSwitch('admin')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-red-50 hover:text-red-700 flex items-center justify-between transition"
              >
                <span>Admin (BTC VinUni)</span>
                <span className="text-[10px] font-mono text-red-600">admin</span>
              </button>
              <button
                onClick={() => handleRoleSwitch('mentor')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center justify-between transition"
              >
                <span>Cố vấn (Mentor Vingroup)</span>
                <span className="text-[10px] font-mono text-amber-600">mentor</span>
              </button>
              <button
                onClick={() => handleRoleSwitch('judge')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-700 flex items-center justify-between transition"
              >
                <span>Giám khảo (Judge)</span>
                <span className="text-[10px] font-mono text-purple-600">judge</span>
              </button>
              <button
                onClick={() => handleRoleSwitch('leader')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between transition"
              >
                <span>Trưởng nhóm (Leader)</span>
                <span className="text-[10px] font-mono text-blue-600">leader</span>
              </button>
              <button
                onClick={() => handleRoleSwitch('member')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-700 flex items-center justify-between transition"
              >
                <span>Học viên (Member)</span>
                <span className="text-[10px] font-mono text-teal-600">member</span>
              </button>
            </div>
          )}
        </div>

        {/* Logout / Login link */}
        {isAuthenticated ? (
          <button
            onClick={() => {
              logout();
              navigate('/login');
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        ) : (
          <Link
            to="/login"
            onClick={onCloseMobile}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 transition shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Đăng nhập ngay</span>
          </Link>
        )}
      </div>
    </aside>
  );
};
