import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  User, 
  MapPin, 
  Scissors, 
  Plus, 
  Trash2, 
  AlertCircle,
  Sparkles,
  Camera
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ServiceInput {
  id: string;
  name: string;
  price: string;
  duration: string;
  description: string;
}

enum OnboardingStep {
  WELCOME = 0,
  BASIC_INFO = 1,
  LOCATION = 2,
  SERVICES = 3,
  PREVIEW = 4
}

export const OnboardingPage: React.FC = () => {
  const [step, setStep] = useState<OnboardingStep>(OnboardingStep.WELCOME);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [profile, setProfile] = useState({
    name: '',
    bio: '',
    headline: '',
    specialty: '',
    avatar: '',
  });

  const [address, setAddress] = useState({
    city: '',
    neighborhood: '',
    street: '',
    number: '',
  });

  const [services, setServices] = useState<ServiceInput[]>([]);
  const [newService, setNewService] = useState<Omit<ServiceInput, 'id'>>({
    name: '',
    price: '',
    duration: '60',
    description: '',
  });

  // Mock User - In a real app, this comes from an Auth Context
  const user = {
    uid: 'mXQjX4rXONfEasZ0cwSyOT4mkUu2' // Using the ID from the user's previous context
  };

  const handleAddService = () => {
    const priceNum = parseFloat(newService.price);
    const durationNum = parseInt(newService.duration);

    if (!newService.name.trim() || isNaN(priceNum) || priceNum <= 0 || isNaN(durationNum) || durationNum <= 0) {
      setError("Preencha o nome, preço > 0 e duração > 0.");
      return;
    }
    setServices([...services, { ...newService, id: Math.random().toString(36).substr(2, 9) }]);
    setNewService({ name: '', price: '', duration: '60', description: '' });
    setError(null);
  };

  const handleRemoveService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const handleComplete = async () => {
    if (services.length === 0) {
      setError("Adicione pelo menos um serviço para publicar sua página.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/profile/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          profile,
          address,
          services: services.map(s => ({
            name: s.name,
            price: parseFloat(s.price),
            duration: parseInt(s.duration),
            description: s.description,
            active: true
          }))
        })
      });

      const result = await response.json();
      if (response.ok) {
        setSuccess(true);
      } else {
        setError(result.error || "Ocorreu um erro ao salvar seu perfil.");
      }
    } catch (err) {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  if (success) {
    return (
      <div className="min-h-screen bg-[#FBFBF9] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-xl text-center border border-gray-100"
        >
          <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} />
          </div>
          <h1 className="text-3xl font-serif mb-4">Mãos à obra!</h1>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Seu perfil profissional está pronto e seus serviços foram publicados. Agora você já pode receber agendamentos.
          </p>
          <button 
            onClick={() => window.location.href = `/p/test-slug`}
            className="w-full py-4 bg-[#1A1A1A] text-white rounded-2xl font-medium shadow-lg shadow-black/10"
          >
            Ver meu perfil público
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBF9] flex flex-col items-center py-12 px-4">
      <div className="max-w-2xl w-full">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-100 shadow-sm mb-6">
            <Sparkles size={16} className="text-amber-400" />
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Nera Professional</span>
          </div>
          <h1 className="text-4xl font-serif text-[#1A1A1A]">Configure sua Presença</h1>
        </div>

        {/* Steps Progress */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {[0, 1, 2, 3, 4].map((s) => (
            <div 
              key={s} 
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                s === step ? "w-12 bg-[#1A1A1A]" : s < step ? "w-4 bg-gray-300" : "w-4 bg-gray-100"
              )} 
            />
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-black/[0.02] border border-gray-100 p-8 lg:p-12 min-h-[500px] flex flex-col">
          <AnimatePresence mode="wait">
            
            {step === OnboardingStep.WELCOME && (
              <motion.div 
                key="welcome"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center py-8"
              >
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-gray-100">
                  <User size={40} className="text-gray-300" />
                </div>
                <h2 className="text-3xl font-serif mb-4">Bem-vinda à Nera</h2>
                <p className="text-gray-500 mb-10 max-w-sm mx-auto leading-relaxed text-lg">
                  Vamos configurar seu perfil profissional em poucos passos para que suas clientes possam agendar com você.
                </p>
                <button 
                  onClick={nextStep}
                  className="px-10 py-4 bg-[#1A1A1A] text-white rounded-2xl font-bold flex items-center justify-center gap-2 mx-auto hover:bg-black transition-all"
                >
                  Começar Configuração
                  <ChevronRight size={20} />
                </button>
              </motion.div>
            )}

            {step === OnboardingStep.BASIC_INFO && (
              <motion.div 
                key="basic"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h2 className="text-2xl font-serif mb-8 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-sm font-bold">1</span>
                  Seu Perfil Profissional
                </h2>
                <div className="space-y-6">
                  <div className="flex items-center gap-6 mb-8">
                     <div className="relative group">
                       <div className="w-24 h-24 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
                          {profile.avatar ? (
                            <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <Camera size={32} className="text-gray-300" />
                          )}
                       </div>
                       <button className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full border border-gray-100 shadow-lg flex items-center justify-center text-gray-500 hover:text-black transition-colors">
                          <Plus size={16} />
                       </button>
                     </div>
                     <div>
                        <h4 className="font-semibold text-gray-900">Foto de Perfil</h4>
                        <p className="text-sm text-gray-400">Uma foto nítida aumenta as conversões em até 40%.</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nome Completo</label>
                       <input 
                         type="text" 
                         value={profile.name}
                         onChange={(e) => setProfile({...profile, name: e.target.value})}
                         className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl py-4 px-4 focus:bg-white focus:border-[#1A1A1A] outline-none transition-all"
                         placeholder="Ex: Maria Silva"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Especialidade</label>
                       <input 
                         type="text" 
                         value={profile.specialty}
                         onChange={(e) => setProfile({...profile, specialty: e.target.value})}
                         className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl py-4 px-4 focus:bg-white focus:border-[#1A1A1A] outline-none transition-all"
                         placeholder="Ex: Extensionista de Cílios"
                       />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Sua Biografia</label>
                    <textarea 
                      value={profile.bio}
                      onChange={(e) => setProfile({...profile, bio: e.target.value})}
                      className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl py-4 px-4 focus:bg-white focus:border-[#1A1A1A] outline-none transition-all h-32 resize-none"
                      placeholder="Conte um pouco sobre sua experiência e diferenciais..."
                    />
                  </div>
                </div>

                <div className="mt-12 flex justify-between">
                  <button onClick={prevStep} className="flex items-center gap-2 text-gray-400 hover:text-black font-semibold">
                    <ChevronLeft size={20} /> Voltar
                  </button>
                  <button 
                    onClick={nextStep} 
                    disabled={!profile.name || !profile.specialty}
                    className="px-10 py-4 bg-[#1A1A1A] text-white rounded-2xl font-bold flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed group"
                  >
                    Próximo Passo
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === OnboardingStep.LOCATION && (
              <motion.div 
                key="location"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <h2 className="text-2xl font-serif mb-8 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-sm font-bold">2</span>
                  Onde você atende?
                </h2>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cidade</label>
                       <input 
                         type="text" 
                         value={address.city}
                         onChange={(e) => setAddress({...address, city: e.target.value})}
                         className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl py-4 px-4 focus:bg-white focus:border-[#1A1A1A] outline-none transition-all"
                         placeholder="Ex: São Paulo"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bairro</label>
                       <input 
                         type="text" 
                         value={address.neighborhood}
                         onChange={(e) => setAddress({...address, neighborhood: e.target.value})}
                         className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl py-4 px-4 focus:bg-white focus:border-[#1A1A1A] outline-none transition-all"
                         placeholder="Ex: Jardins"
                       />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                       <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rua / Avenida</label>
                       <input 
                         type="text" 
                         value={address.street}
                         onChange={(e) => setAddress({...address, street: e.target.value})}
                         className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl py-4 px-4 focus:bg-white focus:border-[#1A1A1A] outline-none transition-all"
                         placeholder="Ex: Rua Estados Unidos"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Número</label>
                       <input 
                         type="text" 
                         value={address.number}
                         onChange={(e) => setAddress({...address, number: e.target.value})}
                         className="w-full bg-gray-50 border-gray-100 border-2 rounded-2xl py-4 px-4 focus:bg-white focus:border-[#1A1A1A] outline-none transition-all"
                         placeholder="123"
                       />
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex justify-between">
                  <button onClick={prevStep} className="flex items-center gap-2 text-gray-400 hover:text-black font-semibold">
                    <ChevronLeft size={20} /> Voltar
                  </button>
                  <button 
                    onClick={nextStep} 
                    disabled={!address.city || !address.neighborhood}
                    className="px-10 py-4 bg-[#1A1A1A] text-white rounded-2xl font-bold flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed group transition-all"
                  >
                    Próximo Passo
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === OnboardingStep.SERVICES && (
              <motion.div 
                key="services"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-serif flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-sm font-bold">3</span>
                    Seus Serviços
                  </h2>
                   <div className={cn(
                    "text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest border",
                    services.length > 0 ? "text-green-500 bg-green-50 border-green-100" : "text-amber-500 bg-amber-50 border-amber-100"
                  )}>
                    {services.length === 0 ? "Obrigatório" : `${services.length} ${services.length === 1 ? 'Serviço' : 'Serviços'}`}
                  </div>
                </div>

                {/* Service Form */}
                <div className="bg-gray-50 rounded-3xl p-6 mb-8 border border-gray-100">
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nome do Serviço*</label>
                        <input 
                          type="text" 
                          value={newService.name}
                          onChange={(e) => setNewService({...newService, name: e.target.value})}
                          className="w-full bg-white border-gray-100 border-2 rounded-xl py-3 px-4 focus:border-[#1A1A1A] outline-none text-sm transition-all"
                          placeholder="Ex: Volume Russo"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Preço (R$)*</label>
                          <input 
                            type="number" 
                            value={newService.price}
                            onChange={(e) => setNewService({...newService, price: e.target.value})}
                            className="w-full bg-white border-gray-100 border-2 rounded-xl py-3 px-4 focus:border-[#1A1A1A] outline-none text-sm transition-all"
                            placeholder="0,00"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Min*</label>
                          <input 
                            type="number" 
                            value={newService.duration}
                            onChange={(e) => setNewService({...newService, duration: e.target.value})}
                            className="w-full bg-white border-gray-100 border-2 rounded-xl py-3 px-4 focus:border-[#1A1A1A] outline-none text-sm transition-all"
                            placeholder="60"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Descrição curta (Opcional)</label>
                       <input 
                          type="text" 
                          value={newService.description}
                          onChange={(e) => setNewService({...newService, description: e.target.value})}
                          className="w-full bg-white border-gray-100 border-2 rounded-xl py-3 px-4 focus:border-[#1A1A1A] outline-none text-sm transition-all"
                          placeholder="Ex: Técnica de fios 3D..."
                        />
                    </div>
                    <button 
                      onClick={handleAddService}
                      className="w-full py-3 bg-white border-[#1A1A1A] border-2 text-[#1A1A1A] rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#1A1A1A] hover:text-white transition-all shadow-sm"
                    >
                      <Plus size={18} /> Adicionar Serviço
                    </button>
                    {error && <div className="text-red-500 text-xs flex items-center gap-1 mt-1"><AlertCircle size={12}/> {error}</div>}
                  </div>
                </div>

                {/* Services List */}
                <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                  {services.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-3xl">
                      <Scissors className="mx-auto mb-3 text-gray-200" size={32} />
                      <p className="text-sm text-gray-400 font-medium">Você precisa de pelo menos 1 serviço.</p>
                    </div>
                  ) : (
                    services.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                             <Scissors size={18} />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900">{s.name}</h4>
                            <p className="text-xs text-gray-400">{s.duration} min • R$ {s.price}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveService(s.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-12 flex justify-between">
                  <button onClick={prevStep} className="flex items-center gap-2 text-gray-400 hover:text-black font-semibold">
                    <ChevronLeft size={20} /> Voltar
                  </button>
                  <button 
                    onClick={nextStep} 
                    disabled={services.length === 0}
                    className="px-10 py-4 bg-[#1A1A1A] text-white rounded-2xl font-bold flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed group transition-all"
                  >
                    Revisar Perfil
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === OnboardingStep.PREVIEW && (
              <motion.div 
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <h2 className="text-2xl font-serif mb-8 text-center">Tudo Pronto?</h2>
                <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 space-y-6 mb-10">
                   <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm overflow-hidden border border-gray-100 shrink-0">
                         {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" /> : <User className="text-gray-200" size={32} />}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{profile.name}</h3>
                        <p className="text-sm font-medium text-gray-400 uppercase tracking-widest">{profile.specialty}</p>
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-white p-4 rounded-2xl border border-gray-100">
                         <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1">Localização</p>
                         <p className="font-semibold text-gray-800 truncate">{address.neighborhood}, {address.city}</p>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-gray-100">
                         <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1">Serviços</p>
                         <p className="font-semibold text-gray-800">{services.length} itens cadastrados</p>
                      </div>
                   </div>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-500 rounded-2xl text-sm flex items-center gap-2">
                    <AlertCircle size={18} /> {error}
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  <button 
                    onClick={handleComplete}
                    disabled={loading || services.length === 0}
                    className="w-full py-5 bg-[#1A1A1A] text-white rounded-2xl font-bold text-lg shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Publicando seu Perfil...
                      </>
                    ) : services.length === 0 ? (
                      <>
                        Adicione um serviço antes
                        <AlertCircle size={20} className="text-red-400" />
                      </>
                    ) : (
                      <>
                        Finalizar e Publicar Página
                        <Sparkles size={20} className="text-amber-400" />
                      </>
                    )}
                  </button>
                  <button onClick={prevStep} className="py-4 text-gray-400 hover:text-black font-semibold transition-colors">
                    Fazer alterações
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <div className="mt-8 text-center text-gray-400 text-xs font-medium uppercase tracking-[0.2em]">
          Plataforma Segura para Profissionais Nera
        </div>

      </div>
    </div>
  );
};
