/**
 * Formata um slot de data/horário para a síntese compacta mobile "DD/MM às HH:MM"
 * Exemplo:
 * - "Hoje • 14:30" => "02/09 às 14:30"
 * - "Amanhã • 10:00" => "03/09 às 10:00"
 * - "15:00" => "02/09 às 15:00"
 * - "02/09 às 14:30" => "02/09 às 14:30"
 */
export function formatSlotDateTime(slotStr?: string): string {
  if (!slotStr) return '';
  const trimmed = slotStr.trim();

  // Extrai apenas o horário HH:MM
  const timeMatch = trimmed.match(/(\d{1,2}:\d{2})/);
  const timeOnly = timeMatch ? timeMatch[1].padStart(5, '0') : trimmed;

  return timeOnly;
}
