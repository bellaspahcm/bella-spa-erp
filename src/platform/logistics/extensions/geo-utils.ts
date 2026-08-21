/**
 * Geographic Utilities - Logistics Platform Extension
 * 
 * Provides geographic calculation utilities for route management.
 * Uses Haversine formula for distance calculations.
 * 
 * Architecture Compliance:
 * - Extension layer (domain-specific utilities)
 * - No Core dependencies
 * - Strictly typed, no `any` types
 * 
 * @module platform/logistics/extensions/geo-utils
 */

import type { GeoCoordinates, Distance, Waypoint } from '../shared-kernel/types';

/**
 * Earth's radius in kilometers
 */
const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two geographic points using Haversine formula.
 * 
 * @param point1 - First coordinate
 * @param point2 - Second coordinate
 * @returns Distance in kilometers
 */
export function calculateDistance(
  point1: GeoCoordinates,
  point2: GeoCoordinates
): Distance {
  const lat1 = toRadians(point1.latitude);
  const lat2 = toRadians(point2.latitude);
  const deltaLat = toRadians(point2.latitude - point1.latitude);
  const deltaLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distanceKm = EARTH_RADIUS_KM * c;

  return {
    value: distanceKm,
    unit: 'km',
  };
}

/**
 * Calculate total route distance for a sequence of waypoints.
 * 
 * Requires waypoints to have coordinates.
 * Sums distances between consecutive waypoints.
 * 
 * @param waypoints - Array of waypoints with coordinates
 * @returns Total distance in kilometers
 */
export function calculateRouteDistance(waypoints: Waypoint[]): Distance {
  if (waypoints.length < 2) {
    return { value: 0, unit: 'km' };
  }

  let totalKm = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const current = waypoints[i];
    const next = waypoints[i + 1];

    if (current.location.coordinates && next.location.coordinates) {
      const distance = calculateDistance(
        current.location.coordinates,
        next.location.coordinates
      );
      totalKm += distance.value;
    }
  }

  return {
    value: totalKm,
    unit: 'km',
  };
}

/**
 * Estimate travel duration based on distance and average speed.
 * 
 * @param distance - Distance to travel
 * @param averageSpeedKmh - Average speed in km/h (default: 60)
 * @returns Estimated duration in minutes
 */
export function estimateDuration(
  distance: Distance,
  averageSpeedKmh: number = 60
): number {
  let distanceKm = distance.value;

  // Convert to km if in miles
  if (distance.unit === 'mi') {
    distanceKm = distance.value * 1.60934;
  }

  const hours = distanceKm / averageSpeedKmh;
  const minutes = hours * 60;

  return Math.round(minutes);
}

/**
 * Calculate distance between two waypoints.
 * 
 * @param waypoint1 - First waypoint
 * @param waypoint2 - Second waypoint
 * @returns Distance if both have coordinates, null otherwise
 */
export function calculateWaypointDistance(
  waypoint1: Waypoint,
  waypoint2: Waypoint
): Distance | null {
  if (!waypoint1.location.coordinates || !waypoint2.location.coordinates) {
    return null;
  }

  return calculateDistance(
    waypoint1.location.coordinates,
    waypoint2.location.coordinates
  );
}
