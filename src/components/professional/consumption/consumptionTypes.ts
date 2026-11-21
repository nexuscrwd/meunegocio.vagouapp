export interface EnergyTariffConfig {
  concessionaria: string;
  uf?: string;
  teRate: number;
  tusdRate: number;
  flagType: 'Verde' | 'Amarela' | 'Vermelha 1' | 'Vermelha 2';
  flagRate: number;
  icmsPercent: number;
  pisCofinsPercent: number;
  cosipFixed: number;
}

export interface WaterTariffConfig {
  concessionaria: string;
  uf?: string;
  waterRateM3: number;
  sewagePercent: number;
  fixedAvailability: number;
  waterPerServiceLiters: number;
}

export interface EnergyReading {
  id: string;
  date: string;
  meterReadingKwh: number;
  consumptionPeriodKwh?: number;
  costAmountReais?: number;
  notes?: string;
}

export interface WaterReading {
  id: string;
  date: string;
  meterReadingM3: number;
  consumptionPeriodM3?: number;
  costAmountReais?: number;
  notes?: string;
}

export interface OperationalEquipment {
  id: string;
  name: string;
  category: 'Corte & Acabamento' | 'Térmico & Secagem' | 'Lavatório & Água' | 'Outros Operacionais';
  voltage: '110V' | '220V' | 'Bivolt';
  powerWatts: number;
  kwhPerHour: number;
  avgHoursPerDay: number;
  lastMaintenance: string;
  status: 'Operacional' | 'Revisão' | 'Manutenção';
}

export interface InfrastructureEquipment {
  id: string;
  name: string;
  category: 'Climatização' | 'Copa dos Funcionários' | 'Bebidas & Clientes' | 'Outra Infraestrutura';
  voltage: '110V' | '220V' | 'Bivolt';
  powerWatts: number;
  kwhPerHour: number;
  avgHoursPerDay: number;
  lastMaintenance: string;
  status: 'Operacional' | 'Revisão' | 'Manutenção';
}
