/// Rate limit con dos niveles:
/// 1. Local (memoria de la instancia) — guarda barata siempre activa.
/// 2. Upstash Redis (si UPSTASH_REDIS_REST_URL/TOKEN están) — conteo
///    distribuido real entre todas las lambdas de Vercel: ventana fija
///    vía `SET rl:key 1 PX windowMs NX` + `INCR`. Sin envs → solo local.
///    Redis caído → fail-open al límite local (disponibilidad > rigor).
/// Los límites duros viven en la lógica: lockout de claim PIN y dedupe
/// de adEvents.
const hits = new Map<string, number[]>();
const MAX_KEYS = 10_000;

const UP_URL = process.env.UPSTASH_REDIS_REST_URL;
const UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function tooMany(): never {
  throw createError({
    statusCode: 429,
    statusMessage: 'Demasiados intentos — espera un momento',
  });
}

function localHit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) tooMany();
  arr.push(now);
  hits.set(key, arr);
  /// Limpieza perezosa para que el mapa no crezca sin tope.
  if (hits.size > MAX_KEYS) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    }
  }
}

/// Lanza 429 si `key` supera `max` requests en `windowMs`.
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<void> {
  localHit(key, max, windowMs);
  if (!UP_URL || !UP_TOKEN) return;
  try {
    const res = await fetch(`${UP_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['SET', `rl:${key}`, '1', 'PX', String(windowMs), 'NX'],
        ['INCR', `rl:${key}`],
      ]),
    });
    const data = (await res.json()) as { result?: unknown }[];
    const count = Number(data?.[1]?.result ?? 0);
    if (count > max) tooMany();
  } catch (e) {
    if (e && typeof e === 'object' && 'statusCode' in e) throw e;
    /// Redis inalcanzable — queda el límite local.
  }
}
