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
        <div className="space-y-1.5 mb-2">
          {title && <h1 className="text-xl sm:text-2xl font-serif font-normal text-brand-ink">{title}</h1>}
          {subtitle && <p className="text-[11px] sm:text-sm text-brand-stone/80 font-light">{subtitle}</p>}
        </div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            {showLabels && (
              <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-0.5 block">
                Cidade <span className="text-brand-terracotta">*</span>
              </label>
            )}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-stone/40" size={14} />
              <input 
                type="text" 
                value={city} 
                onChange={(e) => setCity(e.target.value)} 
                placeholder="Ex: São Paulo, SP" 
                className={cn(
                  "w-full pl-9 pr-3 py-2 bg-brand-white border rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50",
                  errors.city ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist/60"
                )}
              />
            </div>
            <FormError message={errors.city} />
          </div>
          <div className="space-y-1">
            {showLabels && (
              <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-0.5 block">
                Bairro
              </label>
            )}
            <input 
              type="text" 
              value={neighborhood} 
              onChange={(e) => setNeighborhood(e.target.value)} 
              placeholder="Ex: Jardins, Meireles, Lourdes..." 
              className={cn(
                "w-full px-3 py-2 bg-brand-white border rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50",
                errors.neighborhood ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist/60"
              )}
            />
            <FormError message={errors.neighborhood} />
          </div>
        </div>

        <div className="space-y-2">
          {showLabels && <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Forma de Atendimento <span className="text-brand-terracotta">*</span></label>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.entries(SERVICE_MODES) as [keyof typeof SERVICE_MODES, typeof SERVICE_MODES.studio][]).map(([key, info]) => {
              const Icon = key === 'studio' ? Building2 : key === 'home' ? Home : Briefcase;
              const isSelected = serviceMode === key;
              
              return (
                <button 
                  key={key}
                  type="button"
                  onClick={() => setServiceMode(key)}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all duration-300 ease-out flex flex-row items-center gap-3 text-left group relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/50",
                    isSelected 
                      ? 'border-brand-ink/30 bg-[#FAF9F8] text-brand-ink ring-1 ring-brand-ink/5' 
                      : 'border-brand-mist/50 bg-white text-brand-stone hover:border-brand-stone/30 hover:bg-brand-mist/10'
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0",
                    isSelected ? "bg-brand-ink text-white" : "bg-brand-parchment text-brand-stone/70 group-hover:bg-brand-linen group-hover:text-brand-stone"
                  )}>
                    <Icon size={14} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest block truncate">{info.label}</span>
                    <p className="text-[9px] font-light leading-snug opacity-70 italic truncate mt-0.5">{info.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Studio Address fields if applicable */}
        {(serviceMode === 'studio' || serviceMode === 'hybrid') && studioAddress && setStudioAddress && (
          <div className="space-y-4 pt-4 mt-2 border-t border-brand-mist/40">
            <div className="flex items-center gap-2 text-brand-ink mb-1">
              <Building2 size={14} className="text-brand-terracotta" />
              <h3 className="font-serif text-[15px]">Localização do estúdio</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1 md:col-span-3">
                <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Rua</label>
                <input 
                  type="text"
                  value={studioAddress.street} 
                  onChange={(e) => setStudioAddress({...studioAddress, street: e.target.value})} 
                  placeholder="Ex: Rua Silva Jatahy" 
                  className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/40"
                />
              </div>
              
              <div className="space-y-1 md:col-span-1">
                <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Número</label>
                <input 
                  type="text"
                  value={studioAddress.number} 
                  onChange={(e) => setStudioAddress({...studioAddress, number: e.target.value})} 
                  placeholder="Ex: 123" 
                  className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/40"
                />
              </div>
              
              <div className="space-y-1 md:col-span-2">
                <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Bairro do Estúdio</label>
                <input 
                  type="text"
                  value={studioAddress.neighborhood} 
                  onChange={(e) => setStudioAddress({...studioAddress, neighborhood: e.target.value})} 
                  placeholder="Ex: Meireles" 
                  className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/40"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Cidade do Estúdio</label>
                <input 
                  type="text"
                  value={studioAddress.city} 
                  onChange={(e) => setStudioAddress({...studioAddress, city: e.target.value})} 
                  placeholder="Ex: Fortaleza" 
                  className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/40"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Complemento (opcional)</label>
                <input 
                  type="text"
                  value={studioAddress.complement} 
                  onChange={(e) => setStudioAddress({...studioAddress, complement: e.target.value})} 
                  placeholder="Ex: Sala 402" 
                  className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/40"
                />
              </div>
              
              <div className="space-y-1 md:col-span-2">
                <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Ponto de Referência</label>
                <input 
                  type="text"
                  value={studioAddress.reference} 
                  onChange={(e) => setStudioAddress({...studioAddress, reference: e.target.value})} 
                  placeholder="Ex: Próximo ao Shopping Del Paseo" 
                  className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/40"
                />
              </div>

              <div className="md:col-span-4 mt-2 bg-[#FAF9F8] p-3 rounded-xl border border-brand-mist/40">
                <h4 className="text-[9px] font-bold uppercase tracking-widest text-brand-ink mb-3">Estrutura e Diferenciais</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer group">
                      <div className="relative flex items-center h-4 mt-0.5">
                        <input
                          type="checkbox"
                          checked={studioAddress.hasParking}
                          onChange={(e) => setStudioAddress({...studioAddress, hasParking: e.target.checked})}
                          className="peer appearance-none w-3.5 h-3.5 rounded-sm border border-brand-mist checked:bg-brand-terracotta checked:border-brand-terracotta transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-terracotta/50 focus-visible:ring-offset-1"
                        />
                        <div className="absolute text-brand-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-[2px] top-[2px]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-ink group-hover:text-brand-terracotta transition-colors">Estacionamento</span>
                        <p className="text-[9px] text-brand-stone font-light leading-tight italic">Possui local para parar?</p>
                      </div>
                    </label>
                    {studioAddress.hasParking && (
                      <input 
                        type="text"
                        value={studioAddress.parkingInfo || ''}
                        onChange={(e) => setStudioAddress({...studioAddress, parkingInfo: e.target.value})}
                        placeholder="Ex: No prédio / zona azul"
                        className="w-full px-2.5 py-1.5 bg-brand-white border border-brand-mist/40 rounded-md text-[11px] font-light outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all placeholder:text-brand-stone/40 ml-5 max-w-[calc(100%-1.25rem)]"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer group">
                      <div className="relative flex items-center h-4 mt-0.5">
                        <input
                          type="checkbox"
                          checked={studioAddress.hasAccessibility}
                          onChange={(e) => setStudioAddress({...studioAddress, hasAccessibility: e.target.checked})}
                          className="peer appearance-none w-3.5 h-3.5 rounded-sm border border-brand-mist checked:bg-brand-terracotta checked:border-brand-terracotta transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-terracotta/50 focus-visible:ring-offset-1"
                        />
                        <div className="absolute text-brand-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-[2px] top-[2px]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-ink group-hover:text-brand-terracotta transition-colors">Acessível</span>
                        <p className="text-[9px] text-brand-stone font-light leading-tight italic">Rampas, elevadores, térreo?</p>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer group">
                      <div className="relative flex items-center h-4 mt-0.5">
                        <input
                          type="checkbox"
                          checked={studioAddress.isSafeLocation}
                          onChange={(e) => setStudioAddress({...studioAddress, isSafeLocation: e.target.checked})}
                          className="peer appearance-none w-3.5 h-3.5 rounded-sm border border-brand-mist checked:bg-brand-terracotta checked:border-brand-terracotta transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-terracotta/50 focus-visible:ring-offset-1"
                        />
                        <div className="absolute text-brand-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-[2px] top-[2px]">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-ink group-hover:text-brand-terracotta transition-colors">Local Seguro</span>
                        <p className="text-[9px] text-brand-stone font-light leading-tight italic">Comercial, portaria 24h?</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Home service fields if applicable */}
        {(serviceMode === 'home' || serviceMode === 'hybrid') && serviceAreas && setServiceAreas && pricingStrategy && setPricingStrategy && (
          <div className="space-y-4 pt-4 mt-2 border-t border-brand-mist/40">
            <div className="flex items-center gap-2 text-brand-ink mb-1">
              <Home size={14} className="text-brand-terracotta" />
              <h3 className="font-serif text-[15px]">Atendimento em Domicílio</h3>
            </div>
            
            <div className="space-y-4">
              {setServiceAreaType && (
                <div className="space-y-2">
                  <p className="text-[9px] font-medium text-brand-stone uppercase tracking-widest">Onde você atende em domicílio?</p>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setServiceAreaType('city_wide')}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg border transition-all duration-300 text-[10px] font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/50",
                        serviceAreaType === 'city_wide' 
                          ? 'border-brand-ink/30 bg-[#FAF9F8] text-brand-ink' 
                          : 'border-brand-mist/50 bg-white text-brand-stone hover:border-brand-stone/30 hover:bg-brand-mist/10'
                      )}
                    >
                      Toda a cidade
                    </button>
                    <button 
                      type="button"
                      onClick={() => setServiceAreaType('specific_neighborhoods')}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg border transition-all duration-300 text-[10px] font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/50",
                        serviceAreaType === 'specific_neighborhoods' 
                          ? 'border-brand-ink/30 bg-[#FAF9F8] text-brand-ink' 
                          : 'border-brand-mist/50 bg-white text-brand-stone hover:border-brand-stone/30 hover:bg-brand-mist/10'
                      )}
                    >
                      Bairros específicos
                    </button>
                  </div>
                </div>
              )}

              {serviceAreaType === 'specific_neighborhoods' && (
                <div className="space-y-2">
                  <p className="text-[9px] font-medium text-brand-stone uppercase tracking-widest">Cobra o mesmo valor em todos?</p>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setPricingStrategy!('none')}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg border transition-all text-[10px] font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/50",
                        pricingStrategy === 'none' 
                          ? 'border-brand-ink/30 bg-[#FAF9F8] text-brand-ink' 
                          : 'border-brand-mist/50 bg-white text-brand-stone hover:border-brand-stone/30 hover:bg-brand-mist/10'
                      )}
                    >
                      Sim, mesmo valor
                    </button>
                    <button 
                      type="button"
                      onClick={() => setPricingStrategy!('extra')}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg border transition-all text-[10px] font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/50",
                        pricingStrategy === 'extra' 
                          ? 'border-brand-ink/30 bg-[#FAF9F8] text-brand-ink' 
                          : 'border-brand-mist/50 bg-white text-brand-stone hover:border-brand-stone/30 hover:bg-brand-mist/10'
                      )}
                    >
                      Não, varia por região
                    </button>
                  </div>
                </div>
              )}

              {(serviceAreaType === 'specific_neighborhoods' || !setServiceAreaType) && (
                <div className="bg-[#FAF9F8] p-4 rounded-xl border border-brand-mist/40 space-y-4">
                  <h4 className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Configurar Regiões</h4>
                  
                  {setNewAreaName && setNewAreaFee && addArea && (
                    <div className="flex flex-col sm:flex-row items-end gap-2">
                      <div className="flex-1 space-y-1 w-full">
                        <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1">Bairro / Região</label>
                        <input 
                          type="text" 
                          value={newAreaName} 
                          onChange={(e) => setNewAreaName(e.target.value)} 
                          placeholder="Ex: Jardins, Meireles..." 
                          className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none text-[13px] font-light focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all"
                        />
                      </div>
                      {pricingStrategy === 'extra' && (
                        <div className="w-full sm:w-32 space-y-1">
                          <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1">Valor Extra (R$)</label>
                          <input 
                            type="number" 
                            value={newAreaFee} 
                            onChange={(e) => setNewAreaFee(e.target.value)} 
                            placeholder="0,00" 
                            className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none text-[13px] font-light focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all" 
                          />
                        </div>
                      )}
                      <button 
                        type="button"
                        onClick={addArea} 
                        className="bg-brand-ink text-brand-white px-5 h-[38px] rounded-lg text-[10px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all mt-1 sm:mt-0 w-full sm:w-auto"
                      >
                        Adicionar
                      </button>
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    {serviceAreas.map((area, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-brand-white px-4 py-2.5 rounded-lg border border-brand-mist/60">
                        <span className="text-[13px] font-normal text-brand-ink">{area.name}</span>
                        <div className="flex items-center gap-4">
                          {pricingStrategy === 'extra' && area.fee > 0 && formatCurrency && (
                            <span className="text-[11px] font-medium text-brand-terracotta">
                              + {formatCurrency(area.fee)}
                            </span>
                          )}
                          {removeArea && (
                            <button 
                              type="button"
                              onClick={() => removeArea(idx)} 
                              className="text-brand-stone hover:text-brand-terracotta transition-all opacity-80 hover:opacity-100"
                            >
                              <X size={14} />
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
