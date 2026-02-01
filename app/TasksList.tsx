import React, { useEffect, useState, useRef } from 'react';
import { provider } from '../core/provider';
import { Task, TaskReply, Student, User, ClassInfo } from '../types';
import { Icon } from '../components/Icons';
import { Modal } from '../components/Modal';

// Helper to handle mixed attachment types (string URLs or objects)
const parseStudentAttachments = (json: string) => {
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
            return parsed.map(item => {
                if (typeof item === 'string') return { type: 'link', url: item, name: item };
                return item;
            });
        }
        return [];
    } catch { return []; }
};

interface Attachment {
    type: 'file' | 'link' | 'pdf' | 'quiz';
    url: string;
    name: string;
}

export const TasksList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [studentClass, setStudentClass] = useState<ClassInfo | null>(null);
  const [replies, setReplies] = useState<TaskReply[]>([]);
  const [loading, setLoading] = useState(true);

  // Folder Navigation State
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  // Reply Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [replyText, setReplyText] = useState('');
  const [links, setLinks] = useState<string[]>(['']);
  const [files, setFiles] = useState<File[]>([]);
  
  // Viewer State for Attachments
  const [viewAttachment, setViewAttachment] = useState<Attachment | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const userJson = localStorage.getItem('mrs_hien_user');
        if (!userJson) {
            setLoading(false);
            return;
        }
        const user = JSON.parse(userJson) as User;
        let currentStudent: Student | null = null;

        // 1. Identify Student
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
            
            // 2. Get Class Info & Calculate Grade
            const classes = await provider.classes.list();
            const myClass = classes.find(c => c.id === currentStudent!.classId);
            setStudentClass(myClass || null);

            let myGrade: string | null = null;
            const gradeRegex = /(\d+)/;
            
            // Try getting grade from level (e.g., "Lớp 5") or className (e.g., "5A")
            if (myClass?.level) {
                const m = myClass.level.match(gradeRegex);
                if (m) myGrade = m[0];
            }
            if (!myGrade && myClass?.className) {
                const m = myClass.className.match(gradeRegex);
                if (m) myGrade = m[0];
            }

            // 3. Fetch Tasks (Class Specific & Global)
            const [classTasks, globalTasks] = await Promise.all([
                provider.tasks.list(currentStudent.classId),
                provider.tasks.list('all')
            ]);

            // 4. Filter Global Tasks by Grade
            const relevantGlobalTasks = globalTasks.filter(t => {
                // If task has no grade restriction or is 'all', show it
                if (!t.grade || t.grade === 'all') return true;
                
                // If task HAS a grade, it must match student's grade
                if (myGrade) {
                    return String(t.grade) === String(myGrade);
                }
                
                // If we can't determine student grade, but task has a grade, 
                // arguably we should hide it to be safe, or show it? 
                // Let's hide to prevent clutter.
                return false;
            });

            // 5. Combine: Class Tasks (Always show) + Filtered Global Tasks
            const combinedTasks = [...classTasks, ...relevantGlobalTasks];
            
            // Deduplicate by ID
            const uniqueTasks = Array.from(new Map(combinedTasks.map(item => [item.id, item])).values());
            
            // Sort by Date (Newest first)
            uniqueTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            setTasks(uniqueTasks);

            // 6. Load Replies
            const allReplies: TaskReply[] = [];
            for (const task of uniqueTasks) {
                const taskReplies = await provider.tasks.getReplies(task.id);
                const myReply = taskReplies.find(r => r.studentId === currentStudent!.id);
                if (myReply) allReplies.push(myReply);
            }
            setReplies(allReplies);
        }
    } catch (e) {
        console.error("Error loading tasks", e);
    } finally {
        setLoading(false);
    }
  };

  const getStatus = (task: Task) => {
      const reply = replies.find(r => r.taskId === task.id);
      if (reply) return 'submitted';
      
      const dueDate = new Date(task.dueDate);
      const now = new Date();
      if (now > dueDate) return 'overdue';
      
      return 'pending';
  };

  const openReplyModal = (task: Task) => {
      setActiveTask(task);
      setReplyText('');
      setLinks(['']);
      setFiles([]);
      setIsModalOpen(true);
  };

  const handleAddLink = () => setLinks([...links, '']);
  const handleLinkChange = (index: number, val: string) => {
      const newLinks = [...links];
      newLinks[index] = val;
      setLinks(newLinks);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const newFiles = Array.from(e.target.files);
          setFiles([...files, ...newFiles]);
      }
  };

  const removeFile = (index: number) => {
      setFiles(files.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
      });
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeTask || !student) return;

      const cleanLinks = links
        .filter(l => l.trim() !== '')
        .map(l => ({ type: 'link', url: l, name: l }));
      
      const processedFiles = await Promise.all(files.map(async (f) => {
          const base64 = await fileToBase64(f);
          return { type: 'file', url: base64, name: f.name };
      }));

      const allAttachments = [...cleanLinks, ...processedFiles];
      
      await provider.tasks.reply({
          taskId: activeTask.id,
          studentId: student.id,
          replyText,
          attachmentsJson: JSON.stringify(allAttachments),
          submittedAt: new Date().toISOString()
      });

      setIsModalOpen(false);
      loadData();
      alert('Nộp bài thành công!');
  };

  const parseTaskAttachments = (jsonList?: any): Attachment[] => {
      if (!jsonList) return [];
      let list = jsonList;
      
      if (typeof list === 'string') {
          try {
              list = JSON.parse(list);
          } catch {
              return [];
          }
      }

      if (!Array.isArray(list)) return [];

      return list.map((s: any) => {
          if (typeof s === 'object' && s !== null) return s as Attachment;
          try { return JSON.parse(s) as Attachment; } catch { return null; }
      }).filter((x: any): x is Attachment => !!x);
  };

  // Filter Logic for UI
  const filteredTasks = selectedUnit 
      ? tasks.filter(t => t.unit === selectedUnit)
      : tasks;

  // Group tasks for display
  const tasksWithoutUnit = tasks.filter(t => !t.unit);
  
  // Extract unique units from the tasks available to the student
  const availableUnits = Array.from(new Set(
      tasks.map(t => t.unit).filter((u): u is string => !!u)
  )).sort((a, b) => {
      // Sort Unit 1, Unit 2...
      const strA = String(a);
      const strB = String(b);
      const numA = parseInt(strA.replace(/\D/g, '')) || 0;
      const numB = parseInt(strB.replace(/\D/g, '')) || 0;
      return numA - numB;
  });

  const renderBreadcrumb = () => (
    <div className="flex items-center text-sm text-gray-500 mb-6 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
        <button 
          onClick={() => setSelectedUnit(null)}
          className={`hover:text-emerald-600 ${!selectedUnit ? 'font-bold text-emerald-700' : ''}`}
        >
            <Icon name="home" size={16} className="inline mr-1" /> Bài tập & Nhắc việc
        </button>
        
        {selectedUnit && (
             <>
              <Icon name="chevronRight" size={14} className="mx-2" />
              <span className="font-bold text-emerald-700">{selectedUnit}</span>
             </>
        )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <Icon name="book" className="mr-3 text-emerald-600" />
                Danh sách Bài tập
            </h2>
            {studentClass && (
                <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full w-fit">
                    Lớp: <span className="font-bold text-gray-700">{studentClass.className}</span>
                </div>
            )}
        </div>

        {renderBreadcrumb()}

        {loading ? (
            <div className="text-center py-10 text-gray-500">Đang tải...</div>
        ) : (
            <>
                {/* Main View: Show Units + General Tasks */}
                {!selectedUnit && (
                    <div className="space-y-8">
                         {/* Unit Grid */}
                         {availableUnits.length > 0 && (
                             <div>
                                <h3 className="text-lg font-bold text-gray-700 mb-4">Danh sách Bài học</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                   {availableUnits.map(unit => {
                                        const count = tasks.filter(t => t.unit === unit).length;
                                        // Check completion
                                        const completedCount = tasks.filter(t => t.unit === unit && replies.some(r => r.taskId === t.id)).length;
                                        const isDone = count > 0 && count === completedCount;

                                        return (
                                           <button
                                               key={unit!}
                                               onClick={() => setSelectedUnit(unit!)}
                                               className={`p-4 rounded-xl shadow-sm border transition text-left group flex flex-col justify-between h-28 relative overflow-hidden ${
                                                   isDone 
                                                   ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100' 
                                                   : 'bg-white border-gray-100 hover:shadow-md hover:border-emerald-200'
                                               }`}
                                           >
                                               <div className="flex items-center justify-between mb-2 z-10">
                                                   <Icon name="folder" className={`${isDone ? 'text-emerald-500' : 'text-yellow-500'} group-hover:scale-110 transition`} size={28} />
                                                   {isDone && <div className="bg-emerald-200 text-emerald-800 rounded-full p-1"><Icon name="check" size={12} /></div>}
                                               </div>
                                               <div className="font-bold text-gray-800 z-10">{unit}</div>
                                               <div className="text-xs text-gray-500 z-10">
                                                   {completedCount}/{count} bài
                                               </div>
                                           </button>
                                        );
                                   })}
                                </div>
                           </div>
                         )}

                        {/* General Tasks (No Unit) */}
                        {tasksWithoutUnit.length > 0 && (
                            <div>
                                <h3 className="text-lg font-bold text-gray-700 mb-4">Bài tập chung</h3>
                                {renderTaskList(tasksWithoutUnit)}
                            </div>
                        )}

                        {/* Empty State */}
                        {availableUnits.length === 0 && tasksWithoutUnit.length === 0 && (
                             <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                                <Icon name="book" size={48} className="mx-auto text-gray-200 mb-2" />
                                <p className="text-gray-400">Hiện tại chưa có bài tập nào được giao cho lớp.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Unit View */}
                {selectedUnit && (
                    <div>
                         <div className="mb-4">
                             <h3 className="text-lg font-bold text-gray-700">Bài tập: {selectedUnit}</h3>
                         </div>
                         {filteredTasks.length === 0 ? (
                            <div className="text-center py-10 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
                                <p className="text-gray-500">Không có bài tập nào trong mục này.</p>
                            </div>
                         ) : renderTaskList(filteredTasks)}
                    </div>
                )}
            </>
        )}

        {/* Attachment Viewer Modal */}
        {viewAttachment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4">
                <div className="w-full h-full max-w-6xl max-h-[90vh] bg-white rounded-lg flex flex-col relative overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-lg text-gray-800 flex items-center">
                            <Icon name={viewAttachment.type === 'quiz' ? 'form' : 'file'} className="mr-2" />
                            {viewAttachment.name}
                        </h3>
                        <button onClick={() => setViewAttachment(null)} className="p-2 hover:bg-gray-200 rounded-full">✕</button>
                    </div>
                    <div className="flex-1 bg-gray-100 flex items-center justify-center relative">
                        {viewAttachment.type === 'pdf' || viewAttachment.type === 'quiz' ? (
                            <iframe 
                                src={viewAttachment.url} 
                                className="w-full h-full border-0" 
                                title="Viewer"
                                allow="camera; microphone; fullscreen"
                            />
                        ) : (
                            <div className="text-center">
                                <p className="mb-4 text-gray-600">File này không hỗ trợ xem trước.</p>
                                <a 
                                    href={viewAttachment.url} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    download 
                                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                >
                                    Tải xuống / Mở trong tab mới
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={`Nộp bài: ${activeTask?.title}`}
        >
            <form onSubmit={handleSubmitReply} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung phản hồi</label>
                    <textarea 
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                        rows={4}
                        placeholder="Em đã hoàn thành..."
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Liên kết (Google Drive, Youtube...)</label>
                    {links.map((link, idx) => (
                        <input 
                            key={idx}
                            type="url"
                            className="w-full px-3 py-2 border rounded-lg mb-2 text-sm"
                            placeholder="https://..."
                            value={link}
                            onChange={e => handleLinkChange(idx, e.target.value)}
                        />
                    ))}
                    <button type="button" onClick={handleAddLink} className="text-sm text-blue-600 hover:underline flex items-center">
                        <Icon name="plus" size={14} className="mr-1" /> Thêm liên kết
                    </button>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Đính kèm tệp (Ảnh/Word/PDF)</label>
                    <input 
                        type="file"
                        multiple
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition text-sm text-gray-700"
                    >
                        <Icon name="paperclip" size={16} className="mr-2" /> Chọn tệp từ máy
                    </button>

                    {files.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {files.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 text-sm">
                                    <span className="truncate max-w-[200px]">{file.name}</span>
                                    <button 
                                        type="button" 
                                        onClick={() => removeFile(idx)}
                                        className="text-red-500 hover:text-red-700 p-1"
                                    >
                                        <Icon name="trash" size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100 mt-4">
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="mr-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold"
                    >
                        Gửi bài
                    </button>
                </div>
            </form>
        </Modal>
    </div>
  );

  function renderTaskList(taskList: Task[]) {
      return (
        <div className="space-y-4">
            {taskList.map(task => {
                const status = getStatus(task);
                const myReply = replies.find(r => r.taskId === task.id);
                const replyAttachments = myReply?.attachmentsJson ? parseStudentAttachments(myReply.attachmentsJson) : [];
                const taskAttachments = parseTaskAttachments(task.attachments);

                // Scope Flags
                const isClassTask = task.classId === student?.classId;
                const isGradeTask = task.classId === 'all' && !!task.grade && task.grade !== 'all';
                const isGeneralTask = task.classId === 'all' && (!task.grade || task.grade === 'all');

                return (
                    <div key={task.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-6 relative overflow-hidden">
                        {/* Status Bar / Top Indicators */}
                        <div className="flex flex-wrap items-center gap-2 mb-2 border-b border-gray-50 pb-2">
                            {/* Scope Badge */}
                            {isClassTask && (
                                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded flex items-center border border-blue-100">
                                    <Icon name="users" size={12} className="mr-1" /> Lớp {studentClass?.className}
                                </span>
                            )}
                            {isGradeTask && (
                                <span className="bg-purple-50 text-purple-700 text-xs font-bold px-2 py-1 rounded flex items-center border border-purple-100">
                                    <Icon name="book" size={12} className="mr-1" /> Khối {task.grade}
                                </span>
                            )}
                            {isGeneralTask && (
                                <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded flex items-center border border-gray-200">
                                    <Icon name="globe" size={12} className="mr-1" /> Toàn trường
                                </span>
                            )}

                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded flex items-center">
                                Hạn: {new Date(task.dueDate).toLocaleDateString()}
                            </span>

                            {/* Status Badges */}
                            {status === 'overdue' && (
                                <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded flex items-center ml-auto">
                                    <Icon name="alert" size={12} className="mr-1" /> Quá hạn
                                </span>
                            )}
                            {status === 'submitted' && (
                                <span className="bg-green-100 text-green-600 text-xs font-bold px-2 py-1 rounded flex items-center ml-auto">
                                    <Icon name="check" size={12} className="mr-1" /> Đã nộp
                                </span>
                            )}
                            {status === 'pending' && task.requireReply && (
                                <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded flex items-center ml-auto">
                                    <Icon name="clock" size={12} className="mr-1" /> Cần nộp bài
                                </span>
                            )}
                        </div>

                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{task.title} <span className="text-sm font-normal text-gray-500 ml-2">({task.points || 10} điểm)</span></h3>
                                <p className="text-gray-600 text-sm whitespace-pre-wrap">{task.description}</p>
                                
                                {/* Teacher Attachments */}
                                {taskAttachments.length > 0 && (
                                    <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Tài liệu đính kèm:</div>
                                        <div className="flex flex-wrap gap-2">
                                            {taskAttachments.map((att, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setViewAttachment(att)}
                                                    className={`flex items-center px-3 py-1.5 rounded-lg border text-sm font-medium transition ${
                                                        att.type === 'pdf' ? 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100' :
                                                        att.type === 'quiz' ? 'bg-purple-50 text-purple-700 border-purple-100 hover:bg-purple-100' :
                                                        'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
                                                    }`}
                                                >
                                                    <Icon name={att.type === 'pdf' ? 'file' : att.type === 'quiz' ? 'form' : 'link'} size={14} className="mr-2" />
                                                    {att.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {myReply && (
                                    <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <p className="font-bold text-gray-700">Bài đã nộp:</p>
                                            {myReply.grade !== undefined && (
                                                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                                    Điểm: {myReply.grade}/{task.points || 10}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-600 italic mb-2">"{myReply.replyText}"</p>
                                        
                                        {replyAttachments.length > 0 && (
                                            <div className="flex flex-col gap-1 border-t border-gray-200 pt-2">
                                                {replyAttachments.map((item: any, idx: number) => (
                                                    <a 
                                                        key={idx} 
                                                        href={item.url} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        download={item.type === 'file' ? item.name : undefined}
                                                        className="text-blue-500 hover:underline flex items-center text-xs"
                                                    >
                                                        <Icon name={item.type === 'file' ? 'file' : 'link'} size={12} className="mr-1" /> 
                                                        {item.name}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end md:w-32">
                                {!myReply && task.requireReply && (
                                    <button 
                                        onClick={() => openReplyModal(task)}
                                        className="w-full py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium flex justify-center items-center shadow-md"
                                    >
                                        <Icon name="send" size={16} className="mr-2" /> Nộp bài
                                    </button>
                                )}
                                {!task.requireReply && !myReply && (
                                    <span className="text-gray-400 text-sm italic">Chỉ xem</span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      );
  }
};