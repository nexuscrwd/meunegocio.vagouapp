import type { CSSProperties } from 'react';
import { SalonAdminSettings } from '../types';
import {
  NEUTRAL_PRESETS,
  NeutralPresetId,
  getCurrentNeutralPreset,
  isLegacyOrSystemDefaultColor,
} from '../context/ThemeContext';

export function getSectionHeaderStyleData(
  adminSettings: Partial<SalonAdminSettings>,
  isDark: boolean,
  neutralPresetOverride?: NeutralPresetId
) {
  const preset = NEUTRAL_PRESETS[neutralPresetOverride || getCurrentNeutralPreset()] || NEUTRAL_PRESETS[1];

  const bgCol =
    adminSettings.sectionHeaderBgColor && !isLegacyOrSystemDefaultColor(adminSettings.sectionHeaderBgColor)
      ? adminSettings.sectionHeaderBgColor
      : undefined;

  const txtCol =
    adminSettings.sectionHeaderTextColor && !isLegacyOrSystemDefaultColor(adminSettings.sectionHeaderTextColor)
      ? adminSettings.sectionHeaderTextColor
      : undefined;

  const iconCol =
    adminSettings.sectionHeaderIconColor && !isLegacyOrSystemDefaultColor(adminSettings.sectionHeaderIconColor)
      ? adminSettings.sectionHeaderIconColor
      : isDark
        ? '#F8FAFC'
        : preset.sectionIcon;

  const bgStyle = adminSettings.sectionHeaderBgStyle || 'solid';
  const border = adminSettings.sectionHeaderBorder || 'bordered';

  const btnBgCol = adminSettings.sectionHeaderBtnBgColor;
  const btnFont = adminSettings.sectionHeaderBtnFont || 'Plus Jakarta Sans';
  const btnShadow = adminSettings.sectionHeaderBtnShadow || 'none';
  const btnBlur = adminSettings.sectionHeaderBtnBlur || 'none';
  const btnBorder = adminSettings.sectionHeaderBtnBorder || 'bordered';

  let shadowCss = 'none';
  if (btnShadow === 'subtle') shadowCss = '0 2px 8px -2px rgba(0,0,0,0.18)';
  else if (btnShadow === 'medium') shadowCss = '0 4px 16px -2px rgba(0,0,0,0.3)';
  else if (btnShadow === 'glow') shadowCss = `0 0 14px ${iconCol}40`;

  let blurCss = 'none';
  if (btnBlur === 'sm') blurCss = 'blur(4px)';
  else if (btnBlur === 'md') blurCss = 'blur(8px)';
  else if (btnBlur === 'lg') blurCss = 'blur(16px)';

  const borderClass =
    border === 'none'
      ? 'border-b-0'
      : isDark
        ? 'border-b border-slate-800'
        : 'border-b';

  const resolvedContainerStyle: CSSProperties = {
    backgroundColor: bgCol || (bgStyle === 'transparent' ? 'transparent' : isDark ? '#0F172A' : preset.sectionBg),
    borderColor: border === 'none' ? 'transparent' : isDark ? '#1E293B' : preset.sectionBorder,
  };

  return {
    containerClass: `w-full shrink-0 px-3.5 py-2.5 min-h-[44px] flex items-center justify-between transition-colors sticky top-0 z-30 ${borderClass}`,
    containerStyle: resolvedContainerStyle,
    titleStyle: {
      color: txtCol || (isDark ? '#F8FAFC' : preset.sectionText),
      fontFamily: btnFont,
    },
    iconStyle: { color: iconCol },
    badgeStyle: {
      color: txtCol || (isDark ? '#F8FAFC' : preset.sectionText),
      backgroundColor: btnBgCol || (isDark ? '#1E293B' : preset.subtleHaloBg),
      borderColor: btnBorder === 'none' ? 'transparent' : isDark ? '#334155' : preset.cardBorder,
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
