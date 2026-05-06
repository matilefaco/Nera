import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, handleBookingError, auth } from '../firebase';
import { motion } from 'motion/react';
import { Check, X, Calendar, Clock, User, MessageCircle, MapPin, Sparkles } from 'lucide-react';
import { notify } from '../lib/notify';
import { cn } from '../lib/utils';
import { Appointment } from '../types';
import { APPOINTMENT_STATUS } from '../constants/appointmentStatus';

export default function BookingResponsePage() {
  const { appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Appointment['status'] | null>(null);

  useEffect(() => {
    const fetchAppointment = async () => {
      if (!appointmentId) return;
      try {
        const docRef = doc(db, 'appointments', appointmentId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Appointment;
          setAppointment(data);
          if (data.status !== APPOINTMENT_STATUS.PENDING) {
            setResult(data.status === APPOINTMENT_STATUS.CONFIRMED ? APPOINTMENT_STATUS.CONFIRMED : APPOINTMENT_STATUS.CANCELLED_BY_PROFESSIONAL);
          }
        }
      } catch (error) {
        console.error('Error fetching appointment:', error);
        notify.error('Não foi possível carregar as informações agora.');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointment();
  }, [appointmentId]);

  const handleResponse = async (decision: typeof APPOINTMENT_STATUS.CONFIRMED | typeof APPOINTMENT_STATUS.CANCELLED_BY_PROFESSIONAL) => {
    if (!appointmentId || processing) return;
    
    // Attempt to get the current user to pass their token
    const currentUser = auth.currentUser;
    if (!currentUser) {
      notify.error("Para responder via link, você precisa estar logado na sua conta.");
      return;
    }

    setProcessing(true);
    console.info("[CONFIRM FLOW]", {
      appointmentId,
      mode: "backend_only",
      decision
    });
    
    try {
      const token = await currentUser.getIdToken(true);

      if (decision === APPOINTMENT_STATUS.CONFIRMED) {
        const res = await fetch(`/api/appointments/${appointmentId}/confirm`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ professionalId: currentUser.uid })
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erro ao confirmar (${res.status})`);
        }
      } else {
        const res = await fetch(`/api/appointments/${appointmentId}/decline`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        
        if (!res.ok) {
           const errData = await res.json().catch(() => ({}));
           throw new Error(errData.error || `Erro ao recusar (${res.status})`);
        }
      }
      setResult(decision);
      notify.success(decision === APPOINTMENT_STATUS.CONFIRMED ? 'Reserva confirmada com sucesso.' : 'Reserva marcada como indisponível.');
    } catch (error: any) {
      console.error("[RESPONSE FLOW ERROR]", error);
      notify.error(error.message || 'Não foi possível concluir. Tente novamente.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-parchment">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-brand-mist rounded-full mb-4" />
          <div className="h-4 w-32 bg-brand-mist rounded" />
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-parchment p-6 text-center">
        <X size={48} className="text-brand-mist mb-6" />
        <h1 className="text-2xl font-serif text-brand-ink mb-4">Reserva não encontrada</h1>
        <p className="text-brand-stone max-w-xs">Este link pode ter expirado ou a reserva foi removida.</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-parchment p-6 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mb-8",
            result === APPOINTMENT_STATUS.CONFIRMED ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
          )}
        >
          {result === APPOINTMENT_STATUS.CONFIRMED ? <Check size={40} /> : <X size={40} />}
        </motion.div>
        <h1 className="text-3xl font-serif text-brand-ink mb-4">
          {result === APPOINTMENT_STATUS.CONFIRMED ? 'Reserva Confirmada' : 'Indisponível'}
        </h1>
        <p className="text-brand-stone max-w-xs mb-10">
          {result === APPOINTMENT_STATUS.CONFIRMED 
            ? 'O horário foi bloqueado na sua agenda e a cliente foi notificada.' 
            : 'A cliente foi notificada que este horário não está disponível.'}
        </p>
        <div className="bg-brand-white p-6 rounded-3xl border border-brand-mist w-full max-w-sm text-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-brand-linen rounded-xl flex items-center justify-center text-brand-terracotta">
              <User size={20} />
            </div>
            <div>
              <div className="text-xs text-brand-stone uppercase tracking-widest font-bold">Cliente</div>
              <div className="text-sm font-medium text-brand-ink">{appointment.clientName}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-linen rounded-xl flex items-center justify-center text-brand-terracotta">
              <Calendar size={20} />
            </div>
            <div>
              <div className="text-xs text-brand-stone uppercase tracking-widest font-bold">Data e Hora</div>
              <div className="text-sm font-medium text-brand-ink">
                {new Date(appointment.date).toLocaleDateString('pt-BR')} às {appointment.time}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-parchment p-6 flex flex-col items-center justify-center">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md bg-brand-white rounded-[40px] p-8 md:p-12 border border-brand-mist premium-shadow"
      >
        <div className="flex items-center gap-2 text-brand-terracotta mb-8">
          <Sparkles size={20} />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Nova Reserva</span>
        </div>

        <h1 className="text-3xl font-serif text-brand-ink mb-2">Confirmar Reserva?</h1>
        <p className="text-sm text-brand-stone font-light mb-10">
          {appointment.clientName} deseja desfrutar da experiência <strong>{appointment.serviceName}</strong>.
        </p>

        <div className="space-y-6 mb-12">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-brand-linen rounded-xl flex items-center justify-center text-brand-terracotta shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-brand-stone mb-1">Data</div>
              <div className="text-base font-medium text-brand-ink">{new Date(appointment.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-brand-linen rounded-xl flex items-center justify-center text-brand-terracotta shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-brand-stone mb-1">Horário</div>
              <div className="text-base font-medium text-brand-ink">{appointment.time}</div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-brand-linen rounded-xl flex items-center justify-center text-brand-terracotta shrink-0">
              <MapPin size={20} />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-brand-stone mb-1">Local</div>
              <div className="text-base font-medium text-brand-ink">
                {appointment.locationType === 'home' ? `Domicílio (${appointment.neighborhood})` : 'Estúdio'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-brand-linen rounded-xl flex items-center justify-center text-brand-terracotta shrink-0">
              <MessageCircle size={20} />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-brand-stone mb-1">WhatsApp</div>
              <div className="text-base font-medium text-brand-ink">{appointment.clientWhatsapp}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => handleResponse(APPOINTMENT_STATUS.CONFIRMED)}
            disabled={processing}
            className="w-full py-6 bg-brand-ink text-brand-white rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-brand-espresso transition-all disabled:opacity-50"
          >
            {processing ? 'Processando...' : <><Check size={20} /> Confirmar Reserva</>}
          </button>
          <button
            onClick={() => handleResponse(APPOINTMENT_STATUS.CANCELLED_BY_PROFESSIONAL)}
            disabled={processing}
            className="w-full py-6 bg-brand-white text-brand-stone border border-brand-mist rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-brand-parchment transition-all disabled:opacity-50"
          >
            <X size={20} /> Indisponível
          </button>
        </div>
      </motion.div>
    </div>
  );
}
