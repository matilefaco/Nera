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
        { name: 'Avaliação', duration: 30 },
        { name: 'Serviço principal', duration: 60 },
        { name: 'Manutenção', duration: 45 },
        { name: 'Retorno', duration: 30 }
      ];
    }
    
    // Normalize string: lowercase, remove accents
    const s = spec.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (s.includes('bronzeamento') || s.includes('bronze')) {
      return [
        { name: 'Bronzeamento Natural', duration: 90 },
        { name: 'Bronzeamento a Jato', duration: 45 },
        { name: 'Bronzeamento Gelado', duration: 60 },
        { name: 'Banho de Lua', duration: 45 },
        { name: 'Esfoliação Corporal', duration: 45 },
        { name: 'Bronzeamento com Fita', duration: 90 },
        { name: 'Sessão de Retoque', duration: 30 },
        { name: 'Hidratação Pós-Bronze', duration: 30 }
      ];
    }

    if (s.includes('masso') || s.includes('massagem')) {
      return [
        { name: 'Massagem Relaxante', duration: 60 },
        { name: 'Drenagem Linfática', duration: 60 },
        { name: 'Massagem Modeladora', duration: 60 },
        { name: 'Massagem Terapêutica', duration: 60 },
        { name: 'Ventosaterapia', duration: 45 },
        { name: 'Pedras Quentes', duration: 90 },
        { name: 'Reflexologia Podal', duration: 45 },
        { name: 'Massagem Desportiva', duration: 60 },
        { name: 'Drenagem Pós-Operatória', duration: 60 }
      ];
    }

    if (s.includes('terapeuta capilar') || s.includes('terapia capilar')) {
      return [
        { name: 'Avaliação Capilar', duration: 60 },
        { name: 'Detox Capilar', duration: 60 },
        { name: 'Tratamento de Queda', duration: 60 },
        { name: 'Laserterapia Capilar', duration: 45 },
        { name: 'Microagulhamento Capilar', duration: 60 },
        { name: 'Ozonioterapia Capilar', duration: 45 },
        { name: 'Alta Frequência Capilar', duration: 30 },
        { name: 'Argiloterapia Capilar', duration: 60 }
      ];
    }

    if (s.includes('micropigmentadora') || s.includes('micropigmentacao')) {
      return [
        { name: 'Micropigmentação Fio a Fio', duration: 120 },
        { name: 'Micropigmentação Shadow', duration: 120 },
        { name: 'Micropigmentação Labial', duration: 150 },
        { name: 'Revitalização Labial', duration: 120 },
        { name: 'Retoque de Micropigmentação', duration: 60 },
        { name: 'Neutralização de Lábios', duration: 120 },
        { name: 'Delineado de Olhos', duration: 120 },
        { name: 'Despigmentação a Laser', duration: 60 },
        { name: 'Camuflagem de Olheiras', duration: 90 }
      ];
    }

    if (s.includes('trancista') || s.includes('tranca')) {
      return [
        { name: 'Tranças Box Braids', duration: 240 },
        { name: 'Tranças Nagô', duration: 120 },
        { name: 'Knotless Braids', duration: 240 },
        { name: 'Tranças Fulani', duration: 180 },
        { name: 'Goddess Braids', duration: 180 },
        { name: 'Twist', duration: 180 },
        { name: 'Entrelace', duration: 150 },
        { name: 'Manutenção de Tranças', duration: 90 },
        { name: 'Remoção de Tranças', duration: 60 }
      ];
    }

    if (s.includes('depila')) {
      return [
        { name: 'Depilação Íntima (Virilha)', duration: 30 },
        { name: 'Depilação Meia Perna', duration: 30 },
        { name: 'Depilação Perna Inteira', duration: 45 },
        { name: 'Depilação Axilas', duration: 15 },
        { name: 'Depilação Buço', duration: 15 },
        { name: 'Sobrancelha na Cera', duration: 15 },
        { name: 'Depilação Braços', duration: 30 },
        { name: 'Sessão Laser (Área Pequena)', duration: 30 },
        { name: 'Depilação Costas', duration: 30 }
      ];
    }

    if (s.includes('maqui')) {
      return [
        { name: 'Maquiagem Social', duration: 60 },
        { name: 'Maquiagem para Noiva', duration: 120 },
        { name: 'Maquiagem para Madrinha', duration: 60 },
        { name: 'Maquiagem para Formanda', duration: 90 },
        { name: 'Maquiagem Fotográfica', duration: 90 },
        { name: 'Teste de Maquiagem', duration: 90 },
        { name: 'Maquiagem com Penteado', duration: 150 },
        { name: 'Curso de Automaquiagem', duration: 180 }
      ];
    }

    if (s.includes('estetic') || s.includes('tto')) {
      return [
        { name: 'Limpeza de Pele Profunda', duration: 90 },
        { name: 'Limpeza de Pele Simples', duration: 60 },
        { name: 'Peeling Químico', duration: 60 },
        { name: 'Peeling de Diamante', duration: 45 },
        { name: 'Microagulhamento Facial', duration: 60 },
        { name: 'Drenagem Linfática Facial', duration: 45 },
        { name: 'Hidratação Facial Profunda', duration: 60 },
        { name: 'Radiofrequência Facial', duration: 45 },
        { name: 'Tratamento para Acne', duration: 60 }
      ];
    }

    if (s.includes('cabel') || s.includes('hair')) {
      return [
        { name: 'Corte Feminino', duration: 60 },
        { name: 'Corte Masculino', duration: 45 },
        { name: 'Escova Modeladora', duration: 60 },
        { name: 'Coloração Raiz', duration: 90 },
        { name: 'Coloração Global', duration: 120 },
        { name: 'Mechas / Luzes', duration: 240 },
        { name: 'Morena Iluminada', duration: 180 },
        { name: 'Progressiva / Selagem', duration: 180 },
        { name: 'Cronograma Capilar', duration: 60 },
        { name: 'Penteado', duration: 90 }
      ];
    }

    if (s.includes('sobrancelha')) {
      return [
        { name: 'Design de Sobrancelhas', duration: 30 },
        { name: 'Design com Henna', duration: 60 },
        { name: 'Brow Lamination', duration: 60 },
        { name: 'Retoque de Design', duration: 30 },
        { name: 'Micropigmentação Fio a Fio', duration: 120 },
        { name: 'Micropigmentação Shadow', duration: 120 },
        { name: 'Retoque de Micropigmentação', duration: 60 },
        { name: 'Depilação Facial (Linha)', duration: 30 }
      ];
    }

    if (s.includes('lash') || s.includes('cilio')) {
      return [
        { name: 'Extensão Fio a Fio', duration: 120 },
        { name: 'Volume Brasileiro', duration: 120 },
        { name: 'Volume Russo', duration: 150 },
        { name: 'Mega Volume', duration: 180 },
        { name: 'Lash Lifting', duration: 60 },
        { name: 'Manutenção de Extensão', duration: 90 },
        { name: 'Remoção de Extensão', duration: 30 },
        { name: 'Coloração de Cílios', duration: 30 }
      ];
    }

    if (s.includes('nail')) {
      return [
        { name: 'Alongamento em Gel', duration: 120 },
        { name: 'Alongamento em Fibra', duration: 120 },
        { name: 'Manutenção de Alongamento', duration: 90 },
        { name: 'Banho de Gel', duration: 90 },
        { name: 'Esmaltação em Gel', duration: 60 },
        { name: 'Blindagem', duration: 60 },
        { name: 'Nail Art', duration: 30 },
        { name: 'Remoção de Alongamento', duration: 45 }
      ];
    }

    if (s.includes('manicure') || s.includes('unha')) {
      return [
        { name: 'Manicure e Pedicure', duration: 120 },
        { name: 'Manicure Simples', duration: 60 },
        { name: 'Pedicure Simples', duration: 60 },
        { name: 'Esmaltação em Gel', duration: 60 },
        { name: 'Banho de Gel', duration: 90 },
        { name: 'Spa dos Pés', duration: 45 },
        { name: 'Cutilagem Express', duration: 30 },
        { name: 'Plástica dos Pés', duration: 60 }
      ];
    }

    return [
      { name: 'Atendimento personalizado', duration: 60 },
      { name: 'Consulta inicial', duration: 30 },
      { name: 'Avaliação', duration: 30 },
      { name: 'Serviço principal', duration: 60 },
      { name: 'Manutenção', duration: 45 },
      { name: 'Retorno', duration: 30 }
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
                    placeholder="Ex: Manicure completa" 
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
                  <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">Valor do serviço <span className="text-brand-terracotta">*</span></label>
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
