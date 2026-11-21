export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/webp' | 'image/png' | 'image/jpeg';
}

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

export const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export function isBase64DataUrl(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^\s*data:/i.test(value);
}

export function isSafeMediaUrl(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || isBase64DataUrl(trimmed)) return false;
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/');
}

export function validateMediaFile(
  file: File,
  options?: { allowVideo?: boolean; maxImageBytes?: number; maxVideoBytes?: number }
): { valid: boolean; error?: string; isVideo: boolean } {
  const allowVideo = options?.allowVideo ?? false;
  const maxImageBytes = options?.maxImageBytes ?? 12 * 1024 * 1024;
  const maxVideoBytes = options?.maxVideoBytes ?? 50 * 1024 * 1024;

  const mime = (file.type || '').toLowerCase();
  const isImage = ALLOWED_IMAGE_MIMES.has(mime);
  const isVideo = ALLOWED_VIDEO_MIMES.has(mime);

  if (!isImage && !(allowVideo && isVideo)) {
    return {
      valid: false,
      isVideo: false,
      error: allowVideo
        ? 'Formato inválido. Use JPG, PNG, WebP, SVG, MP4 ou WebM.'
        : 'Formato inválido. Use JPG, PNG, WebP ou SVG.',
    };
  }

  if (isImage && file.size > maxImageBytes) {
    return {
      valid: false,
      isVideo: false,
      error: `Imagem muito grande (máx ${Math.round(maxImageBytes / (1024 * 1024))}MB).`,
    };
  }

  if (isVideo && file.size > maxVideoBytes) {
    return {
      valid: false,
      isVideo: true,
      error: `Vídeo muito grande (máx ${Math.round(maxVideoBytes / (1024 * 1024))}MB).`,
    };
  }

  return { valid: true, isVideo };
}

function resolveExtension(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/svg+xml') return 'svg';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

function buildSanitizedFileName(originalName: string, mimeType: string): string {
  const base = (originalName || 'media')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 48) || 'media';
  return `${base}.${resolveExtension(mimeType)}`;
}

export async function compressImageToBlob(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<File> {
  const rawType = (file.type || 'image/jpeg').toLowerCase();
  const originalName = 'name' in file && file.name ? file.name : 'upload.webp';

  if (rawType === 'image/svg+xml' || rawType === 'image/gif') {
    return file instanceof File ? file : new File([file], buildSanitizedFileName(originalName, rawType), { type: rawType });
  }

  const {
    maxWidth = 1080,
    maxHeight = 1080,
    quality = 0.84,
    mimeType = rawType === 'image/png' ? 'image/png' : 'image/webp',
  } = options;

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Falha ao decodificar imagem'));
      el.src = objectUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file instanceof File ? file : new File([file], buildSanitizedFileName(originalName, rawType), { type: rawType });
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
            return;
          }

          canvas.toBlob((fallback) => resolve(fallback), 'image/jpeg', quality);
        },
        mimeType,
        quality
      );
    });

    if (!blob) {
      return file instanceof File ? file : new File([file], buildSanitizedFileName(originalName, rawType), { type: rawType });
    }

    const finalMime = blob.type || mimeType;
    return new File([blob], buildSanitizedFileName(originalName, finalMime), {
      type: finalMime,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
