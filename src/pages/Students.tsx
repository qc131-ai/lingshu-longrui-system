import { useState, useEffect, type FormEvent } from 'react';
import { Search, Plus, Filter, MoreVertical, Edit, Trash2, Calendar as CalendarIcon, Clock, BookOpen, AlertCircle, Sparkles, FileText } from 'lucide-react';
import { Student, StudentDetail } from '../types';
import { useAppContext } from '../context/AppContext';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Drawer';
import { studentService } from '../services/studentService';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { can } from '../auth/permissions';

const { tags: studentTagOptions, grades: gradeOptions } = studentService.getFormOptionsSync();

export function Students() {
  const { students, addStudent, updateStudent, deleteStudent } = useAppContext();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);

  useEffect(() => {
    if (selectedStudent) {
      studentService.getStudentDetail(selectedStudent.id, students)
        .then(setStudentDetail)
        .catch(() => {
          toast.error('学员详情加载失败');
          setStudentDetail(null);
        });
    } else {
      setStudentDetail(null);
    }
  }, [selectedStudent, students]);

  // Form State
  const [formData, setFormData] = useState({
    name: '', phone: '', grade: '10年级', school: '', targetCountry: '', targetDirection: '',
    advisor: '', tags: [] as string[], remainingCredits: 0, riskStatus: 'normal' as Student['riskStatus'],
    parentPhone: '', notes: ''
  });

  const availableTags = studentTagOptions;

  const filteredStudents = students.filter(s => 
    s.name.includes(searchTerm) || s.phone.includes(searchTerm)
  );

  const handleSaveStudent = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error('学员姓名和手机号不能为空');
      return;
    }
    
    setIsSavingStudent(true);
    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        grade: formData.grade,
        school: formData.school,
        remainingCredits: Number(formData.remainingCredits),
        riskStatus: formData.riskStatus,
        tags: formData.tags,
        enrollmentDate: new Date().toISOString().split('T')[0]
      };
      if (editingStudent) {
        await updateStudent(editingStudent.id, payload);
      } else {
        await addStudent(payload);
      }
      
      setIsModalOpen(false);
      setEditingStudent(null);
      toast.success(editingStudent ? '学员资料已更新' : '学员已成功创建');
      
      // Reset form
      setFormData({
        name: '', phone: '', grade: '10年级', school: '', targetCountry: '', targetDirection: '',
        advisor: '', tags: [], remainingCredits: 0, riskStatus: 'normal', parentPhone: '', notes: ''
      });
    } catch {
      toast.error('新增学员失败，请稍后重试');
    } finally {
      setIsSavingStudent(false);
    }
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }));
  };

  const openEditStudent = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      phone: student.phone,
      grade: student.grade,
      school: student.school,
      targetCountry: '',
      targetDirection: '',
      advisor: '',
      tags: student.tags,
      remainingCredits: student.remainingCredits,
      riskStatus: student.riskStatus,
      parentPhone: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteStudent = async (student: Student) => {
    if (!confirm(`确认删除学员「${student.name}」吗？`)) return;
    try {
      await deleteStudent(student.id);
      setSelectedStudent(null);
      toast.success('学员已删除');
    } catch {
      toast.error('删除学员失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">学员管理</h1>
        {can(user?.role, 'createStudent') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新增学员
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜索学员姓名或手机号..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto justify-center">
              <Filter className="w-4 h-4" />
              年级筛选
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto justify-center">
              <Filter className="w-4 h-4" />
              预警状态
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-4">学员信息</th>
                <th scope="col" className="px-6 py-4">联系方式</th>
                <th scope="col" className="px-6 py-4">剩余课时</th>
                <th scope="col" className="px-6 py-4">预警状态</th>
                <th scope="col" className="px-6 py-4">标签</th>
                <th scope="col" className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr 
                  key={student.id} 
                  className="bg-white border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedStudent(student)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{student.name}</div>
                        <div className="text-xs text-gray-500">{student.grade} · {student.school}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {student.phone}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${student.remainingCredits <= 5 ? 'text-red-600' : 'text-gray-900'}`}>
                      {student.remainingCredits}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full
                      ${student.riskStatus === 'high' ? 'bg-red-100 text-red-700' : 
                        student.riskStatus === 'medium' ? 'bg-orange-100 text-orange-700' : 
                        'bg-green-100 text-green-700'}`}>
                      {student.riskStatus === 'high' ? '高风险' : 
                       student.riskStatus === 'medium' ? '中风险' : '安全'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {student.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedStudent(student); }}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    没有找到匹配的学员
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
          <div>共 {filteredStudents.length} 条记录</div>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50" disabled>上一页</button>
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50" disabled>下一页</button>
          </div>
        </div>
      </div>

      {/* New Student Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingStudent(null); }} title={editingStudent ? "编辑学员资料" : "新增学员"}>
        <form onSubmit={handleSaveStudent} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学员姓名 <span className="text-red-500">*</span></label>
              <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" placeholder="输入姓名" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">手机号 <span className="text-red-500">*</span></label>
              <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" placeholder="输入手机号" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
              <select value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm">
                {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">当前学校</label>
              <input type="text" value={formData.school} onChange={e => setFormData({...formData, school: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" placeholder="如：平和双语" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目标国家</label>
              <input type="text" value={formData.targetCountry} onChange={e => setFormData({...formData, targetCountry: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" placeholder="如：美国" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目标方向</label>
              <input type="text" value={formData.targetDirection} onChange={e => setFormData({...formData, targetDirection: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" placeholder="如：理工科" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">负责顾问</label>
              <input type="text" value={formData.advisor} onChange={e => setFormData({...formData, advisor: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">购买课时</label>
              <input type="number" value={formData.remainingCredits} onChange={e => setFormData({...formData, remainingCredits: Number(e.target.value)})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">家长联系方式</label>
              <input type="text" value={formData.parentPhone} onChange={e => setFormData({...formData, parentPhone: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">预警状态</label>
              <select value={formData.riskStatus} onChange={e => setFormData({...formData, riskStatus: e.target.value as any})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm">
                <option value="normal">安全</option>
                <option value="medium">中风险</option>
                <option value="high">高风险</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">课程标签</label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${formData.tags.includes(tag) ? 'bg-blue-100 text-blue-700 border-blue-200 border' : 'bg-gray-100 text-gray-600 border-transparent border hover:bg-gray-200'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={3} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              取消
            </button>
            <button type="submit" disabled={isSavingStudent} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              {editingStudent ? '保存修改' : '保存学员'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Student Details Drawer */}
      <Drawer isOpen={!!selectedStudent} onClose={() => setSelectedStudent(null)} title="学员课程档案">
        {selectedStudent && (
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl shrink-0">
                {selectedStudent.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{selectedStudent.name}</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><span className="text-gray-500">年级:</span> <span className="font-medium">{selectedStudent.grade}</span></div>
                  <div><span className="text-gray-500">学校:</span> <span className="font-medium">{selectedStudent.school}</span></div>
                  <div><span className="text-gray-500">电话:</span> <span className="font-medium">{selectedStudent.phone}</span></div>
                  <div><span className="text-gray-500">负责顾问:</span> <span className="font-medium">{studentDetail?.advisor ?? 'Liang'}</span></div>
                </div>
              </div>
            </div>

            {/* Course Overview */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-400" />
                课程概览
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center">
                  <div className="text-xs text-gray-500 mb-1">剩余课时</div>
                  <div className="text-xl font-bold text-blue-600">{selectedStudent.remainingCredits}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center">
                  <div className="text-xs text-gray-500 mb-1">已消耗课时</div>
                  <div className="text-xl font-bold text-gray-900">{studentDetail?.consumedCredits ?? 42}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-center col-span-2">
                  <div className="text-xs text-gray-500 mb-1">最近上课</div>
                  <div className="text-sm font-bold text-gray-900 mt-1">{studentDetail?.lastLesson ?? '2024-03-24 · AP微积分'}</div>
                </div>
              </div>
            </div>

            {/* Risk Warnings */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                风险提示
              </h4>
              <ul className="space-y-3">
                {selectedStudent.remainingCredits <= 10 && (
                  <li className="flex items-start gap-2 text-sm text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-100">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>课时预警：当前剩余 {selectedStudent.remainingCredits} 课时，建议尽快沟通续费。</div>
                  </li>
                )}
                <li className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 p-2.5 rounded-lg border border-orange-100">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>{studentDetail?.homeworkOverdueWarning ?? '作业逾期：托福写作存在连续2次逾期情况，需跟进原因。'}</div>
                </li>
              </ul>
            </div>

            {/* AI Summary */}
            <div className="bg-purple-50 p-5 rounded-xl border border-purple-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Sparkles className="w-24 h-24 text-purple-600" />
              </div>
              <div className="relative z-10">
                <h4 className="font-bold text-purple-900 flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  AI 学习总结
                </h4>
                <p className="text-sm text-purple-800 leading-relaxed bg-white/60 p-4 rounded-lg border border-purple-100">
                  {studentDetail?.aiLearningSummary ?? '该学员当前 AP 课程进度稳定，但托福写作作业存在连续逾期情况。建议顾问与授课老师确认写作训练计划，并在下次家长沟通中重点说明。'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-200">
              <button onClick={() => openEditStudent(selectedStudent)} className="flex items-center justify-center gap-2 p-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                编辑资料
              </button>
              <button onClick={() => toast.success('已跳转新建排课')} className="flex items-center justify-center gap-2 p-2.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                <CalendarIcon className="w-4 h-4" /> 新建排课
              </button>
              <button onClick={() => toast.success('家长报告生成中...')} className="flex items-center justify-center gap-2 p-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <FileText className="w-4 h-4" /> 生成家长报告
              </button>
              <button className="flex items-center justify-center gap-2 p-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                查看课时流水
              </button>
              <button onClick={() => handleDeleteStudent(selectedStudent)} className="col-span-2 flex items-center justify-center gap-2 p-2.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
                删除学员
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

