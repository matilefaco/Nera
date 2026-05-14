import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { toPng } from 'html-to-image';
import { Copy, MessageCircle, Instagram, QrCode, Download, Check, Share2, ChevronDown } from 'lucide-react';
import { UserProfile } from '../types';
import { notify } from '../lib/notify';
import { cn } from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';

interface SharingPreviewSectionProps {
  profile: UserProfile;
}

export function SharingPreviewSection({ profile }: SharingPreviewSectionProps) {
  const profileUrl = `https://usenera.com/p/${profile.slug}`;
  const [copiedTemplate, setCopiedTemplate] = useState<number | null>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const storyCardRef = useRef<HTMLDivElement>(null);

  const safeInitial = (profile?.name || 'N').trim().charAt(0).toUpperCase();

  const handleDownloadStoryCard = useCallback(async () => {
    if (!storyCardRef.current) return;
    
    try {
      setIsGeneratingStory(true);

      if (typeof document !== 'undefined' && 'fonts' in document) {
        try {
          // Wait for fonts to be ready with a timeout to prevent hanging
          await Promise.race([
            (document as any).fonts.ready,
            new Promise(resolve => setTimeout(resolve, 1500))
          ]);
        } catch (e) {
          console.warn('Font loading wait failed or timed out', e);
        }
      }

      const exportOptions = {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#F9F5F0',
        style: {
          borderRadius: '20px',
          margin: '0',
          transform: 'none',
        }
      };

      const dataUrl = await toPng(storyCardRef.current, exportOptions);

      const link = document.createElement('a');
      link.download = `nera-story-${profile.slug || 'art'}.png`;
      link.href = dataUrl;
      link.click();
      
    } catch (err) {
      console.error('Error generating image:', err);
      notify.error('Não foi possível baixar a imagem. Tente novamente.');
    } finally {
      setIsGeneratingStory(false);
    }
  }, [profile.slug]);

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    notify.success('Copiado!');
    setCopiedTemplate(index);
    setTimeout(() => setCopiedTemplate(null), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;
    
    // Convert SVG to data url
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width + 40; // Add padding
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = `QR_Nera_${profile.slug}.png`;
        downloadLink.href = `${pngFile}`;
        downloadLink.click();
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const whatsappTemplates = [
    `Minha agenda online já está disponível ✨\nAgora você pode escolher horário e agendar diretamente pelo link:\n${profileUrl}`,
    `Organizei minha agenda online pra facilitar os agendamentos 🤎\nVocê pode escolher o melhor horário por aqui:\n${profileUrl}`,
    `Pra ficar mais fácil pra vocês, meus horários agora ficam disponíveis online ✨\nAgende pelo link:\n${profileUrl}`
  ];

  const defaultWhatsappShare = encodeURIComponent(`Minha agenda online já está disponível! Agende seu horário comigo pelo link: ${profileUrl}`);

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 2. MENSAGEM PARA DIVULGAR */}
        <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-brand-mist shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-[#E8F8EE] rounded-full flex items-center justify-center text-[#128C7E]">
              <MessageCircle size={16} />
            </div>
            <div>
              <h3 className="text-base font-serif text-brand-ink">Mensagem para divulgar</h3>
              <p className="text-[10px] text-brand-stone font-light italic">Copie, personalize e envie para suas clientes.</p>
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div className="bg-[#F0F2F5]/80 p-4 rounded-xl border border-brand-mist/50 relative group">
              <p className="text-xs text-[#111b21] whitespace-pre-wrap font-sans pr-8 leading-relaxed">{whatsappTemplates[0]}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button 
              onClick={() => handleCopyText(whatsappTemplates[0], 0)}
              className="flex-1 py-3 bg-brand-linen text-brand-ink rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:bg-brand-parchment"
            >
              {copiedTemplate === 0 ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              Copiar
            </button>
            <a 
              href={`https://wa.me/?text=${defaultWhatsappShare}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 bg-[#128C7E] text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:bg-[#075E54] shadow-sm"
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
          </div>
        </div>

        {/* 3. STORIES E QR CODE */}
        <div className="space-y-6 flex flex-col">
          {/* STORIES */}
          <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-brand-mist shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#962FBF] rounded-full flex items-center justify-center text-white shrink-0">
                <Instagram size={16} />
              </div>
              <div>
                <h3 className="text-base font-serif text-brand-ink">Card para Stories</h3>
                <p className="text-[10px] text-brand-stone font-light italic truncate">Arte pronta para divulgar sua agenda.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-center sm:items-stretch">
              {/* MOCKUP DO STORY */}
              <div className="relative shrink-0 flex items-center justify-center shadow-md rounded-[16px] border border-brand-mist/30">
                {/* The card container to be exported */}
                <div 
                  ref={storyCardRef}
                  className="w-[180px] h-[320px] rounded-[16px] overflow-hidden bg-[#F8F6F2] relative flex flex-col items-center justify-between py-6 px-4 shadow-[inset_0_0_40px_rgba(137,103,88,0.05)]"
                >
                  {/* CSS Grain */}
                  <div className="absolute inset-0 opacity-[0.035] mix-blend-multiply pointer-events-none" style={{ backgroundImage: 'radial-gradient(#896758 1px, transparent 1px)', backgroundSize: '4px 4px' }}></div>

                  {/* Editorial Inner Border */}
                  <div className="absolute inset-2 border-[0.5px] border-brand-terracotta/20 rounded-[10px] pointer-events-none z-10"></div>

                  {/* Giant Abstract Initial Monogram Background */}
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none opacity-[0.03] select-none">
                     <span className="text-[400px] font-serif text-brand-ink leading-none mt-10 mix-blend-multiply">{safeInitial}</span>
                  </div>

                  {/* 1. Header label */}
                  <div className="relative z-10 flex flex-col items-center mt-2">
                    <span className="text-[5.5px] font-bold text-brand-stone uppercase tracking-[0.35em] mb-1.5">Agenda Online</span>
                    <div className="w-8 h-[0.5px] bg-brand-terracotta/40"></div>
                  </div>

                  {/* 2. Middle Content (Name & Speciality) */}
                  <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full px-2 text-center -mt-2">
                    <h4 className="text-[18px] sm:text-[20px] font-serif text-brand-ink leading-[1.1] text-balance max-w-[150px]">
                       {profile.name}
                    </h4>
                    
                    {(profile.specialty || profile.category) && (
                      <div className="mt-3 pt-2.5 border-t border-brand-mist/60 px-4">
                        <span className="text-[5.5px] font-bold text-brand-stone uppercase tracking-[0.25em] relative top-[-1px]">
                           {profile.specialty || profile.category}
                        </span>
                      </div>
                    )}

                    <div className="mt-6 flex flex-col items-center">
                       <span className="w-1 h-1 rounded-full bg-brand-terracotta/60 mb-3"></span>
                       <p className="text-[14px] font-serif text-brand-terracotta italic leading-snug tracking-wide max-w-[140px]">
                         {profile.headline || "Reserve seu horário"}
                       </p>
                       <p className="text-[7px] text-brand-stone uppercase tracking-[0.15em] mt-1.5 font-bold">
                         Agendamento disponível
                       </p>
                    </div>
                  </div>

                  {/* 3. Link Sticker & Footer */}
                  <div className="relative z-10 flex flex-col items-center w-full gap-2.5 mt-auto mb-1">
                    {/* Link Sticker */}
                    <div className="bg-white/95 px-3 py-2 rounded-full flex items-center justify-center gap-1.5 w-[92%] shadow-[0_8px_20px_-6px_rgba(0,0,0,0.12)] border border-[#EFECE8] shrink-0 transform hover:scale-[1.02] transition-transform">
                      <div className="bg-brand-ink rounded-full w-[14px] h-[14px] flex items-center justify-center shrink-0">
                         <Share2 size={7} className="text-white" strokeWidth={3} />
                      </div>
                      <span className="text-[8px] font-bold text-brand-ink truncate tracking-tight">
                        {profileUrl.replace('https://', '').replace('http://', '').replace('www.', '')}
                      </span>
                    </div>

                    {/* Footer Signature */}
                    <div className="mt-0.5 items-center justify-center flex opacity-30">
                       <span className="text-[3.5px] font-bold text-brand-stone tracking-[0.4em] uppercase">Nera • Agendamento Online</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION */}
              <div className="flex-1 min-w-0 flex flex-col justify-between w-full text-center sm:text-left py-2 sm:py-4">
                <div className="space-y-2.5 max-w-[280px] mx-auto sm:max-w-none sm:mx-0">
                  <p className="text-sm sm:text-base font-serif font-medium text-brand-ink leading-snug">
                    Sua vitrine pronta para circular.
                  </p>
                  <p className="text-[12px] sm:text-[13px] text-brand-stone leading-relaxed px-2 sm:px-0">
                    Baixe e publique nos Stories para levar clientes direto ao seu agendamento.
                  </p>
                </div>

                <div className="mt-6 sm:mt-auto pt-4">
                  <button
                    onClick={() => handleDownloadStoryCard()}
                    disabled={isGeneratingStory}
                    className="w-full py-2.5 sm:py-3 bg-brand-ink text-white rounded-[12px] text-[11px] font-bold uppercase tracking-widest hover:bg-brand-ink/90 hover:shadow-md active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:shadow-none"
                  >
                  {isGeneratingStory ? (
                    <span className="flex items-center gap-2">Gerando imagem...</span>
                  ) : (
                    <>
                      <Download size={14} />
                      Baixar Imagem
                    </>
                  )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* QR CODE COMPACTO */}
          <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-brand-mist shadow-sm">
             <details className="w-full group cursor-pointer">
                <summary className="list-none w-full flex items-center justify-between outline-none">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-linen rounded-full flex items-center justify-center text-brand-ink">
                      <QrCode size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-brand-ink uppercase tracking-widest">Materiais para imprimir</h3>
                      <p className="text-[10px] text-brand-stone font-light italic mt-0.5">
                        QR Code da sua vitrine
                      </p>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full border border-brand-mist flex items-center justify-center group-open:rotate-180 transition-transform">
                    <ChevronDown size={14} className="text-brand-stone" />
                  </div>
                </summary>
                
                <div className="pt-4 mt-4 border-t border-brand-mist/50 flex flex-col items-center animate-in fade-in duration-300">
                  <div 
                    ref={qrRef}
                    className="p-3 bg-white border-2 border-brand-mist rounded-xl mb-4 shadow-sm inline-block"
                  >
                    <QRCodeSVG 
                      value={profileUrl} 
                      size={120}
                      bgColor="#ffffff"
                      fgColor="#2B2B2B"
                      level="Q"
                      includeMargin={false}
                    />
                  </div>

                  <button
                    onClick={handleDownloadQR}
                    className="px-5 py-2.5 bg-brand-ink text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-ink/90 transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={14} />
                    Baixar Imagem
                  </button>
                </div>
              </details>
          </div>
        </div>
      </div>
      
    </div>
  );
}
