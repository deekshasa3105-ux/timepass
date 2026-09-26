import React, { useState, useRef, useEffect } from 'react';
import { IssueCategory, LocationInfo } from '../../types/issue';
import { getCategoryMeta } from '../../utils/priority';
import { reverseGeocode } from '../../services/locationService';
import { uploadIssuePhoto } from '../../firebase/storage';
import { createIssue } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { SignInModal } from '../Auth/SignInModal';
import {
  X,
  Upload,
  MapPin,
  Crosshair,
  AlertCircle,
  CheckCircle,
  Loader2,
  Camera,
  Layers,
  Edit3,
  LogIn,
  Mail,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  pickedCoords: { lat: number; lng: number } | null;
  onStartPickingLocation: () => void;
  onIssueCreated: (newIssueId: string, coords: { lat: number; lng: number }) => void;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  isOpen,
  onClose,
  pickedCoords,
  onStartPickingLocation,
  onIssueCreated,
}) => {
  const { user, isGoogleUser, isEmailUser } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IssueCategory>('pothole');
  const [reporterName, setReporterName] = useState('');
  const [signInModalOpen, setSignInModalOpen] = useState(false);

  // Auto-populate reporter name from Google auth if available
  useEffect(() => {
    if (user?.displayName && !reporterName) {
      setReporterName(user.displayName);
    }
  }, [user?.displayName]);

  // Location state
  const [locationInfo, setLocationInfo] = useState<LocationInfo>({
    latitude: pickedCoords?.lat ?? 12.9716,
    longitude: pickedCoords?.lng ?? 77.5946,
    address: 'Near City Center, MG Road',
    ward: 'Ward / Central',
    municipality: 'Bruhat Bengaluru Mahanagara Palike',
  });
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  // Photo state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form whenever modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false);
      setError(null);
      setUploadProgress(0);
    }
  }, [isOpen]);

  // Update location when pickedCoords change from map or GPS
  useEffect(() => {
    if (pickedCoords && pickedCoords.lat && pickedCoords.lng) {
      setGeocoding(true);
      // Immediately set coordinates
      setLocationInfo((prev) => ({
        ...prev,
        latitude: pickedCoords.lat,
        longitude: pickedCoords.lng,
      }));

      // Asynchronously fetch reverse geocode without blocking
      reverseGeocode(pickedCoords.lat, pickedCoords.lng)
        .then((info) => {
          setLocationInfo(info);
          setGeocoding(false);
        })
        .catch(() => {
          setGeocoding(false);
        });
    }
  }, [pickedCoords?.lat, pickedCoords?.lng]);

  if (!isOpen) return null;

  const categories: IssueCategory[] = [
    'pothole',
    'streetlight',
    'garbage',
    'drainage',
    'water',
    'footpath',
    'traffic',
    'other',
  ];

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported on this device');
      return;
    }
    setGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocationInfo((prev) => ({
          ...prev,
          latitude: coords.lat,
          longitude: coords.lng,
        }));
        try {
          const info = await reverseGeocode(coords.lat, coords.lng);
          setLocationInfo(info);
        } catch (e) {
          console.warn('Geocode fallback used');
        } finally {
          setGeocoding(false);
        }
      },
      (err) => {
        setGeocoding(false);
        setError('Location permission denied. Please click on the map to set location.');
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        setError('Image size exceeds 20MB limit');
        return;
      }
      setPhotoFile(file);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a brief title describing the issue');
      return;
    }

    setSubmitting(true);
    setError(null);

    // Safe coordinate defaults
    const lat = Number(locationInfo.latitude) || 12.9716;
    const lng = Number(locationInfo.longitude) || 77.5946;
    const addr = locationInfo.address.trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    try {
      let uploadedUrl = '';
      if (photoFile) {
        try {
          uploadedUrl = await uploadIssuePhoto(photoFile, (pct) => setUploadProgress(pct));
        } catch (photoErr) {
          console.warn('Photo upload warning:', photoErr);
        }
      }

      const issueId = await createIssue({
        title: title.trim(),
        description: description.trim(),
        category,
        latitude: lat,
        longitude: lng,
        address: addr,
        photoUrl: uploadedUrl,
        ward: locationInfo.ward || 'Local Ward',
        municipality: locationInfo.municipality || 'Municipal Corporation',
        reporterName: reporterName.trim() || user?.displayName || user?.email?.split('@')[0] || 'Community Resident',
        reporterPhotoUrl: user?.photoURL ? user.photoURL : undefined,
        reporterEmail: user?.email ? user.email : undefined,
        isGoogleVerified: Boolean(isGoogleUser),
      });

      try {
        confetti({
          particleCount: 45,
          spread: 55,
          origin: { y: 0.7 },
        });
      } catch (confettiErr) {
        console.warn('Confetti error:', confettiErr);
      }

      // Reset form state
      setTitle('');
      setDescription('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setSubmitting(false);

      // Close modal now that write has been verified
      onClose();

      // Trigger map update & centering callback
      onIssueCreated(issueId, { lat, lng });
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err?.message || 'Failed to submit report. Please check your connection and retry.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Report Civic Infrastructure Issue
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live broadcast to city monitoring map and local authorities
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-4 custom-scrollbar">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* REPORTER IDENTITY STATUS / SIGN-IN */}
          {user ? (
            <div
              className={`p-3 rounded-xl flex items-center justify-between gap-3 text-xs border ${
                isGoogleUser
                  ? 'bg-indigo-950/40 border-indigo-500/30'
                  : 'bg-emerald-950/30 border-emerald-500/30'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-indigo-400 shrink-0"
                  />
                ) : (
                  <div
                    className={`w-7 h-7 rounded-full text-white font-bold flex items-center justify-center text-xs shrink-0 ${
                      isGoogleUser ? 'bg-indigo-600' : 'bg-emerald-600'
                    }`}
                  >
                    {(user.displayName || user.email || 'C').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <span className="font-semibold text-white block truncate">
                    Reporting as {user.displayName || user.email}
                  </span>
                  <span
                    className={`text-[10px] flex items-center gap-1 font-medium ${
                      isGoogleUser ? 'text-indigo-300' : 'text-emerald-300'
                    }`}
                  >
                    {isGoogleUser ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-indigo-400" /> Google Verified Citizen Report
                      </>
                    ) : (
                      <>
                        <Mail className="w-3 h-3 text-emerald-400" /> Email Verified Citizen Report
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="font-semibold text-slate-300 block">Reporting as Guest Resident</span>
                <span className="text-[10px] text-slate-500 block truncate">
                  Sign in with Google or Email ID to link verified citizen badge to your report
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSignInModalOpen(true)}
                className="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 rounded-lg text-indigo-200 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-indigo-400" />
                <span>Sign In</span>
              </button>
            </div>
          )}

          {/* STEP 1: LOCATION SELECTION */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800/90 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Step 1: Incident Location
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] rounded-lg border border-slate-700 flex items-center gap-1 transition-colors"
                >
                  <Crosshair className="w-3 h-3 text-cyan-400" />
                  <span>My GPS</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStartPickingLocation();
                    onClose();
                  }}
                  className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[11px] rounded-lg border border-indigo-500/30 flex items-center gap-1 transition-colors"
                >
                  <Layers className="w-3 h-3" />
                  <span>Select on Map</span>
                </button>
              </div>
            </div>

            <div className="text-xs space-y-1.5">
              <div className="flex items-start justify-between gap-1.5 text-slate-300">
                <div className="flex-1">
                  <span className="text-slate-500 font-semibold block text-[10px] uppercase">Address</span>
                  {isEditingAddress ? (
                    <input
                      type="text"
                      value={locationInfo.address}
                      onChange={(e) =>
                        setLocationInfo((prev) => ({ ...prev, address: e.target.value }))
                      }
                      className="w-full mt-1 px-2.5 py-1 bg-slate-900 border border-indigo-500 rounded-lg text-xs text-white"
                      placeholder="Enter street or landmark..."
                    />
                  ) : (
                    <span className="font-medium text-slate-200 block text-xs">
                      {geocoding ? 'Detecting address details...' : locationInfo.address}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingAddress(!isEditingAddress)}
                  className="p-1 text-slate-400 hover:text-indigo-400"
                  title="Edit address manually"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-3 text-slate-400 text-[11px] pt-1 border-t border-slate-800/80">
                <span>
                  Lat: <strong className="text-slate-300">{Number(locationInfo.latitude).toFixed(4)}</strong>
                </span>
                <span>
                  Lng: <strong className="text-slate-300">{Number(locationInfo.longitude).toFixed(4)}</strong>
                </span>
                <span className="text-cyan-400 truncate">{locationInfo.ward}</span>
              </div>
            </div>
          </div>

          {/* STEP 2: CATEGORY SELECTOR */}
          <div>
            <label className="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">
              Issue Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categories.map((cat) => {
                const meta = getCategoryMeta(cat);
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-lg">{meta.icon}</span>
                    <span className="text-xs font-semibold truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Issue Headline / Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Deep crater pothole near 5th Block crossing"
                className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Detailed Description & Hazards
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe size, traffic obstruction, or immediate danger to pedestrians/vehicles..."
                className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reporter Display Name (Optional)
              </label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="e.g. Resident Ward 14 / Aditi"
                className="w-full px-3.5 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Photo Upload Section */}
          <div>
            <label className="block text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">
              Evidence Photograph
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 group">
                <img src={photoPreview} alt="Preview" className="w-full h-36 object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                  }}
                  className="absolute top-2 right-2 p-1 bg-black/70 hover:bg-black text-white rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Image attached
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-5 border-2 border-dashed border-slate-800 hover:border-indigo-500/60 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-slate-950/30 group"
              >
                <div className="p-2.5 rounded-full bg-slate-900 group-hover:bg-indigo-600/20 text-slate-400 group-hover:text-indigo-400 transition-colors">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-white">
                    Upload or take photo (Optional)
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    Supports JPG, PNG up to 20MB
                  </span>
                </div>
              </div>
            )}

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-2">
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-1.5 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Processing image: {uploadProgress}%
                </span>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Broadcasting Report...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Submit Civic Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <SignInModal
        isOpen={signInModalOpen}
        onClose={() => setSignInModalOpen(false)}
      />
    </div>
  );
};
