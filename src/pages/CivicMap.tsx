import React, { useState, useMemo } from 'react';
import { useIssues } from '../hooks/useIssues';
import { useUserLocation } from '../hooks/useUserLocation';
import { useAuth } from '../context/AuthContext';
import { MapView } from '../components/Map/MapView';
import { FilterPanel } from '../components/FilterPanel/FilterPanel';
import { CivicDashboard } from '../components/Dashboard/CivicDashboard';
import { IssueDetailsModal } from '../components/IssueDetails/IssueDetailsModal';
import { ReportIssueModal } from '../components/ReportIssue/ReportIssueModal';
import { MapSearchBar } from '../components/MapSearchBar/MapSearchBar';
import { ActivityFeed } from '../components/ActivityFeed/ActivityFeed';
import { CommunityIncidentsList } from '../components/CommunityFeed/CommunityIncidentsList';
import { UserProfileMenu } from '../components/Auth/UserProfileMenu';
import { CivicIssue, IssueFilterState } from '../types/issue';
import { seedDemoIssuesToFirestore } from '../services/seedService';
import { getLocalReportIds } from '../firebase/firestore';
import {
  Plus,
  Compass,
  Filter,
  Flame,
  Radio,
  Sparkles,
  MapPin,
  AlertTriangle,
  RefreshCw,
  Database,
  CheckCircle2,
  Map as MapIcon,
  Users,
  HardHat,
  Clock,
} from 'lucide-react';

