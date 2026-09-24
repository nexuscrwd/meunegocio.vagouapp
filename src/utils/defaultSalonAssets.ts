/**
 * Ativos Oficiais Padrão (White-label & Dinâmico)
 * SVGs vetoriais limpos e neutros para estabelecimentos parceiros.
 */

export function generateSalonLogoSvg(salonName: string = 'Estabelecimento', isDark: boolean = true): string {
  const cleanName = salonName.trim() || 'Estabelecimento';
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const accentColor = '#10B981';
  
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 70" width="360" height="70" fill="none">
  <g transform="translate(10, 15)">
    <rect width="40" height="40" rx="10" fill="${accentColor}" fill-opacity="0.2" stroke="${accentColor}" stroke-width="2"/>
    <path d="M14 26 L26 14 M14 14 L26 26" stroke="${accentColor}" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <text x="62" y="42" fill="${textColor}" font-family="'Poppins', system-ui, sans-serif" font-size="20" font-weight="900" letter-spacing="1.2">${cleanName.toUpperCase()}</text>
</svg>
`)}`;
}

export function generateSalonIconSvg(salonName: string = 'Vagou', isDark: boolean = false): string {
  const initial = (salonName.trim() || 'V').slice(0, 2).toUpperCase();
  const bg = isDark ? '#151A1E' : '#E2E8F0';
  const textFill = isDark ? '#10B981' : '#0F172A';
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="128" fill="${bg}"/>
  <text x="256" y="320" text-anchor="middle" fill="${textFill}" font-family="'Poppins', sans-serif" font-size="180" font-weight="900">${initial}</text>
</svg>
`)}`;
}

// Fallbacks genéricos limpos (sem referências a marcas fixas ou salões de demonstração)
export const DEFAULT_ROTA99_LOGO_DARK = '';
export const DEFAULT_ROTA99_LOGO_LIGHT = '';
export const DEFAULT_ROTA99_ICON = '';
