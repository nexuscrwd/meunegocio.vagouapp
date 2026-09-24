export interface BookingSlotItem {
  time: string;
  available: boolean;
  period: 'manha' | 'tarde' | 'noite';
}

export function getAvailableSlotsForDate(_dateStr?: string, _serviceOrProId?: string): BookingSlotItem[] {
  return [
    { time: '08:00', period: 'manha', available: true },
    { time: '08:30', period: 'manha', available: true },
    { time: '09:00', period: 'manha', available: true },
    { time: '09:30', period: 'manha', available: true },
    { time: '10:00', period: 'manha', available: true },
    { time: '10:30', period: 'manha', available: true },
    { time: '11:00', period: 'manha', available: true },
    { time: '11:30', period: 'manha', available: true },
    { time: '13:00', period: 'tarde', available: true },
    { time: '13:30', period: 'tarde', available: true },
    { time: '14:00', period: 'tarde', available: true },
    { time: '14:30', period: 'tarde', available: true },
    { time: '15:00', period: 'tarde', available: true },
    { time: '15:30', period: 'tarde', available: true },
    { time: '16:00', period: 'tarde', available: true },
    { time: '16:30', period: 'tarde', available: true },
    { time: '17:00', period: 'tarde', available: true },
    { time: '17:30', period: 'tarde', available: true },
    { time: '18:00', period: 'noite', available: true },
    { time: '18:30', period: 'noite', available: true },
    { time: '19:00', period: 'noite', available: true },
    { time: '19:30', period: 'noite', available: true },
  ];
}
