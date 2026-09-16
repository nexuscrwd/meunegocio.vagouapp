/**
 * Utilitário de Gerenciamento e Geração de Logotipos de Estabelecimentos (PNG/SVG Transparente)
 * Gera marcas nominais e ícones de salão em formato retangular horizontal com fundo transparente.
 */

/**
 * Converte a string SVG em uma Data URI 100% válida e codificada para navegadores web
 */
function makeSvgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

// 1. Salão X Prime (Emerald)
export const LOGO_SALAO_X_PRIME = makeSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" fill="none">
  <path d="M15 20L32 40L15 60H28L39 46.5L50 60H63L46 40L63 20H50L39 33.5L28 20H15Z" fill="#10B981"/>
  <text x="72" y="43" font-family="Arial, sans-serif" font-weight="900" font-size="25" fill="#10B981" letter-spacing="1">SALÃO X</text>
  <text x="72" y="62" font-family="Arial, sans-serif" font-weight="800" font-size="14" fill="#34D399" letter-spacing="4">PRIME</text>
</svg>
`);

// 2. Barbearia Primo (Amber)
export const LOGO_BARBEARIA_PRIMO = makeSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" fill="none">
  <path d="M20 22C20 22 35 20 40 35C45 50 30 58 20 58V22Z" stroke="#F59E0B" stroke-width="4" stroke-linecap="round"/>
  <path d="M38 22H55C62 22 66 26 66 32C66 38 62 42 55 42H38" stroke="#F59E0B" stroke-width="4"/>
  <text x="76" y="42" font-family="Arial, sans-serif" font-weight="900" font-size="22" fill="#F59E0B" letter-spacing="1">BARBEARIA</text>
  <text x="76" y="62" font-family="Arial, sans-serif" font-weight="800" font-size="16" fill="#FBBF24" letter-spacing="3">PRIMO</text>
</svg>
`);

// 3. Studio Mabe Nails (Pink)
export const LOGO_STUDIO_MABE = makeSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" fill="none">
  <path d="M20 55C20 35 35 20 50 20C50 38 35 55 20 55Z" fill="#EC4899" opacity="0.85"/>
  <text x="62" y="41" font-family="Arial, sans-serif" font-weight="900" font-size="21" fill="#EC4899" letter-spacing="0.5">STUDIO MABE</text>
  <text x="62" y="60" font-family="Arial, sans-serif" font-weight="700" font-size="13" fill="#F472B6" letter-spacing="3.5">NAILS &amp; BEAUTY</text>
</svg>
`);

// 4. Don Studio Facial (Purple)
export const LOGO_DON_STUDIO = makeSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" fill="none">
  <rect x="15" y="20" width="40" height="40" rx="8" stroke="#8B5CF6" stroke-width="3" fill="none"/>
  <text x="27" y="48" font-family="Arial, sans-serif" font-weight="900" font-size="24" fill="#8B5CF6">D</text>
  <text x="68" y="42" font-family="Arial, sans-serif" font-weight="900" font-size="22" fill="#8B5CF6" letter-spacing="1">DON STUDIO</text>
  <text x="68" y="60" font-family="Arial, sans-serif" font-weight="700" font-size="13" fill="#A78BFA" letter-spacing="3">ESTÉTICA FACIAL</text>
</svg>
`);

// 5. Espaço Glamour VIP (Rose)
export const LOGO_ESPACO_GLAMOUR = makeSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" fill="none">
  <path d="M30 18L35 32L50 32L38 41L42 55L30 46L18 55L22 41L10 32L25 32Z" fill="#F43F5E"/>
  <text x="62" y="41" font-family="Arial, sans-serif" font-weight="900" font-size="20" fill="#F43F5E" letter-spacing="0.5">ESPAÇO GLAMOUR</text>
  <text x="62" y="60" font-family="Arial, sans-serif" font-weight="800" font-size="15" fill="#FB7185" letter-spacing="5">VIP SALON</text>
