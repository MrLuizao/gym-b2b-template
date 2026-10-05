/// Rate limit en memoria por instancia (ventana deslizante).
/// En Vercel cada instancia serverless cuenta aparte — es primera
/// línea contra spam, no límite duro. Los límites duros viven en la
/// lógica: lockout de claim PIN y dedupe de adEvents.
const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;

/// Lanza 429 si `key` supera `max` requests en `windowMs`.
export function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Demasiados intentos — espera un momento',
    });
  }
  arr.push(now);
  hits.set(key, arr);
  /// Limpieza perezosa para que el mapa no crezca sin tope.
  if (hits.size > MAX_KEYS) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    }
  }
}
