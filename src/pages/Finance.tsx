import { useState } from 'react';
import { Search, Plus, Filter, Download } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { creditService } from '../services/creditService';

const financePageStats = creditService.getFinancePageStatsSync();

export function Finance() {
  const { orders } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">财务管理</h1>
        <div className="flex gap-3">
          <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出流水
          </button>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            新建收款
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-sm font-medium text-gray-500">本月实收 (元)</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-2">{financePageStats.monthlyReceived.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</h3>
          <p className="text-sm text-green-600 mt-2 font-medium">{financePageStats.monthlyReceivedGrowth} 较上月</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-sm font-medium text-gray-500">本月课耗收入 (元)</p>
          <h3 className="text-3xl font-bold text-gray-900 mt-2">{financePageStats.monthlyLessonRevenue.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</h3>
          <p className="text-sm text-green-600 mt-2 font-medium">{financePageStats.monthlyLessonGrowth} 较上月</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-sm font-medium text-gray-500">待收款 (元)</p>
          <h3 className="text-3xl font-bold text-orange-600 mt-2">{financePageStats.pendingReceivable.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</h3>
          <p className="text-sm text-gray-500 mt-2">涉及 {financePageStats.pendingOrderCount} 笔订单</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜索订单号或学员..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
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
                <th scope="col" className="px-6 py-4">订单号</th>
                <th scope="col" className="px-6 py-4">学员</th>
                <th scope="col" className="px-6 py-4">报名课程</th>
                <th scope="col" className="px-6 py-4">金额 (元)</th>
                <th scope="col" className="px-6 py-4">日期</th>
                <th scope="col" className="px-6 py-4">状态</th>
                <th scope="col" className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="bg-white border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-gray-600">
                    {order.id}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {order.studentName}
                  </td>
                  <td className="px-6 py-4">
                    {order.courseName}
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900">
                    ¥{order.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {order.date}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full
                      ${order.status === 'paid' ? 'bg-green-100 text-green-700' : 
                        order.status === 'pending' ? 'bg-orange-100 text-orange-700' : 
                        'bg-gray-100 text-gray-700'}`}>
                      {order.status === 'paid' ? '已支付' : 
                       order.status === 'pending' ? '待支付' : '已退款'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">详情</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
