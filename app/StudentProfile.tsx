import React, { useEffect, useState } from 'react';
import { provider } from '../core/provider';
import { Student, ClassInfo, Parent, User } from '../types';
import { Icon } from '../components/Icons';

type BadgeType = 
    | 'language_expert' 
    | 'digital_researcher' 
    | 'vocab_warrior' 
    | 'communicator' 
    | 'perfect_attendance' 
    | 'civility_ambassador' 
    | 'digital_citizen';

const BADGE_CONFIG: Record<BadgeType, { label: string, icon: string, color: string, desc: string }> = {
    language_expert: { 
        label: 'Chuyên gia Ngôn ngữ', 
        icon: 'crown', 
        color: 'text-yellow-700 bg-yellow-100 border-yellow-200', 
        desc: 'Hoàn thành 10 bài tập tiếng Anh đạt điểm tuyệt đối' 
    },
    digital_researcher: { 
        label: 'Mọt sách Công nghệ', 
        icon: 'globe', 
        color: 'text-blue-600 bg-blue-100 border-blue-200', 
        desc: 'Thường xuyên nghiên cứu tài liệu mở (OER)' 
    },
    vocab_warrior: { 
        label: 'Chiến thần Từ vựng', 
        icon: 'gamepad', 
        color: 'text-purple-600 bg-purple-100 border-purple-200', 
        desc: 'Đạt điểm cao nhất trong Game học tập' 
    },
    communicator: { 
        label: 'Người truyền cảm hứng', 
        icon: 'users', 
        color: 'text-pink-600 bg-pink-100 border-pink-200', 
        desc: 'Có clip ghi âm phát âm chuẩn nhất' 
    },
    perfect_attendance: { 
        label: 'Đúng giờ như đồng hồ', 
        icon: 'clock', 
        color: 'text-emerald-600 bg-emerald-100 border-emerald-200', 
        desc: 'Không nghỉ học và không đi muộn trong tháng' 
    },
    civility_ambassador: { 
        label: 'Đại sứ Văn minh', 
        icon: 'star', 
        color: 'text-orange-600 bg-orange-100 border-orange-200', 
        desc: 'Đạt điểm nề nếp tích cực tối đa trong tuần' 
    },
    digital_citizen: { 
        label: 'Công dân số gương mẫu', 
        icon: 'message', 
        color: 'text-indigo-600 bg-indigo-100 border-indigo-200', 
        desc: 'Giao tiếp lịch sự, văn minh' 
    }
};

