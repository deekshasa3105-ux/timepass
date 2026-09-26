import React from 'react';
import { CivicIssue } from '../../types/issue';
import { Layers, AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';

interface CivicDashboardProps {
  issues: CivicIssue[];
  isLive: boolean;
}

export const CivicDashboard: React.FC<CivicDashboardProps> = ({ issues, isLive }) => {
  const total = issues.length;
  const openCount = issues.filter((i) => i.status !== 'resolved').length;
  const highOrCritical = issues.filter(
    (i) => (i.priorityLevel === 'CRITICAL' || i.priorityLevel === 'HIGH') && i.status !== 'resolved'
  ).length;
  const resolvedCount = issues.filter((i) => i.status === 'resolved').length;

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-2xl flex items-center gap-3 sm:gap-6 text-slate-200">
      {/* Live Indicator */}
      <div className="flex flex-col border-r border-slate-800/80 pr-3 sm:pr-4">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isLive ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isLive ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <span className="text-[10px] font-extrabold tracking-widest text-slate-300 uppercase">
            {isLive ? 'LIVE DATA' : 'CONNECTING'}
          </span>
        </div>
        <span className="text-[9px] text-slate-500 font-mono mt-0.5">Firestore Pulse</span>
      </div>

      {/* Metrics Row */}
      <div className="flex items-center gap-3 sm:gap-5">
        <div>
          <span className="text-base sm:text-lg font-black text-white leading-none block">
            {total}
          </span>
          <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
            Total Issues
          </span>
        </div>

        <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />

        <div>
          <span className="text-base sm:text-lg font-black text-amber-400 leading-none block">
            {openCount}
          </span>
          <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
            Active / Open
          </span>
        </div>

        <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />

        <div>
          <span className="text-base sm:text-lg font-black text-rose-400 leading-none block">
            {highOrCritical}
          </span>
          <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
            High Priority
          </span>
        </div>

        <div className="h-6 w-[1px] bg-slate-800 hidden sm:block" />

        <div>
          <span className="text-base sm:text-lg font-black text-emerald-400 leading-none block">
            {resolvedCount}
          </span>
          <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
            Resolved
          </span>
        </div>
      </div>
    </div>
  );
};
