export interface TimeSlotOption {
  time: string;
  period: 'manha' | 'tarde' | 'noite';
  available: boolean;
}

/**
 * Retorna os slots padrão do salão com disponibilidade sincronizada baseada em data e profissional
 */
export const getAvailableSlotsForDate = (
  dateIso: string,
  professionalName = 'any'
): TimeSlotOption[] => {
  const morningSlots = ['08:30', '09:15', '10:00', '10:45', '11:30'];
  const afternoonSlots = ['13:30', '14:15', '15:00', '15:45', '16:30', '17:15'];
  const eveningSlots = ['18:00', '18:45', '19:30'];

  const all = [
    ...morningSlots.map((t) => ({ time: t, period: 'manha' as const })),
    ...afternoonSlots.map((t) => ({ time: t, period: 'tarde' as const })),
    ...eveningSlots.map((t) => ({ time: t, period: 'noite' as const })),
  ];

  return all.map((slot) => {
    const hash = `${dateIso}-${slot.time}-${professionalName}`
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const isOccupied = hash % 5 === 0;
    return {
      ...slot,
      available: !isOccupied,
    };
  });
};
