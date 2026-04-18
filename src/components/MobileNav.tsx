import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  List, 
  User 
} from 'lucide-react';

export default function MobileNav() {
  const location = useLocation();
  
  const navItems = [
    { icon: LayoutDashboard, label: 'Painel', path: '/dashboard' },
    { icon: Calendar, label: 'Agenda', path: '/agenda' },
    { icon: Users, label: 'Relacionamentos', path: '/clients' },
    { icon: List, label: 'Experiências', path: '/services' },
    { icon: User, label: 'Minha Marca', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-brand-white/80 backdrop-blur-xl border-t border-brand-mist px-6 py-3 flex items-center justify-between z-50 md:hidden pb-safe">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        
        return (
          <Link 
            key={item.path} 
            to={item.path}
            className={`flex flex-col items-center gap-1 transition-all ${isActive ? 'text-brand-terracotta scale-110' : 'text-brand-stone'}`}
          >
            <div className={`p-2 rounded-2xl ${isActive ? 'bg-brand-linen' : ''}`}>
              <Icon size={20} />
            </div>
            <span className="text-[9px] font-medium uppercase tracking-widest">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
