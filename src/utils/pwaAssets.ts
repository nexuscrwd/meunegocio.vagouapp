const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'portal', 'adm', 'admin', 'meunegocio', 'api', 'vagouapp', 'dev', 'staging'
]);

function detectClientSalonSlug(explicitSlug?: string): string | null {
  if (explicitSlug && explicitSlug.trim()) {
    return explicitSlug.trim().toLowerCase();
  }
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const paramSlug = (params.get('salon') || params.get('slug') || '').trim().toLowerCase();
    if (paramSlug && !RESERVED_SUBDOMAINS.has(paramSlug)) {
      return paramSlug;
    }

    const host = window.location.hostname.toLowerCase();
    const parts = host.split('.');
    const isPreviewHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.includes('.run.app') ||
      host.startsWith('ais-');

    if (!isPreviewHost && parts.length >= 3) {
      const sub = parts[0];
      if (sub && !RESERVED_SUBDOMAINS.has(sub)) {
        return sub;
      }
    }

    if (isPreviewHost) {
      const envSlug = (import.meta.env.VITE_DEV_SALON_SLUG || '').trim().toLowerCase();
      if (envSlug && !RESERVED_SUBDOMAINS.has(envSlug)) {
        return envSlug;
      }
    }
  } catch {

  }
  return null;
}

export function buildShortPwaName(name?: string, isMainDomain: boolean = false): string {
  const raw = (name || (isMainDomain ? 'Vagou Pro' : 'Meu Espaço')).trim();
  if (raw.length <= 12) return raw;
  return raw.slice(0, 12).trim();
}

export function updateDynamicPwaAssets(
  name?: string,
  iconUrl?: string,
  themeColor?: string,
  slogan?: string,
  isDarkTheme?: boolean,
  salonSlug?: string
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    const activeSlug = detectClientSalonSlug(salonSlug);
    const isMainDomain = !activeSlug;

    const finalName = isMainDomain
      ? 'Vagou Pro'
      : (name && name.trim()) || 'Meu Estabelecimento';
    const finalShortName = buildShortPwaName(finalName, isMainDomain);
    const finalSlogan = isMainDomain
      ? 'Gestão & Vagas Imediatas'
      : (slogan || '').trim();

    const effectiveIsDark = isDarkTheme !== undefined
      ? isDarkTheme
      : document.documentElement.classList.contains('dark');

    const isLegacyAccent =
      !themeColor ||
      themeColor === '#20C933' ||
      themeColor === '#10B981' ||
      themeColor === '#005CA9' ||
      themeColor === '#2B82C9';
    const effectiveThemeColor = isMainDomain
      ? '#20C933'
      : isLegacyAccent
        ? (effectiveIsDark ? '#0F172A' : '#FFFFFF')
        : themeColor;

    document.title = finalSlogan ? `${finalName} — ${finalSlogan}` : finalName;

    const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitleMeta) {
      appleTitleMeta.setAttribute('content', finalShortName);
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', effectiveThemeColor);
    }

    const appleStatusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleStatusMeta) {
      appleStatusMeta.setAttribute('content', effectiveIsDark ? 'black-translucent' : 'default');
    }

    const shareDesc = finalSlogan || finalName;
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) {
      descMeta.setAttribute('content', shareDesc);
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', finalName);
    }

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute('content', shareDesc);
    }

    const icon192 = activeSlug
      ? `/api/pwa/icon?salon=${encodeURIComponent(activeSlug)}&size=192&purpose=any`
      : '/icon-192.png';
    const icon512 = activeSlug
      ? `/api/pwa/icon?salon=${encodeURIComponent(activeSlug)}&size=512&purpose=any`
      : '/icon-512.png';
    const icon180 = activeSlug
      ? `/api/pwa/icon?salon=${encodeURIComponent(activeSlug)}&size=180&purpose=any`
      : '/icon-192.png';
    const svgOrPngFavicon = activeSlug
      ? (iconUrl && !iconUrl.startsWith('blob:') ? iconUrl : icon192)
      : '/icon.svg';

    const appleTouchIcons = document.querySelectorAll('link[rel="apple-touch-icon"]');
    appleTouchIcons.forEach((el) => {
      const sizes = el.getAttribute('sizes');
      el.setAttribute('href', sizes === '192x192' ? icon192 : icon180);
    });

    const standardIcons = document.querySelectorAll('link[rel="icon"]');
    standardIcons.forEach((el) => {
      const typeAttr = el.getAttribute('type') || '';
      const sizes = el.getAttribute('sizes') || '';
      if (typeAttr.includes('svg')) {
        el.setAttribute('href', svgOrPngFavicon);
      } else if (sizes === '512x512') {
        el.setAttribute('href', icon512);
      } else {
        el.setAttribute('href', icon192);
      }
    });

    const manifestUrl = activeSlug
      ? `/manifest.json?salon=${encodeURIComponent(activeSlug)}`
      : '/manifest.json';

    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    if (manifestLink.getAttribute('href') !== manifestUrl) {
      manifestLink.setAttribute('href', manifestUrl);
    }
  } catch (error) {
    console.warn('Erro ao atualizar ativos PWA dinâmicos:', error);
  }
}

export function initializeStoredPwaAssets() {
  if (typeof window === 'undefined') return;

  try {
    const activeSlug = detectClientSalonSlug();
    const isDarkTheme = localStorage.getItem('vagou_theme_mode_v3') === 'dark';

    if (!activeSlug) {
      updateDynamicPwaAssets('Vagou Pro', '/icon-512.png', '#20C933', 'Gestão & Vagas Imediatas', isDarkTheme);
      return;
    }

    const savedSettings = localStorage.getItem('vagou_salon_admin_settings');
    const storedIcon =
      localStorage.getItem('vagou_salon_icon') ||
      localStorage.getItem('vagou_salon_logo_light') ||
      localStorage.getItem('vagou_salon_logo_dark');
    const storedColor = localStorage.getItem('vagou_accent_color') || '#FFFFFF';

    let name = activeSlug.toUpperCase();
    let icon = storedIcon || '';
    let color = storedColor;
    let slogan = '';

    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.pwaName || parsed.salonName) name = parsed.pwaName || parsed.salonName;
        if (parsed.salonIcon || parsed.salonLogoLight || parsed.salonLogoDark || parsed.salonLogo) {
          icon = parsed.salonIcon || parsed.salonLogoLight || parsed.salonLogoDark || parsed.salonLogo;
        }
        if (parsed.accentColor) color = parsed.accentColor;
        if (parsed.slogan) slogan = parsed.slogan;
      } catch {

      }
    }

    updateDynamicPwaAssets(name, icon, color, slogan, isDarkTheme, activeSlug);
  } catch {

  }
}
