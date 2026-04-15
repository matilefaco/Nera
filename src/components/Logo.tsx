import React from 'react';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  variant?: 'light' | 'dark' | 'terracotta';
}

export default function Logo({ className = "w-8 h-8", iconOnly = false, variant = 'light' }: LogoProps) {
  const bgColors = {
    light: 'bg-brand-linen',
    dark: 'bg-brand-espresso',
    terracotta: 'bg-brand-terracotta/10'
  };

  const strokeColors = {
    light: 'stroke-brand-ink',
    dark: 'stroke-brand-white',
    terracotta: 'stroke-brand-terracotta'
  };

  const dotColors = {
    light: 'fill-brand-terracotta',
    dark: 'fill-brand-sienna',
    terracotta: 'fill-brand-terracotta'
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${bgColors[variant]}`}>
        <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
          <path 
            d="M10 26V10L26 26V10" 
            className={strokeColors[variant]} 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
          <circle cx="28" cy="28" r="3.5" className={dotColors[variant]} />
        </svg>
      </div>
      {!iconOnly && (
        <span className={`font-serif text-2xl tracking-[0.06em] leading-none pt-1 ${variant === 'dark' ? 'text-brand-white' : 'text-brand-ink'}`}>
          nera
        </span>
      )}
    </div>
  );
}
