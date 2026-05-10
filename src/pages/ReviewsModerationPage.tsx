import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { motion } from 'motion/react';
import { Star, Check, X, Clock, MessageSquare, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Review {
  id: string;
  rating: number;
  comment: string;
  firstName: string;
  createdAt: any;
  moderationStatus: 'pending' | 'approved' | 'rejected';
}

export function ReviewsModerationPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    let isMounted = true;
    
    const fetchPendingReviews = async () => {
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
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Error fetching pending reviews:", err);
        setError("Não foi possível carregar as avaliações pendentes.");
      } finally {
        if (isMounted) setLoading(false);
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
    } catch (err: any) {
      console.error(err);
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
    } catch (err: any) {
      console.error(err);
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

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse bg-white rounded-2xl p-6 h-40 border border-brand-mist" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-brand-mist/50 shadow-sm">
            <div className="w-16 h-16 bg-brand-linen rounded-full flex items-center justify-center mx-auto mb-4 text-brand-terracotta">
              <Check size={28} />
            </div>
            <h3 className="text-xl font-serif text-brand-ink mb-2">Tudo em dia!</h3>
            <p className="text-brand-ink/60">Você não tem avaliações pendentes para moderar.</p>
          </div>
        ) : (
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
                      <p className="text-brand-ink/80 text-sm leading-relaxed mb-6 italic border-l-2 border-brand-terracotta/30 pl-3">
                        "{review.comment}"
                      </p>
                    ) : (
                      <p className="text-brand-ink/40 text-sm mb-6 flex items-center gap-2">
                         <MessageSquare size={14} /> Sem comentário escrito
                      </p>
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
        )}
      </div>
    </div>
  );
}
