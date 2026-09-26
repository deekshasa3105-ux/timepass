import React, { useEffect, useState, useMemo } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from '@vis.gl/react-google-maps';
import { CivicIssue } from '../../types/issue';
import { getCategoryMeta, getPriorityBadgeColor } from '../../utils/priority';
import { MapPin } from 'lucide-react';

declare const google: any;

export const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
  'AIzaSyCz5NkHg5No9oqSxh65Qa9uqg8fuZTFf2g';

interface MapViewProps {
  issues: CivicIssue[];
  selectedIssue: CivicIssue | null;
  onSelectIssue: (issue: CivicIssue) => void;
  center?: [number, number];
  zoom?: number;
  isHeatmapMode: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  pickingLocation?: boolean;
  pickedCoords?: { lat: number; lng: number } | null;
  userCoords?: { lat: number; lng: number } | null;
  radiusKm?: number | null;
}

// Controller component to handle programmatically flying and panning
function MapController({
  center,
  zoom,
  selectedIssue,
}: {
  center: [number, number];
  zoom: number;
  selectedIssue: CivicIssue | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (selectedIssue) {
      map.panTo({ lat: selectedIssue.latitude, lng: selectedIssue.longitude });
      map.setZoom(16);
    }
  }, [map, selectedIssue?.id]);

  useEffect(() => {
    if (!map) return;
    if (!selectedIssue) {
      map.panTo({ lat: center[0], lng: center[1] });
      map.setZoom(zoom);
    }
  }, [map, center[0], center[1], zoom]);

  return null;
}

// User radius circle overlay drawn using google.maps.Circle
function UserRadiusCircle({
  userCoords,
  radiusKm,
}: {
  userCoords?: { lat: number; lng: number } | null;
  radiusKm?: number | null;
}) {
  const map = useMap();
  const [circle, setCircle] = useState<any | null>(null);

  useEffect(() => {
    if (!map) return;

    if (userCoords && radiusKm) {
      if (circle) circle.setMap(null);

      const newCircle = new google.maps.Circle({
        strokeColor: '#06b6d4',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#06b6d4',
        fillOpacity: 0.12,
        map,
        center: { lat: userCoords.lat, lng: userCoords.lng },
        radius: radiusKm * 1000,
      });

      setCircle(newCircle);

      return () => {
        newCircle.setMap(null);
      };
    } else if (circle) {
      circle.setMap(null);
      setCircle(null);
    }
  }, [map, userCoords?.lat, userCoords?.lng, radiusKm]);

  return null;
}

export const MapView: React.FC<MapViewProps> = ({
  issues,
  selectedIssue,
  onSelectIssue,
  center = [12.9716, 77.5946],
  zoom = 13,
  isHeatmapMode,
  onMapClick,
  pickingLocation = false,
  pickedCoords,
  userCoords,
  radiusKm,
}) => {
  return (
    <div className="relative w-full h-full bg-slate-950">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={{ lat: center[0], lng: center[1] }}
          defaultZoom={zoom}
          mapId="DEMO_MAP_ID"
          gestureHandling="greedy"
          disableDefaultUI={false}
          clickableIcons={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          onClick={(e) => {
            if (e.detail.latLng && onMapClick) {
              onMapClick(e.detail.latLng.lat, e.detail.latLng.lng);
            }
          }}
        >
          <MapController
            center={center}
            zoom={zoom}
            selectedIssue={selectedIssue}
          />

          <UserRadiusCircle userCoords={userCoords} radiusKm={radiusKm} />

          {/* User Location Marker */}
          {userCoords && (
            <AdvancedMarker
              position={{ lat: userCoords.lat, lng: userCoords.lng }}
              title="Your Location"
            >
              <div className="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <span className="absolute inline-flex h-8 w-8 rounded-full bg-cyan-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500 border-2 border-white shadow-xl" />
              </div>
            </AdvancedMarker>
          )}

          {/* Picked Coordinates Pin Marker (Report Flow) */}
          {pickingLocation && pickedCoords && (
            <AdvancedMarker
              position={{ lat: pickedCoords.lat, lng: pickedCoords.lng }}
              draggable={true}
              onDragEnd={(e) => {
                if (e.latLng && onMapClick) {
                  const lat = typeof (e.latLng as any).lat === 'function' ? (e.latLng as any).lat() : (e.latLng as any).lat;
                  const lng = typeof (e.latLng as any).lng === 'function' ? (e.latLng as any).lng() : (e.latLng as any).lng;
                  if (typeof lat === 'number' && typeof lng === 'number') {
                    onMapClick(lat, lng);
                  }
                }
              }}
            >
              <div className="relative flex items-center justify-center -translate-x-1/2 -translate-y-full cursor-grab active:cursor-grabbing">
                <div className="w-10 h-10 bg-indigo-600 border-2 border-white rounded-full flex items-center justify-center shadow-2xl text-white animate-bounce">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -bottom-1 w-3 h-1 bg-black/50 rounded-full blur-[1px]" />
              </div>
            </AdvancedMarker>
          )}

          {/* Civic Issues Markers */}
          {issues.map((issue) => {
            const isSelected = selectedIssue?.id === issue.id;
            const catMeta = getCategoryMeta(issue.category);
            const prioMeta = getPriorityBadgeColor(issue.priorityLevel);

            const statusRing =
              issue.status === 'resolved'
                ? 'ring-2 ring-emerald-500 bg-emerald-950/95 text-emerald-400'
                : issue.status === 'in_progress'
                ? 'ring-2 ring-purple-500 bg-purple-950/95 text-purple-400'
                : issue.priorityLevel === 'CRITICAL'
                ? 'ring-2 ring-red-500 bg-slate-900 text-white'
                : 'ring-2 ring-amber-500/80 bg-slate-900 text-white';

            return (
              <AdvancedMarker
                key={issue.id}
                position={{ lat: issue.latitude, lng: issue.longitude }}
                title={issue.title}
                onClick={() => onSelectIssue(issue)}
                zIndex={isSelected ? 999 : issue.priorityLevel === 'CRITICAL' ? 50 : 10}
              >
                <div
                  className={`group relative flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-125 ${
                    isSelected ? 'scale-125' : 'scale-100'
                  }`}
                >
                  {issue.priorityLevel === 'CRITICAL' && issue.status !== 'resolved' && (
                    <span className="absolute inline-flex h-9 w-9 rounded-full bg-red-500/40 animate-ping" />
                  )}

                  <div
                    className={`relative w-8 h-8 rounded-full shadow-2xl flex items-center justify-center text-sm border-2 border-slate-950 ${statusRing} transition-all`}
                  >
                    <span className="leading-none text-base drop-shadow select-none">
                      {catMeta.icon}
                    </span>
                    {issue.upvotes > 0 && (
                      <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-[14px] bg-indigo-600 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow border border-slate-900">
                        {issue.upvotes}
                      </span>
                    )}
                  </div>
                  <div className="absolute -bottom-1 w-2.5 h-1 bg-black/40 rounded-full blur-[1px]" />
                </div>
              </AdvancedMarker>
            );
          })}
        </Map>
      </APIProvider>

      {/* Picking Location Notification banner */}
      {pickingLocation && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur-md border border-indigo-500/60 text-indigo-200 px-4 py-2 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2 pointer-events-none animate-pulse">
          <MapPin className="w-4 h-4 text-indigo-400" />
          <span>Click anywhere on Google Maps or drag the pin to set incident coordinates</span>
        </div>
      )}
    </div>
  );
};
