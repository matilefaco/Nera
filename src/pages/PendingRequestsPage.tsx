import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../AuthContext';
import { handleBookingError, checkAndExpireAppointments } from '../firebase';
import { 
  Calendar, Clock, Users, LogOut, 
  Settings, List, MessageCircle, CheckCircle2, 
  Share2, Plus, MapPin, Check, TrendingUp, Heart,
  ChevronRight, Sparkles, Home, X, Instagram, Copy,
  ArrowLeft, AlertCircle, Info, Inbox, Phone,
  ExternalLink, MoreHorizontal
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { notify } from '../lib/notify';
import { formatCurrency, getTodayLocale, buildWhatsappLink, cn } from '../lib/utils';
import { Appointment } from '../types';
import AppLayout from '../components/AppLayout';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { usePendingAppointments } from '../contexts/PendingAppointmentsContext';
import { Zap } from 'lucide-react';
import { APPOINTMENT_STATUS } from '../constants/appointmentStatus';

export default function PendingRequestsPage() {
  const { user, profile } = useAuth();
  const uid = user?.uid ?? null;
  const navigate = useNavigate();
  
  const { pendingAppointments: truePending, loading: pendingLoading } = usePendingAppointments();
  
  const [localRequests, setLocalRequests] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [whatsappCtaId, setWhatsappCtaId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Appointment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmRejectOpen, setIsConfirmRejectOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<Appointment | null>(null);

  const [handledIds, setHandledIds] = useState<string[]>([]);

  const { isSubscribed, isSupported, requestPermission } = usePushNotifications();
  const [isPushLoading, setIsPushLoading] = useState(false);
  const [pushBannerDismissed, setPushBannerDismissed] = useState(() => {
    return localStorage.getItem("nera_push_banner_dismissed_pending") === "true";
  });

  const handleEnablePushNotifications = async () => {
    try {
      setIsPushLoading(true);
      const success = await requestPermission();
      if (success) {
        notify.success('Notificações ativadas!');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsPushLoading(false);
    }
  };

  // Current time for "time since" updates
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getTimeSince = (createdAt: any) => {
    if (!createdAt) return null;
    let date: Date;
    if (typeof createdAt === 'string') {
      date = new Date(createdAt);
    } else if (createdAt.toDate && typeof createdAt.toDate === 'function') {
      date = createdAt.toDate();
    } else if (createdAt.seconds) {
      date = new Date(createdAt.seconds * 1000);
    } else {
      date = new Date(createdAt);
    }

    if (isNaN(date.getTime())) return null;

    return {
      label: formatDistanceToNow(date, { addSuffix: true, locale: ptBR }),
      isOld: now.getTime() - date.getTime() > 1000 * 60 * 60 * 4, // More than 4 hours
      isVeryNew: now.getTime() - date.getTime() < 1000 * 60 * 15, // Less than 15 mins
    };
  };

  useEffect(() => {
    if (!uid) return;
    
    // Check for expired requests on load
    checkAndExpireAppointments(uid).catch((error) => {
      console.error('[PendingRequestsPage] Failed to expire appointments:', error);
      notify.error('Não foi possível atualizar pedidos expirados agora.');
    });
  }, [uid]);

  useEffect(() => {
    setLoading(pendingLoading);
  }, [pendingLoading]);

  // Sync localRequests to include items being confirmed/handling WhatsApp
  useEffect(() => {
    setLocalRequests(prev => {
      // Find if any currently "being confirmed" request should be preserved
      // even if it's no longer in the 'pending' query results
      const heldItem = confirmedId ? prev.find(p => p.id === confirmedId) : null;
      
      const currentIds = new Set(truePending.map(d => d.id));
      const finalDocs = [...truePending].filter(req => req.id === confirmedId || !handledIds.includes(req.id));

      if (heldItem && !currentIds.has(heldItem.id) && (heldItem.id === confirmedId || !handledIds.includes(heldItem.id))) {
        finalDocs.push(heldItem);
      }

      // Sort by date/time
      return finalDocs.sort((a, b) => {
        const dateCompare = (a.date || "").localeCompare(b.date || "");
        if (dateCompare !== 0) return dateCompare;
        return (a.time || "").localeCompare(b.time || "");
      });
    });
  }, [truePending, confirmedId, handledIds]);

  // Internal notification listener for waitlist alerts
  useEffect(() => {
    if (loading || localRequests.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const token = params.get('token');
    const action = params.get('action');

    if (id && token) {
      const target = localRequests.find(r => r.id === id);
      if (target && target.token === token) {
        // Clear params from URL to prevent re-triggering
        window.history.replaceState({}, '', window.location.pathname);

        if (action === 'confirm') {
          handleRespond(id, APPOINTMENT_STATUS.CONFIRMED, target);
        } else if (action === 'reject') {
          setRequestToReject(target);
          setIsConfirmRejectOpen(true);
        } else {
          setSelectedRequest(target);
          setIsModalOpen(true);
        }
      }
    }
  }, [loading, localRequests]);


  const formatDateDisplay = (value: unknown): string => {
    if (typeof value !== 'string') return 'Data não informada';
    const trimmed = value.trim();
    if (!trimmed) return 'Data não informada';

    const parts = trimmed.split('-');
    if (parts.length === 3 && parts.every(Boolean)) {
      return parts.reverse().join('/');
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('pt-BR');
    }

    return 'Data não informada';
  };

  const formatTimeDisplay = (value: unknown): string => {
    if (typeof value !== 'string') return 'Horário não informado';
    const trimmed = value.trim();
    return trimmed || 'Horário não informado';
  };

  const getSafeWhatsappLink = (raw: unknown, message?: string): string | null => {
    if (typeof raw !== 'string') return null;
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10) return null;
    return buildWhatsappLink(raw, message);
  };

  const handleRespond = async (id: string, decision: typeof APPOINTMENT_STATUS.CONFIRMED | typeof APPOINTMENT_STATUS.CANCELLED_BY_PROFESSIONAL, appointment?: any) => {
    if (processingId === id) return;
    
    if (!user?.uid) {
      notify.error("Sessão expirada. Entre novamente.");
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    setProcessingId(id);

    // Optimistic Update immediately
    if (decision === APPOINTMENT_STATUS.CONFIRMED) {
      setConfirmedId(id);
      setHandledIds(prev => [...prev, id]);
    } else {
      setHandledIds(prev => [...prev, id]);
      setIsConfirmRejectOpen(false);
      setRequestToReject(null);
    }

    try {
      const token = await user.getIdToken(true);
      
      if (decision === APPOINTMENT_STATUS.CONFIRMED) {
        const res = await fetch(`/api/appointments/${id}/confirm`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ professionalId: user.uid })
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erro ao confirmar (${res.status})`);
        }
        
        notify.success(`Reserva confirmada! ID: ${id}`);
        // Transition to WhatsApp CTA after the check animation
        setTimeout(() => {
          setWhatsappCtaId(id);
        }, 1200);
      } else {
        const res = await fetch(`/api/appointments/${id}/decline`, {
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
        
        notify.success('Reserva marcada como indisponível.');
      }
      
      if (selectedRequest?.id === id) {
        setIsModalOpen(false);
      }
    } catch (error: any) {
      // Revert optimistic
      setHandledIds(prev => prev.filter(hid => hid !== id));
      if (decision === APPOINTMENT_STATUS.CONFIRMED) {
        setConfirmedId(null);
        setWhatsappCtaId(null);
      }
      console.error("[PENDING FLOW ERROR]", error);
      notify.error(error.message || 'Não foi possível concluir. Tente novamente.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AppLayout activeRoute="dashboard">
      <div className="p-4 md:p-16 max-w-5xl mx-auto w-full">
        <header className="mb-10 md:mb-16 pt-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-brand-stone hover:text-brand-ink transition-colors mb-6 text-[10px] font-bold uppercase tracking-widest bg-brand-linen/50 w-fit px-4 py-2 rounded-full"
          >
            <ArrowLeft size={12} /> Painel
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-bold text-brand-terracotta uppercase tracking-[0.3em] block">Pedidos Pendentes</span>
                {truePending.length > 0 && (
                  <span className="px-2 py-0.5 bg-brand-terracotta text-brand-white text-[9px] font-bold rounded-full animate-pulse">
                    {truePending.length}
                  </span>
                )}
              </div>
              <h1 className="text-[34px] md:text-5xl font-serif font-normal text-brand-ink leading-tight">
                Pedidos de agendamento
              </h1>
              <p className="text-brand-stone text-xs md:text-sm font-light italic mt-2 max-w-xl">
                {truePending.length > 0 
                  ? `${truePending.length} ${truePending.length === 1 ? 'cliente aguardando sua confirmação' : 'clientes aguardando sua confirmação'}.`
                  : 'Sua agenda está em dia.'}
              </p>
            </div>
          </div>
        </header>

        {/* Notificações Banner */}
        {!isSubscribed && isSupported && !pushBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 bg-brand-ink p-8 rounded-[40px] shadow-xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-brand-terracotta/20 text-brand-terracotta rounded-2xl flex items-center justify-center shrink-0">
                  <Zap size={28} />
                </div>
                <div>
                  <h4 className="text-base font-serif text-brand-white">Não perca nenhum pedido</h4>
                  <p className="text-xs text-brand-parchment/60 font-light italic mt-1 leading-relaxed">
                    Ative as notificações para ser avisada no celular quando chegar uma nova reserva.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <button
                  onClick={handleEnablePushNotifications}
                  disabled={isPushLoading}
                  className="px-8 py-4 bg-brand-terracotta text-brand-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-sienna transition-all shadow-lg flex items-center gap-2"
                >
                  {isPushLoading ? 'Ativando...' : 'Ativar notificações'}
                </button>
                <button 
                  onClick={() => {
                    setPushBannerDismissed(true);
                    localStorage.setItem("nera_push_banner_dismissed_pending", "true");
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest text-brand-parchment/30 hover:text-brand-parchment transition-colors"
                >
                  Depois
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 border-t-2 border-brand-terracotta rounded-full animate-spin" />
            <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest">Carregando pedidos...</p>
          </div>
        ) : localRequests.length === 0 ? (
          <div className="bg-brand-white border border-brand-mist border-dashed rounded-[48px] p-16 md:p-24 text-center flex flex-col items-center max-w-xl mx-auto shadow-sm">
            <div className="w-24 h-24 bg-brand-linen rounded-[32px] flex items-center justify-center text-brand-stone/40 mb-8 rotate-3">
              <Inbox size={48} strokeWidth={1} />
            </div>
            <h2 className="text-2xl font-serif text-brand-ink mb-4 text-balance">Agenda livre de pedidos</h2>
            <p className="text-sm text-brand-stone font-light italic mb-10 leading-relaxed px-4">
              Quando novas clientes agendarem pelo seu link profissional, as solicitações aparecerão aqui para sua confirmação.
            </p>
            <Link to="/dashboard" className="px-10 py-5 bg-brand-ink text-brand-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all premium-shadow">Voltar ao Início</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
            <AnimatePresence mode="popLayout">
              {localRequests.map((request) => {
                const timeInfo = getTimeSince(request.createdAt);
                
                return (
                  <motion.div 
                    key={request.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    className={cn(
                      "bg-brand-white p-6 md:p-8 rounded-[48px] border-2 shadow-xl relative overflow-hidden transition-all flex flex-col h-full",
                      confirmedId === request.id ? "border-brand-ink" : "border-transparent",
                      !confirmedId && timeInfo?.isVeryNew && "shadow-brand-terracotta/5 border-brand-terracotta/10",
                      !confirmedId && !timeInfo?.isVeryNew && "border-brand-mist/30"
                    )}
                  >
                    {/* Glow for very new */}
                    {!confirmedId && timeInfo?.isVeryNew && (
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-terracotta/40 to-transparent" />
                    )}

                    {/* Time Since Badge */}
                    <div className="flex items-center justify-between mb-6">
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest",
                        timeInfo?.isOld ? "bg-amber-50 text-amber-600" : timeInfo?.isVeryNew ? "bg-brand-terracotta/10 text-brand-terracotta" : "bg-brand-linen text-brand-stone"
                      )}>
                        <Clock size={10} />
                        {timeInfo?.label || 'recém chegado'}
                      </div>
                      
                      {timeInfo?.isOld && (
                        <span className="flex items-center gap-1 text-[8px] font-bold text-amber-600 uppercase tracking-widest">
                          <AlertCircle size={10} /> Aguardando há muito tempo
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex flex-wrap items-center gap-3 mb-1">
                          <h3 className="text-2xl md:text-3xl font-serif text-brand-ink">{request.clientName}</h3>
                        </div>
                        <span className="text-[10px] text-brand-terracotta uppercase tracking-[0.2em] font-bold">
                          {request.serviceName}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xl md:text-2xl font-bold text-brand-ink">{formatCurrency((request.price || 0) + (request.travelFee || 0))}</p>
                        <p className="text-[8px] text-brand-stone uppercase tracking-widest font-bold opacity-60">Valor</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4 mb-6">
                      <div className="bg-brand-parchment/60 rounded-3xl p-4 border border-brand-mist/30 flex items-center gap-3 min-w-0">
                        <Calendar size={14} className="text-brand-terracotta/60 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] text-brand-stone uppercase tracking-widest scale-90 origin-left truncate">Data</span>
                          <span className="text-[13px] font-bold text-brand-ink truncate">{formatDateDisplay(request.date)}</span>
                        </div>
                      </div>
                      <div className="bg-brand-parchment/60 rounded-3xl p-4 border border-brand-mist/30 flex items-center gap-3 min-w-0">
                        <Clock size={14} className="text-brand-terracotta/60 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] text-brand-stone uppercase tracking-widest scale-90 origin-left truncate">Horário</span>
                          <span className="text-[13px] font-bold text-brand-ink truncate">{formatTimeDisplay(request.time)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-brand-linen/30 rounded-3xl p-5 mb-6 flex items-start gap-4">
                      <MapPin size={16} className="text-brand-terracotta shrink-0 mt-0.5" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] text-brand-stone uppercase tracking-[0.2em] font-bold mb-1">
                          {request.locationType === 'home' ? 'Domicílio' : 'Estúdio'}
                        </span>
                        <span className="text-[12px] font-medium text-brand-ink truncate">
                          {request.locationType === 'home' 
                            ? (typeof request.address === 'object' ? `${request.address.street}, ${request.address.number}${request.address.neighborhood ? ` - ${request.address.neighborhood}` : ''}` : (request.address || request.neighborhood || 'Endereço não informado')) 
                            : profile?.studioAddress 
                              ? `${profile.studioAddress.street}, ${profile.studioAddress.number} - ${profile.studioAddress.neighborhood}`
                              : 'No estúdio'}
                        </span>
                      </div>
                    </div>

                    {request.notes && (
                      <div className="mb-8 px-5 py-4 bg-amber-50/50 border border-amber-100 rounded-[24px] relative">
                         <span className="absolute -top-2 left-6 px-2 bg-brand-white text-[7px] font-bold uppercase text-brand-stone border border-brand-mist rounded-full">Recado da Cliente</span>
                        <p className="text-[11px] text-brand-ink/80 italic leading-relaxed">
                          "{request.notes}"
                        </p>
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-3 mt-auto pt-4">
                      <div className="flex gap-3">
                        <button 
                          onClick={() => handleRespond(request.id, APPOINTMENT_STATUS.CONFIRMED, request)}
                          disabled={!!processingId}
                          className="flex-[3] py-5 bg-brand-ink text-brand-white rounded-[24px] text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                          {processingId === request.id ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 size={16} className="text-brand-terracotta" />
                              Confirmar
                            </>
                          )}
                        </button>
                        {(() => {
                          const whatsappLink = getSafeWhatsappLink(request.clientWhatsapp);
                          if (!whatsappLink) {
                            return (
                              <button
                                type="button"
                                disabled
                                className="flex-1 aspect-square bg-brand-white border border-brand-mist rounded-[24px] flex items-center justify-center text-brand-stone/40 cursor-not-allowed"
                                title="WhatsApp não informado"
                              >
                                <MessageCircle size={20} />
                              </button>
                            );
                          }

                          return (
                            <a 
                              href={whatsappLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 aspect-square bg-brand-white border border-brand-mist rounded-[24px] flex items-center justify-center text-brand-stone hover:text-green-600 hover:border-green-200 transition-all active:scale-90"
                            >
                              <MessageCircle size={20} />
                            </a>
                          );
                        })()}
                      </div>
                      
                      <div className="flex gap-3">
                        <button 
                          onClick={() => { setSelectedRequest(request); setIsModalOpen(true); }}
                          disabled={!!processingId}
                          className="flex-1 py-4 bg-brand-parchment/40 text-brand-stone border border-dashed border-brand-mist/50 rounded-[20px] text-[9px] font-bold uppercase tracking-widest hover:bg-brand-linen transition-all"
                        >
                          Ver Detalhes
                        </button>
                        <button 
                          onClick={() => { setRequestToReject(request); setIsConfirmRejectOpen(true); }}
                          disabled={!!processingId}
                          className="flex-1 py-4 text-brand-stone/40 hover:text-brand-terracotta text-[9px] font-bold uppercase tracking-widest transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>

                    {/* Success Overlay */}
                    <AnimatePresence>
                      {confirmedId === request.id && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 z-30 bg-brand-ink flex flex-col items-center justify-center text-brand-white p-8"
                        >
                          {!whatsappCtaId ? (
                            <>
                              <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', damping: 12 }}
                                className="w-20 h-20 bg-brand-white/10 rounded-full flex items-center justify-center mb-4"
                              >
                                <Check size={40} className="text-brand-terracotta" />
                              </motion.div>
                              <p className="text-[12px] font-bold uppercase tracking-[0.3em]">Confirmado</p>
                              <p className="text-[10px] opacity-40 mt-2">Personalizando sua agenda...</p>
                            </>
                          ) : (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="w-full flex flex-col items-center text-center"
                            >
                              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
                                <MessageCircle size={32} className="text-green-500" />
                              </div>
                              <h4 className="text-sm font-bold uppercase tracking-widest mb-3">Avisar cliente?</h4>
                              <p className="text-[11px] opacity-60 mb-8 leading-relaxed max-w-[200px] italic">
                                "Oi {request.clientName}, seu horário para {request.serviceName} dia {formatDateDisplay(request.date)} às {formatTimeDisplay(request.time)} foi confirmado 💛"
                              </p>
                              <div className="flex flex-col w-full gap-4">
                                {(() => {
                                  const confirmationText = `Oi ${request.clientName || 'cliente'}, seu horário para ${request.serviceName || 'o serviço'} dia ${formatDateDisplay(request.date)} às ${formatTimeDisplay(request.time)} foi confirmado 💛`;
                                  const whatsappLink = getSafeWhatsappLink(request.clientWhatsapp, confirmationText);
                                  if (!whatsappLink) {
                                    return null;
                                  }

                                  return (
                                    <a 
                                      href={whatsappLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => {
                                        setConfirmedId(null);
                                        setWhatsappCtaId(null);
                                      }}
                                      className="w-full py-5 bg-green-500 text-white rounded-[24px] text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                      Enviar agora
                                    </a>
                                  );
                                })()}
                                <button 
                                  onClick={() => {
                                    setConfirmedId(null);
                                    setWhatsappCtaId(null);
                                  }}
                                  className="text-[10px] font-bold uppercase py-2 tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                                >
                                  Fazer depois
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Details Modal (Reuse logic from Dashboard or keep it here for independence) */}
      <AnimatePresence>
        {isModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 md:p-12">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-brand-ink/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-brand-white rounded-[48px] overflow-hidden shadow-2xl overflow-y-auto max-h-[90dvh]"
            >
              <div className="p-8 md:p-14">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <span className="text-[10px] font-bold text-brand-terracotta uppercase tracking-[0.3em] mb-4 block">Detalhes do Pedido</span>
                    <h2 className="text-3xl md:text-5xl font-serif text-brand-ink leading-tight">{selectedRequest.clientName}</h2>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-4 bg-brand-linen text-brand-stone hover:text-brand-ink rounded-[24px] transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14">
                  {/* Left Column: Details */}
                  <div className="space-y-10">
                    <div>
                      <h4 className="text-[11px] font-bold text-brand-stone uppercase tracking-widest mb-4">Experiência Solicitada</h4>
                      <div className="p-8 bg-brand-parchment/50 rounded-[32px] border border-brand-mist/40">
                        <p className="text-xl font-serif text-brand-ink mb-1">{selectedRequest.serviceName}</p>
                        <div className="flex items-center justify-between mt-6">
                          <span className="text-[10px] font-bold text-brand-stone uppercase tracking-widest bg-brand-white px-3 py-1 rounded-full border border-brand-mist/50">{selectedRequest.duration} min</span>
                          <span className="text-2xl font-bold text-brand-terracotta">{formatCurrency((selectedRequest.price || 0) + (selectedRequest.travelFee || 0))}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-6">
                      <div className="space-y-2 min-w-0">
                        <p className="text-[9px] text-brand-stone uppercase tracking-widest font-bold opacity-60">Data Escolhida</p>
                        <p className="text-brand-ink font-serif text-xl truncate">{formatDateDisplay(selectedRequest.date)}</p>
                      </div>
                      <div className="space-y-2 min-w-0">
                        <p className="text-[9px] text-brand-stone uppercase tracking-widest font-bold opacity-60">Horário Alvo</p>
                        <p className="text-brand-ink font-serif text-xl truncate">{formatTimeDisplay(selectedRequest.time)}</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <p className="text-[9px] text-brand-stone uppercase tracking-widest font-bold opacity-60">Onde acontecerá</p>
                      <div className="p-7 bg-brand-white rounded-[32px] border border-brand-mist/60 shadow-sm flex items-start gap-4">
                        <div className="w-12 h-12 rounded-[20px] bg-brand-linen flex items-center justify-center text-brand-terracotta shrink-0 rotate-3">
                          {selectedRequest.locationType === 'home' ? <Home size={22} /> : <MapPin size={22} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-brand-ink uppercase tracking-widest mb-1">{selectedRequest.locationType === 'home' ? 'Seu Atendimento em Domicílio' : 'Seu Estúdio Próprio'}</p>
                          <p className="text-[13px] text-brand-stone font-light leading-relaxed">
                            {selectedRequest.locationType === 'home' 
                              ? (typeof selectedRequest.address === 'object' 
                                  ? (
                                      <>
                                        {selectedRequest.address.street}, {selectedRequest.address.number}{selectedRequest.address.complement ? ` - ${selectedRequest.address.complement}` : ''} - {selectedRequest.address.neighborhood}, {selectedRequest.address.city}
                                        {selectedRequest.address.reference && (
                                          <div className="text-[10px] text-brand-terracotta mt-1 leading-tight">Ref: {selectedRequest.address.reference}</div>
                                        )}
                                        <button 
                                          onClick={() => {
                                            const addr = `${(selectedRequest.address as any).street}, ${(selectedRequest.address as any).number}, ${(selectedRequest.address as any).neighborhood}, ${(selectedRequest.address as any).city}`;
                                            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
                                          }}
                                          className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline"
                                        >
                                          <MapPin size={12} /> Abrir no Maps
                                        </button>
                                      </>
                                    )
                                  : (
                                      <>
                                        {selectedRequest.address || selectedRequest.neighborhood || 'Endereço a combinar'}
                                        {(selectedRequest.address || selectedRequest.neighborhood) && (
                                          <button 
                                            onClick={() => {
                                              const addr = (selectedRequest.address as any) || selectedRequest.neighborhood;
                                              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
                                            }}
                                            className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline"
                                          >
                                            <MapPin size={12} /> Abrir no Maps
                                          </button>
                                        )}
                                      </>
                                    )) 
                              : profile?.studioAddress 
                                ? (
                                    <>
                                      {profile.studioAddress.street}, {profile.studioAddress.number} {profile.studioAddress.complement ? `- ${profile.studioAddress.complement}` : ''} - {profile.studioAddress.neighborhood}, {profile.studioAddress.city}
                                      <button 
                                        onClick={() => {
                                          const addr = `${profile.studioAddress.street}, ${profile.studioAddress.number}, ${profile.studioAddress.neighborhood}, ${profile.studioAddress.city}`;
                                          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
                                        }}
                                        className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline"
                                      >
                                        <MapPin size={12} /> Abrir no Maps
                                      </button>
                                    </>
                                  )
                                : 'Atendimento no endereço cadastrado'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions & Notes */}
                  <div className="space-y-10">
                     <div>
                      <h4 className="text-[11px] font-bold text-brand-stone uppercase tracking-widest mb-4">Nota da Cliente</h4>
                      <div className="p-8 bg-brand-linen/40 rounded-[32px] border border-brand-mist/40 italic text-sm text-brand-ink/80 leading-relaxed min-h-[160px] relative overflow-hidden">
                        <div className="relative z-10">
                          {selectedRequest.notes ? `"${selectedRequest.notes}"` : "A cliente não deixou observações específicas para este agendamento."}
                        </div>
                        <Sparkles className="absolute -bottom-4 -right-4 w-16 h-16 text-brand-mist/20 rotate-12" />
                      </div>
                    </div>

                    <div className="space-y-5">
                      <h4 className="text-[11px] font-bold text-brand-stone uppercase tracking-widest mb-4">Contato Direto</h4>
                      <div className="space-y-3">
                        <a 
                          href={buildWhatsappLink(selectedRequest.clientWhatsapp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-6 bg-white rounded-[28px] border border-brand-mist hover:border-brand-terracotta transition-all shadow-sm group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600 shadow-inner">
                              <MessageCircle size={22} />
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-brand-stone uppercase tracking-widest leading-none mb-1.5">Enviar WhatsApp</p>
                              <p className="text-[15px] font-medium text-brand-ink">{selectedRequest.clientWhatsapp}</p>
                            </div>
                          </div>
                          <ChevronRight size={18} className="text-brand-stone group-hover:text-brand-terracotta group-hover:translate-x-1 transition-all" />
                        </a>
                        
                        {selectedRequest.clientEmail && (
                          <div className="p-6 bg-brand-parchment/30 rounded-[28px] border border-brand-mist/40 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-brand-white flex items-center justify-center text-brand-stone border border-brand-mist/50">
                              <ExternalLink size={18} strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0">
                               <p className="text-[9px] font-bold text-brand-stone uppercase tracking-widest mb-1 opacity-60">E-mail de Cadastro</p>
                               <p className="text-[13px] font-medium text-brand-ink truncate">{selectedRequest.clientEmail}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-16 pt-10 border-t border-brand-mist/60 flex flex-col sm:flex-row gap-5">
                  <button 
                    onClick={() => handleRespond(selectedRequest.id, APPOINTMENT_STATUS.CONFIRMED, selectedRequest)}
                    disabled={!!processingId}
                    className="flex-[2] py-6 bg-brand-ink text-brand-white rounded-full text-[12px] font-bold uppercase tracking-[0.2em] hover:bg-brand-espresso transition-all shadow-2xl shadow-brand-ink/20 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                  >
                    {processingId === selectedRequest.id ? (
                      <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={18} className="text-brand-terracotta" />
                        Confirmar Reserva
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => {
                      setRequestToReject(selectedRequest);
                      setIsConfirmRejectOpen(true);
                    }}
                    disabled={!!processingId}
                    className="flex-1 py-6 bg-brand-white border-2 border-brand-mist text-brand-stone rounded-full text-[12px] font-bold uppercase tracking-[0.2em] hover:bg-brand-parchment hover:border-brand-ink hover:text-brand-ink transition-all disabled:opacity-50 active:scale-95 px-8"
                  >
                    Indisponível
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation for Rejection */}
      <AnimatePresence>
        {isConfirmRejectOpen && requestToReject && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsConfirmRejectOpen(false); setRequestToReject(null); }}
              className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-brand-white rounded-[40px] p-10 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-brand-linen text-brand-terracotta rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-12">
                <AlertCircle size={40} />
              </div>
              <h3 className="text-2xl font-serif text-brand-ink mb-4">Cancelar pedido?</h3>
              <p className="text-sm text-brand-stone font-light italic mb-10 leading-relaxed px-4">
                Ao cancelar, a cliente será notificada que você não poderá atendê-la neste horário.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleRespond(requestToReject.id, APPOINTMENT_STATUS.CANCELLED_BY_PROFESSIONAL, requestToReject)}
                  disabled={!!processingId}
                  className="w-full py-5 bg-brand-terracotta text-brand-white rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-sienna transition-all shadow-lg shadow-brand-terracotta/20"
                >
                  Confirmar Cancelamento
                </button>
                <button 
                  onClick={() => { setIsConfirmRejectOpen(false); setRequestToReject(null); }}
                  className="w-full py-5 text-[10px] font-bold text-brand-stone uppercase tracking-widest hover:text-brand-ink transition-colors"
                >
                  Voltar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
