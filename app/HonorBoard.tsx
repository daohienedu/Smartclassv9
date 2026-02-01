import React, { useEffect, useState } from 'react';
import { provider } from '../core/provider';
import { Student, ClassInfo } from '../types';
import { Icon } from '../components/Icons';

interface StudentStats {
    student: Student;
    className: string;
    points: number;
    totalTasks: number;
    completedTasks: number;
    progressPercent: number;
    badges: BadgeType[];
}

type BadgeType = 
    | 'language_expert' 
    | 'digital_researcher' 
    | 'vocab_warrior' 
    | 'communicator' 
    | 'perfect_attendance' 
    | 'civility_ambassador' 
    | 'digital_citizen';

const BADGE_CONFIG: Record<BadgeType, { label: string, icon: string, color: string, bg: string, border: string, desc: string }> = {
    language_expert: { 
        label: 'Chuyên gia Ngôn ngữ', 
        icon: 'crown', 
        color: 'text-yellow-700',
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        desc: 'Hoàn thành tốt các bài tập ngôn ngữ' 
    },
    digital_researcher: { 
        label: 'Mọt sách Công nghệ', 
        icon: 'globe', 
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        desc: 'Tích cực nghiên cứu tài liệu số' 
    },
    vocab_warrior: { 
        label: 'Chiến thần Từ vựng', 
        icon: 'gamepad', 
        color: 'text-purple-600',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        desc: 'Đạt điểm cao trong Game học tập' 
    },
    communicator: { 
        label: 'Người truyền cảm hứng', 
        icon: 'users', 
        color: 'text-pink-600',
        bg: 'bg-pink-50',
        border: 'border-pink-200',
        desc: 'Tương tác và phát âm xuất sắc' 
    },
    perfect_attendance: { 
        label: 'Đúng giờ như đồng hồ', 
        icon: 'clock', 
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        desc: 'Chuyên cần tuyệt đối' 
    },
    civility_ambassador: { 
        label: 'Đại sứ Văn minh', 
        icon: 'star', 
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        desc: 'Hành vi và nề nếp gương mẫu' 
    },
    digital_citizen: { 
        label: 'Công dân số gương mẫu', 
        icon: 'message', 
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        desc: 'Giao tiếp lịch sự, văn minh' 
    }
};

const DISPLAY_ORDER: BadgeType[] = [
    'language_expert', 
    'digital_researcher', 
    'vocab_warrior', 
    'communicator', 
    'perfect_attendance', 
    'civility_ambassador', 
    'digital_citizen'
];

