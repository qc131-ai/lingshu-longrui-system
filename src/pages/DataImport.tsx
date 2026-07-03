import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, RotateCcw, Upload, CheckCircle2, AlertCircle, Search } from 'lucide-react';
import { importExportService, type ExportType, type ImportBatch, type ImportPreviewResult, type ImportType } from '../services/importExportService';
import { useAuth } from '../context/AuthContext';

const importTypes: Array<{ value: ImportType; label: string }> = [
  { value: 'students', label: '学员导入' },
  { value: 'courses', label: '课程导入' },
  { value: 'teachers', label: '老师导入' },
  { value: 'classes', label: '班级导入' },
  { value: 'credit-balances', label: '课时余额导入' },
  { value: 'schedules', label: '历史排课导入' },
  { value: 'lesson-records', label: '历史上课记录导入' },
];

const exportTypes: Array<{ value: ExportType; label: string }> = [
  { value: 'students', label: '学员' },
  { value: 'courses', label: '课程' },
  { value: 'teachers', label: '老师' },
  { value: 'classes', label: '班级' },
  { value: 'credit-accounts', label: '课时账户' },
  { value: 'credit-transactions', label: '课时流水' },
  { value: 'schedules', label: '排课记录' },
  { value: 'lesson-records', label: '上课记录' },
  { value: 'leave-makeup', label: '请假补课' },
  { value: 'parent-reports', label: '家长报告' },
];

const statusLabels: Record<string, string> = {
  previewed: '已预览',
  imported: '已导入',
  failed: '导入失败',
  rolled_back: '已回滚',
};

function canImportRole(role?: string) {
  return role === 'admin' || role === 'academic_manager' || role === 'finance';
}

function cellText(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? '是' : '否';
  return value == null ? '-' : '-';
}