export const CivicMap: React.FC = () => {
  const { user, isAdmin, isCompany, companyName } = useAuth();
  const { issues, loading, error, isLive, refresh } = useIssues();
  const { location: userCoords, loading: geoLoading, error: geoError, requestLocation } = useUserLocation();

  const [viewMode, setViewMode] = useState<'map' | 'community'>('map');
  const [communityTab, setCommunityTab] = useState<'all' | 'others' | 'mine' | 'spam'>('all');

  const [selectedIssue, setSelectedIssue] = useState<CivicIssue | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [pickingLocationOnMap, setPickingLocationOnMap] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [mapCenter, setMapCenter] = useState<[number, number]>([12.9716, 77.5946]);
  const [mapZoom, setMapZoom] = useState(13);
  const [isHeatmapMode, setIsHeatmapMode] = useState(false);
  const [nearMeRadiusKm, setNearMeRadiusKm] = useState<number | null>(null);
  const [requestedNearMe, setRequestedNearMe] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle?: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Count user's own reports
  const myReportsCount = useMemo(() => {
    const localIds = getLocalReportIds();
    return issues.filter((i) => {
      if (i.isSpam) return false;
      if (user && (i.reportedBy === user.uid || (user.email && i.reporterEmail === user.email))) {
        return true;
      }
      return localIds.includes(i.id);
    }).length;
  }, [issues, user]);

  const cleanReportsCount = useMemo(() => issues.filter((i) => !i.isSpam).length, [issues]);
  const spamCount = useMemo(() => issues.filter((i) => Boolean(i.isSpam)).length, [issues]);

  // Appointed incidents strictly for Company accounts
  const companyAppointedIssues = useMemo(() => {
    if (!isCompany) return [];
    return issues.filter((i) => {
      const matchId = i.appointedCompanyId && user?.uid && i.appointedCompanyId === user.uid;
      const matchName = companyName && i.appointedCompanyName && i.appointedCompanyName.toLowerCase() === companyName.toLowerCase();
      return matchId || matchName;
    });
  }, [issues, isCompany, user?.uid, companyName]);

  // Filters State
  const [filters, setFilters] = useState<IssueFilterState>({
    category: 'all',
    status: 'all',
    priority: 'all',
    timeRange: 'all',
    searchQuery: '',
  });

  const showToast = (title: string, subtitle?: string) => {
    setToastMessage({ title, subtitle });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Live Network Synced', `${issues.length} incidents verified from Cloud Firestore`);
    }, 400);
  };

  // Filter Issues
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (issue.isSpam) return false;
      if (filters.category !== 'all' && issue.category !== filters.category) return false;
      if (filters.status !== 'all' && issue.status !== filters.status) return false;
      if (filters.priority !== 'all' && issue.priorityLevel !== filters.priority) return false;

      if (filters.timeRange !== 'all') {
        const createdDate = issue.createdAt?.toDate ? issue.createdAt.toDate() : new Date(issue.createdAt);
        const hoursAgo = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);

        if (filters.timeRange === '24h' && hoursAgo > 24) return false;
        if (filters.timeRange === '7d' && hoursAgo > 24 * 7) return false;
        if (filters.timeRange === '30d' && hoursAgo > 24 * 30) return false;
      }

      // Near me radius filter if active
      if (nearMeRadiusKm && userCoords) {
        // Haversine approx distance
        const R = 6371; // km
        const dLat = ((issue.latitude - userCoords.lat) * Math.PI) / 180;
        const dLon = ((issue.longitude - userCoords.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((userCoords.lat * Math.PI) / 180) *
            Math.cos((issue.latitude * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        if (distance > nearMeRadiusKm) return false;
      }

      return true;
    });
  }, [issues, filters, nearMeRadiusKm, userCoords]);

  // Handle map click
  const handleMapClick = (lat: number, lng: number) => {
    if (pickingLocationOnMap) {
      setPickedCoords({ lat, lng });
      setPickingLocationOnMap(false);
      setReportModalOpen(true);
      showToast('Coordinates Selected', `Geotag set to ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } else {
      setSelectedIssue(null);
    }
  };

  // Near Me handler
  const handleNearMe = () => {
    if (!userCoords) {
      setRequestedNearMe(true);
      requestLocation();
    } else {
      setMapCenter([userCoords.lat, userCoords.lng]);
      setMapZoom(14);
      setNearMeRadiusKm((prev) => (prev === 3 ? null : 3));
      showToast('Centered on Your GPS', nearMeRadiusKm === 3 ? 'Showing all reports across the region' : 'Showing civic hazards within 3 km radius');
    }
  };

  // React to userCoords becoming available after user specifically clicked Near Me
  React.useEffect(() => {
    if (userCoords && requestedNearMe) {
      setMapCenter([userCoords.lat, userCoords.lng]);
      setMapZoom(14);
      setNearMeRadiusKm(3);
      setRequestedNearMe(false);
      showToast('Centered on Your GPS', 'Showing civic hazards within 3 km radius');
    }
  }, [userCoords, requestedNearMe]);

  // Seed demo issues if DB empty
  const handleSeedDemoData = async () => {
    setSeeding(true);
    try {
      const res = await seedDemoIssuesToFirestore();
      showToast('Firestore Populated', res.message);
    } catch (err: any) {
      showToast('Seed Failed', err?.message || 'Could not populate demo issues.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-950 font-sans">
      {/* TOP HEADER / APP BAR */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 z-30 shrink-0">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-lg shadow-indigo-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-white flex items-center gap-1.5">
                CivicPulse
              </h1>
              <span className="hidden xl:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-widest">
                Live Civic Issue Map
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden lg:block">
              Real-time community infrastructure & municipal issue tracking
            </p>
          </div>
        </div>

        {/* View Switcher: Live Map vs Community Reports */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setViewMode('map')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'map'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Live Map</span>
            <span className="sm:hidden">Map</span>
          </button>

          <button
            onClick={() => {
              setViewMode('community');
              setCommunityTab('all');
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'community'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Community Incidents</span>
            <span className="sm:hidden">Reports</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300">
              {cleanReportsCount}
            </span>
          </button>
        </div>

        {/* Search Bar (Centered on map view) */}
        {viewMode === 'map' && (
          <div className="flex-1 max-w-xs sm:max-w-sm mx-1 hidden md:block">
            <MapSearchBar
              onLocationSelect={(lat, lon, name) => {
                setMapCenter([lat, lon]);
                setMapZoom(15);
                showToast('Navigated to Area', name.split(',')[0]);
              }}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* COMPANY APPOINTED INCIDENT & DEADLINE IN TOP BAR (STRICTLY FOR COMPANIES) */}
        {/* ========================================================================= */}
        {isCompany && (
          <div className="flex items-center gap-2 shrink-0">
            {companyAppointedIssues.length > 0 ? (
              <div className="flex items-center gap-2">
                {companyAppointedIssues.slice(0, 1).map((issue) => (
                  <button
                    key={issue.id}
                    onClick={() => {
                      setSelectedIssue(issue);
                      setViewMode('map');
                      setMapCenter([issue.latitude, issue.longitude]);
                      setMapZoom(16);
                      showToast('Appointed Renovation Project', `${issue.title} • Deadline: ${issue.appointedDeadline || 'Standard'}`);
                    }}
                    className="flex items-center gap-2.5 px-3 py-1.5 bg-gradient-to-r from-emerald-950/90 via-teal-950/90 to-slate-900 border border-emerald-500/70 hover:border-emerald-400 rounded-xl text-left shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02] cursor-pointer group animate-fadeIn"
                    title="Click to view full appointed incident details and timeline"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0">
                      <HardHat className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex flex-col min-w-0 max-w-[130px] sm:max-w-[190px] md:max-w-[240px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 shrink-0">
                          Appointed Incident
                        </span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-semibold truncate hidden sm:inline">
                          {issue.ward || 'Active'}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                        {issue.title}
                      </span>
                    </div>
                    <div className="border-l border-emerald-500/40 pl-2 ml-1 flex flex-col items-end shrink-0">
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Deadline</span>
                      </span>
                      <span className="text-[11px] font-black text-amber-300">
                        {issue.appointedDeadline || '7 Days'}
                      </span>
                    </div>
                  </button>
                ))}
                {companyAppointedIssues.length > 1 && (
                  <span className="px-2 py-1 bg-emerald-900/60 border border-emerald-500/40 rounded-lg text-[10px] font-bold text-emerald-300">
                    +{companyAppointedIssues.length - 1} more
                  </span>
                )}
              </div>
            ) : (
              <div className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 bg-slate-950/60 border border-cyan-500/30 rounded-xl text-xs text-cyan-300">
                <HardHat className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="font-semibold truncate max-w-[140px]">{companyName || 'Contractor'}</span>
                <span className="text-slate-400 text-[10px]">• Ready for work</span>
              </div>
            )}
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2">
          {viewMode === 'map' && (
            <>
              {/* Mobile Filter Button */}
              <button
                onClick={() => setMobileFilterOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
                title="Open Filters"
              >
                <Filter className="w-4 h-4" />
              </button>

              {/* Near Me GPS Button */}
              <button
                onClick={handleNearMe}
                className={`hidden sm:flex px-3 py-2 rounded-xl text-xs font-semibold border items-center gap-1.5 transition-all ${
                  nearMeRadiusKm
                    ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
                title="Issues Near Me"
              >
                <Compass className={`w-4 h-4 ${geoLoading ? 'animate-spin' : 'text-cyan-400'}`} />
                <span>Near Me {nearMeRadiusKm ? `(${nearMeRadiusKm}km)` : ''}</span>
              </button>
            </>
          )}

          {/* Live Sync Status & Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 transition-all hover:bg-slate-900 cursor-pointer"
            title="Real-time Cloud Firestore sync (click to refresh)"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isLive ? 'bg-emerald-400 opacity-75' : 'bg-amber-400 opacity-75'}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isLive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            <span className="font-medium text-slate-300">
              {issues.length} Live Reports
            </span>
            <RefreshCw className={`w-3 h-3 text-slate-400 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          {/* User Profile / Google Sign-in Menu */}
          <UserProfileMenu
            myReportsCount={myReportsCount}
            onViewMyReports={() => {
              setViewMode('community');
              setCommunityTab('mine');
            }}
            onToast={showToast}
          />

          {/* Report Issue Button */}
          <button
            onClick={() => {
              setPickedCoords({ lat: mapCenter[0], lng: mapCenter[1] });
              setReportModalOpen(true);
            }}
            className="px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span className="hidden sm:inline">+ Report Issue</span>
            <span className="sm:hidden">Report</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* FULL-WIDTH TOP BAR APPOINTED INCIDENT NOTIFIER (STRICTLY FOR COMPANIES) */}
      {/* ========================================================================= */}
      {isCompany && companyAppointedIssues.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-950 via-teal-950/90 to-slate-950 border-b border-emerald-500/40 px-3 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs z-20 shrink-0 shadow-md animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0">
              <HardHat className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-bold text-emerald-300 whitespace-nowrap">
                Appointed Incident for {companyName || 'Your Company'}:
              </span>
              {companyAppointedIssues.map((issue) => (
                <div key={issue.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedIssue(issue);
                      setViewMode('map');
                      setMapCenter([issue.latitude, issue.longitude]);
                      setMapZoom(16);
                    }}
                    className="font-bold text-white hover:text-emerald-300 underline decoration-emerald-400 decoration-1 underline-offset-2 transition-colors cursor-pointer truncate max-w-[200px] sm:max-w-none text-left"
                  >
                    {issue.title} ({issue.ward})
                  </button>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Completion Deadline: {issue.appointedDeadline || '7 Days'}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (companyAppointedIssues[0]) {
                setSelectedIssue(companyAppointedIssues[0]);
                setViewMode('map');
                setMapCenter([companyAppointedIssues[0].latitude, companyAppointedIssues[0].longitude]);
                setMapZoom(16);
              }
            }}
            className="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[11px] font-bold shrink-0 transition-all shadow shadow-emerald-900/40 flex items-center gap-1 cursor-pointer"
          >
            <span>Open Work Details</span>
            <span>→</span>
          </button>
        </div>
      )}

      {/* MAIN VIEWPORT: EITHER COMMUNITY INCIDENTS DIRECTORY OR LIVE MAP */}
      {viewMode === 'community' ? (
        <CommunityIncidentsList
          issues={issues}
          activeTab={communityTab}
          onSelectIssueOnMap={(issue) => {
            setViewMode('map');
            setMapCenter([issue.latitude, issue.longitude]);
            setMapZoom(16);
            setSelectedIssue(issue);
            showToast('Focused on Map', `${issue.title} - ${issue.ward}`);
          }}
          onOpenIssueDetails={(issue) => setSelectedIssue(issue)}
          onOpenReportModal={() => {
            setPickedCoords({ lat: mapCenter[0], lng: mapCenter[1] });
            setReportModalOpen(true);
          }}
        />
      ) : (
        <div className="relative flex-1 flex overflow-hidden">
          {/* Left Filter Panel (Desktop sidebar / Mobile drawer) */}
          <FilterPanel
            filters={filters}
            onFilterChange={setFilters}
            totalIssuesCount={issues.length}
            filteredIssuesCount={filteredIssues.length}
            isHeatmapMode={isHeatmapMode}
            onToggleHeatmap={() => setIsHeatmapMode(!isHeatmapMode)}
            isOpenMobile={mobileFilterOpen}
            onCloseMobile={() => setMobileFilterOpen(false)}
          />

          {/* Map Container */}
          <div className="relative flex-1 h-full w-full">
            <MapView
              issues={filteredIssues}
              selectedIssue={selectedIssue}
              onSelectIssue={(issue) => setSelectedIssue(issue)}
              center={mapCenter}
              zoom={mapZoom}
              isHeatmapMode={isHeatmapMode}
              onMapClick={handleMapClick}
              pickingLocation={pickingLocationOnMap}
              pickedCoords={pickedCoords}
              userCoords={userCoords}
              radiusKm={nearMeRadiusKm}
            />

            {/* Active GPS Radius Filter Warning / Clear Chip */}
            {nearMeRadiusKm && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 border border-cyan-500/50 shadow-2xl rounded-full px-4 py-1.5 flex items-center gap-2 text-xs backdrop-blur-md pointer-events-auto">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-200">Showing hazards within 3 km of your GPS</span>
                <button
                  onClick={() => setNearMeRadiusKm(null)}
                  className="ml-1 text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
                >
                  Show all {issues.length} reports
                </button>
              </div>
            )}

            {/* Quick Floating Button to View Incidents Reported by Others */}
            <div className="absolute top-4 right-4 z-20 hidden md:block pointer-events-auto">
              <button
                onClick={() => {
                  setCommunityTab('others');
                  setViewMode('community');
                }}
                className="px-3.5 py-2 bg-slate-900/90 hover:bg-slate-800 border border-indigo-500/40 hover:border-indigo-500 text-indigo-300 hover:text-white rounded-xl text-xs font-semibold shadow-xl backdrop-blur-md flex items-center gap-2 transition-all hover:scale-[1.02]"
                title="Browse list of all incidents reported by other citizens"
              >
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Browse All Community Incidents ({issues.length})</span>
              </button>
            </div>

            {/* FLOATING TOP-LEFT CIVIC PULSE DASHBOARD */}
            <div className="absolute top-4 left-4 z-10 hidden sm:block pointer-events-auto">
              <CivicDashboard issues={issues} isLive={isLive} />
            </div>

            {/* FLOATING BOTTOM-LEFT LIVE ACTIVITY FEED */}
            <div className="absolute bottom-6 left-4 z-10 w-72 sm:w-80 hidden md:block pointer-events-auto">
              <ActivityFeed
                onSelectIssueById={(issueId) => {
                  const target = issues.find((i) => i.id === issueId);
                  if (target) {
                    setSelectedIssue(target);
                    setMapCenter([target.latitude, target.longitude]);
                    setMapZoom(16);
                  }
                }}
              />
            </div>

            {/* OPTIONAL SEED DATA BUTTON (If DB is empty) */}
            {issues.length === 0 && !loading && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 border border-indigo-500/40 p-5 rounded-2xl shadow-2xl max-w-md text-center backdrop-blur-md animate-fadeIn">
                <Database className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white">Firestore Database Ready</h3>
                <p className="text-xs text-slate-300 mt-1 mb-4">
                  No civic issues logged in this collection yet. You can report the first one, or click below to seed verified demonstration reports.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setPickedCoords({ lat: mapCenter[0], lng: mapCenter[1] });
                      setReportModalOpen(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow"
                  >
                    + Report First Issue
                  </button>
                  <button
                    onClick={handleSeedDemoData}
                    disabled={seeding}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5"
                  >
                    {seeding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                    <span>Seed Demo Issues</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Seed Button in bottom right if user wants to add seed data anytime */}
            {issues.length > 0 && (
              <div className="absolute bottom-4 right-14 z-10">
                <button
                  onClick={handleSeedDemoData}
                  disabled={seeding}
                  title="Populate test civic reports into Firestore"
                  className="px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-800 rounded-xl text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1.5 shadow-lg transition-all"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{seeding ? 'Adding records...' : 'Seed Sample Reports'}</span>
                </button>
              </div>
            )}

            {/* Map Location picking HUD */}
            {pickingLocationOnMap && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 bg-slate-900 border border-indigo-500/80 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  <span>Tap any point on the map to set report coordinates</span>
                </div>
                <button
                  onClick={() => {
                    setPickingLocationOnMap(false);
                    setReportModalOpen(true);
                  }}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900/95 border border-indigo-500/50 shadow-2xl rounded-2xl px-4 py-3 flex items-start gap-3 backdrop-blur-md animate-slideIn">
          <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">{toastMessage.title}</h4>
            {toastMessage.subtitle && (
              <p className="text-[11px] text-slate-400 mt-0.5">{toastMessage.subtitle}</p>
            )}
          </div>
        </div>
      )}

      {/* ISSUE DETAILS MODAL */}
      {selectedIssue && (
        <IssueDetailsModal
          issue={issues.find((i) => i.id === selectedIssue.id) || selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onIssueUpdated={() => {
            // Firestore real-time listener will automatically update the data
          }}
          onToast={showToast}
        />
      )}

      {/* REPORT ISSUE MODAL */}
      <ReportIssueModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        pickedCoords={pickedCoords}
        onStartPickingLocation={() => {
          setPickingLocationOnMap(true);
          showToast('Interactive Map Geotagging', 'Tap anywhere on the map to drop pin');
        }}
        onIssueCreated={(newId, coords) => {
          setReportModalOpen(false);
          setPickingLocationOnMap(false);
          // Reset filters so the new report is guaranteed to be visible regardless of current filter settings
          setFilters({
            category: 'all',
            status: 'all',
            priority: 'all',
            timeRange: 'all',
            searchQuery: '',
          });
          setNearMeRadiusKm(null);
          setMapCenter([coords.lat, coords.lng]);
          setMapZoom(16);
          // Trigger instant refresh so it immediately shows up even before websocket push
          refresh().then((freshIssues) => {
            const newlyCreated = freshIssues?.find((i) => i.id === newId) || issues.find((i) => i.id === newId);
            if (newlyCreated) {
              setSelectedIssue(newlyCreated);
            }
          });
          showToast('✓ Incident Broadcast Live', 'Saved to Cloud Firestore & now visible on all devices worldwide!');
        }}
      />
    </div>
  );
};
