/**
 * Utilitário de Feedback Tátil (Haptic Feedback) via Web Vibration API
 * Proporciona resposta tátil nativa em dispositivos móveis compatíveis.
 * Degrada silenciosamente caso o navegador ou dispositivo não suporte vibração.
 */

export const triggerHaptic = (pattern: number | number[]): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    if ('navigator' in window && typeof navigator.vibrate === 'function') {
      return navigator.vibrate(pattern);
    }
  } catch {
    // Falha silenciosa em navegadores com restrições de permissão
  }

  return false;
};

/**
 * Toque suave (12ms)
 * Ideal para: tabs da BottomNav, seleção de serviços, toggles de filtros, favoritos.
 */
export const hapticLight = (): boolean => triggerHaptic(12);

/**
 * Toque firme (25ms)
 * Ideal para: botões de avanço de etapa, abertura de modais rápidos, botões de ação principal.
 */
export const hapticMedium = (): boolean => triggerHaptic(25);

/**
 * Padrão rítmico de sucesso (40ms, pausa 60ms, 50ms)
 * Ideal para: confirmação de agendamento, emissão de voucher, conclusão com sucesso.
 */
export const hapticSuccess = (): boolean => triggerHaptic([40, 60, 50]);

/**
 * Padrão de alerta / cancelamento (50ms, pausa 50ms, 50ms)
 * Ideal para: cancelamento de agendamento ou erro.
 */
export const hapticWarning = (): boolean => triggerHaptic([50, 50, 50]);