export const StudentProfile: React.FC = () => {
  const [student, setStudent] = useState<Student | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Stats
  const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, percent: 0 });
  const [badges, setBadges] = useState<BadgeType[]>([]);

  useEffect(() => {
    const loadData = async () => {
        try {
            const userJson = localStorage.getItem('mrs_hien_user');
            if (!userJson) {
                setLoading(false);
                return;
            }
            const user = JSON.parse(userJson) as User;
            let currentStudent: Student | null = null;

            if (user.role === 'student' && user.relatedId) {
                try {
                    currentStudent = await provider.students.get(user.relatedId);
                } catch(e) {}
            }
            if (!currentStudent) {
                const all = await provider.students.list();
                currentStudent = all.find(s => s.fullName === user.fullName) || null;
            }

            if (currentStudent) {
                setStudent(currentStudent);
                
                // Load additional info
                const [clsList, parents, tasks, students, behaviors] = await Promise.all([
                    provider.classes.list(),
                    provider.parents.list(),
                    provider.tasks.list(''), 
                    provider.students.list(),
                    provider.behaviors.list(currentStudent.id)
                ]);

                const cls = clsList.find(c => c.id === currentStudent!.classId);
                setClassInfo(cls || null);

                const prt = parents.find(p => p.id === currentStudent!.parentId);
                setParent(prt || null);

                // Stats Calculation
                // 1. Task Progress
                const assignedTasks = tasks.filter(t => t.classId === 'all' || t.classId === currentStudent!.classId);
                let completedCount = 0;
                await Promise.all(assignedTasks.map(async (t) => {
                    const replies = await provider.tasks.getReplies(t.id);
                    if (replies.find(r => r.studentId === currentStudent!.id)) completedCount++;
                }));

                const totalTasks = assignedTasks.length;
                const percent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
                setTaskStats({ total: totalTasks, completed: completedCount, percent });

                // 2. Badges (Sync Logic with HonorBoard)
                const myBadges: BadgeType[] = [];
                
                // Sort for Vocab Warrior (Top 3 Global)
                const sortedByPoints = [...students].sort((a,b) => b.points - a.points);
                const top3Ids = sortedByPoints.slice(0, 3).map(s => s.id);

                const praiseCount = behaviors.filter(b => b.type === 'PRAISE').length;
                const warnCount = behaviors.filter(b => b.type === 'WARN').length;

                // Logic
                if (completedCount >= 10) myBadges.push('language_expert');
                if (currentStudent.points > 15) myBadges.push('digital_researcher');
                if (top3Ids.includes(currentStudent.id)) myBadges.push('vocab_warrior');
                if (praiseCount >= 3) myBadges.push('communicator');
                if (warnCount === 0) myBadges.push('perfect_attendance');
                if (praiseCount >= 5) myBadges.push('civility_ambassador');
                if (warnCount === 0 && completedCount > 0) myBadges.push('digital_citizen');

                setBadges(myBadges);
            }
        } catch (e) {
            console.error("Error loading profile", e);
        } finally {
            setLoading(false);
        }
    };
    loadData();
  }, []);

  if (loading) return <div className="p-10 text-center text-gray-500">Đang tải hồ sơ...</div>;
  if (!student) return <div className="p-10 text-center text-gray-500">Không tìm thấy thông tin học sinh.</div>;

  const formatDateDisplay = (isoDate: string) => {
      if (!isoDate) return '---';
      const parts = isoDate.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return isoDate;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8 items-center md:items-start">
            {/* Left: Avatar & Basic Identity */}
            <div className="flex flex-col items-center">
                <div className="w-32 h-32 rounded-full border-4 border-emerald-100 bg-emerald-50 flex items-center justify-center text-emerald-600 text-4xl font-bold shadow-sm overflow-hidden mb-4">
                    {student.avatar ? (
                        <img src={student.avatar} alt={student.fullName} className="w-full h-full object-cover" />
                    ) : (
                        student.fullName.charAt(0)
                    )}
                </div>
                <h1 className="text-2xl font-bold text-gray-800 text-center">{student.fullName}</h1>
                <p className="text-gray-500 text-sm">MSHS: {student.id}</p>
                <span className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${student.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {student.status === 'Active' ? 'Đang học' : 'Nghỉ học'}
                </span>
            </div>

            {/* Right: Detailed Info */}
            <div className="flex-1 w-full">
                <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Thông tin cá nhân</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                    <div>
                        <span className="block text-gray-500 mb-1">Lớp học</span>
                        <div className="font-medium text-gray-900 flex items-center">
                            <Icon name="book" size={16} className="mr-2 text-emerald-600" />
                            {classInfo?.className || '---'}
                        </div>
                    </div>
                    <div>
                        <span className="block text-gray-500 mb-1">Ngày sinh</span>
                        <div className="font-medium text-gray-900 flex items-center">
                            <Icon name="calendar" size={16} className="mr-2 text-emerald-600" />
                            {formatDateDisplay(student.dob)}
                        </div>
                    </div>
                    <div>
                        <span className="block text-gray-500 mb-1">Giới tính</span>
                        <div className="font-medium text-gray-900">
                            {student.gender === 'Male' ? 'Nam' : 'Nữ'}
                        </div>
                    </div>
                    <div>
                        <span className="block text-gray-500 mb-1">Địa chỉ</span>
                        <div className="font-medium text-gray-900">{student.address || '---'}</div>
                    </div>
                </div>

                <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4 mt-6">Thông tin liên hệ (Phụ huynh)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                    <div>
                        <span className="block text-gray-500 mb-1">Họ và tên</span>
                        <div className="font-medium text-gray-900">{parent?.fullName || '---'}</div>
                    </div>
                    <div>
                        <span className="block text-gray-500 mb-1">Số điện thoại</span>
                        <div className="font-medium text-gray-900 flex items-center">
                            <Icon name="phone" size={16} className="mr-2 text-emerald-600" />
                            {parent?.phone || '---'}
                        </div>
                    </div>
                    <div>
                        <span className="block text-gray-500 mb-1">Email</span>
                        <div className="font-medium text-gray-900">{parent?.email || '---'}</div>
                    </div>
                    <div>
                        <span className="block text-gray-500 mb-1">Mối quan hệ</span>
                        <div className="font-medium text-gray-900 capitalize">{parent?.relationship === 'Father' ? 'Bố' : parent?.relationship === 'Mother' ? 'Mẹ' : parent?.relationship || '---'}</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Stats & Badges Section */}
        <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Stats Summary */}
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-xl font-bold mb-6 flex items-center">
                        <Icon name="chart" className="mr-2" /> Thống kê học tập
                    </h3>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="opacity-90">Điểm tích lũy (Stars)</span>
                            <span className="text-3xl font-extrabold text-yellow-300">{student.points} <span className="text-lg">★</span></span>
                        </div>
                        
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="opacity-90">Tiến độ làm bài tập</span>
                                <span className="font-bold">{taskStats.completed}/{taskStats.total} ({taskStats.percent}%)</span>
                            </div>
                            <div className="w-full bg-black/20 rounded-full h-3 overflow-hidden">
                                <div 
                                    className="bg-green-400 h-full rounded-full transition-all duration-1000" 
                                    style={{ width: `${taskStats.percent}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Decoration */}
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white opacity-10 rounded-full blur-xl"></div>
            </div>

            {/* Right: Badges Collection */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    <Icon name="medal" className="mr-2 text-yellow-500" /> Bộ sưu tập Huy hiệu
                </h3>
                
                {badges.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
                        <Icon name="trophy" size={32} className="mb-2 opacity-30" />
                        <p>Chưa có huy hiệu nào.</p>
                        <p>Hãy cố gắng học tập và làm bài nhé!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {badges.map(b => (
                            <div key={b} className={`p-3 rounded-xl border flex flex-col items-center text-center ${BADGE_CONFIG[b].color} bg-opacity-10 border-opacity-20 relative group`}>
                                <div className={`p-2 rounded-full mb-2 ${BADGE_CONFIG[b].color} bg-opacity-20`}>
                                    <Icon name={BADGE_CONFIG[b].icon} size={20} />
                                </div>
                                <span className="font-bold text-sm text-gray-800">{BADGE_CONFIG[b].label}</span>
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 hidden group-hover:block w-40 bg-gray-800 text-white text-[10px] p-2 rounded shadow-lg z-10">
                                    {BADGE_CONFIG[b].desc}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};