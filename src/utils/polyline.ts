/**
 * Decode Google Polyline format to array of [lat, lng] coordinates
 * Based on: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 *
 * @param encoded - Encoded polyline string from Strava/Google
 * @returns Array of [latitude, longitude] pairs
 */
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded || encoded.length === 0) {
    return [];
  }

  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // Decode latitude
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    // Decode longitude
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    // Convert to decimal degrees
    coordinates.push([lat / 1e5, lng / 1e5]);
  }

  return coordinates;
}

/**
 * Convert decoded polyline coordinates to GeoJSON LineString
 *
 * @param encoded - Encoded polyline string
 * @returns GeoJSON LineString object or null if invalid
 */
export function polylineToGeoJSON(encoded: string): GeoJSON.LineString | null {
  const coordinates = decodePolyline(encoded);

  if (coordinates.length === 0) {
    return null;
  }

  // GeoJSON LineString expects [lng, lat] format
  return {
    type: 'LineString',
    coordinates: coordinates.map(([lat, lng]) => [lng, lat]),
  };
}

/**
 * Convert decoded polyline coordinates to Leaflet-compatible format
 *
 * @param encoded - Encoded polyline string
 * @returns Array of [lat, lng] for Leaflet Polyline
 */
export function polylineToLeaflet(encoded: string): [number, number][] {
  return decodePolyline(encoded);
}
