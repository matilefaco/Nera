import React from 'react';
import { User, Camera, Sparkles, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, cleanWhatsapp, formatWhatsappDisplay } from '../lib/utils';

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
  slug?: string;
  setSlug?: (val: string) => void;
  slugStatus?: 'idle' | 'checking' | 'available' | 'unavailable' | 'invalid';
  slugMessage?: string;
  slugSuggestions?: string[];
  onSelectSuggestion?: (val: string) => void;
  differentials?: string[];
  setDifferentials?: (val: string[]) => void;
  availableDifferentials?: string[];
  
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
  slug,
  setSlug,
  slugStatus = 'idle',
  slugMessage,
  slugSuggestions = [],
  onSelectSuggestion,
  differentials,
  setDifferentials,
  availableDifferentials = [],
  title,
  subtitle,
  showLabels = true,
  onGenerateBio,
  isGeneratingBio,
  selectedBioStyle = 'elegante',
  setSelectedBioStyle
}: FormIdentityProps) => {
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
    <div className="w-full space-y-10">
      {(title || subtitle) && (
        <div className="text-center space-y-4">
          {title && <h1 className="text-4xl font-serif font-normal text-brand-ink">{title}</h1>}
          {subtitle && <p className="text-brand-stone font-light">{subtitle}</p>}
        </div>
      )}

      <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-8">
        <div className="flex flex-col items-center">
          <div className="relative group">
            <div 
              onClick={onAvatarClick}
              className="w-32 h-32 bg-brand-linen rounded-full flex items-center justify-center text-brand-terracotta border-4 border-brand-white shadow-sm overflow-hidden relative cursor-pointer"
            >
              {avatarPreview || avatar ? (
                <img src={avatarPreview || avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="Avatar Preview" />
              ) : (
                <User size={48} className="opacity-20" />
              )}
              {uploadingImage && (
                <div className="absolute inset-0 bg-brand-ink/40 flex items-center justify-center">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Sparkles size={24} className="text-brand-white" />
                  </motion.div>
                </div>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-10 h-10 bg-brand-ink text-brand-white rounded-full flex items-center justify-center border-4 border-brand-white shadow-lg pointer-events-none">
              <Camera size={18} />
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
          <p className="mt-4 text-[10px] font-medium text-brand-stone uppercase tracking-widest">Sua melhor foto profissional</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            {showLabels && (
              <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                Nome que aparece na agenda <span className="text-brand-terracotta">*</span>
              </label>
            )}
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Ex: Bruna Designer" 
              className={cn(
                "w-full px-6 py-3.5 bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
                errors.name ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
              )}
            />
            <FormError message={errors.name} />
          </div>
          <div className="space-y-2">
            {showLabels && (
              <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                Sua Especialidade Principal <span className="text-brand-terracotta">*</span>
              </label>
            )}
            <input 
              type="text" 
              value={specialty} 
              onChange={(e) => setSpecialty(e.target.value)} 
              placeholder="Ex: Nail Designer" 
              className={cn(
                "w-full px-6 py-3.5 bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
                errors.specialty ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
              )}
            />
            <FormError message={errors.specialty} />
          </div>

          {(headline !== undefined && setHeadline) && (
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Frase principal do seu perfil</label>}
              </div>
              <input 
                type="text" 
                value={headline} 
                onChange={(e) => setHeadline(e.target.value)} 
                placeholder="Ex: Especialista em beleza natural"
                className="w-full px-6 py-3.5 bg-brand-parchment border border-brand-mist rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm"
              />
            </div>
          )}

          {(bio !== undefined && setBio) && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                  {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Sua bio profissional</label>}
                  {setSelectedBioStyle && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
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
                  )}
                </div>
                {onGenerateBio && (
                  <button 
                    type="button"
                    onClick={onGenerateBio}
                    disabled={isGeneratingBio}
                    className="flex items-center gap-2 text-[10px] font-medium text-brand-terracotta uppercase tracking-[0.2em] hover:text-brand-sienna disabled:opacity-50 h-fit pb-1"
                  >
                    <Sparkles size={14} /> {isGeneratingBio ? 'Refinando...' : 'Bio sugerida com IA'}
                  </button>
                )}
              </div>
              <textarea 
                value={bio} 
                onChange={(e) => setBio(e.target.value)} 
                className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all h-32 resize-none font-light italic text-sm leading-relaxed" 
                placeholder="Conte um pouco sobre seu trabalho e diferenciais..." 
              />
              <p className="text-[10px] text-brand-stone/60 font-light ml-1">
                A IA cria uma primeira versão da sua headline e da sua bio para facilitar. Depois você pode ajustar tudo para ficar com a sua cara.
              </p>
            </div>
          )}

          {(differentials !== undefined && setDifferentials) && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Seus Diferenciais</label>}
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
                      "px-4 py-2 rounded-full text-[10px] font-medium transition-all border",
                      differentials.includes(diff)
                        ? "bg-brand-terracotta text-brand-white border-brand-terracotta shadow-sm"
                        : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone"
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
                      <div key={diff} className="flex items-center gap-2 px-4 py-2 bg-brand-terracotta/10 border border-brand-terracotta/20 rounded-full text-[10px] font-medium text-brand-terracotta">
                        {diff}
                        <button 
                          type="button" 
                          onClick={() => setDifferentials(differentials.filter(d => d !== diff))}
                          className="hover:text-brand-ink"
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
                  placeholder="Ex: Estacionamento gratuito"
                  className="flex-1 px-5 py-3 bg-brand-parchment border border-brand-mist rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-[11px]"
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
                  className="px-5 py-3 bg-brand-linen text-brand-ink border border-brand-mist rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-white transition-all shadow-sm"
                >
                  Ok
                </button>
              </div>
            </div>
          )}

          {(whatsapp !== undefined && setWhatsapp) && (
            <div className="space-y-2">
              {showLabels && (
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                  WhatsApp da Profissional <span className="text-brand-terracotta">*</span>
                </label>
              )}
              <p className="text-[10px] text-brand-stone font-light mt-1 ml-1">
                Você receberá novos agendamentos por aqui. Essencial para o funcionamento.
              </p>
              <input 
                type="tel" 
                value={whatsapp ? formatWhatsappDisplay(whatsapp) : ''} 
                onChange={(e) => setWhatsapp?.(cleanWhatsapp(e.target.value))} 
                placeholder="(00) 00000-0000" 
                className={cn(
                  "w-full px-6 py-3.5 bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
                  errors.whatsapp ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                )}
              />
              <FormError message={errors.whatsapp} />
            </div>
          )}

          {(instagram !== undefined && setInstagram) && (
            <div className="space-y-2">
              {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Instagram (@usuario)</label>}
              <div className="flex items-center gap-2 bg-brand-parchment p-3.5 rounded-[18px] border border-brand-mist shadow-sm">
                <span className="text-brand-stone text-xs ml-1">@</span>
                <input 
                  type="text" 
                  value={instagram} 
                  onChange={(e) => setInstagram(e.target.value.replace(/@/g, ''))} 
                  placeholder="seu.usuario" 
                  className="flex-1 bg-transparent outline-none text-brand-ink font-medium text-xs" 
                />
              </div>
            </div>
          )}

          {(slug !== undefined && setSlug) && (
            <div className="space-y-3">
              {showLabels && (
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                  Link Personalizado (Slug) <span className="text-brand-terracotta">*</span>
                </label>
              )}
              <div className={cn(
                "flex items-center gap-2 bg-brand-parchment p-3.5 rounded-[18px] border transition-all",
                slugStatus === 'available' ? "border-green-200 ring-1 ring-green-100" :
                slugStatus === 'unavailable' || slugStatus === 'invalid' || errors.slug ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : 
                "border-brand-mist"
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
                        className="px-3 py-1.5 bg-brand-linen text-brand-ink border border-brand-mist rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-brand-white transition-all shadow-sm"
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
        </div>
      </div>
    </div>
  );
};
