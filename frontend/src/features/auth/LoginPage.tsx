import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../api/client';
import {
  Lock,
  Mail,
  User,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Bot,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

const BTC_EMAIL = 'ai.bootcamp@vinuni.edu.vn';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, quickLogin } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sau khi đăng ký → hiện màn hình chờ duyệt thay vì redirect
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const getRedirectPath = (role: string) => {
    if (role === 'admin') return '/admin';
    if (role === 'mentor') return '/mentor';
    if (role === 'judge') return '/scoring';
    return '/';
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await apiClient.post('/auth/register', {
          email,
          password,
          full_name: fullName,
          student_id: studentId || undefined,
        });
        if (res.data?.success) {
          setPendingEmail(email);
        }
      } else {
        const res = await apiClient.post('/auth/login', { email, password });
        if (res.data?.success) {
          const { access_token } = res.data.data;
          const meRes = await apiClient.get('/users/me', {
            headers: { Authorization: `Bearer ${access_token}` },
          });
          if (meRes.data?.success) {
            localStorage.setItem('hackflow_token', access_token);
            login(access_token, meRes.data.data);
            navigate(getRedirectPath(meRes.data.data.role));
          } else {
            setError('Không thể lấy thông tin tài khoản. Vui lòng thử lại.');
          }
        }
      }
    } catch (err: any) {
      const detail: string = err.response?.data?.detail || '';

      if (detail.startsWith('PENDING_APPROVAL:')) {
        setPendingEmail(email);
        return;
      }
      if (detail.startsWith('ACCOUNT_REJECTED:')) {
        setError('❌ Tài khoản đã bị Ban Tổ Chức từ chối. Vui lòng liên hệ BTC để biết thêm.');
        return;
      }

      const msg =
        err.response?.data?.error?.message ||
        detail ||
        'Thao tác thất bại, vui lòng kiểm tra lại.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoClick = async (role: string) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    const success = await quickLogin(role);
    setLoading(false);
    if (success) {
      navigate(getRedirectPath(role));
    } else {
      setError('Đăng nhập nhanh thất bại. Hãy chắc chắn Backend đang chạy tại port 8002.');
    }
  };

  // ── Màn hình chờ phê duyệt (Light Theme) ─────────────────────────────────
  if (pendingEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 text-slate-800">
        <div className="max-w-md w-full bg-white border border-amber-300 rounded-3xl p-8 shadow-xl text-center space-y-6">
          {/* Icon */}
          <div className="flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Clock className="w-10 h-10 text-amber-600" />
            </div>
          </div>

          {/* Tiêu đề */}
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900">Đăng ký thành công!</h2>
            <p className="text-amber-700 font-semibold text-sm">Hồ sơ đang chờ Ban Tổ Chức VinUni duyệt</p>
          </div>

          {/* Thông tin */}
          <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-1.5 border border-slate-200">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Email đăng ký tham gia</p>
            <p className="text-slate-900 font-mono font-bold text-sm">{pendingEmail}</p>
          </div>

          {/* Hướng dẫn */}
          <div className="space-y-3 text-xs text-slate-600 text-left leading-relaxed">
            <p className="font-bold text-slate-800 text-sm">📋 Các bước tiếp theo:</p>
            <ol className="space-y-2 list-none">
              <li className="flex items-start space-x-2">
                <span className="text-amber-600 font-bold shrink-0">1.</span>
                <span>Gửi email tới Ban Quản lý Chương trình để xác nhận thông tin học viên.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-600 font-bold shrink-0">2.</span>
                <span>Email bao gồm: <strong className="text-slate-900">họ tên</strong>, <strong className="text-slate-900">mã sinh viên/học viên</strong> và <strong className="text-slate-900">email đã đăng ký</strong>.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-amber-600 font-bold shrink-0">3.</span>
                <span>Ban Tổ Chức VinUni sẽ duyệt tài khoản và bạn có thể đăng nhập ngay sau đó.</span>
              </li>
            </ol>
          </div>

          {/* Nút gửi email tự điền */}
          <a
            href={`mailto:${BTC_EMAIL}?subject=${encodeURIComponent(
              `[VinUni AI Thực Chiến] Yêu cầu duyệt tài khoản - ${pendingEmail}`
            )}&body=${encodeURIComponent(
              `Kính gửi Ban Tổ Chức Chương trình Đào tạo Nhân tài AI Thực chiến,\n\nTôi vừa đăng ký tài khoản tham gia Mini Hackathon với thông tin sau:\n- Email đăng ký: ${pendingEmail}\n- Họ và tên: [Điền họ và tên]\n- Mã sinh viên/học viên: [Điền mã nếu có]\n- Đơn vị đào tạo/Trường: [Điền trường/đơn vị]\n\nKính đề nghị Ban Tổ Chức phê duyệt tài khoản để tôi có thể tham gia vào hệ thống.\n\nTrân trọng cảm ơn!`
            )}`}
            className="flex items-center justify-center space-x-2 w-full py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm transition shadow-sm"
          >
            <Mail className="w-4 h-4" />
            <span>Mở Email gửi xác nhận tới BTC</span>
            <ExternalLink className="w-4 h-4 opacity-70" />
          </a>

          <button
            onClick={() => {
              setPendingEmail(null);
              setIsRegister(false);
            }}
            className="w-full text-xs text-slate-500 hover:text-slate-800 font-medium transition"
          >
            ← Quay lại màn hình đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 text-slate-800 selection:bg-blue-600 selection:text-white">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* ── Left column: VinUni Branding & 1-Click Demo Accounts ────────── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-lg shadow-slate-200/60">
          <div>
            {/* VinUni AI Logo */}
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-900 flex items-center justify-center text-white shadow-md shadow-blue-900/20">
                <Bot className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[#0a2540] tracking-tight">
                  VinUni <span className="text-blue-600">AI</span>
                </h1>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest block -mt-0.5">
                  AI Thực Chiến • Mini Hackathon
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Sáng kiến đào tạo nhân tài công nghệ cao của <strong>Tập đoàn Vingroup</strong> phối hợp cùng <strong>Trường Đại học VinUni</strong>. Đào tạo 12 tuần theo chuẩn quốc tế SFIA với dữ liệu và bài toán thật.
            </p>

            {/* 1-Click Role Switcher Demo */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span className="flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>1-Click Test Trực Tiếp Role</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono font-bold border border-blue-200">
                  Demo Roles
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoClick('admin')}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-red-50/60 border border-slate-200 hover:border-red-300 text-left transition group shadow-2xs"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-red-700 transition flex items-center space-x-1.5">
                      <span>👑 Ban Tổ Chức (Admin VinUni)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Quản trị toàn diện, duyệt đề tài AI & phân công nhân sự</div>
                  </div>
                  <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 shrink-0 ml-2">
                    admin
                  </span>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoClick('judge')}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-purple-50/60 border border-slate-200 hover:border-purple-300 text-left transition group shadow-2xs"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700 transition flex items-center space-x-1.5">
                      <span>⚖️ Hội Đồng Giám Khảo (Judge)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Chấm điểm Blind Rubric 4 tiêu chí & Đánh giá sản phẩm</div>
                  </div>
                  <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 shrink-0 ml-2">
                    judge
                  </span>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoClick('mentor')}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 text-left transition group shadow-2xs"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition flex items-center space-x-1.5">
                      <span>💡 Cố Vấn (Mentor Vingroup)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Kanban Tickets hỗ trợ & Giám sát tiến độ học viên</div>
                  </div>
                  <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 shrink-0 ml-2">
                    mentor
                  </span>
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoClick('leader')}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 text-left transition group shadow-2xs"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition flex items-center space-x-1.5">
                      <span>🚩 Trưởng Nhóm (AI Team Leader)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Quản lý đội thi, chọn đề tài Vingroup & nộp bài</div>
                  </div>
                  <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 shrink-0 ml-2">
                    leader
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-6 flex items-center justify-between text-[11px] text-slate-500">
            <span>VinUni x Vingroup AI Bootcamp</span>
            <span className="font-semibold text-blue-700">SFIA Standard</span>
          </div>
        </div>

        {/* ── Right column: Login / Register Form ─────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xl shadow-slate-200/50">
          <div>
            {/* Tab switch */}
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  !isRegister
                    ? 'bg-white text-blue-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  isRegister
                    ? 'bg-white text-blue-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Đăng ký thí sinh AI
              </button>
            </div>

            {/* Error / Success Feedback */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-2 text-xs text-emerald-700">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {isRegister && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Họ và tên thí sinh <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Nguyễn Văn A"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Mã sinh viên / học viên
                    </label>
                    <div className="relative">
                      <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="VD: 2026AI0123"
                        className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email học viên / tài khoản <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@vinuni.edu.vn"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mật khẩu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs transition shadow-md shadow-blue-900/10 mt-2"
              >
                {loading
                  ? 'Đang xử lý...'
                  : isRegister
                  ? 'Đăng ký & Chờ BTC duyệt'
                  : 'Đăng nhập vào hệ thống'}
              </button>
            </form>
          </div>

          <div className="pt-6 border-t border-slate-100 mt-6 text-center text-xs text-slate-500">
            {isRegister ? (
              <p>
                Đã có tài khoản?{' '}
                <button
                  type="button"
                  onClick={() => setIsRegister(false)}
                  className="font-bold text-blue-700 hover:underline"
                >
                  Đăng nhập ngay
                </button>
              </p>
            ) : (
              <p>
                Học viên mới?{' '}
                <button
                  type="button"
                  onClick={() => setIsRegister(true)}
                  className="font-bold text-blue-700 hover:underline"
                >
                  Đăng ký tài khoản tham gia
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
