import { supabase } from '../lib/supabase';
import {
  compressImageToBlob,
  isSafeMediaUrl,
  validateMediaFile,
} from '../utils/imageCompressor';

export type VagouMediaBucket = 'avatars' | 'branding' | 'services' | 'salon-media';

export type MediaOwnerType =
  | 'user_avatar'
  | 'client_avatar'
  | 'professional_avatar'
  | 'admin_avatar'
  | 'salon_logo'
  | 'salon_favicon'
  | 'salon_cover'
  | 'salon_facade'
  | 'salon_interior'
  | 'salon_gallery'
  | 'service_photo'
  | 'service_video'
  | 'offer_media';

export interface BinaryUploadOptions {
  bucket: VagouMediaBucket;
  ownerType: MediaOwnerType;
  ownerId?: string | null;
  salonId?: string | null;
  title?: string;
  isCover?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: 'image/webp' | 'image/png' | 'image/jpeg';
  allowVideo?: boolean;
}

export interface UploadedMediaAsset {
  id: string | null;
  bucket: VagouMediaBucket;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val?: string | null): boolean {
  return Boolean(val && UUID_REGEX.test(String(val).trim()));
}

async function getActiveBearerToken(): Promise<string | null> {
  try {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

export function sanitizePersistedMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  return isSafeMediaUrl(url) ? url.trim() : null;
}

export async function uploadBinaryMediaAsset(
  rawFile: File,
  options: BinaryUploadOptions
): Promise<UploadedMediaAsset> {
  const validation = validateMediaFile(rawFile, { allowVideo: options.allowVideo ?? false });
  if (!validation.valid) {
    throw new Error(validation.error || 'Arquivo de mídia inválido.');
  }

  const binaryFile = validation.isVideo
    ? rawFile
    : await compressImageToBlob(rawFile, {
        maxWidth: options.maxWidth ?? (options.bucket === 'avatars' ? 640 : 1280),
        maxHeight: options.maxHeight ?? (options.bucket === 'avatars' ? 640 : 1280),
        quality: options.quality ?? 0.84,
        mimeType:
          options.mimeType ??
          (rawFile.type === 'image/png' ? 'image/png' : 'image/webp'),
      });

  const bearer = await getActiveBearerToken();

  try {
    const formData = new FormData();
    formData.append('file', binaryFile, binaryFile.name);
    formData.append('bucket', options.bucket);
    formData.append('ownerType', options.ownerType);
    if (options.ownerId) formData.append('ownerId', String(options.ownerId));
    if (options.salonId) formData.append('salonId', String(options.salonId));
    if (options.title) formData.append('title', options.title);
    if (options.isCover) formData.append('isCover', 'true');

    const headers: Record<string, string> = {};
    if (bearer) {
      headers.Authorization = `Bearer ${bearer}`;
    }

    const res = await fetch('/api/media/upload', {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.publicUrl && isSafeMediaUrl(data.publicUrl)) {
        return {
          id: data.id || null,
          bucket: (data.bucket || options.bucket) as VagouMediaBucket,
          storagePath: String(data.storagePath || ''),
          publicUrl: String(data.publicUrl),
          mimeType: String(data.mimeType || binaryFile.type),
          sizeBytes: Number(data.sizeBytes || binaryFile.size),
        };
      }
    }
  } catch {

  }

  if (!supabase) {
    throw new Error('Supabase Storage não configurado para envio de mídia.');
  }

  const ext = (binaryFile.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
  const safeOwner = String(options.salonId || options.ownerId || 'shared').replace(/[^a-zA-Z0-9_-]/g, '_');
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const storagePath = `${options.ownerType}/${safeOwner}/${Date.now()}-${randomSuffix}.${ext}`;

  const { data: upData, error: upErr } = await supabase.storage
    .from(options.bucket)
    .upload(storagePath, binaryFile, {
      contentType: binaryFile.type || 'application/octet-stream',
      cacheControl: '31536000',
      upsert: false,
    });

  if (upErr || !upData?.path) {
    throw new Error(upErr?.message || 'Falha ao enviar arquivo binário para o Supabase Storage.');
  }

  const { data: pubData } = supabase.storage.from(options.bucket).getPublicUrl(upData.path);
  const publicUrl = pubData?.publicUrl;

  if (!publicUrl || !isSafeMediaUrl(publicUrl)) {
    throw new Error('URL pública inválida retornada pelo Storage.');
  }

  let assetId: string | null = null;
  try {
    const { data: inserted } = await (supabase.from('media_assets' as any) as any)
      .insert({
        salon_id: isValidUuid(options.salonId) ? options.salonId : null,
        owner_type: options.ownerType,
        owner_id: isValidUuid(options.ownerId) ? options.ownerId : null,
        bucket: options.bucket,
        storage_path: upData.path,
        public_url: publicUrl,
        mime_type: binaryFile.type || 'image/webp',
        size_bytes: binaryFile.size,
        title: options.title || null,
        is_cover: Boolean(options.isCover),
      })
      .select('id')
      .maybeSingle();

    if (inserted?.id) assetId = inserted.id;
  } catch {

  }

  return {
    id: assetId,
    bucket: options.bucket,
    storagePath: upData.path,
    publicUrl,
    mimeType: binaryFile.type || 'image/webp',
    sizeBytes: binaryFile.size,
  };
}

export { isSafeMediaUrl as isSafeBinaryMediaUrl };
