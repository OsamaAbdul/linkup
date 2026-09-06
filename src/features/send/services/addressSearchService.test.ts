import { describe, it, expect } from 'vitest';
import {
  searchAddresses,
  findBestCoordinatesForAddress,
  getPopularQuickPicks,
} from './addressSearchService';

describe('addressSearchService', () => {
  it('returns popular quick picks when query is empty or short', async () => {
    const picks = await searchAddresses('');
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.some((p) => p.primaryTitle.includes('Wuse 2'))).toBe(true);
  });

  it('matches local Nigerian locations by area or landmark', async () => {
    const results = await searchAddresses('Gwarinpa');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].displayName.toLowerCase()).toContain('gwarinpa');
    expect(results[0].latitude).toBeCloseTo(9.1124, 2);
    expect(results[0].longitude).toBeCloseTo(7.4101, 2);
  });

  it('matches Lagos locations like Lekki Phase 1', async () => {
    const results = await searchAddresses('Lekki Phase 1');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].primaryTitle).toContain('Lekki Phase 1');
    expect(results[0].latitude).toBeCloseTo(6.4474, 2);
  });

  it('infers coordinates from freeform address text without clicking dropdown', () => {
    const match = findBestCoordinatesForAddress('Suite 4, Banex Plaza, Aminu Kano Crescent, Abuja');
    expect(match).not.toBeNull();
    expect(match?.latitude).toBeCloseTo(9.0837, 2);
    expect(match?.longitude).toBeCloseTo(7.4746, 2);
  });

  it('infers city coordinates when only city name is typed', () => {
    const match = findBestCoordinatesForAddress('Wuse 2, Abuja, Nigeria');
    expect(match).not.toBeNull();
    expect(match?.latitude).toBeDefined();
    expect(match?.longitude).toBeDefined();
  });

  it('searches keyword addresses like "kedi hotel abuja" and returns live coordinates', async () => {
    const results = await searchAddresses('kedi hotel abuja');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].latitude).toBeDefined();
    expect(results[0].longitude).toBeDefined();
    expect(typeof results[0].latitude).toBe('number');
    expect(typeof results[0].longitude).toBe('number');
  });

  it('searches "Doma, Nasarawa State" and returns exact coordinates', async () => {
    const results = await searchAddresses('Doma, Nasarawa State');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].primaryTitle).toContain('Doma');
    expect(results[0].latitude).toBeCloseTo(8.3923, 2);
    expect(results[0].longitude).toBeCloseTo(8.3565, 2);
  });
});
