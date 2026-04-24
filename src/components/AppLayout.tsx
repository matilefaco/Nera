import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, Users, LogOut, 
  Settings, List, TrendingUp
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../AuthContext';
import Logo from './Logo';
import MobileNav from './MobileNav';
import { cn } from '../lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  activeRoute?: string;
}

export default function AppLayout({ children, activeRoute }: AppLayoutProps) {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.docs.length);
    });

    return () => unsubscribe();
  }, [user]);

  const navItems = [
    { title: 'Painel', icon: TrendingUp, path: '/dashboard', id: 'dashboard' },
    { title: 'Agenda', icon: Calendar, path: '/agenda', id: 'agenda', hasBadge: true },
    { title: 'Clientes', icon: Users, path: '/clients', id: 'clients' },
    { title: 'Serviços', icon: List, path: '/services', id: 'services' },
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
        
        <div className="mt-auto pt-8 border-t border-brand-mist">
          <button 
            onClick={() => auth.signOut()}
            className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:text-brand-terracotta transition-all text-[11px] font-medium uppercase tracking-widest w-full"
          >
            <LogOut size={18} /> Sair
          </button>
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
