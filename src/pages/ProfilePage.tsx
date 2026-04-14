import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  Calendar, List, Settings, Save, User, MapPin, Home, Building2, Briefcase,
  Phone, Link as LinkIcon, Camera, Sparkles, ExternalLink, Users, X, Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCurrency } from '../lib/utils';

import MobileNav from '../components/MobileNav';

export default function ProfilePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [slug, setSlug] = useState('');
  const [avatar, setAvatar] = useState('');
  const [serviceMode, setServiceMode] = useState<'home' | 'studio' | 'hybrid'>('studio');
  const [serviceAreas, setServiceAreas] = useState<any[]>([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaFee, setNewAreaFee] = useState('');
  const [pricingStrategy, setPricingStrategy] = useState<'extra' | 'none'>('none');
  const [portfolio, setPortfolio] = useState<{url: string, category: string}[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setSpecialty(profile.specialty || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setWhatsapp(profile.whatsapp || '');
      setSlug(profile.slug || '');
      setAvatar(profile.avatar || '');
      setServiceMode(profile.serviceMode || 'studio');
      setServiceAreas(profile.serviceAreas || []);
      setPricingStrategy(profile.pricingStrategy || 'none');
      setPortfolio(profile.portfolio || []);
    }
  }, [profile]);

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen bg-brand-cream">Carregando perfil...</div>;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user!.uid), {
        name,
        specialty,
        bio,
        location,
        whatsapp,
        slug,
        avatar,
        serviceMode,
        serviceAreas,
        pricingStrategy,
        portfolio
      });
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const addArea = () => {
    if (!newAreaName) return;
    if (pricingStrategy === 'extra' && !newAreaFee) {
      toast.error('Informe o valor adicional');
      return;
    }
    setServiceAreas([...serviceAreas, { name: newAreaName, fee: Number(newAreaFee || 0) }]);
    setNewAreaName('');
    setNewAreaFee('');
  };

  const handlePortfolioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadingImage(true);
      const file = files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setPortfolio([...portfolio, { url: reader.result as string, category: specialty || 'Geral' }]);
        setUploadingImage(false);
        toast.success('Imagem adicionada!');
      };
      reader.readAsDataURL(file);
    }
  };

  const removePortfolioImage = (index: number) => {
    setPortfolio(portfolio.filter((_, i) => i !== index));
  };

  const removeArea = (index: number) => {
    setServiceAreas(serviceAreas.filter((_, i) => i !== index));
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
          <Link to="/services" className="flex items-center gap-3 px-4 py-3 text-brand-gray hover:bg-brand-cream rounded-xl font-bold text-sm transition-all">
            <List size={18} /> Serviços
          </Link>
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 bg-brand-rose-light text-brand-rose rounded-xl font-bold text-sm">
            <Settings size={18} /> Perfil
          </Link>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-12 max-w-4xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-serif italic font-bold mb-1">Seu Perfil Boutique</h1>
            <p className="text-brand-gray">Personalize sua vitrine digital para encantar clientes.</p>
          </div>
          <Link to={`/p/${profile?.slug}`} target="_blank" className="flex items-center gap-2 text-brand-rose font-bold text-sm hover:underline">
            Ver minha página <ExternalLink size={16} />
          </Link>
        </header>

        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Avatar & Identity */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-brand-rose/10 premium-shadow text-center">
              <div className="relative w-32 h-32 mx-auto mb-6">
                <div className="w-full h-full bg-brand-cream rounded-full flex items-center justify-center text-brand-rose border-4 border-white shadow-xl overflow-hidden">
                  {avatar ? <img src={avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={48} />}
                </div>
                <div className="absolute bottom-0 right-0 w-10 h-10 bg-brand-rose text-white rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                  <Camera size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest">URL da Foto</label>
                <input 
                  type="text" 
                  value={avatar} 
                  onChange={(e) => setAvatar(e.target.value)} 
                  placeholder="https://..." 
                  className="w-full px-4 py-2 bg-brand-cream rounded-xl outline-none text-xs text-center" 
                />
              </div>
            </div>
          </div>

          {/* Right Column: Details */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-brand-rose/10 premium-shadow space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Camera size={20} className="text-brand-rose" />
                  <h3 className="font-serif italic font-bold text-lg">Seu Portfólio</h3>
                </div>
                <p className="text-[10px] text-brand-gray font-bold uppercase tracking-widest">Organize por categorias</p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {portfolio.map((item, idx) => (
                  <div key={idx} className="aspect-square bg-brand-cream rounded-2xl overflow-hidden relative group">
                    <img src={item.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                      <input 
                        type="text" 
                        value={item.category} 
                        onChange={(e) => {
                          const newPortfolio = [...portfolio];
                          newPortfolio[idx].category = e.target.value;
                          setPortfolio(newPortfolio);
                        }}
                        className="w-full bg-white/20 backdrop-blur-md border border-white/30 rounded-lg px-2 py-1 text-[10px] text-white placeholder:text-white/50 outline-none text-center mb-2"
                        placeholder="Categoria"
                      />
                      <button 
                        type="button"
                        onClick={() => removePortfolioImage(idx)}
                        className="w-8 h-8 bg-white text-brand-rose rounded-full flex items-center justify-center shadow-lg"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <label className="aspect-square border-2 border-dashed border-brand-rose/20 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-brand-rose-light/10 transition-all text-brand-rose">
                  {uploadingImage ? <Sparkles size={20} className="animate-pulse" /> : <Plus size={20} />}
                  <input type="file" accept="image/*" className="hidden" onChange={handlePortfolioUpload} />
                </label>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-brand-rose/10 premium-shadow space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Nome Profissional</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-5 py-3.5 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/10 transition-all" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Especialidade</label>
                  <input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex: Nail Designer" className="w-full px-5 py-3.5 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/10 transition-all" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Bio / Descrição Boutique</label>
                <textarea 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)} 
                  className="w-full px-5 py-3.5 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/10 transition-all h-32 resize-none" 
                  placeholder="Conte o diferencial do seu atendimento..." 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Localização</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray" size={18} />
                    <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Cidade, Bairro" className="w-full pl-12 pr-5 py-3.5 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/10 transition-all" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">WhatsApp de Contato</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray" size={18} />
                    <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" className="w-full pl-12 pr-5 py-3.5 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/10 transition-all" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Link Personalizado (Slug)</label>
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray" size={18} />
                  <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full pl-12 pr-5 py-3.5 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/10 transition-all font-mono text-sm" required />
                </div>
                <p className="text-[10px] text-brand-gray mt-2 ml-1">Seu link público: <span className="text-brand-rose font-bold">marca.ai/p/{slug}</span></p>
              </div>

              {/* Service Mode Section */}
              <div className="pt-6 border-t border-brand-rose/10 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif italic font-bold text-lg">Modo de Atendimento</h3>
                      <p className="text-xs text-brand-gray">Onde você realiza seus serviços?</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      type="button"
                      onClick={() => setServiceMode('studio')}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${serviceMode === 'studio' ? 'border-brand-rose bg-brand-rose-light/20 text-brand-rose' : 'border-brand-cream bg-brand-cream text-brand-gray'}`}
                    >
                      <Building2 size={20} />
                      <span className="text-[10px] font-bold uppercase">Estúdio</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setServiceMode('home')}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${serviceMode === 'home' ? 'border-brand-rose bg-brand-rose-light/20 text-brand-rose' : 'border-brand-cream bg-brand-cream text-brand-gray'}`}
                    >
                      <Home size={20} />
                      <span className="text-[10px] font-bold uppercase">Domicílio</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setServiceMode('hybrid')}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${serviceMode === 'hybrid' ? 'border-brand-rose bg-brand-rose-light/20 text-brand-rose' : 'border-brand-cream bg-brand-cream text-brand-gray'}`}
                    >
                      <Briefcase size={20} />
                      <span className="text-[10px] font-bold uppercase">Híbrido</span>
                    </button>
                  </div>
                </div>

                {(serviceMode === 'home' || serviceMode === 'hybrid') && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6">
                    <div className="space-y-4">
                      <p className="text-[10px] font-bold text-brand-gray uppercase tracking-widest">Você cobra o mesmo valor em todos os bairros?</p>
                      <div className="flex gap-3">
                        <button 
                          type="button"
                          onClick={() => setPricingStrategy('none')}
                          className={`flex-1 py-3 px-4 rounded-xl border-2 text-xs font-bold transition-all ${pricingStrategy === 'none' ? 'border-brand-rose bg-brand-rose-light/10 text-brand-rose' : 'border-brand-cream bg-brand-cream text-brand-gray'}`}
                        >
                          Sim, mesmo valor
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPricingStrategy('extra')}
                          className={`flex-1 py-3 px-4 rounded-xl border-2 text-xs font-bold transition-all ${pricingStrategy === 'extra' ? 'border-brand-rose bg-brand-rose-light/10 text-brand-rose' : 'border-brand-cream bg-brand-cream text-brand-gray'}`}
                        >
                          Não, varia por região
                        </button>
                      </div>
                    </div>

                    <div className="bg-brand-cream/30 p-6 rounded-3xl space-y-4">
                      <h4 className="text-xs font-bold text-brand-dark uppercase tracking-widest">Configurar Regiões</h4>
                      <div className="flex flex-col md:flex-row items-end gap-4">
                        <div className="flex-1 space-y-1.5 w-full">
                          <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Bairro / Região</label>
                          <input type="text" value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} placeholder="Ex: Aldeota" className="w-full px-5 py-3 bg-white rounded-xl outline-none text-sm border border-brand-rose/5" />
                        </div>
                        <div className="w-full md:w-48 space-y-1.5">
                          <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">{pricingStrategy === 'extra' ? 'Valor Adicional (R$)' : 'Atendimento (R$)'}</label>
                          {pricingStrategy === 'extra' ? (
                            <input type="number" value={newAreaFee} onChange={(e) => setNewAreaFee(e.target.value)} placeholder="0,00" className="w-full px-5 py-3 bg-white rounded-xl outline-none text-sm border border-brand-rose/5" />
                          ) : (
                            <div className="w-full px-5 py-3 bg-brand-cream/50 rounded-xl text-xs text-brand-gray flex items-center italic h-[46px]">Preço fixo</div>
                          )}
                        </div>
                        <button type="button" onClick={addArea} className="bg-brand-dark text-white px-8 h-[46px] rounded-xl font-bold text-xs whitespace-nowrap">Adicionar</button>
                      </div>

                      <div className="space-y-2">
                        {serviceAreas.map((area, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-brand-rose/5">
                            <span className="text-sm font-bold">{area.name}</span>
                            <div className="flex items-center gap-3">
                              {pricingStrategy === 'extra' && area.fee > 0 && (
                                <span className="text-xs font-bold text-brand-rose">+{formatCurrency(area.fee)}</span>
                              )}
                              <button type="button" onClick={() => removeArea(idx)} className="text-red-500 p-1 hover:bg-red-50 rounded-lg transition-all">
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-brand-dark text-white py-6 rounded-full font-bold text-xs uppercase tracking-widest premium-shadow hover:bg-brand-dark/90 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Save size={18} /> {loading ? 'Salvando...' : 'Atualizar Minha Vitrine'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
