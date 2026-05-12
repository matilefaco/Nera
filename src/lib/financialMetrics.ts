import { Appointment } from '../types';
import { 
  isCompletedStatus, 
  isConfirmedLikeStatus, 
  isPendingStatus, 
  isCancelledStatus,
  isRevenueStatus
} from '../constants/appointmentStatus';

export interface RevenueByService {
  name: string;
  count: number;
  revenue: number;
}

export interface FinancialMetrics {
  monthlyRevenue: number;          // Completed + Confirmed + Accepted
  receivedRevenue: number;         // Completed only
  receivableRevenue: number;       // Confirmed + Accepted only
  pendingConfirmationRevenue: number; // Pending only
  cancelledRevenue: number;        // Cancelled only
  completedCount: number;
  confirmedCount: number;
  cancelledCount: number;
  pendingCount: number;
  totalValidAppointments: number;  // Completed + Confirmed + Accepted
  averageTicket: number;
  revenueByService: RevenueByService[];
}

/**
 * Calculates standardized financial metrics for a given list of appointments.
 * NOTE: The appointments passed here should be pre-filtered by the desired date range.
 * For standardized monthly metrics, pass appointments from the 1st to the last day of the month.
 */
export function calculateFinancialMetrics(appointments: Appointment[]): FinancialMetrics {
  let monthlyRevenue = 0;
  let receivedRevenue = 0;
  let receivableRevenue = 0;
  let pendingConfirmationRevenue = 0;
  let cancelledRevenue = 0;
  
  let completedCount = 0;
  let confirmedCount = 0;
  let cancelledCount = 0;
  let pendingCount = 0;
  
  const servicesMap: Record<string, { count: number; revenue: number }> = {};

  appointments.forEach(app => {
    // Determine monetary value
    const val = (app.price || 0) + (app.travelFee || 0);

    const isCompleted = isCompletedStatus(app.status);
    const isConfirmed = isConfirmedLikeStatus(app.status);
    const isPending = isPendingStatus(app.status);
    const isCancelled = isCancelledStatus(app.status);

    if (isCompleted) {
      completedCount++;
      receivedRevenue += val;
      monthlyRevenue += val;
    } else if (isConfirmed) {
      confirmedCount++;
      receivableRevenue += val;
      monthlyRevenue += val;
    } else if (isPending) {
      pendingCount++;
      pendingConfirmationRevenue += val;
    } else if (isCancelled) {
      cancelledCount++;
      cancelledRevenue += val;
    }

    // Revenue by service logic: only for valid financially
    if (isCompleted || isConfirmed) {
      const sName = app.serviceName || '-';
      if (!servicesMap[sName]) servicesMap[sName] = { count: 0, revenue: 0 };
      servicesMap[sName].count++;
      servicesMap[sName].revenue += val;
    }
  });

  const totalValidAppointments = completedCount + confirmedCount;
  const averageTicket = totalValidAppointments > 0 ? (monthlyRevenue / totalValidAppointments) : 0;

  const revenueByService = Object.entries(servicesMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    monthlyRevenue,
    receivedRevenue,
    receivableRevenue,
    pendingConfirmationRevenue,
    cancelledRevenue,
    completedCount,
    confirmedCount,
    cancelledCount,
    pendingCount,
    totalValidAppointments,
    averageTicket,
    revenueByService
  };
}

/**
 * Helper to filter appointments by exact month boundaries.
 */
export function filterAppointmentsByCurrentMonth(appointments: Appointment[], refDate: Date = new Date()): Appointment[] {
  const currentMonth = refDate.getMonth();
  const currentYear = refDate.getFullYear();
  
  return appointments.filter(app => {
    if (!app.date) return false;
    // ensure parsing doesn't shift timezone bounds
    const dObj = new Date(app.date + 'T12:00:00');
    return dObj.getMonth() === currentMonth && dObj.getFullYear() === currentYear;
  });
}

/**
 * Helper to filter appointments by strict date range [startStr, endStr].
 * Format: 'YYYY-MM-DD'
 */
export function filterAppointmentsByDateRange(appointments: Appointment[], startStr: string, endStr: string): Appointment[] {
  return appointments.filter(app => {
    if (!app.date) return false;
    return app.date >= startStr && app.date <= endStr;
  });
}
