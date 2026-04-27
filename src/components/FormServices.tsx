import React from 'react';
import { Clock, DollarSign, Plus, X, Briefcase, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export interface ServiceDraft {
  name: string;
  duration: number | string;
  price: string;
  description: string;
}

export interface FormServicesProps {
  services: ServiceDraft[];
  setServices: (services: ServiceDraft[]) => void;
  errors?: any[];
  title?: string;
  subtitle?: string;
  workingHours?: {
    startTime: string;
    endTime: string;
  };
}

const FormError = ({ message }: { message?: string }) => (
  <AnimatePresence mode="wait">
    {message && (
      <motion.p 
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="text-[10px] text-brand-terracotta font-bold uppercase tracking-wider ml-1 mt-2 flex items-center gap-1.5"
      >
        <AlertCircle size={12} /> {message}
      </motion.p>
    )}
  </AnimatePresence>
);

const DURATION_CHIPS = [30, 45, 60, 90, 120];

export const FormServices = ({
  services,
  setServices,
  errors = [],
  title,
  subtitle,
  workingHours = { startTime: '09:00', endTime: '18:00' }
}: FormServicesProps) => {
  const [showCustom, setShowCustom] = React.useState<Record<number, boolean>>({});

  const addService = () => {
    setServices([...services, { name: '', duration: '', price: '', description: '' }]);
  };

  const updateService = (index: number, field: keyof ServiceDraft, value: any) => {
    const newServices = [...services];
    newServices[index] = { ...newServices[index], [field]: value };
    setServices(newServices);
  };

  const removeService = (index: number) => {
    if (services.length === 1) return;
    setServices(services.filter((_, i) => i !== index));
  };

  const calculateSlots = (duration: number) => {
    if (!duration || duration <= 0) return 0;
    const start = workingHours.startTime || '09:00';
    const end = workingHours.endTime || '18:00';
    
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    return Math.floor(totalMinutes / duration);
  };

  return (
    <div className="w-full space-y-10">
      {(title || subtitle) && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-mist">
            <Briefcase size={32} />
          </div>
          {title && <h1 className="text-4xl font-serif font-normal text-brand-ink">{title}</h1>}
          {subtitle && <p className="text-brand-stone font-light italic">{subtitle}</p>}
        </div>
      )}

      <div className="space-y-8">
        {services.map((service, index) => {
          const durationVal = Number(service.duration) || 0;
          const slots = calculateSlots(durationVal);
          const isDurationInvalid = errors[index]?.duration || (service.duration === "" && errors[index]?.name); // Simple heuristic for "tried to save"

          return (
            <div key={index} className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm relative group overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-brand-mist/20" />
              
              {services.length > 1 && (
                <button 
                  type="button"
                  onClick={() => removeService(index)}
                  className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center text-brand-stone hover:text-brand-terracotta transition-colors z-10"
                >
                  <X size={18} />
                </button>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                    Nome do serviço <span className="text-brand-terracotta">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={service.name} 
                    onChange={(e) => updateService(index, 'name', e.target.value)} 
                    placeholder="Ex: Consultoria de Imagem" 
                    className={cn(
                      "w-full px-6 py-4 bg-brand-parchment border rounded-2xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
                      errors[index]?.name ? "border-brand-terracotta ring-1 ring-brand-terracotta/20 font-medium" : "border-brand-mist"
                    )}
                  />
                  <FormError message={errors[index]?.name} />
                </div>

                <div className="md:col-span-1 space-y-3">
                  <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">
                    Duração do Atendimento <span className="text-brand-terracotta">*</span>
                  </label>
                  
                  <div className="flex flex-wrap gap-2">
                    {DURATION_CHIPS.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          updateService(index, 'duration', d.toString());
                          setShowCustom(prev => ({ ...prev, [index]: false }));
                        }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all",
                          durationVal === d && !showCustom[index]
                            ? "bg-brand-terracotta border-brand-terracotta text-brand-white shadow-md"
                            : "border-brand-mist text-brand-stone hover:border-brand-ink"
                        )}
                      >
                        {d} min
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowCustom(prev => ({ ...prev, [index]: !prev[index] }))}
                      className={cn(
                        "px-4 py-2.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all",
                        showCustom[index]
                          ? "bg-brand-ink border-brand-ink text-brand-white"
                          : "border-brand-mist text-brand-stone hover:border-brand-ink"
                      )}
                    >
                      {showCustom[index] ? 'Cancelar' : '+ Personalizado'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showCustom[index] && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="relative pt-2"
                      >
                        <Clock className="absolute left-4 top-[22px] text-brand-mist/40" size={14} />
                        <input 
                          type="number" 
                          value={service.duration} 
                          onChange={(e) => updateService(index, 'duration', e.target.value)} 
                          placeholder="Ex: 60 minutos"
                          className={cn(
                            "w-full pl-11 pr-12 py-3 bg-brand-parchment border rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
                            errors[index]?.duration ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                          )}
                        />
                        <span className="absolute right-4 top-[22px] text-[10px] font-bold text-brand-stone uppercase tracking-widest">min</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {errors[index]?.duration && <FormError message="Informe a duração. Ela define os horários disponíveis para suas clientes." />}

                  {durationVal > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-brand-linen/40 p-4 rounded-3xl border border-dashed border-brand-mist/50 mt-4"
                    >
                      <p className="text-[10px] text-brand-stone font-medium leading-relaxed uppercase tracking-widest">
                        Com <span className="text-brand-terracotta font-bold">{durationVal} min</span>, sua agenda abre vagas das <span className="text-brand-ink font-bold">{workingHours.startTime}</span> até as <span className="text-brand-ink font-bold">{workingHours.endTime}</span>. 
                        Isso permite <span className="text-brand-terracotta font-bold">{slots} atendimentos</span> por dia.
                      </p>
                    </motion.div>
                  )}
                </div>

                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">Valor (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist/40" size={14} />
                    <input 
                      type="number" 
                      value={service.price} 
                      onChange={(e) => updateService(index, 'price', e.target.value)} 
                      placeholder="0,00" 
                      className={cn(
                        "w-full pl-11 pr-4 py-4 bg-brand-parchment border rounded-2xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
                        errors[index]?.price ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                      )}
                    />
                  </div>
                  <FormError message={errors[index]?.price} />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Descrição do serviço (Opcional)</label>
                  <textarea 
                    value={service.description} 
                    onChange={(e) => updateService(index, 'description', e.target.value)} 
                    placeholder="Ex: Realçando sua beleza com naturalidade..." 
                    className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-2xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm h-24 resize-none"
                  />
                </div>
              </div>
            </div>
          );
        })}

        <button 
          type="button"
          onClick={addService}
          className="w-full py-8 border-2 border-dashed border-brand-mist rounded-[40px] text-brand-stone hover:text-brand-terracotta hover:border-brand-terracotta/30 transition-all flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-[11px] bg-brand-parchment/30"
        >
          <div className="w-8 h-8 rounded-full border border-current flex items-center justify-center">
            <Plus size={16} />
          </div>
          Adicionar outro serviço
        </button>
      </div>
    </div>
  );
};
