import { removeUndefinedDeep } from './utils.js';

/**
 * Shared Firestore sanitization helper.
 */
export function sanitizeForFirestore<T>(payload: T): T {
  return removeUndefinedDeep(payload);
}

/**
 * Redacts sensitive user data before logging.
 */
export function redactAuthForLogs(authInfo: {
  userId?: string;
  email?: string | null;
  emailVerified?: boolean;
  isAnonymous?: boolean;
  tenantId?: string | null;
  providerInfo?: Array<{
    providerId: string;
    displayName: string | null;
    email: string | null;
    photoUrl: string | null;
  }>;
}) {
  const redactEmail = (email?: string | null) => {
    if (!email) return email;
    const [name, domain] = email.split('@');
    if (!domain) return '***';
    return `${name.slice(0, 1)}***@${domain}`;
  };

  return {
    ...authInfo,
    userId: authInfo.userId ? `${authInfo.userId.slice(0, 4)}***` : authInfo.userId,
    email: redactEmail(authInfo.email),
    providerInfo: (authInfo.providerInfo || []).map((provider) => ({
      ...provider,
      email: redactEmail(provider.email),
    })),
  };
}
