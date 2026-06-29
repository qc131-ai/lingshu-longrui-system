import { useState, type FormEvent } from 'react';
import { Search, Plus, Filter, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Drawer';
import type { Class } from '../types';
import toast from 'react-hot-toast';
import { courseService } from '../services/courseService';

export function Classes() {
  const { classes, courses, teachers, students, addClass, updateClass, deleteClass, refreshClasses } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [studentToAdd, setStudentToAdd] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Omit<Class, 'id'>>({
    name: '',
    courseId: '',
    teacherId: '',
    teacherName: '',
    schedule: '',
    capacity: 8,
    enrolled: 0,
    classroom: '',
    status: 'active',
    studentIds: [],
  });

  const filteredClasses = classes.filter((cls) => cls.name.includes(searchTerm));

  const openCreate = () => {
    setEditingClass(null);
    setFormData({
      name: '',
      courseId: courses[0]?.id ?? '',
      teacherId: teachers[0]?.id ?? '',
      teacherName: teachers[0]?.name ?? '',
      schedule: '',
      capacity: 8,
      enrolled: 0,
      classroom: '',
      status: 'active',
      studentIds: [],
    });
    setIsModalOpen(true);
  };

  const openEdit = (cls: Class) => {
    setEditingClass(cls);
    setFormData({
      name: cls.name,
      courseId: cls.courseId,
      teacherId: cls.teacherId,
      teacherName: cls.teacherName,
      schedule: cls.schedule,
      capacity: cls.capacity,
      enrolled: cls.enrolled,
      classroom: cls.classroom,
      status: cls.status ?? 'active',
      studentIds: cls.studentIds ?? [],
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim() || !formData.courseId || !formData.teacherId) {
      toast.error('班级名称、课程和老师不能为空');
      return;
    }
    setIsSaving(true);
    try {
      const teacherName = teachers.find((teacher) => teacher.id === formData.teacherId)?.name ?? formData.teacherName;
      const payload = { ...formData, teacherName };
      if (editingClass) {
        await updateClass(editingClass.id, payload);
        toast.success('班级已更新');
      } else {
        await addClass(payload);
        toast.success('班级已创建');
      }
      setIsModalOpen(false);
    } catch {
      toast.error('保存班级失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (cls: Class) => {
    if (!confirm(`确认删除班级「${cls.name}」吗？`)) return;
    try {
      await deleteClass(cls.id);
      setSelectedClass(null);
      toast.success('班级已删除');
    } catch {
      toast.error('删除班级失败');
    }
  };

  const handleAddStudent = async () => {
    if (!selectedClass || !studentToAdd) return;
    try {
      await courseService.addClassStudent(selectedClass.id, studentToAdd);
      await refreshClasses();
      setStudentToAdd('');
      toast.success('学员已加入班级');
    } catch {
      toast.error('添加学员失败');
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedClass) return;
    try {
      await courseService.removeClassStudent(selectedClass.id, studentId);
      await refreshClasses();
      toast.success('学员已移出班级');
    } catch {
      toast.error('移除学员失败');
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">班级管理</h1>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          新建班级
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜索班级名称..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto justify-center">
              <Filter className="w-4 h-4" />
              学科筛选
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-4">班级名称</th>
                <th scope="col" className="px-6 py-4">授课教师</th>
                <th scope="col" className="px-6 py-4">上课时间</th>
                <th scope="col" className="px-6 py-4">教室</th>
                <th scope="col" className="px-6 py-4">人数 (已报/上限)</th>
                <th scope="col" className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.map((cls) => (
                <tr key={cls.id} className="bg-white border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{cls.name}</div>
                    <div className="text-xs text-gray-500">ID: {cls.id}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-700">
                    {cls.teacherName}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {cls.schedule}
                  </td>
                  <td className="px-6 py-4">
                    {cls.classroom}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            (cls.enrolled / cls.capacity) >= 1 ? 'bg-red-500' : 
                            (cls.enrolled / cls.capacity) >= 0.8 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${(cls.enrolled / cls.capacity) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                        {cls.enrolled} / {cls.capacity}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setSelectedClass(cls)} className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-3">详情</button>
                    <button onClick={() => openEdit(cls)} className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-3">编辑</button>
                    <button onClick={() => handleDelete(cls)} className="text-red-600 hover:text-red-800 font-medium text-sm">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingClass ? '编辑班级' : '新建班级'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">班级名称</label>
              <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">关联课程</label>
              <select value={formData.courseId} onChange={(e) => setFormData({ ...formData, courseId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500">
                {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">主讲老师</label>
              <select value={formData.teacherId} onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500">
                {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">固定上课时间</label>
              <input value={formData.schedule} onChange={(e) => setFormData({ ...formData, schedule: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">容量</label>
              <input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">教室</label>
              <input value={formData.classroom} onChange={(e) => setFormData({ ...formData, classroom: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">{isSaving ? '保存中...' : '保存班级'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!selectedClass} onClose={() => setSelectedClass(null)} title="班级详情">
        {selectedClass && (
          <div className="p-6 space-y-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-2 text-sm">
              <div><span className="text-gray-500">班级名称：</span><span className="font-medium text-gray-900">{selectedClass.name}</span></div>
              <div><span className="text-gray-500">关联课程：</span><span className="font-medium text-gray-900">{selectedClass.courseName ?? courses.find((course) => course.id === selectedClass.courseId)?.name}</span></div>
              <div><span className="text-gray-500">主讲老师：</span><span className="font-medium text-gray-900">{selectedClass.teacherName}</span></div>
              <div><span className="text-gray-500">固定时间：</span><span className="font-medium text-gray-900">{selectedClass.schedule}</span></div>
              <div><span className="text-gray-500">班级状态：</span><span className="font-medium text-gray-900">{selectedClass.status ?? 'active'}</span></div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
              <h4 className="font-bold text-gray-900 mb-3">学生名单</h4>
              <div className="flex gap-2 mb-4">
                <select value={studentToAdd} onChange={(e) => setStudentToAdd(e.target.value)} className="flex-1 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500">
                  <option value="">选择学员加入班级</option>
                  {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
                </select>
                <button onClick={handleAddStudent} className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">添加</button>
              </div>
              <div className="space-y-2">
                {(selectedClass.studentIds ?? []).map((studentId, index) => {
                  const studentName = selectedClass.studentNames?.[index] ?? students.find((student) => student.id === studentId)?.name ?? studentId;
                  return (
                    <div key={studentId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                      <span>{studentName}</span>
                      <button onClick={() => handleRemoveStudent(studentId)} className="text-red-600 hover:text-red-800">移除</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
