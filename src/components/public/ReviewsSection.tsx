import React from 'react';
import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import { Review } from '../../types';

interface ReviewsSectionProps {
  reviews: Review[];
  stats: any;
}

export const ReviewsSection = ({ reviews, stats }: ReviewsSectionProps) => {
  if (reviews.length === 0) return null;

  return (
    <section className="py-32 px-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center gap-16 mb-20">
        <div className="flex items-baseline gap-4">
          <span className="font-serif text-[80px] leading-none text-brand-ink">
            {stats?.averageRating?.toFixed(1) || '5.0'}
          </span>
          <div className="flex flex-col gap-2">
            <div className="flex gap-1 text-brand-terracotta">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={14} fill="currentColor" />
              ))}
            </div>
            <span className="label-text">
              {stats?.totalReviews || reviews.length} avaliações
            </span>
          </div>
        </div>

        <div className="flex-1">
          <span className="label-text mb-4 block">O que elas dizem</span>
          <h2 className="heading-section text-brand-ink">
            Experiências<br />
            <em className="font-serif italic text-brand-stone">reais</em>
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reviews.map((review, i) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group relative bg-brand-white border border-brand-mist rounded-[32px] p-9 hover:border-brand-blush hover:shadow-xl transition-all duration-500"
          >
            {/* Decorative Quote Mark */}
            <span className="absolute top-6 right-8 font-serif text-[80px] text-brand-linen leading-none pointer-events-none select-none group-hover:text-brand-blush/30 transition-colors">
              &ldquo;
            </span>

            <div className="flex gap-1 text-brand-terracotta mb-6">
              {Array.from({ length: review.rating }).map((_, i) => (
                <Star key={i} size={12} fill="currentColor" />
              ))}
            </div>

            {review.comment && (
              <p className="font-serif italic text-[15px] leading-relaxed text-brand-ink mb-8 relative z-10">
                {review.comment}
              </p>
            )}

            <div className="pt-6 border-t border-brand-mist/50 flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-brand-ink">
                  {review.publicDisplayMode === 'named' ? (review.firstName || 'Cliente Nera') : 'Cliente Nera'}
                </div>
                {review.neighborhood && (
                  <div className="text-[9px] font-semibold uppercase tracking-widest text-brand-stone">
                    {review.neighborhood}
                  </div>
                )}
              </div>
              
              {review.serviceName && (
                <div className="text-[9px] font-bold uppercase tracking-widest text-brand-terracotta text-right">
                  {review.serviceName}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
