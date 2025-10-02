// Generic UI formatting helpers centralized here

export function formatTimeSec(sec: number | null): string {
  const s = Math.max(0, sec ?? 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m ${r}s`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

export function formatKm(distanceValue: number | null): string {
  if (!distanceValue || distanceValue <= 0) return "0.00 km";
  // Some places may pass meters; treat values > 1000 as meters for now
  const km = distanceValue > 1000 ? distanceValue / 1000 : distanceValue;
  return `${km.toFixed(2)} km`;
}

export function formatPaceMinPerKm(
  movingSec: number | null,
  distanceValue: number | null
): string {
  if (!movingSec || movingSec <= 0 || !distanceValue || distanceValue <= 0) return "–";
  const km = distanceValue > 1000 ? distanceValue / 1000 : distanceValue;
  if (km <= 0) return "–";
  const paceSecPerKm = movingSec / km;
  const mm = Math.floor(paceSecPerKm / 60);
  const ss = Math.round(paceSecPerKm % 60);
  return `${mm}:${ss.toString().padStart(2, "0")} /km`;
}

export function formatDate(dateStr?: string | null): string {
  try {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("da-DK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

