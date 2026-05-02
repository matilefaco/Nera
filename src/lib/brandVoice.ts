/**
 * Nera Brand Voice Guidelines
 * 
 * Nera speaks as a modern luxury concierge:
 * - Elegant without arrogance: High-end vocabulary but accessible and clear.
 * - Feminine without cliché: Avoid generic pink/soft terminology; focus on strength, precision, and beauty in details.
 * - Professional without coldness: Human-centric, empathetic, and sophisticated.
 * - Welcoming without being cheesy: Aspirational and warm, yet refined.
 */

export const BRAND_VOICE = {
  TONE: 'Modern Luxury Concierge',
  PRINCIPLES: [
    'Elegance & Precision',
    'Human-Centric Professionalism',
    'Authentic Beauty',
    'Empowered Sophistication'
  ],
  VOCABULARY: {
    SERVICE: 'Experiência',
    PROFILE: 'Minha Marca',
    PUBLIC_PAGE: 'Vitrine',
    BOOKING: 'Reserva',
    DASHBOARD: 'Painel',
    CLIENTS: 'Relacionamentos',
    CONFIRM: 'Confirmar Reserva',
    REJECT: 'Indisponível',
    PENDING: 'Nova Reserva',
    SUCCESS: 'Concluído com sucesso'
  }
};

export const applyBrandVoice = (text: string): string => {
  // This is a placeholder for a more complex mapping if needed
  // For now, it serves as an internal documentation of the voice
  return text;
};
