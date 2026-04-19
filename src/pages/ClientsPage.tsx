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
import { formatCurrency, buildWhatsappLink } from '../lib/utils';
import Logo from '../components/Logo';
import AppLayout from '../components/AppLayout';
import AppLoadingScreen from '../components/AppLoadingScreen';
import { Appointment } from '../types';

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Aggregate from appointments to show LTV
    const q = query(
      collection(db, 'appointments'),
      where('professionalId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const appointments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
        
        // Aggregate by phone
        const clientMap = new Map();
        
        appointments.forEach((app) => {
          // Use whatsapp as key, fallback to a derived key if missing
          const key = app.clientWhatsapp?.replace(/\D/g, '') || app.clientEmail || `anon-${app.clientName}`;
          
          if (!clientMap.has(key)) {
            clientMap.set(key, {
              id: key,
              name: app.clientName || 'Cliente sem nome',
              phone: app.clientWhatsapp || '',
              email: app.clientEmail || '',
              totalSpent: 0,
              appointmentsCount: 0,
              lastAppointment: app.date,
              servicesList: new Set<string>()
            });
          }
          
          const client = clientMap.get(key);
          
          // Only add value if confirmed or completed
          if (app.status === 'confirmed' || app.status === 'completed') {
            client.totalSpent += (app.price || 0) + (app.travelFee || 0);
          }
          
          client.appointmentsCount += 1;
          if (app.serviceName) client.servicesList.add(app.serviceName);
          
          try {
            if (app.date && (!client.lastAppointment || new Date(app.date) > new Date(client.lastAppointment))) {
              client.lastAppointment = app.date;
            }
          } catch (e) {
            // Safe date parsing
          }
        });

        const aggregatedClients = Array.from(clientMap.values())
          .map(c => ({ 
            ...c, 
            services: Array.from(c.servicesList as Set<string>).slice(0, 2) // Top 2 services
          }))
          .sort((a, b) => b.totalSpent - a.totalSpent);
          
        setClients(aggregatedClients);
      } catch (err) {
        console.error('[ClientsPage] Aggregate Error:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <AppLayout activeRoute="clients">
      <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full">
        <header className="mb-12">
          <h1 className="text-4xl font-serif font-normal text-brand-ink mb-2">Seus Relacionamentos</h1>
          <p className="text-brand-stone font-light">Conexões valiosas para a sua marca.</p>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm">
            <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest mb-1">Base de Relacionamentos</p>
            <p className="text-3xl font-serif text-brand-ink">{clients.length}</p>
          </div>
          <div className="bg-brand-white p-6 rounded-[32px] border border-brand-mist shadow-sm">
            <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest mb-1">Clientes Fidelizadas</p>
            <p className="text-3xl font-serif text-brand-terracotta">{clients.filter(c => c.totalSpent > 1000).length}</p>
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
          {loading ? (
            <AppLoadingScreen fullScreen={false} message="Preparando suas conexões..." />
          ) : filteredClients.length > 0 ? (
            filteredClients.map((client, idx) => (
              <motion.div 
                key={client.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-brand-white p-5 md:p-6 rounded-[32px] border border-brand-mist flex items-center justify-between hover:border-brand-stone transition-all shadow-sm group"
              >
                <div className="flex items-center gap-4 md:gap-6 overflow-hidden">
                  <div className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-[20px] bg-brand-linen flex items-center justify-center text-brand-terracotta border border-brand-mist shadow-inner">
                    <span className="font-serif text-xl md:text-2xl">{client.name[0]}</span>
                  </div>
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-serif text-lg md:text-xl text-brand-ink truncate">{client.name}</h4>
                      {client.totalSpent > 1000 && (
                        <div className="bg-brand-terracotta/10 text-brand-terracotta p-1 rounded-full border border-brand-terracotta/20" title="Cliente VIP">
                          <Star size={10} className="fill-brand-terracotta" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] md:text-[10px] text-brand-stone font-medium uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><Calendar size={12} className="text-brand-terracotta"/> {client.appointmentsCount} visitas</span>
                      <span className="text-brand-ink font-semibold">{formatCurrency(client.totalSpent)}</span>
                      {client.services && client.services.length > 0 && (
                        <span className="hidden sm:inline italic text-brand-stone/60 truncate max-w-[150px]">
                          • {client.services.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
                  <a 
                    href={buildWhatsappLink(client.phone)}
                    target="_blank"
                    className="p-3 md:p-4 text-brand-ink hover:bg-green-50 hover:text-green-600 rounded-2xl transition-all border border-transparent hover:border-green-100"
                  >
                    <MessageCircle size={20} />
                  </a>
                  <button className="hidden md:flex p-4 text-brand-stone hover:bg-brand-linen rounded-2xl transition-all border border-transparent hover:border-brand-mist">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-20 md:py-32 bg-brand-white/50 rounded-[40px] border border-dashed border-brand-mist px-6">
              <Users size={40} className="text-brand-mist mx-auto mb-6 opacity-50" />
              <p className="text-brand-stone font-serif italic text-lg font-light mb-2">Suas conexões começarão por aqui.</p>
              <p className="text-[10px] text-brand-stone uppercase tracking-widest max-w-xs mx-auto">Seus relacionamentos aparecerão aqui conforme você agendar e atender.</p>
            </div>
          )}
        </div>
      </main>

      </AppLayout>
  );
}
