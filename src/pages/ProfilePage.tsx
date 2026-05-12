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
import { notify } from '../lib/notify';
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
        setPortfolio(profile.portfolio as any);
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
        notify.success('Google Calendar conectado com sucesso!');
        fetchCalendarStatus();
      } else if (event.data?.type === 'CALENDAR_AUTH_ERROR') {
        notify.error(`Erro ao conectar: ${event.data.error}`);
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
      notify.error('Erro ao iniciar conexão com Google Calendar.');
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleToggleCalendar = async (enabled: boolean) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await fetch('/api/calendar/toggle', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ professionalId: user.uid, enabled }),
      });
      setGoogleCalendarEnabled(enabled);
      notify.success(enabled ? 'Sincronização ativada.' : 'Sincronização desativada.');
    } catch (err) {
      notify.error('Erro ao alterar status da sincronização.');
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!user || !confirm('Tem certeza que deseja remover a integração com Google Calendar?')) return;
    try {
      const token = await user.getIdToken();
      await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ professionalId: user.uid }),
      });
      setGoogleCalendarConnected(false);
      setGoogleCalendarEnabled(false);
      notify.success('Google Calendar desconectado.');
    } catch (err) {
      notify.error('Erro ao desconectar.');
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
      notify.error('Sessão encerrada. Por favor, faça login novamente.');
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
      notify.error('Por favor, preencha os campos destacados.');
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
        if (!auth.currentUser) {
          notify.error("Sua sessão expirou. Entre novamente para salvar.");
          setLoading(false);
          return;
        }
        const token = await auth.currentUser.getIdToken(true);
        const response = await fetch('/api/profile/save', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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
        notify.success('Seu perfil foi atualizado com sucesso.');
      } catch (err: any) {
        console.error('[ProfileSave] Failed:', err);
        notify.error(err, 'Não foi possível salvar seu perfil agora.');
      }
    } catch (error: any) {
      console.error('[ProfileSave] CRITICAL ERROR:', error);
      notify.error('Não foi possível concluir agora. Tente novamente.');
    } finally {
      setLoading(false);
      console.log('[ProfileSave] Done');
    }
  };

  const addArea = () => {
    if (!newAreaName) return;
    if (pricingStrategy === 'extra' && !newAreaFee) {
      notify.error('Por favor, informe o valor adicional.');
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
        
        notify.success('Foto atualizada com sucesso.');
      } catch (err: any) {
        console.error('[Avatar] upload flow failed:', err);
        notify.error('Não foi possível salvar a imagem agora.');
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

        notify.success(`Foto adicionada${autoCategory ? ` · ${autoCategory}` : ''}`);
      } catch (err: any) {
        console.error('[Portfolio] upload failed:', err);
        notify.error('Não foi possível carregar a imagem.');
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
      await deletePortfolioItem(user.uid, itemToRemove as any);
      console.log('[Portfolio] removed successfully');
      
      setPortfolio(prev => prev.filter(item => item.id !== id));
      notify.success('Galeria atualizada.');
    } catch (err) {
      console.error('[Portfolio] Error removing:', err);
      notify.error('Não foi possível remover a imagem.');
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
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-stone">Página Pública Ativa</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-serif font-normal text-brand-ink">Meu Perfil Profissional</h1>
            <p className="text-sm text-brand-stone font-light">Configure as informações que aparecem na sua vitrine.</p>
          </div>
          <Link to={`/p/${profile?.slug}`} target="_blank" className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-white border border-brand-mist rounded-xl text-brand-ink text-[11px] font-bold uppercase tracking-widest hover:border-brand-ink transition-colors">
            Ver página <ExternalLink size={14} />
          </Link>
        </header>

        {profileCompleteness < 100 ? (
          <div className="mb-10 px-5 py-4 bg-brand-parchment/30 rounded-2xl border border-brand-mist/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">
                  Perfil {profileCompleteness}% completo
                </span>
                <span className="text-[9px] text-brand-stone font-medium uppercase tracking-wider md:hidden">Falta pouco</span>
              </div>
              <div className="w-full h-1 bg-brand-mist/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-terracotta rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${profileCompleteness}%` }}
                />
              </div>
            </div>
            <p className="text-[10px] text-brand-stone font-light hidden md:block max-w-[200px] text-right leading-relaxed">
              Complete as informações para atrair clientes
            </p>
          </div>
        ) : (
          <div className="mb-10 flex items-center gap-2 px-3 py-1.5 bg-brand-linen/50 text-brand-ink rounded-lg w-fit border border-brand-mist/50">
            <CheckCircle2 size={14} className="text-brand-terracotta" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Perfil completo</span>
          </div>
        )}

        <form 
          onSubmit={handleSave} 
          className="max-w-4xl mx-auto space-y-8"
        >
          
          {/* 1. IDENTIDADE */}
          <section className="space-y-6 pt-2">
            <div className="flex items-center gap-3 pb-2 px-2">
              <User size={20} className="text-brand-terracotta" />
              <h2 className="text-xl font-serif text-brand-ink">1. Identidade</h2>
            </div>
            
            <div className="flex flex-col gap-8">
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
                showLabels={true}
                errors={formErrors}
              />
            </div>
          </section>

          {/* 2. VITRINE */}
          <section className="space-y-6 pt-10 border-t border-brand-mist/50">
            <div className="flex items-center gap-3 pb-2 px-2">
              <Sparkles size={20} className="text-brand-terracotta" />
              <h2 className="text-xl font-serif text-brand-ink">2. Vitrine</h2>
            </div>

            {/* Portfolio Section */}
            <div className="space-y-4 px-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                <div className="flex items-center gap-3 mb-2 sm:mb-0">
                  <Camera size={18} className="text-brand-terracotta/70" />
                  <h3 className="font-serif italic text-lg text-brand-ink">Meu Portfólio</h3>
                </div>
                <p className="text-[10px] text-brand-stone font-medium uppercase tracking-widest">Exiba fotos do seu trabalho</p>
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

            {/* Diferenciais, Instagram, Slug */}
            <div className="space-y-6 px-2">
              
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Seus Diferenciais</label>
                  <p className="text-[10px] text-brand-stone/60 font-light ml-1 mb-2">
                    Selecione os pontos que tornam seu atendimento único.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {IDENTITY_DIFFERENTIALS.map(diff => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => {
                        if (differentials.includes(diff)) {
                          setDifferentials(differentials.filter(d => d !== diff));
                        } else {
                          setDifferentials([...differentials, diff]);
                        }
                      }}
                      className={cn(
                        "px-4 py-2 rounded-full text-[10px] font-medium transition-all border",
                        differentials.includes(diff)
                          ? "bg-brand-terracotta text-brand-white border-brand-terracotta shadow-sm"
                          : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone"
                      )}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
                {differentials.filter(d => !IDENTITY_DIFFERENTIALS.includes(d)).length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Personalizados</p>
                    <div className="flex flex-wrap gap-2">
                      {differentials.filter(d => !IDENTITY_DIFFERENTIALS.includes(d)).map(diff => (
                        <div key={diff} className="flex items-center gap-2 px-4 py-2 bg-brand-terracotta/10 border border-brand-terracotta/20 rounded-full text-[10px] font-medium text-brand-terracotta">
                          {diff}
                          <button 
                            type="button" 
                            onClick={() => setDifferentials(differentials.filter(d => d !== diff))}
                            className="hover:text-brand-ink"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Ex: Estacionamento gratuito"
                    className="flex-1 px-5 py-3 bg-brand-parchment border border-brand-mist rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-[11px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && !differentials.includes(val)) {
                          setDifferentials([...differentials, val]);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                  <button 
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      const val = input.value.trim();
                      if (val && !differentials.includes(val)) {
                        setDifferentials([...differentials, val]);
                        input.value = '';
                      }
                    }}
                    className="px-5 py-3 bg-brand-linen text-brand-ink border border-brand-mist rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-white transition-all shadow-sm"
                  >
                    Ok
                  </button>
                </div>
              </div>

              <hr className="border-brand-mist" />

              <div className="space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Instagram (@usuario)</label>
                <div className="flex items-center gap-2 bg-brand-parchment p-3.5 rounded-[18px] border border-brand-mist shadow-sm transition-all">
                  <span className="text-brand-stone text-xs ml-1">@</span>
                  <input 
                    type="text" 
                    value={instagram} 
                    onChange={(e) => setInstagram(e.target.value.replace(/@/g, '').trim())} 
                    placeholder="seu.usuario" 
                    className="flex-1 bg-transparent outline-none text-brand-ink font-medium text-xs placeholder:font-light" 
                  />
                </div>
              </div>

              <hr className="border-brand-mist/50 my-6" />

              <div className="space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                  Link Personalizado <span className="text-brand-terracotta">*</span>
                </label>
                <p className="text-[10px] text-brand-stone/60 font-light mt-0.5 mb-2 ml-1">Compartilhe este link com as clientes para que elas possam agendar.</p>
                <div className={cn(
                  "flex items-center gap-2 p-3.5 rounded-[18px] border transition-all",
                  formErrors.slug ? "border-brand-terracotta ring-1 ring-brand-terracotta/20 bg-white" : "bg-brand-parchment border-brand-mist"
                )}>
                  <span className="text-brand-stone text-xs ml-1 hidden sm:inline">usenera.com/p/</span>
                  <span className="text-brand-stone text-xs ml-1 sm:hidden">.../p/</span>
                  <input 
                    type="text" 
                    value={slug} 
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} 
                    placeholder="seu-nome"
                    className="flex-1 min-w-0 bg-transparent outline-none text-brand-ink font-medium text-xs"
                  />
                </div>
                {formErrors.slug && <p className="text-[10px] text-brand-terracotta ml-1">{formErrors.slug}</p>}
              </div>
            </div>

            <hr className="border-brand-mist/50 my-6 mx-2" />

            {/* Estilo da vitrine */}
            <div className="space-y-4 px-2">
              <div className="pt-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-1.5 bg-brand-terracotta/5 rounded-lg border border-brand-terracotta/10">
                    <Sparkles size={16} className="text-brand-terracotta" />
                  </div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink">
                    Estilo da sua vitrine
                  </h3>
                </div>

                <p className="text-[11px] text-brand-stone font-light mb-5">Escolha o tema visual que melhor representa sua marca.</p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
          </section>

          {/* 3. ATENDIMENTO */}
          <section className="space-y-6 pt-10 border-t border-brand-mist/50">
            <div className="flex items-center gap-3 pb-2 px-2">
              <Briefcase size={20} className="text-brand-terracotta" />
              <h2 className="text-xl font-serif text-brand-ink">3. Atendimento</h2>
            </div>
            
            <div className="space-y-8 px-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                  WhatsApp da Profissional <span className="text-brand-terracotta">*</span>
                </label>
                <p className="text-[10px] text-brand-stone font-light mt-1 mb-2 ml-1">
                  Você receberá novos agendamentos por aqui.
                </p>
                <input 
                  type="tel" 
                  value={whatsapp ? formatWhatsappDisplay(whatsapp) : ''} 
                  onChange={(e) => {
                    const cleaned = cleanWhatsapp(e.target.value);
                    if (cleaned.length <= 11) {
                      setWhatsapp(cleaned);
                    }
                  }} 
                  placeholder="(00) 00000-0000" 
                  className={cn(
                    "w-full px-6 py-3.5 bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm",
                    formErrors.whatsapp ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                  )}
                />
                {formErrors.whatsapp && <p className="text-[10px] text-brand-terracotta ml-1 mt-1">{formErrors.whatsapp}</p>}
              </div>

              <hr className="border-brand-mist/50 my-6" />

              {/* Working Hours Section */}
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-brand-terracotta/70" />
                  <h3 className="font-serif italic text-lg text-brand-ink">Horários de Atendimento</h3>
                </div>

              <div className="space-y-3">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Dias de Trabalho</label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day, idx) => (
                    <button 
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`min-w-[36px] h-[36px] px-3 flex-1 sm:flex-none rounded-full font-medium text-[10px] transition-all ${workingDays.includes(idx) ? 'bg-brand-ink text-brand-white shadow-lg' : 'bg-brand-parchment text-brand-stone border border-brand-mist hover:border-brand-stone'}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 py-1">
                <div className="space-y-1 min-w-0">
                  <label className="text-[9px] font-bold text-brand-stone uppercase tracking-[0.15em] ml-1">Início</label>
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)} 
                    className="w-full px-4 py-2.5 bg-brand-parchment border border-brand-mist rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-sm text-brand-ink min-w-0"
                  />
                </div>
                <div className="space-y-1 min-w-0">
                  <label className="text-[9px] font-bold text-brand-stone uppercase tracking-[0.15em] ml-1">Fim</label>
                  <input 
                    type="time" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)} 
                    className="w-full px-4 py-2.5 bg-brand-parchment border border-brand-mist rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-sm text-brand-ink min-w-0"
                  />
                </div>
              </div>
            </div>

            <hr className="border-brand-mist/50 my-6" />

            {/* Location Section */}
            <div className="mb-2">
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
                serviceAreaType={serviceAreaType as any}
                setServiceAreaType={setServiceAreaType as any}
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

            <hr className="border-brand-mist/50 my-6" />

            {/* Payment Methods Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink">
                    Formas de Pagamento Aceitas
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
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
                        "px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all",
                        paymentMethods.includes(m.id)
                          ? "bg-brand-ink text-brand-white border-brand-ink shadow-sm"
                          : "bg-transparent text-brand-stone border-brand-mist hover:border-brand-stone"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 4. PROTEÇÃO */}
          <section className="space-y-6 pt-10 border-t border-brand-mist/50">
            <div className="flex items-center gap-3 pb-2 px-2">
              <ShieldCheck size={20} className="text-brand-terracotta" />
              <h2 className="text-xl font-serif text-brand-ink">4. Proteção</h2>
            </div>
            
            {/* Anti No-Show Section */}
            <div className="space-y-4 px-2">
              <div className="pt-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-1.5 bg-brand-terracotta/5 rounded-lg border border-brand-terracotta/10">
                    <ShieldCheck size={16} className="text-brand-terracotta" />
                  </div>
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink">
                    Proteção Anti No-Show
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-3 border-b border-brand-mist/50">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-brand-ink mb-0.5">Confirmação 24h</p>
                      <p className="text-[10px] text-brand-stone font-light italic">Enviar lembrete 24h antes sugerindo confirmação.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAntiNoShowEnabled(!antiNoShowEnabled)}
                      className={cn(
                        "w-10 h-5 rounded-full transition-all relative",
                        antiNoShowEnabled ? "bg-brand-ink" : "bg-brand-mist/60"
                      )}
                    >
                      <div className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-brand-white transition-all shadow-sm",
                        antiNoShowEnabled ? "left-[22px]" : "left-0.5"
                      )} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-brand-mist/50">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-brand-ink mb-0.5">Sinal Antecipado</p>
                      <p className="text-[10px] text-brand-stone font-light italic">Solicitar sinal via Pix para garantir reserva.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAdvancePaymentRequired(!advancePaymentRequired)}
                      className={cn(
                        "w-10 h-5 rounded-full transition-all relative",
                        advancePaymentRequired ? "bg-brand-ink" : "bg-brand-mist/60"
                      )}
                    >
                      <div className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-brand-white transition-all shadow-sm",
                        advancePaymentRequired ? "left-[22px]" : "left-0.5"
                      )} />
                    </button>
                  </div>

                  <div className="pt-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-stone mb-3 ml-1">Tolerância de Atraso</p>
                    <div className="flex gap-2">
                      {[10, 15, 20].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setDelayTolerance(val as 10 | 15 | 20)}
                          className={cn(
                            "px-5 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest border transition-all",
                            delayTolerance === val
                              ? "bg-brand-ink text-brand-white border-brand-ink shadow-sm"
                              : "bg-transparent text-brand-stone border-brand-mist hover:border-brand-stone"
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
          </section>

          {/* 5. INTEGRAÇÕES */}
          <section className="space-y-6 pt-10 border-t border-brand-mist/50">
            <div className="flex items-center gap-3 pb-2 px-2">
              <LinkIcon size={20} className="text-brand-terracotta" />
              <h2 className="text-xl font-serif text-brand-ink">5. Integrações</h2>
            </div>
            
            {/* Google Calendar Section */}
            <div className="space-y-4 px-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 mb-2 sm:mb-0">
                  <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                    <Calendar size={16} />
                  </div>
                  <h3 className="font-serif italic text-lg text-brand-ink">Google Calendar</h3>
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

              <div className="p-4 bg-brand-white/80 rounded-2xl border border-brand-mist/50 shadow-sm">
                {!googleCalendarConnected ? (
                  <div className="space-y-3">
                    <p className="text-[11px] text-brand-stone font-light leading-relaxed">
                      Sincronize sua agenda do Nera com seu Google Calendar pessoal. Novos agendamentos confirmados serão adicionados automaticamente.
                    </p>
                    <button
                      type="button"
                      onClick={handleConnectCalendar}
                      disabled={calendarLoading}
                      className="w-full sm:w-auto px-6 py-2.5 bg-brand-ink/5 border-none rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-ink hover:bg-brand-ink/10 transition-all disabled:opacity-50 mx-auto"
                    >
                      {calendarLoading ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <>
                          <Calendar size={14} /> Conectar Conta
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-ink mb-0.5">Sincronização Ativa</p>
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
                          "w-12 h-6 rounded-full transition-all relative shrink-0",
                          googleCalendarEnabled ? "bg-brand-ink" : "bg-brand-mist/50 border border-brand-mist"
                        )}
                      >
                        <div className={cn(
                          "absolute top-[2px] w-[20px] h-[20px] rounded-full bg-brand-white transition-all shadow-sm",
                          googleCalendarEnabled ? "left-[26px]" : "left-[2px]"
                        )} />
                      </button>
                    </div>

                    <div className="pt-3 border-t border-brand-mist/50 flex items-center justify-between">
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

          </section>

          <div className="pt-8 pb-20 md:pb-8 flex flex-col items-center border-t border-brand-mist/30 mt-8">
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full max-w-[240px] bg-brand-white text-brand-ink border border-brand-mist py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-brand-parchment transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>

            <div className="pt-4 mt-2">
              <button 
                type="button"
                onClick={async () => {
                   if (confirm('Tem certeza que deseja sair da sua conta?')) {
                     await auth.signOut();
                     window.location.href = '/login';
                   }
                }}
                className="w-auto bg-transparent text-brand-stone/60 py-2 px-4 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:text-red-500 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut size={14} /> Sair da conta
              </button>
            </div>
          </div>
        </form>

        <UpgradeModal 
          open={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          feature={upgradeFeature}
        />
      </div>
    </AppLayout>
  );
}
