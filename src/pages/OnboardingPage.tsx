import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, auth } from '../firebase';
import { doc, updateDoc, collection, addDoc, setDoc } from 'firebase/firestore';
import { 
  User, MapPin, Home, Building2, Briefcase, 
  Clock, DollarSign, Instagram, MessageCircle, 
  CheckCircle2, ArrowRight, ArrowLeft, Sparkles,
  Camera, Plus, X, Globe, Copy, Share2
} from 'lucide-react';
import { toast } from 'sonner';
import { generateSlug, formatCurrency } from '../lib/utils';

type ServiceMode = 'home' | 'studio' | 'hybrid';

export default function OnboardingPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Identity
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [city, setCity] = useState('');
  const [avatar, setAvatar] = useState('');
  const [serviceMode, setServiceMode] = useState<ServiceMode>('studio');

  // Step 2: Service Mode Details
  const [address, setAddress] = useState('');
  const [serviceAreas, setServiceAreas] = useState<{name: string, fee: number}[]>([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaFee, setNewAreaFee] = useState('');
  const [pricingStrategy, setPricingStrategy] = useState<'extra' | 'none'>('none');
  const [portfolio, setPortfolio] = useState<{url: string, category: string}[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Step 3: Services
  const [services, setServices] = useState<{name: string, duration: string, price: string, description: string}[]>([
    { name: '', duration: '60', price: '', description: '' }
  ]);

  // Step 4: Schedule
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');

  // Step 5: Public Showcase
  const [slug, setSlug] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (profile) {
      if (profile.name) setName(profile.name);
      if (profile.specialty) setSpecialty(profile.specialty);
      if (profile.city) setCity(profile.city);
      if (profile.avatar) setAvatar(profile.avatar);
      if (profile.serviceMode) setServiceMode(profile.serviceMode);
      if (profile.address) setAddress(profile.address);
      if (profile.serviceAreas) setServiceAreas(profile.serviceAreas);
      if (profile.pricingStrategy) setPricingStrategy(profile.pricingStrategy);
      if (profile.workingDays) setWorkingDays(profile.workingDays);
      if (profile.startTime) setStartTime(profile.startTime);
      if (profile.endTime) setEndTime(profile.endTime);
      if (profile.slug) {
        setSlug(profile.slug);
      } else if (profile.name) {
        setSlug(generateSlug(profile.name));
      }
      if (profile.whatsapp) setWhatsapp(profile.whatsapp);
      if (profile.instagram) setInstagram(profile.instagram);
      if (profile.bio) setBio(profile.bio);
      if (profile.servicesDraft) setServices(profile.servicesDraft);
      if (profile.onboardingStep) setStep(profile.onboardingStep);
      
      if (profile.onboardingCompleted) {
        navigate('/dashboard');
      }
    }
  }, [profile, navigate]);

  const saveProgress = async (nextStepNum: number) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name,
        specialty,
        city,
        avatar,
        serviceMode,
        address,
        serviceAreas,
        pricingStrategy,
        portfolio,
        workingDays,
        startTime,
        endTime,
        slug,
        whatsapp,
        instagram,
        bio,
        servicesDraft: services,
        onboardingStep: nextStepNum,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        toast.error('A imagem deve ter menos de 1MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const nextStep = async () => {
    const nextStepNum = step + 1;
    await saveProgress(nextStepNum);
    setStep(nextStepNum);
  };

  const prevStep = () => setStep(s => s - 1);

  const handleFinish = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Update User Profile
      await updateDoc(doc(db, 'users', user.uid), {
        name,
        specialty,
        city,
        avatar,
        serviceMode,
        address: serviceMode !== 'home' ? address : '',
        serviceAreas: serviceMode !== 'studio' ? serviceAreas : [],
        pricingStrategy: serviceMode !== 'studio' ? pricingStrategy : 'none',
        workingDays,
        startTime,
        endTime,
        slug,
        whatsapp,
        instagram,
        bio,
        portfolio,
        onboardingCompleted: true,
        updatedAt: new Date().toISOString()
      });

      // 2. Add Services
      for (const service of services) {
        if (service.name && service.price) {
          await addDoc(collection(db, 'services'), {
            professionalId: user.uid,
            name: service.name,
            duration: Number(service.duration),
            price: Number(service.price),
            description: service.description,
            active: true,
            createdAt: new Date().toISOString()
          });
        }
      }

      toast.success('Onboarding concluído com sucesso!');
      nextStep(); // Go to step 6 (Finalization)
    } catch (error) {
      console.error('Error finishing onboarding:', error);
      toast.error('Erro ao salvar suas configurações.');
    } finally {
      setLoading(false);
    }
  };

  const addService = () => {
    setServices([...services, { name: '', duration: '60', price: '', description: '' }]);
  };

  const updateService = (index: number, field: string, value: string) => {
    const newServices = [...services];
    newServices[index] = { ...newServices[index], [field]: value };
    setServices(newServices);
  };

  const removeService = (index: number) => {
    if (services.length === 1) return;
    setServices(services.filter((_, i) => i !== index));
  };

  const toggleDay = (day: number) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter(d => d !== day));
    } else {
      setWorkingDays([...workingDays, day].sort());
    }
  };

  const addArea = () => {
    if (!newAreaName.trim()) {
      toast.error('Digite o nome do bairro para adicionar');
      return;
    }

    if (pricingStrategy !== 'none' && !newAreaFee) {
      toast.error('Por favor, informe o valor adicional para este bairro');
      return;
    }

    const isDuplicate = serviceAreas.some(
      area => area.name.toLowerCase() === newAreaName.trim().toLowerCase()
    );

    if (isDuplicate) {
      toast.error('Este bairro já foi adicionado à lista');
      return;
    }

    const feeValue = pricingStrategy === 'none' ? 0 : Number(newAreaFee);
    
    setServiceAreas([...serviceAreas, { 
      name: newAreaName.trim(), 
      fee: feeValue 
    }]);
    
    setNewAreaName('');
    setNewAreaFee('');
    toast.success(`${newAreaName.trim()} adicionado com sucesso!`);
  };

  const handlePortfolioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadingImage(true);
      const file = files[0];
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Cada imagem deve ter menos de 2MB');
        setUploadingImage(false);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPortfolio([...portfolio, { url: reader.result as string, category: specialty || 'Geral' }]);
        setUploadingImage(false);
        toast.success('Imagem adicionada ao seu portfólio!');
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

  if (authLoading) return null;

  const progress = (step / 6) * 100;

  return (
    <div className="min-h-screen bg-brand-cream/30 flex flex-col">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1.5 bg-brand-rose/10 z-50">
        <motion.div 
          className="h-full bg-brand-rose"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-brand-rose text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-rose/20">
                  <User size={32} />
                </div>
                <h1 className="text-3xl font-serif font-bold text-brand-dark">Como as clientes devem te conhecer?</h1>
                <p className="text-brand-gray">Sua identidade é o primeiro passo para criar confiança.</p>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-brand-rose/10 space-y-6">
                <div className="flex flex-col items-center mb-8">
                  <div className="relative group">
                    <div className="w-28 h-28 bg-brand-cream rounded-full flex items-center justify-center text-brand-rose border-4 border-white shadow-lg overflow-hidden relative">
                      {avatar ? (
                        <img src={avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={40} className="opacity-20" />
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 w-10 h-10 bg-brand-rose text-white rounded-full flex items-center justify-center border-4 border-white shadow-lg cursor-pointer hover:scale-110 transition-transform">
                      <Camera size={18} />
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                  <p className="mt-4 text-[10px] font-bold text-brand-gray uppercase tracking-widest">Sua melhor foto profissional</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Nome que aparece na agenda</label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="Ex: Bruna Designer" 
                      className="w-full px-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Sua Especialidade Principal</label>
                    <input 
                      type="text" 
                      value={specialty} 
                      onChange={(e) => setSpecialty(e.target.value)} 
                      placeholder="Ex: Nail Designer" 
                      className="w-full px-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Cidade Base</label>
                    <div className="relative">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-gray" size={20} />
                      <input 
                        type="text" 
                        value={city} 
                        onChange={(e) => setCity(e.target.value)} 
                        placeholder="Ex: Fortaleza, CE" 
                        className="w-full pl-14 pr-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Onde você atende?</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={() => setServiceMode('studio')}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${serviceMode === 'studio' ? 'border-brand-rose bg-brand-rose-light/20 text-brand-rose' : 'border-brand-cream bg-brand-cream text-brand-gray'}`}
                    >
                      <Building2 size={24} />
                      <span className="text-[10px] font-bold uppercase">Estúdio</span>
                    </button>
                    <button 
                      onClick={() => setServiceMode('home')}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${serviceMode === 'home' ? 'border-brand-rose bg-brand-rose-light/20 text-brand-rose' : 'border-brand-cream bg-brand-cream text-brand-gray'}`}
                    >
                      <Home size={24} />
                      <span className="text-[10px] font-bold uppercase">Domicílio</span>
                    </button>
                    <button 
                      onClick={() => setServiceMode('hybrid')}
                      className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${serviceMode === 'hybrid' ? 'border-brand-rose bg-brand-rose-light/20 text-brand-rose' : 'border-brand-cream bg-brand-cream text-brand-gray'}`}
                    >
                      <Briefcase size={24} />
                      <span className="text-[10px] font-bold uppercase">Híbrido</span>
                    </button>
                  </div>
                </div>
              </div>

              <button 
                onClick={nextStep}
                disabled={!name || !specialty || !city}
                className="w-full bg-brand-dark text-white py-6 rounded-full font-bold text-sm uppercase tracking-widest premium-shadow flex items-center justify-center gap-3 disabled:opacity-50"
              >
                Continuar <ArrowRight size={20} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-brand-rose text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-rose/20">
                  {serviceMode === 'home' ? <Home size={32} /> : <Building2 size={32} />}
                </div>
                <h1 className="text-3xl font-serif font-bold text-brand-dark">Onde você atende?</h1>
                <p className="text-brand-gray">Configure sua logística de atendimento.</p>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-brand-rose/10 space-y-8">
                {(serviceMode === 'studio' || serviceMode === 'hybrid') && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-brand-dark">
                      <Building2 size={20} className="text-brand-rose" />
                      <h3 className="font-bold">Endereço do seu Estúdio</h3>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Endereço Completo</label>
                      <textarea 
                        value={address} 
                        onChange={(e) => setAddress(e.target.value)} 
                        placeholder="Rua, número, complemento, bairro..." 
                        className="w-full px-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all h-24 resize-none"
                      />
                    </div>
                  </div>
                )}

                {(serviceMode === 'home' || serviceMode === 'hybrid') && (
                  <div className="space-y-6 pt-6 border-t border-brand-rose/10">
                    <div className="flex items-center gap-3 text-brand-dark">
                      <Home size={20} className="text-brand-rose" />
                      <h3 className="font-bold">Atendimento em Domicílio</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <p className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Você cobra o mesmo valor em todos os bairros?</p>
                      <div className="grid grid-cols-1 gap-3">
                        <button 
                          onClick={() => setPricingStrategy('none')}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${pricingStrategy === 'none' ? 'border-brand-rose bg-brand-rose-light/10' : 'border-brand-cream bg-brand-cream'}`}
                        >
                          <p className="text-xs font-bold text-brand-dark mb-1">Sim, é o mesmo valor</p>
                          <p className="text-[10px] text-brand-gray leading-tight">O valor do serviço será o mesmo em todas as regiões atendidas.</p>
                        </button>
                        <button 
                          onClick={() => setPricingStrategy('extra')}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${pricingStrategy === 'extra' ? 'border-brand-rose bg-brand-rose-light/10' : 'border-brand-cream bg-brand-cream'}`}
                        >
                          <p className="text-xs font-bold text-brand-dark mb-1">Não, varia por região</p>
                          <p className="text-[10px] text-brand-gray leading-tight">Você pode ajustar valores conforme a região para cobrir deslocamentos maiores.</p>
                        </button>
                      </div>
                    </div>

                    {pricingStrategy === 'extra' && (
                      <div className="space-y-4 pt-4 bg-brand-rose-light/5 p-6 rounded-3xl border border-brand-rose/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={16} className="text-brand-rose" />
                          <h4 className="text-xs font-bold text-brand-dark uppercase tracking-widest">Ajuste de valores por região</h4>
                        </div>
                        <p className="text-[10px] text-brand-gray leading-tight mb-4">Adicione um valor adicional para bairros que exigem um deslocamento maior.</p>
                        
                        <div className="flex flex-col md:flex-row items-end gap-3">
                          <div className="flex-1 space-y-1.5 w-full">
                            <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Bairro / Região</label>
                            <input 
                              type="text" 
                              value={newAreaName} 
                              onChange={(e) => setNewAreaName(e.target.value)} 
                              onKeyDown={(e) => e.key === 'Enter' && addArea()}
                              placeholder="Ex: Aldeota" 
                              className="w-full px-5 py-3 bg-white rounded-xl outline-none text-sm focus:ring-2 focus:ring-brand-rose/20 transition-all border border-brand-rose/10" 
                            />
                          </div>
                          <div className="w-full md:w-32 space-y-1.5">
                            <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Valor Adicional</label>
                            <input 
                              type="number" 
                              value={newAreaFee} 
                              onChange={(e) => setNewAreaFee(e.target.value)} 
                              onKeyDown={(e) => e.key === 'Enter' && addArea()}
                              placeholder="0,00" 
                              className="w-full px-5 py-3 bg-white rounded-xl outline-none text-sm focus:ring-2 focus:ring-brand-rose/20 transition-all border border-brand-rose/10" 
                            />
                          </div>
                          <button 
                            onClick={addArea} 
                            className="bg-brand-dark text-white px-8 h-[46px] rounded-xl font-bold text-xs whitespace-nowrap hover:bg-brand-dark/90 active:scale-95 transition-all shadow-lg shadow-brand-dark/10"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    )}

                    {pricingStrategy === 'none' && (
                      <div className="space-y-4 pt-4">
                        <p className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Quais bairros você atende?</p>
                        <div className="flex flex-col md:flex-row items-end gap-3">
                          <div className="flex-1 space-y-1.5 w-full">
                            <input 
                              type="text" 
                              value={newAreaName} 
                              onChange={(e) => setNewAreaName(e.target.value)} 
                              onKeyDown={(e) => e.key === 'Enter' && addArea()}
                              placeholder="Ex: Aldeota" 
                              className="w-full px-5 py-3 bg-brand-cream rounded-xl outline-none text-sm focus:ring-2 focus:ring-brand-rose/20 transition-all" 
                            />
                          </div>
                          <button 
                            onClick={addArea} 
                            className="bg-brand-dark text-white px-8 h-[46px] rounded-xl font-bold text-xs whitespace-nowrap hover:bg-brand-dark/90 active:scale-95 transition-all shadow-lg shadow-brand-dark/10"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {serviceAreas.map((area, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-brand-cream/50 p-3 rounded-xl border border-brand-rose/5">
                          <span className="text-sm font-bold">{area.name}</span>
                          <div className="flex items-center gap-3">
                            {pricingStrategy === 'extra' && area.fee > 0 && (
                              <span className="text-xs font-bold text-brand-rose">
                                + {formatCurrency(area.fee)}
                              </span>
                            )}
                            <button onClick={() => removeArea(idx)} className="text-red-500 p-1 hover:bg-red-50 rounded-lg transition-all">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-white rounded-full text-brand-gray border border-brand-dark/5 premium-shadow">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={(serviceMode !== 'home' && !address) || (serviceMode !== 'studio' && serviceAreas.length === 0)}
                  className="flex-1 bg-brand-dark text-white py-6 rounded-full font-bold text-sm uppercase tracking-widest premium-shadow flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  Continuar <ArrowRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-brand-rose text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-rose/20">
                  <Sparkles size={32} />
                </div>
                <h1 className="text-3xl font-serif font-bold text-brand-dark">Seus Serviços</h1>
                <p className="text-brand-gray">O que suas clientes vão agendar?</p>
              </div>

              <div className="space-y-6">
                {services.map((service, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-brand-rose/10 relative">
                    {services.length > 1 && (
                      <button onClick={() => removeService(idx)} className="absolute top-6 right-6 text-brand-gray hover:text-red-500 transition-colors">
                        <X size={20} />
                      </button>
                    )}
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Nome do Serviço</label>
                        <input 
                          type="text" 
                          value={service.name} 
                          onChange={(e) => updateService(idx, 'name', e.target.value)} 
                          placeholder="Ex: Design de Sobrancelhas" 
                          className="w-full px-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Duração (min)</label>
                          <div className="relative">
                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray" size={18} />
                            <input 
                              type="number" 
                              value={service.duration} 
                              onChange={(e) => updateService(idx, 'duration', e.target.value)} 
                              className="w-full pl-12 pr-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Preço (R$)</label>
                          <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-gray" size={18} />
                            <input 
                              type="number" 
                              value={service.price} 
                              onChange={(e) => updateService(idx, 'price', e.target.value)} 
                              placeholder="0,00"
                              className="w-full pl-12 pr-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Descrição Curta (Opcional)</label>
                        <input 
                          type="text" 
                          value={service.description} 
                          onChange={(e) => updateService(idx, 'description', e.target.value)} 
                          placeholder="Ex: Inclui mapeamento e finalização" 
                          className="w-full px-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button 
                  onClick={addService}
                  className="w-full py-6 border-2 border-dashed border-brand-rose/20 rounded-[2.5rem] text-brand-rose font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-rose-light/10 transition-all"
                >
                  <Plus size={18} /> Adicionar outro serviço
                </button>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-white rounded-full text-brand-gray border border-brand-dark/5 premium-shadow">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={services.some(s => !s.name || !s.price)}
                  className="flex-1 bg-brand-dark text-white py-6 rounded-full font-bold text-sm uppercase tracking-widest premium-shadow flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  Continuar <ArrowRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-brand-rose text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-rose/20">
                  <Clock size={32} />
                </div>
                <h1 className="text-3xl font-serif font-bold text-brand-dark">Seus Horários</h1>
                <p className="text-brand-gray">Não se preocupe: você poderá personalizar sua agenda com mais flexibilidade depois.</p>
              </div>

              <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-brand-rose/10 space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Dias de Trabalho</label>
                  <div className="flex justify-between">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                      <button 
                        key={idx}
                        onClick={() => toggleDay(idx)}
                        className={`w-10 h-10 rounded-full font-bold text-xs transition-all ${workingDays.includes(idx) ? 'bg-brand-rose text-white shadow-lg shadow-brand-rose/20' : 'bg-brand-cream text-brand-gray'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-brand-rose/10">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Início do Dia</label>
                    <input 
                      type="time" 
                      value={startTime} 
                      onChange={(e) => setStartTime(e.target.value)} 
                      className="w-full px-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Fim do Dia</label>
                    <input 
                      type="time" 
                      value={endTime} 
                      onChange={(e) => setEndTime(e.target.value)} 
                      className="w-full px-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={() => {
                      setWorkingDays([1, 2, 3, 4, 5]);
                      setStartTime('09:00');
                      setEndTime('18:00');
                      toast.info('Horário padrão aplicado!');
                    }}
                    className="w-full py-5 bg-brand-rose-light/30 text-brand-rose rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-rose-light/40 transition-all border border-brand-rose/10"
                  >
                    Usar horário padrão (Seg a Sex, 9h às 18h)
                  </button>
                  <p className="text-[10px] text-brand-gray text-center italic">Esse é só o seu horário inicial. Você poderá ajustar dias, pausas e exceções depois.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-white rounded-full text-brand-gray border border-brand-dark/5 premium-shadow">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={workingDays.length === 0}
                  className="flex-1 bg-brand-dark text-white py-6 rounded-full font-bold text-sm uppercase tracking-widest premium-shadow flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  Continuar <ArrowRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div 
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-brand-rose text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-rose/20">
                  <Globe size={32} />
                </div>
                <h1 className="text-3xl font-serif font-bold text-brand-dark">Sua Vitrine Digital</h1>
                <p className="text-brand-gray">Como as clientes vão te encontrar?</p>
              </div>

              <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-brand-rose/10 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Seu Link Exclusivo</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-gray font-bold text-sm">marca.ai/p/</span>
                    <input 
                      type="text" 
                      value={slug} 
                      onChange={(e) => setSlug(e.target.value)} 
                      className="w-full pl-28 pr-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all font-bold text-brand-rose"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">WhatsApp</label>
                    <div className="relative">
                      <MessageCircle className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-gray" size={18} />
                      <input 
                        type="tel" 
                        value={whatsapp} 
                        onChange={(e) => setWhatsapp(e.target.value)} 
                        placeholder="(00) 00000-0000"
                        className="w-full pl-12 pr-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Instagram</label>
                    <div className="relative">
                      <Instagram className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-gray" size={18} />
                      <input 
                        type="text" 
                        value={instagram} 
                        onChange={(e) => setInstagram(e.target.value)} 
                        placeholder="@seuusuario"
                        className="w-full pl-12 pr-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Bio Curta (O que te torna única?)</label>
                  <textarea 
                    value={bio} 
                    onChange={(e) => setBio(e.target.value)} 
                    placeholder="Ex: Especialista em beleza natural com mais de 5 anos de experiência."
                    className="w-full px-6 py-4 bg-brand-cream rounded-2xl outline-none focus:ring-2 focus:ring-brand-rose/20 transition-all h-24 resize-none"
                  />
                </div>
              </div>

              {/* Mini Preview */}
              <div className="bg-brand-dark p-6 rounded-[2.5rem] text-white flex items-center gap-6">
                <div className="w-16 h-16 bg-brand-cream rounded-full overflow-hidden shrink-0">
                  {avatar && <img src={avatar} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-serif italic font-bold truncate">{name || 'Seu Nome'}</h4>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest truncate">{specialty || 'Sua Especialidade'}</p>
                  <div className="flex gap-2 mt-2">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><Instagram size={12} /></div>
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center"><MessageCircle size={12} /></div>
                  </div>
                </div>
                <div className="bg-brand-rose px-4 py-2 rounded-full text-[8px] font-bold uppercase tracking-widest">Preview</div>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-white rounded-full text-brand-gray border border-brand-dark/5 premium-shadow">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={loading || !slug || !whatsapp}
                  className="flex-1 bg-brand-dark text-white py-6 rounded-full font-bold text-sm uppercase tracking-widest premium-shadow flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  Continuar <ArrowRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div 
              key="step6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-brand-rose text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-rose/20">
                  <Camera size={32} />
                </div>
                <h1 className="text-3xl font-serif font-bold text-brand-dark">Seu Portfólio</h1>
                <p className="text-brand-gray">Mostre o seu melhor trabalho para encantar as clientes.</p>
              </div>

              <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-brand-rose/10 space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {portfolio.map((item, idx) => (
                    <div key={idx} className="aspect-square bg-brand-cream rounded-2xl overflow-hidden relative group">
                      <img src={item.url} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => removePortfolioImage(idx)}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={16} />
                      </button>
                      <div className="absolute bottom-0 left-0 w-full p-2 bg-black/20 backdrop-blur-sm">
                        <p className="text-[8px] text-white font-bold uppercase truncate">{item.category}</p>
                      </div>
                    </div>
                  ))}
                  
                  <label className="aspect-square border-2 border-dashed border-brand-rose/20 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-brand-rose-light/10 transition-all text-brand-rose">
                    {uploadingImage ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                        <Sparkles size={24} />
                      </motion.div>
                    ) : (
                      <>
                        <Plus size={24} />
                        <span className="text-[10px] font-bold uppercase">Adicionar</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePortfolioUpload} disabled={uploadingImage} />
                  </label>
                </div>
                
                <p className="text-[10px] text-brand-gray text-center italic">Dica: Fotos bem iluminadas e de alta qualidade convertem até 3x mais!</p>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-white rounded-full text-brand-gray border border-brand-dark/5 premium-shadow">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={handleFinish}
                  disabled={loading}
                  className="flex-1 bg-brand-dark text-white py-6 rounded-full font-bold text-sm uppercase tracking-widest premium-shadow flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? 'Finalizando...' : 'Concluir Agenda'} <CheckCircle2 size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 7 && (
            <motion.div 
              key="step6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full space-y-12 text-center"
            >
              <div className="relative">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, delay: 0.2 }}
                  className="w-32 h-32 bg-green-500 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-green-500/20"
                >
                  <CheckCircle2 size={64} />
                </motion.div>
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-brand-rose text-white rounded-2xl flex items-center justify-center shadow-lg rotate-12 animate-bounce">
                  <Sparkles size={24} />
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl font-serif font-bold text-brand-dark">Sua agenda está pronta!</h1>
                <p className="text-brand-gray text-lg max-w-sm mx-auto">
                  Agora você tem um sistema profissional para receber agendamentos e valorizar seu tempo.
                </p>
              </div>

              <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-brand-rose/10 space-y-6">
                <div className="p-6 bg-brand-cream rounded-2xl border border-brand-rose/10">
                  <p className="text-[10px] font-bold text-brand-gray uppercase tracking-widest mb-2">Seu link da bio</p>
                  <p className="text-xl font-bold text-brand-rose break-all">marca.ai/p/{slug}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`https://marca.ai/p/${slug}`);
                      toast.success('Link copiado!');
                    }}
                    className="flex flex-col items-center gap-3 p-6 bg-brand-cream rounded-2xl hover:bg-brand-rose-light/20 transition-all group"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-brand-dark group-hover:scale-110 transition-transform">
                      <Copy size={24} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Copiar Link</span>
                  </button>
                  <button 
                    onClick={() => {
                      const text = `Olá! Agora você pode agendar seus horários comigo diretamente pelo meu link: https://marca.ai/p/${slug} ✨`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    className="flex flex-col items-center gap-3 p-6 bg-brand-cream rounded-2xl hover:bg-brand-rose-light/20 transition-all group"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-brand-dark group-hover:scale-110 transition-transform">
                      <Share2 size={24} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Divulgar</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-brand-dark text-white py-7 rounded-full font-bold text-sm uppercase tracking-widest premium-shadow flex items-center justify-center gap-3"
                >
                  Ir para meu Dashboard <ArrowRight size={20} />
                </button>
                <Link 
                  to={`/p/${slug}`} 
                  target="_blank"
                  className="text-sm font-bold text-brand-rose uppercase tracking-widest editorial-underline"
                >
                  Ver minha página pública
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
