'use client';

import { motion } from 'framer-motion';
import { Users, Clock, Star, Trophy, Diamond } from 'lucide-react';

interface KtvItem {
  name: string;
  sessions: number;
  rating: number;
  status: string;
  bonus: string;
}

interface KtvPerformanceTableProps {
  topKTVs: KtvItem[];
}

export function KtvPerformanceTable({ topKTVs }: KtvPerformanceTableProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="glass-pink luxury-box-hover rounded-[3rem] p-10 shadow-sm border border-white relative overflow-hidden"
    >
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30" />
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
          <Trophy className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground uppercase tracking-tight">Top KTV Xuất Sắc</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-pink-100">
              <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" /> Tên KTV
              </th>
              <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                <Clock className="w-4 h-4 inline mr-2" /> Buổi
              </th>
              <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                <Star className="w-4 h-4 inline mr-2" /> Rating
              </th>
              <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground text-center">Status</th>
              <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground text-right">
                <Diamond className="w-4 h-4 inline mr-2" /> Bonus
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-50">
            {topKTVs.map((ktv, idx) => (
              <tr key={idx} className="group hover:bg-white/40 transition-colors">
                <td className="py-6 font-bold text-foreground">{ktv.name}</td>
                <td className="py-6 font-bold text-muted-foreground">{ktv.sessions} buổi</td>
                <td className="py-6 font-bold text-muted-foreground">
                  <div className="flex items-center gap-1">
                    {ktv.rating} <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  </div>
                </td>
                <td className="py-6 text-center">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    ktv.status === 'Xuất Sắc' 
                      ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' 
                      : 'bg-blue-100 text-blue-600 border border-blue-200'
                  }`}>
                    {ktv.status}
                  </span>
                </td>
                <td className="py-6 text-right font-bold text-primary">{ktv.bonus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
