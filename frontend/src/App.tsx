import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { HomePage } from './features/home/HomePage';
import { LoginPage } from './features/auth/LoginPage';
import { TeamView } from './features/teams/TeamView';
import { TopicSelection } from './features/topics/TopicSelection';
import { CheckpointTimeline } from './features/checkpoints/CheckpointTimeline';
import { TicketKanban } from './features/tickets/TicketKanban';
import { JudgeSplitScreen } from './features/scoring/JudgeSplitScreen';
import { LeaderboardView } from './features/scoring/LeaderboardView';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { ProfilePage } from './features/profile/ProfilePage';
import { MentorDashboard } from './features/mentor/MentorDashboard';
import { AdminTeamsManagement } from './features/admin/AdminTeamsManagement';
import { AdminTopicsPanel } from './features/admin/AdminTopicsPanel';
import { AdminCheckpointPanel } from './features/admin/AdminCheckpointPanel';
import { TopicsOverview } from './features/topics/TopicsOverview';
import { ParticipantTicketPortal } from './features/tickets/ParticipantTicketPortal';
import { MentorCheckpointPanel } from './features/mentor/MentorCheckpointPanel';

export const App: React.FC = () => {
  const { user, fetchCurrentUser, isLoading } = useAuthStore();

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // FIX BUG-04: Block render cho đến khi fetchCurrentUser hoàn thành
  // Ngăn ProtectedRoute redirect về /login trong khoảng thời gian ngắn trước khi user load xong
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400" />
          <span className="text-slate-400 text-sm font-mono">Đang khởi động HackFlow...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={
              <ProtectedRoute redirectIfAuthenticated>
                <LoginPage />
              </ProtectedRoute>
            }
          />

          {/* Routes yêu cầu đăng nhập */}
          <Route
            path="/team"
            element={
              <ProtectedRoute allowedRoles={['participant', 'admin']}>
                {user?.role === 'admin' ? <AdminTeamsManagement /> : <TeamView />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/topics"
            element={
              <ProtectedRoute allowedRoles={['participant', 'admin', 'mentor', 'judge']}>
                {user?.role === 'admin' ? (
                  <AdminTopicsPanel />
                ) : user?.role === 'judge' || user?.role === 'mentor' ? (
                  <TopicsOverview />
                ) : (
                  <TopicSelection />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkpoints"
            element={
              <ProtectedRoute allowedRoles={['participant', 'mentor', 'admin']}>
                {user?.role === 'admin' ? (
                  <AdminCheckpointPanel />
                ) : user?.role === 'mentor' ? (
                  <MentorCheckpointPanel />
                ) : (
                  <CheckpointTimeline />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/tickets"
            element={
              <ProtectedRoute allowedRoles={['participant', 'mentor', 'admin']}>
                {user?.role === 'participant' ? <ParticipantTicketPortal /> : <TicketKanban />}
              </ProtectedRoute>
            }
          />

          {/* Scoring: chỉ judge và admin */}
          <Route
            path="/scoring"
            element={
              <ProtectedRoute allowedRoles={['judge', 'admin']}>
                <JudgeSplitScreen />
              </ProtectedRoute>
            }
          />

          {/* Leaderboard: mọi user đã đăng nhập */}
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
                <LeaderboardView />
              </ProtectedRoute>
            }
          />

          {/* Admin: chỉ admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Mentor Dashboard: mentor và admin */}
          <Route
            path="/mentor"
            element={
              <ProtectedRoute allowedRoles={['mentor', 'admin']}>
                <MentorDashboard />
              </ProtectedRoute>
            }
          />

          {/* Profile: chỉ participant, mentor, judge (Admin không cần hồ sơ) */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute allowedRoles={['participant', 'mentor', 'judge']}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
};

export default App;
