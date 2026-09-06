import {
  POPULAR_NIGERIAN_LOCATIONS,
  POPULAR_QUICK_PICKS,
  NigerianLocationItem,
} from '../data/nigerianLocations';
import { SavedAddress } from '../types';
import {
  searchGooglePlaces,
  getGooglePlaceDetails,
} from '../utils/googleMapsLoader';

export interface AddressSuggestion {
  id: string;
  displayName: string;
  primaryTitle: string;
  subtitle: string;
  category?: 'saved' | 'district' | 'mall' | 'plaza' | 'estate' | 'landmark' | 'transit' | 'commercial' | 'search';
  latitude?: number;
  longitude?: number;
  placeId?: string;
  isSaved?: boolean;
}

/**
 * Searches curated Nigerian locations with scoring and ranking
 */
function searchLocalLocations(query: string, limit = 8): AddressSuggestion[] {
  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) return [];

  const queryTerms = cleanQuery.split(/\s+/).filter(Boolean);

  const scored: Array<{ item: NigerianLocationItem; score: number }> = [];

  for (const item of POPULAR_NIGERIAN_LOCATIONS) {
    let score = 0;
    const nameLower = item.name.toLowerCase();
    const titleLower = item.primaryTitle.toLowerCase();
    const areaLower = item.area.toLowerCase();
    const cityLower = item.city.toLowerCase();

    // Direct starts-with match on title or area
    if (titleLower.startsWith(cleanQuery) || areaLower.startsWith(cleanQuery)) {
      score += 120;
    } else if (nameLower.startsWith(cleanQuery)) {
      score += 100;
    }

    // Exact word or substring matches
    for (const term of queryTerms) {
      if (titleLower.includes(term)) score += 50;
      else if (areaLower.includes(term)) score += 40;
      else if (nameLower.includes(term)) score += 30;
      else if (cityLower.includes(term)) score += 20;

      // Keyword match
      if (item.keywords.some((k) => k.toLowerCase().includes(term))) {
        score += 25;
      }
    }

    if (score > 0) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ item }) => ({
    id: item.id,
    displayName: item.name,
    primaryTitle: item.primaryTitle,
    subtitle: item.subtitle,
    category: item.category,
    latitude: item.latitude,
    longitude: item.longitude,
  }));
}

/**
 * Formats saved addresses as suggestions matching query
 */
function searchSavedAddresses(query: string, saved?: SavedAddress[]): AddressSuggestion[] {
  if (!saved || saved.length === 0) return [];
  const clean = query.toLowerCase().trim();

  return saved
    .filter((s) => {
      if (!clean) return true;
      return (
        s.label?.toLowerCase().includes(clean) ||
        s.address.toLowerCase().includes(clean) ||
        s.contact_name?.toLowerCase().includes(clean)
      );
    })
    .slice(0, 3)
    .map((s) => ({
      id: `saved-${s.id}`,
      displayName: s.address,
      primaryTitle: s.label ? `${s.label}: ${s.address.split(',')[0]}` : s.address.split(',')[0],
      subtitle: s.directions || s.address,
      category: 'saved',
      latitude: s.latitude,
      longitude: s.longitude,
      isSaved: true,
    }));
}

/**
 * Online Geocoding via Nominatim/Photon with strict timeout
 */
