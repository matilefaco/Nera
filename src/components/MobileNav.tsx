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
    { icon: LayoutDashboard, label: 'Início', path: '/dashboard' },
    { icon: Calendar, label: 'Agenda', path: '/agenda' },
    { icon: Users, label: 'Clientes', path: '/clients' },
    { icon: List, label: 'Serviços', path: '/services' },
    { icon: User, label: 'Perfil', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-brand-rose/10 px-6 py-3 flex items-center justify-between z-50 md:hidden pb-safe">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        
        return (
          <Link 
            key={item.path} 
            to={item.path}
            className={`flex flex-col items-center gap-1 transition-all ${isActive ? 'text-brand-rose scale-110' : 'text-brand-gray'}`}
          >
            <div className={`p-2 rounded-xl ${isActive ? 'bg-brand-rose-light/50' : ''}`}>
              <Icon size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
