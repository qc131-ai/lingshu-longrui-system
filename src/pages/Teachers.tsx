import { useState, type FormEvent } from 'react';
import { Search, Plus, Filter, Star } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Modal } from '../components/ui/Modal';
import type { Teacher } from '../types';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export function Teachers() {
  const { teachers, addTeacher, updateTeacher, deleteTeacher } = useAppContext();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Omit<Teacher, 'id'>>({
    name: '',
    subjects: [],
    type: 'full-time',
    rating: 4.8,
    classesCount: 0,
    availableTime: [],
    feedbackRate: 90,
    status: 'active',
  });

  const filteredTeachers = teachers.filter((teacher) => teacher.name.includes(searchTerm));

  const canManageTeachers = user?.role === 'admin' || user?.role === 'academic_manager';

  const openCreate = () => {
    setEditingTeacher(null);
    setFormData({
      name: '',
      subjects: [],
      type: 'full-time',
      rating: 4.8,
      classesCount: 0,
      availableTime: [],
      feedbackRate: 90,
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const openEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name,
      subjects: teacher.subjects,
      type: teacher.type,
      rating: teacher.rating,
      classesCount: teacher.classesCount,
      availableTime: teacher.availableTime ?? [],
      feedbackRate: teacher.feedbackRate,
      userId: teacher.userId,
      status: teacher.status ?? 'active',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim() || formData.subjects.length === 0) {
      toast.error('老师姓名和擅长科目不能为空');
      return;
    }
    setIsSaving(true);
    try {
      if (editingTeacher) {
        await updateTeacher(editingTeacher.id, formData);
        toast.success('老师资料已更新');
      } else {
        await addTeacher(formData);
        toast.success('老师已创建');
      }
      setIsModalOpen(false);
    } catch {
      toast.error('保存老师失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (teacher: Teacher) => {
    if (!confirm(`确认删除老师「${teacher.name}」吗？`)) return;
    try {
      await deleteTeacher(teacher.id);
      toast.success('老师已删除');
    } catch {
      toast.error('删除老师失败');
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">教务/教师管理</h1>
        {canManageTeachers && (
          <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            添加教师
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
              placeholder="搜索教师姓名..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-4">教师姓名</th>
                <th scope="col" className="px-6 py-4">类型</th>
                <th scope="col" className="px-6 py-4">教授科目</th>
                <th scope="col" className="px-6 py-4">当前带班</th>
                <th scope="col" className="px-6 py-4">评分</th>
                <th scope="col" className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((teacher) => (
                <tr key={teacher.id} className="bg-white border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                        {teacher.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{teacher.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full
                      ${teacher.type === 'full-time' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {teacher.type === 'full-time' ? '全职' : '兼职'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {teacher.subjects.map(subject => (
                        <span key={subject} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {subject}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {teacher.classesCount} 个班级
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="font-medium text-gray-900">{teacher.rating}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEdit(teacher)} className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-3">编辑</button>
                    {canManageTeachers && (
                      <button onClick={() => handleDelete(teacher)} className="text-red-600 hover:text-red-800 font-medium text-sm">删除</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTeacher ? '编辑老师资料' : '添加教师'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">教师姓名</label>
              <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as Teacher['type'] })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500">
                <option value="full-time">全职</option>
                <option value="part-time">兼职</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">擅长科目</label>
              <input value={formData.subjects.join('、')} onChange={(e) => setFormData({ ...formData, subjects: e.target.value.split(/[、,，]/).filter(Boolean) })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">可用时间</label>
              <input value={(formData.availableTime ?? []).join('、')} onChange={(e) => setFormData({ ...formData, availableTime: e.target.value.split(/[、,，]/).filter(Boolean) })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">评分</label>
              <input type="number" step="0.1" value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">反馈率</label>
              <input type="number" value={formData.feedbackRate ?? 0} onChange={(e) => setFormData({ ...formData, feedbackRate: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">{isSaving ? '保存中...' : '保存老师'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
