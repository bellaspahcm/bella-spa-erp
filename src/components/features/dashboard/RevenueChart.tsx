'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp, ChevronRight, DollarSign, Star } from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  Tooltip, 
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

interface PerformanceDataPoint {
  name: string;
  customers: number;
  revenue?: number;
  expense?: number;
  rating?: number;
}

interface RevenueChartProps {
  performanceData: PerformanceDataPoint[];
  userRole: 'admin' | 'ktv' | null;
}

export function RevenueChart({ performanceData, userRole }: RevenueChartProps) {
  return (
    <div className="lg:col-span-1 space-y-8">
      {/* Performance Chart */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        className="luxury-card-pink rounded-[3rem] p-10 relative overflow-hidden shadow-2xl group flex flex-col justify-between h-[450px]"
      >
        <div className="relative z-10">
          <h2 className="text-xs font-semibold mb-1 text-white/70 uppercase tracking-[0.2em]">Hiệu suất tháng</h2>
          <div className="flex items-center gap-3 mb-8">
            <p className="text-4xl font-bold text-white tracking-tighter">
              {(() => {
                if (performanceData.length < 2) return '+0%';
                const current = performanceData[performanceData.length - 1].customers;
                const previous = performanceData[performanceData.length - 2].customers;
                if (previous === 0) return current > 0 ? '+100%' : '0%';
                const trend = ((current - previous) / previous) * 100;
                return (trend >= 0 ? '+' : '') + trend.toFixed(1) + '%';
              })()}
            </p>
            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md">
              <TrendingUp className="text-white w-4 h-4" />
            </div>
          </div>
          
          <div className="h-40 w-full relative mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                    borderRadius: '1rem', 
                    border: 'none',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    color: '#9D174D',
                    fontWeight: '800'
                  }}
                  itemStyle={{ color: '#9D174D' }}
                />
                <XAxis 
                  dataKey="name" 
                  axisLine={{ stroke: '#7d123e', strokeWidth: 2 }}
                  tickLine={false}
                  tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 10, fontWeight: 800 }}
                  dy={10}
                />
                <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                <Area 
                  type="monotone" 
                  dataKey="customers" 
                  stroke="#ffffff" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorPerf)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {userRole === 'admin' && (
          <Link 
            href="/dashboard/finance"
            className="w-full py-4 bg-white/10 hover:bg-white text-white hover:text-primary border border-white/20 hover:border-white rounded-2xl font-black transition-all duration-300 backdrop-blur-md uppercase tracking-widest text-[10px] active:scale-95 flex items-center justify-center gap-3 shadow-lg group/btn"
          >
            <span>Chi tiết báo cáo</span>
            <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </Link>
        )}
        
        <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-white/10 rounded-full blur-[100px]"></div>
      </motion.div>

      {/* Revenue & Expense Chart (Moved to Sidebar) */}
      {userRole === 'admin' && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-pink luxury-box-hover rounded-[3rem] p-8 shadow-sm border border-white relative overflow-hidden h-[400px]"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400/30 via-primary/30 to-rose-400/30" />
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">Tài chính</h2>
            </div>
          </div>
          
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#888', fontSize: 10, fontWeight: 700 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#888', fontSize: 10, fontWeight: 700 }}
                  unit="tr"
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    borderRadius: '1rem', 
                    border: 'none',
                    boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.1)',
                    fontSize: '10px'
                  }}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Rating Chart (Moved to Sidebar) */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-pink luxury-box-hover rounded-[3rem] p-8 shadow-sm border border-white relative overflow-hidden h-[350px] flex flex-col"
      >
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400/30 to-orange-400/30" />
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <Star className="w-5 h-5 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">Đánh giá</h2>
        </div>
        
        <div className="flex-1 flex flex-col justify-between">
          <div className="mb-4">
            <p className="text-4xl font-black text-foreground tracking-tighter">
              {performanceData[performanceData.length - 1]?.rating || '5.0'}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`w-3 h-3 ${s <= Math.round(performanceData[performanceData.length - 1]?.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
              ))}
            </div>
          </div>

          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" hide />
                <YAxis hide domain={[4, 5]} />
                <Area type="monotone" dataKey="rating" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorRating)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
