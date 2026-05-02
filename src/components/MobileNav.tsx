import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  List, 
  User 
} from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../AuthContext';

export default function MobileNav() {
  const location = useLocation();
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
    { icon: LayoutDashboard, label: 'Painel', path: '/dashboard', id: 'dashboard' },
    { icon: Calendar, label: 'Agenda', path: '/agenda', id: 'agenda' },
    { icon: Users, label: 'Clientes', path: '/clients', id: 'clients' },
    { icon: List, label: 'Serviços', path: '/services', id: 'services' },
    { icon: User, label: 'Perfil', path: '/profile', id: 'profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-brand-white border-t border-brand-mist px-6 py-2 flex items-center justify-between z-[100] md:hidden pb-[calc(10px+env(safe-area-inset-bottom))] h-[72px] shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        
        return (
          <Link 
            key={item.path} 
            to={item.path}
            className={`flex flex-col items-center gap-1 transition-all ${isActive ? 'text-brand-terracotta scale-110' : 'text-brand-stone'}`}
          >
            <div className={`p-2 rounded-2xl relative ${isActive ? 'bg-brand-linen' : ''}`}>
              <Icon size={20} />
              {item.id === 'agenda' && pendingCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-brand-white rounded-full" />
              )}
            </div>
            <span className="text-[9px] font-medium uppercase tracking-widest">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
