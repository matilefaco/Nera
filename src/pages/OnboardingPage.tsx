import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, auth, storage, app, handleFirestoreError, OperationType, uploadImageToStorage, saveProfilePartial, savePortfolioItem } from '../firebase';
import { doc, updateDoc, collection, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from 'firebase/storage';
import { 
  User, MapPin, Home, Building2, Briefcase, 
  Clock, DollarSign, Instagram, MessageCircle, 
  CheckCircle2, ArrowRight, ArrowLeft, Sparkles,
  Camera, Plus, X, Globe, Copy, Share2
} from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { generateSlug, formatCurrency, cn } from '../lib/utils';
import Logo from '../components/Logo';
import { ProfessionalIdentity } from '../types';

type ServiceMode = 'home' | 'studio' | 'hybrid';

const IDENTITY_STYLES = [
  'Delicada e detalhista',
  'Rápida e eficiente',
  'Técnica e precisa',
  'Premium e sofisticada',
  'Natural e leve'
];

const IDENTITY_DIFFERENTIALS = [
  'Pontualidade',
  'Biossegurança',
  'Produtos premium',
  'Atendimento exclusivo',
  'Técnica avançada'
];

const EXPERIENCE_OPTIONS = [
  { label: '1-2 anos', value: '1-2' },
  { label: '3-5 anos', value: '3-5' },
  { label: '5+ anos', value: '5+' }
];

export default function OnboardingPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  // Step 1: Identity
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [avatar, setAvatar] = useState('');
  const [serviceMode, setServiceMode] = useState<ServiceMode>('studio');

  // Step 2: Service Mode Details
  const [studioAddress, setStudioAddress] = useState({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    reference: ''
  });
  const [serviceAreas, setServiceAreas] = useState<{name: string, fee: number}[]>([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaFee, setNewAreaFee] = useState('');
  const [pricingStrategy, setPricingStrategy] = useState<'extra' | 'none'>('none');
  const [portfolio, setPortfolio] = useState<{id?: string, url: string, category: string, isUploading?: boolean}[]>([]);
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
  const [headline, setHeadline] = useState('');

  // New Identity State
  const [yearsExperience, setYearsExperience] = useState('3-5');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedDifferentials, setSelectedDifferentials] = useState<string[]>([]);

  useEffect(() => {
    if (profile) {
      const locallyCompletedKey = `onboarding_completed_${user?.uid}`;
      const locallyCompleted = sessionStorage.getItem(locallyCompletedKey) === 'true';
      
      console.log('[Onboarding] Profile snapshot received:', {
        step: profile.onboardingStep,
        completed: profile.onboardingCompleted,
        locallyCompleted,
        isFinalizing,
        currentStep: step
      });

      // 1. If onboarding is already completed (server or local), and we are not on the success step,
      // let the App.tsx guard handle the redirect to dashboard.
      if ((profile.onboardingCompleted || locallyCompleted) && !isFinalizing && step !== 7) {
        console.log('[Onboarding] Onboarding completed (server or local), allowing App.tsx guard to redirect...');
        return;
      }

      // 2. Sync local state with profile, but ONLY if we are not in the middle of a process
      // AND not already completed locally
      if (!loading && !isFinalizing && !locallyCompleted) {
        if (profile.name) setName(profile.name);
        if (profile.specialty) setSpecialty(profile.specialty);
        if (profile.city) setCity(profile.city);
        if (profile.neighborhood) setNeighborhood(profile.neighborhood);
        if (profile.avatar) {
          setAvatar(profile.avatar);
          setAvatarPreview(profile.avatar);
        }
        if (profile.studioAddress) {
          setStudioAddress(profile.studioAddress);
        } else if (profile.address) {
          // Migration: if old address exists, put it in street for now
          setStudioAddress(prev => ({ ...prev, street: profile.address }));
        }
        if (profile.avatar) setAvatar(profile.avatar);
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
        if (profile.headline) setHeadline(profile.headline);
        if (profile.servicesDraft) setServices(profile.servicesDraft);

        if (profile.professionalIdentity) {
          if (profile.professionalIdentity.yearsExperience) setYearsExperience(profile.professionalIdentity.yearsExperience);
          if (profile.professionalIdentity.serviceStyle) setSelectedStyles(profile.professionalIdentity.serviceStyle);
          if (profile.professionalIdentity.differentials) setSelectedDifferentials(profile.professionalIdentity.differentials);
          if (profile.professionalIdentity.headline) setHeadline(profile.professionalIdentity.headline);
        }
        
        if (profile.onboardingStep !== undefined) {
          console.log('[Onboarding] Syncing step from profile:', profile.onboardingStep);
          setStep(profile.onboardingStep);
        }
      }
    }
  }, [profile, isFinalizing, loading, user?.uid, step]);

  const generateIdentityContent = () => {
    if (!name || !specialty) return;

    const stylesStr = selectedStyles.length > 0 
      ? selectedStyles.join(' e ') 
      : 'excelência';
    
    const diffsStr = selectedDifferentials.length > 0
      ? selectedDifferentials.join(', ')
      : 'qualidade';

    const expText = yearsExperience === '5+' ? 'mais de 5' : yearsExperience;
    
    const newHeadline = `${specialty} com foco em ${selectedStyles[0] || 'naturalidade'}`;
    const newBio = `Especialista em ${specialty}, ${name} trabalha com uma abordagem ${stylesStr.toLowerCase()}. Com ${expText} anos de experiência, oferece um atendimento exclusivo pautado em ${diffsStr.toLowerCase()}.`;
    
    setHeadline(newHeadline);
    setBio(newBio);
  };

  const saveProgress = async (nextStepNum: number) => {
    const locallyCompletedKey = `onboarding_completed_${user?.uid}`;
    const locallyCompleted = sessionStorage.getItem(locallyCompletedKey) === 'true';

    if (!user || isFinalizing || profile?.onboardingCompleted || locallyCompleted) {
      console.log('[Onboarding] Skipping saveProgress: already completed or finalizing');
      return;
    }
    console.log(`[Onboarding] Saving progress to step ${nextStepNum}...`);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        name,
        specialty,
        city,
        neighborhood,
        studioAddress,
        avatar,
        serviceMode,
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
        headline,
        professionalIdentity: {
          mainSpecialty: specialty,
          yearsExperience,
          serviceStyle: selectedStyles,
          differentials: selectedDifferentials,
          bio,
          headline
        },
        servicesDraft: services,
        onboardingStep: nextStepNum,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log(`[Onboarding] Progress saved successfully.`);
    } catch (error) {
      console.error('[Onboarding] Error saving progress:', error);
    }
  };

  const uploadImage = async (file: File, path: string): Promise<string> => {
    console.log(`[OnboardingSave] Uploading image to ${path}...`);
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    console.log(`[OnboardingSave] Upload successful: ${url}`);
    return url;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const downloadUrl = await uploadImageToStorage(compressedFile, `avatars/${user.uid}`);
        
        // Update local state
        setAvatar(downloadUrl);
        
        // PERSISTENCE: Save immediately to Firestore if profile exists
        if (profile) {
          await saveProfilePartial(user.uid, { avatar: downloadUrl });
        }
        
        toast.success('Foto de perfil salva com sucesso!');
      } catch (error: any) {
        console.error('[Avatar] upload flow failed:', error);
        toast.error('Erro ao salvar foto de perfil');
        // Revert preview on error
        setAvatarPreview(avatar);
      } finally {
        setUploadingImage(false);
        // Reset input
        if (avatarInputRef.current) avatarInputRef.current.value = '';
      }
    }
  };

  const nextStep = async () => {
    if (step === 2) {
      generateIdentityContent();
    }
    const nextStepNum = step + 1;
    await saveProgress(nextStepNum);
    setStep(nextStepNum);
  };

  const prevStep = () => setStep(s => s - 1);

  const handleFinish = async () => {
    const locallyCompletedKey = `onboarding_completed_${user?.uid}`;
    const locallyCompleted = sessionStorage.getItem(locallyCompletedKey) === 'true';

    if (!user || isFinalizing || profile?.onboardingCompleted || locallyCompleted) {
      console.log('[Onboarding] handleFinish blocked:', { 
        isFinalizing, 
        profileCompleted: profile?.onboardingCompleted,
        locallyCompleted 
      });
      if (profile?.onboardingCompleted || locallyCompleted) navigate('/dashboard');
      return;
    }
    
    setLoading(true);
    setIsFinalizing(true);
    console.log('[Onboarding] >>> STARTING FINALIZATION <<<');
    
    // Fail-safe: Mark as locally completed IMMEDIATELY to prevent any bounce during the process
    sessionStorage.setItem(locallyCompletedKey, 'true');

    try {
      // 1. Sanitize Data
      console.log('[Onboarding] Validating and sanitizing payload');
      const sanitizedName = name.trim();
      const sanitizedSpecialty = specialty.trim();
      const sanitizedBio = bio.trim();
      const sanitizedHeadline = headline.trim();
      const sanitizedCity = city.trim();
      const sanitizedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      
      const sanitizedAreas = serviceAreas
        .filter(area => area.name && area.name.trim())
        .map(area => ({
          name: area.name.trim(),
          fee: Number(area.fee) || 0
        }));

      // 2. Add Services
      const activeServices = services.filter(s => s.name && s.price);
      console.log(`[Onboarding] Step 1: Saving ${activeServices.length} services...`);
      
      try {
        const servicePromises = activeServices.map(service => {
          return addDoc(collection(db, 'services'), {
            professionalId: user.uid,
            name: service.name.trim(),
            duration: Number(service.duration) || 60,
            price: Number(service.price) || 0,
            description: (service.description || '').trim(),
            active: true,
            createdAt: new Date().toISOString()
          });
        });
        await Promise.all(servicePromises);
        console.log('[Onboarding] Step 1: Services saved OK');
      } catch (svcErr) {
        console.warn('[Onboarding] Step 1 Warning: Error saving services, but continuing...', svcErr);
      }

      // 3. Prepare Final Data (WITHOUT PORTFOLIO FIRST to ensure it fits)
      const finalData = {
        name: sanitizedName,
        specialty: sanitizedSpecialty,
        city: sanitizedCity,
        neighborhood: neighborhood.trim(),
        avatar,
        serviceMode,
        studioAddress: {
          street: (studioAddress.street || '').trim(),
          number: (studioAddress.number || '').trim(),
          complement: (studioAddress.complement || '').trim(),
          neighborhood: (studioAddress.neighborhood || '').trim(),
          city: (studioAddress.city || sanitizedCity).trim(),
          reference: (studioAddress.reference || '').trim()
        },
        serviceAreas: sanitizedAreas,
        pricingStrategy: serviceMode !== 'studio' ? pricingStrategy : 'none',
        workingDays,
        startTime,
        endTime,
        slug: sanitizedSlug,
        whatsapp: whatsapp.trim().replace(/\D/g, ''),
        instagram: instagram.trim(),
        bio: sanitizedBio,
        headline: sanitizedHeadline,
        professionalIdentity: {
          mainSpecialty: sanitizedSpecialty,
          yearsExperience,
          serviceStyle: selectedStyles,
          differentials: selectedDifferentials,
          bio: sanitizedBio,
          headline: sanitizedHeadline
        },
        onboardingCompleted: true,
        onboardingStep: 8,
        updatedAt: new Date().toISOString()
      };

      console.log('[Onboarding] Step 2: Saving final profile data (base)...');
      try {
        await setDoc(doc(db, 'users', user.uid), finalData, { merge: true });
        console.log('[Onboarding] Step 2: Base profile saved OK');
      } catch (err) {
        console.error('[Onboarding] Step 2 Failed:', err);
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }

      toast.success('Onboarding concluído!');
      setStep(8);
      console.log('[Onboarding] >>> FINALIZATION SUCCESSFUL <<<');
    } catch (error: any) {
      console.error('[Onboarding] !!! FINALIZATION CRITICAL ERROR !!!', error);
      
      const errorMsg = error?.message || String(error);
      const errorCode = error?.code || 'unknown';
      console.log('[Onboarding] Technical error details:', { errorCode, errorMsg });
      
      if (errorMsg.includes('too large') || errorCode === 'resource-exhausted') {
        toast.error('Erro: Dados muito grandes. Tente remover algumas fotos ou serviços.');
      } else {
        toast.error(`Erro ao finalizar: ${errorCode} - ${errorMsg.substring(0, 100)}`);
      }
      
      setIsFinalizing(false);
      sessionStorage.removeItem(locallyCompletedKey); // Allow retry if it failed
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
        const options = {
          maxSizeMB: 0.2, 
          maxWidthOrHeight: 1200,
          useWebWorker: false
        };
        const compressedFile = await imageCompression(file, options);
        
        // 3. Upload
        const downloadUrl = await uploadImageToStorage(compressedFile, `portfolio/${user.uid}`);
        console.log('[Portfolio] upload finished:', downloadUrl);
        
        // 4. Persistence
        console.log('[Portfolio] saving to Firestore');
        const docId = await savePortfolioItem(user.uid, downloadUrl, specialty || 'Geral');
        console.log('[Portfolio] saved successfully');
        
        // Update local state with real ID
        setPortfolio(prev => prev.map(item => 
          item.id === tempId ? { id: docId, url: downloadUrl, category: specialty || 'Geral' } : item
        ));

        toast.success('Imagem adicionada ao seu portfólio!');
      } catch (error: any) {
        console.error('[Portfolio] upload failed:', error);
        toast.error('Erro ao carregar imagem');
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

    try {
      console.log('[Portfolio] Removing item:', id);
      await deleteDoc(doc(db, 'users', user.uid, 'portfolio', id));
      setPortfolio(prev => prev.filter(item => item.id !== id));
      toast.success('Imagem removida');
    } catch (err) {
      console.error('[Portfolio] Error removing:', err);
      toast.error('Erro ao remover imagem');
    }
  };

  const removeArea = (index: number) => {
    setServiceAreas(serviceAreas.filter((_, i) => i !== index));
  };

  if (authLoading) return null;

  const progress = (step / 8) * 100;

  return (
    <div className="min-h-screen bg-brand-parchment flex flex-col">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-brand-mist z-50">
        <motion.div 
          className="h-full bg-brand-ink"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full py-20">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-10"
            >
              <div className="text-center space-y-4">
                <Logo className="mx-auto mb-8 scale-110" />
                <h1 className="text-4xl font-serif font-normal text-brand-ink">Como as clientes devem te conhecer?</h1>
                <p className="text-brand-stone font-light">Sua identidade é o primeiro passo para criar confiança.</p>
              </div>

              <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-8">
                <div className="flex flex-col items-center">
                  <div className="relative group">
                    <div 
                      onClick={() => {
                        console.log('[Upload] Avatar click triggered');
                        avatarInputRef.current?.click();
                      }}
                      className="w-32 h-32 bg-brand-linen rounded-full flex items-center justify-center text-brand-terracotta border-4 border-brand-white shadow-sm overflow-hidden relative cursor-pointer"
                    >
                      {avatarPreview || avatar ? (
                        <img src={avatarPreview || avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <User size={48} className="opacity-20" />
                      )}
                      {uploadingImage && (
                        <div className="absolute inset-0 bg-brand-ink/40 flex items-center justify-center">
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                            <Sparkles size={24} className="text-brand-white" />
                          </motion.div>
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-0 right-0 w-10 h-10 bg-brand-ink text-brand-white rounded-full flex items-center justify-center border-4 border-brand-white shadow-lg pointer-events-none">
                      <Camera size={18} />
                    </div>
                    <input 
                      ref={avatarInputRef}
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileUpload} 
                      disabled={uploadingImage}
                    />
                  </div>
                  <p className="mt-4 text-[10px] font-medium text-brand-stone uppercase tracking-widest">Sua melhor foto profissional</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Nome que aparece na agenda</label>
                    <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="Ex: Bruna Designer" 
                      className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Sua Especialidade Principal</label>
                    <input 
                      type="text" 
                      value={specialty} 
                      onChange={(e) => setSpecialty(e.target.value)} 
                      placeholder="Ex: Nail Designer" 
                      className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Cidade Base</label>
                    <div className="relative">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={20} />
                      <input 
                        type="text" 
                        value={city} 
                        onChange={(e) => setCity(e.target.value)} 
                        placeholder="Ex: Fortaleza, CE" 
                        className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Bairro Base</label>
                  <input 
                    type="text" 
                    value={neighborhood} 
                    onChange={(e) => setNeighborhood(e.target.value)} 
                    placeholder="Ex: Aldeota" 
                    className="w-full px-6 py-5 bg-brand-parchment border border-brand-mist rounded-[24px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Onde você atende?</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      onClick={() => setServiceMode('studio')}
                      className={`p-5 rounded-[24px] border transition-all flex flex-col items-center gap-2 ${serviceMode === 'studio' ? 'border-brand-ink bg-brand-linen text-brand-ink' : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'}`}
                    >
                      <Building2 size={24} />
                      <span className="text-[10px] font-medium uppercase">Estúdio</span>
                    </button>
                    <button 
                      onClick={() => setServiceMode('home')}
                      className={`p-5 rounded-[24px] border transition-all flex flex-col items-center gap-2 ${serviceMode === 'home' ? 'border-brand-ink bg-brand-linen text-brand-ink' : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'}`}
                    >
                      <Home size={24} />
                      <span className="text-[10px] font-medium uppercase">Domicílio</span>
                    </button>
                    <button 
                      onClick={() => setServiceMode('hybrid')}
                      className={`p-5 rounded-[24px] border transition-all flex flex-col items-center gap-2 ${serviceMode === 'hybrid' ? 'border-brand-ink bg-brand-linen text-brand-ink' : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'}`}
                    >
                      <Briefcase size={24} />
                      <span className="text-[10px] font-medium uppercase">Híbrido</span>
                    </button>
                  </div>
                </div>
              </div>

              <button 
                onClick={nextStep}
                disabled={!name || !specialty || !city || !neighborhood || uploadingImage}
                className="w-full bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
              >
                {uploadingImage ? 'Processando...' : 'Continuar'} <ArrowRight size={18} />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-10"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-mist">
                  <Sparkles size={32} />
                </div>
                <h1 className="text-4xl font-serif font-normal text-brand-ink">Sua Identidade</h1>
                <p className="text-brand-stone font-light">Como você quer ser percebida pelas clientes?</p>
              </div>

              <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-10">
                <div className="space-y-6">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Estilo de Atendimento (Escolha até 3)</label>
                  <div className="flex flex-wrap gap-2">
                    {IDENTITY_STYLES.map(style => (
                      <button
                        key={style}
                        onClick={() => {
                          if (selectedStyles.includes(style)) {
                            setSelectedStyles(selectedStyles.filter(s => s !== style));
                          } else if (selectedStyles.length < 3) {
                            setSelectedStyles([...selectedStyles, style]);
                          }
                        }}
                        className={cn(
                          "px-6 py-3 rounded-full text-xs font-medium transition-all border",
                          selectedStyles.includes(style)
                            ? "bg-brand-ink text-brand-white border-brand-ink shadow-md"
                            : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone"
                        )}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Seus Diferenciais</label>
                  <div className="flex flex-wrap gap-2">
                    {IDENTITY_DIFFERENTIALS.map(diff => (
                      <button
                        key={diff}
                        onClick={() => {
                          if (selectedDifferentials.includes(diff)) {
                            setSelectedDifferentials(selectedDifferentials.filter(d => d !== diff));
                          } else {
                            setSelectedDifferentials([...selectedDifferentials, diff]);
                          }
                        }}
                        className={cn(
                          "px-6 py-3 rounded-full text-xs font-medium transition-all border",
                          selectedDifferentials.includes(diff)
                            ? "bg-brand-terracotta text-brand-white border-brand-terracotta shadow-md"
                            : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone"
                        )}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Tempo de Experiência</label>
                  <div className="grid grid-cols-3 gap-3">
                    {EXPERIENCE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setYearsExperience(opt.value)}
                        className={cn(
                          "p-4 rounded-2xl text-xs font-medium transition-all border flex flex-col items-center gap-1",
                          yearsExperience === opt.value
                            ? "bg-brand-linen border-brand-ink text-brand-ink shadow-sm"
                            : "bg-brand-parchment border-brand-mist text-brand-stone hover:border-brand-stone"
                        )}
                      >
                        <span className="text-lg font-serif italic">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={selectedStyles.length === 0 || selectedDifferentials.length === 0}
                  className="flex-1 bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                >
                  Continuar <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-10"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-mist">
                  <Sparkles size={32} />
                </div>
                <h1 className="text-4xl font-serif font-normal text-brand-ink">Sua Identidade</h1>
                <p className="text-brand-stone font-light">Como você quer ser percebida pelas clientes?</p>
              </div>

              <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-10">
                <div className="space-y-6">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Estilo de Atendimento (Escolha até 3)</label>
                  <div className="flex flex-wrap gap-2">
                    {IDENTITY_STYLES.map(style => (
                      <button
                        key={style}
                        onClick={() => {
                          if (selectedStyles.includes(style)) {
                            setSelectedStyles(selectedStyles.filter(s => s !== style));
                          } else if (selectedStyles.length < 3) {
                            setSelectedStyles([...selectedStyles, style]);
                          }
                        }}
                        className={cn(
                          "px-6 py-3 rounded-full text-xs font-medium transition-all border",
                          selectedStyles.includes(style)
                            ? "bg-brand-ink text-brand-white border-brand-ink shadow-md"
                            : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone"
                        )}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Seus Diferenciais</label>
                  <div className="flex flex-wrap gap-2">
                    {IDENTITY_DIFFERENTIALS.map(diff => (
                      <button
                        key={diff}
                        onClick={() => {
                          if (selectedDifferentials.includes(diff)) {
                            setSelectedDifferentials(selectedDifferentials.filter(d => d !== diff));
                          } else {
                            setSelectedDifferentials([...selectedDifferentials, diff]);
                          }
                        }}
                        className={cn(
                          "px-6 py-3 rounded-full text-xs font-medium transition-all border",
                          selectedDifferentials.includes(diff)
                            ? "bg-brand-terracotta text-brand-white border-brand-terracotta shadow-md"
                            : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone"
                        )}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Tempo de Experiência</label>
                  <div className="grid grid-cols-3 gap-3">
                    {EXPERIENCE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setYearsExperience(opt.value)}
                        className={cn(
                          "p-4 rounded-2xl text-xs font-medium transition-all border flex flex-col items-center gap-1",
                          yearsExperience === opt.value
                            ? "bg-brand-linen border-brand-ink text-brand-ink shadow-sm"
                            : "bg-brand-parchment border-brand-mist text-brand-stone hover:border-brand-stone"
                        )}
                      >
                        <span className="text-lg font-serif italic">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={selectedStyles.length === 0 || selectedDifferentials.length === 0}
                  className="flex-1 bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                >
                  Continuar <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-10"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-mist">
                  {serviceMode === 'home' ? <Home size={32} /> : <Building2 size={32} />}
                </div>
                <h1 className="text-4xl font-serif font-normal text-brand-ink">Onde você atende?</h1>
                <p className="text-brand-stone font-light">Configure sua logística de atendimento.</p>
              </div>

              <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-10">
                {(serviceMode === 'studio' || serviceMode === 'hybrid') && (
                  <div className="space-y-8">
                    <div className="flex items-center gap-3 text-brand-ink">
                      <Building2 size={20} className="text-brand-terracotta" />
                      <h3 className="font-medium text-lg">Endereço do seu Estúdio</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Rua</label>
                        <input 
                          type="text"
                          value={studioAddress.street} 
                          onChange={(e) => setStudioAddress({...studioAddress, street: e.target.value})} 
                          placeholder="Ex: Rua Silva Jatahy" 
                          className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Número</label>
                        <input 
                          type="text"
                          value={studioAddress.number} 
                          onChange={(e) => setStudioAddress({...studioAddress, number: e.target.value})} 
                          placeholder="Ex: 123" 
                          className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Complemento</label>
                        <input 
                          type="text"
                          value={studioAddress.complement} 
                          onChange={(e) => setStudioAddress({...studioAddress, complement: e.target.value})} 
                          placeholder="Ex: Sala 402" 
                          className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Bairro</label>
                        <input 
                          type="text"
                          value={studioAddress.neighborhood} 
                          onChange={(e) => setStudioAddress({...studioAddress, neighborhood: e.target.value})} 
                          placeholder="Ex: Meireles" 
                          className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Cidade</label>
                        <input 
                          type="text"
                          value={studioAddress.city || city} 
                          onChange={(e) => setStudioAddress({...studioAddress, city: e.target.value})} 
                          placeholder="Ex: Fortaleza" 
                          className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Ponto de Referência</label>
                        <input 
                          type="text"
                          value={studioAddress.reference} 
                          onChange={(e) => setStudioAddress({...studioAddress, reference: e.target.value})} 
                          placeholder="Ex: Próximo ao Shopping Del Paseo" 
                          className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {(serviceMode === 'home' || serviceMode === 'hybrid') && (
                  <div className="space-y-8 pt-8 border-t border-brand-mist">
                    <div className="flex items-center gap-3 text-brand-ink">
                      <Home size={20} className="text-brand-terracotta" />
                      <h3 className="font-medium text-lg">Atendimento em Domicílio</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Você cobra o mesmo valor em todos os bairros?</p>
                      <div className="grid grid-cols-1 gap-3">
                        <button 
                          onClick={() => setPricingStrategy('none')}
                          className={`p-5 rounded-[24px] border text-left transition-all ${pricingStrategy === 'none' ? 'border-brand-ink bg-brand-linen' : 'border-brand-mist bg-brand-parchment hover:border-brand-stone'}`}
                        >
                          <p className="text-xs font-medium text-brand-ink mb-1">Sim, é o mesmo valor</p>
                          <p className="text-[10px] text-brand-stone font-light leading-tight">O valor do serviço será o mesmo em todas as regiões atendidas.</p>
                        </button>
                        <button 
                          onClick={() => setPricingStrategy('extra')}
                          className={`p-5 rounded-[24px] border text-left transition-all ${pricingStrategy === 'extra' ? 'border-brand-ink bg-brand-linen' : 'border-brand-mist bg-brand-parchment hover:border-brand-stone'}`}
                        >
                          <p className="text-xs font-medium text-brand-ink mb-1">Não, varia por região</p>
                          <p className="text-[10px] text-brand-stone font-light leading-tight">Você pode ajustar valores conforme a região para cobrir deslocamentos maiores.</p>
                        </button>
                      </div>
                    </div>

                    {pricingStrategy === 'extra' && (
                      <div className="space-y-6 pt-6 bg-brand-parchment p-8 rounded-[32px] border border-brand-mist">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={16} className="text-brand-terracotta" />
                          <h4 className="text-[10px] font-medium text-brand-ink uppercase tracking-widest">Ajuste de valores por região</h4>
                        </div>
                        
                        <div className="flex flex-col md:flex-row items-end gap-3">
                          <div className="flex-1 space-y-2 w-full">
                            <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Bairro / Região</label>
                            <input 
                              type="text" 
                              value={newAreaName} 
                              onChange={(e) => setNewAreaName(e.target.value)} 
                              onKeyDown={(e) => e.key === 'Enter' && addArea()}
                              placeholder="Ex: Aldeota" 
                              className="w-full px-5 py-3 bg-brand-white border border-brand-mist rounded-xl outline-none text-sm focus:ring-1 focus:ring-brand-ink transition-all font-light" 
                            />
                          </div>
                          <div className="w-full md:w-32 space-y-2">
                            <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Valor Adicional</label>
                            <input 
                              type="number" 
                              value={newAreaFee} 
                              onChange={(e) => setNewAreaFee(e.target.value)} 
                              onKeyDown={(e) => e.key === 'Enter' && addArea()}
                              placeholder="0,00" 
                              className="w-full px-5 py-3 bg-brand-white border border-brand-mist rounded-xl outline-none text-sm focus:ring-1 focus:ring-brand-ink transition-all font-light" 
                            />
                          </div>
                          <button 
                            onClick={addArea} 
                            className="bg-brand-ink text-brand-white px-8 h-[46px] rounded-xl text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-sm"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    )}

                    {pricingStrategy === 'none' && (
                      <div className="space-y-4 pt-4">
                        <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Quais bairros você atende?</p>
                        <div className="flex flex-col md:flex-row items-end gap-3">
                          <div className="flex-1 space-y-2 w-full">
                            <input 
                              type="text" 
                              value={newAreaName} 
                              onChange={(e) => setNewAreaName(e.target.value)} 
                              onKeyDown={(e) => e.key === 'Enter' && addArea()}
                              placeholder="Ex: Aldeota" 
                              className="w-full px-5 py-3 bg-brand-parchment border border-brand-mist rounded-xl outline-none text-sm focus:ring-1 focus:ring-brand-ink transition-all font-light" 
                            />
                          </div>
                          <button 
                            onClick={addArea} 
                            className="bg-brand-ink text-brand-white px-8 h-[46px] rounded-xl text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-sm"
                          >
                            Adicionar
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {serviceAreas.map((area, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-brand-parchment p-4 rounded-2xl border border-brand-mist">
                          <span className="text-sm font-medium text-brand-ink">{area.name}</span>
                          <div className="flex items-center gap-4">
                            {pricingStrategy === 'extra' && area.fee > 0 && (
                              <span className="text-xs font-medium text-brand-terracotta">
                                + {formatCurrency(area.fee)}
                              </span>
                            )}
                            <button onClick={() => removeArea(idx)} className="text-brand-stone hover:text-brand-terracotta transition-all">
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={
                    (serviceMode !== 'home' && (!studioAddress.street || !studioAddress.number || !studioAddress.neighborhood)) || 
                    (serviceMode !== 'studio' && serviceAreas.length === 0)
                  }
                  className="flex-1 bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                >
                  Continuar <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-10"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-mist">
                  <Sparkles size={32} />
                </div>
                <h1 className="text-4xl font-serif font-normal text-brand-ink">Seus Serviços</h1>
                <p className="text-brand-stone font-light">O que suas clientes vão agendar?</p>
              </div>

              <div className="space-y-6">
                {services.map((service, idx) => (
                  <div key={idx} className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl relative">
                    {services.length > 1 && (
                      <button onClick={() => removeService(idx)} className="absolute top-8 right-8 text-brand-stone hover:text-brand-terracotta transition-colors">
                        <X size={20} />
                      </button>
                    )}
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Nome do Serviço</label>
                        <input 
                          type="text" 
                          value={service.name} 
                          onChange={(e) => updateService(idx, 'name', e.target.value)} 
                          placeholder="Ex: Design de Sobrancelhas" 
                          className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Duração (min)</label>
                          <div className="relative">
                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
                            <input 
                              type="number" 
                              value={service.duration} 
                              onChange={(e) => updateService(idx, 'duration', e.target.value)} 
                              className="w-full pl-12 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Preço (R$)</label>
                          <div className="relative">
                            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
                            <input 
                              type="number" 
                              value={service.price} 
                              onChange={(e) => updateService(idx, 'price', e.target.value)} 
                              placeholder="0,00"
                              className="w-full pl-12 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Descrição Curta (Opcional)</label>
                        <input 
                          type="text" 
                          value={service.description} 
                          onChange={(e) => updateService(idx, 'description', e.target.value)} 
                          placeholder="Ex: Inclui mapeamento e finalização" 
                          className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button 
                  onClick={addService}
                  className="w-full py-6 border border-dashed border-brand-terracotta/30 rounded-[40px] text-brand-terracotta font-medium text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-brand-linen transition-all"
                >
                  <Plus size={18} /> Adicionar outro serviço
                </button>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={services.some(s => !s.name || !s.price)}
                  className="flex-1 bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                >
                  Continuar <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div 
              key="step5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-10"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-mist">
                  <Clock size={32} />
                </div>
                <h1 className="text-4xl font-serif font-normal text-brand-ink">Seus Horários</h1>
                <p className="text-brand-stone font-light">Não se preocupe: você poderá personalizar sua agenda com mais flexibilidade depois.</p>
              </div>

              <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Dias de Trabalho</label>
                  <div className="flex justify-between">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => (
                      <button 
                        key={idx}
                        onClick={() => toggleDay(idx)}
                        className={`w-10 h-10 rounded-full font-medium text-xs transition-all ${workingDays.includes(idx) ? 'bg-brand-ink text-brand-white shadow-lg' : 'bg-brand-parchment text-brand-stone'}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-8 border-t border-brand-mist">
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

                <div className="space-y-4">
                  <button 
                    onClick={() => {
                      setWorkingDays([1, 2, 3, 4, 5]);
                      setStartTime('09:00');
                      setEndTime('18:00');
                      toast.info('Horário padrão aplicado!');
                    }}
                    className="w-full py-5 bg-brand-linen text-brand-ink rounded-[20px] text-[10px] font-medium uppercase tracking-widest hover:bg-brand-mist transition-all border border-brand-mist"
                  >
                    Usar horário padrão (Seg a Sex, 9h às 18h)
                  </button>
                  <p className="text-[10px] text-brand-stone text-center italic font-light">Esse é só o seu horário inicial. Você poderá ajustar dias, pausas e exceções depois.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={workingDays.length === 0}
                  className="flex-1 bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                >
                  Continuar <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div 
              key="step6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-10"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-mist">
                  <Globe size={32} />
                </div>
                <h1 className="text-4xl font-serif font-normal text-brand-ink">Sua Vitrine</h1>
                <p className="text-brand-stone font-light">Personalize como o mundo verá seu trabalho.</p>
              </div>

              <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Seu Link Exclusivo</label>
                  <div className="flex items-center gap-2 bg-brand-parchment p-4 rounded-[20px] border border-brand-mist">
                    <span className="text-brand-stone text-sm">nera.app/p/</span>
                    <input 
                      type="text" 
                      value={slug} 
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} 
                      placeholder="seu-nome"
                      className="flex-1 bg-transparent outline-none text-brand-ink font-medium text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">WhatsApp (com DDD)</label>
                    <div className="relative">
                      <MessageCircle className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={20} />
                      <input 
                        type="tel" 
                        value={whatsapp} 
                        onChange={(e) => setWhatsapp(e.target.value)} 
                        placeholder="85 99999-9999"
                        className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Instagram (Opcional)</label>
                    <div className="relative">
                      <Instagram className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={20} />
                      <input 
                        type="text" 
                        value={instagram} 
                        onChange={(e) => setInstagram(e.target.value.replace('@', ''))} 
                        placeholder="seu.perfil"
                        className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Sua Headline (Frase de impacto)</label>
                  <input 
                    type="text" 
                    value={headline} 
                    onChange={(e) => setHeadline(e.target.value)} 
                    placeholder="Ex: Especialista em beleza natural"
                    className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Sua Bio (Gerada automaticamente)</label>
                  <textarea 
                    value={bio} 
                    onChange={(e) => setBio(e.target.value)} 
                    placeholder="Descreva seu trabalho..."
                    className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all h-32 resize-none font-light"
                  />
                  <p className="text-[9px] text-brand-stone italic">* Você pode ajustar os textos gerados acima.</p>
                </div>
              </div>

              {/* Mini Preview */}
              <div className="bg-brand-ink p-8 rounded-[40px] text-brand-white flex items-center gap-6 shadow-xl">
                <div className="w-16 h-16 bg-brand-linen rounded-full overflow-hidden shrink-0 border border-brand-mist/20">
                  {avatar && <img src={avatar} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-serif italic text-lg truncate">{name || 'Seu Nome'}</h4>
                  <p className="text-[10px] text-brand-mist uppercase tracking-widest truncate">{specialty || 'Sua Especialidade'}</p>
                  <div className="flex gap-2 mt-3">
                    <div className="w-7 h-7 rounded-full bg-brand-white/10 flex items-center justify-center"><Instagram size={14} /></div>
                    <div className="w-7 h-7 rounded-full bg-brand-white/10 flex items-center justify-center"><MessageCircle size={14} /></div>
                  </div>
                </div>
                <div className="bg-brand-terracotta px-4 py-2 rounded-full text-[8px] font-medium uppercase tracking-widest">Preview</div>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={loading || !slug || !whatsapp}
                  className="flex-1 bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                >
                  Continuar <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 7 && (
            <motion.div 
              key="step7"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-10"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-brand-linen text-brand-ink rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-mist">
                  <Camera size={32} />
                </div>
                <h1 className="text-4xl font-serif font-normal text-brand-ink">Seu Portfólio</h1>
                <p className="text-brand-stone font-light">Mostre o seu melhor trabalho para encantar as clientes.</p>
              </div>

              <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {portfolio.map((item, idx) => (
                    <div key={item.id || idx} className="aspect-square bg-brand-parchment rounded-2xl overflow-hidden relative group border border-brand-mist">
                      <img src={item.url} className={`w-full h-full object-cover ${item.isUploading ? 'opacity-50 blur-sm' : ''}`} referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => item.id && removePortfolioImage(item.id)}
                        className="absolute top-2 right-2 w-8 h-8 bg-brand-ink/80 text-brand-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={16} />
                      </button>
                      <div className="absolute bottom-0 left-0 w-full p-2 bg-brand-ink/40 backdrop-blur-sm">
                        <p className="text-[8px] text-brand-white font-medium uppercase truncate tracking-widest">{item.category}</p>
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
                    onClick={() => {
                      console.log('[Upload] Portfolio click triggered');
                      portfolioInputRef.current?.click();
                    }}
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
                
                <p className="text-[10px] text-brand-stone text-center italic font-light">Dica: Fotos bem iluminadas e de alta qualidade convertem até 3x mais!</p>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={handleFinish}
                  disabled={loading}
                  className="flex-1 bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                >
                  {loading ? 'Finalizando...' : 'Concluir Vitrine'} <CheckCircle2 size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 8 && (
            <motion.div 
              key="step8"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full space-y-12 text-center"
            >
              <div className="relative">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, delay: 0.2 }}
                  className="w-32 h-32 bg-brand-terracotta text-brand-white rounded-[40px] flex items-center justify-center mx-auto shadow-2xl shadow-brand-terracotta/20"
                >
                  <CheckCircle2 size={64} />
                </motion.div>
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-brand-ink text-brand-white rounded-2xl flex items-center justify-center shadow-lg rotate-12 animate-bounce">
                  <Sparkles size={24} />
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl font-serif font-normal text-brand-ink">Sua vitrine está pronta!</h1>
                <p className="text-brand-stone text-lg max-w-sm mx-auto font-light">
                  Agora você tem um sistema profissional para receber agendamentos e valorizar seu tempo.
                </p>
              </div>

              <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-8">
                <div className="p-8 bg-brand-parchment rounded-[32px] border border-brand-mist">
                  <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest mb-2">Seu link da bio</p>
                  <p className="text-2xl font-serif italic text-brand-terracotta break-all">nera.app/p/{slug}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`https://nera.app/p/${slug}`);
                      toast.success('Link copiado!');
                    }}
                    className="flex flex-col items-center gap-4 p-8 bg-brand-parchment rounded-[32px] border border-brand-mist hover:bg-brand-linen transition-all group"
                  >
                    <div className="w-12 h-12 bg-brand-white rounded-2xl flex items-center justify-center text-brand-ink border border-brand-mist group-hover:scale-110 transition-transform">
                      <Copy size={24} />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-widest">Copiar Link</span>
                  </button>
                  <button 
                    onClick={() => {
                      const text = `Olá! Agora você pode agendar seus horários comigo diretamente pelo meu link: https://nera.app/p/${slug} ✨`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    className="flex flex-col items-center gap-4 p-8 bg-brand-parchment rounded-[32px] border border-brand-mist hover:bg-brand-linen transition-all group"
                  >
                    <div className="w-12 h-12 bg-brand-white rounded-2xl flex items-center justify-center text-brand-ink border border-brand-mist group-hover:scale-110 transition-transform">
                      <Share2 size={24} />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-widest">Divulgar</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="w-full bg-brand-ink text-brand-white py-7 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 shadow-xl"
                >
                  Ir para meu Dashboard <ArrowRight size={20} />
                </button>
                <Link 
                  to={`/p/${slug}`} 
                  target="_blank"
                  className="text-[11px] font-medium text-brand-terracotta uppercase tracking-widest hover:text-brand-sienna transition-colors"
                >
                  Ver minha página pública
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Debug Overlay - Only visible during development/debugging if showDebugHUD is true */}
      {process.env.NODE_ENV === 'development' && (window as any).showDebugHUD && (
        <div className="fixed bottom-4 right-4 bg-brand-ink/90 text-brand-white p-4 rounded-2xl text-[8px] font-mono z-[100] border border-brand-mist/20 pointer-events-none opacity-50">
          <p>STEP: {step}</p>
          <p>FINALIZING: {isFinalizing ? 'YES' : 'NO'}</p>
          <p>LOADING: {loading ? 'YES' : 'NO'}</p>
          <p>PROFILE_COMPLETED: {profile?.onboardingCompleted ? 'YES' : 'NO'}</p>
          <p>LOCAL_COMPLETED: {sessionStorage.getItem(`onboarding_completed_${user?.uid}`) === 'true' ? 'YES' : 'NO'}</p>
        </div>
      )}
    </div>
  );
}
