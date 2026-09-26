import React, { useState, useEffect } from 'react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { User, Save, CheckCircle, AlertCircle, Users, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Team } from '../../types';

const SKILL_OPTIONS = ['Frontend', 'Backend', 'AI/ML', 'IoT', 'UI/UX', 'Blockchain', 'Data Science', 'Mobile'];
const DIRECTION_OPTIONS = ['Frontend', 'Backend', 'AI/ML', 'IoT', 'UI/UX', 'Blockchain', 'Data Science', 'Mobile', 'Full Stack', 'DevOps', 'QA/Testing'];
const GENDER_OPTIONS = [{ value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }, { value: 'other', label: 'Khác' }];

export const ProfilePage: React.FC = () => {
  const { user, fetchCurrentUser } = useAuthStore();
  const [team, setTeam] = useState<Team | null>(null);

  // Section 1
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('male');
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  const [school, setSchool] = useState('');

  // Section 2
  const [skills, setSkills] = useState<string[]>([]);
  const [majorDirection, setMajorDirection] = useState('');
  const [bio, setBio] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setStudentId(user.student_id || '');
      setGithubUsername(user.github_username || '');
      setDateOfBirth((user as any).date_of_birth || '');
      setGender((user as any).gender || 'male');
      setProvince((user as any).province || '');
      setDistrict((user as any).district || '');
      setPhone((user as any).phone || '');
      setSchool(user.school || '');
      setSkills(user.skills || []);
      setMajorDirection(user.major_direction || '');
      setBio(user.bio || '');
      
      if (user.role === 'participant') {
        fetchMyTeam();
      }
    }
  }, [user]);

  const fetchMyTeam = async () => {
    try {
      const res = await apiClient.get('/teams/my-team');
      if (res.data?.success && res.data.data) {
        setTeam(res.data.data);
      }
    } catch {
      // Ignore
    }
  };

  const handleSkillChange = (skill: string) => {
    setSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiClient.put('/users/profile', {
        full_name: fullName.trim(),
        student_id: studentId.trim() || undefined,
        github_username: githubUsername.trim() || undefined,
        date_of_birth: dateOfBirth || undefined,
        gender,
        province: province.trim() || undefined,
        district: district.trim() || undefined,
        phone: phone.trim() || undefined,
        school: school.trim() || undefined,
        skills,
        major_direction: majorDirection || undefined,
        bio: bio.trim() || undefined,
      });
      if (res.data?.success) {
        await fetchCurrentUser();
        setMessage({ type: 'success', text: 'Cập nhật hồ sơ thành công!' });
        setTimeout(() => setMessage(null), 4000);
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error?.message || err.response?.data?.detail || 'Không thể cập nhật hồ sơ.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {user?.profile_completed === false && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-medium text-sm">⚠️ Vui lòng hoàn thiện hồ sơ để có thể tham gia cuộc thi.</span>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-black text-white mb-1">Hồ sơ cá nhân</h1>
        <p className="text-slate-400 text-sm">Cập nhật thông tin để Ban tổ chức xác minh danh tính.</p>
      </div>

      {message && (
        <div className={`flex items-center space-x-2 p-4 rounded-xl border text-sm mb-6 ${
            message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Thông tin cơ bản */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">1. Thông tin cơ bản</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Họ và tên *</label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mã sinh viên</label>
                  <input type="text" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Ngày sinh</label>
                  <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Giới tính</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
                    {GENDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Trường học</label>
                  <input type="text" value={school} onChange={(e) => setSchool(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Số điện thoại</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tỉnh/Thành phố</label>
                  <input type="text" value={province} onChange={(e) => setProvince(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Quận/Huyện</label>
                  <input type="text" value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">GitHub Username</label>
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 text-sm">github.com/</span>
                    <input type="text" value={githubUsername} onChange={(e) => setGithubUsername(e.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Chuyên môn */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white mb-4">2. Chuyên môn</h2>
              
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-300 mb-2">Kỹ năng</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {SKILL_OPTIONS.map(skill => (
                    <label key={skill} className="flex items-center space-x-2 text-sm text-slate-300 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={skills.includes(skill)}
                        onChange={() => handleSkillChange(skill)}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/20"
                      />
                      <span>{skill}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Hướng chuyên môn chính</label>
                <select value={majorDirection} onChange={(e) => setMajorDirection(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
                  <option value="">-- Chọn hướng chuyên môn --</option>
                  {DIRECTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Giới thiệu ngắn (Bio)</label>
                <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Một vài dòng về bản thân..."
                />
              </div>
            </div>

            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-semibold text-sm transition shadow-lg shadow-emerald-950/40 flex justify-center items-center space-x-2">
              <Save className="w-4 h-4" />
              <span>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
            </button>
          </form>
        </div>

        {/* Section 3: Right Sidebar */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <User className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="text-white font-bold text-lg">{user?.full_name || 'Tài khoản'}</div>
            <div className="text-slate-400 text-sm mb-2">{user?.email}</div>
            <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono uppercase">
              {user?.role}
            </span>
          </div>

          {user?.role === 'participant' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-base font-bold text-white mb-4">3. Thông tin đội</h2>
              {team ? (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">{team.name}</div>
                      <div className="text-xs text-slate-400 capitalize flex items-center space-x-1">
                        <span>Vai trò:</span>
                        <span className="text-emerald-400">{team.members?.find(m => m.user_id === user?.id)?.role_in_team}</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2">
                    <span className="px-2 py-1 rounded bg-slate-950 text-xs text-slate-300 font-mono border border-slate-800">
                      Trạng thái: {team.status}
                    </span>
                  </div>
                  <Link to="/team" className="mt-4 block w-full py-2 text-center rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition">
                    Vào quản lý đội →
                  </Link>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-sm text-slate-400 mb-4">Bạn chưa tham gia đội nào.</div>
                  <Link to="/team" className="block w-full py-2 text-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition">
                    Tạo / Tham gia đội →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