export function DataImport() {
  const { user } = useAuth();
  const [importType, setImportType] = useState<ImportType>('students');
  const [exportType, setExportType] = useState<ExportType>('students');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', studentId: '', courseId: '', teacherId: '', status: '' });

  const previewColumns = useMemo(() => {
    const first = preview?.previewRows?.[0]?.normalizedData;
    return first ? Object.keys(first).slice(0, 8) : [];
  }, [preview]);

  const loadBatches = async () => {
    try {
      setBatches(await importExportService.listBatches());
    } catch (error) {
      toast.error(`导入批次加载失败：${error instanceof Error ? error.message : '未知错误'}`);
      setBatches([]);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleTemplate = async () => {
    try {
      await importExportService.downloadTemplate(importType);
      toast.success('模板已下载');
    } catch (error) {
      toast.error(`模板下载失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handlePreview = async () => {
    if (!file) {
      toast.error('请先选择 Excel 文件');
      return;
    }
    setLoading(true);
    try {
      const result = await importExportService.preview(importType, file);
      setPreview(result);
      toast.success('预览校验完成');
      await loadBatches();
    } catch (error) {
      toast.error(`预览失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview || preview.validRows <= 0) return;
    if (preview.invalidRows > 0 && !window.confirm(`当前有 ${preview.invalidRows} 行错误，将只导入有效行。是否继续？`)) return;
    setLoading(true);
    try {
      const result = await importExportService.confirm(preview.importBatchId);
      toast.success(`导入成功，写入 ${result.createdCount} 条记录`);
      setPreview(null);
      setFile(null);
      await loadBatches();
    } catch (error) {
      toast.error(`确认导入失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (batch: ImportBatch) => {
    if (!window.confirm(`确认回滚批次 ${batch.importBatchId.slice(0, 8)}？`)) return;
    try {
      const result = await importExportService.rollback(batch.importBatchId);
      toast.success(`回滚完成，处理 ${result.rollbackCount} 条记录`);
      await loadBatches();
    } catch (error) {
      toast.error(`回滚失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleExport = async () => {
    try {
      await importExportService.exportData(exportType, filters);
      toast.success('导出文件已生成');
    } catch (error) {
      toast.error(`导出失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">数据导入导出</h1>
        <p className="text-gray-500 mt-1">Excel 模板下载、预览校验、确认写入、批次回滚和运营数据导出。</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-gray-900">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Excel 导入
            </div>
            {!canImportRole(user?.role) && <span className="text-sm text-orange-600">当前角色仅可导出，不能批量导入</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={importType} onChange={(event) => setImportType(event.target.value as ImportType)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {importTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <button onClick={handleTemplate} className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> 下载模板
            </button>
            <label className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" /> {file ? file.name : '选择 Excel'}
              <input type="file" accept=".xlsx" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </label>
          </div>

          <div className="flex gap-3">
            <button disabled={!file || loading || !canImportRole(user?.role)} onClick={handlePreview} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">预览校验</button>
            <button disabled={!preview || preview.validRows <= 0 || loading} onClick={handleConfirm} className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50">确认导入</button>
          </div>

          {preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-500">总行数</div><div className="text-xl font-bold">{preview.totalRows}</div></div>
                <div className="bg-green-50 rounded-lg p-3"><div className="text-xs text-gray-500">有效行</div><div className="text-xl font-bold text-green-700">{preview.validRows}</div></div>
                <div className="bg-red-50 rounded-lg p-3"><div className="text-xs text-gray-500">错误行</div><div className="text-xl font-bold text-red-700">{preview.invalidRows}</div></div>
                <div className="bg-orange-50 rounded-lg p-3"><div className="text-xs text-gray-500">Warning</div><div className="text-xl font-bold text-orange-700">{preview.warningRows}</div></div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">行号</th>
                      <th className="px-3 py-2 text-left">状态</th>
                      {previewColumns.map((column) => <th key={column} className="px-3 py-2 text-left">{column}</th>)}
                      <th className="px-3 py-2 text-left">错误 / 提醒</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.previewRows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2">{row.isValid ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}</td>
                        {previewColumns.map((column) => <td key={column} className="px-3 py-2">{cellText(row.normalizedData[column])}</td>)}
                        <td className="px-3 py-2 text-red-600">{[...row.errors, ...row.warnings].join('；') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <Download className="w-5 h-5 text-green-600" />
            数据导出
          </div>
          <select value={exportType} onChange={(event) => setExportType(event.target.value as ExportType)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {exportTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <input placeholder="学生 ID" value={filters.studentId} onChange={(event) => setFilters({ ...filters, studentId: event.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <input placeholder="课程 ID" value={filters.courseId} onChange={(event) => setFilters({ ...filters, courseId: event.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <input placeholder="老师 ID" value={filters.teacherId} onChange={(event) => setFilters({ ...filters, teacherId: event.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <input placeholder="状态" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <button onClick={handleExport} className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> 导出 .xlsx
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center gap-2 font-bold text-gray-900">
          <Search className="w-5 h-5 text-gray-500" />
          导入批次
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['批次号', '类型', '文件名', '总行数', '有效行', '错误行', '状态', '创建时间', '操作'].map((header) => <th key={header} className="px-4 py-3 text-left font-medium text-gray-500">{header}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td className="px-4 py-3 font-mono text-xs">{batch.importBatchId.slice(0, 8)}</td>
                  <td className="px-4 py-3">{batch.typeLabel}</td>
                  <td className="px-4 py-3">{batch.fileName}</td>
                  <td className="px-4 py-3">{batch.totalRows}</td>
                  <td className="px-4 py-3 text-green-700">{batch.validRows}</td>
                  <td className="px-4 py-3 text-red-700">{batch.invalidRows}</td>
                  <td className="px-4 py-3">{statusLabels[batch.status] ?? batch.status}</td>
                  <td className="px-4 py-3">{new Date(batch.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button disabled={batch.status !== 'imported'} onClick={() => handleRollback(batch)} className="text-red-600 hover:text-red-700 disabled:text-gray-300 inline-flex items-center gap-1">
                      <RotateCcw className="w-4 h-4" /> 回滚
                    </button>
                  </td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">暂无导入批次</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
