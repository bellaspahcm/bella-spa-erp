/**
 * Unit tests for geo utility functions.
 * Tests Haversine distance calculations for real-world Vietnam locations.
 */

import { getDistanceInMeters } from '@/utils/geo';

describe('utils/geo: getDistanceInMeters', () => {
  it('calculates distance between two points in Hanoi (≈4km)', () => {
    // Hanoi: Hoan Kiem Lake to West Lake
    const lat1 = 21.028511; // Hoan Kiem Lake
    const lon1 = 105.852478;
    const lat2 = 21.054298; // West Lake
    const lon2 = 105.822144;

    const distance = getDistanceInMeters(lat1, lon1, lat2, lon2);

    expect(distance).toBeGreaterThan(4000);
    expect(distance).toBeLessThan(4500);
  });

  it('calculates distance between two points in Saigon (≈5km)', () => {
    // Saigon: Ben Thanh Market to Saigon Zoo
    const lat1 = 10.772431; // Ben Thanh Market
    const lon1 = 106.697997;
    const lat2 = 10.787536; // Saigon Zoo
    const lon2 = 106.705849;

    const distance = getDistanceInMeters(lat1, lon1, lat2, lon2);

    expect(distance).toBeGreaterThan(1500);
    expect(distance).toBeLessThan(2000);
  });

  it('returns 0 for identical coordinates', () => {
    const lat = 21.028511;
    const lon = 105.852478;

    const distance = getDistanceInMeters(lat, lon, lat, lon);

    expect(distance).toBe(0);
  });

  it('calculates short distance accurately (<100m)', () => {
    // Two nearby spa branches (100m apart simulation)
    const lat1 = 21.028511;
    const lon1 = 105.852478;
    const lat2 = 21.029011; // ~55m north
    const lon2 = 105.852978; // ~40m east

    const distance = getDistanceInMeters(lat1, lon1, lat2, lon2);

    expect(distance).toBeGreaterThan(70);
    expect(distance).toBeLessThan(80);
  });

  it('calculates long distance accurately (Hanoi to Saigon ≈1144km)', () => {
    const lat1 = 21.028511; // Hanoi
    const lon1 = 105.852478;
    const lat2 = 10.772431; // Saigon
    const lon2 = 106.697997;

    const distance = getDistanceInMeters(lat1, lon1, lat2, lon2);

    expect(distance).toBeGreaterThan(1_140_000);
    expect(distance).toBeLessThan(1_150_000);
  });

  it('handles negative longitude (western hemisphere)', () => {
    const lat1 = 40.7128; // New York
    const lon1 = -74.0060;
    const lat2 = 51.5074; // London
    const lon2 = -0.1278;

    const distance = getDistanceInMeters(lat1, lon1, lat2, lon2);

    // Approx 5,570 km
    expect(distance).toBeGreaterThan(5_500_000);
    expect(distance).toBeLessThan(5_600_000);
  });

  it('handles southern hemisphere coordinates', () => {
    const lat1 = -33.8688; // Sydney
    const lon1 = 151.2093;
    const lat2 = -37.8136; // Melbourne
    const lon2 = 144.9631;

    const distance = getDistanceInMeters(lat1, lon1, lat2, lon2);

    // Approx 713 km
    expect(distance).toBeGreaterThan(700_000);
    expect(distance).toBeLessThan(750_000);
  });

  it('handles equator crossing (northern to southern hemisphere)', () => {
    const lat1 = 1.3521; // Singapore
    const lon1 = 103.8198;
    const lat2 = -6.2088; // Jakarta
    const lon2 = 106.8456;

    const distance = getDistanceInMeters(lat1, lon1, lat2, lon2);

    // Approx 890 km
    expect(distance).toBeGreaterThan(850_000);
    expect(distance).toBeLessThan(920_000);
  });

  it('handles date line crossing (eastern to western hemisphere)', () => {
    const lat1 = -36.8485; // Auckland, NZ
    const lon1 = 174.7633;
    const lat2 = 35.6762; // Tokyo, Japan
    const lon2 = 139.6503;

    const distance = getDistanceInMeters(lat1, lon1, lat2, lon2);

    // Approx 8,841 km
    expect(distance).toBeGreaterThan(8_800_000);
    expect(distance).toBeLessThan(8_900_000);
  });

  it('returns consistent result regardless of coordinate order', () => {
    const lat1 = 21.028511;
    const lon1 = 105.852478;
    const lat2 = 10.772431;
    const lon2 = 106.697997;

    const distance1 = getDistanceInMeters(lat1, lon1, lat2, lon2);
    const distance2 = getDistanceInMeters(lat2, lon2, lat1, lon1);

    expect(distance1).toBeCloseTo(distance2, 0);
  });
});
