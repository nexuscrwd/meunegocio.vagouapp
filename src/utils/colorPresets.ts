export interface ColorPresetItem {
  label: string;
  name: string;
  hex: string;
}

export const getThemeColorPresets = (themeColor: string = '#10b981'): ColorPresetItem[] => {
  const primary = themeColor && themeColor.startsWith('#') ? themeColor : '#10b981';
  const secondary = getDerivedThemeTone(primary);

  return [
    { label: 'Transparente', name: 'Transparente', hex: 'transparent' },
    { label: 'Branco', name: 'Branco', hex: '#ffffff' },
    { label: 'Preto', name: 'Preto', hex: '#000000' },
    { label: 'Cor Principal', name: 'Cor Principal', hex: primary },
    { label: 'Tom Secundário', name: 'Tom Secundário', hex: secondary },
  ];
};

function getDerivedThemeTone(hex: string): string {
  if (!hex || hex === 'transparent' || !hex.startsWith('#')) return '#059669';
  let color = hex.replace('#', '');
  if (color.length === 3) {
    color = color.split('').map(c => c + c).join('');
  }
  const num = parseInt(color, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;

  r = Math.max(0, r - 45);
  g = Math.max(0, g - 45);
  b = Math.max(0, b - 45);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