export const HonorBoard: React.FC = () => {
  const [stats, setStats] = useState<StudentStats[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedClass, setSelectedClass] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
        const [students, classesList, tasks, behaviors] = await Promise.all([
            provider.students.list(),
            provider.classes.list(),
            provider.tasks.list('all'), 
            provider.behaviors.list()
        ]);
        
        const sortedByPoints = [...students].sort((a,b) => b.points - a.points);
        const top3PointIds = sortedByPoints.slice(0, 3).map(s => s.id);

        const classTaskPromises = classesList.map(c => provider.tasks.list(c.id));
        const classTasksResults = await Promise.all(classTaskPromises);
        const allTasks = [...tasks, ...classTasksResults.flat()];
        const uniqueTasks = Array.from(new Map(allTasks.map(item => [item.id, item])).values());

        const replyPromises = uniqueTasks.map(t => provider.tasks.getReplies(t.id));
        const repliesResults = await Promise.all(replyPromises);
        const allReplies = repliesResults.flat();

        setClasses(classesList);

        const calculatedStats: StudentStats[] = students.map(s => {
            const classInfo = classesList.find(c => c.id === s.classId);
            
            const assignedTasks = uniqueTasks.filter(t => t.classId === 'all' || t.classId === s.classId);
            const completedCount = assignedTasks.filter(t => 
                allReplies.some(r => r.taskId === t.id && r.studentId === s.id)
            ).length;
            
            const total = assignedTasks.length;
            const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

            const sBehaviors = behaviors.filter(b => b.studentId === s.id);
            const praiseCount = sBehaviors.filter(b => b.type === 'PRAISE').length;
            const warnCount = sBehaviors.filter(b => b.type === 'WARN').length;

            // --- BADGE LOGIC ---
            const badges: BadgeType[] = [];

            // 1. Language Expert: Completed >= 10 tasks
            if (completedCount >= 10) badges.push('language_expert');

            // 2. Digital Researcher: Points > 15
            if (s.points > 15) badges.push('digital_researcher');

            // 3. Vocabulary Warrior: Top 3 points global
            if (top3PointIds.includes(s.id)) badges.push('vocab_warrior');

            // 4. Great Communicator: High praise count
            if (praiseCount >= 3) badges.push('communicator');

            // 5. Perfect Attendance: No Warnings
            if (warnCount === 0) badges.push('perfect_attendance');

            // 6. Civility Ambassador: Very high praise
            if (praiseCount >= 5) badges.push('civility_ambassador');

            // 7. Model Digital Citizen: No warns + some participation
            if (warnCount === 0 && completedCount > 0) badges.push('digital_citizen');

            return {
                student: s,
                className: classInfo?.className || '',
                points: s.points,
                totalTasks: total,
                completedTasks: completedCount,
                progressPercent: percent,
                badges
            };
        });

        setStats(calculatedStats);
    } catch (e) {
        console.error("Failed to load honor board", e);
    } finally {
        setLoading(false);
    }
  };

  // Filter Logic
  const filteredStats = stats.filter(s => selectedClass === 'all' || s.student.classId === selectedClass);

  if (loading) return <div className="p-10 text-center text-gray-500">Đang cập nhật bảng vàng...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
        {/* Banner */}
        <div className="relative bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-lg overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-center">
                <div className="mb-4 md:mb-0 text-center md:text-left">
                    <h1 className="text-3xl font-extrabold uppercase tracking-widest flex items-center justify-center md:justify-start">
                        <Icon name="medal" className="mr-3 text-yellow-300" size={36} />
                        Bảng Vàng Danh Hiệu
                    </h1>
                    <p className="opacity-90 mt-2 font-medium">Vinh danh các cá nhân xuất sắc theo từng hạng mục</p>
                </div>
                
                {/* Controls */}
                <div className="flex items-center gap-2 bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                    <label className="text-sm font-bold text-white whitespace-nowrap">Lớp:</label>
                    <select 
                        className="px-3 py-1.5 border-none rounded bg-white text-gray-800 text-sm focus:ring-0 font-medium"
                        value={selectedClass}
                        onChange={e => setSelectedClass(e.target.value)}
                    >
                        <option value="all">Toàn trường</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                    </select>
                </div>
            </div>
            {/* Background Decor */}
            <div className="absolute -top-10 -right-10 w-60 h-60 bg-white opacity-10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-20 w-40 h-40 bg-pink-400 opacity-20 rounded-full blur-2xl"></div>
        </div>

        {/* Badge Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DISPLAY_ORDER.map(badgeKey => {
                const config = BADGE_CONFIG[badgeKey];
                // Get students having this badge, sort by points descending, take top 3
                const winners = filteredStats
                    .filter(s => s.badges.includes(badgeKey))
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 3);

                return (
                    <div key={badgeKey} className={`bg-white rounded-2xl shadow-sm border ${config.border} overflow-hidden flex flex-col h-full`}>
                        {/* Header */}
                        <div className={`p-4 ${config.bg} border-b ${config.border} flex items-center justify-between`}>
                            <div className="flex items-center">
                                <div className={`w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm mr-3 ${config.color}`}>
                                    <Icon name={config.icon} size={20} />
                                </div>
                                <div>
                                    <h3 className={`font-bold text-base ${config.color}`}>{config.label}</h3>
                                    <p className="text-[10px] text-gray-500 opacity-80">{config.desc}</p>
                                </div>
                            </div>
                        </div>

                        {/* List Top 3 */}
                        <div className="flex-1 p-2">
                            {winners.length === 0 ? (
                                <div className="h-32 flex flex-col items-center justify-center text-gray-400 text-xs italic">
                                    <Icon name="trophy" size={24} className="mb-2 opacity-20" />
                                    Chưa có chủ nhân
                                </div>
                            ) : (
                                <div className="space-y-2 mt-2">
                                    {winners.map((w, idx) => (
                                        <div key={w.student.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition border border-transparent hover:border-gray-100">
                                            <div className="flex items-center">
                                                {/* Rank Badge */}
                                                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold mr-3 ${
                                                    idx === 0 ? 'bg-yellow-400 text-white shadow-sm' :
                                                    idx === 1 ? 'bg-gray-300 text-white' :
                                                    'bg-orange-300 text-white'
                                                }`}>
                                                    {idx + 1}
                                                </div>
                                                
                                                {/* Avatar */}
                                                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden mr-3 border border-gray-100">
                                                    {w.student.avatar ? (
                                                        <img src={w.student.avatar} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xs">
                                                            {w.student.fullName[0]}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Info */}
                                                <div>
                                                    <div className="text-sm font-bold text-gray-800 line-clamp-1">{w.student.fullName}</div>
                                                    <div className="text-[10px] text-gray-500">{w.className}</div>
                                                </div>
                                            </div>
                                            
                                            {/* Points */}
                                            <div className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                {w.points} pts
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {/* Footer stats */}
                        {winners.length > 0 && (
                            <div className="bg-gray-50 p-2 text-center text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                Top 3 xuất sắc nhất
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
  );
};