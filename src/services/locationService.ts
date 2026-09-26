import { LocationInfo } from '../types/issue';

/**
 * Reverse geocodes latitude and longitude using standard OpenStreetMap Nominatim.
 * Extracts address, ward (suburb/neighbourhood), and municipality (city/town).
 * If unavailable, outputs honest 'Ward information unavailable' without fabrication.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<LocationInfo> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'CivicPulse-App/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Reverse geocode failed with status ${response.status}`);
    }

    const data = await response.json();
    const addressDetails = data.address || {};

    const road = addressDetails.road || addressDetails.pedestrian || addressDetails.street || '';
    const suburb = addressDetails.suburb || addressDetails.neighbourhood || addressDetails.quarter || '';
    const city = addressDetails.city || addressDetails.town || addressDetails.municipality || addressDetails.county || 'Metro Region';
    
    // Exact ward extraction without inventing
    let ward = addressDetails.city_district || addressDetails.suburb || addressDetails.neighbourhood;
    if (!ward) {
      ward = 'Ward information unavailable';
    } else {
      ward = `Ward / ${ward}`;
    }

    const displayParts = [road, suburb, city].filter(Boolean);
    const formattedAddress = displayParts.length > 0 ? displayParts.join(', ') : (data.display_name?.split(',').slice(0, 3).join(', ') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`);

    return {
      latitude: lat,
      longitude: lon,
      address: formattedAddress,
      ward: ward,
      municipality: city,
    };
  } catch (err) {
    console.warn('Geocoding service unavailable:', err);
    return {
      latitude: lat,
      longitude: lon,
      address: `Location coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      ward: 'Ward information unavailable',
      municipality: 'Local Municipality',
    };
  }
}

/**
 * Search places for city/neighbourhood search bar
 */
export async function searchPlaces(query: string): Promise<Array<{ label: string; lat: number; lon: number }>> {
  if (!query || query.trim().length < 2) return [];

  try {
    const encoded = encodeURIComponent(query.trim());
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=5&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'CivicPulse-App/1.0',
        },
      }
    );

    if (!response.ok) return [];
    const results = await response.json();

    return results.map((item: any) => ({
      label: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
    }));
  } catch (err) {
    console.warn('Search query failed:', err);
    return [];
  }
}
