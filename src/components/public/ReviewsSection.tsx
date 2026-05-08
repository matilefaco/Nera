import React from 'react';
import { motion } from 'motion/react';
import { Star, MapPin, Calendar } from 'lucide-react';
import { Review } from '../../types';
import { getRelativeDate } from '../../lib/utils';

interface ReviewsSectionProps {
  reviews: Review[];
  stats: any;
}

export const ReviewsSection = ({ reviews, stats }: ReviewsSectionProps) => {
  if (reviews.length === 0) {
    return (
      <section className="py-32 px-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center gap-16 mb-24">
          <div className="flex-1 text-center md:text-left">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--theme-accent,var(--color-brand-terracotta))] mb-4 block">Experiências Reais</span>
            <h2 className="text-4xl md:text-5xl font-serif text-brand-ink mb-6">
              O que elas dizem sobre<br />
              o <em className="font-serif italic text-brand-stone">atendimento</em>
            </h2>
            <div className="flex flex-col items-center md:items-start space-y-2 mt-8">
              <p className="text-brand-ink font-serif italic text-xl">Ainda não há avaliações por aqui.</p>
              <p className="text-brand-stone text-sm max-w-md">Depois do atendimento, as clientes poderão deixar sua experiência registrada.</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-32 px-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center gap-16 mb-24">
        <div className="flex items-baseline gap-4">
          <span className="font-serif text-[80px] leading-none text-brand-ink">
            {stats?.averageRating ? stats.averageRating.toFixed(1) : (reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '')}
          </span>
          <div className="flex flex-col gap-2">
            <div className="flex gap-1 text-[var(--theme-primary,var(--color-brand-terracotta))]">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={14} fill="currentColor" />
              ))}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand-stone opacity-60">
              {Math.max(stats?.totalReviews || 0, reviews.length)} avaliações
            </span>
          </div>
        </div>

        <div className="flex-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--theme-accent,var(--color-brand-terracotta))] mb-4 block">Experiências Reais</span>
          <h2 className="text-4xl md:text-5xl font-serif text-brand-ink">
            O que elas dizem sobre<br />
            o <em className="font-serif italic text-brand-stone">atendimento</em>
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {reviews.map((review, i) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group bg-brand-white border border-brand-mist rounded-[40px] p-10 hover:border-brand-blush hover:shadow-2xl transition-all duration-500 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex gap-1 text-[var(--theme-primary,var(--color-brand-terracotta))]">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} size={12} fill="currentColor" />
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-brand-stone opacity-40">
                  <Calendar size={10} />
                  {getRelativeDate(review.createdAt)}
                </div>
              </div>

              {review.comment && (
                <p className="font-serif italic text-[16px] leading-relaxed text-brand-ink mb-10 relative z-10">
                  "{review.comment}"
                </p>
              )}
            </div>

            <div className="pt-8 border-t border-brand-mist/50 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-brand-linen flex items-center justify-center text-[14px] font-serif text-[var(--theme-accent,var(--color-brand-terracotta))] border border-brand-mist shrink-0">
                {(review.publicDisplayMode === 'named' ? (review.firstName || 'C')[0] : 'C')}
              </div>
              <div>
                <div className="text-[13px] font-semibold text-brand-ink">
                  {review.publicDisplayMode === 'named' ? (review.firstName || 'Cliente Nera') : 'Cliente Nera'}
                </div>
                {(review.locationLabel || review.neighborhood) && (
                  <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-brand-stone opacity-50 mt-1">
                    <MapPin size={8} />
                    {review.locationLabel || review.neighborhood}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
