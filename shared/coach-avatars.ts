/// Catálogo de avatares ilustrados para coaches — los SVG viven en
/// public/avatars/coaches/{id}.svg (preview en B2B) y en el bundle de
/// la app (assets/avatars/coaches/). La fuente del arte es
/// scripts/generate-coach-avatars.mjs — si se agregan ids, regenerar.
export const COACH_AVATAR_IDS = [
  'bronce',
  'tide',
  'ember',
  'slate',
  'vine',
  'iron',
  'rosa',
  'terra',
  'amber',
  'onyx',
  'cielo',
  'lima',
] as const;

export type CoachAvatarId = (typeof COACH_AVATAR_IDS)[number];

export function coachAvatarSrc(id?: string | null): string | null {
  return id && (COACH_AVATAR_IDS as readonly string[]).includes(id)
    ? `/avatars/coaches/${id}.svg`
    : null;
}
