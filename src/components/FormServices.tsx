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
  specialty?: string;
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

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1h', value: 60 },
  { label: '1h30', value: 90 },
  { label: '2h', value: 120 },
  { label: '2h30', value: 150 },
  { label: '3h', value: 180 },
];

export const FormServices = ({
  services,
  setServices,
  errors = [],
  title,
  subtitle,
  workingHours = { startTime: '09:00', endTime: '18:00' },
  specialty
}: FormServicesProps) => {
  const [showCustom, setShowCustom] = React.useState<Record<number, boolean>>({});

  const getServiceSuggestions = (spec?: string) => {
    if (!spec) {
      return [
        { name: 'Atendimento personalizado', duration: 60 },
        { name: 'Consulta inicial', duration: 30 },
        { name: 'Serviço principal', duration: 60 }
      ];
    }
    
    // Normalize string: lowercase, remove accents
    const s = spec.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (s.includes('lash') || s.includes('cilio')) {
      return [
        { name: 'Extensão fio a fio', duration: 120 },
        { name: 'Volume brasileiro', duration: 120 },
        { name: 'Manutenção de cílios', duration: 60 }
      ];
    }
    if (s.includes('sobrancelha') || s.includes('micropigmentadora')) {
      return [
        { name: 'Design de sobrancelhas', duration: 60 },
        { name: 'Design com henna', duration: 60 },
        { name: 'Brow lamination', duration: 90 }
      ];
    }
    if (s.includes('maqui')) {
      return [
        { name: 'Maquiagem social', duration: 60 },
        { name: 'Maquiagem para noiva', duration: 120 },
        { name: 'Produção para formanda', duration: 90 }
      ];
    }
    if (s.includes('nail') || s.includes('unha') || s.includes('manicure')) {
      return [
        { name: 'Manicure', duration: 60 },
        { name: 'Banho de gel', duration: 90 },
        { name: 'Alongamento de unhas', duration: 120 }
      ];
    }
    if (s.includes('estetic') || s.includes('masso') || s.includes('depila') || s.includes('tto')) {
      return [
        { name: 'Limpeza de pele', duration: 60 },
        { name: 'Drenagem linfática', duration: 60 },
        { name: 'Peeling facial', duration: 60 }
      ];
    }
    if (s.includes('cabel') || s.includes('trancista') || s.includes('terapeuta capilar') || s.includes('hair')) {
      return [
        { name: 'Corte feminino', duration: 60 },
        { name: 'Escova', duration: 60 },
        { name: 'Coloração', duration: 120 }
      ];
    }
    return [
      { name: 'Atendimento personalizado', duration: 60 },
      { name: 'Consulta inicial', duration: 30 },
      { name: 'Serviço principal', duration: 60 }
    ];
  };

  const suggestions = getServiceSuggestions(specialty);

  const addService = () => {
    setServices([...services, { name: '', duration: '', price: '', description: '' }]);
  };

  const updateService = (index: number, field: keyof ServiceDraft, value: any) => {
    const newServices = [...services];
    newServices[index] = { ...newServices[index], [field]: value };
    setServices(newServices);
  };

  const updateServiceFields = (index: number, updates: Partial<ServiceDraft>) => {
    const newServices = [...services];
    newServices[index] = { ...newServices[index], ...updates };
    setServices(newServices);
  };

  const removeService = (index: number) => {
    if (services.length === 1) return;
    setServices(services.filter((_, i) => i !== index));
  };

  const calculateSlots = (duration: number) => {
    if (!duration || duration <= 0) return 0;
    const safeWorkingHours = workingHours || { startTime: '09:00', endTime: '18:00' };
    const start = safeWorkingHours.startTime || '09:00';
    const end = safeWorkingHours.endTime || '18:00';
    
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
          const isCustom = !DURATION_OPTIONS.some(opt => opt.value === durationVal) && durationVal > 0;
          const currentShowCustom = showCustom[index] ?? isCustom;

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
                  
                  <div className="mb-3">
                    <p className="text-[10px] font-medium text-brand-ink ml-1 mb-0.5">Sugestões para começar</p>
                    <p className="text-[9px] text-brand-stone font-light italic ml-1 mb-2">
                      Você pode ajustar nome, duração e preço depois.
                    </p>
                    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none -mx-2 px-2 md:mx-0 md:px-0">
                      {suggestions.map((sug, idx) => {
                        const isActive = service.name === sug.name;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              updateServiceFields(index, {
                                name: sug.name,
                                duration: String(sug.duration)
                              });
                              setShowCustom(prev => ({ ...prev, [index]: false }));
                            }}
                            className={cn(
                              "flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-medium transition-all duration-300 ease-out border flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/50 focus-visible:ring-offset-1",
                              isActive
                                ? "bg-brand-terracotta text-brand-white border-brand-terracotta shadow-sm scale-[1.02]"
                                : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone/40 hover:bg-white hover:scale-[1.02] active:scale-[0.98]"
                            )}
                          >
                            {sug.name}{" "}
                            <span className={cn(
                              "font-normal tracking-normal normal-case",
                              isActive ? "text-brand-white/80" : "text-brand-stone/80"
                            )}>
                              • {sug.duration} min
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

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

                <div className="md:col-span-1 space-y-4">
                  <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">
                    Duração do Atendimento <span className="text-brand-terracotta">*</span>
                  </label>
                  
                  <div className="flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          updateService(index, 'duration', opt.value.toString());
                          setShowCustom(prev => ({ ...prev, [index]: false }));
                        }}
                        className={cn(
                          "px-4 py-2.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all",
                          durationVal === opt.value && !currentShowCustom
                            ? "bg-brand-terracotta border-brand-terracotta text-brand-white shadow-md font-extrabold"
                            : "border-brand-mist text-brand-stone hover:border-brand-ink"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowCustom(prev => ({ ...prev, [index]: !currentShowCustom }))}
                      className={cn(
                        "px-4 py-2.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all",
                        currentShowCustom
                          ? "bg-brand-ink border-brand-ink text-brand-white"
                          : "border-brand-mist text-brand-stone hover:border-brand-ink"
                      )}
                    >
                      {currentShowCustom ? 'Voltar' : 'Personalizado'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {currentShowCustom && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="relative pt-2"
                      >
                        <Clock className="absolute left-4 top-[22px] text-brand-mist/40" size={14} />
                        <input 
                          type="number" 
                          min="15"
                          max="480"
                          step="15"
                          value={service.duration} 
                          onChange={(e) => updateService(index, 'duration', e.target.value)} 
                          placeholder="Ex: 60"
                          className={cn(
                            "w-full pl-11 pr-12 py-3 bg-brand-parchment border rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
                            errors[index]?.duration ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                          )}
                        />
                        <span className="absolute right-4 top-[22px] text-[10px] font-bold text-brand-stone uppercase tracking-widest">min</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <AnimatePresence>
                    {errors[index]?.duration && (
                      <div className="mt-1">
                        <FormError message={errors[index]?.duration} />
                      </div>
                    )}
                  </AnimatePresence>

                  <div className="bg-brand-linen/40 p-5 rounded-3xl border border-dashed border-brand-mist/50 mt-4">
                    <p className="text-[10px] text-brand-stone font-medium leading-relaxed uppercase tracking-widest mb-2">
                       A duração define os horários disponíveis para suas clientes.
                    </p>
                    {durationVal > 0 && slots > 0 && (
                      <p className="text-[10px] text-brand-stone font-light italic leading-relaxed">
                        Com <span className="text-brand-terracotta font-bold">{durationVal} min</span> por atendimento, sua agenda permite até <span className="text-brand-terracotta font-bold">{slots} atendimentos</span> por dia.
                      </p>
                    )}
                  </div>
                </div>

                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">Valor do serviço (Obrigatório) <span className="text-brand-terracotta">*</span></label>
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
