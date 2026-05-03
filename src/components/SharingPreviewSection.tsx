import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Camera, Save, Info, Smartphone, MessageCircle, AlertCircle, Share2, Copy, Check } from 'lucide-react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';

interface SharingPreviewSectionProps {
  profile: UserProfile;
}

export function SharingPreviewSection({ profile }: SharingPreviewSectionProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    ogTitle: profile.ogTitle || '',
    ogDescription: profile.ogDescription || '',
    ogImageUrl: profile.ogImageUrl || profile.avatar || '',
    ogCtaText: profile.ogCtaText || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showSavingSuccess, setShowSavingSuccess] = useState(false);

  useEffect(() => {
    setFormData({
      ogTitle: profile.ogTitle || '',
      ogDescription: profile.ogDescription || '',
      ogImageUrl: profile.ogImageUrl || profile.avatar || '',
      ogCtaText: profile.ogCtaText || '',
    });
  }, [profile.ogTitle, profile.ogDescription, profile.ogImageUrl, profile.avatar, profile.ogCtaText]);

  // Fallbacks for preview
  const previewTitle = formData.ogTitle || `${profile.name} | ${profile.category || profile.specialty || "Profissional Nera"}`;
  const previewDescription = formData.ogDescription || (profile.bio?.slice(0, 160) || `Agende um horário com ${profile.name} pelo Nera.`);
  const previewImage = formData.ogImageUrl || profile.avatar || "https://usenera.com/og-default.png";
  const profileUrl = `https://usenera.com/p/${profile.slug}`;

  const handleSave = async () => {
    const targetUid = user?.uid || profile.uid;
    if (!targetUid) {
      toast.error('Usuário não identificado.');
      return;
    }
    
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        ogTitle: formData.ogTitle,
        ogDescription: formData.ogDescription,
        ogImageUrl: formData.ogImageUrl,
        ogCtaText: formData.ogCtaText,
        ogUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setShowSavingSuccess(true);
      toast.success('Configurações de compartilhamento salvas!');
      setTimeout(() => setShowSavingSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving OG data:', error);
      toast.error('Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = () => {
    const url = `https://usenera.com/p/${profile.slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-[32px] p-8 border border-brand-mist shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-linen rounded-full flex items-center justify-center text-brand-terracotta">
            <Share2 size={20} />
          </div>
          <div>
            <h3 className="text-xl font-serif text-brand-ink">Preview de Compartilhamento</h3>
            <p className="text-xs text-brand-stone font-light italic">Personalize como seu link aparece no WhatsApp e Instagram.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Edit Form */}
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest mb-2 block">Título do Card</label>
                <input
                  type="text"
                  value={formData.ogTitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, ogTitle: e.target.value }))}
                  placeholder={profile.name}
                  className="w-full px-4 py-3 bg-brand-linen/30 border border-brand-mist rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-terracotta text-sm"
                />
                <p className="text-[10px] text-brand-stone mt-1">Ex: "Unhas Incríveis com ${profile.name.split(' ')[0]}"</p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest mb-2 block">Descrição Curta</label>
                <textarea
                  value={formData.ogDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, ogDescription: e.target.value }))}
                  placeholder="Especialista em..."
                  rows={3}
                  className="w-full px-4 py-3 bg-brand-linen/30 border border-brand-mist rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-terracotta text-sm resize-none"
                />
                <p className="text-[10px] text-brand-stone mt-1">Máximo 160 caracteres sugerido.</p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest mb-2 block">Texto de Chamada (CTA)</label>
                <input
                  type="text"
                  value={formData.ogCtaText}
                  onChange={(e) => setFormData(prev => ({ ...prev, ogCtaText: e.target.value }))}
                  placeholder="Agende seu horário online"
                  className="w-full px-4 py-3 bg-brand-linen/30 border border-brand-mist rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-terracotta text-sm"
                />
                <p className="text-[10px] text-brand-stone mt-1">Opcional. Ex: "Garanta sua vaga para essa semana!"</p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest mb-2 block">URL da Imagem de Preview</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.ogImageUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, ogImageUrl: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1 px-4 py-3 bg-brand-linen/30 border border-brand-mist rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-terracotta text-sm"
                  />
                  {profile.avatar && (
                    <button 
                      onClick={() => setFormData(prev => ({ ...prev, ogImageUrl: profile.avatar || '' }))}
                      className="px-3 py-2 bg-brand-linen text-brand-ink text-[10px] font-bold uppercase rounded-xl hover:bg-brand-parchment transition-all"
                    >
                      Usar Avatar
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-brand-stone mt-1">Recomendado: 1200x630px. Use uma foto profissional ou do seu espaço.</p>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                "w-full py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                showSavingSuccess 
                  ? "bg-green-500 text-white" 
                  : "bg-brand-ink text-white hover:bg-brand-ink/90 shadow-lg shadow-brand-ink/10"
              )}
            >
              {isSaving ? (
                <>Salvando...</>
              ) : showSavingSuccess ? (
                <><Check size={16} /> Salvo com sucesso!</>
              ) : (
                <><Save size={16} /> Salvar Alterações</>
              )}
            </button>
          </div>

          {/* Preview Section */}
          <div className="space-y-6">
            <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest mb-2 block flex items-center gap-2">
              <Smartphone size={14} /> Preview no WhatsApp
            </label>
            
            <div className="bg-[#E5DDD5] p-6 rounded-[32px] relative overflow-hidden">
                {/* Chat bubble simulation */}
                <div className="flex flex-col gap-2 max-w-[85%] ml-auto">
                    <div className="bg-[#DCF8C6] p-2 rounded-lg shadow-sm border border-[#C6E6A3] relative">
                         {/* Link Card Styling */}
                         <div className="bg-[#F0F2F5]/80 rounded-sm overflow-hidden border border-black/5">
                            <div className="aspect-[1.91/1] w-full bg-brand-stone/10 overflow-hidden relative">
                                <img 
                                    src={previewImage} 
                                    alt="Preview" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://usenera.com/og-default.png';
                                    }}
                                />
                            </div>
                            <div className="p-2 border-l-4 border-brand-terracotta bg-white/40">
                                <h4 className="text-[13px] font-bold text-[#111b21] line-clamp-1">{previewTitle}</h4>
                                <p className="text-[12px] text-[#667781] line-clamp-2 leading-tight mt-0.5">{previewDescription}</p>
                                <p className="text-[10px] text-[#667781] mt-1">{profileUrl}</p>
                            </div>
                         </div>
                         
                         <div className="pt-1 flex flex-col gap-1">
                            <p className="text-[13px] text-[#111b21]">Confira meu novo site de agendamentos! ✨</p>
                            {formData.ogCtaText && (
                                <p className="text-[12px] text-brand-terracotta font-medium italic">
                                    {formData.ogCtaText}
                                </p>
                            )}
                            <div className="flex items-center justify-end">
                                <span className="text-[10px] text-[#667781] shrink-0">12:45</span>
                            </div>
                         </div>
                    </div>
                </div>

                <div className="mt-8 bg-white/80 backdrop-blur-sm p-4 rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-linen rounded-xl flex items-center justify-center text-brand-terracotta">
                            <MessageCircle size={20} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-brand-ink">Peça para uma amiga testar!</p>
                            <p className="text-[10px] text-brand-stone">Envie seu link e veja o card em ação.</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleCopyLink}
                        className="px-4 py-2 bg-brand-ink text-white text-[9px] font-bold uppercase rounded-full hover:bg-brand-ink/90 transition-all"
                    >
                        Copiar Link
                    </button>
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3">
                <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 leading-relaxed italic">
                    <strong>Dica Nera:</strong> O WhatsApp às vezes demora alguns minutos para "limpar o cache" e mostrar a nova imagem. Se não atualizar na hora, aguarde um pouco ou tente enviar para um contato diferente.
                </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
