import { Star, MapPin, Calendar, ShieldCheck, Tag } from 'lucide-react';
import { motion } from 'motion/react';
import { Review } from '../../types';
import { getRelativeDate } from '../../lib/utils';
import { isSanitizedContent } from '../../lib/validation';

interface ReviewsSectionProps {
  reviews: Review[];
  stats: any;
}

const resolveTagText = (tag: string, percentage: number, total: number) => {
  const t = tag.toLowerCase();
  
  if (total < 5) {
    if (t === 'voltaria a agendar' || t === 'voltaria') return `Voltariam a agendar`;
    if (t === 'pontualidade') return `Pontualidade foi destacada`;
    if (t === 'delicadeza') return `Clientes elogiaram a delicadeza`;
    if (t === 'boa comunicação' || t === 'excelente comunicação') return `Boa comunicação destacada`;
    if (t === 'ambiente impecável' || t === 'higiene') return `Ambiente impecável elogiado`;
    if (t === 'atendimento profissional' || t === 'profissionalismo') return `Atendimento profissional destacado`;
    if (t === 'resultado natural') return `Resultado natural elogiado`;
    if (t === 'organização') return `Organização foi destacada`;
    if (t === 'praticidade') return `Praticidade elogiada`;
    
    return `Destacaram "${tag}"`;
  }
  
  if (t === 'voltaria a agendar' || t === 'voltaria') return `${percentage}% voltariam a agendar`;
  if (t === 'pontualidade') return `${percentage}% destacaram a pontualidade`;
  if (t === 'delicadeza') return `${percentage}% elogiaram a delicadeza`;
  if (t === 'boa comunicação' || t === 'excelente comunicação') return `${percentage}% destacaram a comunicação`;
  if (t === 'ambiente impecável' || t === 'higiene') return `${percentage}% elogiaram o ambiente`;
  if (t === 'atendimento profissional' || t === 'profissionalismo') return `${percentage}% destacaram o profissionalismo`;
  if (t === 'resultado natural') return `${percentage}% elogiaram o resultado natural`;
  if (t === 'organização') return `${percentage}% destacaram a organização`;
  if (t === 'praticidade') return `${percentage}% elogiaram a praticidade`;
  
  // Generic fallback without trailing/leading fluff
  return `${percentage}% destacaram "${tag}"`;
};

export const ReviewsSection = ({ reviews, stats }: ReviewsSectionProps) => {
  const filteredReviews = reviews.filter(r => isSanitizedContent(r.comment));
  
  if (filteredReviews.length === 0) {
    return null;
  }

  const total = stats?.totalReviews || filteredReviews.length;
  const insights = stats?.tagAnalytics 
    ? Object.entries(stats.tagAnalytics as Record<string, number>)
        .map(([tag, count]) => {
           const percentage = Math.round((count / total) * 100);
           return { tag, percentage, count };
        })
        .filter(t => total < 5 || t.percentage >= 15) // For small numbers, show all that exist
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 3) 
    : [];

  return (
    <section data-marketing-section="reviews" className="py-20 md:py-32 px-4 sm:px-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col lg:flex-row lg:items-center gap-10 md:gap-16 mb-16 md:mb-24">
        <div className="flex items-baseline gap-4">
          <span className="font-serif text-[clamp(60px,15vw,80px)] leading-none text-brand-ink">
            {stats?.averageRating ? stats.averageRating.toFixed(1) : (filteredReviews.length > 0 ? (filteredReviews.reduce((acc, r) => acc + r.rating, 0) / filteredReviews.length).toFixed(1) : '')}
          </span>
          <div className="flex flex-col gap-2">
            <div className="flex gap-1 text-[var(--theme-primary,var(--color-brand-terracotta))]">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} size={14} fill="currentColor" />
              ))}
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand-stone opacity-60">
              {Math.max(stats?.totalReviews || 0, filteredReviews.length)} {Math.max(stats?.totalReviews || 0, filteredReviews.length) === 1 ? 'avaliação verificada' : 'avaliações verificadas'}
            </span>
          </div>
        </div>

        <div className="flex-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--theme-accent,var(--color-brand-terracotta))] mb-4 flex items-center gap-2">
            <ShieldCheck size={12} />
            Experiências Reais e Verificadas
          </span>
          <h2 className="text-[clamp(28px,8vw,36px)] md:text-5xl font-serif text-brand-ink">
            O que as clientes dizem <br />
            sobre as <em className="font-serif italic text-brand-stone">sessões</em>
          </h2>
        </div>
        
        {insights.length > 0 && (
          <div className="flex flex-col gap-3 lg:border-l lg:border-brand-mist/60 lg:pl-10 self-start lg:self-center">
             {insights.map((insight, idx) => (
                <div key={idx} className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent,var(--color-brand-terracotta))] opacity-60 shrink-0" />
                   <p className="text-sm font-medium text-brand-stone whitespace-nowrap">
                      {resolveTagText(insight.tag, insight.percentage, total)}
                   </p>
                </div>
             ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredReviews.map((review, i) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group bg-brand-white border border-brand-mist rounded-[40px] p-6 sm:p-10 hover:border-brand-blush hover:shadow-2xl transition-all duration-500 flex flex-col justify-between"
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
                <p className="font-serif italic text-[16px] leading-relaxed text-brand-ink mb-6 relative z-10">
                  "{review.comment}"
                </p>
              )}
              
              {review.tags && review.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-10 relative z-10">
                  {review.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-brand-white border border-brand-mist/60 text-brand-stone text-[9px] font-medium tracking-wider uppercase rounded-md flex items-center gap-1.5">
                      <Tag size={8} className="opacity-50" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-brand-mist/50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-linen flex items-center justify-center text-[14px] font-serif text-[var(--theme-accent,var(--color-brand-terracotta))] border border-brand-mist shrink-0">
                  {(review.publicDisplayMode === 'named' ? (review.firstName || 'C')[0] : 'C')}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-brand-ink">
                    {review.publicDisplayMode === 'named' ? (review.firstName || 'Cliente') : 'Cliente Anônima'}
                  </div>
                  {(review.publicDisplayMode !== 'anonymous' && (review.locationLabel || review.neighborhood)) ? (
                    <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-brand-stone opacity-50 mt-1">
                      <MapPin size={8} />
                      {review.locationLabel || review.neighborhood}
                    </div>
                  ) : review.serviceName ? (
                    <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-brand-stone opacity-50 mt-1">
                      {review.serviceName}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-[var(--theme-accent,var(--color-brand-terracotta))] font-medium opacity-80">
                <ShieldCheck size={14} />
                <span className="hidden sm:inline">Verificada</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
