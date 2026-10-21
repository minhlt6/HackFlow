import React, { useState } from 'react';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import {
  GraduationCap,
  Plus,
  Mail,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

export const AdminMentorsJudgesPage: React.FC = () => {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [specialization, setSpecialization] = useState('Computer Vision & LLMs');
  const [alert, setAlert] = useState<string | null>(null);

  const [mentors, setMentors] = useState<Array<{
    id: string;
    name: string;
    email: string;
    topic: string;
    openTickets: number;
    avatar: string;
  }>>([
    {
      id: 'mentor-1',
      name: 'TS. Nguyễn Văn Hướng Dẫn',
      email: 'mentor.ai@ailab.org.vn',
      topic: 'AI trong Y tế và LLM RAG',
      openTickets: 1,
      avatar: 'N',
    },
    {
      id: 'mentor-2',
      name: 'ThS. Trần Thị Thông Minh',
      email: 'thongminh.tran@iotlab.org',
      topic: 'Đô thị Thông minh và IoT Xanh',
      openTickets: 1,
      avatar: 'T',
    },
    {
      id: 'mentor-3',
      name: 'Kỹ sư Lê Bảo Mật',
      email: 'baomat.le@fintech.io',
      topic: 'Công nghệ Tài chính và Blockchain',
      openTickets: 0,
      avatar: 'L',
    },
    {
      id: 'mentor-4',
      name: 'Bác sĩ Vũ Trí Tuệ',
      email: 'tritue.vu@medtech.vn',
      topic: 'Y tế và Chăm sóc Sức khỏe',
      openTickets: 0,
      avatar: 'V',
    },
  ]);

  const handleDeleteMentor = (id: string, mentorName: string) => {
    if (window.confirm(`Xác nhận xóa cố vấn "${mentorName}"?`)) {
      setMentors((prev) => prev.filter((m) => m.id !== id));
      setAlert(`Đã xóa cố vấn ${mentorName}`);
      setTimeout(() => setAlert(null), 3000);
    }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setMentors((prev) => [
      ...prev,
      {
        id: `mentor-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        topic: specialization.trim(),
        openTickets: 0,
        avatar: name.trim().charAt(0).toUpperCase(),
      },
    ]);
    setAlert(`Đã gửi thư mời Cố vấn chuyên môn tới ${email}!`);

    setIsInviteOpen(false);
    setName('');
    setEmail('');
    setTimeout(() => setAlert(null), 3000);
  };

  return (
    <div className="space-y-6 ">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="font-semibold tracking-tight text-foreground text-2xl sm:text-3xl tracking-wide"
          >
            Quản Lý Cố Vấn Chuyên Môn
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Phân bổ cố vấn chuyên môn hỗ trợ giải đáp kỹ thuật theo từng lĩnh vực đề tài.
          </p>
        </div>

        <Button variant="primary" onClick={() => setIsInviteOpen(true)} className="gap-2">
          <Plus size={16} />
          <span>Mời Cố Vấn Mới</span>
        </Button>
      </div>

      {alert && (
        <div className="p-3.5 rounded-[10px] bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 size={15} />
          <span>{alert}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex border-b border-border gap-4">
        <div className="pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 border-[#6366F1] text-primary">
          <GraduationCap size={16} />
          <span>Cố Vấn Chuyên Môn ({mentors.length})</span>
        </div>
      </div>

      {/* Empty State */}
      {mentors.length === 0 && (
        <div className="rounded-[16px] border border-dashed border-border p-12 text-center bg-card">
          <GraduationCap size={40} className="mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold tracking-tight text-foreground text-lg text-foreground mb-1">Chưa Có Cố Vấn Chuyên Môn</h3>
          <p className="text-muted-foreground text-xs max-w-sm mx-auto mb-4">
            Chưa có cố vấn nào trong danh sách. Hãy mời các cố vấn theo từng chuyên môn để hỗ trợ thí sinh.
          </p>
          <Button variant="primary" size="sm" onClick={() => setIsInviteOpen(true)} className="gap-1.5">
            <Plus size={14} />
            <span>Mời Cố Vấn Mới</span>
          </Button>
        </div>
      )}

      {/* Roster Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mentors.map((m) => (
          <div
            key={m.id}
            className="rounded-[16px] border border-border bg-card p-5 space-y-4 relative group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-400 font-semibold tracking-tight text-foreground text-lg border border-purple-500/30">
                  {m.avatar}
                </div>
                <div>
                  <h4 className="font-bold text-foreground text-base">{m.name}</h4>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail size={12} />
                    <span>{m.email}</span>
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteMentor(m.id, m.name)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Xóa cố vấn"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="p-3 rounded-[10px] bg-muted/40 dark:bg-slate-900/60 border border-border text-xs space-y-1">
              <span className="text-muted-foreground block">Lĩnh vực phụ trách:</span>
              <span className="text-purple-700 dark:text-purple-400 font-medium">{m.topic}</span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
              <span className="text-muted-foreground">Tickets cần hỗ trợ:</span>
              <Badge variant={m.openTickets > 0 ? 'warning' : 'success'}>
                {m.openTickets} tickets
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Mời Cố Vấn Chuyên Môn Mới"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <Input
            label="Họ và tên cố vấn *"
            placeholder="Ví dụ: TS. Nguyễn Văn A..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Địa chỉ Email *"
            type="email"
            placeholder="mentor@university.edu.vn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Lĩnh vực đề tài hỗ trợ"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="ghost" type="button" onClick={() => setIsInviteOpen(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Gửi thư mời
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
