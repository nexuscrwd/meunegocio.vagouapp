import { DEFAULT_NEUTRAL_HEX, mixHex, normalizeHex } from './themePalette';

export interface ColorPresetItem {
  label: string;
  name: string;
  hex: string;
}

export const getThemeColorPresets = (themeColor: string = DEFAULT_NEUTRAL_HEX): ColorPresetItem[] => {
  const primary = normalizeHex(themeColor) || DEFAULT_NEUTRAL_HEX;
  const lightTone = mixHex(primary, '#FFFFFF', 0.20);
  const darkTone = mixHex(primary, '#0F172A', 0.45);

  return [
    { label: 'Sem cor', name: 'Padrão do Tema (Sem Override)', hex: 'transparent' },
    { label: 'Cor Principal', name: 'Cor Principal do Tema', hex: primary },
    { label: 'Secundária Clara', name: 'Tom Claro do Tema', hex: lightTone },
    { label: 'Branco', name: 'Branco Puro', hex: '#FFFFFF' },
    { label: 'Escuro Suave', name: 'Slate Escuro Suave', hex: '#1E293B' },
    { label: 'Tom Escuro', name: 'Tom Escuro do Tema', hex: darkTone },
  ];
};
