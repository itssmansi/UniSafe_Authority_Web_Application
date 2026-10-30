import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ExternalLink,
  RotateCcw,
  Sliders,
  Globe,
  Navigation,
  Building,
  Info
} from 'lucide-react';

/**
 * AddressSearchSelector
 * 
 * Location selector and geocoding component for police incident / missing-person registration.
 * 
 * Architecture & Provider Behavior:
 * 1. Google Places Autocomplete (New):
 *    - Automatically activates when `VITE_GOOGLE_MAPS_API_KEY` is configured in the environment.
 *    - Left unimplemented when credentials are missing, with explicit configuration requirements reported.
 * 2. On-Demand Local Geocoding:
 *    - Complies with Nominatim usage policy: NO real-time keystroke autocomplete against the public endpoint.
 *    - Search runs strictly on-demand when the officer submits the search (button click or Enter key).
 *    - Optimized with Mumbai/India geographic biasing (viewbox & country code) for recognizable local places.
 * 3. Manual Coordinate & Map Marker Selection:
 *    - Always available as an immediate fallback if text search returns no results or officer has exact GPS coordinates.
 *    - Includes verified Mumbai police command hubs & transit landmarks for 1-click selection.
 *    - Real-time interactive OpenStreetMap preview frame reflecting confirmed coordinates.
 *    - Preserves required provider attribution (ODbL).
 */

// Common verified Mumbai police command & transit hubs for instant selection
const MUMBAI_POLICE_HUBS = [
  {
    name: 'Bandra Police Station',
    displayName: 'Bandra Police Station, Hill Road, Bandra West, Mumbai 400050',
    lat: 19.0544,
    lon: 72.8402,
    type: 'police'
  },
  {
    name: 'Andheri West Station Hub',
    displayName: 'Andheri Railway Station West & Police Beat, S.V. Road, Andheri West, Mumbai 400058',
    lat: 19.1197,
    lon: 72.8468,
    type: 'transit_station'
  },
  {
    name: 'Dadar TT Circle & Station',
    displayName: 'Dadar TT Circle & Police Station, Dr. B.A. Road, Dadar East, Mumbai 400014',
    lat: 19.0178,
    lon: 72.8478,
    type: 'transit_station'
  },
  {
    name: 'Kurla West Junction',
    displayName: 'Kurla West Station Junction, LBS Marg, Kurla West, Mumbai 400070',
    lat: 19.0657,
    lon: 72.8794,
    type: 'junction'
  },
  {
    name: 'Borivali West Station',
    displayName: 'Borivali Railway Station West, Chandavarkar Road, Borivali West, Mumbai 400092',
    lat: 19.2291,
    lon: 72.8574,
    type: 'transit_station'
  },
  {
    name: 'CSMT Mumbai Central Hub',
    displayName: 'Chhatrapati Shivaji Maharaj Terminus (CSMT), Fort, Mumbai 400001',
    lat: 18.9401,
    lon: 72.8354,
    type: 'transit_station'
  }
];

function formatCategoryBadge(candidate) {
  const rawType = (candidate.type || candidate.category || candidate.class || 'place').toLowerCase();
  const map = {
    police: 'Police Station',
    station: 'Transit Station',
    transit_station: 'Transit Hub',
    bus_stop: 'Bus Stop',
    hospital: 'Hospital / Clinic',
    clinic: 'Health Facility',
    apartments: 'Residential Building',
    commercial: 'Commercial Complex',
    supermarket: 'Market / Commercial',
    mall: 'Shopping Mall',
    school: 'School / Institution',
    college: 'University / College',
    suburb: 'Neighbourhood',
    residential: 'Street',
    primary: 'Main Road',
    secondary: 'Road',
    tertiary: 'Local Road',
    junction: 'Traffic Junction',
    manual_coordinates: 'GPS Coordinates'
  };
  return map[rawType] || rawType.replace(/_/g, ' ');
}

