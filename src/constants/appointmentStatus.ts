export const APPOINTMENT_STATUS = {
  PENDING: "pending",
  PENDING_CONFIRMATION: "pending_confirmation",
  PENDING_CONFLICT: "pending_conflict",
  CONFIRMED: "confirmed",
  ACCEPTED: "accepted",
  COMPLETED: "completed",
  REJECTED: "rejected",
  DECLINED: "declined",
  CANCELLED: "cancelled",
  CANCELLED_BY_CLIENT: "cancelled_by_client",
  CANCELLED_BY_PROFESSIONAL: "cancelled_by_professional",
  EXPIRED: "expired",
  NO_SHOW: "no_show",
} as const;

export const LEGACY_APPOINTMENT_STATUS = {
  CONCLUIDO: "concluido",
} as const;

export type AppointmentStatus =
  typeof APPOINTMENT_STATUS[keyof typeof APPOINTMENT_STATUS];

export const REVENUE_STATUSES: string[] = [
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.ACCEPTED,
  APPOINTMENT_STATUS.COMPLETED,
  LEGACY_APPOINTMENT_STATUS.CONCLUIDO
];

export const PENDING_STATUSES: string[] = [
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.PENDING_CONFIRMATION,
  APPOINTMENT_STATUS.PENDING_CONFLICT
];

export const CANCELLED_STATUSES: string[] = [
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.CANCELLED_BY_CLIENT,
  APPOINTMENT_STATUS.CANCELLED_BY_PROFESSIONAL,
  APPOINTMENT_STATUS.EXPIRED
];

export const REJECTED_STATUSES: string[] = [
  APPOINTMENT_STATUS.REJECTED,
  APPOINTMENT_STATUS.DECLINED
];

export const ACTIVE_SLOT_STATUSES: string[] = [
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.PENDING_CONFIRMATION,
  APPOINTMENT_STATUS.PENDING_CONFLICT,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.ACCEPTED,
  APPOINTMENT_STATUS.COMPLETED,
  LEGACY_APPOINTMENT_STATUS.CONCLUIDO
];

export function normalizeAppointmentStatus(status: unknown): string {
  if (typeof status !== 'string') return APPOINTMENT_STATUS.PENDING;
  return status;
}

export function isPendingStatus(status?: string | null): boolean {
  if (!status) return false;
  return PENDING_STATUSES.includes(status);
}

export function isConfirmedLikeStatus(status?: string | null): boolean {
  if (!status) return false;
  return status === APPOINTMENT_STATUS.CONFIRMED || status === APPOINTMENT_STATUS.ACCEPTED;
}

export function isCompletedStatus(status?: string | null): boolean {
  if (!status) return false;
  return status === APPOINTMENT_STATUS.COMPLETED || status === LEGACY_APPOINTMENT_STATUS.CONCLUIDO;
}

export function isRevenueStatus(status?: string | null): boolean {
  if (!status) return false;
  return REVENUE_STATUSES.includes(status);
}

export function isCancelledStatus(status?: string | null): boolean {
  if (!status) return false;
  return CANCELLED_STATUSES.includes(status);
}

export function isRejectedStatus(status?: string | null): boolean {
  if (!status) return false;
  return REJECTED_STATUSES.includes(status);
}

export function isInactiveStatus(status?: string | null): boolean {
  if (!status) return false;
  return isCancelledStatus(status) || isRejectedStatus(status) || status === APPOINTMENT_STATUS.NO_SHOW;
}

export function isActiveSlotStatus(status?: string | null): boolean {
  if (!status) return false;
  return ACTIVE_SLOT_STATUSES.includes(status);
}

export function shouldBlockSlot(status?: string | null): boolean {
  if (!status) return false;
  // Any active appointment blocks a slot
  return isActiveSlotStatus(status);
}
