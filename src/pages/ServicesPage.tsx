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
import { formatCurrency, getHumanError } from '../lib/utils';
import Logo from '../components/Logo';
import AppLayout from '../components/AppLayout';

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
        toast.success('Experiência atualizada com sucesso.');
      } else {
        await addDoc(collection(db, 'services'), serviceData);
        toast.success('Nova experiência adicionada ao seu menu.');
      }
      closeModal();
    } catch (error: any) {
      console.error('[ServicesSave] Error:', error);
      toast.error('Não foi possível concluir agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!serviceToDelete) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'services', serviceToDelete));
      toast.success('Experiência removida.');
      setIsDeleteModalOpen(false);
      setServiceToDelete(null);
    } catch (error: any) {
      console.error('[ServicesDelete] Error:', error);
      toast.error('Não foi possível concluir agora. Tente novamente.');
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
    <AppLayout activeRoute="services">
      <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
          <div>
            <h1 className="text-4xl font-serif font-normal text-brand-ink mb-2">Seu Menu de Serviços</h1>
            <p className="text-brand-stone text-sm font-light">Defina o que você faz de melhor e quanto vale seu tempo.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-brand-ink text-brand-white px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest flex items-center gap-3 shadow-xl hover:bg-brand-espresso transition-all"
          >
            <Plus size={20} /> Novo Serviço
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {services.length > 0 ? (
            services.map(service => (
              <motion.div 
                key={service.id} 
                layout 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-40 h-40 bg-brand-linen/50 rounded-full -mr-20 -mt-20 transition-transform group-hover:scale-110" />
                
                <div className="flex justify-between items-start mb-8 relative z-10">
                  <div className="flex-1 pr-6">
                    <h3 className="text-2xl font-serif font-normal text-brand-ink mb-3 group-hover:text-brand-terracotta transition-colors">{service.name}</h3>
                    <p className="text-brand-stone text-sm font-light leading-relaxed line-clamp-2">{service.description || 'Nenhuma descrição adicionada.'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(service)} className="p-3 hover:bg-brand-parchment rounded-2xl text-brand-mist hover:text-brand-ink transition-all">
                      <Edit2 size={20} />
                    </button>
                    <button onClick={() => confirmDelete(service.id)} className="p-3 hover:bg-brand-linen rounded-2xl text-brand-mist hover:text-brand-terracotta transition-all">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-8 pt-8 border-t border-brand-mist relative z-10">
                  <div className="flex items-center gap-2 text-[10px] font-medium text-brand-stone uppercase tracking-widest">
                    <Clock size={16} className="text-brand-terracotta" /> {service.duration} min
                  </div>
                  <div className="flex items-center gap-2 text-lg font-serif italic text-brand-terracotta">
                    <Sparkles size={16} /> {formatCurrency(service.price)}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="lg:col-span-2 py-32 text-center bg-brand-white/50 rounded-[40px] border border-dashed border-brand-mist">
              <div className="w-24 h-24 bg-brand-linen rounded-full flex items-center justify-center text-brand-terracotta mx-auto mb-8">
                <List size={40} />
              </div>
              <h3 className="text-2xl font-serif font-normal text-brand-ink mb-3">Comece adicionando um serviço</h3>
              <p className="text-brand-stone text-sm font-light mb-10 max-w-xs mx-auto">Você precisa de pelo menos um serviço ativo para que as clientes possam agendar.</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-brand-ink text-brand-white px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest shadow-xl hover:bg-brand-espresso transition-all"
              >
                Criar meu primeiro serviço
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {isDeleteModalOpen && (
            <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-brand-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl text-center border border-brand-mist"
              >
                <div className="w-16 h-16 bg-brand-linen text-brand-terracotta rounded-2xl flex items-center justify-center mx-auto mb-6 border border-brand-mist">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-2xl font-serif font-normal mb-2 text-brand-ink">Excluir Serviço?</h3>
                <p className="text-brand-stone text-sm mb-8 font-light">Esta ação não pode ser desfeita. O serviço será removido permanentemente da sua agenda.</p>
                
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={handleDelete}
                    disabled={loading}
                    className="w-full bg-brand-terracotta text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-sienna transition-all shadow-xl disabled:opacity-50"
                  >
                    {loading ? 'Excluindo...' : 'Sim, Excluir'}
                  </button>
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    disabled={loading}
                    className="w-full bg-brand-parchment text-brand-stone py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all border border-brand-mist"
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
            <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-brand-white w-full max-w-xl rounded-[40px] p-12 shadow-2xl relative overflow-hidden border border-brand-mist"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-brand-terracotta" />
                <button onClick={closeModal} className="absolute right-10 top-10 text-brand-stone hover:text-brand-ink transition-colors"><X size={24} /></button>
                
                <div className="mb-10">
                  <h2 className="text-3xl font-serif font-normal text-brand-ink mb-2">{editingId ? 'Refinar Serviço' : 'Novo Serviço Boutique'}</h2>
                  <p className="text-brand-stone text-sm font-light">Preencha os detalhes para valorizar seu trabalho.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Nome do Serviço</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Design de Sobrancelhas Premium" className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-lg font-light" required />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Descrição (Venda seu peixe)</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que torna este serviço especial?" className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink h-28 resize-none transition-all font-light" />
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Duração (minutos)</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
                        <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Preço (R$)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
                        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="w-full pl-12 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" required />
                      </div>
                    </div>
                  </div>

                  <div className="bg-brand-linen p-6 rounded-2xl flex gap-4 items-start border border-brand-mist">
                    <Info size={18} className="text-brand-terracotta shrink-0 mt-0.5" />
                    <p className="text-[10px] text-brand-stone font-medium uppercase leading-relaxed tracking-wider">
                      Serviços com descrições detalhadas e preços claros geram mais agendamentos imediatos.
                    </p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest shadow-xl hover:bg-brand-espresso transition-all mt-4 flex items-center justify-center gap-3"
                  >
                    {loading ? 'Salvando...' : editingId ? 'Atualizar Serviço' : 'Criar Serviço'} <ChevronRight size={20} />
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </AppLayout>
  );
}
