import React, { useState, useEffect } from 'react';
import { ActivityItem, CivicIssue } from '../../types/issue';
import { subscribeToActivities } from '../../firebase/firestore';
import { formatDate } from '../../utils/formatDate';
import { Activity, ChevronDown, ChevronUp, MapPin, ThumbsUp, PlusCircle, CheckCircle2 } from 'lucide-react';

interface ActivityFeedProps {
  onSelectIssueById: (issueId: string) => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ onSelectIssueById }) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const unsub = subscribeToActivities((items) => {
      setActivities(items);
    });
    return () => unsub();
  }, []);

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl overflow-hidden shadow-2xl transition-all">
      {/* Feed Toggle Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Live Civic Activity ({activities.length})
          </span>
        </div>
        {collapsed ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Feed Stream */}
      {!collapsed && (
        <div className="max-h-60 overflow-y-auto px-4 py-2 divide-y divide-slate-800/80 custom-scrollbar">
          {activities.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-500">
              No recent activity recorded yet.
            </div>
          ) : (
            activities.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectIssueById(item.issueId)}
                className="py-2.5 flex items-start justify-between gap-3 cursor-pointer hover:bg-slate-800/30 px-1 rounded-lg transition-colors group"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 p-1 rounded-md bg-slate-800 group-hover:bg-indigo-600/30 transition-colors">
                    {item.type === 'reported' ? (
                      <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
                    ) : item.type === 'upvoted' ? (
                      <ThumbsUp className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block group-hover:text-indigo-300 transition-colors">
                      {item.issueTitle}
                    </span>
                    <span className="text-[11px] text-slate-400 block">{item.detail}</span>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{item.location}</span>
                    </div>
                  </div>
                </div>

                <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                  {formatDate(item.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
