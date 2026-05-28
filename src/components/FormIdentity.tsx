import React from 'react';
import { User, Camera, Sparkles, X, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, cleanWhatsapp, formatWhatsappDisplay, isValidWhatsapp, normalizeInstagram, getDifferentialPlaceholder, INSTAGRAM_REGEX } from '../lib/utils';

export interface FormIdentityProps {
  name: string;
  setName: (val: string) => void;
  specialty: string;
  setSpecialty: (val: string) => void;
  avatar: string;
  avatarPreview: string;
  uploadingImage: boolean;
  onAvatarClick: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors?: Record<string, string>;
  
  // Optional professional identity fields
  headline?: string;
  setHeadline?: (val: string) => void;
  bio?: string;
  setBio?: (val: string) => void;
  whatsapp?: string;
  setWhatsapp?: (val: string) => void;
  instagram?: string;
  setInstagram?: (val: string) => void;
  instagramStatus?: 'idle' | 'valid' | 'invalid';
  instagramConfirmed?: boolean;
  setInstagramConfirmed?: (val: boolean) => void;
  slug?: string;
  setSlug?: (val: string) => void;
  slugStatus?: 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid';
  slugMessage?: string;
  slugSuggestions?: string[];
  onSelectSuggestion?: (val: string) => void;
  differentials?: string[];
  setDifferentials?: (val: string[]) => void;
  availableDifferentials?: string[];
  yearsExperience?: string;
  setYearsExperience?: (val: string) => void;
  
  paymentMethods?: string[];
  setPaymentMethods?: (val: string[]) => void;
  acceptsInstallments?: boolean;
  setAcceptsInstallments?: (val: boolean) => void;
  
  title?: string;
  subtitle?: string;
  showLabels?: boolean;
  onGenerateBio?: () => void;
  isGeneratingBio?: boolean;
  selectedBioStyle?: string;
  setSelectedBioStyle?: (val: string) => void;
}

const FormError = ({ message }: { message?: string }) => (
  <AnimatePresence>
    {message && (
      <motion.p 
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="form-error-message text-[10px] text-brand-terracotta font-bold uppercase tracking-wider ml-1 mt-1"
      >
        {message}
      </motion.p>
    )}
  </AnimatePresence>
);

