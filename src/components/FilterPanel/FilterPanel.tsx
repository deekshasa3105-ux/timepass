import React from 'react';
import { IssueFilterState, IssueCategory } from '../../types/issue';
import { getCategoryMeta } from '../../utils/priority';
import { Filter, RotateCcw, Flame, CheckCircle, Clock, AlertTriangle, Layers } from 'lucide-react';

interface FilterPanelProps {
  filters: IssueFilterState;
  onFilterChange: (newFilters: IssueFilterState) => void;
  totalIssuesCount: number;
  filteredIssuesCount: number;
  isHeatmapMode: boolean;
  onToggleHeatmap: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  totalIssuesCount,
  filteredIssuesCount,
  isHeatmapMode,
  onToggleHeatmap,
  isOpenMobile,
  onCloseMobile,
}) => {
  const categories: { key: string; label: string; icon: string }[] = [
    { key: 'all', label: 'All Categories', icon: '🌐' },
    { key: 'pothole', label: 'Roads & Potholes', icon: '🚧' },
    { key: 'streetlight', label: 'Streetlights', icon: '💡' },
    { key: 'garbage', label: 'Garbage & Waste', icon: '🗑' },
    { key: 'drainage', label: 'Blocked Drainage', icon: '🌊' },
    { key: 'water', label: 'Water Leakage', icon: '💧' },
    { key: 'footpath', label: 'Damaged Footpaths', icon: '🚶' },
    { key: 'traffic', label: 'Traffic Signals', icon: '🚦' },
    { key: 'other', label: 'Other Hazards', icon: '⚠' },
  ];

  const statuses = [
    { key: 'all', label: 'All Statuses' },
    { key: 'reported', label: 'Reported' },
    { key: 'verified', label: 'Verified' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'resolved', label: 'Resolved' },
  ];

  const priorities = [
    { key: 'all', label: 'All Priorities' },
    { key: 'CRITICAL', label: 'Critical', color: 'text-red-400' },
    { key: 'HIGH', label: 'High Priority', color: 'text-amber-400' },
    { key: 'MEDIUM', label: 'Medium', color: 'text-yellow-400' },
    { key: 'LOW', label: 'Low', color: 'text-emerald-400' },
  ];

  const timeRanges: { key: IssueFilterState['timeRange']; label: string }[] = [
    { key: 'all', label: 'All Time' },
    { key: '24h', label: 'Last 24 Hours' },
    { key: '7d', label: 'Last 7 Days' },
    { key: '30d', label: 'Last 30 Days' },
  ];

  const handleReset = () => {
    onFilterChange({
      category: 'all',
      status: 'all',
      priority: 'all',
      timeRange: 'all',
      searchQuery: '',
    });
  };

  const hasActiveFilters =
    filters.category !== 'all' ||
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.timeRange !== 'all';

  const content = (
    <div className="flex flex-col h-full bg-slate-900/90 backdrop-blur-md border-r border-slate-800 text-slate-200 select-none">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-400" />
          <h2 className="text-xs uppercase tracking-wider font-bold text-white">Civic Filters</h2>
        </div>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Showing count indicator */}
      <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400">Displaying:</span>
        <span className="font-semibold text-white">
          <strong className="text-indigo-400">{filteredIssuesCount}</strong> of {totalIssuesCount} issues
        </span>
      </div>

      {/* Layer View Mode (Normal vs Heatmap) */}
      <div className="p-4 border-b border-slate-800/80">
        <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
          Map Visualization
        </span>
        <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => isHeatmapMode && onToggleHeatmap()}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              !isHeatmapMode
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pin Markers</span>
          </button>
          <button
            onClick={() => !isHeatmapMode && onToggleHeatmap()}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              isHeatmapMode
                ? 'bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Density Heatmap</span>
          </button>
        </div>
      </div>

      {/* Filter Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {/* Category Filter */}
        <div>
          <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
            Infrastructure Category
          </span>
          <div className="space-y-1">
            {categories.map((cat) => {
              const active = filters.category === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => onFilterChange({ ...filters, category: cat.key })}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                    active
                      ? 'bg-indigo-600/20 text-white border border-indigo-500/40 font-semibold'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cat.icon}</span>
                    <span>{cat.label}</span>
                  </div>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
            Resolution Status
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {statuses.map((st) => {
              const active = filters.status === st.key;
              return (
                <button
                  key={st.key}
                  onClick={() => onFilterChange({ ...filters, status: st.key })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                    active
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-white font-semibold'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Priority Filter */}
        <div>
          <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
            Community Priority
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {priorities.map((p) => {
              const active = filters.priority === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => onFilterChange({ ...filters, priority: p.key })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                    active
                      ? 'bg-slate-800 border-indigo-500 text-white font-semibold'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Filter */}
        <div>
          <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
            Time Reported
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {timeRanges.map((tr) => {
              const active = filters.timeRange === tr.key;
              return (
                <button
                  key={tr.key}
                  onClick={() => onFilterChange({ ...filters, timeRange: tr.key })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border text-center transition-all ${
                    active
                      ? 'bg-slate-800 border-indigo-500 text-white font-semibold'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {tr.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Panel */}
      <aside className="hidden lg:block w-72 h-full z-10 shrink-0 shadow-2xl">
        {content}
      </aside>

      {/* Mobile Drawer / Bottom Sheet */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-40 lg:hidden flex flex-col justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full h-[78vh] bg-slate-900 rounded-t-2xl overflow-hidden shadow-2xl flex flex-col border-t border-slate-800">
            <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-950/60">
              <span className="text-xs font-bold text-slate-300">Filter Civic Reports</span>
              <button
                onClick={onCloseMobile}
                className="px-3 py-1 bg-indigo-600 rounded-lg text-xs font-bold text-white"
              >
                Apply & View Map
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{content}</div>
          </div>
        </div>
      )}
    </>
  );
};
