import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, Users, LogOut, Gift,
  Settings, List, TrendingUp, User, ChevronDown, Shield, Key, Tag, DollarSign
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import { usePendingAppointments } from '../contexts/PendingAppointmentsContext';
import Logo from './Logo';
import MobileNav from './MobileNav';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';

interface AppLayoutProps {
  children: React.ReactNode;
  activeRoute?: string;
}

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in ms

export default function AppLayout({ children, activeRoute }: AppLayoutProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { pendingCount } = usePendingAppointments();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  // Session Timeout Logic
  useEffect(() => {
    if (!user) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout('Sua sessão expirou por inatividade.');
      }, SESSION_TIMEOUT);
    };

    // Events to track activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  const handleLogout = async (message?: string) => {
    try {
      await signOut(auth);
      if (message) {
        // We can't use toast easily if we are redirecting immadiately in some cases,
        // but sonner is quite resilient.
      }
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const navItems = [
    { title: 'Painel', icon: TrendingUp, path: '/dashboard', id: 'dashboard', hasBadge: true },
    { title: 'Agenda', icon: Calendar, path: '/agenda', id: 'agenda' },
    { title: 'Clientes', icon: Users, path: '/clients', id: 'clients' },
    { title: 'Financeiro', icon: DollarSign, path: '/financeiro', id: 'financial' },
    { title: 'Serviços', icon: List, path: '/services', id: 'services' },
    { title: 'Cupons', icon: Tag, path: '/cupons', id: 'coupons' },
    { title: 'Indicações', icon: Gift, path: '/indicacoes', id: 'referrals' },
    { title: 'Perfil', icon: Settings, path: '/profile', id: 'profile' },
  ];

  return (
    <div className="h-screen flex flex-col md:flex-row bg-brand-parchment overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 bg-brand-white border-r border-brand-mist p-8 flex-col shrink-0">
        <div className="mb-12">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = activeRoute === item.id;
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.id}
                to={item.path} 
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-2xl text-[11px] font-medium uppercase tracking-widest transition-all group relative",
                  isActive 
                    ? "bg-brand-linen text-brand-ink" 
                    : "text-brand-stone hover:bg-brand-parchment"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={cn("transition-colors", isActive ? "text-brand-terracotta" : "group-hover:text-brand-terracotta")} />
                  {item.title}
                </div>
                {item.hasBadge && pendingCount > 0 && (
                  <span className="w-5 h-5 bg-brand-terracotta text-white text-[9px] rounded-full flex items-center justify-center font-bold animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        
        <div className="mt-auto pt-8 border-t border-brand-mist space-y-2">
          {/* Account Menu */}
          <div className="relative">
            <button 
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className={cn(
                "flex items-center justify-between w-full px-4 py-3 rounded-2xl transition-all cursor-pointer",
                isAccountMenuOpen ? "bg-brand-parchment" : "hover:bg-brand-parchment/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-linen flex items-center justify-center border border-brand-terracotta/20 overflow-hidden shrink-0">
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={14} className="text-brand-stone" />
                  )}
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[10px] font-bold text-brand-ink truncate leading-tight">{profile?.name || 'Profissional'}</p>
                  <p className="text-[8px] text-brand-stone uppercase tracking-widest truncate">Minha Conta</p>
                </div>
              </div>
              <ChevronDown size={14} className={cn("text-brand-stone transition-transform", isAccountMenuOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isAccountMenuOpen && (
                <>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute bottom-full left-0 w-full mb-2 bg-brand-white border border-brand-mist rounded-2xl shadow-xl overflow-hidden z-[100]"
                  >
                    <div className="p-2 space-y-1">
                      <Link 
                        to="/profile" 
                        onClick={() => setIsAccountMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 text-[10px] font-medium text-brand-stone hover:text-brand-ink hover:bg-brand-parchment rounded-xl transition-all"
                      >
                        <User size={16} /> Editar Perfil
                      </Link>
                      <button 
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          // Future: Settings page or section
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 text-[10px] font-medium text-brand-stone hover:text-brand-ink hover:bg-brand-parchment rounded-xl transition-all w-full text-left"
                      >
                        <Shield size={16} /> Configurações
                      </button>
                      <button 
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          // Future: Password change flow
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 text-[10px] font-medium text-brand-stone hover:text-brand-ink hover:bg-brand-parchment rounded-xl transition-all w-full text-left"
                      >
                        <Key size={16} /> Trocar Senha
                      </button>
                      <div className="h-px bg-brand-mist mx-2 my-1" />
                      <button 
                        onClick={() => handleLogout()}
                        className="flex items-center gap-3 px-3 py-2.5 text-[10px] font-medium text-red-500 hover:bg-red-50 rounded-xl transition-all w-full text-left"
                      >
                        <LogOut size={16} /> Sair da conta
                      </button>
                    </div>
                  </motion.div>
                  {/* Backdrop for closing */}
                  <div 
                    className="fixed inset-0 z-[90]" 
                    onClick={() => setIsAccountMenuOpen(false)}
                  />
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 relative overflow-y-auto overflow-x-hidden no-scrollbar">
        <div className="pb-32 md:pb-12">
          {children}
        </div>
      </main>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}
