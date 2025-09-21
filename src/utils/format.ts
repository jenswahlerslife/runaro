export function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(2) + ' km';
}

export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}t ${minutes}m` : `${minutes}m`;
}

export function formatSpeed(metersPerSecond: number): string {
  const kmPerHour = (metersPerSecond * 3.6).toFixed(1);
  return `${kmPerHour} km/t`;
}

