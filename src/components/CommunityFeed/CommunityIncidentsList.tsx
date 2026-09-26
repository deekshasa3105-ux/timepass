import React, { useState, useMemo } from 'react';
import { CivicIssue, IssueCategory, IssueStatus } from '../../types/issue';
import { useAuth } from '../../context/AuthContext';
import { getCategoryMeta, getPriorityBadgeColor, getStatusMeta } from '../../utils/priority';
import { formatDate } from '../../utils/formatDate';
import { upvoteIssue, hasUserVoted, getLocalReportIds, updateIssueStatus } from '../../firebase/firestore';
import {
  Search,
  Filter,
  MapPin,
  ThumbsUp,
  Clock,
  Building,
  CheckCircle2,
  ExternalLink,
  Flame,
  User as UserIcon,
  Users,
  Sparkles,
  Camera,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building2,
  HardHat,
  Briefcase,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { RenovationProposalModal } from '../IssueDetails/RenovationProposalModal';

interface CommunityIncidentsListProps {
  issues: CivicIssue[];
  onSelectIssueOnMap: (issue: CivicIssue) => void;
  onOpenIssueDetails: (issue: CivicIssue) => void;
  onOpenReportModal: () => void;
  activeTab?: 'all' | 'others' | 'mine';
}

export const CommunityIncidentsList: React.FC<CommunityIncidentsListProps> = ({
  issues,
  onSelectIssueOnMap,
  onOpenIssueDetails,
  onOpenReportModal,
  activeTab = 'all',
}) => {
  const { user, isAdmin, isCompany, companyName } = useAuth();
  const [tab, setTab] = useState<'all' | 'others' | 'mine' | 'top_upvoted' | 'appointed_to_me' | 'my_bids'>(activeTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [votedMap, setVotedMap] = useState<Record<string, boolean>>({});
  const [votingMap, setVotingMap] = useState<Record<string, boolean>>({});
  const [proposalModalIssue, setProposalModalIssue] = useState<CivicIssue | null>(null);

  const currentUserId = user?.uid;

  // Categories list
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

  // Company appointed issues
  const myAppointedIssues = useMemo(() => {
    if (!isCompany) return [];
    return issues.filter((i) => {
      const matchId = i.appointedCompanyId && currentUserId && i.appointedCompanyId === currentUserId;
      const matchName = companyName && i.appointedCompanyName && i.appointedCompanyName.toLowerCase() === companyName.toLowerCase();
      return matchId || matchName;
    });
  }, [issues, isCompany, currentUserId, companyName]);

  // Company bid issues
  const myBidIssues = useMemo(() => {
    if (!isCompany) return [];
    return issues.filter((i) => {
      return i.proposals?.some((p) => {
        const matchId = currentUserId && p.companyId === currentUserId;
        const matchName = companyName && p.companyName.toLowerCase() === companyName.toLowerCase();
        return matchId || matchName;
      });
    });
  }, [issues, isCompany, currentUserId, companyName]);

  // Counts for tabs
  const reportsByOthers = useMemo(() => {
    const localIds = getLocalReportIds();
    return issues.filter((i) => {
      const isMine = (currentUserId && i.reportedBy === currentUserId) ||
        (Boolean(user?.email) && i.reporterEmail === user?.email) ||
        localIds.includes(i.id);
      return !isMine;
    });
  }, [issues, currentUserId, user?.email]);

  const reportsByMe = useMemo(() => {
    const localIds = getLocalReportIds();
    return issues.filter((i) => {
      return (currentUserId && i.reportedBy === currentUserId) ||
        (Boolean(user?.email) && i.reporterEmail === user?.email) ||
        localIds.includes(i.id);
    });
  }, [issues, currentUserId, user?.email]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    const localIds = getLocalReportIds();
    return issues.filter((issue) => {
      // Tab filter
      const isMine = (currentUserId && issue.reportedBy === currentUserId) ||
        (Boolean(user?.email) && issue.reporterEmail === user?.email) ||
        localIds.includes(issue.id);

      if (tab === 'others' && isMine) {
        return false;
      }
      if (tab === 'mine') {
        if (!isMine) return false;
      }
      if (tab === 'appointed_to_me') {
        const isAppointed = (currentUserId && issue.appointedCompanyId === currentUserId) ||
          (companyName && issue.appointedCompanyName?.toLowerCase() === companyName.toLowerCase());
        if (!isAppointed) return false;
      }
      if (tab === 'my_bids') {
        const hasBid = issue.proposals?.some((p) => {
          return (currentUserId && p.companyId === currentUserId) ||
            (companyName && p.companyName.toLowerCase() === companyName.toLowerCase());
        });
        if (!hasBid) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && issue.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && issue.status !== selectedStatus) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = issue.title.toLowerCase().includes(q);
        const descMatch = issue.description?.toLowerCase().includes(q);
        const addrMatch = issue.address?.toLowerCase().includes(q);
        const reporterMatch = issue.reporterName?.toLowerCase().includes(q);
        const wardMatch = issue.ward?.toLowerCase().includes(q);
        const companyMatch = issue.appointedCompanyName?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !addrMatch && !reporterMatch && !wardMatch && !companyMatch) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (tab === 'top_upvoted') {
        return (b.upvotes || 0) - (a.upvotes || 0);
      }
      const timeA = a.createdAt?.getTime ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const timeB = b.createdAt?.getTime ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
  }, [issues, tab, selectedCategory, selectedStatus, searchQuery, currentUserId, companyName]);

  // Handle upvoting
  const handleUpvote = async (issueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (votedMap[issueId] || votingMap[issueId]) return;

    setVotingMap((prev) => ({ ...prev, [issueId]: true }));
    try {
      const success = await upvoteIssue(issueId);
      if (success) {
        setVotedMap((prev) => ({ ...prev, [issueId]: true }));
        try {
          confetti({
            particleCount: 25,
            spread: 40,
            origin: { y: 0.8 },
          });
        } catch {}
      }
    } catch (err) {
      console.warn('Upvote error:', err);
    } finally {
      setVotingMap((prev) => ({ ...prev, [issueId]: false }));
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Top Filter and Search Bar */}
      <div className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-4 sm:px-6 py-4 space-y-3 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Community Incidents & Grievances Directory
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {filteredIssues.length} {filteredIssues.length === 1 ? 'Report' : 'Reports'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Browse, corroborate, and track public municipal issues reported by citizens across all city wards
            </p>
          </div>

          {/* Quick Report Button */}
          <button
            onClick={onOpenReportModal}
            className="self-start md:self-auto px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>+ Report An Incident</span>
          </button>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Main Scope Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                tab === 'all'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Reports ({issues.length})
            </button>

            <button
              onClick={() => setTab('others')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                tab === 'others'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reported by Others ({reportsByOthers.length})</span>
            </button>

            {user && (
              <button
                onClick={() => setTab('mine')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  tab === 'mine'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>My Reports ({reportsByMe.length})</span>
              </button>
            )}

            {isCompany && (
              <>
                <button
                  onClick={() => setTab('appointed_to_me')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    tab === 'appointed_to_me'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow font-bold'
                      : 'text-emerald-400 hover:text-emerald-300'
                  }`}
                >
                  <HardHat className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Appointed Works ({myAppointedIssues.length})</span>
                </button>

                <button
                  onClick={() => setTab('my_bids')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    tab === 'my_bids'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow font-bold'
                      : 'text-cyan-400 hover:text-cyan-300'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Our Proposals ({myBidIssues.length})</span>
                </button>
              </>
            )}

            <button
              onClick={() => setTab('top_upvoted')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                tab === 'top_upvoted'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Most Upvoted</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, address, reporter..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Secondary Category & Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {/* Categories Horizontal Scroller */}
          <div className="flex items-center gap-1.5 shrink-0">
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelectedCategory(c.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 flex items-center gap-1 ${
                  selectedCategory === c.key
                    ? 'bg-indigo-600/30 border border-indigo-500 text-white font-semibold'
                    : 'bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          <div className="h-4 w-[1px] bg-slate-800 shrink-0 mx-1" />

          {/* Status Dropdown/Pills */}
          <div className="flex items-center gap-1 shrink-0">
            {statuses.map((s) => (
              <button
                key={s.key}
                onClick={() => setSelectedStatus(s.key)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  selectedStatus === s.key
                    ? 'bg-slate-800 text-indigo-400 border border-indigo-500/50'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content: Card Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {filteredIssues.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-center p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl max-w-lg mx-auto mt-8">
            <Users className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-sm font-bold text-white">No Incidents Found</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
                ? 'No community reports match your current filters. Try resetting search or changing category.'
                : tab === 'mine'
                ? 'You have not submitted any civic reports yet. Report a pothole, broken streetlight, or garbage dump to get started!'
                : 'No community incidents logged in this view yet.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setSelectedStatus('all');
                  setTab('all');
                }}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl"
              >
                Reset Filters
              </button>
              <button
                onClick={onOpenReportModal}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl shadow"
              >
                + Report New Issue
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredIssues.map((issue) => {
              const catMeta = getCategoryMeta(issue.category);
              const prioMeta = getPriorityBadgeColor(issue.priorityLevel);
              const statusMeta = getStatusMeta(issue.status);
              const isMyReport = currentUserId && issue.reportedBy === currentUserId;
              const hasVoted = votedMap[issue.id];
              const isVoting = votingMap[issue.id];

              return (
                <div
                  key={issue.id}
                  onClick={() => onOpenIssueDetails(issue)}
                  className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/5 cursor-pointer group"
                >
                  <div className="space-y-3">
                    {/* Reporter Identification Header */}
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {issue.reporterPhotoUrl ? (
                          <img
                            src={issue.reporterPhotoUrl}
                            alt={issue.reporterName || 'Citizen'}
                            className="w-7 h-7 rounded-full object-cover ring-1 ring-indigo-500/50 shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs shrink-0">
                            {issue.reporterName?.charAt(0).toUpperCase() || 'C'}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-200 text-xs truncate">
                              {issue.reporterName || 'Community Resident'}
                            </span>
                            {isMyReport && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                You
                              </span>
                            )}
                            {issue.isGoogleVerified && (
                              <span title="Verified Google Account Reporter" className="inline-flex items-center">
                                <CheckCircle2
                                  className="w-3.5 h-3.5 text-indigo-400 shrink-0"
                                />
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            Reported {formatDate(issue.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Status pill or Admin Status Manager */}
                      {isAdmin ? (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] text-amber-300 font-bold flex items-center gap-1 bg-amber-950/80 border border-amber-500/50 px-2 py-0.5 rounded-full shadow-sm">
                            <span className="text-amber-400">Admin:</span>
                            <select
                              value={issue.status}
                              onChange={async (e) => {
                                const nextStatus = e.target.value as IssueStatus;
                                try {
                                  await updateIssueStatus(
                                    issue.id,
                                    nextStatus,
                                    'Status updated via Community Incidents List',
                                    user?.displayName || user?.email || 'Municipal Authority'
                                  );
                                } catch (err) {
                                  console.error('Failed to update status from card:', err);
                                }
                              }}
                              className="bg-transparent text-white text-[10px] font-bold outline-none cursor-pointer capitalize"
                            >
                              <option value="reported" className="bg-slate-900 text-slate-200">Reported</option>
                              <option value="verified" className="bg-slate-900 text-indigo-300">Verified</option>
                              <option value="in_progress" className="bg-slate-900 text-purple-300">In Progress</option>
                              <option value="resolved" className="bg-slate-900 text-emerald-300">Resolved</option>
                            </select>
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${statusMeta.bg} ${statusMeta.color}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                          {statusMeta.label}
                        </span>
                      )}
                    </div>

                    {/* Category & Priority Badge row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-800/90 text-slate-200 text-xs font-medium border border-slate-700/60">
                        <span>{catMeta.icon}</span>
                        <span>{catMeta.label}</span>
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${prioMeta.bg} ${prioMeta.text} ${prioMeta.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${prioMeta.dot}`} />
                        Priority: {issue.priorityLevel}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1 leading-snug">
                        {issue.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {issue.description || 'No additional details provided by resident.'}
                      </p>
                    </div>

                    {/* Attached Photo Thumbnail if available */}
                    {issue.photoUrl && (
                      <div className="relative rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950 h-32 w-full">
                        <img
                          src={issue.photoUrl}
                          alt={issue.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded text-[10px] text-slate-300 flex items-center gap-1 font-medium">
                          <Camera className="w-3 h-3" />
                          <span>Photo Attached</span>
                        </div>
                      </div>
                    )}

                    {/* Address & Ward */}
                    <div className="flex items-start gap-1.5 text-xs text-slate-400 pt-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span className="truncate">{issue.address}</span>
                    </div>

                    {/* Appointed Company Contractor Badge if assigned */}
                    {issue.appointedCompanyName && (
                      <div className="p-2 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between text-[11px] text-emerald-300">
                        <div className="flex items-center gap-1.5 font-bold">
                          <HardHat className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Appointed: {issue.appointedCompanyName}</span>
                        </div>
                        {issue.appointedDeadline && (
                          <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>Due: {issue.appointedDeadline}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Company Renovation Option (Apply / Put in Company Name) */}
                    {isCompany && (
                      <div className="pt-1.5" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const isAppointedToMyCompany =
                            (currentUserId && issue.appointedCompanyId === currentUserId) ||
                            (companyName && issue.appointedCompanyName?.toLowerCase() === companyName.toLowerCase());
                          const myCompProposal = issue.proposals?.find(
                            (p) =>
                              (currentUserId && p.companyId === currentUserId) ||
                              (companyName && p.companyName.toLowerCase() === companyName.toLowerCase())
                          );

                          if (isAppointedToMyCompany) {
                            return (
                              <div className="p-2 bg-gradient-to-r from-emerald-950/70 to-teal-950/70 border border-emerald-500/50 rounded-xl flex items-center justify-between text-xs text-emerald-300 font-bold shadow-md shadow-emerald-950/40">
                                <div className="flex items-center gap-1.5">
                                  <HardHat className="w-4 h-4 text-emerald-400" />
                                  <span>Contract Awarded to Your Company!</span>
                                </div>
                                <span className="text-[10px] text-amber-300 font-bold bg-black/60 px-2 py-0.5 rounded-full border border-amber-500/40">
                                  ⏰ Deadline: {issue.appointedDeadline || 'In Progress'}
                                </span>
                              </div>
                            );
                          }

                          if (myCompProposal) {
                            return (
                              <div className="flex items-center justify-between p-2 bg-cyan-950/30 border border-cyan-500/30 rounded-xl text-xs">
                                <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>
                                    Proposal: {myCompProposal.status === 'accepted' ? 'Accepted ✓' : myCompProposal.status === 'rejected' ? 'Closed' : 'Under Review'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setProposalModalIssue(issue)}
                                  className="text-[11px] text-cyan-400 hover:text-cyan-200 underline font-semibold cursor-pointer"
                                >
                                  Edit Proposal
                                </button>
                              </div>
                            );
                          }

                          return (
                            <button
                              type="button"
                              onClick={() => setProposalModalIssue(issue)}
                              className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                            >
                              <HardHat className="w-3.5 h-3.5" />
                              <span>Put in Company Name for Renovation Work</span>
                            </button>
                          );
                        })()}
                      </div>
                    )}

                    {/* Municipal Authority quick badge */}
                    {isAdmin && issue.proposals && issue.proposals.length > 0 && (
                      <div
                        className="flex items-center justify-between p-2 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs text-amber-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-[11px]">
                          <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                          <span>{issue.proposals.length} Contractor Proposal{issue.proposals.length === 1 ? '' : 's'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenIssueDetails(issue)}
                          className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          Review & Choose Company
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Upvote + View on Map Actions */}
                  <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    {/* Upvote Button */}
                    <button
                      type="button"
                      onClick={(e) => handleUpvote(issue.id, e)}
                      disabled={hasVoted || isVoting}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        hasVoted
                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80'
                      }`}
                      title="Corroborate this issue with an upvote"
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${hasVoted ? 'text-emerald-400' : ''}`} />
                      <span>{issue.upvotes || 0}</span>
                      <span className="text-[10px] hidden sm:inline">
                        {hasVoted ? 'Corroborated' : 'Upvote'}
                      </span>
                    </button>

                    {/* Action Buttons: View on Map & Details */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIssueOnMap(issue);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
                        title="Locate this report on the interactive map"
                      >
                        <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Map View</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenIssueDetails(issue)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="View complete issue timeline and details"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {proposalModalIssue && (
        <RenovationProposalModal
          isOpen={Boolean(proposalModalIssue)}
          onClose={() => setProposalModalIssue(null)}
          issue={proposalModalIssue}
          existingProposal={proposalModalIssue.proposals?.find(
            (p) =>
              (currentUserId && p.companyId === currentUserId) ||
              (companyName && p.companyName.toLowerCase() === companyName.toLowerCase())
          )}
          onSuccess={() => {
            setProposalModalIssue(null);
          }}
        />
      )}
    </div>
  );
};
