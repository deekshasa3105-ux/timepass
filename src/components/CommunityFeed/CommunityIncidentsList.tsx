import React, { useState, useMemo } from 'react';
import { CivicIssue, IssueCategory, IssueStatus } from '../../types/issue';
import { useAuth } from '../../context/AuthContext';
import { getCategoryMeta, getPriorityBadgeColor, getStatusMeta } from '../../utils/priority';
import { formatDate } from '../../utils/formatDate';
import {
  upvoteIssue,
  getLocalReportIds,
  updateIssueStatus,
  markIssueAsNotSpam,
  markIssueAsSpam,
  deleteSpamIssue,
} from '../../firebase/firestore';
import { batchEvaluateSpam } from '../../services/spamFilterService';
import {
  Search,
  MapPin,
  ThumbsUp,
  Clock,
  CheckCircle2,
  Flame,
  User as UserIcon,
  Users,
  Camera,
  ArrowRight,
  Building2,
  HardHat,
  Briefcase,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Bot,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { RenovationProposalModal } from '../IssueDetails/RenovationProposalModal';

interface CommunityIncidentsListProps {
  issues: CivicIssue[];
  onSelectIssueOnMap: (issue: CivicIssue) => void;
  onOpenIssueDetails: (issue: CivicIssue) => void;
  onOpenReportModal: () => void;
  activeTab?: 'all' | 'others' | 'mine' | 'spam';
}

export const CommunityIncidentsList: React.FC<CommunityIncidentsListProps> = ({
  issues,
  onSelectIssueOnMap,
  onOpenIssueDetails,
  onOpenReportModal,
  activeTab = 'all',
}) => {
  const { user, isAdmin, isCompany, companyName } = useAuth();
  const [tab, setTab] = useState<'all' | 'others' | 'mine' | 'top_upvoted' | 'appointed_to_me' | 'my_bids' | 'spam'>(
    isAdmin && activeTab === 'spam' ? 'spam' : activeTab === 'spam' ? 'all' : activeTab
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [votedMap, setVotedMap] = useState<Record<string, boolean>>({});
  const [votingMap, setVotingMap] = useState<Record<string, boolean>>({});
  const [proposalModalIssue, setProposalModalIssue] = useState<CivicIssue | null>(null);

  // Spam moderation action states
  const [processingSpamId, setProcessingSpamId] = useState<string | null>(null);
  const [isScanningSpam, setIsScanningSpam] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{ title: string; subtitle?: string; type: 'success' | 'info' | 'warn' } | null>(null);

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

  // Separate non-spam and spam issues
  const nonSpamIssues = useMemo(() => issues.filter((i) => !i.isSpam), [issues]);
  const spamIssues = useMemo(() => issues.filter((i) => Boolean(i.isSpam)), [issues]);

  // Company appointed issues (strictly non-spam)
  const myAppointedIssues = useMemo(() => {
    if (!isCompany) return [];
    return nonSpamIssues.filter((i) => {
      const matchId = i.appointedCompanyId && currentUserId && i.appointedCompanyId === currentUserId;
      const matchName = companyName && i.appointedCompanyName && i.appointedCompanyName.toLowerCase() === companyName.toLowerCase();
      return matchId || matchName;
    });
  }, [nonSpamIssues, isCompany, currentUserId, companyName]);

  // Company bid issues (strictly non-spam)
  const myBidIssues = useMemo(() => {
    if (!isCompany) return [];
    return nonSpamIssues.filter((i) => {
      return i.proposals?.some((p) => {
        const matchId = currentUserId && p.companyId === currentUserId;
        const matchName = companyName && p.companyName.toLowerCase() === companyName.toLowerCase();
        return matchId || matchName;
      });
    });
  }, [nonSpamIssues, isCompany, currentUserId, companyName]);

  // Counts for tabs (strictly non-spam for citizen tabs)
  const reportsByOthers = useMemo(() => {
    const localIds = getLocalReportIds();
    return nonSpamIssues.filter((i) => {
      const isMine =
        (currentUserId && i.reportedBy === currentUserId) ||
        (Boolean(user?.email) && i.reporterEmail === user?.email) ||
        localIds.includes(i.id);
      return !isMine;
    });
  }, [nonSpamIssues, currentUserId, user?.email]);

  const reportsByMe = useMemo(() => {
    const localIds = getLocalReportIds();
    return nonSpamIssues.filter((i) => {
      return (
        (currentUserId && i.reportedBy === currentUserId) ||
        (Boolean(user?.email) && i.reporterEmail === user?.email) ||
        localIds.includes(i.id)
      );
    });
  }, [nonSpamIssues, currentUserId, user?.email]);

  // If a non-admin is somehow on 'spam', reset to 'all'
  const activeTabSafe = tab === 'spam' && !isAdmin ? 'all' : tab;

  // Filtered issues based on current tab
  const filteredIssues = useMemo(() => {
    const localIds = getLocalReportIds();

    // Source pool depends on tab
    const sourcePool = activeTabSafe === 'spam' ? spamIssues : nonSpamIssues;

    return sourcePool
      .filter((issue) => {
        // Tab-specific filters
        if (activeTabSafe === 'others') {
          const isMine =
            (currentUserId && issue.reportedBy === currentUserId) ||
            (Boolean(user?.email) && issue.reporterEmail === user?.email) ||
            localIds.includes(issue.id);
          if (isMine) return false;
        }

        if (activeTabSafe === 'mine') {
          const isMine =
            (currentUserId && issue.reportedBy === currentUserId) ||
            (Boolean(user?.email) && issue.reporterEmail === user?.email) ||
            localIds.includes(issue.id);
          if (!isMine) return false;
        }

        if (activeTabSafe === 'appointed_to_me') {
          const isAppointed =
            (currentUserId && issue.appointedCompanyId === currentUserId) ||
            (companyName && issue.appointedCompanyName?.toLowerCase() === companyName.toLowerCase());
          if (!isAppointed) return false;
        }

        if (activeTabSafe === 'my_bids') {
          const hasBid = issue.proposals?.some((p) => {
            return (
              (currentUserId && p.companyId === currentUserId) ||
              (companyName && p.companyName.toLowerCase() === companyName.toLowerCase())
            );
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
          const spamReasonMatch = issue.spamReason?.toLowerCase().includes(q);
          if (
            !titleMatch &&
            !descMatch &&
            !addrMatch &&
            !reporterMatch &&
            !wardMatch &&
            !companyMatch &&
            !spamReasonMatch
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (activeTabSafe === 'top_upvoted') {
          return (b.upvotes || 0) - (a.upvotes || 0);
        }
        const timeA = a.createdAt?.getTime ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const timeB = b.createdAt?.getTime ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });
  }, [
    activeTabSafe,
    nonSpamIssues,
    spamIssues,
    selectedCategory,
    selectedStatus,
    searchQuery,
    currentUserId,
    companyName,
    user?.email,
  ]);

  const showBanner = (title: string, subtitle?: string, type: 'success' | 'info' | 'warn' = 'info') => {
    setBannerNotice({ title, subtitle, type });
    setTimeout(() => {
      setBannerNotice(null);
    }, 5500);
  };

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

  // Municipal Authority: Report an incident as NOT SPAM (Restores to public feed)
  const handleReportNotSpam = async (issue: CivicIssue, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;

    setProcessingSpamId(issue.id);
    try {
      const municipalOfficer = user?.displayName || user?.email || 'Municipal Authority';
      await markIssueAsNotSpam(issue.id, municipalOfficer);
      try {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.7 },
        });
      } catch {}
      showBanner(
        'Report Verified & Restored (Not Spam)',
        `"${issue.title}" has been unflagged from spam and is now visible on the public community map.`,
        'success'
      );
    } catch (err: any) {
      console.error('Error reporting as not spam:', err);
      showBanner('Action Failed', err?.message || 'Could not unflag incident', 'warn');
    } finally {
      setProcessingSpamId(null);
    }
  };

  // Municipal Authority: Manually flag an issue as spam
  const handleManualMarkSpam = async (issue: CivicIssue, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;

    setProcessingSpamId(issue.id);
    try {
      const municipalOfficer = user?.displayName || user?.email || 'Municipal Authority';
      await markIssueAsSpam(issue.id, 'Manually flagged as spam / nonsensical by Municipal Authority', municipalOfficer);
      showBanner(
        'Moved to Municipal Spam Section',
        `"${issue.title}" has been moved to the spam section and hidden from public citizens.`,
        'info'
      );
    } catch (err: any) {
      console.error('Error flagging as spam:', err);
      showBanner('Action Failed', err?.message || 'Could not flag as spam', 'warn');
    } finally {
      setProcessingSpamId(null);
    }
  };

  // Municipal Authority: Permanently purge spam issue document
  const handleDeleteSpamReport = async (issue: CivicIssue, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) return;

    if (!window.confirm(`Permanently delete this spam incident record: "${issue.title}"?`)) {
      return;
    }

    setProcessingSpamId(issue.id);
    try {
      await deleteSpamIssue(issue.id);
      showBanner('Spam Record Deleted', 'The junk incident report was permanently removed.', 'info');
    } catch (err: any) {
      console.error('Error deleting spam:', err);
      showBanner('Delete Failed', err?.message || 'Could not delete document', 'warn');
    } finally {
      setProcessingSpamId(null);
    }
  };

  // Municipal Authority: Run automated batch AI scan across all active reports
  const handleRunBatchAIScan = async () => {
    if (!isAdmin || isScanningSpam) return;

    setIsScanningSpam(true);
    showBanner('AI Spam Shield Scanning...', 'Analyzing all incident texts for incoherent text, keyboard mash, and spam.', 'info');

    try {
      const results = await batchEvaluateSpam(
        nonSpamIssues.map((iss) => ({
          id: iss.id,
          title: iss.title,
          description: iss.description,
          category: iss.category,
          address: iss.address,
        }))
      );

      let newlyFlaggedCount = 0;
      for (const res of results) {
        if (res.isSpam) {
          await markIssueAsSpam(res.id, res.reason, 'Automated AI Filtration Shield');
          newlyFlaggedCount++;
        }
      }

      if (newlyFlaggedCount > 0) {
        showBanner(
          `AI Spam Scan Complete: ${newlyFlaggedCount} Spam Reports Flagged`,
          `${newlyFlaggedCount} incoherent reports were cleared out and moved to the Municipal Spam Section.`,
          'warn'
        );
      } else {
        showBanner(
          'AI Spam Scan Complete: 0 Spam Reports Found',
          'All checked community reports contain coherent civic text.',
          'success'
        );
      }
    } catch (err: any) {
      console.error('Batch scan error:', err);
      showBanner('Scan Interrupted', err?.message || 'Error occurred during AI scan', 'warn');
    } finally {
      setIsScanningSpam(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Banner Notifications */}
      {bannerNotice && (
        <div
          className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-3 border-b animate-fadeIn shrink-0 ${
            bannerNotice.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : bannerNotice.type === 'warn'
              ? 'bg-amber-950/90 text-amber-200 border-amber-500/40'
              : 'bg-indigo-950/90 text-indigo-200 border-indigo-500/40'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {bannerNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : bannerNotice.type === 'warn' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
            )}
            <div className="min-w-0">
              <span className="font-bold mr-1.5">{bannerNotice.title}:</span>
              <span className="text-slate-300 truncate">{bannerNotice.subtitle}</span>
            </div>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-slate-400 hover:text-white px-2 py-0.5 rounded text-xs shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Filter and Search Bar */}
      <div className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-4 sm:px-6 py-4 space-y-3 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {activeTabSafe === 'spam' ? (
                <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
              ) : (
                <Users className="w-5 h-5 text-indigo-400" />
              )}
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {activeTabSafe === 'spam'
                  ? 'Municipal Spam Moderation Section (AI Filtered)'
                  : 'Community Incidents & Grievances Directory'}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  activeTabSafe === 'spam'
                    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                }`}
              >
                {filteredIssues.length} {filteredIssues.length === 1 ? 'Report' : 'Reports'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTabSafe === 'spam'
                ? 'Review AI-flagged spam reports whose text did not make sense. Strictly restricted to verified municipal authorities.'
                : 'Browse, corroborate, and track public municipal issues reported by citizens across all city wards.'}
            </p>
          </div>

          {/* Action Buttons: Report + Municipal Spam Shortcut */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Dedicated Municipal Spam Section Button (Strictly Municipal only) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setTab(activeTabSafe === 'spam' ? 'all' : 'spam')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                  activeTabSafe === 'spam'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 shadow-rose-600/30 ring-2 ring-rose-500/40'
                    : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white border border-rose-500/40'
                }`}
                title="Municipal Spam Section: View all AI filtered spam and report as not spam"
              >
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>
                  {activeTabSafe === 'spam' ? 'Exit Spam View' : 'Municipal Spam Section'}
                </span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-900/80 text-rose-200 border border-rose-500/50">
                  {spamIssues.length}
                </span>
              </button>
            )}

            {/* Quick Report Button */}
            <button
              onClick={onOpenReportModal}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>+ Report An Incident</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Main Scope Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTabSafe === 'all'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Reports ({nonSpamIssues.length})
            </button>

            <button
              onClick={() => setTab('others')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTabSafe === 'others'
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
                  activeTabSafe === 'mine'
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
                    activeTabSafe === 'appointed_to_me'
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
                    activeTabSafe === 'my_bids'
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
                activeTabSafe === 'top_upvoted'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Most Upvoted</span>
            </button>

            {/* SEPARATE BUTTON UNDER COMMUNITY: Strictly Municipal Authority Exclusive */}
            {isAdmin && (
              <button
                onClick={() => setTab('spam')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTabSafe === 'spam'
                    ? 'bg-rose-600 text-white shadow font-bold ring-1 ring-rose-400'
                    : 'text-rose-400 hover:text-rose-200 hover:bg-rose-950/40'
                }`}
                title="Municipal Spam Section: View AI filtered spam incidents"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Spam Section ({spamIssues.length})</span>
                {spamIssues.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                )}
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTabSafe === 'spam' ? 'Search spam by title, reason...' : 'Search by title, address, reporter...'}
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

      {/* Municipal Spam Moderation Banner (Only shown when activeTab is spam) */}
      {isAdmin && activeTabSafe === 'spam' && (
        <div className="bg-rose-950/40 border-b border-rose-900/60 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-900/50 border border-rose-500/40 text-rose-300 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white">
                  Automated AI Filtration Shield
                </span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Municipal Restrict Mode
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                Incident reports whose text did not make sense (keyboard mashing, non-words, or gibberish) were cleared out of the public community map. Click <strong className="text-emerald-300">"Report as Not Spam"</strong> to restore any legitimate report.
              </p>
            </div>
          </div>

          {/* Batch AI Scan Action Button */}
          <button
            type="button"
            onClick={handleRunBatchAIScan}
            disabled={isScanningSpam}
            className="px-3.5 py-2 bg-gradient-to-r from-rose-700 to-rose-600 hover:from-rose-600 hover:to-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-950 flex items-center gap-1.5 transition-all self-start sm:self-auto shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanningSpam ? 'animate-spin' : ''}`} />
            <span>{isScanningSpam ? 'Scanning Active Reports...' : 'Run AI Scan on All Incidents'}</span>
          </button>
        </div>
      )}

      {/* Main Content: Card Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {filteredIssues.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-center p-6 bg-slate-900/40 border border-slate-800/80 rounded-2xl max-w-lg mx-auto mt-8">
            {activeTabSafe === 'spam' ? (
              <>
                <ShieldCheck className="w-12 h-12 text-emerald-400 mb-3" />
                <h3 className="text-sm font-bold text-white">No Spam Reports Detected</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  The automated AI filtration shield has verified all current incident reports. No nonsensical text or gibberish reports are currently pending in the spam section.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunBatchAIScan}
                    disabled={isScanningSpam}
                    className="px-3.5 py-1.5 bg-rose-900/60 hover:bg-rose-800 border border-rose-500/40 text-xs font-semibold text-rose-200 rounded-xl flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanningSpam ? 'animate-spin' : ''}`} />
                    <span>Run AI Spam Scan</span>
                  </button>
                  <button
                    onClick={() => setTab('all')}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl"
                  >
                    View All Active Reports
                  </button>
                </div>
              </>
            ) : (
              <>
                <Users className="w-12 h-12 text-slate-600 mb-3" />
                <h3 className="text-sm font-bold text-white">No Incidents Found</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
                    ? 'No community reports match your current filters. Try resetting search or changing category.'
                    : activeTabSafe === 'mine'
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
              </>
            )}
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
              const isSpam = Boolean(issue.isSpam);
              const isProcessing = processingSpamId === issue.id;

              return (
                <div
                  key={issue.id}
                  onClick={() => onOpenIssueDetails(issue)}
                  className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 cursor-pointer group border ${
                    isSpam
                      ? 'bg-slate-900/90 hover:bg-slate-900 border-rose-500/40 hover:border-rose-400 shadow-lg shadow-rose-950/20'
                      : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5'
                  }`}
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
                                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            Reported {formatDate(issue.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Status / Spam Badge */}
                      {isSpam ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0">
                          <ShieldAlert className="w-3 h-3 text-rose-400" />
                          <span>AI Spam Filtered</span>
                        </span>
                      ) : isAdmin ? (
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

                    {/* AI SPAM ANALYSIS CARD BANNER (Displayed prominently on spam reports) */}
                    {isSpam && (
                      <div
                        className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-1.5 text-xs text-rose-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-rose-300">
                          <div className="flex items-center gap-1">
                            <Bot className="w-3.5 h-3.5 text-rose-400" />
                            <span>AI Filtration Reason</span>
                          </div>
                          {issue.spamConfidence && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-900/60 border border-rose-500/40 text-rose-300 font-semibold">
                              {Math.round(issue.spamConfidence * 100)}% Confidence
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-rose-100 font-medium leading-relaxed bg-black/30 p-2 rounded-lg border border-rose-500/20">
                          "{issue.spamReason || 'Text does not make sense (incoherent keyboard mashing / gibberish)'}"
                        </p>
                      </div>
                    )}

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
                      <h3
                        className={`text-sm sm:text-base font-bold transition-colors line-clamp-1 leading-snug ${
                          isSpam ? 'text-rose-100 group-hover:text-rose-300 font-mono' : 'text-white group-hover:text-indigo-300'
                        }`}
                      >
                        {issue.title}
                      </h3>
                      <p
                        className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                          isSpam ? 'text-rose-300/80 font-mono bg-rose-950/20 p-1.5 rounded-lg border border-rose-900/30' : 'text-slate-400'
                        }`}
                      >
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

                    {/* Company Renovation Option (Strictly non-spam) */}
                    {isCompany && !isSpam && (
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
                                    Proposal:{' '}
                                    {myCompProposal.status === 'accepted'
                                      ? 'Accepted ✓'
                                      : myCompProposal.status === 'rejected'
                                      ? 'Closed'
                                      : 'Under Review'}
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
                  </div>

                  {/* Card Footer: Spam Actions OR Normal Upvote + Map Actions */}
                  <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    {isSpam ? (
                      /* MUNICIPAL SPAM MODERATION ACTIONS */
                      isAdmin ? (
                        <div
                          className="w-full flex items-center justify-between gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* PRIMARY ACTION: REPORT AS NOT SPAM */}
                          <button
                            type="button"
                            onClick={(e) => handleReportNotSpam(issue, e)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/40 flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                            title="Report this incident as Not Spam to restore it to the community map"
                          >
                            <CheckCircle2 className="w-4 h-4 text-white" />
                            <span>{isProcessing ? 'Restoring...' : 'Report as Not Spam'}</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            {/* Delete Permanently */}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSpamReport(issue, e)}
                              disabled={isProcessing}
                              className="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 border border-slate-700/60 hover:border-rose-500/40 rounded-xl transition-colors cursor-pointer"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* View Full Details */}
                            <button
                              type="button"
                              onClick={() => onOpenIssueDetails(issue)}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                              title="View complete details"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : null
                    ) : (
                      /* NORMAL CITIZEN ACTIONS */
                      <>
                        <div className="flex items-center gap-2">
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

                          {/* Municipal quick manual flag */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => handleManualMarkSpam(issue, e)}
                              disabled={isProcessing}
                              className="px-2 py-1 bg-slate-800/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-[10px] text-slate-400 hover:text-rose-300 rounded-lg flex items-center gap-1 transition-colors"
                              title="Municipal: Flag this incident as spam/gibberish"
                            >
                              <ShieldAlert className="w-3 h-3 text-rose-400" />
                              <span className="hidden sm:inline">Flag Spam</span>
                            </button>
                          )}
                        </div>

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
                      </>
                    )}
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
