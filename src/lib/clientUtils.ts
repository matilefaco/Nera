import { Appointment } from '../types.js';

export function getClientScore(appointments: Appointment[], whatsapp: string) {
  const cleanWhatsapp = whatsapp.replace(/\D/g, '');
  if (!cleanWhatsapp) return null;

  const clientAppts = appointments.filter(a => {
    const apptWhatsapp = a.clientWhatsapp?.replace(/\D/g, '');
    return apptWhatsapp === cleanWhatsapp;
  });
  
  const completed = clientAppts.filter(a => a.status === 'completed').length;
  const noShow = clientAppts.filter(a => 
    a.status === 'cancelled' && 
    a.cancellationReason?.toLowerCase().includes('no-show')
  ).length;
  
  if (noShow >= 2) return 'risk';
  if (noShow === 1) return 'attention';
  if (completed >= 3) return 'reliable';
  return null;
}