function buildAddressSubtitle(candidate) {
  const addr = candidate.address;
  if (!addr) return candidate.display_name;

  const parts = [];
  const road = addr.road || addr.street || addr.pedestrian || addr.footway;
  if (road && !candidate.name?.toLowerCase().includes(road.toLowerCase())) {
    parts.push(road);
  }
  const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.subdistrict;
  if (locality) parts.push(locality);

  const city = addr.city || addr.town || addr.municipality || addr.city_district;
  if (city) parts.push(city);

  if (addr.postcode) parts.push(`PIN: ${addr.postcode}`);
  if (addr.state) parts.push(addr.state);

  return parts.length > 0 ? parts.join(', ') : candidate.display_name;
}

export default function AddressSearchSelector({
  onLocationConfirmed,
  onUnconfirmedQueryChange,
  initialLocation = null
}) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchNotice, setSearchNotice] = useState(null);
  const [confirmedLocation, setConfirmedLocation] = useState(initialLocation);

  // Search preferences: default focus to India & Mumbai region
  const [focusIndia, setFocusIndia] = useState(true);

  // Manual GPS entry mode
  const [manualMode, setManualMode] = useState(false);
  const [manualForm, setManualForm] = useState({
    displayName: '',
    lat: '',
    lon: ''
  });
  const [manualError, setManualError] = useState(null);

  // Google Maps API Key check (New Google Places Autocomplete evaluation)
  const googleMapsApiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || '';
  const isGoogleConfigured = Boolean(googleMapsApiKey && googleMapsApiKey.trim());
  const googleInputRef = useRef(null);

  const abortControllerRef = useRef(null);
  const queryCacheRef = useRef(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Update initial location if prop changes
  useEffect(() => {
    if (initialLocation) {
      setConfirmedLocation(initialLocation);
    }
  }, [initialLocation]);

  // Google Places Autocomplete initialization if API key is provided in .env
  useEffect(() => {
    if (!isGoogleConfigured || confirmedLocation || manualMode) return;

    let isMounted = true;

    const setupGooglePlaces = () => {
      if (!window.google?.maps?.places || !googleInputRef.current) return;

      try {
        const autocomplete = new window.google.maps.places.Autocomplete(googleInputRef.current, {
          fields: ['geometry', 'formatted_address', 'name', 'address_components'],
          componentRestrictions: { country: 'in' }
        });

        autocomplete.addListener('place_changed', () => {
          if (!isMounted) return;
          const place = autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) {
            setSearchError('Selected place does not contain valid GPS coordinates.');
            return;
          }

          const confirmed = {
            displayName: place.formatted_address || place.name,
            shortName: place.name || (place.formatted_address ? place.formatted_address.split(',')[0] : 'Selected Place'),
            lat: place.geometry.location.lat(),
            lon: place.geometry.location.lng(),
            type: 'google_places'
          };

          setConfirmedLocation(confirmed);
          setCandidates([]);
          setSearched(false);
          setQuery('');
          setSearchError(null);

          if (onLocationConfirmed) onLocationConfirmed(confirmed);
          if (onUnconfirmedQueryChange) onUnconfirmedQueryChange(false);
        });
      } catch (err) {
        console.warn('Google Places initialization warning:', err);
      }
    };

    if (window.google?.maps?.places) {
      setupGooglePlaces();
    } else {
      const scriptId = 'google-maps-places-script';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
          googleMapsApiKey
        )}&libraries=places&v=weekly`;
        script.async = true;
        script.onload = () => {
          if (isMounted) setupGooglePlaces();
        };
        script.onerror = () => {
          console.warn('Failed to load Google Maps script with configured key.');
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      isMounted = false;
    };
  }, [isGoogleConfigured, confirmedLocation, manualMode, googleMapsApiKey, onLocationConfirmed, onUnconfirmedQueryChange]);

  /**
   * On-Demand Geocoding Search:
   * Complies with public endpoint policy — executed strictly on demand, never as-you-type autocomplete.
   */
  const performOnDemandSearch = useCallback(
    async (rawQuery, useCountryFilter = focusIndia) => {
      const cleanQuery = rawQuery.trim();
      if (!cleanQuery) return;

      setSearching(true);
      setSearchError(null);
      setSearchNotice(null);
      setSearched(true);
      setCandidates([]);

      const cacheKey = `${useCountryFilter ? 'IN' : 'GLOBAL'}:${cleanQuery.toLowerCase()}`;
      if (queryCacheRef.current.has(cacheKey)) {
        setCandidates(queryCacheRef.current.get(cacheKey));
        setSearching(false);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        // Biasing parameters: Mumbai region viewbox + India country filter
        const countryParam = useCountryFilter ? '&countrycodes=in' : '';
        // Viewbox bounding box encompassing Greater Mumbai & Mumbai Metropolitan Region
        const mumbaiViewbox = useCountryFilter ? '&viewbox=72.775,18.890,73.050,19.320&bounded=0' : '';

        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
          cleanQuery
        )}&limit=10&addressdetails=1&extratags=1${countryParam}${mumbaiViewbox}`;

        const response = await fetch(url, {
          method: 'GET',
          signal: abortControllerRef.current.signal,
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en'
          }
        });

        if (response.status === 429) {
          throw new Error('RATE_LIMITED');
        }
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }

        let data = await response.json();
        if (!Array.isArray(data)) {
          data = [];
        }

        // Fallback: If 0 results with strict viewbox, attempt query without viewbox
        if (data.length === 0 && useCountryFilter) {
          const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
            cleanQuery
          )}&limit=10&addressdetails=1${countryParam}`;

          const fallbackRes = await fetch(fallbackUrl, {
            method: 'GET',
            signal: abortControllerRef.current.signal,
            headers: { Accept: 'application/json', 'Accept-Language': 'en' }
          });
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (Array.isArray(fallbackData) && fallbackData.length > 0) {
              data = fallbackData;
              setSearchNotice(`Expanded search outside Mumbai metropolitan bounds for "${cleanQuery}".`);
            }
          }
        }

        queryCacheRef.current.set(cacheKey, data);
        setCandidates(data);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Geocoding lookup error:', err);
        if (err.message === 'RATE_LIMITED') {
          setSearchError('Geocoding rate limit reached. Please wait a few seconds or use Manual GPS entry.');
        } else {
          setSearchError('Unable to complete location search. Check network connection or enter GPS coordinates manually.');
        }
      } finally {
        setSearching(false);
      }
    },
    [focusIndia]
  );

  const handleQueryChange = (val) => {
    setQuery(val);
    setSearchError(null);
    setSearchNotice(null);

    if (searched && !confirmedLocation) {
      setSearched(false);
      setCandidates([]);
    }

    if (onUnconfirmedQueryChange) {
      onUnconfirmedQueryChange(val.trim().length > 0 && !confirmedLocation);
    }
  };

  const handleTriggerSearch = (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    performOnDemandSearch(query);
  };

  const handleConfirmCandidate = (cand) => {
    const lat = parseFloat(cand.lat);
    const lon = parseFloat(cand.lon);

    if (isNaN(lat) || isNaN(lon)) {
      setSearchError('Candidate location has invalid coordinates.');
      return;
    }

    const shortName = cand.name || cand.display_name.split(',')[0].trim();
    const confirmed = {
      displayName: cand.display_name,
      shortName,
      lat,
      lon,
      type: cand.type || cand.category || cand.class || 'place'
    };

    setConfirmedLocation(confirmed);
    setCandidates([]);
    setSearched(false);
    setQuery('');
    setSearchError(null);
    setSearchNotice(null);
    setManualMode(false);

    if (onLocationConfirmed) onLocationConfirmed(confirmed);
    if (onUnconfirmedQueryChange) onUnconfirmedQueryChange(false);
  };

  const handleSelectHub = (hub) => {
    const confirmed = {
      displayName: hub.displayName,
      shortName: hub.name,
      lat: hub.lat,
      lon: hub.lon,
      type: hub.type
    };

    setConfirmedLocation(confirmed);
    setCandidates([]);
    setSearched(false);
    setQuery('');
    setSearchError(null);
    setManualMode(false);

    if (onLocationConfirmed) onLocationConfirmed(confirmed);
    if (onUnconfirmedQueryChange) onUnconfirmedQueryChange(false);
  };

  const handleConfirmManualLocation = (e) => {
    if (e) e.preventDefault();
    setManualError(null);

    const name = manualForm.displayName.trim();
    const lat = parseFloat(manualForm.lat);
    const lon = parseFloat(manualForm.lon);

    if (!name) {
      setManualError('Please provide a landmark, street or address description.');
      return;
    }
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setManualError('Latitude must be a valid number between -90.0 and 90.0.');
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setManualError('Longitude must be a valid number between -180.0 and 180.0.');
      return;
    }

    const confirmed = {
      displayName: name,
      shortName: name.split(',')[0].trim(),
      lat,
      lon,
      type: 'manual_coordinates'
    };

    setConfirmedLocation(confirmed);
    setManualMode(false);
    setCandidates([]);
    setSearched(false);
    setQuery('');

    if (onLocationConfirmed) onLocationConfirmed(confirmed);
    if (onUnconfirmedQueryChange) onUnconfirmedQueryChange(false);
  };

  const handleClearLocation = () => {
    setConfirmedLocation(null);
    setCandidates([]);
    setSearched(false);
    setQuery('');
    setSearchError(null);
    setSearchNotice(null);
    setManualMode(false);

    if (onLocationConfirmed) onLocationConfirmed(null);
    if (onUnconfirmedQueryChange) onUnconfirmedQueryChange(false);
  };

  const handleStartCoordinateAdjustment = () => {
    if (confirmedLocation) {
      setManualForm({
        displayName: confirmedLocation.displayName,
        lat: String(confirmedLocation.lat),
        lon: String(confirmedLocation.lon)
      });
      setConfirmedLocation(null);
    }
    setManualMode(true);
    setCandidates([]);
    setSearched(false);
  };

  return (
    <div className="address-selector-container">
      {/* 1. Confirmed Location Card */}
      {confirmedLocation ? (
        <div className="confirmed-location-card">
          <div className="confirmed-location-header">
            <div>
              <div className="confirmed-location-title-box">
                <CheckCircle2 size={16} />
                <span>Confirmed Last Seen Location</span>
                {confirmedLocation.type === 'manual_coordinates' && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--color-midnight)',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '4px',
                      marginLeft: '0.4rem',
                      fontWeight: 600
                    }}
                  >
                    Custom GPS
                  </span>
                )}
                {confirmedLocation.type === 'google_places' && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#065F46',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '4px',
                      marginLeft: '0.4rem',
                      fontWeight: 600
                    }}
                  >
                    Google Places
                  </span>
                )}
              </div>
              <p className="confirmed-address-text">{confirmedLocation.displayName}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                onClick={handleStartCoordinateAdjustment}
                title="Fine-tune latitude & longitude"
              >
                <Sliders size={13} /> Adjust GPS
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                onClick={handleClearLocation}
                title="Change or re-search location"
              >
                <RotateCcw size={13} /> Change
              </button>
            </div>
          </div>

          {/* Coordinates Strip */}
          <div className="coordinates-strip">
            <span className="coordinate-pill">
              <strong>Latitude:</strong> {confirmedLocation.lat.toFixed(5)}°{' '}
              {confirmedLocation.lat >= 0 ? 'N' : 'S'}
            </span>
            <span className="coordinate-pill">
              <strong>Longitude:</strong> {confirmedLocation.lon.toFixed(5)}°{' '}
              {confirmedLocation.lon >= 0 ? 'E' : 'W'}
            </span>
            <a
              href={`https://www.openstreetmap.org/?mlat=${confirmedLocation.lat}&mlon=${confirmedLocation.lon}#map=16/${confirmedLocation.lat}/${confirmedLocation.lon}`}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-ghost"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: 'var(--color-midnight)' }}
            >
              <ExternalLink size={12} /> Open in OSM
            </a>
          </div>

          {/* Map Preview Frame */}
          <div style={{ position: 'relative', width: '100%', height: '180px' }}>
            <iframe
              title="Location Map Preview"
              className="map-preview-frame"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${(
                confirmedLocation.lon - 0.008
              ).toFixed(5)}%2C${(confirmedLocation.lat - 0.008).toFixed(5)}%2C${(
                confirmedLocation.lon + 0.008
              ).toFixed(5)}%2C${(confirmedLocation.lat + 0.008).toFixed(
                5
              )}&layer=mapnik&marker=${confirmedLocation.lat.toFixed(5)}%2C${confirmedLocation.lon.toFixed(5)}`}
            />
          </div>

          {/* Provider Attribution */}
          <div className="map-attribution">
            <span>
              Geocoding & Maps: ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap contributors
              </a>{' '}
              (ODbL)
            </span>
            <span>Numeric coordinates automatically attached for case dossier</span>
          </div>
        </div>
      ) : manualMode ? (
        /* 2. Manual Coordinate & Custom Landmark Input Mode */
        <div
          className="manual-coordinates-box"
          style={{
            padding: '1rem',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: '#F8FAFC'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 700,
                fontSize: '0.82rem',
                color: 'var(--color-dark)'
              }}
            >
              <Navigation size={15} style={{ color: 'var(--color-midnight)' }} />
              <span>Direct GPS Coordinates & Custom Landmark</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => {
                setManualMode(false);
                setManualError(null);
              }}
            >
              Back to Address Search
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>
                Landmark or Street Description <span className="required-star">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Near Shop 4, Linking Road, Khar West, Mumbai"
                value={manualForm.displayName}
                onChange={(e) => setManualForm({ ...manualForm, displayName: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>
                  Latitude (e.g. 19.0657) <span className="required-star">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  placeholder="19.0657"
                  value={manualForm.lat}
                  onChange={(e) => setManualForm({ ...manualForm, lat: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>
                  Longitude (e.g. 72.8340) <span className="required-star">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  placeholder="72.8340"
                  value={manualForm.lon}
                  onChange={(e) => setManualForm({ ...manualForm, lon: e.target.value })}
                />
              </div>
            </div>

            {manualError && (
              <div
                className="alert-banner error"
                style={{ padding: '0.45rem 0.65rem', fontSize: '0.75rem', marginTop: '0.2rem' }}
              >
                <AlertCircle size={14} className="shrink-0" />
                <span>{manualError}</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '0.35rem'
              }}
            >
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                GPS values will be recorded in the missing-persons registry.
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => setManualMode(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.85rem' }}
                  onClick={handleConfirmManualLocation}
                >
                  <CheckCircle2 size={13} /> Confirm Coordinates
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 3. Address Search & Hub Selector Mode */
        <div className="address-search-wrapper">
          {/* Provider Notification Banner */}
          {!isGoogleConfigured && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.4rem 0.65rem',
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '0.5rem',
                fontSize: '0.72rem',
                color: '#475569'
              }}
            >
              <Info size={13} className="shrink-0 text-slate-500" />
              <span>
                <strong>Google Places Autocomplete:</strong> Ready for activation once{' '}
                <code style={{ fontSize: '0.7rem', padding: '0.1rem 0.3rem', background: '#E2E8F0', borderRadius: '3px' }}>
                  VITE_GOOGLE_MAPS_API_KEY
                </code>{' '}
                is configured. On-demand search & manual GPS mode active.
              </span>
            </div>
          )}

          {/* Search Box */}
          <div className="address-search-box">
            <div className="address-search-input-wrapper">
              <MapPin size={15} className="search-icon" />
              <input
                ref={googleInputRef}
                type="text"
                className="address-input form-input"
                style={{ paddingLeft: '2.3rem', paddingRight: '2.2rem' }}
                placeholder="Search landmark, street, hospital, station, or neighbourhood..."
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTriggerSearch(e);
                  }
                }}
              />
              {query && (
                <button
                  type="button"
                  className="address-clear-btn"
                  onClick={() => handleQueryChange('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ whiteSpace: 'nowrap' }}
              onClick={handleTriggerSearch}
              disabled={searching || !query.trim()}
            >
              {searching ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Searching...
                </>
              ) : (
                <>
                  <Search size={14} /> Search Location
                </>
              )}
            </button>
          </div>

          {/* Search Helper Options */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '0.35rem',
              fontSize: '0.73rem',
              color: 'var(--color-text-muted)'
            }}
          >
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={focusIndia}
                onChange={(e) => setFocusIndia(e.target.checked)}
              />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <Globe size={12} /> Focus Mumbai / India
              </span>
            </label>

            <button
              type="button"
              style={{
                fontSize: '0.73rem',
                color: 'var(--color-midnight)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
              onClick={() => {
                setManualForm({
                  displayName: query.trim() || '',
                  lat: '',
                  lon: ''
                });
                setManualMode(true);
              }}
            >
              Enter GPS coordinates manually
            </button>
          </div>

          {/* Quick Mumbai Police Command Presets */}
          <div style={{ marginTop: '0.65rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                marginBottom: '0.35rem',
                letterSpacing: '0.04em'
              }}
            >
              <Building size={12} />
              <span>Quick Select Major Police Stations & Transit Hubs:</span>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.35rem'
              }}
            >
              {MUMBAI_POLICE_HUBS.map((hub) => (
                <button
                  key={hub.name}
                  type="button"
                  onClick={() => handleSelectHub(hub)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.25rem 0.55rem',
                    background: '#FFFFFF',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--color-dark)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-midnight)';
                    e.currentTarget.style.background = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                    e.currentTarget.style.background = '#FFFFFF';
                  }}
                >
                  <MapPin size={11} style={{ color: 'var(--color-teal)' }} />
                  <span>{hub.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notice (Fallback expansion alert) */}
          {searchNotice && (
            <div
              className="alert-banner warning"
              style={{ marginTop: '0.5rem', padding: '0.45rem 0.75rem', fontSize: '0.74rem' }}
            >
              <AlertCircle size={14} className="shrink-0" />
              <span>{searchNotice}</span>
            </div>
          )}

          {/* Error Message */}
          {searchError && (
            <div className="alert-banner error" style={{ marginTop: '0.5rem', padding: '0.45rem 0.75rem' }}>
              <AlertCircle size={15} className="shrink-0" />
              <p style={{ fontSize: '0.75rem' }}>{searchError}</p>
            </div>
          )}

          {/* No results message */}
          {searched && !searching && candidates.length === 0 && !searchError && (
            <div className="alert-banner warning" style={{ marginTop: '0.65rem' }}>
              <AlertCircle size={16} className="shrink-0" />
              <div style={{ fontSize: '0.76rem' }}>
                <strong>No Location Matches Found for "{query}":</strong>
                <p style={{ marginTop: '0.2rem' }}>
                  The specific name was not found. You can:
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                    onClick={() => {
                      setManualForm({
                        displayName: query,
                        lat: '',
                        lon: ''
                      });
                      setManualMode(true);
                    }}
                  >
                    <Navigation size={12} /> Enter GPS Coordinates Directly
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                    onClick={() => handleSelectHub(MUMBAI_POLICE_HUBS[0])}
                  >
                    <MapPin size={12} /> Use Bandra Police Station
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Candidate Results List */}
          {candidates.length > 0 && (
            <div className="address-candidates-list" style={{ marginTop: '0.65rem', maxHeight: '260px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--color-dark)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                <span>Select & Confirm Location ({candidates.length} matches):</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  OSM Geocoding
                </span>
              </div>

              {candidates.map((cand) => {
                const title = cand.name || cand.display_name.split(',')[0].trim();
                const subtitle = buildAddressSubtitle(cand);
                const badge = formatCategoryBadge(cand);
                const lat = parseFloat(cand.lat);
                const lon = parseFloat(cand.lon);

                return (
                  <div key={cand.place_id || `${lat}-${lon}`} className="address-candidate-item">
                    <div className="address-candidate-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span className="address-candidate-badge">{badge}</span>
                        {cand.address?.postcode && (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '0.1rem 0.35rem',
                              background: '#E2E8F0',
                              color: '#334155',
                              borderRadius: '3px',
                              fontWeight: 600
                            }}
                          >
                            {cand.address.postcode}
                          </span>
                        )}
                      </div>
                      <p className="address-candidate-title">{title}</p>
                      <p className="address-candidate-sub">{subtitle}</p>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--color-text-light)',
                          marginTop: '0.2rem',
                          display: 'block',
                          fontFamily: 'monospace'
                        }}
                      >
                        GPS: {lat.toFixed(5)}°, {lon.toFixed(5)}°
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.35rem 0.75rem',
                        whiteSpace: 'nowrap',
                        alignSelf: 'center'
                      }}
                      onClick={() => handleConfirmCandidate(cand)}
                    >
                      Select & Confirm
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
