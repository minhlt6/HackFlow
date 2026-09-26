import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Search,
  LayoutDashboard,
  Users,
  BookOpen,
  Flag,
  LifeBuoy,
  Award,
  Sliders,
  UserCircle2,
  Shield,
  HelpCircle,
  X,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, quickLogin } = useAuthStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          setQuery('');
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Lọc danh sách trang nghiêm ngặt theo vai trò
  let availableItems = [];

  if (!isAuthenticated || !user) {
    availableItems = [
      { title: 'Trang chủ & Lịch trình cuộc thi', path: '/', icon: LayoutDashboard, category: 'Thông tin chung' },
      { title: 'Bảng xếp hạng (Leaderboard)', path: '/leaderboard', icon: Award, category: 'Thông tin chung' },
      { title: 'Đăng nhập / Đăng ký thí sinh', path: '/login', icon: ShieldCheck, category: 'Tài khoản' },
    ];
  } else if (user.role === 'participant') {
    availableItems = [
      { title: 'Tổng quan thi đấu', path: '/', icon: LayoutDashboard, category: 'Việc chính' },
      { title: 'Nhóm thi của tôi', path: '/team', icon: Users, category: 'Việc chính' },
      { title: 'Đề tài Hackathon', path: '/topics', icon: BookOpen, category: 'Việc chính' },
      { title: 'Mốc Checkpoints', path: '/checkpoints', icon: Flag, category: 'Tiến độ' },
      { title: 'Hỗ trợ Mentor Vingroup', path: '/tickets', icon: LifeBuoy, category: 'Hỗ trợ' },
      { title: 'Bảng xếp hạng', path: '/leaderboard', icon: Award, category: 'Kết quả' },
      { title: 'Hồ sơ cá nhân & SFIA', path: '/profile', icon: UserCircle2, category: 'Tài khoản' },
    ];
  } else if (user.role === 'mentor') {
    availableItems = [
      { title: 'Mentor Dashboard', path: '/mentor', icon: LayoutDashboard, category: 'Điều hành' },
      { title: 'Hàng đợi Tickets hỗ trợ', path: '/tickets', icon: LifeBuoy, category: 'Hỗ trợ' },
      { title: 'Tiến độ Checkpoints các đội', path: '/checkpoints', icon: Flag, category: 'Theo dõi' },
      { title: 'Thống kê Đề tài phụ trách', path: '/topics', icon: BookOpen, category: 'Theo dõi' },
      { title: 'Bảng xếp hạng', path: '/leaderboard', icon: Award, category: 'Kết quả' },
      { title: 'Hồ sơ cá nhân', path: '/profile', icon: UserCircle2, category: 'Tài khoản' },
    ];
  } else if (user.role === 'judge') {
    availableItems = [
      { title: 'Chấm điểm Rubric Giám khảo', path: '/scoring', icon: Sliders, category: 'Chấm thi' },
      { title: 'Thống kê Đề tài thi', path: '/topics', icon: BookOpen, category: 'Chấm thi' },
      { title: 'Bảng xếp hạng', path: '/leaderboard', icon: Award, category: 'Kết quả' },
      { title: 'Hồ sơ cá nhân', path: '/profile', icon: UserCircle2, category: 'Tài khoản' },
    ];
  } else {
    // Admin
    availableItems = [
      { title: 'Admin Dashboard', path: '/admin', icon: LayoutDashboard, category: 'Quản trị' },
      { title: 'Quản lý Đội thi', path: '/team', icon: Users, category: 'Vận hành' },
      { title: 'Quản lý Đề tài AI', path: '/topics', icon: BookOpen, category: 'Vận hành' },
      { title: 'Quản lý Checkpoints', path: '/checkpoints', icon: Flag, category: 'Vận hành' },
      { title: 'Điều phối Tickets', path: '/tickets', icon: LifeBuoy, category: 'Vận hành' },
      { title: 'Bảng xếp hạng', path: '/leaderboard', icon: Award, category: 'Kết quả' },
      { title: 'Hồ sơ cá nhân', path: '/profile', icon: UserCircle2, category: 'Tài khoản' },
    ];
  }

  const roleShortcuts = [
    { title: 'Đổi sang quyền Admin (BTC VinUni)', role: 'admin', icon: Shield },
    { title: 'Đổi sang Cố vấn (Mentor Vingroup)', role: 'mentor', icon: HelpCircle },
    { title: 'Đổi sang quyền Giám khảo (Judge)', role: 'judge', icon: Award },
    { title: 'Đổi sang Trưởng nhóm (Leader)', role: 'leader', icon: Users },
    { title: 'Đổi sang Học viên (Member)', role: 'member', icon: UserCircle2 },
  ];

  const filteredPages = availableItems.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  const filteredRoles = roleShortcuts.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelectPage = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleSelectRole = async (role: string) => {
    await quickLogin(role);
    if (role === 'admin') navigate('/admin');
    else if (role === 'mentor') navigate('/mentor');
    else if (role === 'judge') navigate('/scoring');
    else navigate('/');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Input Box */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 bg-slate-50">
          <Search className="w-5 h-5 text-blue-600 shrink-0 mr-3" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm trang, chức năng hoặc chuyển vai trò..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          {query ? (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-500 rounded shadow-2xs">
              ESC
            </kbd>
          )}
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {/* Navigation Pages */}
          <div>
            <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Trang &amp; Chức năng
            </div>
            {filteredPages.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400 italic">Không tìm thấy trang phù hợp</div>
            ) : (
              filteredPages.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleSelectPage(item.path)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-blue-50 text-left transition group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-700 transition">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800 group-hover:text-blue-900 transition">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-400">{item.category}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition" />
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Role Switcher */}
          <div className="border-t border-slate-100 pt-2">
            <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Chuyển đổi Role Demo
            </div>
            {filteredRoles.map((item) => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.role}
                  onClick={() => handleSelectRole(item.role)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 text-left transition group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-100 transition">
                      <IconComp className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs text-slate-700 group-hover:text-slate-900 font-medium transition">
                      {item.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    {item.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Dùng chuột hoặc phím Enter để chọn</span>
          <span className="font-mono text-blue-600 font-bold">VinUni AI Search</span>
        </div>
      </div>
    </div>
  );
};
