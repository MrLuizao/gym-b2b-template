/// Compresión client-side — las imágenes viven como base64 dentro del doc de
/// Firestore, que no puede pasar de 1 MiB. Redimensiona a `maxDim` px en el
/// lado mayor y re-exporta como JPEG bajando calidad hasta entrar en
/// `targetChars` (longitud del dataURL base64).
export async function compressImageFile(
  file: File,
  opts: { maxDim?: number; targetChars?: number } = {},
): Promise<string> {
  const { maxDim = 1200, targetChars = 300_000 } = opts;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen');
  /// Fondo blanco — JPEG no tiene alpha y un PNG transparente quedaría negro.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let best = '';
  for (const quality of [0.8, 0.7, 0.6, 0.5, 0.4]) {
    best = canvas.toDataURL('image/jpeg', quality);
    if (best.length <= targetChars) return best;
  }
  return best;
}

/// Límite seguro del doc de Firestore: 1 MiB total — reservamos ~120 KB para
/// el resto de campos y metadatos del documento.
export const DOC_IMAGE_LIMIT_CHARS = 900_000;

/// Peso en caracteres base64 que ocuparán las imágenes dentro del doc.
export function imagePayloadChars(imageUrl: string, photos: string[]): number {
  return imageUrl.length + photos.reduce((sum, p) => sum + p.length, 0);
}

export function formatKb(chars: number): string {
  return `${Math.round(chars / 1024)} KB`;
}
