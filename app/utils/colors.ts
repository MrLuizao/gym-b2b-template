/// Convierte '#rrggbb' a int ARGB (0xffrrggbb), el formato que consume
/// la app Flutter (`SponsorAd.brandColor` / `brand_color`).
export function hexToArgb(hex: string): number | null {
  const value = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return 0xff000000 | parseInt(value, 16);
}

/// Convierte un int ARGB a '#rrggbb' para inputs/preview CSS.
export function argbToHex(argb: number | null | undefined): string | null {
  if (argb == null || !Number.isFinite(argb)) return null;
  return `#${(argb & 0xffffff).toString(16).padStart(6, '0')}`;
}

/// Devuelve el color de texto legible sobre un fondo dado:
/// oscuro (#0b0e14) en fondos claros, blanco en oscuros.
export function readableOn(hex: string): string {
  const value = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return '#f8fafc';
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const channel = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance =
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.35 ? '#0b0e14' : '#f8fafc';
}
