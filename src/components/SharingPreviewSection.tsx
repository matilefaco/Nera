import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Copy, ExternalLink, MessageCircle, Instagram, QrCode, Download, Check, Share2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { UserProfile } from '../types';
import { notify } from '../lib/notify';
import { cn } from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';

interface SharingPreviewSectionProps {
  profile: UserProfile;
}

export function SharingPreviewSection({ profile }: SharingPreviewSectionProps) {
  const profileUrl = `https://usenera.com/p/${profile.slug}`;
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState<number | null>(null);
  const [copiedStory, setCopiedStory] = useState<number | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopiedLink(true);
    notify.success('Link copiado!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

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
    <div className="space-y-8 pb-10">
      
      {/* 1. SEU LINK */}
      <div className="bg-white rounded-[32px] p-8 border border-brand-mist shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-linen rounded-full flex items-center justify-center text-brand-terracotta">
            <Share2 size={20} />
          </div>
          <div>
            <h3 className="text-xl font-serif text-brand-ink">Seu Link</h3>
            <p className="text-xs text-brand-stone font-light italic">Esse é o seu endereço oficial de agendamentos.</p>
          </div>
        </div>

        <div className="bg-brand-linen/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 justify-between border border-brand-mist">
          <div className="text-sm font-medium text-brand-ink truncate">
            {profileUrl}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyLink}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all flex items-center gap-2",
                copiedLink ? "bg-green-500 text-white" : "bg-white text-brand-ink border border-brand-mist hover:bg-brand-linen"
              )}
            >
              {copiedLink ? <Check size={14} /> : <Copy size={14} />}
              {copiedLink ? "Copiado" : "Copiar"}
            </button>
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-brand-ink text-white rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-brand-ink/90 transition-all flex items-center gap-2"
            >
              <ExternalLink size={14} />
              Abrir
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* 2. TEMPLATES WHATSAPP */}
        <div className="bg-white rounded-[32px] p-8 border border-brand-mist shadow-sm flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#E8F8EE] rounded-full flex items-center justify-center text-[#25D366]">
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-serif text-brand-ink">Mensagem pronta para clientes</h3>
              <p className="text-[11px] text-brand-stone font-light italic">Copie e envie no WhatsApp.</p>
            </div>
          </div>

          <div className="flex-1 space-y-4">
            {whatsappTemplates.map((template, index) => (
              <div key={index} className="bg-[#F0F2F5]/80 p-4 rounded-2xl border border-brand-mist/50 relative group">
                <p className="text-[13px] text-[#111b21] whitespace-pre-wrap font-sans pr-10">{template}</p>
                <button
                  onClick={() => handleCopyText(template, 'template', index)}
                  className="absolute right-3 top-3 p-2 bg-white rounded-full shadow-sm text-brand-stone hover:text-brand-ink transition-all"
                  title="Copiar mensagem"
                >
                  {copiedTemplate === index ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
            ))}
          </div>

          <a 
            href={`https://wa.me/?text=${defaultWhatsappShare}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 w-full py-4 bg-[#25D366] text-white rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:bg-[#20BE5C] shadow-lg shadow-[#25D366]/20"
          >
            <MessageCircle size={16} />
            Compartilhar no WhatsApp
          </a>
        </div>

        {/* 3. STORIES E QR CODE */}
        <div className="space-y-8 flex flex-col">
          {/* STORIES */}
          <div className="bg-white rounded-[32px] p-8 border border-brand-mist shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#962FBF] rounded-full flex items-center justify-center text-white">
                <Instagram size={20} />
              </div>
              <div>
                <h3 className="text-lg font-serif text-brand-ink">Ideias para Stories</h3>
                <p className="text-[11px] text-brand-stone font-light italic">Adicione no Instagram com o adesivo de Link.</p>
              </div>
            </div>

            <div className="space-y-3">
              {storyIdeas.map((idea, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-brand-linen/30 rounded-xl border border-brand-mist/50 gap-4">
                  <span className="text-[13px] text-brand-ink font-medium">{idea}</span>
                  <button
                    onClick={() => handleCopyText(idea, 'story', index)}
                    className="p-1.5 text-brand-stone hover:text-brand-ink transition-colors flex items-center justify-center gap-1 bg-white rounded-md border border-brand-mist shrink-0 min-w-[70px]"
                  >
                    {copiedStory === index ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    <span className="text-[9px] font-bold uppercase">{copiedStory === index ? "Copiado" : "Copiar"}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* QR CODE */}
          <div className="bg-white rounded-[32px] p-8 border border-brand-mist shadow-sm flex-1 flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex flex-col items-center">
              <h3 className="text-lg font-serif text-brand-ink">QR Code Elegante</h3>
              <p className="text-[11px] text-brand-stone font-light italic max-w-[220px] mx-auto mt-1">
                Deixe no seu espaço para clientes agendarem pelo celular.
              </p>
            </div>

            <div 
              ref={qrRef}
              className="p-4 bg-white border-2 border-brand-mist rounded-2xl mb-6 shadow-sm inline-block"
            >
              <QRCodeSVG 
                value={profileUrl} 
                size={140}
                bgColor="#ffffff"
                fgColor="#2B2B2B"
                level="Q"
                includeMargin={false}
              />
            </div>

            <button
              onClick={handleDownloadQR}
              className="px-6 py-3 w-full sm:w-auto bg-brand-linen text-brand-ink rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-brand-parchment transition-all flex items-center justify-center gap-2 mt-auto border border-brand-mist"
            >
              <Download size={14} />
              Baixar QR Code
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
}
