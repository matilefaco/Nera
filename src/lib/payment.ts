
/**
 * Canonical payment method IDs
 */
export type PaymentMethodId = 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'bank_transfer' | 'digital_wallet';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodId, string> = {
  pix: 'Pix',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  cash: 'Dinheiro',
  bank_transfer: 'Transferência Bancária',
  digital_wallet: 'Carteira Digital'
};

/**
 * Normalizes various payment method strings to canonical IDs
 */
export function normalizePaymentMethod(method: string): PaymentMethodId | string {
  if (!method) return method;
  
  const m = method.toLowerCase().trim();
  
  // Pix
  if (m === 'pix') return 'pix';
  
  // Credit Card
  if (['credito', 'crédito', 'cartao_credito', 'cartão de crédito', 'credit', 'credit_card'].includes(m)) {
    return 'credit_card';
  }
  
  // Debit Card
  if (['debito', 'débito', 'cartao_debito', 'cartão de débito', 'debit', 'debit_card'].includes(m)) {
    return 'debit_card';
  }
  
  // Cash
  if (['dinheiro', 'cash'].includes(m)) {
    return 'cash';
  }
  
  // Bank Transfer
  if (['transferencia', 'transferência', 'bank_transfer', 'transfer'].includes(m)) {
    return 'bank_transfer';
  }
  
  return m;
}

/**
 * Deduplicates and normalizes a list of payment methods
 */
export function getNormalizedPaymentMethods(methods: string[] | null | undefined): PaymentMethodId[] {
  if (!methods || !Array.isArray(methods)) return [];
  
  const normalized = methods.map(m => normalizePaymentMethod(m) as PaymentMethodId);
  const unique = Array.from(new Set(normalized));
  
  // Sort in a premium order
  const order: PaymentMethodId[] = ['pix', 'credit_card', 'debit_card', 'cash', 'bank_transfer', 'digital_wallet'];
  
  return unique.sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    
    // If not in order list, put at the end
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    
    return indexA - indexB;
  });
}
