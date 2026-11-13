import type { CSSProperties } from 'react';
import { SalonAdminSettings } from '../types';
import {
  NeutralPresetId,
  isLegacyOrSystemDefaultColor,
} from '../context/ThemeContext';
import {
  DEFAULT_NEUTRAL_HEX,
  getContrastTextHex,
  isLightColor,
  normalizeHex,
  resolveAppThemeTokens,
} from './themePalette';

export function getSectionHeaderStyleData(
  adminSettings: Partial<SalonAdminSettings>,
  isDark: boolean,
  _neutralPresetOverride?: NeutralPresetId
) {
  const isCustomized = Boolean(
    adminSettings.themeExplicitlyCustomized ||
      (adminSettings.accentColor && !isLegacyOrSystemDefaultColor(adminSettings.accentColor))
  );
  const palette = resolveAppThemeTokens(
    adminSettings.accentColor || DEFAULT_NEUTRAL_HEX,
    isDark,
    isCustomized
  );

  const customBg = normalizeHex(adminSettings.sectionHeaderBgColor);
  const bgStyle = adminSettings.sectionHeaderBgStyle || 'solid';
  const effectiveBg =
    bgStyle === 'transparent'
      ? 'transparent'
      : customBg || palette.sectionBg;

  const explicitTxt = normalizeHex(adminSettings.sectionHeaderTextColor);
  let resolvedText = explicitTxt || palette.sectionText;

  // Trava de contraste obrigatória: impede texto claro em barra clara (ex: "Identidade Visual" branco sobre fundo branco)
  if (effectiveBg !== 'transparent') {
    const bgIsLight = isLightColor(effectiveBg);
    const txtIsLight = isLightColor(resolvedText);
    if (bgIsLight && txtIsLight) {
      resolvedText = getContrastTextHex(effectiveBg, '#0F172A', '#FFFFFF');
    } else if (!bgIsLight && !txtIsLight) {
      resolvedText = getContrastTextHex(effectiveBg, '#0F172A', '#F8FAFC');
    }
  } else if (isDark && !isLightColor(resolvedText)) {
    resolvedText = '#F8FAFC';
  } else if (!isDark && isLightColor(resolvedText)) {
    resolvedText = '#1E293B';
  }

  const explicitIcon = normalizeHex(adminSettings.sectionHeaderIconColor);
  let resolvedIcon = explicitIcon || palette.sectionIcon;
  if (effectiveBg !== 'transparent') {
    const bgIsLight = isLightColor(effectiveBg);
    const iconIsLight = isLightColor(resolvedIcon);
    if (bgIsLight && iconIsLight) {
      resolvedIcon = palette.primary;
    } else if (!bgIsLight && !iconIsLight) {
      resolvedIcon = '#F8FAFC';
    }
  }

  const border = adminSettings.sectionHeaderBorder || 'bordered';
  const btnBgCol = normalizeHex(adminSettings.sectionHeaderBtnBgColor) || undefined;
  const btnFont = adminSettings.sectionHeaderBtnFont || 'Plus Jakarta Sans';
  const btnShadow = adminSettings.sectionHeaderBtnShadow || 'none';
  const btnBlur = adminSettings.sectionHeaderBtnBlur || 'none';
  const btnBorder = adminSettings.sectionHeaderBtnBorder || 'bordered';

  let shadowCss = 'none';
  if (btnShadow === 'subtle') shadowCss = '0 2px 8px -2px rgba(0,0,0,0.18)';
  else if (btnShadow === 'medium') shadowCss = '0 4px 16px -2px rgba(0,0,0,0.3)';
  else if (btnShadow === 'glow') shadowCss = `0 0 14px ${resolvedIcon}40`;

  let blurCss = 'none';
  if (btnBlur === 'sm') blurCss = 'blur(4px)';
  else if (btnBlur === 'md') blurCss = 'blur(8px)';
  else if (btnBlur === 'lg') blurCss = 'blur(16px)';

  const borderClass = border === 'none' ? 'border-b-0' : 'border-b';

  const resolvedContainerStyle: CSSProperties = {
    backgroundColor:
      bgStyle === 'glass' && effectiveBg !== 'transparent'
        ? `color-mix(in srgb, ${effectiveBg} 85%, transparent)`
        : effectiveBg,
    borderColor: border === 'none' ? 'transparent' : palette.sectionBorder,
    ...(bgStyle === 'glass'
      ? {
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }
      : {}),
  };

  return {
    containerClass: `w-full shrink-0 px-3.5 py-2.5 min-h-[44px] flex items-center justify-between transition-colors sticky top-0 z-30 ${borderClass}`,
    containerStyle: resolvedContainerStyle,
    titleStyle: {
      color: resolvedText,
      fontFamily: btnFont,
    },
    iconStyle: { color: resolvedIcon },
    badgeStyle: {
      color: btnBgCol ? getContrastTextHex(btnBgCol) : resolvedText,
      backgroundColor: btnBgCol || palette.softBg,
      borderColor: btnBorder === 'none' ? 'transparent' : palette.softBorder,
      fontFamily: btnFont,
      boxShadow: shadowCss,
      backdropFilter: blurCss,
      WebkitBackdropFilter: blurCss,
    },
    btnStyle: {
      fontFamily: btnFont,
      boxShadow: shadowCss,
      backdropFilter: blurCss,
      WebkitBackdropFilter: blurCss,
    },
  };
}
