import { useState } from 'react';
import { Search, Filter, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, MessageSquare, ChevronRight, X, Sparkles, Save, Send } from 'lucide-react';
import { LessonRecord } from '../types';
import { useAppContext } from '../context/AppContext';
import { Drawer } from '../components/ui/Drawer';
import { lessonService } from '../services/lessonService';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { can } from '../auth/permissions';

const recordsPageStats = lessonService.getRecordsPageStatsSync();

export function Records() {
  const { lessonRecords, updateLessonRecord, students, updateStudent } = useAppContext();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<LessonRecord | null>(null);
  
  // AI summary state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  const filteredRecords = lessonRecords.filter(r => 
    r.studentName.includes(searchTerm) || r.className.includes(searchTerm)
  );

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">已完成</span>;
      case 'scheduled': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">未开始</span>;
      case 'cancelled': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">已取消</span>;
      case 'need_makeup': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">待补课</span>;
      default: return null;
    }
  };

  const getAttendanceBadge = (attendance: string) => {
    switch(attendance) {
      case 'present': return <span className="text-green-600">正常出勤</span>;
      case 'absent': return <span className="text-red-600">缺勤</span>;
      case 'student_leave': return <span className="text-orange-600">学生请假</span>;
      case 'teacher_leave': return <span className="text-purple-600">老师请假</span>;
      default: return null;
    }
  };

  const handleGenerateAI = async () => {
    if (!selectedRecord) return;
    setIsGeneratingAI(true);
    try {
      const summary = await lessonService.generateFeedback(selectedRecord);
      setAiSummary(summary);
      toast.success('AI 反馈已生成');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleConfirmDeduct = async () => {
    if (!selectedRecord) return;
    
    if (confirm('确认扣除本次课时吗？该操作将减少学生剩余课时。')) {
      const student = students.find(s => s.id === selectedRecord.studentId);
      if (!student) return;

      const result = await lessonService.confirmDeduct({
        record: selectedRecord,
        student,
        aiSummary: aiSummary || undefined,
      });

      updateStudent(result.student.id, { remainingCredits: result.student.remainingCredits });
      updateLessonRecord(result.record.id, {
        status: result.record.status,
        feedbackStatus: result.record.feedbackStatus,
        aiSummary: result.record.aiSummary,
      });
      
      toast.success('消课成功，学生课时已扣除');
      setSelectedRecord(null);
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">上课记录与消课</h1>
        <div className="flex gap-3">
          <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
            导出记录
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">今日待记录课程</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{recordsPageStats.todayPending}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">待提交反馈</p>
              <h3 className="text-2xl font-bold text-purple-600 mt-1">{recordsPageStats.feedbackPending}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">待消课课程</p>
              <h3 className="text-2xl font-bold text-orange-600 mt-1">{recordsPageStats.deductPending}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">异常课程</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{recordsPageStats.abnormal}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜索学生姓名、课程名..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
             <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto justify-center">
              <CalendarIcon className="w-4 h-4" />
              日期范围
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto justify-center">
              <Filter className="w-4 h-4" />
              状态筛选
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-4">上课时间</th>
                <th scope="col" className="px-6 py-4">学生/课程</th>
                <th scope="col" className="px-6 py-4">授课老师</th>
                <th scope="col" className="px-6 py-4">状态/出勤</th>
                <th scope="col" className="px-6 py-4">课时消耗</th>
                <th scope="col" className="px-6 py-4">反馈状态</th>
                <th scope="col" className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr 
                  key={record.id} 
                  className="bg-white border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedRecord(record);
                    setAiSummary(record.aiSummary || '');
                  }}
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {record.date}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{record.studentName}</div>
                    <div className="text-xs text-gray-500">{record.className}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {record.teacherName}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      {getStatusBadge(record.status)}
                      <span className="text-xs font-medium">
                        {getAttendanceBadge(record.attendance)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {record.creditsConsumed > 0 ? (
                      <span className="text-red-600">-{record.creditsConsumed}</span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {record.feedbackStatus === 'submitted' ? (
                      <span className="flex items-center text-green-600 text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5 mr-1" />已提交</span>
                    ) : (
                      <span className="flex items-center text-orange-500 text-xs font-medium"><AlertCircle className="w-3.5 h-3.5 mr-1" />待提交</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center justify-end w-full">
                      记录详情 <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      <Drawer isOpen={!!selectedRecord} onClose={() => setSelectedRecord(null)} title="上课记录详情">
        {selectedRecord && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header Info */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                    {selectedRecord.studentName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedRecord.studentName}</h3>
                    <p className="text-sm text-gray-500">{selectedRecord.className}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{selectedRecord.date}</div>
                  <div className="text-xs text-gray-500 mt-1">授课老师: {selectedRecord.teacherName}</div>
                </div>
              </div>

              {/* Status and Credits */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-500 mb-2">上课状态</p>
                  <div className="flex items-center justify-between">
                     <select className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2" defaultValue={selectedRecord.status}>
                        <option value="completed">已完成</option>
                        <option value="student_leave">学生请假</option>
                        <option value="teacher_leave">老师请假</option>
                        <option value="absent">缺勤</option>
                     </select>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-500 mb-2">课时消耗</p>
                  <div className="flex items-center gap-2">
                    <input type="number" defaultValue={selectedRecord.creditsConsumed} className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-20 p-2" />
                    <span className="text-sm text-gray-500">剩余 {students.find(s => s.id === selectedRecord.studentId)?.remainingCredits || 0} 课时</span>
                  </div>
                </div>
              </div>

              {/* Feedback Form */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  课堂反馈记录
                </h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">本节课内容</label>
                  <input type="text" defaultValue={selectedRecord.topic} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">课堂表现与知识点掌握</label>
                  <textarea rows={4} defaultValue={selectedRecord.performance} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" placeholder="记录学生的课堂互动、专注度及难点掌握情况..."></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">课后作业与下节计划</label>
                  <textarea rows={2} defaultValue={selectedRecord.homework} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" placeholder="布置的作业及下次课预告..."></textarea>
                </div>

                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                    需要顾问跟进
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" defaultChecked />
                    同步给家长
                  </label>
                </div>
              </div>

              {/* AI Summary Card */}
              <div className="bg-purple-50 p-5 rounded-xl border border-purple-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles className="w-24 h-24 text-purple-600" />
                </div>
                <div className="relative z-10">
                  <h4 className="font-bold text-purple-900 flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    AI 课后反馈总结
                  </h4>
                  {aiSummary ? (
                    <div className="bg-white/80 p-4 rounded-lg border border-purple-200 shadow-sm">
                      <p className="text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
                      <div className="mt-3 flex justify-end gap-2">
                        <button onClick={() => setAiSummary('')} className="text-xs text-purple-600 hover:text-purple-800 font-medium">重新生成</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-purple-800 leading-relaxed bg-white/60 p-4 rounded-lg border border-purple-100">
                        点击下方按钮，AI 将根据您的课堂表现记录自动生成结构化、专业亲切的家长反馈话术摘要，支持直接发送给家长微信。
                      </p>
                      <button 
                        onClick={handleGenerateAI}
                        disabled={isGeneratingAI}
                        className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm px-4 py-2 flex items-center gap-2 transition-colors disabled:opacity-70"
                      >
                        <Sparkles className={`w-4 h-4 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                        {isGeneratingAI ? '正在生成...' : '一键生成家长反馈'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3 shrink-0">
              {can(user?.role, 'submitLessonRecord') && (
                <button onClick={() => toast.success('已保存草稿')} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  保存草稿
                </button>
              )}
              {can(user?.role, 'deductCredit') && (
                <button onClick={handleConfirmDeduct} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  提交并确认消课
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
