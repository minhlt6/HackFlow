import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../api/client';
import {
  ShieldAlert,
  Terminal,
  Clock,
  Users,
  BookOpen,
  Flag,
  LifeBuoy,
  Award,
  Sliders,
  LogOut,
  UserCircle2,
  ChevronDown,
  LayoutDashboard,
  Info,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout, quickLogin } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState('--:--:--');
  const roleMenuRef = useRef<HTMLDivElement>(null);

  // FIX BUG-08: Load deadline thực từ API, chỉ tính diff trong interval (không tính lại end mỗi giây)
  useEffect(() => {
    let deadline: number | null = null;

    const loadDeadline = async () => {
      try {
        const res = await apiClient.get('/admin/config');
        if (res.data?.success && res.data.data?.contest_end) {
          deadline = new Date(res.data.data.contest_end).getTime();
        }
      } catch {
        // config không load được — giữ '--:--:--'
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

  // FIX BUG-09: Đóng dropdown khi click ngoài vùng menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setRoleMenuOpen(false);
      }
    };
    if (roleMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [roleMenuOpen]);

  const handleRoleSwitch = async (role: string) => {
    setRoleMenuOpen(false);
    const success = await quickLogin(role);
    if (success) {
      if (role === 'admin') navigate('/admin');
      else if (role === 'mentor') navigate('/mentor');
      else if (role === 'judge') navigate('/scoring');
      else navigate('/team');
    }
  };


  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-950/80 text-red-400 border border-red-700/50';
      case 'judge':
        return 'bg-purple-950/80 text-purple-400 border border-purple-700/50';
      case 'mentor':
        return 'bg-amber-950/80 text-amber-400 border border-amber-700/50';
      default:
        return 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50';
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-900/40">
                <Terminal className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-white flex items-center">
                  Hack<span className="text-emerald-400">Flow</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] text-slate-400 uppercase tracking-widest block -mt-1 font-semibold">
                  Academic Platform
                </span>
              </div>
            </Link>

            {/* Countdown Badge */}
            <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>FREEZE IN:</span>
              <span className="text-emerald-400 font-bold">{timeLeft}</span>
            </div>
          </div>

          {/* Navigation Links */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center space-x-1">
              {/* Participant Links */}
              {user?.role === 'participant' && (
                <>
                  <Link
                    to="/"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-none ${
                      isActive('/')
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Info className="w-4 h-4" />
                    <span>Thông tin BTC</span>
                  </Link>
                  <Link
                    to="/topics"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-none ${
                      isActive('/topics')
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Đề tài</span>
                  </Link>
                  <Link
                    to="/checkpoints"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-none ${
                      isActive('/checkpoints')
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Flag className="w-4 h-4" />
                    <span>Checkpoints</span>
                  </Link>
                  <Link
                    to="/leaderboard"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-none ${
                      isActive('/leaderboard')
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    <span>BXH</span>
                  </Link>
                  <Link
                    to="/team"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-none ${
                      isActive('/team')
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Nhóm thi</span>
                  </Link>
                  <Link
                    to="/tickets"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-none ${
                      isActive('/tickets')
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <LifeBuoy className="w-4 h-4" />
                    <span>Hỗ trợ</span>
                  </Link>
                </>
              )}

              {/* Mentor Links */}
              {user?.role === 'mentor' && (
                <>
                  <Link
                    to="/mentor"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-none ${
                      isActive('/mentor')
                        ? 'bg-amber-50 text-amber-800 border border-amber-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    to="/leaderboard"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-none ${
                      isActive('/leaderboard')
                        ? 'bg-amber-50 text-amber-800 border border-amber-300'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    <span>Bảng xếp hạng</span>
                  </Link>
                </>
              )}

              {/* Judge Links */}
              {user?.role === 'judge' && (
                <>
                  <Link
                    to="/scoring"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-none ${
                      isActive('/scoring')
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    <span>Chấm điểm Rubric</span>
                  </Link>
                  <Link
                    to="/leaderboard"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-none ${
                      isActive('/leaderboard')
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Sliders className="w-4 h-4" />
                    <span>Bảng xếp hạng</span>
                  </Link>
                </>
              )}

              {/* Admin Links */}
              {user?.role === 'admin' && (
                <>
                  <Link
                    to="/admin"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-none ${
                      isActive('/admin')
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Sliders className="w-4 h-4" />
                    <span>Bảng điều khiển Admin</span>
                  </Link>
                  <Link
                    to="/leaderboard"
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-none ${
                      isActive('/leaderboard')
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    <span>Điểm & Xếp hạng</span>
                  </Link>
                </>
              )}
            </div>
          )}

          {/* User Controls & Quick Role Switcher */}
          <div className="flex items-center space-x-3">
            {/* Quick Demo Role Switcher Dropdown */}
            <div className="relative" ref={roleMenuRef}>
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
                title="Chuyển đổi vai trò demo tức thì"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                <span>Đổi Role Demo</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-50">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Tài khoản demo sẵn có
                  </div>
                  <button
                    onClick={() => handleRoleSwitch('admin')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-red-500/10 hover:text-red-400 flex items-center justify-between"
                  >
                    <span>Quản trị viên (Admin)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-400 font-mono">admin</span>
                  </button>
                  <button
                    onClick={() => handleRoleSwitch('mentor')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-amber-500/10 hover:text-amber-400 flex items-center justify-between"
                  >
                    <span>Cố vấn (Mentor)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 font-mono">mentor</span>
                  </button>
                  <button
                    onClick={() => handleRoleSwitch('judge')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-purple-500/10 hover:text-purple-400 flex items-center justify-between"
                  >
                    <span>Giám khảo (Judge)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-400 font-mono">judge</span>
                  </button>
                  <button
                    onClick={() => handleRoleSwitch('leader')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-400 flex items-center justify-between"
                  >
                    <span>Trưởng nhóm (Leader)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono">leader</span>
                  </button>
                  <button
                    onClick={() => handleRoleSwitch('member')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-teal-500/10 hover:text-teal-400 flex items-center justify-between"
                  >
                    <span>Thành viên (Member)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-950 text-teal-400 font-mono">member</span>
                  </button>
                </div>
              )}
            </div>

            {/* User Profile / Login */}
            {isAuthenticated && user ? (
              <div className="flex items-center space-x-2">
                <Link
                  to="/profile"
                  className="hidden sm:flex flex-col items-end hover:opacity-80 transition"
                  title="Xem/chỉnh sửa hồ sơ"
                >
                  <span className="text-xs font-semibold text-slate-200">{user.full_name}</span>
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded ${getRoleBadgeColor(
                      user.role
                    )}`}
                  >
                    {user.role}
                  </span>
                </Link>
                <button
                  onClick={() => logout()}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium shadow-md shadow-emerald-900/30 transition"
              >
                <UserCircle2 className="w-4 h-4" />
                <span>Đăng nhập</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
