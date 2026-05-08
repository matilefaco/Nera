import { useMemo } from 'react';
import { Appointment, AnalyticsEvent } from '../types';
import { isRevenueStatus } from '../constants/appointmentStatus';
import { getTodayLocale } from '../lib/utils';

export function useDashboardMetrics(
  appointments: Appointment[],
  analyticsEvents: AnalyticsEvent[],
  totalClientsCountOverride?: number | null
) {
  return useMemo(() => {
    // Basic setup
    const now = new Date();
    const todayStr = getTodayLocale();
    
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    // Analytics Events Accumulation (Single Pass)
    let visits30d = 0;
    let visits7d = 0;
    let clicksBook = 0;
    const originsMap: Record<string, number> = {};

    for (let i = 0; i < analyticsEvents.length; i++) {
        const e = analyticsEvents[i];
        if (!e.timestamp || typeof e.timestamp.toDate !== 'function') continue;
        const eDate = e.timestamp.toDate();
        
        if (eDate > thirtyDaysAgo) {
            if (e.type === 'visit') visits30d++;
            if (e.type === 'click_book') clicksBook++;
        }
        if (eDate > sevenDaysAgo && e.type === 'visit') {
            visits7d++;
        }
        const o = e.origin || 'Direto';
        originsMap[o] = (originsMap[o] || 0) + 1;
    }

    let maxOriginCount = -1;
    let mainOriginRaw = 'Direto';
    for (const origin in originsMap) {
        if (originsMap[origin] > maxOriginCount) {
            maxOriginCount = originsMap[origin];
            mainOriginRaw = origin;
        }
    }
    const mainOrigin = mainOriginRaw === 'instagram' ? 'Instagram' : mainOriginRaw === 'direct' ? 'Direto' : 'Outros';

    // Appointments Accumulation (Single Pass)
    let appointments30d = 0;
    let monthlyCount = 0;
    let monthlyRevenue = 0;
    let prevMonthlyRevenue = 0;
    let returningThisWeek = 0;

    const clientMap = new Map<string, string>();
    const monthlyClients = new Set<string>();
    
    const servicesMap: Record<string, { count: number, revenue: number }> = {};
    const timesMap: Record<string, number> = {};
    const daysMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    
    const confirmedAppointments: Appointment[] = [];
    
    let lastDateObj: Date | null = null;

    for (let i = 0; i < appointments.length; i++) {
        const app = appointments[i];
        if (!app.date || typeof app.date !== 'string' || app.date.indexOf('-') === -1) continue;
        
        const isRevenue = isRevenueStatus(app.status);
        const isDoneOrAccepted = isRevenueStatus(app.status);

        if (isRevenue) {
            confirmedAppointments.push(app);
            
            // For daysSinceLastAppointment
            const dObj = new Date(app.date + 'T12:00:00');
            if (app.date <= todayStr && (!lastDateObj || dObj > lastDateObj)) {
                lastDateObj = dObj;
            }
        }

        // Total clients logic
        const clientKey = app.clientWhatsapp?.replace(/\D/g, '') || app.clientEmail || app.clientName;
        if (clientKey) {
            const existingLastDate = clientMap.get(clientKey);
            if (!existingLastDate || app.date > existingLastDate) {
                clientMap.set(clientKey, app.date);
            }
        }

        if (isDoneOrAccepted) {
            const appDateObj = new Date(app.date + 'T12:00:00');
            
            // 30 days logic
            if (appDateObj > thirtyDaysAgo) {
                appointments30d++;
            }

            const appMonth = appDateObj.getMonth();
            const appYear = appDateObj.getFullYear();

            // Monthly stats logic (Current Month)
            if (appMonth === currentMonth && appYear === currentYear) {
                monthlyCount++;
                if (clientKey) monthlyClients.add(clientKey);
                
                // Revenue
                if (isRevenue) {
                    monthlyRevenue += (app.price || 0) + (app.travelFee || 0);
                }

                // Top services (Current Month, isDoneOrAccepted)
                const sName = app.serviceName || '-';
                if (!servicesMap[sName]) servicesMap[sName] = { count: 0, revenue: 0 };
                servicesMap[sName].count++;
                servicesMap[sName].revenue += (app.price || 0) + (app.travelFee || 0);
            } 
            // Prev month revenue
            else if (appMonth === prevMonth && appYear === prevMonthYear) {
                if (isRevenue) {
                    prevMonthlyRevenue += (app.price || 0) + (app.travelFee || 0);
                }
            }

            // Returning this week
            if (app.date >= todayStr && app.date <= nextWeekStr && isRevenue) {
                returningThisWeek++;
            }

            // Best Time (isDoneOrAccepted)
            if (app.time && typeof app.time === 'string') {
                const hour = app.time.split(':')[0] + ':00';
                timesMap[hour] = (timesMap[hour] || 0) + 1;
            }

            // Weakest day (isDoneOrAccepted)
            const dayOfWeek = appDateObj.getDay();
            if (dayOfWeek >= 1 && dayOfWeek <= 6) {
                daysMap[dayOfWeek] = (daysMap[dayOfWeek] || 0) + 1;
            }
        }
    }

    // Days since last appointment calculation
    let daysSinceLastAppointment = null;
    if (lastDateObj) {
        const todayAtNoon = new Date();
        todayAtNoon.setHours(12, 0, 0, 0);
        const diffTime = todayAtNoon.getTime() - lastDateObj.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        daysSinceLastAppointment = diffDays >= 0 ? diffDays : null;
    }

    // Top Service
    let topService = '-';
    let maxSvcCount = -1;
    for (const sName in servicesMap) {
        if (servicesMap[sName].count > maxSvcCount) {
            maxSvcCount = servicesMap[sName].count;
            topService = sName;
        }
    }

    // Services by month
    const servicesByMonth = Object.entries(servicesMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Best Time
    let bestTime = '-';
    let maxTimeCount = -1;
    for (const time in timesMap) {
        if (timesMap[time] > maxTimeCount) {
            maxTimeCount = timesMap[time];
            bestTime = time;
        }
    }

    // Weakest day
    let weakestDay = '-';
    let minDayCount = Infinity;
    let weakestDayIdx = null;
    for (const dayStr in daysMap) {
        const count = daysMap[dayStr as unknown as number];
        if (count < minDayCount) {
            minDayCount = count;
            weakestDayIdx = parseInt(dayStr);
        }
    }
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    if (weakestDayIdx !== null) {
        weakestDay = dayNames[weakestDayIdx];
    }

    // Growth Metrics
    const convRate = visits30d > 0 ? (appointments30d / visits30d) * 100 : 0;
    const growthInsight = convRate > 5 
      ? "Sua conversão está acima da média! Tente aumentar sua vitrine com mais fotos para converter ainda mais."
      : "Seu volume de visitas é bom, mas a conversão pode melhorar. Ajuste os nomes dos seus serviços para torná-los mais atraentes.";

    // Assemble final output
    const isBothEmpty = appointments.length === 0 && analyticsEvents.length === 0;

    return {
        confirmedAppointments,
        totalClientsCount: typeof totalClientsCountOverride === 'number' ? totalClientsCountOverride : clientMap.size,
        monthlyRevenue,
        prevMonthlyRevenue,
        returningThisWeek,
        monthlyStats: {
            count: monthlyCount,
            clientsCount: monthlyClients.size
        },
        servicesByMonth,
        daysSinceLastAppointment,
        growthMetrics: isBothEmpty ? null : {
            visits7d,
            visits30d,
            clicksBook,
            convRate,
            topService,
            bestTime,
            weakestDay,
            growthInsight,
            mainOrigin
        }
    };

  }, [appointments, analyticsEvents]);
}
