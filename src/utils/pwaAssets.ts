/**
 * Gerenciador de Ativos PWA Dinâmicos (White-label & Multi-estabelecimento)
 * Injeta dinamicamente o Web App Manifest e Favicons com base no logo/ícone do salão
 */

import { DEFAULT_ROTA99_ICON } from './defaultSalonAssets';

export interface PwaCustomAssets {
  name: string;
  shortName: string;
  iconUrl?: string;
  themeColor?: string;
  backgroundColor?: string;
}

let activeBlobManifestUrl: string | null = null;

export function updateDynamicPwaAssets(
  name?: string,
  iconUrl?: string,
  themeColor: string = '#151A1E'
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    const finalName = name || 'Meu Estabelecimento';
    const finalShortName = finalName.length > 12 ? finalName.slice(0, 12).trim() : finalName;
    const finalIcon = iconUrl || '';

    // 1. Atualizar Título da Página e Tags Apple Mobile
    document.title = `${finalName} — Vagou`;
    
    const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitleMeta) {
      appleTitleMeta.setAttribute('content', finalShortName);
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', themeColor);
    }

    // 2. Atualizar Favicons e Apple Touch Icons Dinamicamente
    if (finalIcon) {
      const appleTouchIcons = document.querySelectorAll('link[rel="apple-touch-icon"]');
      appleTouchIcons.forEach((el) => el.setAttribute('href', finalIcon));

      const standardIcons = document.querySelectorAll('link[rel="icon"]');
      standardIcons.forEach((el) => el.setAttribute('href', finalIcon));
    }

    // 3. Gerar e Injetar Web App Manifest Dinâmico (Blob URL)
    const isSvg = finalIcon.includes('image/svg+xml') || finalIcon.endsWith('.svg');
    const dynamicManifest = {
      id: '/',
      name: `${finalName} — Vagou`,
      short_name: finalShortName,
      description: `Aplicativo oficial do estabelecimento ${finalName}. Catálogo de serviços, agendamentos e atendimento.`,
      start_url: '/?source=pwa',
      scope: '/',
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui', 'window-controls-overlay'],
      orientation: 'portrait-primary',
      background_color: '#151A1E',
      theme_color: themeColor,
      prefer_related_applications: false,
      categories: ['lifestyle', 'beauty', 'shopping', 'utilities'],
      icons: [
        {
          src: finalIcon,
          sizes: 'any',
          type: isSvg ? 'image/svg+xml' : 'image/png',
          purpose: 'any maskable'
        },
        {
          src: finalIcon,
          sizes: '192x192',
          type: isSvg ? 'image/svg+xml' : 'image/png',
          purpose: 'any maskable'
        },
        {
          src: finalIcon,
          sizes: '512x512',
          type: isSvg ? 'image/svg+xml' : 'image/png',
          purpose: 'any maskable'
        }
      ]
    };

    const manifestBlob = new Blob([JSON.stringify(dynamicManifest, null, 2)], {
      type: 'application/manifest+json'
    });

    if (activeBlobManifestUrl) {
      URL.revokeObjectURL(activeBlobManifestUrl);
    }

    activeBlobManifestUrl = URL.createObjectURL(manifestBlob);

    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = activeBlobManifestUrl;

  } catch (error) {
    console.warn('Erro ao atualizar manifesto PWA dinâmico:', error);
  }
}

export function initializeStoredPwaAssets() {
  if (typeof window === 'undefined') return;

  try {
    const savedSettings = localStorage.getItem('vagou_salon_admin_settings');
    const storedIcon = localStorage.getItem('vagou_salon_icon') || localStorage.getItem('vagou_salon_logo_dark');
    const storedColor = localStorage.getItem('vagou_accent_color') || '#10b981';

    let name = 'Meu Estabelecimento';
    let icon = storedIcon || '';
    let color = storedColor;

    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.pwaName || parsed.salonName) name = parsed.pwaName || parsed.salonName;
        if (parsed.salonIcon || parsed.salonLogoDark || parsed.salonLogo) {
          icon = parsed.salonIcon || parsed.salonLogoDark || parsed.salonLogo;
        }
        if (parsed.accentColor) color = parsed.accentColor;
      } catch {}
    }

    updateDynamicPwaAssets(name, icon, color);
  } catch (e) {
    // ignore
  }
}
