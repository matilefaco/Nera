import { toast } from 'sonner';
import { getFriendlyErrorMessage } from './getFriendlyErrorMessage';

type ExternalToastProps = Parameters<typeof toast>[1];

/**
 * Infraestrutura centralizada de mensagens Nera.
 * Garante o tom refinado, discreto e não técnico.
 */
export const notify = {
  success: (message: string, options?: ExternalToastProps) => {
    toast.success(message, options);
  },
  
  info: (message: string, options?: ExternalToastProps) => {
    toast.info(message, options);
  },
  
  warning: (message: string, options?: ExternalToastProps) => {
    toast.warning(message, options);
  },

  /**
   * Trata um erro bruto e exibe uma mensagem amigável Nera.
   * Não exibe stacks, asserts, ou códigos Firebase nus.
   * 
   * @param error O objeto de erro bruto (Error, throw, Api Response)
   * @param fallbackMessage Mensagem discreta caso o erro genérico escape
   */
  error: (error: unknown, fallbackMessage?: string, options?: ExternalToastProps) => {
    const safeMessage = getFriendlyErrorMessage(error, fallbackMessage);
    
    // Log silencioso e apenas técnico (nunca exposto à UI)
    console.error('[Notify API Captured]', error);

    toast.error(safeMessage, options);
  }
};
