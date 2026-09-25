/// Espejo de `memberAvatarCatalog` (app Flutter — icono + gradiente).
/// `users/{id}.avatar` guarda el id; aquí se resuelve el render:
/// icono Lucide + gradiente CSS. Mantener ids alineados con la app.
export interface MemberAvatarSpec {
  /// Nombre del icono en MemberAvatar.vue (mapa a componentes lucide).
  icon: string;
  from: string;
  to: string;
  /// Icono oscuro sobre gradientes claros.
  dark: boolean;
}

export const MEMBER_AVATARS: Record<string, MemberAvatarSpec> = {
  volt: { icon: 'Zap', from: '#FDE047', to: '#EAB308', dark: true },
  flame: { icon: 'Flame', from: '#FB923C', to: '#DC2626', dark: false },
  dumbbell: { icon: 'Dumbbell', from: '#38BDF8', to: '#1D4ED8', dark: false },
  runner: {
    icon: 'PersonStanding',
    from: '#4ADE80',
    to: '#15803D',
    dark: true,
  },
  heart: { icon: 'Heart', from: '#F472B6', to: '#BE185D', dark: false },
  trophy: { icon: 'Trophy', from: '#FACC15', to: '#A16207', dark: true },
  rocket: { icon: 'Rocket', from: '#A78BFA', to: '#6D28D9', dark: false },
  shield: { icon: 'Shield', from: '#94A3B8', to: '#334155', dark: false },
  star: { icon: 'Star', from: '#FDBA74', to: '#EA580C', dark: false },
  timer: { icon: 'Timer', from: '#2DD4BF', to: '#0F766E', dark: true },
  zen: { icon: 'Flower2', from: '#F0ABFC', to: '#A21CAF', dark: false },
  waves: { icon: 'Waves', from: '#67E8F9', to: '#0E7490', dark: false },
};

export function memberAvatarSpec(
  id?: string | null,
): MemberAvatarSpec | null {
  return (id && MEMBER_AVATARS[id]) || null;
}
