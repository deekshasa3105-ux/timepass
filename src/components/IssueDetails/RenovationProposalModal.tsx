import React, { useState } from 'react';
import { CivicIssue, RenovationProposal } from '../../types/issue';
import { useAuth } from '../../context/AuthContext';
import { submitRenovationProposal } from '../../firebase/firestore';
import {
  X,
  Building2,
  HardHat,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Phone,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface RenovationProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  issue: CivicIssue;
  existingProposal?: RenovationProposal;
  onSuccess?: (proposal: RenovationProposal) => void;
  onToast?: (title: string, subtitle?: string) => void;
}

export const RenovationProposalModal: React.FC<RenovationProposalModalProps> = ({
  isOpen,
  onClose,
  issue,
  existingProposal,
  onSuccess,
  onToast,
}) => {
  const { user, isCompany, companyName } = useAuth();

  const [compName, setCompName] = useState(
    existingProposal?.companyName || companyName || user?.displayName || ''
  );
  const [email, setEmail] = useState(
    existingProposal?.contactEmail || user?.email || ''
  );
  const [phone, setPhone] = useState(existingProposal?.contactPhone || '');
  const [estimatedDays, setEstimatedDays] = useState<number>(
    existingProposal?.estimatedDays || 5
  );
  const [estimatedCost, setEstimatedCost] = useState(
    existingProposal?.estimatedCost || ''
  );
  const [scopeOfWork, setScopeOfWork] = useState(
    existingProposal?.scopeOfWork || ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = compName.trim();
    if (!cleanName) {
      setError('Please provide your official Company Name.');
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please provide a valid company contact email address.');
      return;
    }

    const cleanScope = scopeOfWork.trim();
    if (!cleanScope || cleanScope.length < 10) {
      setError('Please detail the scope of renovation work (at least 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const companyId = user?.uid || 'company_' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');

      const prop = await submitRenovationProposal(issue.id, {
        companyId,
        companyName: cleanName,
        contactEmail: cleanEmail,
        contactPhone: phone.trim() || undefined,
        estimatedDays: Number(estimatedDays) || 5,
        estimatedCost: estimatedCost.trim() || undefined,
        scopeOfWork: cleanScope,
      });

      try {
        confetti({
          particleCount: 35,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {}

      onToast?.(
        'Renovation Proposal Submitted',
        `Proposal from "${cleanName}" submitted to Municipal Authority for review.`
      );
      onSuccess?.(prop);
      onClose();
    } catch (err: any) {
      console.error('Proposal submission error:', err);
      setError(err?.message || 'Failed to submit proposal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh] my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-blue-950/40 via-slate-900 to-cyan-950/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Renovation Work Proposal</span>
                <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/40 font-semibold">
                  Contractor Bid
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">
                Incident: {issue.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Target Incident Summary Card */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Applying for Renovation On:
            </span>
            <div className="font-semibold text-white text-sm">{issue.title}</div>
            <div className="text-slate-400 text-xs flex items-center gap-2">
              <span>📍 {issue.address}</span>
              <span>•</span>
              <span>🏛 {issue.ward}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Company Name */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Your Company / Contractor Name <span className="text-cyan-400">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={compName}
                onChange={(e) => setCompName(e.target.value)}
                placeholder="e.g. Apex Civil Renovations Pvt Ltd"
                required
                className="w-full h-10 pl-10 pr-3 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              This name is presented to the Municipal Authority for contract appointment.
            </span>
          </div>

          {/* Contact Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Company Email <span className="text-cyan-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  required
                  className="w-full h-10 pl-9 pr-3 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Contact Phone <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full h-10 pl-9 pr-3 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Estimated Days & Estimated Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Estimated Work Duration <span className="text-cyan-400">*</span>
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={estimatedDays}
                  onChange={(e) => setEstimatedDays(Number(e.target.value))}
                  className="w-full h-10 pl-9 pr-3 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl text-xs text-white outline-none cursor-pointer"
                >
                  <option value={1} className="bg-slate-900">1 Day (Rapid Emergency Fix)</option>
                  <option value={2} className="bg-slate-900">2 Days</option>
                  <option value={3} className="bg-slate-900">3 Days (Fast-track)</option>
                  <option value={5} className="bg-slate-900">5 Days (Standard)</option>
                  <option value={7} className="bg-slate-900">7 Days (1 Week)</option>
                  <option value={14} className="bg-slate-900">14 Days (2 Weeks)</option>
                  <option value={30} className="bg-slate-900">30 Days (Major Civil Work)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Budget / Estimated Cost <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="e.g. ₹35,000 / $1,200"
                  className="w-full h-10 pl-9 pr-3 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Scope of Renovation Work */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Scope of Renovation & Repair Methodology <span className="text-cyan-400">*</span>
            </label>
            <textarea
              rows={3}
              value={scopeOfWork}
              onChange={(e) => setScopeOfWork(e.target.value)}
              placeholder="Describe repair methods, machinery, materials (e.g. 'Deploying asphalt roller and bitumen tack coat for full 4m x 2m pothole resurfacing with night shift crew to prevent traffic congestion')."
              required
              className="w-full p-3 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all leading-relaxed"
            />
          </div>

          {/* Submission Notice */}
          <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-xl text-[11px] text-blue-300/90 leading-relaxed flex items-start gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
            <span>
              Once submitted, your proposal will be visible to Municipal Authorities in their management console. If selected, your company and the appointed deadline will be displayed across the platform and in your top bar!
            </span>
          </div>

          {/* Footer Submit Button */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/30 flex items-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <HardHat className="w-4 h-4" />
                  <span>Submit Renovation Proposal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
