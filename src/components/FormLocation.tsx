import React from 'react';
import { MapPin, Building2, Home, Briefcase } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export interface FormLocationProps {
  city: string;
  setCity: (val: string) => void;
  neighborhood: string;
  setNeighborhood: (val: string) => void;
  serviceMode: 'home' | 'studio' | 'hybrid';
  setServiceMode: (val: 'home' | 'studio' | 'hybrid') => void;
  title?: string;
  subtitle?: string;
  showLabels?: boolean;
}

export const FormLocation = ({
  city,
  setCity,
  neighborhood,
  setNeighborhood,
  serviceMode,
  setServiceMode,
  title,
  subtitle,
  showLabels = true
}: FormLocationProps) => {
  return (
    <div className="w-full space-y-10">
      {(title || subtitle) && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-mist">
            {serviceMode === 'home' ? <Home size={32} /> : serviceMode === 'studio' ? <Building2 size={32} /> : <Briefcase size={32} />}
          </div>
          {title && <h1 className="text-4xl font-serif font-normal text-brand-ink">{title}</h1>}
          {subtitle && <p className="text-brand-stone font-light">{subtitle}</p>}
        </div>
      )}

      <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Cidade Base</label>}
            <div className="relative">
              <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={20} />
              <input 
                type="text" 
                value={city} 
                onChange={(e) => setCity(e.target.value)} 
                placeholder="Ex: Fortaleza, CE" 
                className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
              />
            </div>
          </div>
          <div className="space-y-2">
            {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Bairro Base</label>}
            <input 
              type="text" 
              value={neighborhood} 
              onChange={(e) => setNeighborhood(e.target.value)} 
              placeholder="Ex: Aldeota" 
              className="w-full px-6 py-[15px] bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
            />
          </div>
        </div>

        <div className="space-y-4">
          {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Modo de Atendimento</label>}
          <div className="grid grid-cols-3 gap-3">
            <button 
              type="button"
              onClick={() => setServiceMode('studio')}
              className={cn(
                "p-5 rounded-[24px] border transition-all flex flex-col items-center gap-2",
                serviceMode === 'studio' 
                  ? 'border-brand-ink bg-brand-linen text-brand-ink' 
                  : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'
              )}
            >
              <Building2 size={24} />
              <span className="text-[10px] font-medium uppercase">Estúdio</span>
            </button>
            <button 
              type="button"
              onClick={() => setServiceMode('home')}
              className={cn(
                "p-5 rounded-[24px] border transition-all flex flex-col items-center gap-2",
                serviceMode === 'home' 
                  ? 'border-brand-ink bg-brand-linen text-brand-ink' 
                  : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'
              )}
            >
              <Home size={24} />
              <span className="text-[10px] font-medium uppercase">Domicílio</span>
            </button>
            <button 
              type="button"
              onClick={() => setServiceMode('hybrid')}
              className={cn(
                "p-5 rounded-[24px] border transition-all flex flex-col items-center gap-2",
                serviceMode === 'hybrid' 
                  ? 'border-brand-ink bg-brand-linen text-brand-ink' 
                  : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'
              )}
            >
              <Briefcase size={24} />
              <span className="text-[10px] font-medium uppercase">Híbrido</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