</svg>
`);

// 6. Barber Shop Elite (Blue)
export const LOGO_BARBER_ELITE = makeSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" fill="none">
  <path d="M18 22H52V30H38V58H32V30H18V22Z" fill="#3B82F6"/>
  <text x="60" y="41" font-family="Arial, sans-serif" font-weight="900" font-size="21" fill="#3B82F6" letter-spacing="1">BARBER SHOP</text>
  <text x="60" y="60" font-family="Arial, sans-serif" font-weight="800" font-size="15" fill="#60A5FA" letter-spacing="4">ELITE</text>
</svg>
`);

// 7. Bella Donna Hair & Spa (Emerald/Teal)
export const LOGO_BELLA_DONNA = makeSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" fill="none">
  <circle cx="35" cy="40" r="18" stroke="#14B8A6" stroke-width="3" fill="none"/>
  <path d="M35 26V54M21 40H49" stroke="#14B8A6" stroke-width="2"/>
  <text x="65" y="41" font-family="Arial, sans-serif" font-weight="900" font-size="21" fill="#14B8A6" letter-spacing="0.5">BELLA DONNA</text>
  <text x="65" y="60" font-family="Arial, sans-serif" font-weight="800" font-size="14" fill="#2DD4BF" letter-spacing="4">HAIR &amp; SPA</text>
</svg>
`);

// 8. Chroma Nail Bar (Pink/Violet)
export const LOGO_CHROMA_NAIL = makeSvgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" fill="none">
  <path d="M20 20H50L35 60H20L20 20Z" fill="#D946EF" opacity="0.85"/>
  <text x="62" y="41" font-family="Arial, sans-serif" font-weight="900" font-size="22" fill="#D946EF" letter-spacing="1">CHROMA</text>
  <text x="62" y="60" font-family="Arial, sans-serif" font-weight="800" font-size="14" fill="#E879F9" letter-spacing="4">NAIL BAR</text>
</svg>
`);

/**
 * Mapeamento estático de logos por nome do estabelecimento
 */
const SALON_LOGO_MAP: Record<string, string> = {
  'Salão X Prime': LOGO_SALAO_X_PRIME,
  'Barbearia Primo': LOGO_BARBEARIA_PRIMO,
  'Studio Mabe Nails': LOGO_STUDIO_MABE,
  'Don Studio Facial': LOGO_DON_STUDIO,
  'Espaço Glamour VIP': LOGO_ESPACO_GLAMOUR,
  'Barber Shop Elite': LOGO_BARBER_ELITE,
  'Bella Donna Hair & Spa': LOGO_BELLA_DONNA,
  'Chroma Nail Bar': LOGO_CHROMA_NAIL,
};

/**
 * Gera um logotipo SVG transparente retangular dinâmico para qualquer nome de estabelecimento
 */
export function createDynamicSalonLogo(name: string): string {
  const cleanName = (name || 'ESTABELECIMENTO').toUpperCase();
  const words = cleanName.split(' ');
  const mainText = words.slice(0, 2).join(' ') || cleanName;
  const subText = words.slice(2).join(' ') || 'SALÃO & ESTÉTICA';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 80" fill="none"><rect x="10" y="20" width="10" height="40" rx="3" fill="#10B981"/><text x="32" y="43" font-family="Arial, sans-serif" font-weight="900" font-size="22" fill="#10B981" letter-spacing="1">${mainText}</text><text x="32" y="62" font-family="Arial, sans-serif" font-weight="800" font-size="13" fill="#34D399" letter-spacing="3">${subText}</text></svg>`;
  return makeSvgDataUri(svg);
}

/**
 * Retorna o logotipo em formato retangular transparente para um salão
 */
export function getSalonLogo(salonName: string, customLogo?: string): string {
  if (customLogo && (customLogo.startsWith('data:image') || customLogo.includes('.png') || customLogo.includes('logo'))) {
    return customLogo;
  }
  return SALON_LOGO_MAP[salonName] || createDynamicSalonLogo(salonName);
}
