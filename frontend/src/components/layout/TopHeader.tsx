import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  Search,
  Bell,
  Menu,
  X,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { CommandPalette } from './CommandPalette';

interface TopHeaderProps {
  onToggleMobileSidebar: () => void;
  mobileSidebarOpen: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onToggleMobileSidebar,
  mobileSidebarOpen,
}) => {
  const { user, isAuthenticated } = useAuthStore();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Format today's date in Vietnamese
  const getTodayString = () => {
    const now = new Date();
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const dayName = days[now.getDay()];
    const dateStr = now.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `Hôm nay · ${dayName} · ${dateStr}`;
  };

  return (
    <>
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-4 shadow-2xs">
        {/* Left side: Mobile menu toggle + Search bar */}
        <div className="flex items-center space-x-3 flex-1 max-w-xl">
          {/* Mobile hamburger toggle */}
          <button
            onClick={onToggleMobileSidebar}
            className="md:hidden p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
            aria-label="Toggle Navigation"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Search bar */}
          <div
            onClick={() => setCommandPaletteOpen(true)}
            className="flex-1 flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-100/90 border border-slate-200 hover:border-slate-300 text-slate-500 cursor-pointer transition shadow-2xs group"
          >
            <div className="flex items-center space-x-2.5">
              <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
              <span className="text-xs text-slate-500 group-hover:text-slate-700 transition">
                Tìm trang, đề tài AI, checkpoints...
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-500 rounded shadow-2xs">
                ⌘K
              </kbd>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-500 rounded shadow-2xs">
                ctrl+k
              </kbd>
            </div>
          </div>
        </div>

        {/* Right side: Today status, Notification bell, User info */}
        <div className="flex items-center space-x-3">
          {/* Today tag */}
          <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>{getTodayString()}</span>
          </div>

          {/* Notification Button */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-xs font-semibold text-slate-700 transition shadow-2xs"
              title="Thông báo từ Ban Tổ Chức"
            >
              <Bell className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">Bật thông báo</span>
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            </button>

            {/* Notification popup */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-500" />
                    <span>Thông báo Ban Tổ Chức VinUni</span>
                  </div>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
                    <div className="font-semibold text-blue-800 flex items-center space-x-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Cơ chế Commit SHA Freeze kích hoạt</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Mọi bài nộp checkpoint đều được đóng băng và mã hóa tự động để đảm bảo tính minh bạch học thuật.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="font-semibold text-indigo-700 flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Chọn đề tài &amp; Khóa slot thực chiến</span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Các đội thi đã được phê duyệt có thể chọn đề tài thuộc các nhánh AI của Vingroup.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile avatar pill */}
          {isAuthenticated && user ? (
            <Link
              to="/profile"
              className="flex items-center space-x-2.5 pl-2 hover:opacity-85 transition group"
              title="Hồ sơ cá nhân"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-xs text-blue-700 group-hover:border-blue-400 transition shadow-2xs">
                {user.full_name ? user.full_name[0].toUpperCase() : 'U'}
              </div>
              <div className="hidden xl:flex flex-col">
                <span className="text-xs font-bold text-slate-800 truncate max-w-[130px]">
                  {user.full_name}
                </span>
                <span className="text-[10px] text-slate-500 font-mono capitalize">
                  {user.role}
                </span>
              </div>
            </Link>
          ) : (
            <Link
              to="/login"
              className="px-3.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs transition shadow-sm"
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </header>

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </>
  );
};
