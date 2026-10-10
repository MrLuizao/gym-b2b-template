/// Geocoding gratuito vía Nominatim (OpenStreetMap) — sin API key.
/// Se usa para resolver lat/lng de la dirección que captura el
/// anunciante en /anuncia (self-serve): el texto se convierte en
/// coordenadas para que "Cómo llegar" funcione en la app.
/// Política de uso de Nominatim: User-Agent identificable + pocas
/// peticiones (1 por orden pagada) — sobra para este volumen.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const TIMEOUT_MS = 5_000;

export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=mx`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'rirhub-b2b/1.0 (ad geocoding)',
        'Accept-Language': 'es',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const results = (await res.json()) as { lat: string; lon: string }[];
    const first = results[0];
    if (!first) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
