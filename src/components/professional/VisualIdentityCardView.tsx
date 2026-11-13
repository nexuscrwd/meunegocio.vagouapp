import React from 'react';
import { SalonAdminSettings } from '../../types';
import { SalonDesignStudioView } from './SalonDesignStudioView';

export interface VisualIdentityCardViewProps {
  adminSettings: SalonAdminSettings;
  onUpdateSettings: (settings: Partial<SalonAdminSettings>) => Promise<any> | void;
  onBack: () => void;
}

export const VisualIdentityCardView: React.FC<VisualIdentityCardViewProps> = ({
  adminSettings,
  onUpdateSettings,
  onBack,
}) => {
  return (
    <SalonDesignStudioView
      initialTab="tema"
      adminSettings={adminSettings}
      onUpdateSettings={onUpdateSettings}
      onBack={onBack}
    />
  );
};