async function searchOnlineGeocode(query: string, timeoutMs = 2500): Promise<AddressSuggestion[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query.trim()
      )}&countrycodes=ng&addressdetails=1&limit=5`,
      {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'en',
        },
      }
    );

    clearTimeout(timeoutId);
    if (!res.ok) return [];

    const data = await res.json();
    return (data || []).map((d: any) => {
      const parts = (d.display_name || '').split(',');
      return {
        id: `online-${d.place_id || Math.random()}`,
        displayName: d.display_name,
        primaryTitle: parts.slice(0, 2).join(',').trim(),
        subtitle: parts.slice(2).join(',').trim() || 'Nigeria',
        category: 'search',
        latitude: parseFloat(d.lat),
        longitude: parseFloat(d.lon),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Returns popular quick pick suggestions when query is empty
 */
export function getPopularQuickPicks(saved?: SavedAddress[]): AddressSuggestion[] {
  const savedPicks = searchSavedAddresses('', saved);

  const localPicks: AddressSuggestion[] = POPULAR_QUICK_PICKS.map((item) => ({
    id: item.id,
    displayName: item.name,
    primaryTitle: item.primaryTitle,
    subtitle: item.subtitle,
    category: item.category,
    latitude: item.latitude,
    longitude: item.longitude,
  }));

  return [...savedPicks, ...localPicks];
}

/**
 * Unified multi-tiered address search
 */
export async function searchAddresses(
  query: string,
  savedAddresses?: SavedAddress[]
): Promise<AddressSuggestion[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) {
    return getPopularQuickPicks(savedAddresses);
  }

  // 1. Check saved addresses
  const savedResults = searchSavedAddresses(cleanQuery, savedAddresses);

  // 2. Check instant local curated locations (0ms latency)
  const localResults = searchLocalLocations(cleanQuery, 6);

  // 3. Check Google Places if available
  let googleResults: AddressSuggestion[] = [];
  try {
    const gList = await searchGooglePlaces(cleanQuery);
    if (gList.length > 0) {
      googleResults = gList.map((g) => ({
        id: `g-${g.placeId}`,
        displayName: g.displayName,
        primaryTitle: g.mainText,
        subtitle: g.secondaryText,
        placeId: g.placeId,
        category: 'search',
      }));
    }
  } catch {}

  // Combine local and saved results
  const combined = [...savedResults, ...localResults, ...googleResults];
  if (combined.length >= 3) {
    return combined;
  }

  // 4. Otherwise fallback to online geocoding with 2s timeout
  const onlineResults = await searchOnlineGeocode(cleanQuery, 2000);
  const allResults = [...combined, ...onlineResults];

  // 5. Smart Keyword Address Resolver:
  // If user enters an arbitrary keyword (e.g. "kedi hotel abuja") and no exact POI exists,
  // infer the best area and offer an immediate live map pinpoint suggestion!
  if (allResults.length === 0) {
    const areaMatch = findBestCoordinatesForAddress(cleanQuery);
    if (areaMatch) {
      allResults.push({
        id: `smart-keyword-${cleanQuery.replace(/\s+/g, '-')}`,
        displayName: `${cleanQuery}, ${areaMatch.matchedArea || 'Abuja'}`,
        primaryTitle: cleanQuery
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        subtitle: `Match in ${areaMatch.matchedArea || 'Nigeria'} • Tap map to adjust pin`,
        category: 'landmark',
        latitude: areaMatch.latitude,
        longitude: areaMatch.longitude,
      });
    }
  }

  return allResults;
}

/**
 * Resolves a suggestion to guaranteed latitude & longitude coordinates
 */
export async function resolveSuggestionCoordinates(
  item: AddressSuggestion
): Promise<{ address: string; latitude: number; longitude: number } | null> {
  // If coordinates already exist (Local curated, saved address, or geocoded)
  if (typeof item.latitude === 'number' && typeof item.longitude === 'number') {
    return {
      address: item.displayName || item.primaryTitle,
      latitude: item.latitude,
      longitude: item.longitude,
    };
  }

  // If from Google Places, fetch exact details
  if (item.placeId) {
    const details = await getGooglePlaceDetails(item.placeId);
    if (details) {
      return details;
    }
  }

  // Fallback: match text against local database
  const fallback = findBestCoordinatesForAddress(item.displayName || item.primaryTitle);
  if (fallback) {
    return {
      address: item.displayName || item.primaryTitle,
      latitude: fallback.latitude,
      longitude: fallback.longitude,
    };
  }

  return null;
}

/**
 * Smart best-match coordinate detector from free text
 * (e.g. if user types "House 12, 3rd Avenue, Gwarinpa, Abuja",
 * matches "Gwarinpa" and returns coordinates automatically).
 */
export function findBestCoordinatesForAddress(
  addressText: string
): { latitude: number; longitude: number; matchedArea?: string } | null {
  if (!addressText || addressText.trim().length < 2) return null;
  const textLower = addressText.toLowerCase();

  // Pass 1: Match specific primary title (e.g. "Banex Plaza", "Jabi Lake Mall", "Ikeja City Mall")
  for (const item of POPULAR_NIGERIAN_LOCATIONS) {
    const titleLower = item.primaryTitle.toLowerCase();
    if (textLower.includes(titleLower)) {
      return {
        latitude: item.latitude,
        longitude: item.longitude,
        matchedArea: item.primaryTitle,
      };
    }
  }

  // Pass 2: Match areas and districts (e.g. "Gwarinpa", "Maitama", "Lekki")
  for (const item of POPULAR_NIGERIAN_LOCATIONS) {
    const areaLower = item.area.toLowerCase();
    if (textLower.includes(areaLower)) {
      return {
        latitude: item.latitude,
        longitude: item.longitude,
        matchedArea: item.primaryTitle,
      };
    }
  }

  // Pass 3: Check keyword inclusion
  for (const item of POPULAR_NIGERIAN_LOCATIONS) {
    for (const keyword of item.keywords) {
      if (keyword.length > 3 && textLower.includes(keyword.toLowerCase())) {
        return {
          latitude: item.latitude,
          longitude: item.longitude,
          matchedArea: item.primaryTitle,
        };
      }
    }
  }

  // General city fallback
  if (textLower.includes('abuja') || textLower.includes('fct')) {
    return { latitude: 9.0765, longitude: 7.3986, matchedArea: 'Abuja Central' };
  }
  if (textLower.includes('lagos')) {
    return { latitude: 6.5244, longitude: 3.3792, matchedArea: 'Lagos Central' };
  }
  if (textLower.includes('port harcourt') || textLower.includes('rivers')) {
    return { latitude: 4.8156, longitude: 7.0498, matchedArea: 'Port Harcourt' };
  }
  if (textLower.includes('ibadan')) {
    return { latitude: 7.3775, longitude: 3.947, matchedArea: 'Ibadan' };
  }
  if (textLower.includes('kano')) {
    return { latitude: 12.0022, longitude: 8.592, matchedArea: 'Kano' };
  }
  if (textLower.includes('doma')) {
    return { latitude: 8.3923, longitude: 8.3565, matchedArea: 'Doma, Nasarawa' };
  }
  if (textLower.includes('nasarawa') || textLower.includes('nassarawa')) {
    if (textLower.includes('keffi')) return { latitude: 8.8486, longitude: 7.8736, matchedArea: 'Keffi, Nasarawa' };
    if (textLower.includes('mararaba') || textLower.includes('karu')) return { latitude: 9.0065, longitude: 7.5852, matchedArea: 'Mararaba, Nasarawa' };
    return { latitude: 8.4932, longitude: 8.5153, matchedArea: 'Lafia, Nasarawa' };
  }

  return null;
}
