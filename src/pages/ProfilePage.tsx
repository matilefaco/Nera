import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, storage, auth, app, handleFirestoreError, OperationType, uploadImageToStorage, saveProfilePartial, savePortfolioItem, deletePortfolioItem } from '../firebase';
import { doc, updateDoc, collection, query, orderBy, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from 'firebase/storage';
import { 
  Calendar, List, Settings, Save, User, MapPin, Home, Building2, Briefcase,
  Phone, Link as LinkIcon, Camera, Sparkles, ExternalLink, Users, X, Plus, ShieldCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { formatCurrency, cn, getHumanError, cleanWhatsapp, formatWhatsappDisplay } from '../lib/utils';
import Logo from '../components/Logo';
import AppLayout from '../components/AppLayout';
import AppLoadingScreen from '../components/AppLoadingScreen';
import { FormIdentity } from '../components/FormIdentity';
import { FormLocation } from '../components/FormLocation';

const IDENTITY_DIFFERENTIALS = [
  'Pontualidade',
  'Biossegurança',
  'Produtos premium',
  'Atendimento exclusivo',
  'Técnica avançada'
];

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export default function ProfilePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [slug, setSlug] = useState('');
  const [avatar, setAvatar] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [headline, setHeadline] = useState('');
  const [instagram, setInstagram] = useState('');
  const [differentials, setDifferentials] = useState<string[]>([]);
  const [serviceMode, setServiceMode] = useState<'home' | 'studio' | 'hybrid'>('studio');
  const [studioAddress, setStudioAddress] = useState({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    reference: ''
  });
  const [serviceAreas, setServiceAreas] = useState<any[]>([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaFee, setNewAreaFee] = useState('');
  const [pricingStrategy, setPricingStrategy] = useState<'extra' | 'none'>('none');
  const [portfolio, setPortfolio] = useState<{id?: string, url: string, category: string, isUploading?: boolean}[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Working Hours State
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');

  useEffect(() => {
    if (profile && user) {
      setName(profile.name || '');
      setSpecialty(profile.specialty || profile.professionalIdentity?.mainSpecialty || '');
      // bio/headline synchronization with migration fallback
      setBio(profile.bio || (profile.professionalIdentity as any)?.bio || '');
      setHeadline(profile.headline || (profile.professionalIdentity as any)?.headline || '');
      setCity(profile.city || profile.studioAddress?.city || profile.location || '');
      setWhatsapp(profile.whatsapp || '');
      setInstagram(profile.instagram || '');
      setSlug(profile.slug || '');
      setAvatar(profile.avatar || '');
      setAvatarPreview(profile.avatar || '');
      setNeighborhood(profile.neighborhood || profile.studioAddress?.neighborhood || '');
      setHeadline(profile.headline || '');
      setDifferentials(profile.professionalIdentity?.differentials || []);
      setServiceMode(profile.serviceMode || 'studio');
      if (profile.studioAddress) {
        setStudioAddress(profile.studioAddress);
      } else if (profile.address) {
        setStudioAddress(prev => ({ ...prev, street: profile.address }));
      }
      setServiceAreas(profile.serviceAreas || []);
      setPricingStrategy(profile.pricingStrategy || 'none');

      // Load working hours with fallback
      if (profile.workingHours) {
        setWorkingDays(profile.workingHours.workingDays || [1, 2, 3, 4, 5]);
        setStartTime(profile.workingHours.startTime || '09:00');
        setEndTime(profile.workingHours.endTime || '18:00');
      } else if (profile.startTime) {
        setStartTime(profile.startTime);
        setEndTime(profile.endTime || '18:00');
        setWorkingDays(profile.workingDays || [1, 2, 3, 4, 5]);
      }

      // Load portfolio from profile array (Single Source of Truth)
      if (profile.portfolio) {
        setPortfolio(profile.portfolio);
      } else {
        // Fallback: Fetch portfolio from sub-collection if array is empty
        const fetchPortfolio = async () => {
          try {
            console.log('[Profile] Fetching portfolio sub-collection...');
            const portfolioRef = collection(db, 'users', user.uid, 'portfolio');
            const q = query(portfolioRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const items = snapshot.docs.map(doc => ({
              id: doc.id,
              url: doc.data().imageUrl || doc.data().url,
              category: doc.data().category
            }));
            console.log('[Profile] Portfolio items fetched from sub-collection:', items.length);
            if (items.length > 0) setPortfolio(items);
          } catch (err) {
            console.error('[Profile] Error fetching portfolio:', err);
          }
        };
        fetchPortfolio();
      }
    }
  }, [profile, user]);

  if (authLoading) {
    return <AppLoadingScreen message="Carregando seu perfil..." />;
  }

  const uploadImage = async (file: File, path: string): Promise<string> => {
    console.log(`[ProfileSave] Uploading image to ${path}...`);
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    console.log(`[ProfileSave] Upload successful: ${url}`);
    return url;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Sessão encerrada. Por favor, faça login novamente.');
      return;
    }

    setFormErrors({});

    // Simple validation before saving
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'O nome é obrigatório';
    if (!specialty.trim()) errors.specialty = 'Informe sua especialidade';
    if (!slug.trim()) errors.slug = 'O link da página é obrigatório';
    if (!whatsapp.trim()) errors.whatsapp = 'O WhatsApp é obrigatório';
    if (!city.trim()) errors.city = 'Informe sua cidade';
    if (!neighborhood.trim()) errors.neighborhood = 'Informe seu bairro';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Por favor, preencha os campos destacados.');
      return;
    }

    setLoading(true);
    console.log('[ProfileSave] Start');

    try {
      // 1. Sanitize Data
      console.log('[ProfileSave] Validating and sanitizing payload');
      const sanitizedName = name.trim();
      const sanitizedSpecialty = specialty.trim();
      const sanitizedBio = bio.trim();
      const sanitizedCity = city.trim();
      const sanitizedWhatsapp = cleanWhatsapp(whatsapp);
      const sanitizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      
      const sanitizedAreas = serviceAreas
        .filter(area => area.name && area.name.trim())
        .map(area => ({
          name: area.name.trim(),
          fee: Number(area.fee) || 0
        }));

      // 2. Prepare Payload
      const finalPayload = {
        name: sanitizedName,
        specialty: sanitizedSpecialty,
        city: sanitizedCity,
        neighborhood: neighborhood.trim(),
        bio: sanitizedBio,
        headline: headline.trim(),
        studioAddress: {
          street: (studioAddress.street || '').trim(),
          number: (studioAddress.number || '').trim(),
          complement: (studioAddress.complement || '').trim(),
          neighborhood: (studioAddress.neighborhood || neighborhood.trim()).trim(),
          city: (studioAddress.city || sanitizedCity).trim(),
          reference: (studioAddress.reference || '').trim()
        },
        whatsapp: sanitizedWhatsapp,
        instagram: instagram.trim(),
        slug: sanitizedSlug,
        serviceMode,
        serviceAreas: sanitizedAreas,
        pricingStrategy,
        avatar,
        workingHours: {
          startTime,
          endTime,
          workingDays
        },
        professionalIdentity: {
          mainSpecialty: sanitizedSpecialty,
          differentials: differentials,
          yearsExperience: profile?.professionalIdentity?.yearsExperience || '3-5',
          serviceStyle: profile?.professionalIdentity?.serviceStyle || [],
          attendsAt: serviceMode as any
        },
        updatedAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'users', user.uid), finalPayload, { merge: true });
        console.log('[ProfileSave] Success');
        toast.success('Sua vitrine foi atualizada.');
      } catch (err: any) {
        console.error('[ProfileSave] Failed:', err);
        if (err?.code === 'resource-exhausted' || err?.message?.includes('too large')) {
          toast.error('Sua vitrine está com muitas informações. Tente remover algumas fotos.');
        } else {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
        }
      }
    } catch (error: any) {
      console.error('[ProfileSave] CRITICAL ERROR:', error);
      toast.error('Não foi possível concluir agora. Tente novamente.');
    } finally {
      setLoading(false);
      console.log('[ProfileSave] Done');
    }
  };

  const addArea = () => {
    if (!newAreaName) return;
    if (pricingStrategy === 'extra' && !newAreaFee) {
      toast.error('Por favor, informe o valor adicional.');
      return;
    }
    setServiceAreas([...serviceAreas, { name: newAreaName, fee: Number(newAreaFee || 0) }]);
    setNewAreaName('');
    setNewAreaFee('');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (file && user) {
      setUploadingImage(true);
      
      // 1. Immediate Local Preview
      const localUrl = URL.createObjectURL(file);
      setAvatarPreview(localUrl);

      try {
        // 2. Compression
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 800,
          useWebWorker: true
        };
        const compressedFile = await imageCompression(file, options);
        
        // 3. Upload
        const url = await uploadImageToStorage(compressedFile, `avatars/${user.uid}`);
        
        setAvatar(url);
        
        // PERSISTENCE: Save immediately
        await saveProfilePartial(user.uid, { avatar: url });
        
        toast.success('Foto atualizada com sucesso.');
      } catch (err: any) {
        console.error('[Avatar] upload flow failed:', err);
        toast.error('Não foi possível salvar a imagem agora.');
        // Revert preview on error
        setAvatarPreview(avatar);
      } finally {
        setUploadingImage(false);
        // Reset input
        if (avatarInputRef.current) avatarInputRef.current.value = '';
      }
    }
  };

  const handlePortfolioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;

    if (files && files.length > 0 && user) {
      setUploadingImage(true);
      const file = files[0];
      const tempId = 'temp-' + Date.now();
      
      // 1. Immediate Local Preview
      try {
        const localUrl = URL.createObjectURL(file);
        setPortfolio(prev => [{ id: tempId, url: localUrl, category: specialty || 'Geral', isUploading: true }, ...prev]);
      } catch (previewErr) {
        console.error('[Portfolio] error creating preview:', previewErr);
      }

      try {
        // 2. Compression
        const options = { maxSizeMB: 0.2, maxWidthOrHeight: 1200, useWebWorker: false };
        const compressed = await imageCompression(file, options);

        // 3. Upload
        const url = await uploadImageToStorage(compressed, `portfolio/${user.uid}`);
        console.log('[Portfolio] upload finished:', url);
        
        // 4. Persistence
        console.log('[Portfolio] saving to Firestore');
        const docId = await savePortfolioItem(user.uid, url, specialty || 'Geral');
        console.log('[Portfolio] saved successfully');
        
        // Replace temp item with final item
        setPortfolio(prev => prev.map(item => 
          item.id === tempId ? { id: docId, url: url, category: specialty || 'Geral' } : item
        ));

        toast.success('Galeria atualizada.');
      } catch (err: any) {
        console.error('[Portfolio] upload failed:', err);
        toast.error('Não foi possível carregar a imagem.');
        // Remove temp item on error
        setPortfolio(prev => prev.filter(item => item.id !== tempId));
      } finally {
        setUploadingImage(false);
        if (portfolioInputRef.current) portfolioInputRef.current.value = '';
      }
    }
  };

  const removePortfolioImage = async (id: string) => {
    if (!user || !id) return;
    
    // Don't allow removing temp items that are still uploading
    if (id.startsWith('temp-')) return;

    const itemToRemove = portfolio.find(item => item.id === id);
    if (!itemToRemove) return;

    try {
      console.log('[Portfolio] removing from Firestore');
      await deletePortfolioItem(user.uid, itemToRemove);
      console.log('[Portfolio] removed successfully');
      
      setPortfolio(prev => prev.filter(item => item.id !== id));
      toast.success('Galeria atualizada.');
    } catch (err) {
      console.error('[Portfolio] Error removing:', err);
      toast.error('Não foi possível remover a imagem.');
    }
  };

  const removeArea = (index: number) => {
    setServiceAreas(serviceAreas.filter((_, i) => i !== index));
  };

  const toggleDay = (day: number) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter(d => d !== day));
    } else {
      setWorkingDays([...workingDays, day].sort());
    }
  };

  return (
    <AppLayout activeRoute="profile">
      <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-serif font-normal text-brand-ink mb-2">Minha Identidade Visual</h1>
            <p className="text-brand-stone font-light">Personalize sua presença digital para encantar suas clientes.</p>
          </div>
          <Link to={`/p/${profile?.slug}`} target="_blank" className="flex items-center gap-2 text-brand-terracotta font-medium text-sm hover:text-brand-sienna transition-colors">
            Ver meu espaço <ExternalLink size={16} />
          </Link>
        </header>

        {/* Profile Completion Guidance (Internal Only) */}
        {profile && (
          <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {!profile.bio && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-brand-linen/50 border border-brand-mist p-6 rounded-[32px] flex items-start gap-4">
                <div className="w-10 h-10 bg-brand-white rounded-2xl flex items-center justify-center text-brand-terracotta shrink-0 shadow-sm">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-serif text-brand-ink mb-1">Bio ausente</h4>
                  <p className="text-[10px] text-brand-stone leading-relaxed">Perfis com biografia convertem até 40% mais. Conte sua história!</p>
                </div>
              </motion.div>
            )}
            {(!portfolio || portfolio.length < 3) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-brand-linen/50 border border-brand-mist p-6 rounded-[32px] flex items-start gap-4">
                <div className="w-10 h-10 bg-brand-white rounded-2xl flex items-center justify-center text-brand-terracotta shrink-0 shadow-sm">
                  <Camera size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-serif text-brand-ink mb-1">
                    {!portfolio || portfolio.length === 0 ? 'Portfólio vazio' : 'Portfólio incompleto'}
                  </h4>
                  <p className="text-[10px] text-brand-stone leading-relaxed">
                    {!portfolio || portfolio.length === 0 
                      ? 'Adicione fotos do seu trabalho para passar confiança.' 
                      : `Você tem ${portfolio.length} foto(s). Recomendamos pelo menos 3.`}
                  </p>
                </div>
              </motion.div>
            )}
            {(!profile.professionalIdentity?.differentials || profile.professionalIdentity.differentials.length === 0) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-brand-linen/50 border border-brand-mist p-6 rounded-[32px] flex items-start gap-4">
                <div className="w-10 h-10 bg-brand-white rounded-2xl flex items-center justify-center text-brand-terracotta shrink-0 shadow-sm">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-serif text-brand-ink mb-1">Diferenciais</h4>
                  <p className="text-[10px] text-brand-stone leading-relaxed">Destaque o que torna seu atendimento único e premium.</p>
                </div>
              </motion.div>
            )}
          </div>
        )}

        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left Column: Avatar & Basic Identity */}
          <div className="lg:col-span-1 space-y-8">
            <FormIdentity
              name={name}
              setName={setName}
              specialty={specialty}
              setSpecialty={setSpecialty}
              avatar={avatar}
              avatarPreview={avatarPreview}
              uploadingImage={uploadingImage}
              onAvatarClick={() => avatarInputRef.current?.click()}
              inputRef={avatarInputRef}
              onFileUpload={handleAvatarUpload}
              showLabels={true}
              errors={formErrors}
            />
          </div>

          {/* Right Column: Portfolio, Rich Identity, Location & Schedule */}
          <div className="lg:col-span-2 space-y-10">
            {/* Portfolio Section */}
            <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm space-y-8">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Camera size={20} className="text-brand-terracotta" />
                  <h3 className="font-serif italic text-xl text-brand-ink">Minha Galeria</h3>
                </div>
                <p className="text-[10px] text-brand-stone font-medium uppercase tracking-widest">Exiba momentos do seu trabalho</p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {portfolio.map((item, idx) => (
                  <div key={item.id || idx} className="aspect-square bg-brand-parchment rounded-2xl overflow-hidden relative group border border-brand-mist">
                    <img src={item.url} className={`w-full h-full object-cover ${item.isUploading ? 'opacity-50 blur-sm' : ''}`} referrerPolicy="no-referrer" alt={`Portfolio ${idx}`} />
                    <div className="absolute inset-0 bg-brand-ink/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-3 backdrop-blur-[2px]">
                      <input 
                        type="text" 
                        value={item.category} 
                        onChange={async (e) => {
                          const newCategory = e.target.value;
                          const newPortfolio = [...portfolio];
                          newPortfolio[idx].category = newCategory;
                          setPortfolio(newPortfolio);
                          
                          if (user) {
                            try {
                              const userRef = doc(db, 'users', user.uid);
                              await updateDoc(userRef, { portfolio: newPortfolio });
                            } catch (err) {
                              console.error('[Portfolio] Error updating category:', err);
                            }
                          }
                        }}
                        className="w-full bg-brand-white/10 border border-brand-white/20 rounded-lg px-2 py-1.5 text-[10px] text-brand-white placeholder:text-brand-white/50 outline-none text-center mb-3 font-light"
                        placeholder="Categoria"
                      />
                      <button 
                        type="button"
                        onClick={() => item.id && removePortfolioImage(item.id)}
                        className="w-8 h-8 bg-brand-white text-brand-terracotta rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {item.isUploading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                          <Sparkles size={24} className="text-brand-white" />
                        </motion.div>
                      </div>
                    )}
                  </div>
                ))}
                <div 
                  onClick={() => portfolioInputRef.current?.click()}
                  className="aspect-square border border-dashed border-brand-terracotta/30 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-brand-linen transition-all text-brand-terracotta"
                >
                  {uploadingImage ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                      <Sparkles size={24} />
                    </motion.div>
                  ) : (
                    <>
                      <Plus size={24} />
                      <span className="text-[10px] font-medium uppercase tracking-widest">Adicionar</span>
                    </>
                  )}
                  <input 
                    ref={portfolioInputRef}
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handlePortfolioUpload} 
                    disabled={uploadingImage} 
                  />
                </div>
              </div>
            </div>

            {/* Rich Identity Section */}
            <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm">
              <FormIdentity
                name={name}
                setName={setName}
                specialty={specialty}
                setSpecialty={setSpecialty}
                avatar={avatar}
                avatarPreview={avatarPreview}
                uploadingImage={uploadingImage}
                onAvatarClick={() => avatarInputRef.current?.click()}
                inputRef={avatarInputRef}
                onFileUpload={handleAvatarUpload}
                headline={headline}
                setHeadline={setHeadline}
                bio={bio}
                setBio={setBio}
                whatsapp={whatsapp}
                setWhatsapp={setWhatsapp}
                instagram={instagram}
                setInstagram={setInstagram}
                slug={slug}
                setSlug={setSlug}
                differentials={differentials}
                setDifferentials={setDifferentials}
                availableDifferentials={IDENTITY_DIFFERENTIALS}
                showLabels={true}
                errors={formErrors}
              />
            </div>

            {/* Location Section */}
            <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm">
              <FormLocation
                title="Sua Localização"
                subtitle="Configure como e onde você atende."
                city={city}
                setCity={setCity}
                neighborhood={neighborhood}
                setNeighborhood={setNeighborhood}
                serviceMode={serviceMode}
                setServiceMode={setServiceMode}
                studioAddress={studioAddress}
                setStudioAddress={setStudioAddress}
                serviceAreaType={profile?.serviceAreaType || 'custom'} // Using profile for some persistent settings if not in state
                setServiceAreaType={() => {}} // Could add state for this if needed in ProfilePage
                serviceAreas={serviceAreas}
                setServiceAreas={setServiceAreas}
                pricingStrategy={pricingStrategy}
                setPricingStrategy={setPricingStrategy}
                newAreaName={newAreaName}
                setNewAreaName={setNewAreaName}
                newAreaFee={newAreaFee}
                setNewAreaFee={setNewAreaFee}
                addArea={addArea}
                removeArea={removeArea}
                formatCurrency={formatCurrency}
                errors={formErrors}
              />
            </div>

            {/* Working Hours Section */}
            <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm space-y-8">
              <div className="flex items-center gap-3">
                <Calendar size={20} className="text-brand-terracotta" />
                <h3 className="font-serif italic text-xl text-brand-ink">Horários de Atendimento</h3>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Dias de Trabalho</label>
                <div className="flex justify-between gap-1">
                  {WEEKDAYS.map((day, idx) => (
                    <button 
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`w-9 h-9 md:w-10 md:h-10 rounded-full font-medium text-[10px] transition-all ${workingDays.includes(idx) ? 'bg-brand-ink text-brand-white shadow-lg' : 'bg-brand-parchment text-brand-stone border border-brand-mist hover:border-brand-stone'}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Início do Dia</label>
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)} 
                    className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-brand-ink"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Fim do Dia</label>
                  <input 
                    type="time" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)} 
                    className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-brand-ink"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-brand-ink text-brand-white py-7 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
            >
              <Save size={18} /> {loading ? 'Refinando...' : 'Atualizar Minha Marca'}
            </button>
          </div>
        </form>
      </main>
    </AppLayout>
  );
}
