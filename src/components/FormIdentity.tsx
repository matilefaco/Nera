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
  title?: string;
  subtitle?: string;
  showLabels?: boolean;
}

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
  title,
  subtitle,
  showLabels = true
}: FormIdentityProps) => {
  return (
    <div className="w-full space-y-10">
      {(title || subtitle) && (
        <div className="text-center space-y-4">
          {title && <h1 className="text-4xl font-serif font-normal text-brand-ink">{title}</h1>}
          {subtitle && <p className="text-brand-stone font-light">{subtitle}</p>}
        </div>
      )}

      <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm space-y-8">
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
            {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Nome que aparece na agenda</label>}
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Ex: Bruna Designer" 
              className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
            />
          </div>
          <div className="space-y-2">
            {showLabels && <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Sua Especialidade Principal</label>}
            <input 
              type="text" 
              value={specialty} 
              onChange={(e) => setSpecialty(e.target.value)} 
              placeholder="Ex: Nail Designer" 
              className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
