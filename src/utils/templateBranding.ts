export const TEMPLATE_APP_NAME = 'Meu Negócio';
export const TEMPLATE_APP_HOST = 'meunegocio.vagouapp.com';
export const TEMPLATE_DEFAULT_LOGO_DARK = '/logotipo-padrao.svg';
export const TEMPLATE_DEFAULT_LOGO_LIGHT = '/logotipo-padrao-light.svg';
export const TEMPLATE_APP_ICON_SVG = '/icon.svg';
export const TEMPLATE_APP_ICON_192 = '/icon-192.png';
export const TEMPLATE_APP_ICON_512 = '/icon-512.png';

const EMBEDDED_TEMPLATE_ASSET_PATHS = new Set([
  '/logotipo-padrao.svg',
  '/logotipo-padrao-light.svg',
  '/logo.svg',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
]);

const GENERIC_TEMPLATE_NAMES = new Set([
  '',
  'meu negocio',
  'meu estabelecimento',
  'meu espaco',
  'meu salao',
  'vagou pro',
  'vagou',
  'vagouapp',
  'logo',
  'logotipo',
  'estabelecimento',
]);

function normalizeBrandName(value?: string | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isEmbeddedTemplateAssetUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return false;
  const withoutQuery = trimmed.split('?')[0].split('#')[0];
  if (EMBEDDED_TEMPLATE_ASSET_PATHS.has(withoutQuery)) return true;
  for (const path of EMBEDDED_TEMPLATE_ASSET_PATHS) {
    if (withoutQuery.endsWith(path)) return true;
  }
  return false;
}

export function sanitizeSalonMediaUrlForDb(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (isEmbeddedTemplateAssetUrl(trimmed)) return null;
  if (trimmed.startsWith('data:image/svg+xml') || trimmed.includes('placeholder')) return null;
  return trimmed;
}

export function isValidCustomSalonLogo(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (isEmbeddedTemplateAssetUrl(trimmed)) return false;
  if (trimmed.includes('placeholder') || trimmed.startsWith('data:image/svg+xml')) return false;
  return true;
}

export function isGenericTemplateName(name?: string | null): boolean {
  return GENERIC_TEMPLATE_NAMES.has(normalizeBrandName(name));
}

export type EstablishmentBrandDisplay =
  | { kind: 'logo'; logoUrl: string }
  | { kind: 'name'; displayName: string }
  | { kind: 'template_logo'; logoUrl: string };

export function resolveEstablishmentBrandDisplay(params: {
  logoUrl?: string | null;
  logoTextFallback?: string | null;
  salonName?: string | null;
  isDark?: boolean;
}): EstablishmentBrandDisplay {
  const customLogo = String(params.logoUrl || '').trim();
  if (isValidCustomSalonLogo(customLogo)) {
    return { kind: 'logo', logoUrl: customLogo };
  }

  const altName = String(params.logoTextFallback || '').trim();
  if (altName && !isGenericTemplateName(altName)) {
    return { kind: 'name', displayName: altName };
  }

  const businessName = String(params.salonName || '').trim();
  if (businessName && !isGenericTemplateName(businessName)) {
    return { kind: 'name', displayName: businessName };
  }

  return {
    kind: 'template_logo',
    logoUrl: params.isDark !== false ? TEMPLATE_DEFAULT_LOGO_DARK : TEMPLATE_DEFAULT_LOGO_LIGHT,
  };
}
