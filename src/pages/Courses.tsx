import { useState, type FormEvent } from 'react';
import { Search, Plus, Filter } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { can } from '../auth/permissions';
import { Modal } from '../components/ui/Modal';
import type { Course } from '../types';
import toast from 'react-hot-toast';

export function Courses() {
  const { courses, addCourse, updateCourse, deleteCourse } = useAppContext();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Omit<Course, 'id'>>({
    name: '',
    category: 'math',
    level: '基础',
    totalLessons: 20,
    price: 0,
    teachingMethod: '小班课',
    targetGrades: [],
    status: 'active',
    description: '',
    syllabus: '',
  });

  const filteredCourses = courses.filter((course) => {
    const matchSearch = course.name.includes(searchTerm);
    const matchCategory = !categoryFilter || course.category === categoryFilter;
    const matchStatus = !statusFilter || course.status === statusFilter;
    return matchSearch && matchCategory && matchStatus;
  });

  const openCreate = () => {
    setEditingCourse(null);
    setFormData({
      name: '',
      category: 'math',
      level: '基础',
      totalLessons: 20,
      price: 0,
      teachingMethod: '小班课',
      targetGrades: [],
      status: 'active',
      description: '',
      syllabus: '',
    });
    setIsModalOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      name: course.name,
      category: course.category,
      level: course.level,
      totalLessons: course.totalLessons,
      price: course.price,
      teachingMethod: course.teachingMethod ?? course.teachingMode ?? '',
      targetGrades: course.targetGrades ?? course.suitableGrades ?? [],
      status: course.status ?? 'active',
      description: course.description ?? '',
      syllabus: course.syllabus ?? '',
      responsibleTeacherId: course.responsibleTeacherId,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!formData.name.trim()) {
      toast.error('课程名称不能为空');
      return;
    }
    setIsSaving(true);
    try {
      if (editingCourse) {
        await updateCourse(editingCourse.id, formData);
        toast.success('课程已更新');
      } else {
        await addCourse(formData);
        toast.success('课程已创建');
      }
      setIsModalOpen(false);
    } catch {
      toast.error('保存课程失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (course: Course) => {
    if (!confirm(`确认删除课程「${course.name}」吗？`)) return;
    try {
      await deleteCourse(course.id);
      toast.success('课程已删除');
    } catch {
      toast.error('删除课程失败');
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">课程管理</h1>
        {can(user?.role, 'createCourse') && (
          <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            新增课程
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
              placeholder="搜索课程名称..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg w-full sm:w-auto justify-center">
              <Filter className="w-4 h-4" />
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="outline-none bg-transparent">
                <option value="">全部分类</option>
                <option value="math">数学</option>
                <option value="physics">物理</option>
                <option value="chemistry">化学</option>
                <option value="english">英语</option>
                <option value="competition">竞赛</option>
                <option value="research">科研</option>
              </select>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg w-full sm:w-auto justify-center">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="outline-none bg-transparent">
                <option value="">全部状态</option>
                <option value="active">启用</option>
                <option value="draft">草稿</option>
                <option value="archived">归档</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-4">课程名称</th>
                <th scope="col" className="px-6 py-4">分类</th>
                <th scope="col" className="px-6 py-4">层级</th>
                <th scope="col" className="px-6 py-4">总课时</th>
                <th scope="col" className="px-6 py-4">标准定价</th>
                <th scope="col" className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((course) => (
                <tr key={course.id} className="bg-white border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {course.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-md uppercase">
                      {course.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {course.level}
                  </td>
                  <td className="px-6 py-4">
                    {course.totalLessons} 课时
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    ¥{course.price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEdit(course)} className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-3">编辑</button>
                    <button onClick={() => handleDelete(course)} className="text-red-600 hover:text-red-800 font-medium text-sm">删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCourse ? '编辑课程' : '新增课程'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">课程名称</label>
              <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as Course['category'] })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500">
                <option value="math">数学</option>
                <option value="physics">物理</option>
                <option value="chemistry">化学</option>
                <option value="english">英语</option>
                <option value="competition">竞赛</option>
                <option value="research">科研</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">层级</label>
              <input value={formData.level} onChange={(e) => setFormData({ ...formData, level: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">授课方式</label>
              <input value={formData.teachingMethod ?? ''} onChange={(e) => setFormData({ ...formData, teachingMethod: e.target.value, teachingMode: e.target.value })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">总课时</label>
              <input type="number" value={formData.totalLessons} onChange={(e) => setFormData({ ...formData, totalLessons: Number(e.target.value), totalHours: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">价格</label>
              <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">适用年级</label>
              <input value={(formData.targetGrades ?? []).join('、')} onChange={(e) => setFormData({ ...formData, targetGrades: e.target.value.split(/[、,，]/).filter(Boolean), suitableGrades: e.target.value.split(/[、,，]/).filter(Boolean) })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as Course['status'] })} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500">
                <option value="active">启用</option>
                <option value="draft">草稿</option>
                <option value="archived">归档</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课程描述</label>
            <textarea value={formData.description ?? ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课程大纲</label>
            <textarea value={formData.syllabus ?? ''} onChange={(e) => setFormData({ ...formData, syllabus: e.target.value })} rows={3} className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">{isSaving ? '保存中...' : '保存课程'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
