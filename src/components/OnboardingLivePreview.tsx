import React from 'react';
import { motion } from 'motion/react';
import { Globe, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface OnboardingLivePreviewProps {
  name: string;
  specialty: string;
  headline?: string;
  slug: string;
  avatar?: string;
}

export const OnboardingLivePreview = ({ 
  name, 
  specialty, 
  headline, 
  slug,
  avatar 
}: OnboardingLivePreviewProps) => {
  const firstName = name.split(' ')[0] || 'Seu Nome';

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4 text-brand-stone/40">
        <Sparkles size={14} />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Prévia do seu Perfil</span>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-white border border-brand-mist rounded-[32px] p-6 shadow-sm relative overflow-hidden"
      >
        <div className="flex items-start gap-5">
          <div className="w-16 h-20 rounded-2xl bg-brand-linen/60 overflow-hidden shrink-0 border border-brand-mist/50">
            {avatar ? (
              <img 
                src={avatar} 
                alt="Preview" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-brand-stone/20">
                <Sparkles size={24} />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-serif text-lg text-brand-ink truncate leading-tight">
              {name || 'Sua Identidade'}
            </h4>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta mt-1">
              {specialty || 'Sua Especialidade'}
            </p>
            
            <p className={cn(
              "text-[11px] font-light mt-3 line-clamp-2",
              headline ? "text-brand-stone" : "text-brand-stone/30 italic"
            )}>
              {headline || 'Sua headline aparecerá aqui...'}
            </p>
          </div>
        </div>
        
        <div className="mt-6 pt-5 border-t border-brand-mist/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand-stone/40">
            <Globe size={12} />
            <span className="text-[10px] font-medium tracking-wide">nera.app/p/{slug || 'link'}</span>
          </div>
          
          <div className="flex gap-1">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand-linen" />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
