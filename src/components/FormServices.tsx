import React from 'react';
import { Clock, DollarSign, Plus, X, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export interface ServiceDraft {
  name: string;
  duration: string;
  price: string;
  description: string;
}

export interface FormServicesProps {
  services: ServiceDraft[];
  setServices: (services: ServiceDraft[]) => void;
  errors?: any[];
  title?: string;
  subtitle?: string;
}

const FormError = ({ message }: { message?: string }) => (
  <AnimatePresence>
    {message && (
      <motion.p 
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="text-[10px] text-brand-terracotta font-bold uppercase tracking-wider ml-1 mt-1"
      >
        {message}
      </motion.p>
    )}
  </AnimatePresence>
);

export const FormServices = ({
  services,
  setServices,
  errors = [],
  title,
  subtitle
}: FormServicesProps) => {
  const addService = () => {
    setServices([...services, { name: '', duration: '60', price: '', description: '' }]);
  };

  const updateService = (index: number, field: keyof ServiceDraft, value: string) => {
    const newServices = [...services];
    newServices[index] = { ...newServices[index], [field]: value };
    setServices(newServices);
  };

  const removeService = (index: number) => {
    if (services.length === 1) return;
    setServices(services.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full space-y-10">
      {(title || subtitle) && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-mist">
            <Briefcase size={32} />
          </div>
          {title && <h1 className="text-4xl font-serif font-normal text-brand-ink">{title}</h1>}
          {subtitle && <p className="text-brand-stone font-light">{subtitle}</p>}
        </div>
      )}

      <div className="space-y-6">
        {services.map((service, index) => (
          <div key={index} className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm relative group">
            {services.length > 1 && (
              <button 
                type="button"
                onClick={() => removeService(index)}
                className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-brand-stone hover:text-brand-terracotta transition-colors"
              >
                <X size={18} />
              </button>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                  Nome da Experiência <span className="text-brand-terracotta">*</span>
                </label>
                <input 
                  type="text" 
                  value={service.name} 
                  onChange={(e) => updateService(index, 'name', e.target.value)} 
                  placeholder="Ex: Consultoria de Imagem" 
                  className={cn(
                    "w-full px-6 py-4 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light",
                    errors[index]?.name ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                  )}
                />
                <FormError message={errors[index]?.name} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Tempo Previsto (min)</label>
                <div className="relative">
                  <Clock className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
                  <input 
                    type="number" 
                    value={service.duration} 
                    onChange={(e) => updateService(index, 'duration', e.target.value)} 
                    placeholder="60" 
                    className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                  Valor (R$) <span className="text-brand-terracotta">*</span>
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
                  <input 
                    type="number" 
                    value={service.price} 
                    onChange={(e) => updateService(index, 'price', e.target.value)} 
                    placeholder="0,00" 
                    className={cn(
                      "w-full pl-14 pr-6 py-4 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light",
                      errors[index]?.price ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                    )}
                  />
                </div>
                <FormError message={errors[index]?.price} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Sutilezas e Detalhes (Opcional)</label>
                <input 
                  type="text" 
                  value={service.description} 
                  onChange={(e) => updateService(index, 'description', e.target.value)} 
                  placeholder="Ex: Realçando sua beleza com naturalidade..." 
                  className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                />
              </div>
            </div>
          </div>
        ))}

        <button 
          type="button"
          onClick={addService}
          className="w-full py-6 border border-dashed border-brand-mist rounded-3xl text-brand-stone hover:text-brand-ink hover:border-brand-ink transition-all flex items-center justify-center gap-3 font-medium text-sm"
        >
          <Plus size={18} /> Propor nova experiência
        </button>
      </div>
    </div>
  );
};