export const FormIdentity = ({
  name,
  setName,
  specialty,
  setSpecialty,
  avatar,
  avatarPreview,
  uploadingImage,
  onAvatarClick,
  inputRef,
  onFileUpload,
  errors = {},
  headline,
  setHeadline,
  bio,
  setBio,
  whatsapp,
  setWhatsapp,
  instagram,
  setInstagram,
  instagramStatus = 'idle',
  instagramConfirmed,
  setInstagramConfirmed,
  slug,
  setSlug,
  slugStatus = 'idle',
  slugMessage,
  slugSuggestions = [],
  onSelectSuggestion,
  differentials,
  setDifferentials,
  availableDifferentials = [],
  yearsExperience,
  setYearsExperience,
  paymentMethods,
  setPaymentMethods,
  acceptsInstallments,
  setAcceptsInstallments,
  title,
  subtitle,
  showLabels = true,
  onGenerateBio,
  isGeneratingBio,
  selectedBioStyle = 'elegante',
  setSelectedBioStyle
}: FormIdentityProps) => {
  const [showAllSpecialties, setShowAllSpecialties] = React.useState(false);
  const specialtySuggestions = [
    'Lash designer',
    'Designer de sobrancelhas',
    'Nail designer',
    'Manicure',
    'Maquiadora',
    'Cabeleireira',
    'Esteticista',
    'Micropigmentadora',
    'Depiladora',
    'Trancista',
    'Massoterapeuta',
    'Designer de cílios',
    'Bronzeamento',
    'Terapeuta capilar'
  ];
  const displayedSpecialties = showAllSpecialties ? specialtySuggestions : specialtySuggestions.slice(0, 8);

  const styles = [
    { id: 'elegante', label: 'Elegante' },
    { id: 'delicada', label: 'Delicada' },
    { id: 'premium', label: 'Premium' },
    { id: 'minimalista', label: 'Minimalista' },
    { id: 'acolhedora', label: 'Acolhedora' },
    { id: 'tecnica', label: 'Técnica' },
    { id: 'sofisticada', label: 'Sofisticada' },
    { id: 'autoral', label: 'Autoral' }
  ];

  return (
    <div className="w-full space-y-6">
      {(title || subtitle) && (
        <div className="text-center space-y-3">
          {title && <h1 className="text-2xl sm:text-3xl font-serif font-normal text-brand-ink">{title}</h1>}
          {subtitle && <p className="text-[11px] sm:text-sm text-brand-stone font-light">{subtitle}</p>}
        </div>
      )}

      <div className="space-y-0 text-center sm:text-left px-1">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 border-b border-brand-mist pb-6 mb-6">
          <div className="relative group shrink-0">
            <div 
              onClick={onAvatarClick}
              className="w-24 h-24 bg-brand-linen rounded-full flex items-center justify-center text-brand-terracotta border-4 border-brand-white shadow-sm overflow-hidden relative cursor-pointer"
            >
              {avatarPreview || avatar ? (
                <img src={avatarPreview || avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="Avatar Preview" />
              ) : (
                <User size={32} className="opacity-20" />
              )}
              {uploadingImage && (
                <div className="absolute inset-0 bg-brand-ink/40 flex items-center justify-center">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Sparkles size={20} className="text-brand-white" />
                  </motion.div>
                </div>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-brand-ink text-brand-white rounded-full flex items-center justify-center border-2 border-brand-white shadow-lg pointer-events-none">
              <Camera size={14} />
            </div>
            <input 
              ref={inputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={onFileUpload} 
              disabled={uploadingImage}
            />
          </div>
          <div className="flex-1 space-y-1 sm:pt-2">
            <h3 className="text-lg font-serif italic text-brand-ink">Sua melhor foto</h3>
            <p className="text-[10px] sm:text-xs font-light text-brand-stone leading-relaxed max-w-xs mx-auto sm:mx-0 block">
              Uma boa foto profissional transmite confiança. <br />
              <span className="italic">Você pode adicionar sua foto agora ou deixar para ajustar depois.</span>
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              {showLabels && (
                <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">
                  Nome que aparece na agenda <span className="text-brand-terracotta">*</span>
                </label>
              )}
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Ex: Bruna Designer" 
                className={cn(
                  "w-full px-4 py-2.5 bg-brand-parchment/60 border rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50",
                  errors.name ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist/50"
                )}
              />
              <FormError message={errors.name} />
            </div>
            <div className="space-y-1.5 flex flex-col">
              {showLabels && (
                <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">
                  Sua Especialidade Principal <span className="text-brand-terracotta">*</span>
                </label>
              )}
              <input 
                type="text" 
                value={specialty} 
                onChange={(e) => setSpecialty(e.target.value)} 
                placeholder="Ex: Nail Designer" 
                className={cn(
                  "w-full px-4 py-2.5 bg-brand-parchment/60 border rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50",
                  errors.specialty ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist/50"
                )}
              />
              <p className="text-[10px] text-brand-stone font-light italic ml-1 mt-1">
                Escolha uma sugestão ou escreva do seu jeito.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                 {displayedSpecialties.map(s => (
                   <button
                     key={s}
                     type="button"
                     onClick={() => setSpecialty(s)}
                     className={cn(
                       "px-3 py-1.5 rounded-full text-[10px] font-medium transition-all duration-300 ease-out border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/50 focus-visible:ring-offset-1",
                       specialty === s
                         ? "bg-brand-terracotta text-brand-white border-brand-terracotta shadow-sm scale-[1.02]"
                         : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone/40 hover:bg-white hover:scale-[1.02] active:scale-[0.98]"
                     )}
                   >
                     {s}
                   </button>
                 ))}
                 {!showAllSpecialties && specialtySuggestions.length > 8 && (
                   <button
                     type="button"
                     onClick={() => setShowAllSpecialties(true)}
                     className="px-3 py-1.5 rounded-full text-[10px] font-medium text-brand-terracotta underline hover:text-brand-sienna transition-all"
                   >
                     Ver mais
                   </button>
                 )}
                 {showAllSpecialties && (
                   <button
                     type="button"
                     onClick={() => setShowAllSpecialties(false)}
                     className="px-3 py-1.5 rounded-full text-[10px] font-medium text-brand-terracotta underline hover:text-brand-sienna transition-all"
                   >
                     Ver menos
                   </button>
                 )}
              </div>
              <FormError message={errors.specialty} />
            </div>
          </div>

          {setYearsExperience && (
            <div className="space-y-1.5 flex flex-col pt-2">
              {showLabels && (
                <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">
                  Há quanto tempo você atende?
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                 {[
                   { label: "Iniciante", value: "Iniciante" },
                   { label: "1 a 2 anos", value: "1-2" },
                   { label: "3 a 5 anos", value: "3-5" },
                   { label: "5+ anos", value: "5+" },
                   { label: "10+ anos", value: "10+" }
                 ].map(exp => (
                   <button
                     key={exp.value}
                     type="button"
                     onClick={() => setYearsExperience(exp.value)}
                     className={cn(
                       "px-4 py-2 rounded-xl text-xs font-medium transition-all duration-300 ease-out border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/50 focus-visible:ring-offset-1",
                       yearsExperience === exp.value
                         ? "bg-brand-terracotta text-brand-white border-brand-terracotta shadow-sm scale-[1.02]"
                         : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone/40 hover:bg-white hover:scale-[1.02] active:scale-[0.98]"
                     )}
                   >
                     {exp.label}
                   </button>
                 ))}
              </div>
            </div>
          )}

          {(headline !== undefined && setHeadline) && (
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                {showLabels && <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">Frase principal do seu perfil</label>}
              </div>
              <input 
                type="text" 
                value={headline} 
                onChange={(e) => setHeadline(e.target.value)} 
                placeholder="Ex: Design de sobrancelhas natural, preciso e elegante."
                className="w-full px-4 py-2.5 bg-brand-parchment/60 border border-brand-mist/50 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50"
              />
            </div>
          )}

          {(bio !== undefined && setBio) && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Sua bio profissional (Opcional)</label>}
                  {setSelectedBioStyle && (
                    <details className="mt-1 group">
                      <summary className="text-[9px] cursor-pointer text-brand-stone/80 hover:text-brand-ink italic list-none flex items-center gap-1 ml-1 mb-2 outline-none">
                        <span>Ajustar tom da bio</span>
                        <span className="text-[8px] group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                        {styles.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedBioStyle(s.id)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-[8px] font-bold uppercase tracking-wider transition-all border",
                              selectedBioStyle === s.id
                                ? "bg-brand-ink text-brand-white border-brand-ink"
                                : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                <div className="mt-4 sm:mt-0 max-w-sm">
                  {onGenerateBio && (
                    <div className="flex flex-col gap-2">
                      <button 
                        type="button"
                        onClick={onGenerateBio}
                        disabled={isGeneratingBio}
                        className="flex items-center gap-2 text-[10px] font-bold text-brand-white bg-brand-ink px-4 py-2 rounded-full uppercase tracking-[0.1em] shadow-md hover:shadow-lg hover:-translate-y-0.5 hover:bg-brand-espresso disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md transition-all h-fit w-fit"
                      >
                        <Sparkles size={14} className="text-brand-terracotta" /> {isGeneratingBio ? 'Gerando...' : 'Sugerir bio com IA'}
                      </button>
                      <p className="text-[9px] text-brand-stone/60 font-light italic leading-relaxed md:max-w-xs pl-2 border-l border-brand-mist/50">
                        Descrevemos seu trabalho no tom ideal para atrair as clientes certas e transmitir autoridade.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <textarea 
                value={bio} 
                onChange={(e) => setBio(e.target.value)} 
                className="w-full px-4 py-3 bg-brand-parchment/60 border border-brand-mist/50 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all h-24 resize-none font-light italic text-sm leading-relaxed placeholder:text-brand-stone/50" 
                placeholder="Conte em poucas linhas como você atende, qual transformação entrega e por que sua cliente pode confiar em você." 
              />
              <p className="text-[10px] text-brand-stone/60 font-light ml-1">
                Essa descrição aparece na sua vitrine e ajuda a cliente a entender seu valor antes de agendar.
              </p>
            </div>
          )}

          {(differentials !== undefined && setDifferentials) && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                {showLabels && <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">Seus Diferenciais</label>}
                <p className="text-[10px] text-brand-stone/60 font-light ml-1 mb-2">
                  Selecione os pontos que tornam seu atendimento único. Eles aparecerão em uma seção especial na sua vitrine.
                </p>
              </div>

              {/* Sugestões */}
              <div className="flex flex-wrap gap-2 mb-4">
                {availableDifferentials.map(diff => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => {
                      if (differentials.includes(diff)) {
                        setDifferentials(differentials.filter(d => d !== diff));
                      } else {
                        setDifferentials([...differentials, diff]);
                      }
                    }}
                    className={cn(
                      "px-4 py-2 rounded-full text-[10px] font-medium transition-all duration-300 ease-out border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/50 focus-visible:ring-offset-1",
                      differentials.includes(diff)
                        ? "bg-brand-terracotta text-brand-white border-brand-terracotta shadow-sm scale-[1.02]"
                        : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone/40 hover:bg-white hover:scale-[1.02] active:scale-[0.98]"
                    )}
                  >
                    {diff}
                  </button>
                ))}
              </div>

              {/* Meus diferenciais (para permitir remover personalizados que não estão na lista) */}
              {differentials.filter(d => !availableDifferentials.includes(d)).length > 0 && (
                <div className="space-y-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Personalizados</p>
                  <div className="flex flex-wrap gap-2">
                    {differentials.filter(d => !availableDifferentials.includes(d)).map(diff => (
                      <div key={diff} className="flex items-center gap-2 px-4 py-2 bg-brand-terracotta/10 border border-brand-terracotta/20 rounded-full text-[10px] font-medium text-brand-terracotta transition-all duration-300 hover:bg-brand-terracotta/15">
                        {diff}
                        <button 
                          type="button" 
                          onClick={() => setDifferentials(differentials.filter(d => d !== diff))}
                          className="hover:text-brand-terracotta/80 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-terracotta rounded-full p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Adicionar Personalizado */}
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder={getDifferentialPlaceholder(specialty)}
                  className="flex-1 px-4 py-2.5 bg-brand-parchment/60 border border-brand-mist/50 rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-xs placeholder:text-brand-stone/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !differentials.includes(val)) {
                        setDifferentials([...differentials, val]);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
                <button 
                  type="button"
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    const val = input.value.trim();
                    if (val && !differentials.includes(val)) {
                      setDifferentials([...differentials, val]);
                      input.value = '';
                    }
                  }}
                  className="px-4 py-2.5 bg-brand-linen text-brand-ink border border-brand-mist/50 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-brand-white transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/50"
                >
                  Ok
                </button>
              </div>
            </div>
          )}

          {(whatsapp !== undefined && setWhatsapp) && (
            <div className="space-y-2">
              {showLabels && (
                <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">
                  Seu WhatsApp <span className="text-brand-terracotta">*</span>
                </label>
              )}
              <p className="text-[10px] text-brand-stone font-light mt-1 ml-1 mb-2">
                Suas clientes vão te chamar por aqui. Também usamos esse número para avisos de agendamento.
              </p>
              <input 
                type="tel" 
                value={whatsapp ? formatWhatsappDisplay(whatsapp) : ''} 
                onChange={(e) => {
                  const cleaned = cleanWhatsapp(e.target.value);
                  if (cleaned.length <= 11) {
                    setWhatsapp?.(cleaned);
                  }
                }} 
                placeholder="(00) 00000-0000" 
                className={cn(
                  "w-full px-4 py-2.5 bg-brand-parchment/60 border rounded-lg outline-none focus:ring-1 focus:ring-brand-terracotta/30 focus:border-brand-terracotta/50 transition-all font-light text-sm placeholder:text-brand-stone/50",
                  errors.whatsapp ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist/50"
                )}
              />
              <FormError message={errors.whatsapp} />
            </div>
          )}

          {(instagram !== undefined && setInstagram) && (
            <div className="space-y-2">
              {showLabels && <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">Instagram (@usuario) (Opcional)</label>}
              <div className={cn(
                "flex items-center gap-2 bg-brand-parchment/60 px-4 py-2.5 rounded-lg border transition-all focus-within:ring-1 focus-within:ring-brand-terracotta/30 focus-within:border-brand-terracotta/50",
                instagramStatus === 'valid' ? "border-green-200 ring-1 ring-green-100" :
                instagramStatus === 'invalid' && instagram ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : 
                "border-brand-mist/50 shadow-sm"
              )}>
                <span className="text-brand-stone text-xs ml-1">@</span>
                <input 
                  type="text" 
                  value={instagram} 
                  onChange={(e) => setInstagram(normalizeInstagram(e.target.value))} 
                  placeholder="seu.usuario" 
                  className="flex-1 bg-transparent outline-none text-brand-ink font-medium text-xs placeholder:font-light" 
                />
                <AnimatePresence mode="wait">
                  {instagramStatus === 'valid' && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <CheckCircle2 size={16} className="text-green-500 mr-1" />
                    </motion.div>
                  )}
                  {instagramStatus === 'invalid' && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <X size={16} className="text-brand-terracotta mr-1" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {instagramStatus === 'invalid' && (
                <p className="text-[10px] text-brand-terracotta font-medium ml-1 flex items-center gap-1.5">
                  <AlertCircle size={12} />
                  Use apenas letras, números, ponto e underline
                </p>
              )}

              {instagramStatus === 'valid' && (
                <div className="space-y-3 pt-1 ml-1">
                  <div className="space-y-1">
                    <a 
                      href={`https://instagram.com/${instagram}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-brand-terracotta underline flex items-center gap-1.5"
                    >
                      Confirmar: @{instagram} ↗
                    </a>
                    <p className="text-[10px] text-brand-stone font-light italic">
                      Clique para confirmar que é o seu perfil
                    </p>
                  </div>
                  
                  {setInstagramConfirmed && (
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          checked={instagramConfirmed} 
                          onChange={(e) => setInstagramConfirmed(e.target.checked)}
                          className="peer appearance-none w-4 h-4 rounded border border-brand-mist checked:bg-brand-terracotta checked:border-brand-terracotta transition-all focus-visible:ring-2 focus-visible:ring-brand-terracotta/50 focus-visible:ring-offset-1"
                        />
                        <CheckCircle2 size={10} className="absolute text-brand-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-[10px] text-brand-stone font-medium uppercase tracking-wider group-hover:text-brand-ink transition-colors">
                        Confirmei que o perfil acima é o meu
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {(slug !== undefined && setSlug) && (
            <div className="space-y-3">
              {showLabels && (
                <>
                  <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">
                    Crie seu link profissional <span className="text-brand-terracotta">*</span>
                  </label>
                  <p className="text-[9px] text-brand-stone/60 font-light mt-0 mb-3 ml-1">É o link que você compartilha com suas clientes.</p>
                </>
              )}
              <div className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all focus-within:ring-1 focus-within:ring-brand-terracotta/30 focus-within:border-brand-terracotta/50",
                slugStatus === 'available' ? "bg-green-50 border-green-200 ring-1 ring-green-100" :
                slugStatus === 'unavailable' || slugStatus === 'invalid' || errors.slug ? "bg-brand-parchment/60 border-brand-terracotta ring-1 ring-brand-terracotta/20" : 
                "bg-brand-parchment/60 border-brand-mist/50"
              )}>
                <span className="text-brand-stone text-xs ml-1">usenera.com/p/</span>
                <input 
                  type="text" 
                  value={slug} 
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} 
                  placeholder="seu-nome"
                  className="flex-1 bg-transparent outline-none text-brand-ink font-medium text-xs"
                />
                {slugStatus === 'checking' && (
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="mr-1"
                  >
                    <Sparkles size={14} className="text-brand-stone opacity-40" />
                  </motion.div>
                )}
                {slugStatus === 'available' && (
                  <CheckCircle2 size={16} className="text-green-500 mr-1" />
                )}
                {(slugStatus === 'unavailable' || slugStatus === 'invalid') && (
                  <X size={16} className="text-brand-terracotta mr-1" />
                )}
              </div>
              
              {slugMessage && (
                <p className={cn(
                  "text-[10px] font-medium ml-1 flex items-center gap-1.5",
                  slugStatus === 'available' ? "text-green-600" : "text-brand-terracotta"
                )}>
                  {slugStatus === 'available' ? <CheckCircle2 size={12} /> : <X size={12} />}
                  {slugMessage}
                </p>
              )}

              {slugStatus === 'unavailable' && slugSuggestions.length > 0 && (
                <div className="space-y-2 pt-2 ml-1">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-brand-stone italic">Sugestões disponíveis:</p>
                  <div className="flex flex-wrap gap-2">
                    {slugSuggestions.map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => onSelectSuggestion?.(suggestion)}
                        className="px-3 py-1.5 bg-brand-linen text-brand-ink border border-brand-mist rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-brand-white transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <FormError message={errors.slug} />
            </div>
          )}

          {(paymentMethods !== undefined && setPaymentMethods) && (
            <div className="space-y-4 pt-4 border-t border-brand-mist/30">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-brand-stone/80 uppercase tracking-widest ml-1 mb-1 block">
                  Formas de pagamento aceitas <span className="text-brand-terracotta">*</span>
                </label>
                <p className="text-[10px] text-brand-stone font-light ml-1">
                  Selecione ao menos uma opção para suas clientes saberem como pagar.
                </p>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'pix', label: 'Pix' },
                  { id: 'credit_card', label: 'Cartão de Crédito' },
                  { id: 'debit_card', label: 'Cartão de Débito' },
                  { id: 'cash', label: 'Dinheiro' },
                  { id: 'bank_transfer', label: 'Transferência' }
                ].map(method => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      if (!setPaymentMethods) return;
                      const current = paymentMethods || [];
                      if (current.includes(method.id)) {
                        setPaymentMethods(current.filter(m => m !== method.id));
                      } else {
                        setPaymentMethods([...current, method.id]);
                      }
                    }}
                    className={cn(
                      "px-5 py-2.5 rounded-full text-[10px] font-bold tracking-wider transition-all duration-300 ease-out border uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink/50 focus-visible:ring-offset-1",
                      (paymentMethods || []).includes(method.id)
                        ? "bg-brand-ink text-brand-white border-brand-ink shadow-md scale-[1.02]"
                        : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone/40 hover:bg-white hover:scale-[1.02] active:scale-[0.98]"
                    )}
                  >
                    {method.label}
                    {(paymentMethods || []).includes(method.id) && <CheckCircle2 size={12} className="inline ml-1.5" />}
                  </button>
                ))}
              </div>

              {setAcceptsInstallments && (paymentMethods || []).some(m => ['credit_card', 'credito', 'crédito'].includes(m)) && (
                <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                  <label className="flex items-center gap-3 cursor-pointer group w-fit">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        checked={acceptsInstallments} 
                        onChange={(e) => setAcceptsInstallments(e.target.checked)}
                        className="peer appearance-none w-5 h-5 rounded-lg border border-brand-mist checked:bg-brand-terracotta checked:border-brand-terracotta transition-all"
                      />
                      <CheckCircle2 size={12} className="absolute text-brand-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-bold text-brand-stone group-hover:text-brand-ink uppercase tracking-widest transition-colors">Ofereço parcelamento no cartão</span>
                      <p className="text-[9px] text-brand-stone/60 font-light leading-none">Ative apenas se você possui maquininha ou link que parcela.</p>
                    </div>
                  </label>
                </div>
              )}
              <FormError message={errors.paymentMethods} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
