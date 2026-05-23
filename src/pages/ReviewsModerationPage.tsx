import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { motion } from 'motion/react';
import { Star, Check, X, Clock, MessageSquare, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface Review {
  id: string;
  rating: number;
  comment: string;
  firstName: string;
  createdAt: any;
  moderationStatus: 'pending' | 'approved' | 'rejected';
  tags?: string[];
}

const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname.includes('ais-'));

type ReviewsStatus = 'idle' | 'loading' | 'loaded' | 'error';

export function ReviewsModerationPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState<ReviewsStatus>('idle');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    
    const fetchPendingReviews = async () => {
      if (reviews.length === 0) {
        setStatus('loading');
      }
      try {
        const q = query(
          collection(db, 'reviews'),
          where('professionalId', '==', user.uid),
          where('moderationStatus', '==', 'pending')
        );
        
        const snapshot = await getDocs(q);
        if (!isMounted) return;
        
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Review);
        
        // Sort in memory to avoid needing a composite index
        fetched.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });
        
        setReviews(fetched);
        setStatus('loaded');
      } catch (err: any) {
        if (!isMounted) return;
        if (isDev) console.error("Error fetching pending reviews:", err);
        setStatus('error');
      }
    };
    
    fetchPendingReviews();
    
    return () => { isMounted = false; };
  }, [user]);

  const handleApprove = async (reviewId: string) => {
    if (!user) return;
    setProcessingId(reviewId);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/reviews/${reviewId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao aprovar avaliação');
      
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      toast.success('Avaliação publicada no perfil.');
    } catch (err: any) {
      if (isDev) console.error(err);
      setError(err.message || 'Erro ao aprovar.');
    } finally {
      if (processingId === reviewId) setProcessingId(null);
    }
  };

  const handleReject = async (reviewId: string) => {
    if (!user) return;
    setProcessingId(reviewId);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/reviews/${reviewId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao ocultar avaliação');
      
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      toast.success('Avaliação ocultada.');
    } catch (err: any) {
      if (isDev) console.error(err);
      setError(err.message || 'Erro ao ocultar.');
    } finally {
      if (processingId === reviewId) setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link to="/dashboard" className="text-brand-terracotta hover:text-brand-espresso text-sm font-medium mb-2 inline-flex items-center gap-1 transition-colors">
              &larr; Voltar ao Dashboard
            </Link>
            <h1 className="text-3xl font-serif text-brand-ink">Avaliações Pendentes</h1>
            <p className="text-brand-ink/60 mt-2">
              Aprove ou oculte as avaliações recentes antes que apareçam na sua vitrine.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-start gap-3 mb-8">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {status === 'error' && !error && (
          <div className="bg-[#FAF9F8] text-brand-ink p-6 rounded-2xl border border-brand-mist flex items-start gap-4 mb-8">
            <AlertCircle size={20} className="shrink-0 mt-0.5 text-brand-terracotta" />
            <div>
              <p className="font-medium">Ocorreu um erro</p>
              <p className="text-sm mt-1 text-brand-stone">Não foi possível carregar as avaliações agora.</p>
            </div>
          </div>
        )}

        {(status === 'idle' || status === 'loading') && reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-white rounded-[40px] border border-brand-mist/60 shadow-sm">
            <div className="w-10 h-10 rounded-full border-2 border-brand-mist border-t-brand-terracotta animate-spin mb-6" />
            <p className="text-sm font-medium text-brand-ink tracking-wide">Carregando avaliações…</p>
          </div>
        ) : status === 'loaded' && reviews.length === 0 ? (
          <div className="bg-white rounded-[40px] border border-dashed border-brand-mist/60 py-20 px-8 text-center shadow-sm flex flex-col items-center">
            <div className="w-16 h-16 bg-[#FAF9F8] rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-stone/40 border border-brand-mist/40 shadow-sm">
              <Star size={24} strokeWidth={1} />
            </div>
            <h3 className="text-xl font-serif text-brand-ink mb-1 italic text-pretty">Nenhuma avaliação pendente</h3>
            <p className="text-[11px] text-brand-stone font-light max-w-xs mx-auto leading-relaxed uppercase tracking-widest">As avaliações das suas clientes aparecerão aqui assim que forem enviadas.</p>
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-6">
            {reviews.map(review => (
              <motion.div 
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 sm:p-8 border border-brand-mist/60 shadow-sm relative overflow-hidden"
              >
                {/* Decorative element */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-brand-linen to-transparent opacity-50 rounded-bl-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row gap-6 relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star 
                            key={star} 
                            size={16} 
                            className={star <= review.rating ? "text-brand-terracotta fill-brand-terracotta" : "text-brand-mist fill-brand-mist"} 
                          />
                        ))}
                      </div>
                      <span className="text-sm text-brand-ink/50 whitespace-nowrap">
                        {review.createdAt ? new Date(review.createdAt.toMillis()).toLocaleDateString('pt-BR') : 'Recente'}
                      </span>
                    </div>
                    
                    <h4 className="font-medium text-brand-ink mb-2 flex items-center gap-2">
                       {review.firstName || 'Cliente'}
                    </h4>
                    
                    {review.comment ? (
                      <p className="text-brand-ink/80 text-sm leading-relaxed mb-4 italic border-l-2 border-brand-terracotta/30 pl-3">
                        "{review.comment}"
                      </p>
                    ) : (
                      <p className="text-brand-ink/40 text-sm mb-4 flex items-center gap-2">
                         <MessageSquare size={14} /> Sem comentário escrito
                      </p>
                    )}

                    {review.tags && review.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-6">
                        {review.tags.map(tag => (
                          <span key={tag} className="px-2.5 py-1 bg-[#FAF9F8] border border-brand-mist/50 text-brand-stone text-[10px] font-medium tracking-wide uppercase rounded-md">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => handleApprove(review.id)}
                        disabled={processingId === review.id}
                        className="px-5 py-2.5 bg-brand-terracotta text-white rounded-xl text-sm font-medium hover:bg-brand-espresso transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {processingId === review.id ? <Clock size={16} className="animate-spin" /> : <Check size={16} />}
                        Aprovar e Publicar
                      </button>
                      <button
                        onClick={() => handleReject(review.id)}
                        disabled={processingId === review.id}
                        className="px-5 py-2.5 bg-[#F8F6F3] text-brand-ink/70 hover:text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <X size={16} />
                        Ocultar (Recusar)
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
