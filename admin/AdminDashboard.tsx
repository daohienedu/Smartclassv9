import React, { useEffect, useState } from 'react';
import { provider } from '../core/provider';
import { Student, ClassInfo, Announcement, Task } from '../types';
import { Icon } from '../components/Icons';
import { useNavigate } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Stats Data
  const [stats, setStats] = useState({
    classesCount: 0,
    studentsCount: 0,
    attendanceToday: { present: 0, total: 0, rate: 0, status: 'Chưa cập nhật' },
    totalPraisePoints: 0
  });

  // Lists Data
  const [students, setStudents] = useState<Student[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  
  // Honor Board Filter
  const [topFilter, setTopFilter] = useState<3 | 5 | 10>(5);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const [sList, cList, bList, aList, tList] = await Promise.all([
        provider.students.list(),
        provider.classes.list(),
        provider.behaviors.list(),
        provider.announcements.list(),
        provider.tasks.list('all') // Get all tasks
      ]);

      // 1. Basic Counts
      const praisePoints = bList.filter(b => b.type === 'PRAISE').reduce((acc, curr) => acc + curr.points, 0);

      // 2. Attendance Today Calculation
      // Note: This iterates classes to check today's attendance. 
      // In a large real-world app, this should be a single backend aggregation endpoint.
      let presentCount = 0;
      let checkedStudentsCount = 0;
      let hasData = false;

      // We only check the first few classes to avoid too many requests in this demo/mock environment
      // Or if using local/mock provider, it's fast enough to check all.
      // Let's try checking all classes since the dataset is usually small in this context.
      const attPromises = cList.map(c => provider.getAttendance(c.id, today));
      const attResults = await Promise.all(attPromises);
      
      attResults.flat().forEach(record => {
          hasData = true;
          checkedStudentsCount++;
          if (record.status === 'PRESENT') presentCount++;
          if (record.status === 'LATE') presentCount += 0.5; // Count late as half or full depending on policy. Let's just count presence.
      });

      const attRate = checkedStudentsCount > 0 ? Math.round((presentCount / checkedStudentsCount) * 100) : 0;

      setStats({
        classesCount: cList.length,
        studentsCount: sList.length,
        attendanceToday: {
            present: presentCount,
            total: checkedStudentsCount,
            rate: attRate,
            status: hasData ? `${attRate}%` : 'Chưa có dữ liệu'
        },
        totalPraisePoints: praisePoints
      });

      // 3. Honor Board Data (Sort by points)
      setStudents([...sList].sort((a, b) => b.points - a.points));

      // 4. Announcements (Newest first)
      setAnnouncements(aList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5));

      // 5. Pending Tasks (Tasks due in the future)
      const now = new Date();
      const upcoming = tList
        .filter(t => new Date(t.dueDate) >= now)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 5);
      setPendingTasks(upcoming);

    } catch (error) {
      console.error("Dashboard load failed", error);
    } finally {
      setLoading(false);
    }
  };

  const getTopStudents = () => {
      return students.slice(0, topFilter);
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Đang tải dữ liệu tổng quan...</div>;

  return (
    <div className="space-y-6">
      {/* 1. TOP CARDS STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Classes */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-sm font-medium text-gray-500">Lớp học</p>
            <h3 className="text-3xl font-bold text-gray-800 mt-1">{stats.classesCount}</h3>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
            <Icon name="book" size={24} />
          </div>
        </div>

        {/* Students */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-sm font-medium text-gray-500">Học sinh</p>
            <h3 className="text-3xl font-bold text-gray-800 mt-1">{stats.studentsCount}</h3>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
            <Icon name="users" size={24} />
          </div>
        </div>

        {/* Attendance */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-sm font-medium text-gray-500">Chuyên cần hôm nay</p>
            <h3 className={`text-3xl font-bold mt-1 ${stats.attendanceToday.status === 'Chưa có dữ liệu' ? 'text-gray-400 text-xl' : 'text-gray-800'}`}>
                {stats.attendanceToday.status}
            </h3>
            {stats.attendanceToday.total > 0 && (
                <p className="text-xs text-green-600 mt-1">{stats.attendanceToday.present}/{stats.attendanceToday.total} học sinh</p>
            )}
          </div>
          <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-600">
            <Icon name="check" size={24} />
          </div>
        </div>

        {/* Rewards */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-sm font-medium text-gray-500">Điểm khen thưởng</p>
            <h3 className="text-3xl font-bold text-yellow-600 mt-1">{stats.totalPraisePoints}</h3>
          </div>
          <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-600">
            <Icon name="star" size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. HONOR BOARD (BẢNG VÀNG) - Takes up 2 columns */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-lg text-gray-800 flex items-center">
                    <Icon name="trophy" className="mr-2 text-yellow-500" /> Bảng vàng thành tích
                </h3>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    {[3, 5, 10].map(num => (
                        <button
                            key={num}
                            onClick={() => setTopFilter(num as any)}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition ${topFilter === num ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Top {num}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="p-6">
                {/* Podium for Top 3 */}
                <div className="flex justify-center items-end mb-8 gap-4">
                    {/* Rank 2 */}
                    {students[1] && topFilter >= 2 && (
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full border-2 border-gray-300 overflow-hidden mb-2">
                                {students[1].avatar ? <img src={students[1].avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">{students[1].fullName[0]}</div>}
                            </div>
                            <div className="h-16 w-16 bg-gray-200 rounded-t-lg flex items-center justify-center text-gray-500 font-bold text-xl shadow-inner">2</div>
                            <div className="text-xs font-bold mt-1 text-center truncate w-20">{students[1].fullName}</div>
                            <div className="text-xs text-gray-500">{students[1].points} pts</div>
                        </div>
                    )}
                    {/* Rank 1 */}
                    {students[0] && (
                        <div className="flex flex-col items-center -mt-4">
                            <Icon name="crown" className="text-yellow-500 mb-1" />
                            <div className="w-16 h-16 rounded-full border-4 border-yellow-400 overflow-hidden mb-2 shadow-lg">
                                {students[0].avatar ? <img src={students[0].avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-yellow-100 flex items-center justify-center text-yellow-600 font-bold text-xl">{students[0].fullName[0]}</div>}
                            </div>
                            <div className="h-24 w-20 bg-yellow-300 rounded-t-lg flex items-center justify-center text-yellow-700 font-bold text-2xl shadow-lg relative">
                                1
                            </div>
                            <div className="text-sm font-bold mt-1 text-center text-yellow-700 truncate w-24">{students[0].fullName}</div>
                            <div className="text-xs text-yellow-600 font-bold">{students[0].points} pts</div>
                        </div>
                    )}
                    {/* Rank 3 */}
                    {students[2] && topFilter >= 3 && (
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full border-2 border-orange-300 overflow-hidden mb-2">
                                {students[2].avatar ? <img src={students[2].avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-500 font-bold">{students[2].fullName[0]}</div>}
                            </div>
                            <div className="h-12 w-16 bg-orange-200 rounded-t-lg flex items-center justify-center text-orange-600 font-bold text-xl shadow-inner">3</div>
                            <div className="text-xs font-bold mt-1 text-center truncate w-20">{students[2].fullName}</div>
                            <div className="text-xs text-gray-500">{students[2].points} pts</div>
                        </div>
                    )}
                </div>

                {/* List for Rest */}
                {topFilter > 3 && (
                    <div className="space-y-3 mt-4 border-t border-gray-100 pt-4">
                        {getTopStudents().slice(3).map((s, idx) => (
                            <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center">
                                    <span className="w-6 text-center font-bold text-gray-400 mr-3">#{idx + 4}</span>
                                    <div className="w-8 h-8 rounded-full bg-white border border-gray-200 overflow-hidden mr-3">
                                        {s.avatar ? <img src={s.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">{s.fullName[0]}</div>}
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-gray-800">{s.fullName}</div>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{s.points} pts</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* 3. RIGHT COLUMN: Announcements & Pending Tasks */}
        <div className="space-y-6">
            {/* Announcements */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center">
                        <Icon name="bell" className="mr-2 text-red-500" /> Thông báo mới
                    </h3>
                    <button onClick={() => navigate('/admin/announcements')} className="text-xs text-blue-600 hover:underline">Xem tất cả</button>
                </div>
                <div className="divide-y divide-gray-50">
                    {announcements.length === 0 ? (
                        <div className="p-6 text-center text-gray-400 text-sm">Không có thông báo mới</div>
                    ) : (
                        announcements.slice(0, 3).map(a => (
                            <div key={a.id} className="p-4 hover:bg-gray-50 transition">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="text-sm font-bold text-gray-800 line-clamp-1">{a.title}</h4>
                                    {a.pinned && <Icon name="pin" size={12} className="text-orange-500 shrink-0 ml-2" />}
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{a.content}</p>
                                <div className="text-[10px] text-gray-400 text-right">{a.date}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Pending Tasks */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center">
                        <Icon name="clock" className="mr-2 text-blue-500" /> Việc cần xử lý
                    </h3>
                    <button onClick={() => navigate('/admin/tasks')} className="text-xs text-blue-600 hover:underline">Quản lý</button>
                </div>
                <div className="p-4 space-y-3">
                    {pendingTasks.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-2">Không có công việc sắp đến hạn.</div>
                    ) : (
                        pendingTasks.map(t => (
                            <div key={t.id} className="flex items-start p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <div className="mr-3 mt-0.5 text-blue-600">
                                    <Icon name="book" size={16} />
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-bold text-gray-800 line-clamp-1">{t.title}</div>
                                    <div className="text-xs text-gray-500 mt-1">Hạn nộp: <span className="font-medium text-red-500">{new Date(t.dueDate).toLocaleDateString('vi-VN')}</span></div>
                                </div>
                            </div>
                        ))
                    )}
                    <button onClick={() => navigate('/admin/attendance')} className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-emerald-600 transition flex items-center justify-center">
                        <Icon name="check" size={14} className="mr-2" /> Kiểm tra điểm danh hôm nay
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};