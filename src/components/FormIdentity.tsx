import React from 'react';
import { User, Camera, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

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
                "w-full px-6 py-4 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light",
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
                "w-full px-6 py-4 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light",
                errors.specialty ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
              )}
            />
            <FormError message={errors.specialty} />
          </div>

          {(headline !== undefined && setHeadline) && (
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Sua Headline (Frase de impacto)</label>}
              </div>
              <input 
                type="text" 
                value={headline} 
                onChange={(e) => setHeadline(e.target.value)} 
                placeholder="Ex: Especialista em beleza natural"
                className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
              />
            </div>
          )}

          {(bio !== undefined && setBio) && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                  {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Bio / Descrição Boutique</label>}
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
                    <Sparkles size={14} /> {isGeneratingBio ? 'Refinando...' : 'Bio com IA'}
                  </button>
                )}
              </div>
              <textarea 
                value={bio} 
                onChange={(e) => setBio(e.target.value)} 
                className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all h-32 resize-none font-light italic text-sm leading-relaxed" 
                placeholder="Conte o diferencial do seu atendimento..." 
              />
            </div>
          )}

          {(differentials !== undefined && setDifferentials) && (
            <div className="space-y-4">
              {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Seus Diferenciais</label>}
              <div className="flex flex-wrap gap-2">
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
            </div>
          )}

          {(whatsapp !== undefined && setWhatsapp) && (
            <div className="space-y-2">
              {showLabels && (
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                  WhatsApp de Contato <span className="text-brand-terracotta">*</span>
                </label>
              )}
              <input 
                type="tel" 
                value={whatsapp} 
                onChange={(e) => setWhatsapp(e.target.value)} 
                placeholder="(00) 00000-0000" 
                className={cn(
                  "w-full px-6 py-4 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light",
                  errors.whatsapp ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                )}
              />
              <FormError message={errors.whatsapp} />
            </div>
          )}

          {(instagram !== undefined && setInstagram) && (
            <div className="space-y-2">
              {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Instagram (@usuario)</label>}
              <div className="flex items-center gap-2 bg-brand-parchment p-4 rounded-[20px] border border-brand-mist shadow-sm">
                <span className="text-brand-stone text-sm">@</span>
                <input 
                  type="text" 
                  value={instagram} 
                  onChange={(e) => setInstagram(e.target.value.replace(/@/g, ''))} 
                  placeholder="seu.usuario" 
                  className="flex-1 bg-transparent outline-none text-brand-ink font-medium text-sm" 
                />
              </div>
            </div>
          )}

          {(slug !== undefined && setSlug) && (
            <div className="space-y-2">
              {showLabels && (
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                  Link Personalizado (Slug) <span className="text-brand-terracotta">*</span>
                </label>
              )}
              <div className={cn(
                "flex items-center gap-2 bg-brand-parchment p-4 rounded-[20px] border transition-all",
                errors.slug ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
              )}>
                <span className="text-brand-stone text-sm">nera.app/p/</span>
                <input 
                  type="text" 
                  value={slug} 
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} 
                  placeholder="seu-nome"
                  className="flex-1 bg-transparent outline-none text-brand-ink font-medium text-sm"
                />
              </div>
              <FormError message={errors.slug} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
