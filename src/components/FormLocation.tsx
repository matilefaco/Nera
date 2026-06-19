import React from 'react';
import { MapPin, Building2, Home, Briefcase, X, MapPin as MapPinIcon, Lock } from 'lucide-react';
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
    privacyMode?: string;
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
  travelFeeMode?: 'none' | 'fixed';
  setTravelFeeMode?: (val: 'none' | 'fixed') => void;
  fixedTravelFee?: string;
  setFixedTravelFee?: (val: string) => void;
  addArea?: () => void;
  removeArea?: (idx: number) => void;
  formatCurrency?: (val: number) => string;
  errors?: Record<string, string>;

  title?: string;
  subtitle?: string;
  showLabels?: boolean;
  minimalOnboarding?: boolean;
}

const MAJOR_CITIES = [
  "São Paulo, SP",
  "Rio de Janeiro, RJ",
  "Belo Horizonte, MG",
  "Fortaleza, CE",
  "Salvador, BA",
  "Recife, PE",
  "Brasília, DF",
  "Curitiba, PR",
  "Porto Alegre, RS",
  "Goiânia, GO",
  "Manaus, AM",
  "Belém, PA",
  "Florianópolis, SC",
  "Vitória, ES",
  "Natal, RN",
  "João Pessoa, PB",
  "Maceió, AL",
  "São Luís, MA",
  "Teresina, PI",
  "Cuiabá, MT",
  "Campo Grande, MS",
  "Aracaju, SE",
  "Ribeirão Preto, SP",
  "Campinas, SP",
  "Santos, SP",
  "Niterói, RJ",
];

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
  travelFeeMode,
  setTravelFeeMode,
  fixedTravelFee,
  setFixedTravelFee,
  addArea,
  removeArea,
  formatCurrency,
  errors = {},
  title,
  subtitle,
  showLabels = true,
  minimalOnboarding = false
}: FormLocationProps) => {
  const [showAdvancedLocation, setShowAdvancedLocation] = React.useState(() => {
    return !!(studioAddress && (
      (studioAddress.city && studioAddress.city.trim() !== '' && studioAddress.city !== city) ||
      (studioAddress.neighborhood && studioAddress.neighborhood.trim() !== '' && studioAddress.neighborhood !== neighborhood)
    ));
  });

  const [showCitySuggestions, setShowCitySuggestions] = React.useState(false);
  const cityInputRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cityInputRef.current && !cityInputRef.current.contains(event.target as Node)) {
        setShowCitySuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedCityInput = city ? city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
  const filteredCities = normalizedCityInput 
    ? MAJOR_CITIES.filter(c => c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalizedCityInput) && c !== city)
    : MAJOR_CITIES;

  return (
    <div className="w-full space-y-6">
      {(title || subtitle) && (
        <div className="space-y-1 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-7 sm:h-7 bg-brand-mist/20 text-brand-stone rounded-full flex items-center justify-center border border-brand-mist/40 shrink-0">
              <MapPin size={12} className="sm:w-[12px] sm:h-[12px] w-[14px] h-[14px]" />
            </div>
            {title && <h2 className="text-[12px] font-bold text-brand-ink uppercase tracking-wider">{title}</h2>}
          </div>
          {subtitle && <p className="text-[11px] text-brand-stone/80 font-light pl-[40px] sm:pl-[36px] leading-relaxed max-w-sm">{subtitle}</p>}
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <h3 className="text-[11px] font-bold text-brand-ink uppercase tracking-widest text-left">Região principal da sua vitrine</h3>
            <p className="text-[11px] text-brand-stone font-light leading-relaxed">
              Essa região aparece na sua vitrine para ajudar clientes a entenderem onde você atende.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              {showLabels && (
                <label className="text-[9px] font-medium text-brand-stone uppercase tracking-widest ml-1 mb-0.5 block">
                  Cidade principal <span className="text-brand-terracotta">*</span>
                </label>
              )}
              <div className="relative" ref={cityInputRef}>
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-stone/40" size={14} />
                <input 
                  type="text" 
                  value={city} 
                  onChange={(e) => {
                    setCity(e.target.value);
                    setShowCitySuggestions(true);
                  }}
                  onFocus={() => {
                    if (filteredCities.length > 0) setShowCitySuggestions(true);
                  }}
                  placeholder="Ex: São Paulo, SP" 
                  className={cn(
                    "w-full pl-9 pr-3 py-2.5 bg-brand-white border rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50",
                    errors.city ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist/60"
                  )}
                />
                
                <AnimatePresence>
                  {showCitySuggestions && filteredCities.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute z-10 w-full mt-1 bg-white border border-brand-mist/60 rounded-lg shadow-lg overflow-hidden"
                    >
                      <div className="max-h-48 overflow-y-auto scrollbar-thin">
                        {filteredCities.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setCity(c);
                              setShowCitySuggestions(false);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm font-light text-brand-ink hover:bg-brand-linen/50 transition-colors border-b border-brand-mist/20 last:border-0"
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <FormError message={errors.city} />
            </div>

            <div className="space-y-1">
              {showLabels && (
                <label className="text-[9px] font-medium text-brand-stone uppercase tracking-widest ml-1 mb-0.5 block">
                  Bairro principal <span className="text-brand-terracotta">*</span>
                </label>
              )}
              <input 
                type="text" 
                value={neighborhood} 
                onChange={(e) => setNeighborhood(e.target.value)} 
                placeholder="Ex: Jardins, Meireles, Lourdes..." 
                className={cn(
                  "w-full px-3 py-2.5 bg-brand-white border rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50",
                  errors.neighborhood ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist/60"
                )}
              />
              <FormError message={errors.neighborhood} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {showLabels && <label className="text-[11px] font-bold text-brand-ink uppercase tracking-widest ml-1 block mt-2">Como você atende? <span className="text-brand-terracotta">*</span></label>}
          <div className="grid grid-cols-1 gap-2.5">
            {(Object.entries(SERVICE_MODES) as [keyof typeof SERVICE_MODES, typeof SERVICE_MODES.studio][]).map(([key, info]) => {
              const Icon = key === 'studio' ? Building2 : key === 'home' ? Home : Briefcase;
              const isSelected = serviceMode === key;
              
              return (
                <button 
                  key={key}
                  type="button"
                  onClick={() => setServiceMode(key)}
                  className={cn(
                    "w-full p-3.5 rounded-2xl border transition-all duration-300 ease-out flex flex-row items-center gap-4 text-left group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/50",
                    isSelected 
                      ? 'border-brand-ink/40 bg-[#FAF9F8] text-brand-ink shadow-[0_2px_10px_rgba(30,30,30,0.04)]' 
                      : 'border-brand-mist/50 bg-white text-brand-stone hover:border-brand-stone/30 hover:bg-brand-mist/10'
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0",
                    isSelected ? "bg-brand-ink text-white" : "bg-brand-parchment text-brand-stone/70 group-hover:bg-brand-linen group-hover:text-brand-stone"
                  )}>
                    <Icon size={16} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-bold uppercase tracking-wider block mb-0.5 whitespace-normal">{info.label}</span>
                    <p className="text-[11px] font-light leading-relaxed opacity-80 whitespace-normal">{info.description}</p>
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
              <div className="flex flex-col">
                <h3 className="font-serif text-[15px]">Endereço do seu espaço</h3>
                <span className="text-[9px] text-brand-stone italic mt-0.5">Esse endereço fica salvo na Nera. Você escolhe abaixo se ele aparece completo na vitrine ou apenas após a reserva confirmada.</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1 md:col-span-3">
                <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Rua <span className="text-brand-terracotta">*</span></label>
                <input 
                  type="text"
                  value={studioAddress.street} 
                  onChange={(e) => setStudioAddress({...studioAddress, street: e.target.value})} 
                  placeholder="Ex: Rua Silva Jatahy" 
                  className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/40"
                />
              </div>
              
              <div className="space-y-1 md:col-span-1">
                <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Número <span className="text-brand-terracotta">*</span></label>
                <input 
                  type="text"
                  value={studioAddress.number} 
                  onChange={(e) => setStudioAddress({...studioAddress, number: e.target.value})} 
                  placeholder="Ex: 123" 
                  className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/40"
                />
              </div>

              <div className="space-y-1 md:col-span-4">
                <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Complemento (opcional)</label>
                <input 
                  type="text"
                  value={studioAddress.complement} 
                  onChange={(e) => setStudioAddress({...studioAddress, complement: e.target.value})} 
                  placeholder="Ex: Sala 402, Loja 12" 
                  className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/40"
                />
              </div>
              
              <div className="md:col-span-4 mt-2 mb-3 py-2.5 px-3 flex items-center justify-between border border-brand-mist/40 bg-white shadow-sm rounded-lg">
                <div className="flex items-center gap-2 text-brand-stone">
                  <MapPinIcon size={12} className="shrink-0 text-brand-terracotta/70" />
                  <p className="text-[11px] font-medium tracking-wide text-brand-ink">
                    {studioAddress.neighborhood || neighborhood || 'Bairro'} • {studioAddress.city || city || 'Cidade'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedLocation(!showAdvancedLocation)}
                  className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta hover:text-brand-ink transition-colors"
                >
                  {showAdvancedLocation ? 'Ocultar' : 'Alterar'}
                </button>
              </div>

              {showAdvancedLocation && (
                <>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Bairro do Estúdio <span className="text-brand-terracotta">*</span></label>
                    <input 
                      type="text"
                      value={studioAddress.neighborhood} 
                      onChange={(e) => setStudioAddress({...studioAddress, neighborhood: e.target.value})} 
                      placeholder="Ex: Meireles" 
                      className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/40"
                    />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Cidade do Estúdio <span className="text-brand-terracotta">*</span></label>
                    <input 
                      type="text"
                      value={studioAddress.city} 
                      onChange={(e) => setStudioAddress({...studioAddress, city: e.target.value})} 
                      placeholder="Ex: Fortaleza" 
                      className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/40"
                    />
                  </div>
                </>
              )}

              {!minimalOnboarding && (
                <div className="space-y-1 md:col-span-4 mt-2">
                  <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 block">Ponto de Referência</label>
                  <input 
                    type="text"
                    value={studioAddress.reference} 
                    onChange={(e) => setStudioAddress({...studioAddress, reference: e.target.value})} 
                    placeholder="Ex: Próximo ao Shopping Del Paseo" 
                    className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/40"
                  />
                </div>
              )}

              <div className="md:col-span-4 mt-2 bg-[#FAF9F8] p-4 rounded-xl border border-brand-mist/40">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand-ink mb-3">Como seu endereço aparece para clientes?</h4>
                
                <div className="flex flex-col gap-3 mb-2">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center h-4 mt-0.5">
                      <input
                        type="radio"
                        name="address_privacy"
                        checked={studioAddress.privacyMode === 'public_full'}
                        onChange={() => setStudioAddress({...studioAddress, privacyMode: 'public_full'})}
                        className="peer appearance-none w-3.5 h-3.5 rounded-full border border-brand-mist checked:border-brand-terracotta transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-terracotta/50"
                      />
                      <div className="absolute text-brand-terracotta opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-[2px] top-[2px] w-1.5 h-1.5 rounded-full bg-brand-terracotta">
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-ink group-hover:text-brand-terracotta transition-colors">Mostrar endereço completo</span>
                      <p className="text-[11px] text-brand-stone font-light leading-tight">Clientes poderão ver o endereço completo na sua vitrine.</p>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center h-4 mt-0.5">
                      <input
                        type="radio"
                        name="address_privacy"
                        checked={studioAddress.privacyMode === 'neighborhood_only'}
                        onChange={() => setStudioAddress({...studioAddress, privacyMode: 'neighborhood_only'})}
                        className="peer appearance-none w-3.5 h-3.5 rounded-full border border-brand-mist checked:border-brand-terracotta transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-terracotta/50"
                      />
                      <div className="absolute text-brand-terracotta opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-[2px] top-[2px] w-1.5 h-1.5 rounded-full bg-brand-terracotta">
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-ink group-hover:text-brand-terracotta transition-colors">Mostrar apenas bairro e cidade</span>
                        <span className="text-brand-stone/80 text-[10px] font-normal flex items-center gap-1 mt-0.5 sm:mt-0">
                          <Lock size={10} className="shrink-0" /> Mais privacidade
                        </span>
                      </div>
                      <p className="text-[11px] text-brand-stone font-light leading-tight">Clientes veem sua região na vitrine. O endereço completo é liberado após a reserva confirmada.</p>
                    </div>
                  </label>
                </div>
                
                {!minimalOnboarding && (
                  <>
                    <div className="w-full h-px bg-brand-mist/40 mb-4" />

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
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Home service fields if applicable */}
        {(serviceMode === 'home' || serviceMode === 'hybrid') && serviceAreas && setServiceAreas && setPricingStrategy && (
          <div className="space-y-4 pt-4 mt-2 border-t border-brand-mist/40">
            <div className="flex items-center gap-2 text-brand-ink mb-1">
              <Home size={14} className="text-brand-terracotta" />
              <div className="flex flex-col">
                <h3 className="font-serif text-[15px]">Atendimento no endereço da cliente</h3>
                <span className="text-[9px] text-brand-stone italic mt-0.5">A cliente informa o endereço dela ao solicitar a reserva. Você analisa antes de confirmar.</span>
              </div>
            </div>
            
            <div className="space-y-4">
              {setServiceAreaType && (
                <div className="space-y-2">
                  <p className="text-[9px] font-medium text-brand-stone uppercase tracking-widest">Área de atendimento</p>
                  <div className="flex gap-2 max-w-sm">
                    <button 
                      type="button"
                      onClick={() => setServiceAreaType('city_wide')}
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded text-[9px] font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/50 transition-all border",
                        serviceAreaType === 'city_wide' 
                          ? 'border-brand-ink/20 bg-[#FAF9F8] text-brand-ink' 
                          : 'border-transparent bg-brand-mist/20 text-brand-stone/80 hover:bg-brand-mist/30'
                      )}
                    >
                      Toda a cidade principal
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setServiceAreaType('specific_neighborhoods');
                        setPricingStrategy('none'); // Default to none since we hide advanced pricing step
                      }}
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded text-[9px] font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/50 transition-all border",
                        serviceAreaType === 'specific_neighborhoods' 
                          ? 'border-brand-ink/20 bg-[#FAF9F8] text-brand-ink' 
                          : 'border-transparent bg-brand-mist/20 text-brand-stone/80 hover:bg-brand-mist/30'
                      )}
                    >
                      Alguns bairros
                    </button>
                  </div>
                </div>
              )}

              {(serviceAreaType === 'specific_neighborhoods' || !setServiceAreaType) && (
                <div className="bg-[#FAF9F8] p-4 rounded-xl border border-brand-mist/40 space-y-4">
                  <h4 className="text-[10px] font-bold text-brand-ink uppercase tracking-widest">Bairros atendidos</h4>
                  
                  {setNewAreaName && addArea && (
                    <div className="flex flex-col sm:flex-row items-end gap-2">
                      <div className="flex-1 space-y-1 w-full">
                        <label className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1">Nome do Bairro / Região</label>
                        <input 
                          type="text" 
                          value={newAreaName} 
                          onChange={(e) => setNewAreaName(e.target.value)} 
                          placeholder="Ex: Jardins, Meireles..." 
                          className="w-full px-3 py-2 bg-brand-white border border-brand-mist/60 rounded-lg outline-none text-[13px] font-light focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all"
                        />
                      </div>
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

              {setTravelFeeMode && setFixedTravelFee && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-[9px] font-bold text-brand-ink uppercase tracking-widest">Você cobra deslocamento?</h4>
                  <div className="flex gap-2 max-w-sm">
                    <button 
                      type="button"
                      onClick={() => setTravelFeeMode('none')}
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded text-[9px] font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/50 transition-all border",
                        travelFeeMode === 'none' || !travelFeeMode
                          ? 'border-brand-ink/20 bg-[#FAF9F8] text-brand-ink shadow-sm' 
                          : 'border-transparent bg-brand-mist/20 text-brand-stone/80 hover:bg-brand-mist/30'
                      )}
                    >
                      Não cobro taxa
                    </button>
                    <button 
                      type="button"
                      onClick={() => setTravelFeeMode('fixed')}
                      className={cn(
                        "flex-1 py-1.5 px-3 rounded text-[9px] font-bold uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/50 transition-all border",
                        travelFeeMode === 'fixed' 
                          ? 'border-brand-ink/20 bg-[#FAF9F8] text-brand-ink shadow-sm' 
                          : 'border-transparent bg-brand-mist/20 text-brand-stone/80 hover:bg-brand-mist/30'
                      )}
                    >
                      Cobro taxa fixa
                    </button>
                  </div>
                  
                  {travelFeeMode === 'fixed' && (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[9px] font-medium text-brand-ink uppercase tracking-widest block ml-1">Valor da taxa</label>
                      <div className="relative max-w-[150px]">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-stone text-xs">R$</span>
                        <input
                          type="number"
                          value={fixedTravelFee}
                          onChange={(e) => setFixedTravelFee(e.target.value)}
                          placeholder="20"
                          className="w-full pl-7 pr-2 py-1.5 bg-white border border-brand-mist rounded-md outline-none focus:border-brand-ink/30 transition-all font-light text-xs"
                        />
                      </div>
                      <p className="text-[9px] text-brand-stone font-light italic ml-1 max-w-sm">
                        Você poderá ajustar regras mais detalhadas depois no painel.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
