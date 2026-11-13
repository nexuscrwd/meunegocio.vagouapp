import React from 'react';
import { SalonAdminSettings } from '../../types';
import { SalonDesignStudioView } from './SalonDesignStudioView';

export interface LayoutCardViewProps {
  adminSettings: SalonAdminSettings;
  onUpdateSettings: (settings: Partial<SalonAdminSettings>) => Promise<any> | void;
  onBack: () => void;
}

export const LayoutCardView: React.FC<LayoutCardViewProps> = ({
  adminSettings,
  onUpdateSettings,
  onBack,
}) => {
  return (
    <SalonDesignStudioView
      initialTab="estrutura"
      adminSettings={adminSettings}
      onUpdateSettings={onUpdateSettings}
      onBack={onBack}
    />
  );
};
