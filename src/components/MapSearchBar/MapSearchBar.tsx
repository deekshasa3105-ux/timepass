import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import { searchPlaces } from '../../services/locationService';

interface MapSearchBarProps {
  onLocationSelect: (lat: number, lon: number, name: string) => void;
}

export const MapSearchBar: React.FC<MapSearchBarProps> = ({ onLocationSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ label: string; lat: number; lon: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Quick suggestions for one-click navigation
  const popularAreas = [
    { label: 'Koramangala, Bengaluru', lat: 12.9352, lon: 77.6245 },
    { label: 'Indiranagar, Bengaluru', lat: 12.9784, lon: 77.6408 },
    { label: 'Whitefield, Bengaluru', lat: 12.9698, lon: 77.7500 },
    { label: 'Jayanagar, Bengaluru', lat: 12.9308, lon: 77.5838 },
  ];

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await searchPlaces(query);
      setResults(res);
      setLoading(false);
      setIsOpen(true);
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <div className="relative flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl shadow-lg focus-within:border-indigo-500 transition-colors">
        <Search className="w-4 h-4 text-slate-400 ml-3.5 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search neighbourhood, ward, or street..."
          className="w-full bg-transparent px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none"
        />
        {loading && <Loader2 className="w-4 h-4 text-slate-400 mr-3 animate-spin shrink-0" />}
        {query && !loading && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="p-1 mr-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Suggestions */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-slate-800/80">
          {results.length > 0 ? (
            results.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  onLocationSelect(r.lat, r.lon, r.label);
                  setQuery(r.label.split(',')[0]);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800/70 transition-colors flex items-start gap-2.5 text-xs text-slate-300"
              >
                <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <span className="truncate">{r.label}</span>
              </button>
            ))
          ) : query.length >= 2 && !loading ? (
            <div className="p-3 text-center text-xs text-slate-400">
              No matching civic location found. Try searching by locality name.
            </div>
          ) : (
            <div className="p-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 px-2 tracking-wider block mb-1">
                Popular Civic Hubs
              </span>
              {popularAreas.map((area, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onLocationSelect(area.lat, area.lon, area.label);
                    setQuery(area.label.split(',')[0]);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800/70 text-xs text-slate-300 flex items-center justify-between"
                >
                  <span>{area.label}</span>
                  <span className="text-[10px] text-indigo-400 font-medium">Jump to</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
