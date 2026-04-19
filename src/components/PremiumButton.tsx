import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

interface PremiumButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'terracotta' | 'ink' | 'linen' | 'outline';
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  type?: 'button' | 'submit' | 'reset';
}

const PremiumButton = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className, 
  disabled, 
  loading, 
  loadingText,
  type = 'button'
}: PremiumButtonProps) => {
  const variants = {
    primary: "bg-brand-ink text-brand-white hover:bg-brand-ink/90",
    secondary: "bg-brand-linen text-brand-ink hover:bg-brand-mist/50",
    terracotta: "bg-brand-terracotta text-brand-white hover:bg-brand-terracotta/90 premium-shadow",
    ink: "bg-brand-ink text-brand-white hover:bg-brand-ink/95 shadow-xl",
    linen: "bg-brand-linen text-brand-stone hover:text-brand-ink border border-brand-mist",
    outline: "bg-transparent border border-brand-mist text-brand-stone hover:border-brand-ink hover:text-brand-ink"
  };

  return (
    <motion.button
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      className={cn(
        "px-10 py-5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" size={16} />
          <span>{loadingText || 'Carregando...'}</span>
        </>
      ) : children}
    </motion.button>
  );
};

export default PremiumButton;
