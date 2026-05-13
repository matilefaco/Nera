import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Copy, MessageCircle, Instagram, QrCode, Download, Check, Share2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [copiedStory, setCopiedStory] = useState<number | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const handleCopyText = (text: string, type: 'template' | 'story', index: number) => {
    navigator.clipboard.writeText(text);
    notify.success('Copiado!');
    if (type === 'template') {
      setCopiedTemplate(index);
      setTimeout(() => setCopiedTemplate(null), 2000);
    } else {
      setCopiedStory(index);
      setTimeout(() => setCopiedStory(null), 2000);
    }
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

  const storyIdeas = [
    "Agenda aberta da semana ✨",
    "Agora dá pra agendar online 🤎",
    "Escolha seu horário direto pelo link",
    "Minha agenda online já está no ar"
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
              onClick={() => handleCopyText(whatsappTemplates[0], 'template', 0)}
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
          <div className="bg-white rounded-[24px] p-5 sm:p-6 border border-brand-mist shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#962FBF] rounded-full flex items-center justify-center text-white">
                <Instagram size={16} />
              </div>
              <div>
                <h3 className="text-base font-serif text-brand-ink">Stories prontos</h3>
                <p className="text-[10px] text-brand-stone font-light italic">Use no Instagram com o adesivo de link.</p>
              </div>
            </div>

            <div className="flex gap-4">
              {/* MOCKUP DO STORY */}
              <div className="w-[90px] h-[160px] bg-brand-linen/40 rounded-2xl border border-brand-mist/50 p-2 relative flex flex-col items-center justify-center overflow-hidden shrink-0">
                <div className="w-full h-full bg-white rounded-lg shadow-sm border border-brand-mist/30 flex flex-col items-center p-2 relative">
                   <div className="w-6 h-6 bg-brand-linen rounded-full mb-1"></div>
                   <div className="w-10 h-1.5 bg-brand-mist/50 rounded-full mb-1"></div>
                   <div className="w-14 h-1 bg-brand-mist/30 rounded-full mb-3"></div>

                   {/* Fake Link Sticker */}
                   <div className="mt-auto bg-blue-50 text-blue-600 px-1.5 py-1 rounded flex items-center gap-1 w-full max-w-full overflow-hidden justify-center shadow-sm border border-blue-100">
                     <Share2 size={6} className="shrink-0" />
                     <span className="text-[5px] font-medium truncate">{profileUrl.replace('https://','').replace('http://','')}</span>
                   </div>
                </div>
              </div>

              {/* LEGENDS */}
              <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
                <p className="text-[9px] font-bold text-brand-stone uppercase tracking-widest pl-1 mb-1">Legendas sugeridas</p>
                {storyIdeas.slice(0, 3).map((idea, index) => (
                  <div key={index} className="flex items-center justify-between px-3 py-2 bg-brand-linen/30 rounded-xl border border-brand-mist/50 gap-2">
                    <span className="text-[10px] text-brand-ink font-medium leading-tight truncate">{idea}</span>
                    <button
                      onClick={() => handleCopyText(idea, 'story', index)}
                      className="w-6 h-6 flex items-center justify-center text-brand-stone hover:text-brand-ink transition-colors bg-white rounded-full shadow-sm shrink-0"
                    >
                      {copiedStory === index ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                ))}
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
