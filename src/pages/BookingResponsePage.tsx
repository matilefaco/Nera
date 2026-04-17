import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, updateAppointmentStatus, handleBookingError } from '../firebase';
import { motion } from 'motion/react';
import { Check, X, Calendar, Clock, User, MessageCircle, MapPin, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export default function BookingResponsePage() {
  const { appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<'confirmed' | 'cancelled' | null>(null);

  useEffect(() => {
    const fetchAppointment = async () => {
      if (!appointmentId) return;
      try {
        const docRef = doc(db, 'appointments', appointmentId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAppointment(data);
          if (data.status !== 'pending') {
            setResult(data.status === 'confirmed' ? 'confirmed' : 'cancelled');
          }
        }
      } catch (error) {
        console.error('Error fetching appointment:', error);
        toast.error('Erro ao carregar agendamento');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointment();
  }, [appointmentId]);

  const handleResponse = async (decision: 'confirmed' | 'cancelled') => {
    if (!appointmentId) return;
    setProcessing(true);
    try {
      await updateAppointmentStatus(appointmentId, decision);
      setResult(decision);
      toast.success(decision === 'confirmed' ? 'Agendamento confirmado!' : 'Agendamento recusado.');
    } catch (error: any) {
      handleBookingError(error);
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
        <h1 className="text-2xl font-serif text-brand-ink mb-4">Agendamento não encontrado</h1>
        <p className="text-brand-stone max-w-xs">Este link pode ter expirado ou o agendamento foi removido.</p>
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
            result === 'confirmed' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
          )}
        >
          {result === 'confirmed' ? <Check size={40} /> : <X size={40} />}
        </motion.div>
        <h1 className="text-3xl font-serif text-brand-ink mb-4">
          {result === 'confirmed' ? 'Confirmado!' : 'Recusado'}
        </h1>
        <p className="text-brand-stone max-w-xs mb-10">
          {result === 'confirmed' 
            ? 'O horário foi bloqueado na sua agenda e a cliente foi notificada.' 
            : 'A cliente foi notificada que você não poderá atendê-la neste horário.'}
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
          <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Nova Solicitação</span>
        </div>

        <h1 className="text-3xl font-serif text-brand-ink mb-2">Confirmar Agendamento?</h1>
        <p className="text-sm text-brand-stone font-light mb-10">
          {appointment.clientName} deseja realizar o serviço <strong>{appointment.serviceName}</strong>.
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
            onClick={() => handleResponse('confirmed')}
            disabled={processing}
            className="w-full py-6 bg-brand-ink text-brand-white rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-brand-espresso transition-all disabled:opacity-50"
          >
            {processing ? 'Processando...' : <><Check size={20} /> Confirmar Horário</>}
          </button>
          <button
            onClick={() => handleResponse('cancelled')}
            disabled={processing}
            className="w-full py-6 bg-brand-white text-brand-stone border border-brand-mist rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-brand-parchment transition-all disabled:opacity-50"
          >
            <X size={20} /> Recusar Solicitação
          </button>
        </div>
      </motion.div>
    </div>
  );
}
