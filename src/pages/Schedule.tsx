import { useEffect, useState, type FormEvent } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, MapPin, User, Clock, CheckCircle2 } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Drawer';
import { useAppContext } from '../context/AppContext';
import type { Schedule } from '../types';
import { scheduleApiState, scheduleService } from '../services/scheduleService';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { can } from '../auth/permissions';

const scheduleTeacherOptions = scheduleService.getTeacherOptionsSync();

export function Schedule() {
  const { courses, students } = useAppContext();
  const { user } = useAuth();
  const today = new Date();
  const startDate = startOfWeek(today, { weekStartsOn: 1 }); // Start week on Monday

  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(startDate, i));
  const timeSlots = Array.from({ length: 13 }).map((_, i) => `${i + 8}:00`); // 8:00 to 20:00

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Schedule | null>(null);

  const [events, setEvents] = useState<Schedule[]>(scheduleService.getInitialEventsSync());
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const [formData, setFormData] = useState({
    courseId: '',
    teacherId: 'teacher-1',
    roomId: 'room-1',
    date: format(today, 'yyyy-MM-dd'),
    startTime: '10:00',
    duration: 2,
  });

  const refreshEvents = async () => {
    setIsLoadingSchedule(true);
    try {
      const latestEvents = await scheduleService.listEvents();
      setEvents(latestEvents);
    } catch {
      toast.error('排课日历加载失败，已保留本地数据');
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  useEffect(() => {
    refreshEvents();
  }, []);

  const handleCreateSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.courseId) {
      toast.error('请选择课程');
      return;
    }

    const course = courses.find(c => c.id === formData.courseId);
    if (!course) return;

    const teacher = scheduleTeacherOptions.find(t => t.id === formData.teacherId)?.name ?? '李老师';

    setIsSavingSchedule(true);
    try {
      const { event, hasConflict } = await scheduleService.createSchedule({
        courseName: course.name,
        teacher,
        roomId: formData.roomId,
        date: formData.date,
        startTime: formData.startTime,
        duration: formData.duration,
      }, events);

      if (hasConflict) {
        if (!confirm('检测到该时段可能有排课冲突，确定要继续吗？')) {
          return;
        }
      }

      if (scheduleApiState.create.status === 'error') {
        setEvents(prev => [...prev, event]);
      } else {
        await refreshEvents();
      }
      toast.success('排课成功');
      setIsScheduleModalOpen(false);
    } catch {
      toast.error('排课失败，请稍后重试');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const openEventDetails = (event: any) => {
    setSelectedEvent(event);
    setIsDetailDrawerOpen(true);
  };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">排课管理</h1>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg p-1">
            <button className="p-1 hover:bg-gray-100 rounded text-gray-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium px-2">本周</span>
            <button className="p-1 hover:bg-gray-100 rounded text-gray-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          {can(user?.role, 'createSchedule') && (
            <button 
              onClick={() => setIsScheduleModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              新建排课
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
        {/* Calendar Header */}
        <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="py-3 px-2 text-center text-xs font-medium text-gray-500 border-r border-gray-200">
            时段
          </div>
          {weekDays.map((date, i) => (
            <div key={i} className={`py-3 px-2 text-center border-r border-gray-200 last:border-r-0 ${format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') ? 'bg-blue-50/50' : ''}`}>
              <div className={`text-sm font-medium ${format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') ? 'text-blue-600' : 'text-gray-900'}`}>
                {format(date, 'EEEE', { locale: zhCN })}
              </div>
              <div className={`text-xs mt-1 ${format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') ? 'text-blue-500 font-bold' : 'text-gray-500'}`}>
                {format(date, 'MM/dd')}
              </div>
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        <div className="flex-1 overflow-y-auto relative">
          <div className="grid grid-cols-8">
            {/* Time labels column */}
            <div className="border-r border-gray-200 bg-gray-50/50">
              {timeSlots.map((time, i) => (
                <div key={i} className="h-20 border-b border-gray-200 px-2 py-2 text-xs font-medium text-gray-500 text-right relative">
                  <span className="relative -top-3 bg-gray-50/50 px-1">{time}</span>
                </div>
              ))}
            </div>
            
            {/* Calendar Grid Columns */}
            {Array.from({ length: 7 }).map((_, colIndex) => (
              <div key={colIndex} className="border-r border-gray-200 last:border-r-0 relative group">
                {timeSlots.map((_, i) => (
                  <div key={i} className="h-20 border-b border-gray-200/50 p-1 group-hover:bg-blue-50/10 cursor-pointer" onClick={() => {
                    setFormData({...formData, startTime: `${i + 8}:00`, date: format(weekDays[colIndex], 'yyyy-MM-dd')});
                    setIsScheduleModalOpen(true);
                  }}></div>
                ))}
                
                {/* Events for this column */}
                {events.filter(ev => ev.colIndex === colIndex).map((ev) => (
                  <div 
                    key={ev.id}
                    onClick={() => openEventDetails(ev)}
                    className="absolute left-1 right-1 bg-blue-50 border border-blue-200 rounded p-2 overflow-hidden hover:shadow-md hover:border-blue-300 cursor-pointer transition-all z-10"
                    style={{ 
                      top: `${ev.topIndex * 80 + 2}px`, 
                      height: `${ev.durationSlots * 80 - 4}px` 
                    }}
                  >
                    <div className="text-xs font-bold text-blue-700 truncate">{ev.title}</div>
                    <div className="text-[10px] text-blue-600 mt-0.5 truncate">{ev.teacher} • {ev.room}</div>
                    <div className="text-[10px] text-blue-500 mt-1">{ev.timeString}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Schedule Modal */}
      <Modal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} title="新建排课">
        <form onSubmit={handleCreateSchedule} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择课程 <span className="text-red-500">*</span></label>
            <select 
              value={formData.courseId} 
              onChange={e => setFormData({...formData, courseId: e.target.value})} 
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            >
              <option value="">请选择...</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">授课老师</label>
              <select
                value={formData.teacherId}
                onChange={e => setFormData({...formData, teacherId: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              >
                {scheduleTeacherOptions.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">上课教室</label>
              <select 
                value={formData.roomId} 
                onChange={e => setFormData({...formData, roomId: e.target.value})} 
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              >
                <option value="room-1">Room 101</option>
                <option value="room-2">Room 202</option>
                <option value="room-3">线上会议 (Zoom)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
              <input 
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" 
              />
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
              <select 
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              >
                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">时长 (小时)</label>
              <input 
                type="number" 
                min="1" 
                max="8"
                value={formData.duration}
                onChange={e => setFormData({...formData, duration: Number(e.target.value)})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" 
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
            <button type="button" onClick={() => setIsScheduleModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
            <button type="submit" disabled={isSavingSchedule || isLoadingSchedule} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
              保存排课
            </button>
          </div>
        </form>
      </Modal>

      {/* Schedule Detail Drawer */}
      <Drawer
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        title="排课详情"
      >
        {selectedEvent && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">{selectedEvent.title}</h3>
                <p className="text-blue-600 text-sm font-medium flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" /> 正常排课
                </p>
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-xs text-gray-500 mb-1 block">授课教师</label>
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    {selectedEvent.teacher}
                  </div>
               </div>
               <div>
                  <label className="text-xs text-gray-500 mb-1 block">上课教室</label>
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {selectedEvent.room}
                  </div>
               </div>
               <div>
                  <label className="text-xs text-gray-500 mb-1 block">时间</label>
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {selectedEvent.timeString} ({selectedEvent.durationSlots}h)
                  </div>
               </div>
               <div>
                  <label className="text-xs text-gray-500 mb-1 block">日期</label>
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-gray-400" />
                    {format(weekDays[selectedEvent.colIndex], 'yyyy-MM-dd')}
                  </div>
               </div>
            </div>

            {/* Actions */}
            <div className="pt-6 border-t border-gray-100 flex flex-col gap-3">
               <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 transition-colors">
                 编辑排课
               </button>
               <button className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-4 py-2.5 transition-colors">
                 生成上课记录
               </button>
               <button 
                onClick={async () => {
                  if (confirm('确认取消此排课吗？')) {
                    try {
                      const updated = await scheduleService.cancelSchedule(selectedEvent.id, events);
                      setEvents(updated);
                      setIsDetailDrawerOpen(false);
                      toast.success('排课已取消');
                    } catch {
                      toast.error('取消排课失败，请稍后重试');
                    }
                  }
                }}
                className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium rounded-lg text-sm px-4 py-2.5 transition-colors"
               >
                 取消排课
               </button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
