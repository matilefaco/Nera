export const APPOINTMENT_STATUS = {
  PENDING: "pending",
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

export type AppointmentStatus =
  typeof APPOINTMENT_STATUS[keyof typeof APPOINTMENT_STATUS];

export const REVENUE_STATUSES: string[] = [
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.ACCEPTED,
  APPOINTMENT_STATUS.COMPLETED
];

export const PENDING_STATUSES: string[] = [
  APPOINTMENT_STATUS.PENDING
];

export const CANCELLED_STATUSES: string[] = [
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.CANCELLED_BY_CLIENT,
  APPOINTMENT_STATUS.CANCELLED_BY_PROFESSIONAL,
  APPOINTMENT_STATUS.REJECTED,
  APPOINTMENT_STATUS.DECLINED,
  APPOINTMENT_STATUS.EXPIRED
];

export const ACTIVE_SLOT_STATUSES: string[] = [
  APPOINTMENT_STATUS.PENDING,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.ACCEPTED,
  APPOINTMENT_STATUS.COMPLETED
];

export function isRevenueStatus(status?: string | null): boolean {
  if (!status) return false;
  return REVENUE_STATUSES.includes(status);
}

export function isPendingStatus(status?: string | null): boolean {
  if (!status) return false;
  return PENDING_STATUSES.includes(status);
}

export function isCancelledStatus(status?: string | null): boolean {
  if (!status) return false;
  return CANCELLED_STATUSES.includes(status);
}

export function isActiveSlotStatus(status?: string | null): boolean {
  if (!status) return false;
  return ACTIVE_SLOT_STATUSES.includes(status);
}

export function normalizeAppointmentStatus(status: unknown): AppointmentStatus | string {
  if (typeof status !== 'string') return APPOINTMENT_STATUS.PENDING;
  return status;
}
