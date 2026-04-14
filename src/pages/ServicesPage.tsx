import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { 
  Calendar, List, Plus, Trash2, Edit2, X, Clock, 
  DollarSign, Settings, Sparkles, ChevronRight, Info, Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCurrency } from '../lib/utils';
import MobileNav from '../components/MobileNav';

export default function ServicesPage() {
  const { user } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('60');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'services'), where('professionalId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const serviceData = {
        professionalId: user?.uid,
        name,
        description,
        duration: Number(duration),
        price: Number(price),
        category,
        active: true,
      };
      if (editingId) {
        await updateDoc(doc(db, 'services', editingId), serviceData);
        toast.success('Serviço atualizado!');
      } else {
        await addDoc(collection(db, 'services'), serviceData);
        toast.success('Serviço adicionado!');
      }
      closeModal();
    } catch (error) {
      toast.error('Erro ao salvar serviço');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!serviceToDelete) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'services', serviceToDelete));
      toast.success('Serviço excluído');
      setIsDeleteModalOpen(false);
      setServiceToDelete(null);
    } catch (error) {
      toast.error('Erro ao excluir');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (id: string) => {
    setServiceToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const openEdit = (service: any) => {
    setEditingId(service.id);
    setName(service.name);
    setDescription(service.description);
    setDuration(service.duration.toString());
    setPrice(service.price.toString());
    setCategory(service.category);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setName('');
    setDescription('');
    setDuration('60');
    setPrice('');
    setCategory('');
  };

  return (
    <div className="min-h-screen bg-brand-cream pb-24 md:pb-0 md:flex">
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex w-64 bg-white border-r border-brand-rose/10 p-6 flex-col">
        <div className="flex items-center gap-2 mb-12">
          <div className="w-8 h-8 bg-brand-rose rounded-lg flex items-center justify-center text-white">
            <Calendar size={18} />
          </div>
          <span className="text-xl font-serif italic font-bold">Marca Aí</span>
        </div>
        <nav className="flex-1 space-y-2">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-brand-gray hover:bg-brand-cream rounded-xl font-bold text-sm transition-all">
            <Calendar size={18} /> Dashboard
          </Link>
          <Link to="/agenda" className="flex items-center gap-3 px-4 py-3 text-brand-gray hover:bg-brand-cream rounded-xl font-bold text-sm transition-all">
            <Calendar size={18} /> Agenda
          </Link>
          <Link to="/clients" className="flex items-center gap-3 px-4 py-3 text-brand-gray hover:bg-brand-cream rounded-xl font-bold text-sm transition-all">
            <Users size={18} /> Clientes
          </Link>
          <Link to="/services" className="flex items-center gap-3 px-4 py-3 bg-brand-rose-light text-brand-rose rounded-xl font-bold text-sm">
            <List size={18} /> Serviços
          </Link>
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-brand-gray hover:bg-brand-cream rounded-xl font-bold text-sm transition-all">
            <Settings size={18} /> Perfil
          </Link>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
          <div>
            <h1 className="text-3xl font-serif font-medium text-brand-dark mb-2">Seu Menu de Serviços</h1>
            <p className="text-brand-gray text-sm font-light">Defina o que você faz de melhor e quanto vale seu tempo.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-brand-dark text-white px-10 py-5 rounded-full font-bold text-xs uppercase tracking-widest flex items-center gap-3 premium-shadow hover:bg-brand-dark/90 transition-all"
          >
            <Plus size={20} /> Novo Serviço
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {services.length > 0 ? (
            services.map(service => (
              <motion.div 
                key={service.id} 
                layout 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-10 rounded-[3rem] border border-brand-dark/5 premium-shadow group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-brand-rose/5 rounded-full -mr-20 -mt-20 transition-transform group-hover:scale-110" />
                
                <div className="flex justify-between items-start mb-8 relative z-10">
                  <div className="flex-1 pr-6">
                    <h3 className="text-2xl font-serif font-bold mb-3 group-hover:text-brand-rose transition-colors">{service.name}</h3>
                    <p className="text-brand-gray text-sm font-light leading-relaxed line-clamp-2">{service.description || 'Nenhuma descrição adicionada.'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(service)} className="p-3 hover:bg-brand-cream rounded-2xl text-brand-dark/20 hover:text-brand-dark transition-all">
                      <Edit2 size={20} />
                    </button>
                    <button onClick={() => confirmDelete(service.id)} className="p-3 hover:bg-red-50 rounded-2xl text-brand-dark/20 hover:text-red-500 transition-all">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-8 pt-8 border-t border-brand-dark/5 relative z-10">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-brand-dark uppercase tracking-widest">
                    <Clock size={16} className="text-brand-rose" /> {service.duration} min
                  </div>
                  <div className="flex items-center gap-2 text-lg font-serif italic text-brand-rose">
                    <Sparkles size={16} /> {formatCurrency(service.price)}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="lg:col-span-2 py-32 text-center bg-white/50 rounded-[4rem] border-2 border-dashed border-brand-dark/5">
              <div className="w-24 h-24 bg-brand-cream rounded-full flex items-center justify-center text-brand-rose mx-auto mb-8">
                <List size={40} />
              </div>
              <h3 className="text-2xl font-serif font-bold mb-3">Comece adicionando um serviço</h3>
              <p className="text-brand-gray text-sm font-light mb-10 max-w-xs mx-auto">Você precisa de pelo menos um serviço ativo para que as clientes possam agendar.</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-brand-dark text-white px-10 py-5 rounded-full font-bold text-xs uppercase tracking-widest premium-shadow"
              >
                Criar meu primeiro serviço
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {isDeleteModalOpen && (
            <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-md z-[60] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center"
              >
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-2xl font-serif italic font-bold mb-2 text-brand-dark">Excluir Serviço?</h3>
                <p className="text-brand-gray text-sm mb-8">Esta ação não pode ser desfeita. O serviço será removido permanentemente da sua agenda.</p>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleDelete}
                    disabled={loading}
                    className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold hover:bg-red-600 transition-all premium-shadow disabled:opacity-50"
                  >
                    {loading ? 'Excluindo...' : 'Sim, Excluir'}
                  </button>
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    disabled={loading}
                    className="w-full bg-brand-cream text-brand-gray py-4 rounded-2xl font-bold hover:bg-brand-rose-light transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-brand-rose" />
                <button onClick={closeModal} className="absolute right-8 top-8 text-brand-gray hover:text-brand-dark transition-colors"><X size={24} /></button>
                
                <div className="mb-10">
                  <h2 className="text-3xl font-serif italic font-bold mb-2">{editingId ? 'Refinar Serviço' : 'Novo Serviço Boutique'}</h2>
                  <p className="text-brand-gray text-sm">Preencha os detalhes para valorizar seu trabalho.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Nome do Serviço</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Design de Sobrancelhas Premium" className="w-full px-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all text-lg" required />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Descrição (Venda seu peixe)</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que torna este serviço especial?" className="w-full px-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 h-28 resize-none transition-all" />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Duração (minutos)</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray" size={18} />
                        <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all" required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Preço (R$)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray" size={18} />
                        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="w-full pl-12 pr-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all" required />
                      </div>
                    </div>
                  </div>

                  <div className="bg-brand-rose-light/20 p-4 rounded-2xl flex gap-3 items-start">
                    <Info size={18} className="text-brand-rose shrink-0 mt-0.5" />
                    <p className="text-[10px] text-brand-rose font-bold uppercase leading-relaxed">
                      Serviços com descrições detalhadas e preços claros geram mais agendamentos imediatos.
                    </p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full bg-brand-rose text-white py-5 rounded-full font-bold text-lg premium-shadow hover:bg-brand-rose/90 transition-all mt-4 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Salvando...' : editingId ? 'Atualizar Serviço' : 'Criar Serviço'} <ChevronRight size={20} />
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
