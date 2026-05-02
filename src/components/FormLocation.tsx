import React from 'react';
import { MapPin, Building2, Home, Briefcase, X, MapPin as MapPinIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { SERVICE_MODES } from '../lib/copy';

export interface FormLocationProps {
  city: string;
  setCity: (val: string) => void;
  neighborhood: string;
  setNeighborhood: (val: string) => void;
  serviceMode: 'home' | 'studio' | 'hybrid';
  setServiceMode: (val: 'home' | 'studio' | 'hybrid') => void;
  
  // Optional studio fields
  studioAddress?: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state?: string;
    reference: string;
    hasParking?: boolean;
    parkingInfo?: string;
    hasAccessibility?: boolean;
    accessibilityInfo?: string;
    isSafeLocation?: boolean;
    locationNotes?: string;
  };
  setStudioAddress?: (val: any) => void;
  
  // Optional home service fields
  serviceAreas?: { name: string, fee: number }[];
  setServiceAreas?: (val: any[]) => void;
  pricingStrategy?: 'extra' | 'none';
  setPricingStrategy?: (val: 'extra' | 'none') => void;
  newAreaName?: string;
  setNewAreaName?: (val: string) => void;
  newAreaFee?: string;
  setNewAreaFee?: (val: string) => void;
  serviceAreaType?: 'city_wide' | 'specific_neighborhoods';
  setServiceAreaType?: (val: 'city_wide' | 'specific_neighborhoods') => void;
  addArea?: () => void;
  removeArea?: (idx: number) => void;
  formatCurrency?: (val: number) => string;
  errors?: Record<string, string>;

  title?: string;
  subtitle?: string;
  showLabels?: boolean;
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

export const FormLocation = ({
  city,
  setCity,
  neighborhood,
  setNeighborhood,
  serviceMode,
  setServiceMode,
  studioAddress,
  setStudioAddress,
  serviceAreas,
  setServiceAreas,
  pricingStrategy,
  setPricingStrategy,
  newAreaName,
  setNewAreaName,
  newAreaFee,
  setNewAreaFee,
  serviceAreaType,
  setServiceAreaType,
  addArea,
  removeArea,
  formatCurrency,
  errors = {},
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
            {showLabels && (
              <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                Cidade <span className="text-brand-terracotta">*</span>
              </label>
            )}
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist/40" size={16} />
              <input 
                type="text" 
                value={city} 
                onChange={(e) => setCity(e.target.value)} 
                placeholder="Ex: São Paulo, SP" 
                className={cn(
                  "w-full pl-11 pr-4 py-3.5 bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
                  errors.city ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                )}
              />
            </div>
            <FormError message={errors.city} />
          </div>
          <div className="space-y-2">
            {showLabels && (
              <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                Bairro
              </label>
            )}
            <input 
              type="text" 
              value={neighborhood} 
              onChange={(e) => setNeighborhood(e.target.value)} 
              placeholder="Ex: Jardins, Meireles, Lourdes..." 
              className={cn(
                "w-full px-5 py-3.5 bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
                errors.neighborhood ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
              )}
            />
            <FormError message={errors.neighborhood} />
          </div>
        </div>

        <div className="space-y-4">
          {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Forma de Atendimento <span className="text-brand-terracotta">*</span></label>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(Object.entries(SERVICE_MODES) as [keyof typeof SERVICE_MODES, typeof SERVICE_MODES.studio][]).map(([key, info]) => {
              const Icon = key === 'studio' ? Building2 : key === 'home' ? Home : Briefcase;
              const isSelected = serviceMode === key;
              
              return (
                <button 
                  key={key}
                  type="button"
                  onClick={() => setServiceMode(key)}
                  className={cn(
                    "p-6 rounded-[32px] border transition-all flex flex-col items-start gap-4 text-left group relative overflow-hidden",
                    isSelected 
                      ? 'border-brand-ink bg-brand-linen text-brand-ink shadow-md' 
                      : 'border-brand-mist bg-brand-white text-brand-stone hover:border-brand-stone'
                  )}
                >
                  {isSelected && (
                    <motion.div 
                      layoutId="active-bg"
                      className="absolute inset-0 bg-brand-ink/5"
                    />
                  )}
                  
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shrink-0",
                    isSelected ? "bg-brand-ink text-white" : "bg-brand-parchment text-brand-stone group-hover:bg-brand-linen"
                  )}>
                    <Icon size={24} />
                  </div>
                  
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest block mb-1">{info.label}</span>
                    <p className="text-[10px] font-light leading-relaxed opacity-70 italic">{info.description}</p>
                  </div>

                  {isSelected && (
                    <div className="absolute top-4 right-4">
                      <div className="w-5 h-5 bg-brand-ink text-white rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Studio Address fields if applicable */}
        {(serviceMode === 'studio' || serviceMode === 'hybrid') && studioAddress && setStudioAddress && (
          <div className="space-y-8 pt-8 border-t border-brand-mist">
            <div className="flex items-center gap-3 text-brand-ink">
              <Building2 size={20} className="text-brand-terracotta" />
              <h3 className="font-medium text-lg">Localização do seu espaço</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Rua</label>
                <input 
                  type="text"
                  value={studioAddress.street} 
                  onChange={(e) => setStudioAddress({...studioAddress, street: e.target.value})} 
                  placeholder="Ex: Rua Silva Jatahy" 
                  className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Número</label>
                <input 
                  type="text"
                  value={studioAddress.number} 
                  onChange={(e) => setStudioAddress({...studioAddress, number: e.target.value})} 
                  placeholder="Ex: 123" 
                  className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Complemento</label>
                <input 
                  type="text"
                  value={studioAddress.complement} 
                  onChange={(e) => setStudioAddress({...studioAddress, complement: e.target.value})} 
                  placeholder="Ex: Sala 402" 
                  className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Bairro do Estúdio</label>
                <input 
                  type="text"
                  value={studioAddress.neighborhood} 
                  onChange={(e) => setStudioAddress({...studioAddress, neighborhood: e.target.value})} 
                  placeholder="Ex: Meireles" 
                  className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Cidade do Estúdio</label>
                <input 
                  type="text"
                  value={studioAddress.city} 
                  onChange={(e) => setStudioAddress({...studioAddress, city: e.target.value})} 
                  placeholder="Ex: Fortaleza" 
                  className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Ponto de Referência</label>
                <input 
                  type="text"
                  value={studioAddress.reference} 
                  onChange={(e) => setStudioAddress({...studioAddress, reference: e.target.value})} 
                  placeholder="Ex: Próximo ao Shopping Del Paseo" 
                  className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                />
              </div>

              <div className="md:col-span-2 space-y-6 bg-brand-parchment/30 p-8 rounded-[32px] border border-brand-mist/50">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">Estrutura e Diferenciais do Local</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center h-5">
                        <input
                          type="checkbox"
                          checked={studioAddress.hasParking}
                          onChange={(e) => setStudioAddress({...studioAddress, hasParking: e.target.checked})}
                          className="w-5 h-5 rounded-md border-brand-mist text-brand-terracotta focus:ring-brand-terracotta cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink group-hover:text-brand-terracotta transition-colors">Estacionamento</span>
                        <p className="text-[10px] text-brand-stone font-light leading-snug italic">Possui local para parar no estúdio ou rua?</p>
                      </div>
                    </label>
                    {studioAddress.hasParking && (
                      <input 
                        type="text"
                        value={studioAddress.parkingInfo || ''}
                        onChange={(e) => setStudioAddress({...studioAddress, parkingInfo: e.target.value})}
                        placeholder="Ex: No prédio / zona azul na porta"
                        className="w-full px-4 py-2.5 bg-brand-white border border-brand-mist rounded-xl text-[11px] font-light outline-none"
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center h-5">
                        <input
                          type="checkbox"
                          checked={studioAddress.hasAccessibility}
                          onChange={(e) => setStudioAddress({...studioAddress, hasAccessibility: e.target.checked})}
                          className="w-5 h-5 rounded-md border-brand-mist text-brand-terracotta focus:ring-brand-terracotta cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink group-hover:text-brand-terracotta transition-colors">Acessível</span>
                        <p className="text-[10px] text-brand-stone font-light leading-snug italic">Rampas, elevadores, térreo?</p>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-4 md:col-span-2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center h-5">
                        <input
                          type="checkbox"
                          checked={studioAddress.isSafeLocation}
                          onChange={(e) => setStudioAddress({...studioAddress, isSafeLocation: e.target.checked})}
                          className="w-5 h-5 rounded-md border-brand-mist text-brand-terracotta focus:ring-brand-terracotta cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink group-hover:text-brand-terracotta transition-colors">Localização Segura</span>
                        <p className="text-[10px] text-brand-stone font-light leading-snug italic">Prédio comercial, portaria 24h?</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4 md:col-span-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Privacidade do Endereço (Sempre Público)</label>
                <div className="p-5 rounded-[24px] border border-brand-ink bg-brand-linen text-brand-ink">
                   <p className="text-[10px] font-bold uppercase tracking-widest">Público Total</p>
                   <p className="text-[9px] font-light leading-tight opacity-60">Seu endereço completo aparecerá no seu perfil para facilitar a reserva.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Home service fields if applicable */}
        {(serviceMode === 'home' || serviceMode === 'hybrid') && serviceAreas && setServiceAreas && pricingStrategy && setPricingStrategy && (
          <div className="space-y-8 pt-8 border-t border-brand-mist">
            <div className="flex items-center gap-3 text-brand-ink">
              <Home size={20} className="text-brand-terracotta" />
              <h3 className="font-medium text-lg">Atendimento em Domicílio</h3>
            </div>
            
            <div className="space-y-6">
              {setServiceAreaType && (
                <div className="space-y-4">
                  <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest">Onde você atende em domicílio?</p>
                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setServiceAreaType('city_wide')}
                      className={cn(
                        "flex-1 py-4 px-6 rounded-2xl border transition-all text-xs font-medium",
                        serviceAreaType === 'city_wide' 
                          ? 'border-brand-ink bg-brand-linen text-brand-ink' 
                          : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'
                      )}
                    >
                      Toda a cidade
                    </button>
                    <button 
                      type="button"
                      onClick={() => setServiceAreaType('specific_neighborhoods')}
                      className={cn(
                        "flex-1 py-4 px-6 rounded-2xl border transition-all text-xs font-medium",
                        serviceAreaType === 'specific_neighborhoods' 
                          ? 'border-brand-ink bg-brand-linen text-brand-ink' 
                          : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'
                      )}
                    >
                      Bairros específicos
                    </button>
                  </div>
                </div>
              )}

              {serviceAreaType === 'specific_neighborhoods' && (
                <div className="space-y-4">
                  <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest">Você cobra o mesmo valor em todos os bairros?</p>
                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setPricingStrategy!('none')}
                      className={cn(
                        "flex-1 py-4 px-6 rounded-2xl border transition-all text-xs font-medium",
                        pricingStrategy === 'none' 
                          ? 'border-brand-ink bg-brand-linen text-brand-ink' 
                          : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'
                      )}
                    >
                      Sim, mesmo valor
                    </button>
                    <button 
                      type="button"
                      onClick={() => setPricingStrategy!('extra')}
                      className={cn(
                        "flex-1 py-4 px-6 rounded-2xl border transition-all text-xs font-medium",
                        pricingStrategy === 'extra' 
                          ? 'border-brand-ink bg-brand-linen text-brand-ink' 
                          : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'
                      )}
                    >
                      Não, varia por região
                    </button>
                  </div>
                </div>
              )}

              {(serviceAreaType === 'specific_neighborhoods' || !setServiceAreaType) && (
                <div className="bg-brand-parchment p-8 rounded-[32px] border border-brand-mist space-y-6">
                  <h4 className="text-[10px] font-medium text-brand-ink uppercase tracking-widest">Configurar Regiões</h4>
                  
                  {setNewAreaName && setNewAreaFee && addArea && (
                    <div className="flex flex-col md:flex-row items-end gap-3">
                      <div className="flex-1 space-y-2 w-full">
                        <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Bairro / Região</label>
                        <input 
                          type="text" 
                          value={newAreaName} 
                          onChange={(e) => setNewAreaName(e.target.value)} 
                          placeholder="Ex: Jardins, Meireles..." 
                          className="w-full px-5 py-3 bg-brand-white border border-brand-mist rounded-xl outline-none text-sm font-light focus:ring-1 focus:ring-brand-ink transition-all" 
                        />
                      </div>
                      {pricingStrategy === 'extra' && (
                        <div className="w-full md:w-48 space-y-2">
                          <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Valor Adicional (R$)</label>
                          <input 
                            type="number" 
                            value={newAreaFee} 
                            onChange={(e) => setNewAreaFee(e.target.value)} 
                            placeholder="0,00" 
                            className="w-full px-5 py-3 bg-brand-white border border-brand-mist rounded-xl outline-none text-sm font-light focus:ring-1 focus:ring-brand-ink transition-all" 
                          />
                        </div>
                      )}
                      <button 
                        type="button"
                        onClick={addArea} 
                        className="bg-brand-ink text-brand-white px-8 h-[46px] rounded-xl text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-sm"
                      >
                        Adicionar
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    {serviceAreas.map((area, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-brand-white p-4 rounded-2xl border border-brand-mist">
                        <span className="text-sm font-medium text-brand-ink">{area.name}</span>
                        <div className="flex items-center gap-4">
                          {pricingStrategy === 'extra' && area.fee > 0 && formatCurrency && (
                            <span className="text-xs font-medium text-brand-terracotta">
                              + {formatCurrency(area.fee)}
                            </span>
                          )}
                          {removeArea && (
                            <button 
                              type="button"
                              onClick={() => removeArea(idx)} 
                              className="text-brand-stone hover:text-brand-terracotta transition-all"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
