import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { db, storage, auth, app, handleFirestoreError, OperationType, uploadImageToStorage, saveProfilePartial, savePortfolioItem, deletePortfolioItem } from '../firebase';
import { doc, updateDoc, collection, query, orderBy, getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from 'firebase/storage';
import { 
  Calendar, List, Settings, Save, User, MapPin, Home, Building2, Briefcase,
  Phone, Link as LinkIcon, Camera, Sparkles, ExternalLink, Users, X, Plus, ShieldCheck, LogOut,
  RefreshCw, CheckCircle2, AlertCircle, Trash2, Lock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { formatCurrency, cn, getHumanError, cleanWhatsapp, formatWhatsappDisplay, isValidWhatsapp } from '../lib/utils';
import { THEMES, getTheme } from '../lib/themes';
import Logo from '../components/Logo';
import AppLayout from '../components/AppLayout';
import AppLoadingScreen from '../components/AppLoadingScreen';
import { FormIdentity } from '../components/FormIdentity';
import { FormLocation } from '../components/FormLocation';
import { analyzePortfolio } from '../services/aiService';
import { useProfileForm } from '../hooks/useProfileForm';
import { usePlanFeatures } from '../hooks/usePlanFeatures';
import UpgradeModal from '../components/UpgradeModal';
import PremiumButton from '../components/PremiumButton';

const IDENTITY_DIFFERENTIALS = [
  'Pontualidade',
  'Biossegurança',
  'Atendimento personalizado',
  'Produtos premium',
  'Ambiente confortável',
  'Técnica avançada',
  'Resultado duradouro',
  'Atendimento exclusivo',
  'Naturalidade',
  'Experiência comprovada'
];

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

export default function ProfilePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);

  const profileCompleteness = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      !!profile.avatar,           // 15 pts — foto
      !!profile.bio,              // 15 pts — bio
      !!profile.headline,         // 10 pts — headline
      !!profile.instagram,        // 10 pts — instagram
      (profile.portfolio?.length || 0) >= 3,  // 20 pts — portfolio com 3+ fotos
      (profile.professionalIdentity?.differentials?.length || 0) >= 2, // 10 pts
      !!profile.professionalIdentity?.yearsExperience, // 10 pts
      !!profile.studioAddress?.street || (profile.serviceAreas?.length || 0) > 0, // 10 pts
    ];
    const pts = [15,15,10,10,20,10,10,10];
    let total = 0;
    fields.forEach((f, i) => { if (f) total += pts[i]; });
    return total;
  }, [profile]);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  
  const {
    name, setName,
    specialty, setSpecialty,
    bio, setBio,
    city, setCity,
    whatsapp, setWhatsapp,
    slug, setSlug,
    avatar, setAvatar,
    neighborhood, setNeighborhood,
    headline, setHeadline,
    instagram, setInstagram,
    differentials, setDifferentials,
    serviceMode, setServiceMode,
    studioAddress, setStudioAddress,
    serviceAreas, setServiceAreas,
    serviceAreaType, setServiceAreaType,
    pricingStrategy, setPricingStrategy,
    workingDays, setWorkingDays,
    startTime, setStartTime,
    endTime, setEndTime,
    paymentMethods, setPaymentMethods,
    antiNoShowEnabled, setAntiNoShowEnabled,
    advancePaymentRequired, setAdvancePaymentRequired,
    delayTolerance, setDelayTolerance,
    profileTheme, setProfileTheme
  } = useProfileForm(profile);

  const { plan, allowedThemes } = usePlanFeatures();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<'analytics' | 'advancedDashboard' | 'unlimitedBookings' | 'whatsappNotifications' | 'waitlist' | 'antiNoShow' | 'coupons' | 'reports'>('advancedDashboard');

  const isThemeLocked = (variant: string) => {
    return !allowedThemes.includes(variant);
  };

  const handleThemeClick = (variant: string) => {
    if (isThemeLocked(variant)) {
      setUpgradeFeature('advancedDashboard'); // Themes are part of advanced branding/dashboard features
      setIsUpgradeModalOpen(true);
      return;
    }
    setProfileTheme({ variant: variant as any });
  };

  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [googleCalendarEnabled, setGoogleCalendarEnabled] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaFee, setNewAreaFee] = useState('');
  const [portfolio, setPortfolio] = useState<{id?: string, url: string, category: string, isUploading?: boolean}[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile && user) {
      setAvatarPreview(profile.avatar || '');

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

  useEffect(() => {
    if (user) {
      fetchCalendarStatus();
    }
  }, [user]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin if needed
      if (event.data?.type === 'CALENDAR_AUTH_SUCCESS') {
        toast.success('Google Calendar conectado com sucesso!');
        fetchCalendarStatus();
      } else if (event.data?.type === 'CALENDAR_AUTH_ERROR') {
        toast.error(`Erro ao conectar: ${event.data.error}`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchCalendarStatus = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/calendar/status?professionalId=${user.uid}`);
      const data = await res.json();
      setGoogleCalendarConnected(data.connected);
      setGoogleCalendarEnabled(data.enabled);
    } catch (err) {
      console.error('Error fetching calendar status:', err);
    }
  };

  const handleConnectCalendar = async () => {
    if (!user) return;
    setCalendarLoading(true);
    try {
      const res = await fetch(`/api/calendar/auth-url?professionalId=${user.uid}`);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, 'google_auth', 'width=600,height=700');
      }
    } catch (err) {
      toast.error('Erro ao iniciar conexão com Google Calendar.');
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleToggleCalendar = async (enabled: boolean) => {
    if (!user) return;
    try {
      await fetch('/api/calendar/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ professionalId: user.uid, enabled }),
      });
      setGoogleCalendarEnabled(enabled);
      toast.success(enabled ? 'Sincronização ativada.' : 'Sincronização desativada.');
    } catch (err) {
      toast.error('Erro ao alterar status da sincronização.');
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!user || !confirm('Tem certeza que deseja remover a integração com Google Calendar?')) return;
    try {
      await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ professionalId: user.uid }),
      });
      setGoogleCalendarConnected(false);
      setGoogleCalendarEnabled(false);
      toast.success('Google Calendar desconectado.');
    } catch (err) {
      toast.error('Erro ao desconectar.');
    }
  };

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
    if (!whatsapp.trim()) {
      errors.whatsapp = 'O WhatsApp é obrigatório';
    } else if (!isValidWhatsapp(whatsapp)) {
      errors.whatsapp = 'Número inválido. Use (DD) 9XXXX-XXXX';
    }
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
          reference: (studioAddress.reference || '').trim(),
          privacyMode: studioAddress.privacyMode || 'reveal_after_booking'
        },
        whatsapp: sanitizedWhatsapp,
        instagram: instagram.trim(),
        slug: sanitizedSlug,
        serviceMode,
        serviceAreaType,
        serviceAreas: sanitizedAreas,
        pricingStrategy,
        avatar,
        profileTheme,
        paymentMethods: paymentMethods.length > 0 ? paymentMethods : undefined,
        antiNoShowEnabled,
        advancePaymentRequired,
        delayTolerance,
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
        console.log('[ProfileSave] Calling transactional save API...');
        const response = await fetch('/api/profile/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: user.uid,
            profileData: finalPayload,
            services: [] // We don't update services in this simple save flow yet, or we could pass them if available
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao salvar perfil');
        }

        console.log('[ProfileSave] Success');
        toast.success('Seu perfil foi atualizado com sucesso.');
      } catch (err: any) {
        console.error('[ProfileSave] Failed:', err);
        toast.error(err.message || 'Não foi possível salvar seu perfil agora.');
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

        // 3b. AI Categorization
        let autoCategory = '';
        try {
          autoCategory = await analyzePortfolio({ imageUrl: url, specialty });
        } catch {
          // silencioso — categoria fica vazia se falhar
        }
        
        // 4. Persistence
        console.log('[Portfolio] saving to Firestore');
        const docId = await savePortfolioItem(user.uid, url, autoCategory || specialty || 'Geral');
        console.log('[Portfolio] saved successfully');
        
        // Replace temp item with final item
        setPortfolio(prev => prev.map(item => 
          item.id === tempId ? { id: docId, url: url, category: autoCategory || specialty || 'Geral' } : item
        ));

        toast.success(`Foto adicionada${autoCategory ? ` · ${autoCategory}` : ''}`);
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

    setDeletingId(id);
    try {
      console.log('[Portfolio] removing from Firestore');
      await deletePortfolioItem(user.uid, itemToRemove);
      console.log('[Portfolio] removed successfully');
      
      setPortfolio(prev => prev.filter(item => item.id !== id));
      toast.success('Galeria atualizada.');
    } catch (err) {
      console.error('[Portfolio] Error removing:', err);
      toast.error('Não foi possível remover a imagem.');
    } finally {
      setDeletingId(null);
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
      <div className="p-6 md:p-12 pb-32 md:pb-12 max-w-5xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-serif font-normal text-brand-ink mb-2">Meu Perfil Profissional</h1>
            <p className="text-brand-stone font-light">Personalize como sua página pública aparece para as clientes.</p>
          </div>
          <Link to={`/p/${profile?.slug}`} target="_blank" className="flex items-center gap-2 text-brand-terracotta font-medium text-sm hover:text-brand-sienna transition-colors">
            Ver meu perfil <ExternalLink size={16} />
          </Link>
        </header>

        {profileCompleteness < 100 ? (
          <div className="mb-8 p-6 bg-brand-linen rounded-3xl border border-brand-mist/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">
                  Perfil {profileCompleteness}% completo
                </span>
                <p className="text-[10px] text-brand-stone font-light italic mt-1 leading-none">
                  Complete seu perfil para atrair e converter mais clientes.
                </p>
              </div>
              <span className="text-[10px] text-brand-terracotta font-bold uppercase animate-pulse">Quase lá!</span>
            </div>
            <div className="w-full h-1.5 bg-brand-white rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-brand-terracotta rounded-full transition-all duration-1000 ease-out shadow-sm"
                style={{ width: `${profileCompleteness}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mb-8 flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full w-fit border border-green-100">
            <CheckCircle2 size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Perfil completo!</span>
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
                  <h3 className="font-serif italic text-xl text-brand-ink">Meu Portfólio</h3>
                </div>
                <p className="text-[10px] text-brand-stone font-medium uppercase tracking-widest">Exiba fotos do seu trabalho</p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                    </div>

                    {!item.isUploading && (
                      <button 
                        type="button"
                        onClick={() => item.id && removePortfolioImage(item.id)}
                        disabled={deletingId === item.id}
                        className="absolute top-2 right-2 p-2 bg-white text-red-500 rounded-full shadow-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 disabled:opacity-50 z-20"
                      >
                        {deletingId === item.id ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : <Trash2 size={14} />}
                      </button>
                    )}

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

            {/* Estilo da vitrine */}
            <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm">
              <div className="pt-2">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-brand-terracotta/10 rounded-xl">
                    <Sparkles size={20} className="text-brand-terracotta" />
                  </div>
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone">
                    Estilo da sua vitrine
                  </h3>
                </div>

                <p className="text-xs text-brand-stone font-light mb-6">Escolha o tema visual que melhor representa sua marca.</p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  {Object.entries(THEMES).map(([variant, theme]) => {
                    const locked = isThemeLocked(variant);
                    return (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => handleThemeClick(variant)}
                        className={cn(
                          "flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all relative overflow-hidden group",
                          profileTheme.variant === variant 
                            ? "border-brand-ink bg-brand-linen/30 shadow-sm"
                            : "border-brand-mist bg-white hover:border-brand-stone",
                          locked && "opacity-80"
                        )}
                      >
                        <div 
                          className="w-12 h-12 rounded-full shadow-inner border border-black/5 relative"
                          style={{ backgroundColor: theme.primary }}
                        >
                          {locked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-brand-ink/20 rounded-full backdrop-blur-[1px]">
                              <Lock size={14} className="text-white" />
                            </div>
                          )}
                        </div>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest text-center leading-tight",
                          profileTheme.variant === variant ? "text-brand-ink" : "text-brand-stone"
                        )}>
                          {theme.name.split(' ')[0]}
                        </span>
                        
                        {profileTheme.variant === variant && (
                          <div className="absolute top-2 right-2 bg-brand-ink text-white rounded-full p-1">
                            <CheckCircle2 size={10} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Anti No-Show Section */}
            <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm">
              <div className="pt-2">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-brand-terracotta/10 rounded-xl">
                    <ShieldCheck size={20} className="text-brand-terracotta" />
                  </div>
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone">
                    Proteção Anti No-Show
                  </h3>
                </div>

                <div className="space-y-8">
                  <div className="flex items-center justify-between p-6 bg-brand-parchment/30 rounded-3xl border border-brand-mist/50">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-brand-ink mb-1">Confirmação 24h</p>
                      <p className="text-xs text-brand-stone font-light italic">Enviar lembrete automático 24h antes do horário para o cliente confirmar presença.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAntiNoShowEnabled(!antiNoShowEnabled)}
                      className={cn(
                        "w-14 h-8 rounded-full transition-all relative",
                        antiNoShowEnabled ? "bg-brand-ink" : "bg-brand-mist"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-6 h-6 rounded-full bg-brand-white transition-all",
                        antiNoShowEnabled ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-6 bg-brand-parchment/30 rounded-3xl border border-brand-mist/50">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-brand-ink mb-1">Sinal Antecipado (Opcional)</p>
                      <p className="text-xs text-brand-stone font-light italic">Indicar na vitrine que você solicita um sinal via Pix para garantir a reserva.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdvancePaymentRequired(!advancePaymentRequired)}
                      className={cn(
                        "w-14 h-8 rounded-full transition-all relative",
                        advancePaymentRequired ? "bg-brand-ink" : "bg-brand-mist"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-6 h-6 rounded-full bg-brand-white transition-all",
                        advancePaymentRequired ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone mb-4 ml-1">Tolerância de Atraso</p>
                    <div className="flex gap-3">
                      {[10, 15, 20].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setDelayTolerance(val as 10 | 15 | 20)}
                          className={cn(
                            "flex-1 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                            delayTolerance === val
                              ? "bg-brand-ink text-brand-white border-brand-ink"
                              : "bg-brand-white text-brand-stone border-brand-mist hover:border-brand-ink"
                          )}
                        >
                          {val} min
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Methods Section */}
            <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm">
              <div className="pt-2">
                <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone mb-6">
                  Formas de Pagamento Aceitas
                </h3>
                <div className="flex flex-wrap gap-3">
                  {[
                    { id: 'pix', label: 'Pix' },
                    { id: 'credito', label: 'Cartão de Crédito' },
                    { id: 'debito', label: 'Cartão de Débito' },
                    { id: 'dinheiro', label: 'Dinheiro' },
                    { id: 'transferencia', label: 'Transferência' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethods(prev =>
                        prev.includes(m.id) ? prev.filter(p => p !== m.id) : [...prev, m.id]
                      )}
                      className={cn(
                        "px-5 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                        paymentMethods.includes(m.id)
                          ? "bg-brand-ink text-brand-white border-brand-ink"
                          : "bg-brand-white text-brand-stone border-brand-mist hover:border-brand-ink"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
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
                serviceAreaType={serviceAreaType}
                setServiceAreaType={setServiceAreaType}
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
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day, idx) => (
                    <button 
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`min-w-[44px] h-[44px] flex-1 sm:flex-none rounded-full font-medium text-[10px] transition-all ${workingDays.includes(idx) ? 'bg-brand-ink text-brand-white shadow-lg' : 'bg-brand-parchment text-brand-stone border border-brand-mist hover:border-brand-stone'}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                <div className="space-y-2 min-w-0">
                  <label className="text-[9px] font-bold text-brand-stone uppercase tracking-[0.15em] ml-1">Início</label>
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)} 
                    className="w-full px-4 py-3 bg-brand-parchment border border-brand-mist rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-sm text-brand-ink min-w-0"
                  />
                </div>
                <div className="space-y-2 min-w-0">
                  <label className="text-[9px] font-bold text-brand-stone uppercase tracking-[0.15em] ml-1">Fim</label>
                  <input 
                    type="time" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)} 
                    className="w-full px-4 py-3 bg-brand-parchment border border-brand-mist rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-sm text-brand-ink min-w-0"
                  />
                </div>
              </div>
            </div>
            
            {/* Google Calendar Section */}
            <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm space-y-8">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Calendar size={20} />
                  </div>
                  <h3 className="font-serif italic text-xl text-brand-ink">Google Calendar</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    googleCalendarConnected ? "bg-green-500" : "bg-brand-mist"
                  )} />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-brand-stone">
                    {googleCalendarConnected ? "Conectado" : "Disponível"}
                  </span>
                </div>
              </div>

              <div className="p-6 bg-brand-parchment/30 rounded-3xl border border-brand-mist/50">
                {!googleCalendarConnected ? (
                  <div className="space-y-4">
                    <p className="text-xs text-brand-stone font-light leading-relaxed">
                      Sincronize sua agenda do Nera com seu Google Calendar pessoal. Novos agendamentos confirmados serão adicionados automaticamente com todos os detalhes da cliente.
                    </p>
                    <button
                      type="button"
                      onClick={handleConnectCalendar}
                      disabled={calendarLoading}
                      className="w-full py-4 bg-white border border-brand-mist rounded-2xl flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-widest text-brand-ink hover:bg-brand-linen transition-all disabled:opacity-50"
                    >
                      {calendarLoading ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <>
                          <Calendar size={14} /> Conectar Google Calendar
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-ink mb-1">Sincronização Ativa</p>
                        <p className="text-[10px] text-brand-stone font-light italic">
                          {googleCalendarEnabled 
                            ? "Sua agenda está sendo sincronizada automaticamente." 
                            : "A sincronização está pausada."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleCalendar(!googleCalendarEnabled)}
                        className={cn(
                          "w-14 h-8 rounded-full transition-all relative",
                          googleCalendarEnabled ? "bg-brand-ink" : "bg-brand-mist"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-6 h-6 rounded-full bg-brand-white transition-all",
                          googleCalendarEnabled ? "left-7" : "left-1"
                        )} />
                      </button>
                    </div>

                    <div className="pt-4 border-t border-brand-mist/50 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[10px] text-green-600 font-medium">
                        <CheckCircle2 size={12} />
                        Conectado ao seu Google
                      </div>
                      <button
                        type="button"
                        onClick={handleDisconnectCalendar}
                        className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-600 transition-colors flex items-center gap-2"
                      >
                        <Trash2 size={12} /> Desconectar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-brand-ink text-brand-white py-8 rounded-[32px] text-[12px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
            >
              <Save size={18} /> {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>

            <div className="pt-8 border-t border-brand-mist">
              <button 
                type="button"
                onClick={async () => {
                   if (confirm('Tem certeza que deseja sair da sua conta?')) {
                     await auth.signOut();
                     window.location.href = '/login';
                   }
                }}
                className="w-full bg-white border border-red-100 text-red-500 py-6 rounded-[32px] text-[11px] font-bold uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-3"
              >
                <LogOut size={18} /> Sair da conta
              </button>
            </div>
          </div>
        </form>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur border-t border-brand-mist md:hidden z-50">
          <button 
            type="button"
            onClick={handleSave} 
            disabled={loading}
            className="w-full py-4 bg-brand-ink text-white rounded-full text-[11px] font-bold uppercase tracking-widest shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {loading ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>

        <UpgradeModal 
          open={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          feature={upgradeFeature}
        />
      </div>
    </AppLayout>
  );
}
