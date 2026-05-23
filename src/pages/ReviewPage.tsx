import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Star, CheckCircle2, Sparkles, AlertCircle, 
  ChevronRight, Heart, MessageSquare, ShieldCheck, User
} from 'lucide-react';
import { notify } from '../lib/notify';
import { formatCurrency, cn } from '../lib/utils';
import { isSanitizedContent } from '../lib/validation';
import Logo from '../components/Logo';
import AppLoadingScreen from '../components/AppLoadingScreen';
import { UserProfile, Appointment } from '../types';

interface ReviewRequest {
  id: string;
  professionalId: string;
  bookingId: string;
  token: string;
  status: 'pending' | 'submitted' | 'expired';
  clientDisplayName?: string;
  clientNeighborhood?: string;
  submittedAt?: string;
}

const ATTRIBUTES = [
  'Pontualidade',
  'Delicadeza',
  'Atendimento profissional',
  'Resultado natural',
  'Organização',
  'Praticidade',
  'Boa comunicação',
  'Voltaria a agendar'
];

export default function ReviewPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<ReviewRequest | null>(null);
  const [professional, setProfessional] = useState<UserProfile | null>(null);
  const [booking, setBooking] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [publicMode, setPublicMode] = useState<'named' | 'anonymous' | 'private'>('named');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setError('Token de avaliação inválido.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/public/reviews/${token}`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Erro ao carregar dados da avaliação.');
        }

        const data = await response.json();
        
        setRequest({
           clientDisplayName: data.clientDisplayName,
           clientNeighborhood: data.clientNeighborhood,
        } as any);

        if (data.professionalName) {
           setProfessional({
             name: data.professionalName,
             avatar: data.professionalPhoto
           } as any);
        }

        if (data.serviceName) {
           setBooking({
             serviceName: data.serviceName,
             date: data.appointmentDate
           } as any);
        }

      } catch (err: any) {
        console.error('Error fetching review data:', err);
        setError(err.message || 'Erro ao carregar dados da avaliação.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      notify.error('Por favor, deixe sua avaliação.');
      return;
    }

    if (comment.trim() && !isSanitizedContent(comment)) {
      notify.error('Por favor, escreva um comentário mais detalhado e real sobre sua experiência.');
      return;
    }

    setSubmitting(true);
    try {
      const reviewData = {
        serviceId: booking?.serviceId || '',
        serviceName: booking?.serviceName || '',
        rating,
        tags: selectedTags,
        comment: comment.trim(),
        publicDisplayMode: publicMode,
        firstName: request?.clientDisplayName?.split(' ')[0] || 'Cliente',
        neighborhood: request?.clientNeighborhood || ''
      };

      const res = await fetch(`/api/public/reviews/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewData)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ao enviar avaliação`);
      }

      setSuccess(true);
      notify.success('Obrigada por compartilhar sua experiência!');
    } catch (err: any) {
      console.error('Error submitting review:', err);
      notify.error(err.message || 'Não foi possível enviar agora. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <AppLoadingScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-parchment p-6 text-center">
        <div className="w-20 h-20 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-8 border border-brand-mist">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-2xl font-serif font-normal text-brand-ink mb-4">{error}</h1>
        <button onClick={() => navigate('/')} className="bg-brand-ink text-brand-white px-10 py-4 rounded-full text-[11px] font-medium uppercase tracking-widest">
          Ir para o início
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-parchment p-6 text-center">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-10"
        >
          <CheckCircle2 size={48} />
        </motion.div>
        <h1 className="text-4xl font-serif font-normal text-brand-ink mb-6">Obrigado pelo seu feedback!</h1>
        <p className="body-text text-brand-stone mb-12 max-w-xs mx-auto">
          Sua avaliação ajuda {professional?.name} a crescer e outras clientes a agendarem com mais confiança.
        </p>
        <button onClick={() => navigate('/')} className="bg-brand-ink text-brand-white px-12 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest premium-shadow">
          Explorar a Nera
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-parchment flex flex-col items-center py-20 px-6">
      <div className="mb-12">
        <Logo />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl bg-brand-white rounded-[40px] border border-brand-mist p-8 md:p-12 shadow-sm"
      >
        <div className="text-center mb-12">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-brand-linen mx-auto mb-5 shadow-lg bg-brand-linen flex items-center justify-center">
            {professional?.avatar ? (
              <img src={professional.avatar} alt={professional?.name} className="w-full h-full object-cover" />
            ) : (
              <User size={40} className="text-brand-terracotta" />
            )}
          </div>
          <h2 className="text-[10px] text-brand-terracotta uppercase tracking-[0.2em] font-medium mb-3">
            O SEU FEEDBACK FAZ A DIFERENÇA
          </h2>
          <h1 className="text-3xl md:text-4xl font-serif text-brand-ink mb-3 leading-tight">Como foi sua experiência com {professional?.name}?</h1>
          {booking && (
            <p className="body-text text-brand-stone text-sm mb-4">
              Atendimento de <strong>{booking.serviceName}</strong> em {booking.date ? booking.date.split('-').reverse().join('/') : ''}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Rating */}
          <div className="text-center">
            <label className="label-text mb-6 block">Nota Geral</label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-2 transition-transform hover:scale-110"
                >
                  <Star 
                    size={40} 
                    className={cn(
                      "transition-colors",
                      (hoverRating || rating) >= star ? "text-brand-terracotta fill-brand-terracotta" : "text-brand-mist"
                    )} 
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Attributes */}
          <div>
            <label className="label-text mb-6 block text-center">O que você mais gostou?</label>
            <div className="flex flex-wrap justify-center gap-3">
              {ATTRIBUTES.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-6 py-3 rounded-full text-xs font-medium transition-all border",
                    selectedTags.includes(tag) 
                      ? "bg-brand-ink text-brand-white border-brand-ink" 
                      : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-4">
            <label className="label-text block text-center">Comentário (Opcional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Conte um pouco mais sobre o atendimento..."
              maxLength={300}
              className="w-full p-6 bg-brand-parchment border border-brand-mist rounded-[24px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light min-h-[120px] text-sm"
            />
            <div className="text-right text-[10px] text-brand-mist uppercase tracking-widest">
              {comment.length}/300
            </div>
          </div>

          {/* Privacy */}
          <div className="pt-8 border-t border-brand-mist">
            <label className="label-text mb-6 block text-center">Privacidade da Avaliação</label>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'named', label: `Exibir como ${request?.clientDisplayName?.split(' ')[0]}`, icon: User },
                { id: 'anonymous', label: 'Exibir de forma anônima', icon: ShieldCheck },
                { id: 'private', label: 'Não exibir publicamente', icon: AlertCircle }
              ].map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPublicMode(mode.id as any)}
                  className={cn(
                    "flex items-center justify-between p-5 rounded-2xl border transition-all",
                    publicMode === mode.id 
                      ? "bg-brand-linen border-brand-ink text-brand-ink" 
                      : "bg-brand-parchment border-brand-mist text-brand-stone hover:border-brand-stone"
                  )}
                >
                  <span className="text-sm font-medium">{mode.label}</span>
                  {publicMode === mode.id && <CheckCircle2 size={18} className="text-brand-terracotta" />}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || rating === 0}
            className="w-full bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-[0.2em] premium-shadow hover:bg-brand-espresso transition-all disabled:opacity-30 flex items-center justify-center gap-3"
          >
            {submitting ? 'Enviando...' : 'Enviar Avaliação'}
            <ChevronRight size={18} />
          </button>
        </form>
      </motion.div>

      <div className="mt-12 text-center">
        <p className="text-[10px] text-brand-stone uppercase tracking-widest flex items-center gap-2">
          <ShieldCheck size={12} className="text-brand-terracotta" /> Avaliação 100% Real e Verificada pela Nera
        </p>
      </div>
    </div>
  );
}
