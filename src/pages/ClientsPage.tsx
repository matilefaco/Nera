import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  Users, Search, Phone, MessageCircle, 
  TrendingUp, Calendar, ChevronRight, Star
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import MobileNav from '../components/MobileNav';

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
      const appointments = snapshot.docs.map(doc => doc.data());
      
      // Aggregate by phone (unique identifier for client in this simple model)
      const clientMap = new Map();
      
      appointments.forEach((app: any) => {
        const key = app.clientPhone;
        if (!clientMap.has(key)) {
          clientMap.set(key, {
            name: app.clientName,
            phone: app.clientPhone,
            totalSpent: 0,
            appointmentsCount: 0,
            lastAppointment: app.date,
            services: new Set()
          });
        }
        
        const client = clientMap.get(key);
        if (app.status === 'confirmed') {
          client.totalSpent += (app.price || 0);
        }
        client.appointmentsCount += 1;
        client.services.add(app.serviceName);
        if (new Date(app.date) > new Date(client.lastAppointment)) {
          client.lastAppointment = app.date;
        }
      });

      setClients(Array.from(clientMap.values()).sort((a, b) => b.totalSpent - a.totalSpent));
    });

    return () => unsubscribe();
  }, [user]);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="min-h-screen bg-brand-cream pb-24 md:pb-0 md:flex">
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex w-64 bg-white border-r border-brand-rose/10 p-6 flex-col">
        <div className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 bg-brand-rose rounded-lg flex items-center justify-center text-white">
            <Users size={18} />
          </div>
          <span className="text-xl font-serif italic font-bold">Marca Aí</span>
        </div>
        <nav className="flex-1 space-y-2">
          {/* Reuse nav from Dashboard or create a shared component */}
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full">
        <header className="mb-12">
          <h1 className="text-3xl font-serif italic font-bold mb-1">Suas Clientes</h1>
          <p className="text-brand-gray">Quem faz o seu negócio crescer todos os dias.</p>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl border border-brand-rose/10 premium-shadow">
            <p className="text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-1">Total Clientes</p>
            <p className="text-2xl font-bold text-brand-dark">{clients.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-brand-rose/10 premium-shadow">
            <p className="text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-1">Clientes VIP</p>
            <p className="text-2xl font-bold text-brand-rose">{clients.filter(c => c.totalSpent > 500).length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou telefone..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-white rounded-2xl border border-brand-rose/10 outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all"
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
                className="bg-white p-5 rounded-3xl border border-brand-rose/5 flex items-center justify-between hover:border-brand-rose/20 transition-all premium-shadow group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-brand-cream flex items-center justify-center text-brand-rose font-bold text-xl">
                    {client.name[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-lg">{client.name}</h4>
                      {client.totalSpent > 500 && <Star size={14} className="fill-brand-rose text-brand-rose" />}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-brand-gray font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {client.appointmentsCount} visitas</span>
                      <span className="text-brand-rose">{formatCurrency(client.totalSpent)} total</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <a 
                    href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                    className="p-3 hover:bg-green-50 rounded-2xl text-green-600 transition-all"
                  >
                    <MessageCircle size={20} />
                  </a>
                  <button className="p-3 hover:bg-brand-cream rounded-2xl text-brand-gray transition-all">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-brand-rose/10">
              <Users size={40} className="text-brand-rose/30 mx-auto mb-4" />
              <p className="text-brand-gray font-serif italic">Nenhuma cliente encontrada.</p>
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
