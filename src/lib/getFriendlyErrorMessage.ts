export function getFriendlyErrorMessage(
  error: unknown,
  fallbackMessage = "Não foi possível concluir agora. Tente novamente em instantes."
): string {
  if (!error) return fallbackMessage;

  let message = '';
  let code = '';

  if (error instanceof Error) {
    message = error.message;
    code = (error as any).code || '';
  } else if (typeof error === 'string') {
    message = error;
  } else {
    const obj = error as any;
    message = obj.message || obj.error || '';
    code = obj.code || '';
  }

  // Se erro foi stringified pelo handleFirestoreError
  if (message && message.startsWith('{') && message.includes('"error"')) {
    try {
      const parsed = JSON.parse(message);
      message = parsed.error || message;
    } catch {
      // Ignora e usa a mensagem original
    }
  }

  const str = `${message} ${code}`.toLowerCase();

  // 1. Rede / Conexão
  if (
    str.includes('network error') ||
    str.includes('failed to fetch') ||
    str.includes('load failed') ||
    str.includes('deadline-exceeded') ||
    str.includes('unavailable') ||
    str.includes('offline') ||
    code === 'auth/network-request-failed' ||
    str.includes('network-request-failed')
  ) {
    return "Verifique sua conexão e tente novamente.";
  }

  // 2. Auth / Sessão / Permissões
  if (
    str.includes('permission-denied') ||
    str.includes('missing or insufficient permissions') ||
    str.includes('not authorized') ||
    code === 'auth/requires-recent-login'
  ) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }

  if (code === 'auth/email-already-in-use' || str.includes('email-already-in-use')) {
    return "Este e-mail já está cadastrado.";
  }

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    str.includes('invalid-credential')
  ) {
    return "Credenciais inválidas. Verifique os dados inseridos.";
  }

  if (code === 'auth/too-many-requests' || str.includes('too-many-requests')) {
    return "Muitas tentativas. Tente novamente em instantes.";
  }

  if (code === 'auth/user-disabled' || str.includes('user-disabled')) {
    return "Este acesso não está mais disponível.";
  }

  if (code === 'auth/popup-closed-by-user' || str.includes('popup-closed')) {
    return "Ação cancelada antes da conclusão.";
  }

  // 3. Firestore técnicos crus que não devem aparecer (fallback)
  if (
    str.includes('internal assertion') ||
    str.includes('transaction failed') ||
    str.includes('firestore') ||
    str.includes('database') ||
    str.includes('missing or insufficient') ||
    str.includes('permission-denied')
  ) {
    return fallbackMessage;
  }

  // Bypasses for debugging AI
  if (message && message.includes('Erro IA:')) {
    return message.substring(0, 150); // allow slightly longer
  }

  // 4. Mensagens locais limpas e amigáveis (exclusivo para mensagens customizadas da aplicação)
  if (
    message &&
    message.length >= 3 &&
    message.length < 80 &&
    !message.includes('{"') &&
    !message.includes('Firebase') &&
    !message.includes('Error:') &&
    !message.toLowerCase().includes('failed') &&
    !message.toLowerCase().includes('undefined') &&
    !str.includes('auth/') &&
    !str.includes('firestore/')
  ) {
    // Capitalize primeira letra para manter elegância Nera caso não esteja
    return message;
  }

  return fallbackMessage;
}
