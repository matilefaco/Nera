import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  Users, Search, Phone, MessageCircle, 
  TrendingUp, Calendar, ChevronRight, Star,
  List, Settings
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';
import Logo from '../components/Logo';
import MobileNav from '../components/MobileNav';
import { Appointment } from '../types';

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;

    // In a real app, we'd have a 'clients' collection or aggregate from appointments
    // For now, let's aggregate from appointments to show LTV
    const q = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
        
        // Aggregate by phone (unique identifier for client)
        const clientMap = new Map();
        
        appointments.forEach((app) => {
          const key = app.clientWhatsapp || 'unknown';
          if (!clientMap.has(key)) {
            clientMap.set(key, {
              name: app.clientName || 'Cliente sem nome',
              phone: app.clientWhatsapp || '',
              email: app.clientEmail || '',
              totalSpent: 0,
              appointmentsCount: 0,
              lastAppointment: app.date,
              services: new Set<string>()
            });
          }
          
          const client = clientMap.get(key);
          if (app.status === 'confirmed') {
            client.totalSpent += (app.price || 0);
          }
          client.appointmentsCount += 1;
          if (app.serviceName) client.services.add(app.serviceName);
          
          try {
            if (new Date(app.date) > new Date(client.lastAppointment)) {
              client.lastAppointment = app.date;
            }
          } catch {
            // Ignore date errors
          }
        });

        const aggregatedClients = Array.from(clientMap.values())
          .map(c => ({ ...c, servicesList: Array.from(c.services) }))
          .sort((a, b) => b.totalSpent - a.totalSpent);
          
        setClients(aggregatedClients);
      } catch (err) {
        console.error('[ClientsPage] Error aggregating clients:', err);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="min-h-screen bg-brand-parchment pb-24 md:pb-0 md:flex">
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex w-64 bg-brand-white border-r border-brand-mist p-8 flex-col">
        <div className="mb-12">
          <Logo />
        </div>
        <nav className="flex-1 space-y-2">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-xl font-medium text-sm transition-all">
            <Calendar size={18} /> Dashboard
          </Link>
          <Link to="/agenda" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-xl font-medium text-sm transition-all">
            <Calendar size={18} /> Agenda
          </Link>
          <Link to="/clients" className="flex items-center gap-3 px-4 py-3 bg-brand-linen text-brand-ink rounded-xl font-medium text-sm transition-all">
            <Users size={18} /> Clientes
          </Link>
          <Link to="/services" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-xl font-medium text-sm transition-all">
            <List size={18} /> Serviços
          </Link>
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-xl font-medium text-sm transition-all">
            <Settings size={18} /> Perfil
          </Link>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full">
        <header className="mb-12">
          <h1 className="text-4xl font-serif font-normal text-brand-ink mb-2">Suas Clientes</h1>
          <p className="text-brand-stone font-light">Quem faz o seu negócio crescer todos os dias.</p>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm">
            <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest mb-1">Total Clientes</p>
            <p className="text-3xl font-serif text-brand-ink">{clients.length}</p>
          </div>
          <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm">
            <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest mb-1">Clientes VIP</p>
            <p className="text-3xl font-serif text-brand-terracotta">{clients.filter(c => c.totalSpent > 500).length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-10">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou telefone..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-brand-white rounded-[24px] border border-brand-mist outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
          />
        </div>

        {/* Clients List */}
        <div className="space-y-4">
          {filteredClients.length > 0 ? (
            filteredClients.map((client, idx) => (
              <motion.div 
                key={client.phone}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-brand-white p-6 rounded-[32px] border border-brand-mist flex items-center justify-between hover:border-brand-stone transition-all shadow-sm group"
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[20px] bg-brand-parchment flex items-center justify-center text-brand-terracotta font-serif text-2xl border border-brand-mist">
                    {client.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="font-serif text-xl text-brand-ink">{client.name}</h4>
                      {client.totalSpent > 500 && <Star size={14} className="fill-brand-terracotta text-brand-terracotta" />}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-brand-stone font-medium uppercase tracking-widest mt-1">
                      <span className="flex items-center gap-1.5"><Calendar size={12} /> {client.appointmentsCount} visitas</span>
                      <span className="text-brand-terracotta">{formatCurrency(client.totalSpent)} total</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <a 
                    href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                    className="p-4 hover:bg-brand-linen rounded-2xl text-brand-ink transition-all border border-transparent hover:border-brand-mist"
                  >
                    <MessageCircle size={20} />
                  </a>
                  <button className="p-4 hover:bg-brand-linen rounded-2xl text-brand-stone transition-all border border-transparent hover:border-brand-mist">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-24 bg-brand-white/50 rounded-[40px] border border-dashed border-brand-mist">
              <Users size={40} className="text-brand-mist mx-auto mb-6" />
              <p className="text-brand-stone font-serif italic text-lg font-light">Nenhuma cliente encontrada.</p>
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
