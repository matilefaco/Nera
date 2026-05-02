import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, RefreshCw, User, AlertCircle, CheckCircle2, Inbox } from 'lucide-react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, query, where, type DocumentData } from 'firebase/firestore';
import { auth, db, firebaseConfigReady } from '../firebase';

type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | string;

interface Appointment {
  id: string;
  professionalId?: string;
  status?: AppointmentStatus;
  date?: string;
  time?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceName?: string;
  serviceId?: string;
  notes?: string;
  createdAt?: unknown;
  client?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  service?: {
    name?: string;
    price?: number;
    duration?: number;
  };
}

function normalizeAppointment(id: string, data: DocumentData): Appointment {
  return {
    id,
    professionalId: typeof data.professionalId === 'string' ? data.professionalId : undefined,
    status: typeof data.status === 'string' ? data.status : 'pending',
    date: typeof data.date === 'string' ? data.date : undefined,
    time: typeof data.time === 'string' ? data.time : undefined,
    clientName: typeof data.clientName === 'string' ? data.clientName : undefined,
    clientPhone: typeof data.clientPhone === 'string' ? data.clientPhone : undefined,
    clientEmail: typeof data.clientEmail === 'string' ? data.clientEmail : undefined,
    serviceName: typeof data.serviceName === 'string' ? data.serviceName : undefined,
    serviceId: typeof data.serviceId === 'string' ? data.serviceId : undefined,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    createdAt: data.createdAt,
    client: typeof data.client === 'object' && data.client ? data.client : undefined,
    service: typeof data.service === 'object' && data.service ? data.service : undefined,
  };
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function clientLabel(appointment: Appointment) {
  return appointment.clientName || appointment.client?.name || 'Cliente sem nome';
}

function phoneLabel(appointment: Appointment) {
  return appointment.clientPhone || appointment.client?.phone || 'Sem telefone';
}

function serviceLabel(appointment: Appointment) {
  return appointment.serviceName || appointment.service?.name || appointment.serviceId || 'Serviço não informado';
}

function formatDate(date?: string) {
  if (!date) return 'Data não informada';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  return (
    <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">{serviceLabel(appointment)}</p>
          <h3 className="mt-2 text-lg font-semibold text-stone-950">{clientLabel(appointment)}</h3>
          <p className="mt-1 text-sm text-stone-500">{phoneLabel(appointment)}</p>
        </div>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold capitalize text-stone-700">
          {appointment.status || 'pending'}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-stone-600">
        <div className="flex items-center gap-2 rounded-2xl bg-stone-50 px-3 py-3">
          <Calendar size={16} />
          <span>{formatDate(appointment.date)}</span>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-stone-50 px-3 py-3">
          <Clock size={16} />
          <span>{appointment.time || 'Hora não informada'}</span>
        </div>
      </div>

      {appointment.notes ? <p className="mt-4 text-sm text-stone-500">{appointment.notes}</p> : null}
    </article>
  );
}

export default function Dashboard() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseConfigReady || !auth) {
      setAuthLoading(false);
      setError('Firebase não está configurado no frontend. Confira as variáveis VITE_FIREBASE_* no ambiente.');
      return;
    }

    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setAppointments([]);
      return;
    }

    setAppointmentsLoading(true);
    setError(null);

    const appointmentsQuery = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      appointmentsQuery,
      (snapshot) => {
        const list = snapshot.docs
          .map((doc) => normalizeAppointment(doc.id, doc.data()))
          .sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));

        setAppointments(list);
        setAppointmentsLoading(false);
      },
      (snapshotError) => {
        console.error('Erro ao carregar appointments:', snapshotError);
        setError('Não consegui carregar os agendamentos. Verifique permissões do Firestore e índices.');
        setAppointmentsLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const todayIso = getTodayIso();

  const pendingRequests = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'pending'),
    [appointments]
  );

  const confirmedToday = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'confirmed' && appointment.date === todayIso),
    [appointments, todayIso]
  );

  const upcomingConfirmed = useMemo(
    () => appointments.filter((appointment) => appointment.status === 'confirmed' && appointment.date !== todayIso).slice(0, 8),
    [appointments, todayIso]
  );

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FBFBF9] p-6 text-stone-700">
        <RefreshCw className="mr-3 animate-spin" size={20} />
        Carregando painel...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#FBFBF9] px-5 py-10 text-stone-950">
        <section className="mx-auto max-w-2xl rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <User size={22} />
          </div>
          <h1 className="text-3xl font-serif">Dashboard da profissional</h1>
          <p className="mt-3 text-stone-600">
            Para carregar os agendamentos, a profissional precisa estar logada. O painel lê a collection appointments usando professionalId igual ao user.uid.
          </p>
          {error ? <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FBFBF9] px-4 py-6 text-stone-950 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">Nera Professional</p>
            <h1 className="mt-2 text-4xl font-serif">Dashboard</h1>
            <p className="mt-2 text-stone-500">Agendamentos lidos em tempo real da collection appointments.</p>
          </div>
          <div className="text-sm text-stone-500">
            <p className="font-medium text-stone-900">{user.email || 'Profissional logada'}</p>
            <p className="break-all">UID: {user.uid}</p>
          </div>
        </header>

        {error ? (
          <div className="mb-6 flex gap-3 rounded-3xl border border-red-100 bg-red-50 p-5 text-red-700">
            <AlertCircle className="mt-0.5 shrink-0" size={20} />
            <p>{error}</p>
          </div>
        ) : null}

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Pendentes</p>
            <p className="mt-3 text-4xl font-semibold">{pendingRequests.length}</p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Confirmados hoje</p>
            <p className="mt-3 text-4xl font-semibold">{confirmedToday.length}</p>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-stone-500">Total carregado</p>
            <p className="mt-3 text-4xl font-semibold">{appointments.length}</p>
          </div>
        </section>

        {appointmentsLoading ? (
          <div className="mb-8 flex items-center gap-3 rounded-3xl border border-stone-200 bg-white p-5 text-stone-600">
            <RefreshCw className="animate-spin" size={18} />
            Buscando agendamentos...
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Inbox size={20} />
              <h2 className="text-2xl font-serif">Solicitações pendentes</h2>
            </div>
            <div className="space-y-4">
              {pendingRequests.length > 0 ? (
                pendingRequests.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)
              ) : (
                <div className="rounded-3xl border border-dashed border-stone-200 bg-white p-8 text-center text-stone-500">
                  Nenhuma solicitação pendente agora.
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center gap-2">
              <CheckCircle2 size={20} />
              <h2 className="text-2xl font-serif">Confirmados hoje</h2>
            </div>
            <div className="space-y-4">
              {confirmedToday.length > 0 ? (
                confirmedToday.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)
              ) : (
                <div className="rounded-3xl border border-dashed border-stone-200 bg-white p-8 text-center text-stone-500">
                  Nenhum agendamento confirmado para hoje.
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-serif">Próximos confirmados</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {upcomingConfirmed.length > 0 ? (
              upcomingConfirmed.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)
            ) : (
              <div className="rounded-3xl border border-dashed border-stone-200 bg-white p-8 text-center text-stone-500 md:col-span-2 xl:col-span-3">
                Nenhum próximo agendamento confirmado carregado.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
