import React from 'react';
import { Clock, DollarSign, Plus, X, Briefcase, AlertCircle, Sparkles, ChevronRight } from 'lucide-react';
import { inferCategory } from '../lib/inferCategory';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export interface ServiceDraft {
  name: string;
  duration: number | string;
  price: string;
  description: string;
  serviceCategory?: string;
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
  allowMultiple?: boolean;
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

const CATEGORIES = [
  'Bem-estar e Bronzeamento',
  'Cabelos',
  'Cílios',
  'Depilação',
  'Estética Corporal',
  'Estética Facial',
  'Maquiagem',
  'Massagens e Terapias',
  'Micropigmentação',
  'Podologia',
  'Sobrancelhas',
  'Unhas',
  'Outros'
];

export const FormServices = ({
  services,
  setServices,
  errors = [],
  title,
  subtitle,
  workingHours = { startTime: '09:00', endTime: '18:00' },
  specialty,
  allowMultiple = true
}: FormServicesProps) => {
  const [showCustom, setShowCustom] = React.useState<Record<number, boolean>>({});
  const [autoInferredCategory, setAutoInferredCategory] = React.useState<Record<number, boolean>>({});

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
    
    // Auto-infer category on name change
    if (field === 'name') {
      const inferred = inferCategory(value);
      if (inferred && (!newServices[index].serviceCategory || autoInferredCategory[index])) {
        newServices[index].serviceCategory = inferred;
        setAutoInferredCategory(prev => ({ ...prev, [index]: true }));
      } else if (!inferred && autoInferredCategory[index]) {
        newServices[index].serviceCategory = '';
        setAutoInferredCategory(prev => ({ ...prev, [index]: false }));
      }
    }
    
    // Clear auto-infer flag on explicit category manual selection
    if (field === 'serviceCategory') {
      setAutoInferredCategory(prev => ({ ...prev, [index]: false }));
    }
    
    setServices(newServices);
  };

  const updateServiceFields = (index: number, updates: Partial<ServiceDraft>) => {
    const newServices = [...services];
    
    if (updates.name && !updates.serviceCategory) {
      const inferred = inferCategory(updates.name);
      if (inferred) {
        updates.serviceCategory = inferred;
        setAutoInferredCategory(prev => ({ ...prev, [index]: true }));
      }
    }
    
    if (updates.serviceCategory && updates.name === undefined) {
       setAutoInferredCategory(prev => ({ ...prev, [index]: false }));
    }
    
    newServices[index] = { ...newServices[index], ...updates };
    setServices(newServices);
  };

  const removeService = (index: number) => {
    if (services.length === 1) return;
    setServices(services.filter((_, i) => i !== index));
  };

  const [showAllSuggestions, setShowAllSuggestions] = React.useState(false);

  return (
    <div className="w-full space-y-5">
      {(title || subtitle) && (
        <div className="text-center space-y-1">
          <div className="w-10 h-10 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-1 shadow-sm border border-brand-mist">
            <Briefcase size={20} />
          </div>
          {title && <h1 className="text-xl sm:text-2xl font-serif font-normal text-brand-ink tracking-tight px-4">{title}</h1>}
          {subtitle && <p className="text-brand-stone font-light text-[12px] sm:text-[13px] px-4 md:px-8 mt-1">{subtitle}</p>}
        </div>
      )}

      <div className="space-y-6">
        {services.map((service, index) => {
          const durationVal = Number(service.duration) || 0;
          const isCustom = !DURATION_OPTIONS.some(opt => opt.value === durationVal) && durationVal > 0;
          const currentShowCustom = showCustom[index] ?? isCustom;
          
          const displayedSuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, 4);

          return (
            <div key={index} className="bg-brand-white p-5 sm:p-8 rounded-[24px] sm:rounded-[32px] border border-brand-mist shadow-sm relative group overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-brand-mist/20" />
              
              {services.length > 1 && (
                <button 
                  type="button"
                  onClick={() => removeService(index)}
                  className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 flex items-center justify-center text-brand-stone hover:text-brand-terracotta transition-colors z-10"
                >
                  <X size={18} />
                </button>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                    Nome do serviço <span className="text-brand-terracotta">*</span>
                  </label>
                  
                  <div className="mb-3">
                    <div className="flex items-center justify-between ml-1 mb-1.5 pr-1 sm:pr-0">
                      <p className="text-[11px] font-medium text-brand-ink">Sugestões para começar:</p>
                      {!showAllSuggestions && suggestions.length > 4 && (
                        <span className="text-[10px] text-brand-stone/80 sm:hidden font-light tracking-wide">
                          Deslize para ver mais sugestões
                        </span>
                      )}
                    </div>
                    <div className="flex items-center -mr-5 pr-1 sm:mr-0 sm:pr-0">
                      <div className="flex-1 flex overflow-x-auto sm:flex-wrap gap-2 pb-2 -ml-5 pl-5 pr-2 sm:ml-0 sm:pl-0 sm:pr-0 no-scrollbar snap-x relative">
                        {displayedSuggestions.map((sug, idx) => {
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
                                "px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 ease-out border flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/50 focus-visible:ring-offset-1 shrink-0 snap-start",
                                isActive
                                  ? "bg-brand-terracotta text-brand-white border-brand-terracotta shadow-sm"
                                  : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone/40 hover:bg-white"
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
                        {!showAllSuggestions && suggestions.length > 4 && (
                          <div className="shrink-0 snap-start flex items-center pr-2 sm:pr-0">
                            <button
                              type="button"
                              onClick={() => setShowAllSuggestions(true)}
                              className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 ease-out border border-transparent bg-transparent text-brand-terracotta hover:bg-brand-terracotta/10"
                            >
                              Ver mais
                            </button>
                          </div>
                        )}
                      </div>
                      {!showAllSuggestions && suggestions.length > 4 && (
                        <div className="shrink-0 pb-2 pl-0.5 pr-2 flex items-center justify-center sm:hidden text-brand-stone/30">
                          <ChevronRight size={16} />
                        </div>
                      )}
                    </div>
                  </div>

                  <input 
                    type="text" 
                    value={service.name} 
                    onChange={(e) => updateService(index, 'name', e.target.value)} 
                    placeholder="Ex: Manicure completa" 
                    className={cn(
                      "w-full px-4 py-3 bg-brand-parchment border rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
                      errors[index]?.name ? "border-brand-terracotta ring-1 ring-brand-terracotta/20 font-medium" : "border-brand-mist"
                    )}
                  />
                  <FormError message={errors[index]?.name} />
                </div>

                <div className="md:col-span-2 space-y-2 mt-1">
                  <div className="flex flex-col gap-1 items-start">
                    <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                      Categoria do serviço <span className="text-brand-terracotta">*</span>
                    </label>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                    {CATEGORIES.map(cat => {
                      const isActive = service.serviceCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => updateService(index, 'serviceCategory', cat)}
                          className={cn(
                            "px-3 py-2 rounded-lg border text-[11px] transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/50 w-full sm:w-auto text-center sm:text-left",
                            isActive
                              ? "bg-brand-ink text-brand-white border-brand-ink shadow-md font-bold"
                              : "bg-white text-brand-ink border-brand-mist/80 shadow-sm hover:border-brand-ink/40 hover:bg-brand-linen/30 font-medium"
                          )}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                  <FormError message={errors[index]?.serviceCategory} />
                </div>

                <div className="md:col-span-1 space-y-2 mt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">
                      Duração do atendimento <span className="text-brand-terracotta">*</span>
                    </label>
                    <p className="text-[11px] text-brand-stone/80 ml-1 leading-relaxed">
                      Informe quanto tempo você normalmente leva para realizar este serviço. Esse tempo organiza os horários disponíveis para reserva.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          updateService(index, 'duration', opt.value.toString());
                          setShowCustom(prev => ({ ...prev, [index]: false }));
                        }}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all min-h-[40px]",
                          durationVal === opt.value && !currentShowCustom
                            ? "bg-brand-terracotta border-brand-terracotta text-brand-white shadow-sm font-extrabold"
                            : "border-brand-mist text-brand-stone hover:border-brand-ink bg-white"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowCustom(prev => ({ ...prev, [index]: !currentShowCustom }))}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider transition-all min-h-[40px]",
                        currentShowCustom
                          ? "bg-brand-ink border-brand-ink text-brand-white"
                          : "border-brand-mist text-brand-stone hover:border-brand-ink bg-white"
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
                        <Clock className="absolute left-4 top-[20px] text-brand-mist/40" size={14} />
                        <input 
                          type="number" 
                          min="15"
                          max="480"
                          step="15"
                          value={service.duration} 
                          onChange={(e) => updateService(index, 'duration', e.target.value)} 
                          placeholder="Ex: 60"
                          className={cn(
                            "w-full pl-11 pr-12 py-2.5 bg-brand-parchment border rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
                            errors[index]?.duration ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                          )}
                        />
                        <span className="absolute right-4 top-[18px] text-[10px] font-bold text-brand-stone uppercase tracking-widest">min</span>
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
                        "w-full pl-11 pr-4 py-3 bg-brand-parchment border rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
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
                    className="w-full px-4 py-3 bg-brand-parchment border border-brand-mist rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm h-20 resize-none"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {allowMultiple && (
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
        )}
      </div>
    </div>
  );
};
