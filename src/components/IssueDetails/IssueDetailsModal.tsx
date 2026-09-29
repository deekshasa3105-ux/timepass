import React, { useState, useEffect } from 'react';
import { CivicIssue, IssueStatus, RenovationProposal } from '../../types/issue';
import { getCategoryMeta, getPriorityBadgeColor, getStatusMeta } from '../../utils/priority';
import { formatDate, formatPreciseTimestamp } from '../../utils/formatDate';
import {
  upvoteIssue,
  updateIssueStatus,
  hasUserVoted,
  appointCompanyProposal,
  markIssueAsNotSpam,
  markIssueAsSpam,
} from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  ThumbsUp,
  MapPin,
  Building,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  User,
  Lock,
  KeyRound,
  Sparkles,
  Building2,
  HardHat,
  Calendar,
  Check,
  Briefcase,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { SignInModal } from '../Auth/SignInModal';
import { RenovationProposalModal } from './RenovationProposalModal';

interface IssueDetailsModalProps {
  issue: CivicIssue;
  onClose: () => void;
  onIssueUpdated?: () => void;
  onToast?: (title: string, subtitle?: string) => void;
}

export const IssueDetailsModal: React.FC<IssueDetailsModalProps> = ({
  issue,
  onClose,
  onIssueUpdated,
  onToast,
}) => {
  const { user, isAdmin, isCompany, companyName } = useAuth();
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [statusUpdateMessage, setStatusUpdateMessage] = useState<string | null>(null);
  const [adminSignInModalOpen, setAdminSignInModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeImageEnlarged, setActiveImageEnlarged] = useState(false);

  // Company Proposal & Appointment States
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [appointingProposalId, setAppointingProposalId] = useState<string | null>(null);
  const [deadlineInput, setDeadlineInput] = useState('7 Days (Next Week)');
  const [appointingLoading, setAppointingLoading] = useState(false);

  const catMeta = getCategoryMeta(issue.category);
  const prioMeta = getPriorityBadgeColor(issue.priorityLevel);
  const statusMeta = getStatusMeta(issue.status);

  // Check if current logged in company has submitted a proposal
  const myProposal = issue.proposals?.find(
    (p) =>
      p.companyId === user?.uid ||
      (companyName && p.companyName.toLowerCase() === companyName.toLowerCase())
  );

  useEffect(() => {
    let isMounted = true;
    hasUserVoted(issue.id).then((voted) => {
      if (isMounted) setHasVoted(voted);
    });
    return () => {
      isMounted = false;
    };
  }, [issue.id]);

  const handleAppointCompany = async (proposal: RenovationProposal) => {
    if (!isAdmin) {
      setAdminSignInModalOpen(true);
      return;
    }
    const deadline = deadlineInput.trim() || '7 Days';
    setAppointingLoading(true);
    try {
      const officer = user?.displayName || user?.email || 'Municipal Authority';
      await appointCompanyProposal(
        issue.id,
        proposal.id,
        proposal.companyId,
        proposal.companyName,
        deadline,
        officer
      );
      setAppointingProposalId(null);
      setStatusUpdateMessage(`Contractor "${proposal.companyName}" successfully appointed with deadline: ${deadline}`);
      onIssueUpdated?.();
      onToast?.(
        'Company Appointed for Renovation',
        `"${proposal.companyName}" appointed for "${issue.title}". Deadline: ${deadline}`
      );
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {}
      setTimeout(() => setStatusUpdateMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to appoint company:', err);
      onToast?.('Appointment Failed', err?.message || 'Could not appoint company.');
    } finally {
      setAppointingLoading(false);
    }
  };

  const handleUpvote = async () => {
    if (hasVoted || voting) return;
    setVoting(true);
    try {
      const success = await upvoteIssue(issue.id);
      if (success) {
        setHasVoted(true);
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.8 },
          colors: ['#6366f1', '#a855f7', '#38bdf8'],
        });
      }
    } catch (err) {
      console.error('Failed to upvote:', err);
    } finally {
      setVoting(false);
    }
  };

  const handleStatusChange = async (newStatus: IssueStatus) => {
    if (!isAdmin) {
      setAdminSignInModalOpen(true);
      return;
    }
    if (updatingStatus || newStatus === issue.status) return;
    setUpdatingStatus(true);
    setStatusUpdateMessage(null);
    try {
      const officer = user?.displayName || user?.email || 'Municipal Authority';
      await updateIssueStatus(
        issue.id,
        newStatus,
        statusNote.trim() || undefined,
        officer
      );
      setStatusNote('');
      const statusTitle = newStatus.replace('_', ' ').toUpperCase();
      setStatusUpdateMessage(`Status successfully updated to ${statusTitle}`);
      onIssueUpdated?.();
      onToast?.(
        'Incident Status Transitioned',
        `"${issue.title}" updated to ${statusTitle} by ${officer}`
      );
      setTimeout(() => setStatusUpdateMessage(null), 3500);
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const timelineSteps: { status: IssueStatus; label: string }[] = [
    { status: 'reported', label: 'Reported' },
    { status: 'verified', label: 'Verified' },
    { status: 'in_progress', label: 'Work Started' },
    { status: 'resolved', label: 'Resolved' },
  ];

  const currentStepIndex = timelineSteps.findIndex((s) => s.status === issue.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-lg bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl p-1.5 bg-slate-800 rounded-xl">{catMeta.icon}</span>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                {catMeta.label}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusMeta.bg} ${statusMeta.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                  {statusMeta.label}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${prioMeta.bg} ${prioMeta.text} ${prioMeta.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${prioMeta.dot}`} />
                  Priority: {issue.priorityLevel}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar">
          {/* Issue Photo */}
          {issue.photoUrl && (
            <div className="relative group overflow-hidden rounded-xl border border-slate-800 bg-slate-950 max-h-56">
              <img
                src={issue.photoUrl}
                alt={issue.title}
                className="w-full h-48 sm:h-56 object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                onClick={() => setActiveImageEnlarged(!activeImageEnlarged)}
              />
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] text-slate-300 font-medium">
                Tap to inspect
              </div>
            </div>
          )}

          {/* AI Spam Shield Moderation Banner if flagged as spam */}
          {issue.isSpam && (
            <div className="p-4 bg-rose-950/60 border border-rose-500/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-200 shadow-lg shadow-rose-950/30">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">AI Spam Shield Flagged</span>
                    {issue.spamConfidence && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-900/80 text-rose-300 border border-rose-500/40">
                        {Math.round(issue.spamConfidence * 100)}% Confidence
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-rose-200 mt-1">
                    "{issue.spamReason || 'Text does not make sense (incoherent keyboard mashing / gibberish)'}"
                  </p>
                </div>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={async () => {
                    const officer = user?.displayName || user?.email || 'Municipal Authority';
                    await markIssueAsNotSpam(issue.id, officer);
                    onToast?.('Report Restored (Not Spam)', 'Incident restored to public community feed and live map.');
                    onIssueUpdated?.();
                    onClose();
                  }}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Report as Not Spam (Restore)</span>
                </button>
              )}
            </div>
          )}

          {/* Title & Description */}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
              {issue.title}
            </h2>
            <p className="mt-2 text-sm text-slate-300 whitespace-pre-line leading-relaxed">
              {issue.description || 'No detailed description provided by the resident.'}
            </p>
          </div>

          {/* Location details card */}
          <div className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2 text-xs">
            <div className="flex items-start gap-2 text-slate-300">
              <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Location: </span>
                <span>{issue.address}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-slate-400 pt-1 border-t border-slate-800/60">
              <div className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-cyan-400" />
                <span>{issue.ward}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Reported {formatDate(issue.createdAt)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <div className="flex items-center gap-2">
                {issue.reporterPhotoUrl ? (
                  <img
                    src={issue.reporterPhotoUrl}
                    alt={issue.reporterName || 'Citizen'}
                    className="w-5 h-5 rounded-full object-cover ring-1 ring-indigo-400 shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-[10px] shrink-0">
                    {issue.reporterName?.charAt(0).toUpperCase() || 'C'}
                  </div>
                )}
                <span className="text-slate-300 font-medium">
                  Reported by {issue.reporterName || 'Community Citizen'}
                </span>
                {issue.isGoogleVerified && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                    Verified
                  </span>
                )}
              </div>
              {user && issue.reportedBy === user.uid && (
                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Your Report
                </span>
              )}
            </div>
          </div>

          {/* Status Timeline */}
          <div>
            <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-2.5">
              Issue Lifecycle Progress
            </h3>
            <div className="relative flex items-center justify-between py-2 px-1">
              {/* Connecting line */}
              <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 z-0" />
              
              {timelineSteps.map((step, idx) => {
                const isPassedOrCurrent = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div key={step.status} className="relative z-10 flex flex-col items-center">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                        isCurrent
                          ? 'bg-indigo-600 border-indigo-400 text-white ring-4 ring-indigo-500/20 shadow-lg'
                          : isPassedOrCurrent
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-slate-900 border-slate-700 text-slate-500'
                      }`}
                    >
                      {isPassedOrCurrent ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] mt-1.5 font-medium whitespace-nowrap ${
                        isCurrent ? 'text-indigo-400 font-bold' : isPassedOrCurrent ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Timeline Notes if available */}
            {issue.timeline && issue.timeline.length > 0 && (
              <div className="mt-3 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Activity Log ({issue.timeline.length} events)
                </span>
                {issue.timeline.map((event, i) => (
                  <div key={i} className="text-[11px] text-slate-400 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <span className="text-slate-200 capitalize">{event.status.replace('_', ' ')}</span>
                      {event.note && <span className="text-slate-400">— {event.note}</span>}
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {formatPreciseTimestamp(event.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* RENOVATION WORK & COMPANY CONTRACTOR PROPOSALS */}
          {/* ========================================================= */}
          <div className="pt-3 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300">
                  <HardHat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Renovation Work & Company Proposals</span>
                    {issue.proposals && issue.proposals.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {issue.proposals.length} {issue.proposals.length === 1 ? 'Bid' : 'Bids'}
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Infrastructure repair bidding and municipal contractor appointments
                  </p>
                </div>
              </div>

              {/* Company Action: Apply button if user is a Company */}
              {isCompany && (
                <button
                  type="button"
                  onClick={() => setProposalModalOpen(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 flex items-center gap-1.5 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{myProposal ? 'Edit Proposal' : 'Apply for Renovation'}</span>
                </button>
              )}
            </div>

            {/* Appointed Contractor Banner (if appointed) */}
            {issue.appointedCompanyName && (
              <div className="p-3 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/30 border border-emerald-500/40 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                        Appointed Contractor
                      </span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30 font-bold">
                        Official Contract
                      </span>
                    </div>
                    <div className="font-extrabold text-sm text-white mt-0.5 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-cyan-400" />
                      <span>{issue.appointedCompanyName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-300 mt-1">
                      <span className="flex items-center gap-1 text-amber-300 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Completion Deadline: {issue.appointedDeadline || 'In Progress'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* COMPANY VIEW: My Proposal Card */}
            {isCompany && myProposal && (
              <div className="p-3 bg-cyan-950/25 border border-cyan-500/30 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Your Company Proposal: {myProposal.companyName}</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      myProposal.status === 'accepted'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : myProposal.status === 'rejected'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {myProposal.status === 'accepted'
                      ? '✓ Appointed'
                      : myProposal.status === 'rejected'
                      ? 'Closed'
                      : 'Pending Review'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  {myProposal.scopeOfWork}
                </p>
                <div className="flex items-center gap-4 text-[10px] text-slate-400">
                  <span>⏱ Duration: {myProposal.estimatedDays} Days</span>
                  {myProposal.estimatedCost && <span>💰 Cost: {myProposal.estimatedCost}</span>}
                  <span>📅 Submitted: {formatDate(myProposal.submittedAt)}</span>
                </div>
              </div>
            )}

            {/* MUNICIPAL AUTHORITY VIEW: Review All Company Proposals and Choose Company */}
            {isAdmin && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>Submitted Contractor Proposals ({issue.proposals?.length || 0})</span>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Authority Selection Console
                  </span>
                </div>

                {!issue.proposals || issue.proposals.length === 0 ? (
                  <div className="p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-2xl text-center text-xs text-slate-400">
                    No renovation proposals received from companies yet. Registered contractors can apply through the community portal.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto custom-scrollbar">
                    {issue.proposals.map((proposal) => {
                      const isChosen =
                        proposal.status === 'accepted' ||
                        issue.appointedCompanyId === proposal.companyId;
                      const isSettingDeadline = appointingProposalId === proposal.id;

                      return (
                        <div
                          key={proposal.id}
                          className={`p-3 rounded-2xl border transition-all text-xs space-y-2 ${
                            isChosen
                              ? 'bg-emerald-950/30 border-emerald-500/50 ring-1 ring-emerald-500/30'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-white flex items-center gap-1.5">
                                  <Building2 className="w-4 h-4 text-cyan-400" />
                                  <span>{proposal.companyName}</span>
                                </span>
                                {isChosen ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    ✓ Appointed Company
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                                    Proposal Pending
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-3 mt-1">
                                <span>📧 {proposal.contactEmail}</span>
                                {proposal.contactPhone && <span>📞 {proposal.contactPhone}</span>}
                              </div>
                            </div>

                            {/* Appoint / Choose button for Municipal Authority */}
                            {!isChosen && !isSettingDeadline && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAppointingProposalId(proposal.id);
                                  setDeadlineInput(`${proposal.estimatedDays || 7} Days (by ${new Date(Date.now() + (proposal.estimatedDays || 7) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`);
                                }}
                                className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 flex items-center gap-1 transition-all hover:scale-[1.02] cursor-pointer shrink-0"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Choose this Company</span>
                              </button>
                            )}
                          </div>

                          <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                            <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Proposed Scope of Work:</span>
                            {proposal.scopeOfWork}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1 font-medium text-slate-300">
                                <Clock className="w-3 h-3 text-cyan-400" />
                                <span>Timeline: {proposal.estimatedDays} Days</span>
                              </span>
                              {proposal.estimatedCost && (
                                <span className="font-semibold text-emerald-400">
                                  Estimate: {proposal.estimatedCost}
                                </span>
                              )}
                            </div>
                            <span>Submitted {formatDate(proposal.submittedAt)}</span>
                          </div>

                          {/* Inline Deadline Configuration Form when Municipal Authority chooses this company */}
                          {isSettingDeadline && (
                            <div className="mt-2 p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl space-y-2.5 animate-fadeIn">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-amber-300 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Set Work Completion Deadline for {proposal.companyName}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setAppointingProposalId(null)}
                                  className="text-slate-400 hover:text-white text-xs"
                                >
                                  Cancel
                                </button>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider block">
                                  Appointment Deadline:
                                </label>
                                <input
                                  type="text"
                                  value={deadlineInput}
                                  onChange={(e) => setDeadlineInput(e.target.value)}
                                  placeholder="e.g. 7 Days (Oct 10, 2026)"
                                  className="w-full h-8 px-2.5 bg-slate-950 border border-amber-500/60 focus:border-amber-400 rounded-lg text-xs text-white placeholder-slate-500 outline-none"
                                />
                                <div className="flex items-center gap-1.5 pt-1 overflow-x-auto text-[10px]">
                                  {[
                                    '3 Days',
                                    '5 Days',
                                    '7 Days',
                                    '14 Days (2 Weeks)',
                                    '30 Days (1 Month)',
                                  ].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() => setDeadlineInput(preset)}
                                      className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded text-slate-300 hover:text-white whitespace-nowrap cursor-pointer"
                                    >
                                      {preset}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setAppointingProposalId(null)}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={appointingLoading}
                                  onClick={() => handleAppointCompany(proposal)}
                                  className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-600/30 cursor-pointer disabled:opacity-50"
                                >
                                  {appointingLoading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Confirm Appointment & Set Deadline</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Admin / Civic Official Status Control */}
          <div className="pt-2 border-t border-slate-800/80">
            {isAdmin ? (
              <div className="p-3.5 bg-gradient-to-br from-amber-950/40 via-slate-900 to-indigo-950/40 border border-amber-500/40 rounded-2xl space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-amber-500/20 text-amber-400">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <span>Municipal Authority Console</span>
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-semibold border border-amber-500/30">
                          Active Officer
                        </span>
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Acting as: <strong className="text-white">{user?.displayName || user?.email}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {statusUpdateMessage && (
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{statusUpdateMessage}</span>
                  </div>
                )}

                {/* Optional Status Transition Note */}
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Official Action Note <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="e.g. BESCOM electrical line crew dispatched / Asphalt mix laid"
                    className="w-full h-8 px-2.5 bg-slate-950/80 border border-slate-700 focus:border-amber-500 rounded-lg text-xs text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>

                {/* Status Switcher Buttons */}
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Transition Incident Status:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        { id: 'reported', label: 'Reported', desc: 'Initial report', color: 'border-slate-600 hover:border-slate-400 text-slate-300' },
                        { id: 'verified', label: 'Verified', desc: 'Field verified', color: 'border-indigo-500/40 hover:border-indigo-400 text-indigo-300' },
                        { id: 'in_progress', label: 'In Progress', desc: 'Crew working', color: 'border-purple-500/40 hover:border-purple-400 text-purple-300' },
                        { id: 'resolved', label: 'Resolved', desc: 'Hazard fixed', color: 'border-emerald-500/40 hover:border-emerald-400 text-emerald-300' },
                      ] as { id: IssueStatus; label: string; desc: string; color: string }[]
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        disabled={updatingStatus || issue.status === st.id}
                        onClick={() => handleStatusChange(st.id)}
                        className={`px-2 py-2.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          issue.status === st.id
                            ? 'bg-amber-500/20 border-amber-400 text-white shadow-md ring-1 ring-amber-400/50 cursor-default'
                            : `bg-slate-950/70 hover:bg-slate-800 ${st.color}`
                        } disabled:opacity-50`}
                      >
                        <span className="text-[11px]">{st.label}</span>
                        <span className="text-[9px] text-slate-400 font-normal">
                          {issue.status === st.id ? 'Active Status ✓' : st.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0 mt-0.5 border border-amber-500/30">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 block text-xs flex items-center gap-1.5">
                      <span>Municipal Authority Status Controls</span>
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded border border-slate-700 font-semibold">
                        Special Admin Access
                      </span>
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Restricted to verified Municipal Officers & Ward Engineers to transition status (In Progress, Resolved).
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAdminSignInModalOpen(true)}
                  className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 border border-amber-500/40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-200" />
                  <span>Admin Sign In</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            <span className="text-white font-bold text-sm mr-1">{issue.upvotes || 0}</span>
            <span>community members corroborated this</span>
          </div>

          <button
            onClick={handleUpvote}
            disabled={hasVoted || voting}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all ${
              hasVoted
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <ThumbsUp className={`w-4 h-4 ${hasVoted ? 'text-emerald-400' : ''}`} />
            <span>{hasVoted ? 'Upvoted ✓' : '▲ Upvote Issue'}</span>
          </button>
        </div>
      </div>

      <SignInModal
        isOpen={adminSignInModalOpen}
        onClose={() => setAdminSignInModalOpen(false)}
        onToast={onToast}
        initialTab="admin"
      />

      <RenovationProposalModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
        issue={issue}
        existingProposal={myProposal}
        onToast={onToast}
        onSuccess={() => {
          onIssueUpdated?.();
        }}
      />
    </div>
  );
};
