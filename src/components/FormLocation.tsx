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
    <div className="w-full space-y-6">
      {(title || subtitle) && (
        <div className="text-center space-y-3">
          <div className="w-12 h-12 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-brand-mist">
            {serviceMode === 'home' ? <Home size={24} /> : serviceMode === 'studio' ? <Building2 size={24} /> : <Briefcase size={24} />}
          </div>
          {title && <h1 className="text-2xl sm:text-3xl font-serif font-normal text-brand-ink">{title}</h1>}
          {subtitle && <p className="text-[11px] sm:text-sm text-brand-stone font-light">{subtitle}</p>}
        </div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            {showLabels && (
              <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">
                Cidade <span className="text-brand-terracotta">*</span>
              </label>
            )}
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-stone/40" size={16} />
              <input 
                type="text" 
                value={city} 
                onChange={(e) => setCity(e.target.value)} 
                placeholder="Ex: São Paulo, SP" 
                className={cn(
                  "w-full pl-10 pr-4 py-2.5 bg-brand-parchment/60 border rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50",
                  errors.city ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist/50"
                )}
              />
            </div>
            <FormError message={errors.city} />
          </div>
          <div className="space-y-1.5">
            {showLabels && (
              <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">
                Bairro
              </label>
            )}
            <input 
              type="text" 
              value={neighborhood} 
              onChange={(e) => setNeighborhood(e.target.value)} 
              placeholder="Ex: Jardins, Meireles, Lourdes..." 
              className={cn(
                "w-full px-4 py-2.5 bg-brand-parchment/60 border rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50",
                errors.neighborhood ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist/50"
              )}
            />
            <FormError message={errors.neighborhood} />
          </div>
        </div>

        <div className="space-y-4">
          {showLabels && <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">Forma de Atendimento <span className="text-brand-terracotta">*</span></label>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.entries(SERVICE_MODES) as [keyof typeof SERVICE_MODES, typeof SERVICE_MODES.studio][]).map(([key, info]) => {
              const Icon = key === 'studio' ? Building2 : key === 'home' ? Home : Briefcase;
              const isSelected = serviceMode === key;
              
              return (
                <button 
                  key={key}
                  type="button"
                  onClick={() => setServiceMode(key)}
                  className={cn(
                    "p-3 rounded-2xl border transition-all flex flex-row sm:flex-col items-center sm:items-start gap-3 text-left group relative overflow-hidden",
                    isSelected 
                      ? 'border-brand-ink/30 bg-brand-linen/80 text-brand-ink shadow-sm ring-1 ring-brand-ink/10' 
                      : 'border-brand-mist/50 bg-brand-white text-brand-stone hover:border-brand-stone/50'
                  )}
                >
                  {isSelected && (
                    <motion.div 
                      layoutId="active-bg"
                      className="absolute inset-0 bg-brand-ink/5"
                    />
                  )}
                  
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0",
                    isSelected ? "bg-brand-ink text-white shadow-sm" : "bg-brand-parchment text-brand-stone group-hover:bg-brand-linen"
                  )}>
                    <Icon size={16} />
                  </div>
                  
                  <div className="flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest block sm:mb-1">{info.label}</span>
                    <p className="text-[9px] font-light leading-relaxed opacity-70 italic hidden sm:block">{info.description}</p>
                  </div>

                  {isSelected && (
                    <div className="absolute top-3 right-3 hidden sm:block">
                      <div className="w-4 h-4 bg-brand-ink text-white rounded-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
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
          <div className="space-y-6 pt-6 border-t border-brand-mist/30">
            <div className="flex items-center gap-3 text-brand-ink mb-2">
              <Building2 size={18} className="text-brand-terracotta" />
              <h3 className="font-serif text-lg">Localização do seu espaço</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1 md:col-span-3">
                <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">Rua</label>
                <input 
                  type="text"
                  value={studioAddress.street} 
                  onChange={(e) => setStudioAddress({...studioAddress, street: e.target.value})} 
                  placeholder="Ex: Rua Silva Jatahy" 
                  className="w-full px-4 py-2.5 bg-brand-parchment/60 border border-brand-mist/50 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50"
                />
              </div>
              
              <div className="space-y-1 md:col-span-1">
                <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">Número</label>
                <input 
                  type="text"
                  value={studioAddress.number} 
                  onChange={(e) => setStudioAddress({...studioAddress, number: e.target.value})} 
                  placeholder="Ex: 123" 
                  className="w-full px-4 py-2.5 bg-brand-parchment/60 border border-brand-mist/50 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50"
                />
              </div>
              
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">Bairro do Estúdio</label>
                <input 
                  type="text"
                  value={studioAddress.neighborhood} 
                  onChange={(e) => setStudioAddress({...studioAddress, neighborhood: e.target.value})} 
                  placeholder="Ex: Meireles" 
                  className="w-full px-4 py-2.5 bg-brand-parchment/60 border border-brand-mist/50 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">Cidade do Estúdio</label>
                <input 
                  type="text"
                  value={studioAddress.city} 
                  onChange={(e) => setStudioAddress({...studioAddress, city: e.target.value})} 
                  placeholder="Ex: Fortaleza" 
                  className="w-full px-4 py-2.5 bg-brand-parchment/60 border border-brand-mist/50 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50"
                />
              </div>

              <div className="space-y-1 md:col-span-4">
                <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">Complemento (opcional)</label>
                <input 
                  type="text"
                  value={studioAddress.complement} 
                  onChange={(e) => setStudioAddress({...studioAddress, complement: e.target.value})} 
                  placeholder="Ex: Sala 402" 
                  className="w-full px-4 py-2.5 bg-brand-parchment/60 border border-brand-mist/50 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50"
                />
              </div>
              
              <div className="space-y-1 md:col-span-4">
                <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">Ponto de Referência</label>
                <input 
                  type="text"
                  value={studioAddress.reference} 
                  onChange={(e) => setStudioAddress({...studioAddress, reference: e.target.value})} 
                  placeholder="Ex: Próximo ao Shopping Del Paseo" 
                  className="w-full px-4 py-2.5 bg-brand-parchment/60 border border-brand-mist/50 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50"
                />
              </div>

              <div className="md:col-span-4 space-y-4 bg-brand-parchment/30 p-4 md:p-5 rounded-2xl border border-brand-mist/50">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">Estrutura e Diferenciais do Local</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center h-5 mt-0.5">
                        <input
                          type="checkbox"
                          checked={studioAddress.hasParking}
                          onChange={(e) => setStudioAddress({...studioAddress, hasParking: e.target.checked})}
                          className="peer appearance-none w-4 h-4 rounded border border-brand-mist checked:bg-brand-terracotta checked:border-brand-terracotta transition-all cursor-pointer"
                        />
                        <div className="absolute text-brand-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-[3px] top-[3px]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink group-hover:text-brand-terracotta transition-colors">Estacionamento</span>
                        <p className="text-[9px] text-brand-stone font-light leading-snug italic mt-0.5">Possui local para parar no estúdio ou rua?</p>
                      </div>
                    </label>
                    {studioAddress.hasParking && (
                      <input 
                        type="text"
                        value={studioAddress.parkingInfo || ''}
                        onChange={(e) => setStudioAddress({...studioAddress, parkingInfo: e.target.value})}
                        placeholder="Ex: No prédio / zona azul"
                        className="w-full px-4 py-2 bg-brand-white/80 border border-brand-mist/50 rounded-lg text-xs font-light outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all placeholder:text-brand-stone/50 ml-7 max-w-[calc(100%-1.75rem)]"
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center h-5 mt-0.5">
                        <input
                          type="checkbox"
                          checked={studioAddress.hasAccessibility}
                          onChange={(e) => setStudioAddress({...studioAddress, hasAccessibility: e.target.checked})}
                          className="peer appearance-none w-4 h-4 rounded border border-brand-mist checked:bg-brand-terracotta checked:border-brand-terracotta transition-all cursor-pointer"
                        />
                        <div className="absolute text-brand-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-[3px] top-[3px]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink group-hover:text-brand-terracotta transition-colors">Acessível</span>
                        <p className="text-[9px] text-brand-stone font-light leading-snug italic mt-0.5">Rampas, elevadores, térreo?</p>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-4 md:col-span-2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center h-5 mt-0.5">
                        <input
                          type="checkbox"
                          checked={studioAddress.isSafeLocation}
                          onChange={(e) => setStudioAddress({...studioAddress, isSafeLocation: e.target.checked})}
                          className="peer appearance-none w-4 h-4 rounded border border-brand-mist checked:bg-brand-terracotta checked:border-brand-terracotta transition-all cursor-pointer"
                        />
                        <div className="absolute text-brand-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-[3px] top-[3px]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink group-hover:text-brand-terracotta transition-colors">Localização Segura</span>
                        <p className="text-[9px] text-brand-stone font-light leading-snug italic mt-0.5">Prédio comercial, portaria 24h?</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-3 md:col-span-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Privacidade do Endereço (Sempre Público)</label>
                <div className="p-4 rounded-xl border border-brand-mist bg-brand-linen/80 text-brand-ink">
                   <p className="text-[10px] font-bold uppercase tracking-widest">Público Total</p>
                   <p className="text-[9px] font-light leading-tight opacity-70 mt-1">Seu endereço completo aparecerá no seu perfil para facilitar a reserva.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Home service fields if applicable */}
        {(serviceMode === 'home' || serviceMode === 'hybrid') && serviceAreas && setServiceAreas && pricingStrategy && setPricingStrategy && (
          <div className="space-y-6 pt-6 border-t border-brand-mist/30">
            <div className="flex items-center gap-3 text-brand-ink mb-2">
              <Home size={18} className="text-brand-terracotta" />
              <h3 className="font-serif text-lg">Atendimento em Domicílio</h3>
            </div>
            
            <div className="space-y-5">
              {setServiceAreaType && (
                <div className="space-y-4">
                  <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest">Onde você atende em domicílio?</p>
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setServiceAreaType('city_wide')}
                      className={cn(
                        "flex-1 py-2.5 px-4 rounded-lg border transition-all text-[10px] font-bold uppercase tracking-widest",
                        serviceAreaType === 'city_wide' 
                          ? 'border-brand-ink bg-brand-ink text-brand-white shadow-sm' 
                          : 'border-brand-mist/50 bg-transparent text-brand-stone hover:border-brand-stone/50 hover:bg-brand-parchment/50'
                      )}
                    >
                      Toda a cidade
                    </button>
                    <button 
                      type="button"
                      onClick={() => setServiceAreaType('specific_neighborhoods')}
                      className={cn(
                        "flex-1 py-2.5 px-4 rounded-lg border transition-all text-[10px] font-bold uppercase tracking-widest",
                        serviceAreaType === 'specific_neighborhoods' 
                          ? 'border-brand-ink bg-brand-ink text-brand-white shadow-sm' 
                          : 'border-brand-mist/50 bg-transparent text-brand-stone hover:border-brand-stone/50 hover:bg-brand-parchment/50'
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
                        "flex-1 py-3 px-4 rounded-xl border transition-all text-[11px] font-bold uppercase tracking-widest",
                        pricingStrategy === 'none' 
                          ? 'border-brand-ink bg-brand-ink text-brand-white shadow-sm' 
                          : 'border-brand-mist bg-transparent text-brand-stone hover:border-brand-stone'
                      )}
                    >
                      Sim, mesmo valor
                    </button>
                    <button 
                      type="button"
                      onClick={() => setPricingStrategy!('extra')}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-xl border transition-all text-[11px] font-bold uppercase tracking-widest",
                        pricingStrategy === 'extra' 
                          ? 'border-brand-ink bg-brand-ink text-brand-white shadow-sm' 
                          : 'border-brand-mist bg-transparent text-brand-stone hover:border-brand-stone'
                      )}
                    >
                      Não, varia por região
                    </button>
                  </div>
                </div>
              )}

              {(serviceAreaType === 'specific_neighborhoods' || !setServiceAreaType) && (
                <div className="bg-brand-parchment p-5 md:p-6 rounded-[24px] border border-brand-mist space-y-5">
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
