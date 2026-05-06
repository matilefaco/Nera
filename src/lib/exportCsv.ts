import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { notify } from './notify';
import { Appointment, ClientSummary } from '../types';

function downloadCSV(csvContent: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSV(val: string | number | undefined | null): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportClientsCsv(professionalId: string) {
  try {
    const q = query(
      collection(db, 'client_summaries'),
      where('professionalId', '==', professionalId)
    );
    const snap = await getDocs(q);
    
    if (snap.empty) {
      notify.info('Nenhum cliente para exportar.');
      return;
    }

    const headers = ['Nome', 'WhatsApp', 'Email', 'Total Agendamentos', 'Ultimo Agendamento', 'Total Gasto', 'No Shows'];
    const rows: string[] = [];
    rows.push(headers.join(','));

    snap.docs.forEach(docSnap => {
      const data = docSnap.data() as ClientSummary;
      const row = [
        escapeCSV(data.clientName),
        escapeCSV(data.clientPhone),
        escapeCSV(data.clientEmail),
        escapeCSV(data.totalAppointments),
        escapeCSV(data.lastAppointmentDate),
        escapeCSV(data.totalSpent),
        escapeCSV(data.noShows ?? data.noShowCount)
      ];
      rows.push(row.join(','));
    });

    const date = new Date().toISOString().slice(0, 7);
    downloadCSV(rows.join('\n'), `nera-clientes-${date}.csv`);
    notify.success('Exportação de clientes concluída.');
  } catch (error) {
    console.error('Export erro:', error);
    notify.error('Erro ao exportar clientes.');
  }
}

export async function exportAppointmentsCsv(professionalId: string) {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

    const q = query(
      collection(db, 'appointments'),
      where('professionalId', '==', professionalId),
      where('date', '>=', oneYearAgoStr),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      notify.info('Nenhum agendamento para exportar no último ano.');
      return;
    }

    const headers = ['Data', 'Hora', 'Cliente', 'WhatsApp', 'Servico', 'Valor', 'Status', 'Tipo'];
    const rows: string[] = [];
    rows.push(headers.join(','));

    snap.docs.forEach(docSnap => {
      const data = docSnap.data() as Appointment;
      const row = [
        escapeCSV(data.date),
        escapeCSV(data.time),
        escapeCSV(data.clientName),
        escapeCSV(data.clientWhatsapp),
        escapeCSV(data.serviceName),
        escapeCSV(data.price),
        escapeCSV(data.status),
        escapeCSV(data.isHomecare ? 'Homecare' : 'Estudio')
      ];
      rows.push(row.join(','));
    });

    const date = new Date().toISOString().slice(0, 7);
    downloadCSV(rows.join('\n'), `nera-agendamentos-${date}.csv`);
    notify.success('Exportação de agendamentos concluída.');
  } catch (error) {
    console.error('Export erro:', error);
    notify.error('Erro ao exportar agendamentos.');
  }
}

export async function exportFinancialCsv(professionalId: string) {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

    const q = query(
      collection(db, 'appointments'),
      where('professionalId', '==', professionalId),
      where('date', '>=', oneYearAgoStr),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);

    const revenueDocs = snap.docs.filter(docSnap => {
      const data = docSnap.data() as Appointment;
      return ['confirmed', 'completed', 'accepted'].includes(data.status);
    });

    if (revenueDocs.length === 0) {
      notify.info('Nenhum dado financeiro para exportar no último ano.');
      return;
    }

    const headers = ['Data', 'Servico', 'Cliente', 'Valor Servico', 'Taxa Deslocamento', 'Total', 'Status'];
    const rows: string[] = [];
    rows.push(headers.join(','));

    revenueDocs.forEach(docSnap => {
      const data = docSnap.data() as Appointment;
      const price = data.price || 0;
      const travel = data.travelFee || 0;
      const total = price + travel;

      const row = [
        escapeCSV(data.date),
        escapeCSV(data.serviceName),
        escapeCSV(data.clientName),
        escapeCSV(price),
        escapeCSV(travel),
        escapeCSV(total),
        escapeCSV(data.status)
      ];
      rows.push(row.join(','));
    });

    const date = new Date().toISOString().slice(0, 7);
    downloadCSV(rows.join('\n'), `nera-financeiro-${date}.csv`);
    notify.success('Exportação financeira concluída.');
  } catch (error) {
    console.error('Export erro:', error);
    notify.error('Erro ao exportar financeiro.');
  }
}
