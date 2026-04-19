import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, Users, LogOut, 
  Settings, List, TrendingUp
} from 'lucide-react';
import { auth } from '../firebase';
import Logo from './Logo';
import MobileNav from './MobileNav';
import { cn } from '../lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  activeRoute?: string;
}

export default function AppLayout({ children, activeRoute }: AppLayoutProps) {
  const navItems = [
    { title: 'Painel', icon: TrendingUp, path: '/dashboard', id: 'dashboard' },
    { title: 'Agenda', icon: Calendar, path: '/agenda', id: 'agenda' },
    { title: 'Relacionamentos', icon: Users, path: '/clients', id: 'clients' },
    { title: 'Experiências', icon: List, path: '/services', id: 'services' },
    { title: 'Minha Marca', icon: Settings, path: '/profile', id: 'profile' },
  ];

  return (
    <div className="min-h-screen bg-brand-parchment pb-24 md:pb-0 md:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 bg-brand-white border-r border-brand-mist p-8 flex-col sticky top-0 h-screen">
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
                  "flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-medium uppercase tracking-widest transition-all group",
                  isActive 
                    ? "bg-brand-linen text-brand-ink" 
                    : "text-brand-stone hover:bg-brand-parchment"
                )}
              >
                <Icon size={18} className={cn("transition-colors", isActive ? "text-brand-terracotta" : "group-hover:text-brand-terracotta")} />
                {item.title}
              </Link>
            );
          })}
        </nav>
        
        <div className="mt-auto pt-8 border-t border-brand-mist">
          <button 
            onClick={() => auth.signOut()}
            className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:text-brand-terracotta transition-all text-[11px] font-medium uppercase tracking-widest w-full"
          >
            <LogOut size={18} /> Encerrar Sessão
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </div>

      {/* Mobile Navigation */}
      <MobileNav />
    </div>
  );
}
