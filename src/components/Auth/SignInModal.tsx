import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  KeyRound,
  Building2,
  HardHat,
  Phone,
  Wrench,
} from 'lucide-react';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast?: (title: string, subtitle?: string) => void;
  initialTab?: 'citizen' | 'admin' | 'company';
}

export const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  onClose,
  onToast,
  initialTab = 'citizen',
}) => {
  const {
    signInWithGoogle,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    signInWithSimpleEmail,
    signInAsAdmin,
    signInAsCompany,
  } = useAuth();

  const [portalType, setPortalType] = useState<'citizen' | 'admin' | 'company'>(initialTab);
  const [emailTab, setEmailTab] = useState<'simple' | 'password'>('simple');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Form states (Citizen)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form states (Admin) - inputs start empty without displaying or pre-filling credentials
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // Form states (Company)
  const [companyNameInput, setCompanyNameInput] = useState('');
  const [companyEmailInput, setCompanyEmailInput] = useState('');
  const [companyPhoneInput, setCompanyPhoneInput] = useState('');
  const [companySpecialty, setCompanySpecialty] = useState('Roads & Pothole Asphalt Work');
  const [companyPasswordInput, setCompanyPasswordInput] = useState('');
  const [loadingCompany, setLoadingCompany] = useState(false);

  // Status states
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firebaseOperationDisabled, setFirebaseOperationDisabled] = useState(false);

  // Sync initial tab when changed and clear errors/credentials
  useEffect(() => {
    if (initialTab) {
      setPortalType(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setAdminEmailInput('');
      setAdminPasswordInput('');
      setCompanyNameInput('');
      setCompanyEmailInput('');
      setCompanyPhoneInput('');
      setCompanyPasswordInput('');
      setError(null);
    }
  }, [isOpen]);

  // Prevent background scrolling and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoadingAdmin(true);

    try {
      const user = await signInAsAdmin(adminEmailInput, adminPasswordInput);
      onToast?.(
        'Municipal Authority Verified',
        `Logged in as Municipal Administrator. Incident status modification unlocked.`
      );
      onClose();
    } catch (err: any) {
      console.warn('Admin sign in error:', err);
      setError(err?.message || 'Administrator authentication failed. Please verify credentials.');
    } finally {
      setLoadingAdmin(false);
    }
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoadingCompany(true);

    const cleanName = companyNameInput.trim();
    const cleanEmail = companyEmailInput.trim();

    if (!cleanName) {
      setError('Please provide your registered Company Name.');
      setLoadingCompany(false);
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please provide a valid company contact email address.');
      setLoadingCompany(false);
      return;
    }

    try {
      const compUser = await signInAsCompany(cleanName, cleanEmail, companyPasswordInput.trim());
      onToast?.(
        'Company Access Verified',
        `Logged in as "${compUser.displayName}". You can now apply for renovation work in Community Incidents!`
      );
      onClose();
    } catch (err: any) {
      console.warn('Company login error:', err);
      setError(err?.message || 'Company authentication failed. Please check inputs.');
    } finally {
      setLoadingCompany(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoadingGoogle(true);
    try {
      const loggedUser = await signInWithGoogle();
      if (loggedUser) {
        onToast?.(
          'Signed in with Google',
          `Welcome, ${loggedUser.displayName || loggedUser.email}`
        );
        onClose();
      }
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      const msg = err?.message || '';
      if (!msg.includes('closed') && !msg.includes('dismissed')) {
        setError('Please allow browser popups or check your internet connection to sign in with Google.');
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleSimpleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address (e.g., name@gmail.com)');
      return;
    }

    setLoadingEmail(true);
    try {
      const user = await signInWithSimpleEmail(cleanEmail, displayName.trim());
      onToast?.('Signed in with Email', `Welcome, ${user.displayName || user.email}!`);
      onClose();
    } catch (err: any) {
      console.error('Simple email login error:', err);
      setError(err?.message || 'Failed to sign in with email. Please try again.');
    } finally {
      setLoadingEmail(false);
    }
  };

  const handlePasswordAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFirebaseOperationDisabled(false);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoadingEmail(true);
    try {
      if (authMode === 'signup') {
        const user = await signUpWithEmailPassword(cleanEmail, password, displayName.trim());
        if (user) {
          onToast?.('Account Created', `Welcome to CivicPulse, ${user.displayName || user.email}!`);
          onClose();
        }
      } else {
        const user = await signInWithEmailPassword(cleanEmail, password);
        if (user) {
          onToast?.('Signed In', `Welcome back, ${user.displayName || user.email}!`);
          onClose();
        }
      }
    } catch (err: any) {
      console.warn('Firebase email auth notice:', err);
      const code = err?.code || '';

      if (code === 'auth/operation-not-allowed') {
        setFirebaseOperationDisabled(true);
        setError(
          'Email/Password sign-in method is not enabled in Firebase Console. You can use the "Simple Email ID" tab to sign in immediately without a password!'
        );
      } else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setError('Invalid email or password. If you do not have an account yet, switch to "Create Account".');
      } else if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please switch to "Sign In".');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else {
        setError(err?.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoadingEmail(false);
    }
  };

  const fallbackToSimpleEmail = async () => {
    if (!email.trim() || !email.includes('@')) {
      setEmailTab('simple');
      return;
    }
    setLoadingEmail(true);
    try {
      const user = await signInWithSimpleEmail(email.trim(), displayName.trim());
      onToast?.('Signed in with Email ID', `Welcome, ${user.displayName || user.email}!`);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not complete sign in');
    } finally {
      setLoadingEmail(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-modalBackdrop"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-slate-900/95 border border-slate-700/80 rounded-3xl shadow-2xl shadow-black/80 overflow-hidden animate-modalContent backdrop-blur-2xl ring-1 ring-white/10 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative ambient glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative p-6 pb-5 border-b border-slate-800/80 bg-gradient-to-b from-indigo-950/40 via-slate-900/40 to-transparent">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Sign In to CivicPulse
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Verify your civic identity and track your reports live
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Top Level Portal Selector: Resident Citizen vs Municipal Authority vs Company Access */}
          <div className="flex bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold gap-1">
            <button
              type="button"
              onClick={() => {
                setPortalType('citizen');
                setError(null);
              }}
              className={`flex-1 py-2 px-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                portalType === 'citizen'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Resident</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalType('admin');
                setError(null);
              }}
              className={`flex-1 py-2 px-1.5 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer text-center ${
                portalType === 'admin'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-600/30 font-bold'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-300" />
              <span className="truncate">Admin Access</span>
              <span className="text-[8px] bg-amber-950/90 text-amber-300 px-1 py-0.2 rounded border border-amber-500/40 uppercase font-black hidden sm:inline">
                Gov
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPortalType('company');
                setError(null);
              }}
              className={`flex-1 py-2 px-1.5 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer text-center ${
                portalType === 'company'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-cyan-600/30 font-bold'
                  : 'text-cyan-400 hover:text-cyan-300'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0 text-cyan-300" />
              <span className="truncate">Company Access</span>
              <span className="text-[8px] bg-cyan-950/90 text-cyan-300 px-1 py-0.2 rounded border border-cyan-500/40 uppercase font-black hidden sm:inline">
                Bids
              </span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <p className="leading-relaxed">{error}</p>
                {firebaseOperationDisabled && portalType === 'citizen' && (
                  <button
                    type="button"
                    onClick={fallbackToSimpleEmail}
                    className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-[11px] transition-colors shadow"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Sign in with Simple Email ID instead
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PORTAL A: RENOVATION COMPANY ACCESS */}
          {/* ========================================================= */}
          {portalType === 'company' ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl text-xs text-cyan-200/90 leading-relaxed space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-cyan-300 text-xs">
                  <HardHat className="w-4 h-4 shrink-0 text-cyan-400" />
                  <span>Company Renovation & Contractor Portal</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-normal">
                  Registered infrastructure companies and repair contractors can apply with their <strong>Company Name</strong> for renovation work on community incidents, submit proposals to Municipal Authorities, and track appointed incidents and deadlines live in the top bar.
                </p>
              </div>

              <form onSubmit={handleCompanySubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Company Name <span className="text-cyan-400">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={companyNameInput}
                      onChange={(e) => setCompanyNameInput(e.target.value)}
                      placeholder="e.g. Apex Civil Renovations Pvt Ltd"
                      required
                      className="w-full h-11 pl-10 pr-3 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Your Company Name will be submitted to the Municipal Authority when bidding on renovation works.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Company Contact Email <span className="text-cyan-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={companyEmailInput}
                      onChange={(e) => setCompanyEmailInput(e.target.value)}
                      placeholder="e.g. contact@apexrenovations.com"
                      required
                      className="w-full h-11 pl-10 pr-3 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Primary Trade Specialty <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Wrench className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={companySpecialty}
                      onChange={(e) => setCompanySpecialty(e.target.value)}
                      className="w-full h-11 pl-10 pr-3 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl text-xs text-white outline-none transition-all"
                    >
                      <option value="Roads & Pothole Asphalt Work" className="bg-slate-900">Roads & Pothole Asphalt Work</option>
                      <option value="Streetlighting & Electrical Utilities" className="bg-slate-900">Streetlighting & Electrical Utilities</option>
                      <option value="Drainage, Stormwater & Sewer Lines" className="bg-slate-900">Drainage, Stormwater & Sewer Lines</option>
                      <option value="Water Pipeline & Hydrant Repair" className="bg-slate-900">Water Pipeline & Hydrant Repair</option>
                      <option value="Footpath Paving & Masonry" className="bg-slate-900">Footpath Paving & Masonry</option>
                      <option value="General Civil Infrastructure" className="bg-slate-900">General Civil Infrastructure</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Contact Phone Number <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={companyPhoneInput}
                      onChange={(e) => setCompanyPhoneInput(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full h-11 pl-10 pr-3 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loadingCompany}
                  className="w-full h-11 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-500 hover:to-cyan-500 border border-cyan-400/50 rounded-xl text-xs font-bold text-white shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {loadingCompany ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <HardHat className="w-4 h-4" />
                      <span>Sign In as Renovation Company</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPortalType('citizen');
                      setError(null);
                    }}
                    className="text-slate-400 hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>← Resident Citizen</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPortalType('admin');
                      setError(null);
                    }}
                    className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 transition-colors cursor-pointer font-semibold"
                  >
                    <span>Municipal Admin →</span>
                  </button>
                </div>
              </form>
            </div>
          ) : portalType === 'admin' ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-950/25 border border-amber-500/30 rounded-2xl text-xs text-amber-200/90 leading-relaxed space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-300 text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Municipal Authority Login</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-normal">
                  Authorized access for municipal officials and ward administrators to transition and manage incident statuses (<strong>Reported &rarr; Verified &rarr; In Progress &rarr; Resolved</strong>).
                </p>
              </div>

              <form onSubmit={handleAdminSubmit} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Administrator Email Address <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={adminEmailInput}
                      onChange={(e) => setAdminEmailInput(e.target.value)}
                      placeholder="Enter administrator email"
                      required
                      className="w-full h-11 pl-10 pr-3 bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Access is restricted to authorized municipal authority accounts.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Administrator Password <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      placeholder="Enter administrator password"
                      required
                      className="w-full h-11 pl-10 pr-10 bg-slate-950/80 border border-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="p-1 text-slate-500 hover:text-slate-300 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loadingAdmin}
                  className="w-full h-11 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-500 border border-amber-400/50 rounded-xl text-xs font-bold text-white shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-2 cursor-pointer"
                >
                  {loadingAdmin ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Authenticate as Municipal Authority</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPortalType('citizen');
                      setError(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>← Switch back to Resident Citizen Login</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ========================================================= */
            /* PORTAL B: RESIDENT CITIZEN LOGIN (GOOGLE & EMAIL) */
            /* ========================================================= */
            <>

          {/* ========================================================= */}
          {/* OPTION 1: GOOGLE SIGN IN (HIGH CONTRAST & CLEAR VISIBILITY) */}
          {/* ========================================================= */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Option 1</span>
                <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Recommended
                </span>
              </label>
              <span className="text-[11px] text-slate-400">1-Click Fast Verification</span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loadingGoogle || loadingEmail}
              className="w-full py-3.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-2xl shadow-xl shadow-black/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] border border-slate-200 cursor-pointer disabled:opacity-50"
            >
              {loadingGoogle ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.27 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.98 0 12c0 2.02.46 3.84 1.26 5.42l4.02-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>
          </div>

          {/* ========================================================= */}
          {/* DIVIDER */}
          {/* ========================================================= */}
          <div className="relative flex items-center justify-center my-1">
            <div className="w-full border-t border-slate-800"></div>
            <span className="absolute px-3 bg-slate-900 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              or continue with email
            </span>
          </div>

          {/* ========================================================= */}
          {/* OPTION 2: EMAIL LOGIN (SIMPLE OR PASSWORD) */}
          {/* ========================================================= */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Option 2</span>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Email ID
                </span>
              </label>
            </div>

            {/* Email Mode Selection Tabs */}
            <div className="flex bg-slate-950/90 p-1 rounded-2xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setEmailTab('simple');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                  emailTab === 'simple'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simple Email ID</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmailTab('password');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                  emailTab === 'password'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Email & Password</span>
              </button>
            </div>

            {/* TAB 1: SIMPLE EMAIL ID LOGIN */}
            {emailTab === 'simple' ? (
              <form onSubmit={handleSimpleEmailSubmit} className="space-y-3.5">
                <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300/90 leading-relaxed">
                  Fast citizen sign-in: Just enter your email ID! No password required. Your email will be attached to all reports and upvotes you submit.
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Your Email Address <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="citizen@example.com"
                      required
                      className="w-full h-11 pl-10 pr-3 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Your Name <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Aditya Yadav"
                      className="w-full h-11 pl-10 pr-3 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loadingEmail || loadingGoogle}
                  className="w-full h-11 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 border border-indigo-500/50 rounded-xl text-xs font-bold text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-1 cursor-pointer"
                >
                  {loadingEmail ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <span>Sign In with Email ID</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* TAB 2: EMAIL & PASSWORD */
              <form onSubmit={handlePasswordAuthSubmit} className="space-y-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    {authMode === 'signin' ? 'Sign in to account' : 'Register new account'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                      setError(null);
                    }}
                    className="font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer"
                  >
                    {authMode === 'signin' ? 'Need an account? Sign Up' : 'Already have account? Sign In'}
                  </button>
                </div>

                {authMode === 'signup' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Display Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Aditya Yadav"
                        className="w-full h-11 pl-10 pr-3 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="citizen@example.com"
                      required
                      className="w-full h-11 pl-10 pr-3 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full h-11 pl-10 pr-10 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 text-slate-500 hover:text-slate-300 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loadingEmail || loadingGoogle}
                  className="w-full h-11 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 border border-indigo-500/50 rounded-xl text-xs font-bold text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 mt-1 cursor-pointer"
                >
                  {loadingEmail ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : authMode === 'signup' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Create Account & Sign In</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Sign In with Password</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Direct Switcher to Special Admin Access & Company Access */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="p-3 bg-gradient-to-r from-cyan-950/30 via-slate-900 to-blue-950/20 border border-cyan-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 block text-xs">
                      Renovation Company or Contractor?
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Put in your Company Name to bid on repair works and view appointed deadlines
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPortalType('company');
                    setError(null);
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 border border-cyan-500/40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm cursor-pointer"
                >
                  <span>Company Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3 bg-gradient-to-r from-amber-950/30 via-slate-900 to-amber-950/20 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 block text-xs">
                      Municipal Authority or Ward Officer?
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Special access to review company proposals and transition incident statuses
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPortalType('admin');
                    setError(null);
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 border border-amber-500/40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm cursor-pointer"
                >
                  <span>Admin Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          </>
          )}
        </div>

        {/* Footer Note */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800/80 text-[11px] text-slate-400 text-center flex items-center justify-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>Encrypted resident authentication • Public reports are verified</span>
        </div>
      </div>
    </div>
  );

  // Render via Portal directly into document.body to ensure true centering and top-level backdrop blur
  return createPortal(modalContent, document.body);
};
