import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, MapPin, User, Clock, CheckCircle2 } from 'lucide-react';
import { format, addDays, addWeeks, startOfWeek } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { zhCN } from 'date-fns/locale';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Drawer';
import { useAppContext } from '../context/AppContext';
import type { Schedule } from '../types';
import type { ScheduleStatus } from '../types/schedule';
import { scheduleApiState, scheduleService } from '../services/scheduleService';
import { lessonService } from '../services/lessonService';
import { leaveMakeupService } from '../services/leaveMakeupService';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { can } from '../auth/permissions';

export function Schedule() {
  const { courses, students, teachers } = useAppContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = new Date();
  const [weekStartDate, setWeekStartDate] = useState(() => startOfWeek(today, { weekStartsOn: 1 }));

  const weekDays = useMemo(() => Array.from({ length: 7 }).map((_, i) => addDays(weekStartDate, i)), [weekStartDate]);
  const timeSlots = Array.from({ length: 13 }).map((_, i) => `${i + 8}:00`); // 8:00 to 20:00
  const endTimeSlots = Array.from({ length: 14 }).map((_, i) => `${i + 8}:00`);
  const scheduleTeacherOptions = useMemo(
    () => teachers.length > 0
      ? teachers.map((teacher) => ({ id: teacher.id, name: teacher.name }))
      : scheduleService.getTeacherOptionsSync(),
    [teachers]
  );

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Schedule | null>(null);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);

  const [events, setEvents] = useState<Schedule[]>(scheduleService.getInitialEventsSync());
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);

  const [formData, setFormData] = useState({
    courseId: '',
    teacherId: 'teacher-1',
    roomId: 'room-1',
    date: format(today, 'yyyy-MM-dd'),
    startTime: '10:00',
    duration: 2,
  });
  const [editFormData, setEditFormData] = useState({
    date: '',
    startTime: '10:00',
    endTime: '12:00',
    teacherId: '',
    roomId: 'room-1',
    classroom: '',
    status: 'scheduled' as ScheduleStatus,
    notes: '',
  });

  const statusLabels: Record<ScheduleStatus, string> = {
    scheduled: '已排课',
    in_progress: '进行中',
    completed: '已完成',
    cancelled: '已取消',
    student_leave: '学生请假',
    teacher_leave: '老师请假',
    makeup_pending: '待补课',
  };

  const statusClassName: Record<ScheduleStatus, string> = {
    scheduled: 'bg-blue-50 border-blue-200 text-blue-700',
    in_progress: 'bg-amber-50 border-amber-200 text-amber-700',
    completed: 'bg-green-50 border-green-200 text-green-700',
    cancelled: 'bg-gray-50 border-gray-200 text-gray-500',
    student_leave: 'bg-purple-50 border-purple-200 text-purple-700',
    teacher_leave: 'bg-orange-50 border-orange-200 text-orange-700',
    makeup_pending: 'bg-rose-50 border-rose-200 text-rose-700',
  };

  const roomOptions = [
    { id: 'room-1', label: 'Room 101' },
    { id: 'room-2', label: 'Room 202' },
    { id: 'room-3', label: '线上会议 (Zoom)' },
  ];

  useEffect(() => {
    if (scheduleTeacherOptions.length === 0) return;
    if (scheduleTeacherOptions.some((teacher) => teacher.id === formData.teacherId)) return;
    setFormData((prev) => ({ ...prev, teacherId: scheduleTeacherOptions[0].id }));
  }, [formData.teacherId, scheduleTeacherOptions]);

  const refreshEvents = async () => {
    setIsLoadingSchedule(true);
    try {
      const latestEvents = await scheduleService.listEvents({
        startDate: format(weekStartDate, 'yyyy-MM-dd'),
        endDate: format(addDays(weekStartDate, 6), 'yyyy-MM-dd'),
      });
      setEvents(latestEvents);
    } catch (error) {
      toast.error(`排课日历加载失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  useEffect(() => {
    refreshEvents();
  }, [weekStartDate]);

  const handleCreateSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.courseId) {
      toast.error('请选择课程');
      return;
    }

    const course = courses.find(c => c.id === formData.courseId);
    if (!course) return;

    const teacherOption = scheduleTeacherOptions.find(t => t.id === formData.teacherId);
    const teacher = teacherOption?.name ?? '李老师';

    setIsSavingSchedule(true);
    try {
      const { event, hasConflict } = await scheduleService.createSchedule({
        courseId: course.id,
        courseName: course.name,
        teacherId: teacherOption?.id,
        teacher,
        roomId: formData.roomId,
        date: formData.date,
        startTime: formData.startTime,
        duration: formData.duration,
        consumedHours: formData.duration,
        lessonType: 'class',
        status: 'scheduled',
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
    } catch (error) {
      toast.error(`排课失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const openEventDetails = (event: Schedule) => {
    setSelectedEvent(event);
    setEditFormData({
      date: event.date ?? format(weekDays[event.colIndex], 'yyyy-MM-dd'),
      startTime: event.startTime ?? event.timeString.split(' - ')[0] ?? '10:00',
      endTime: event.endTime ?? event.timeString.split(' - ')[1] ?? '12:00',
      teacherId: event.teacherId ?? scheduleTeacherOptions[0]?.id ?? '',
      roomId: event.roomId ?? 'room-1',
      classroom: event.classroom ?? event.room,
      status: event.status ?? 'scheduled',
      notes: event.notes ?? '',
    });
    setIsEditingSchedule(false);
    setIsDetailDrawerOpen(true);
  };

  const handleUpdateSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    setIsUpdatingSchedule(true);
    try {
      const updated = await scheduleService.updateSchedule(selectedEvent.id, editFormData);
      setSelectedEvent(updated);
      setIsEditingSchedule(false);
      await refreshEvents();
      toast.success('排课已更新');
    } catch (error) {
      toast.error(`排课更新失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  const handleCancelSchedule = async () => {
    if (!selectedEvent) return;
    const cancelReason = window.prompt('请输入取消原因');
    if (cancelReason === null) return;
    if (!cancelReason.trim()) {
      toast.error('请填写取消原因');
      return;
    }
    setIsUpdatingSchedule(true);
    try {
      await scheduleService.cancelSchedule(selectedEvent.id, cancelReason.trim());
      await refreshEvents();
      setIsDetailDrawerOpen(false);
      toast.success('排课已取消');
    } catch (error) {
      toast.error(`取消排课失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  const handleLessonRecordAction = async () => {
    if (!selectedEvent) return;
    if (selectedEvent.lessonRecordId) {
      navigate('/records');
      return;
    }
    setIsUpdatingSchedule(true);
    try {
      await lessonService.createFromSchedule(selectedEvent.id);
      await refreshEvents();
      toast.success('上课记录已生成');
      navigate('/records');
    } catch (error) {
      toast.error(`生成上课记录失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  const handleCreateLeaveMakeup = async (requestType: 'student_leave' | 'teacher_leave' | 'reschedule' | 'cancellation') => {
    if (!selectedEvent) return;
    const reason = window.prompt('请输入申请原因');
    if (!reason) return;
    try {
      await leaveMakeupService.create({
        scheduleId: selectedEvent.id,
        lessonRecordId: selectedEvent.lessonRecordId,
        requestType,
        reason,
        needMakeup: requestType !== 'cancellation',
        deductCredit: false,
      });
      toast.success('请假补课申请已创建');
    } catch (error) {
      toast.error(`创建申请失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">排课管理</h1>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg p-1">
            <button className="p-1 hover:bg-gray-100 rounded text-gray-600" onClick={() => setWeekStartDate(prev => addWeeks(prev, -1))}>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium px-2">本周</span>
            <button className="p-1 hover:bg-gray-100 rounded text-gray-600" onClick={() => setWeekStartDate(prev => addWeeks(prev, 1))}>
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
                  className={`absolute left-1 right-1 border rounded p-2 overflow-hidden hover:shadow-md cursor-pointer transition-all z-10 ${statusClassName[(ev.status ?? 'scheduled') as ScheduleStatus]} ${ev.status === 'cancelled' ? 'opacity-70' : ''}`}
                    style={{ 
                      top: `${ev.topIndex * 80 + 2}px`, 
                      height: `${ev.durationSlots * 80 - 4}px` 
                    }}
                  >
                    <div className="text-xs font-bold truncate">{ev.title}</div>
                    <div className="text-[10px] mt-0.5 truncate">{ev.teacher} • {ev.room}</div>
                    <div className="text-[10px] mt-1">{ev.timeString}</div>
                    <div className="text-[10px] mt-1">{statusLabels[(ev.status ?? 'scheduled') as ScheduleStatus]}</div>
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
                {roomOptions.map(room => (
                  <option key={room.id} value={room.id}>{room.label}</option>
                ))}
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
                  <CheckCircle2 className="w-4 h-4" /> {statusLabels[(selectedEvent.status ?? 'scheduled') as ScheduleStatus]}
                </p>
              </div>
            </div>

            {!isEditingSchedule ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">课程名称</label>
                  <div className="text-sm font-medium text-gray-900">{selectedEvent.courseName ?? selectedEvent.title}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">学员或班级</label>
                  <div className="text-sm font-medium text-gray-900">{selectedEvent.studentName || selectedEvent.className || '-'}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">授课教师</label>
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    {selectedEvent.teacher}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">上课日期</label>
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-gray-400" />
                    {selectedEvent.date ?? format(weekDays[selectedEvent.colIndex], 'yyyy-MM-dd')}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">开始时间</label>
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {selectedEvent.startTime ?? selectedEvent.timeString.split(' - ')[0]}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">结束时间</label>
                  <div className="text-sm font-medium text-gray-900">{selectedEvent.endTime ?? selectedEvent.timeString.split(' - ')[1]}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">教室 / classroom</label>
                  <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {selectedEvent.classroom || selectedEvent.room || '-'}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">上课方式</label>
                  <div className="text-sm font-medium text-gray-900">{selectedEvent.type === 'class' ? '班课' : selectedEvent.type}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">课程状态</label>
                  <div className="text-sm font-medium text-gray-900">{statusLabels[(selectedEvent.status ?? 'scheduled') as ScheduleStatus]}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">本次课时</label>
                  <div className="text-sm font-medium text-gray-900">{selectedEvent.durationSlots}h</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">创建人</label>
                  <div className="text-sm font-medium text-gray-900">{selectedEvent.createdBy || '-'}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">最近更新时间</label>
                  <div className="text-sm font-medium text-gray-900">{selectedEvent.updatedAt ? new Date(selectedEvent.updatedAt).toLocaleString() : '-'}</div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">备注</label>
                  <div className="text-sm font-medium text-gray-900">{selectedEvent.notes || selectedEvent.cancelReason || '-'}</div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdateSchedule} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">上课日期</label>
                    <input type="date" value={editFormData.date} onChange={e => setEditFormData({ ...editFormData, date: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                    <select value={editFormData.status} onChange={e => setEditFormData({ ...editFormData, status: e.target.value as ScheduleStatus })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500">
                      {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                    <select value={editFormData.startTime} onChange={e => setEditFormData({ ...editFormData, startTime: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500">
                      {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                    <select value={editFormData.endTime} onChange={e => setEditFormData({ ...editFormData, endTime: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500">
                      {endTimeSlots.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">老师</label>
                    <select value={editFormData.teacherId} onChange={e => setEditFormData({ ...editFormData, teacherId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500">
                      {scheduleTeacherOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">教室 / classroom</label>
                    <select value={editFormData.roomId} onChange={e => {
                      const room = roomOptions.find(item => item.id === e.target.value);
                      setEditFormData({ ...editFormData, roomId: e.target.value, classroom: room?.label ?? editFormData.classroom });
                    }} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500">
                      {roomOptions.map(room => <option key={room.id} value={room.id}>{room.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                    <textarea value={editFormData.notes} onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" rows={3} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setIsEditingSchedule(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
                  <button type="submit" disabled={isUpdatingSchedule} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">保存修改</button>
                </div>
              </form>
            )}

            {/* Actions */}
            {!isEditingSchedule && (
              <div className="pt-6 border-t border-gray-100 flex flex-col gap-3">
               <button onClick={() => setIsEditingSchedule(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 transition-colors">
                 编辑排课
               </button>
               <button onClick={handleLessonRecordAction} disabled={isUpdatingSchedule} className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-4 py-2.5 transition-colors">
                 {selectedEvent.lessonRecordId ? '查看上课记录' : '生成上课记录'}
               </button>
               <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => handleCreateLeaveMakeup('student_leave')} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-3 py-2 transition-colors">学生请假</button>
                 <button onClick={() => handleCreateLeaveMakeup('teacher_leave')} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-3 py-2 transition-colors">老师请假</button>
                 <button onClick={() => handleCreateLeaveMakeup('reschedule')} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-3 py-2 transition-colors">调课</button>
                 <button onClick={() => handleCreateLeaveMakeup('cancellation')} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-3 py-2 transition-colors">取消课程</button>
               </div>
               <button 
                onClick={handleCancelSchedule}
                disabled={isUpdatingSchedule || selectedEvent.status === 'cancelled'}
                className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 font-medium rounded-lg text-sm px-4 py-2.5 transition-colors"
               >
                 取消排课
               </button>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
