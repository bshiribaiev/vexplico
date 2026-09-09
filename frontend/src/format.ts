export function formatTimestamp(seconds: number): string {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const padded = `${minutes.toString().padStart(hours ? 2 : 1, '0')}:${secs.toString().padStart(2, '0')}`;
  return hours ? `${hours}:${padded}` : padded;
}

export function formatDate(value: string | null): string {
  if (!value) return 'Date unknown';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return '';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
}

/** A deep link to the moment in the source video, when the source supports one. */
export function momentUrl(sourceUrl: string | null, seconds: number): string | null {
  if (!sourceUrl || !seconds) return null;
  if (!/youtube\.com|youtu\.be/.test(sourceUrl)) return null;

  const separator = sourceUrl.includes('?') ? '&' : '?';
  return `${sourceUrl}${separator}t=${Math.floor(seconds)}s`;
}
