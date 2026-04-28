import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { db, auth, storage, app, handleFirestoreError, OperationType, uploadImageToStorage, saveProfilePartial, savePortfolioItem, deletePortfolioItem } from '../firebase';
import { doc, updateDoc, collection, addDoc, setDoc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable, uploadString } from 'firebase/storage';
import { 
  User, MapPin, Home, Building2, Briefcase, 
  Clock, DollarSign, Instagram, MessageCircle, 
  CheckCircle2, ArrowRight, ArrowLeft, Sparkles,
  Camera, Plus, X, Globe, Copy, Share2, ExternalLink, AlertCircle, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { generateSlug, formatCurrency, cn, removeEmptyFields, getHumanError, cleanWhatsapp, buildWhatsappLink, formatWhatsappDisplay, isValidWhatsapp, normalizeInstagram, INSTAGRAM_REGEX } from '../lib/utils';
import Logo from '../components/Logo';
import AppLoadingScreen from '../components/AppLoadingScreen';
import { FormIdentity } from '../components/FormIdentity';
import { FormLocation } from '../components/FormLocation';
import { FormServices } from '../components/FormServices';
import { analyzePortfolio } from '../services/aiService';
import { OnboardingLivePreview } from '../components/OnboardingLivePreview';
import { ProfessionalIdentity, UserProfile, Service } from '../types';
import { userProfileSchema, serviceSchema } from '../lib/validation';
import { z } from 'zod';
import { useProfileForm } from '../hooks/useProfileForm';

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

const CopyLinkButton = ({ slug }: { slug: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(`https://nera.app/p/${slug}`);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      onClick={handleCopy}
      className="flex flex-col items-center gap-4 p-8 bg-brand-parchment rounded-[32px] border border-brand-mist hover:bg-brand-linen transition-all group"
    >
      <div className="w-12 h-12 bg-brand-white rounded-2xl flex items-center justify-center text-brand-ink border border-brand-mist group-hover:scale-110 transition-transform">
        {copied ? <CheckCircle2 size={24} className="text-green-500" /> : <Copy size={24} />}
      </div>
      <span className="text-[10px] font-medium uppercase tracking-widest">
        {copied ? 'Copiado! ✓' : 'Copiar Link'}
      </span>
    </button>
  );
};

const EXPERIENCE_OPTIONS = [
  { label: '1-2 anos', value: '1-2' },
  { label: '3-5 anos', value: '3-5' },
  { label: '5+ anos', value: '5+' }
];

export default function OnboardingPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const TOTAL_STEPS = 5;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSavingStep, setIsSavingStep] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  const {
    name, setName,
    specialty, setSpecialty,
    bio, setBio,
    city, setCity,
    whatsapp, setWhatsapp,
    instagram, setInstagram,
    slug, setSlug,
    avatar, setAvatar,
    neighborhood, setNeighborhood,
    headline, setHeadline,
    serviceMode, setServiceMode,
    studioAddress, setStudioAddress,
    serviceAreas, setServiceAreas,
    pricingStrategy, setPricingStrategy,
    differentials: selectedDifferentials, setDifferentials: setSelectedDifferentials,
    paymentMethods, setPaymentMethods,
    workingDays, setWorkingDays,
    startTime, setStartTime,
    endTime, setEndTime,
    avatarSkipped, setAvatarSkipped
  } = useProfileForm(profile);

  const [instagramConfirmed, setInstagramConfirmed] = useState(false);
  const instagramStatus = useMemo(() => {
    if (!instagram) return 'idle';
    return INSTAGRAM_REGEX.test(instagram) ? 'valid' : 'invalid';
  }, [instagram]);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const prevNameRef = useRef(name);

  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable' | 'invalid'>('idle');
  const [slugMessage, setSlugMessage] = useState('');
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const [isSlugDebouncing, setIsSlugDebouncing] = useState(false);

  // Auto-generate slug when name changes, but only if slug was empty or matched the previous name
  useEffect(() => {
    const currentGenerated = generateSlug(prevNameRef.current);
    if (!slug || slug === currentGenerated) {
      setSlug(generateSlug(name));
    }
    prevNameRef.current = name;
  }, [name]);

  // Debounced slug check
  useEffect(() => {
    if (!slug) {
      setSlugStatus('idle');
      setSlugMessage('');
      return;
    }

    const cleanSlug = slug.toLowerCase().trim();
    const slugRegex = /^[a-z0-9-]+$/;

    if (cleanSlug.length < 3 || cleanSlug.length > 50) {
      setSlugStatus('invalid');
      setSlugMessage('O link deve ter entre 3 e 50 caracteres.');
      return;
    }

    if (!slugRegex.test(cleanSlug)) {
      setSlugStatus('invalid');
      setSlugMessage('Use apenas letras, números e hífens.');
      return;
    }

    const timer = setTimeout(async () => {
      setSlugStatus('checking');
      try {
        const queryParams = new URLSearchParams({ 
          slug: cleanSlug,
          uid: user?.uid || '',
          city: city || ''
        });
        const res = await fetch(`/api/slug/check?${queryParams}`);
        const data = await res.json();
        
        if (data.available) {
          setSlugStatus('available');
          setSlugMessage(`Link disponível: usenera.com/p/${cleanSlug}`);
          setSlugSuggestions([]);
        } else {
          setSlugStatus('unavailable');
          setSlugMessage('Este link já está em uso.');
          setSlugSuggestions(data.suggestions || []);
        }
      } catch (err) {
        console.error('Error checking slug:', err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug]);

  // Step 2: Service Mode Details
  const [serviceAreaType, setServiceAreaType] = useState<'city_wide' | 'custom'>('city_wide');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaFee, setNewAreaFee] = useState('');
  const [portfolio, setPortfolio] = useState<{id?: string, url: string, category: string, isUploading?: boolean}[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [selectedBioStyle, setSelectedBioStyle] = useState('elegante');

  const stepDescriptions = [
    'Identidade',
    'Localização',
    'Serviços',
    'Agenda',
    'Revisão'
  ];

  // Step 3: Services
  const [services, setServices] = useState<{name: string, duration: string, price: string, description: string}[]>([
    { name: '', duration: '', price: '', description: '' }
  ]);

  const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [servicesErrors, setServicesErrors] = useState<any[]>([]);

  // New Identity State
  const [yearsExperience, setYearsExperience] = useState('3-5');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);

  useEffect(() => {
    if (profile) {
      console.log('[Onboarding] Profile snapshot received:', {
        step: profile.onboardingStep,
        completed: profile.onboardingCompleted,
        isFinalizing,
        currentStep: step
      });

      // 1. If onboarding is already completed on server, App.tsx guard will handle redirect.
      if (profile.onboardingCompleted && !isFinalizing && step !== 5) {
        return;
      }

      // Sync specific onboarding fields not covered by common hook
      if (!loading && !isFinalizing) {
        if (profile.serviceAreaType) setServiceAreaType(profile.serviceAreaType);
        if (profile.servicesDraft) setServices(profile.servicesDraft);
        if (profile.professionalIdentity?.yearsExperience) setYearsExperience(profile.professionalIdentity.yearsExperience);
        if (profile.professionalIdentity?.serviceStyle) setSelectedStyles(profile.professionalIdentity.serviceStyle);
        if (profile.portfolio && profile.portfolio.length > 0) setPortfolio(profile.portfolio);
        if (profile.onboardingStep !== undefined) setStep(profile.onboardingStep);
      }
    }
  }, [profile?.uid, isFinalizing, loading]);

  const generateIdentityContent = async () => {
    if (!name || !specialty) {
      toast.error('Informe seu nome e especialidade primeiro.');
      return;
    }
    setIsGeneratingContent(true);
    console.log(`[BioAI] Generating for ${name} (${specialty}) with style: ${selectedBioStyle}`);

    try {
      const response = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          specialty,
          yearsExperience,
          serviceStyle: selectedStyles,
          differentials: selectedDifferentials,
          bioStyle: selectedBioStyle
        })
      });
      const data = await response.json();
      if (data.bio) setBio(data.bio);
      if (data.headline) setHeadline(data.headline);
      toast.success('Sua marca foi personalizada com IA ✨');
    } catch (error: any) {
      console.error('[BioAI] Generation failed:', error);
      toast.error(error.message === 'Muitas solicitações. Tente novamente em um minuto.' 
        ? error.message 
        : 'O concierge está ocupado agora. Tente novamente em instantes.');
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const saveProgress = async (nextStepNum: number) => {
    if (!user || isFinalizing || profile?.onboardingCompleted) {
      return;
    }
    
    const payload: Partial<UserProfile> = {
      name,
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      whatsapp: cleanWhatsapp(whatsapp),
      bio,
      headline,
      serviceMode,
      paymentMethods,
      onboardingStep: nextStepNum,
      workingHours: {
        startTime,
        endTime,
        workingDays
      },
      professionalIdentity: {
        mainSpecialty: specialty,
        yearsExperience,
        serviceStyle: selectedStyles,
        differentials: selectedDifferentials,
        attendsAt: serviceMode as any
      } as ProfessionalIdentity,
    };

    try {
      await saveProfilePartial(user.uid, payload);
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
        
        toast.success('Foto atualizada com sucesso.');
      } catch (error: any) {
        console.error('[Avatar] upload flow failed:', error);
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

  const nextStep = async () => {
    if (isSavingStep) return;
    setFormErrors({});
    
    // Validation per step
    if (step === 1) {
      const errors: Record<string, string> = {};
      if (!name.trim()) errors.name = 'O nome é obrigatório';
      if (!specialty.trim()) errors.specialty = 'Informe sua especialidade';
      if (paymentMethods.length === 0) errors.paymentMethods = 'Selecione ao menos uma forma de pagamento';
      
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        toast.error('Por favor, preencha os campos destacados.');
        return;
      }
      
      // Auto-generate only if empty to give a "gift" to those who didn't use the button
      if (!bio && !headline) {
        generateIdentityContent();
      }
    }

    if (step === 2) {
      const errors: Record<string, string> = {};
      if (!city.trim()) errors.city = 'Informe sua cidade';
      if (!neighborhood.trim()) errors.neighborhood = 'Informe seu bairro';
      
      // WhatsApp validation
      if (!isValidWhatsapp(whatsapp)) {
        errors.whatsapp = 'Número inválido. Use um formato brasileiro: (DDD) 9XXXX-XXXX';
      }

      if (serviceMode !== 'home') {
        if (!studioAddress.street.trim()) errors.studioStreet = 'Informe a rua';
        if (!studioAddress.number.trim()) errors.studioNumber = 'Informe o número';
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        toast.error('Por favor, informe sua localização.');
        return;
      }
    }

    if (step === 3) {
      const newServiceErrors = services.map(s => {
        const errs: any = {};
        if (!s.name.trim()) errs.name = 'Informe o nome do serviço';
        if (!s.duration || Number(s.duration) <= 0) errs.duration = 'Selecione a duração. Ela define os horários disponíveis para suas clientes.';
        if (!s.price.trim()) errs.price = 'Informe o preço';
        return Object.keys(errs).length > 0 ? errs : null;
      });

      if (newServiceErrors.some(e => e !== null)) {
        setServicesErrors(newServiceErrors);
        toast.error('Preencha os dados dos seus serviços para continuar.');
        return;
      }
    }

    setIsSavingStep(true);
    try {
      const nextStepNum = step + 1;
      await saveProgress(nextStepNum);
      setStep(nextStepNum);
      // Scroll to top on step change for better UX
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('[Onboarding] Failed to move to next step:', error);
      toast.error('Não foi possível salvar seu progresso agora.');
    } finally {
      setIsSavingStep(false);
    }
  };

  const prevStep = () => setStep(s => s - 1);

  const handleFinish = async () => {
    console.log('[OnboardingSave] handleFinish triggered');
    setFormErrors({});

    // 0. CHECK AVATAR
    if (!avatar && !avatarSkipped) {
      setShowAvatarModal(true);
      return;
    }

    if (!user || isFinalizing || profile?.onboardingCompleted) {
      console.log('[OnboardingSave] handleFinish blocked:', { 
        noUser: !user, 
        isFinalizing, 
        alreadyCompleted: profile?.onboardingCompleted 
      });
      if (profile?.onboardingCompleted) navigate('/dashboard');
      return;
    }

    // 1. Validation
    try {
      console.log('[OnboardingSave] Validating payload...');
      const errors: Record<string, string> = {};
      
      if (!name.trim()) errors.name = 'O nome profissional é obrigatório';
      if (!specialty.trim()) errors.specialty = 'Sua especialidade é obrigatória';
      if (!slug.trim()) errors.slug = 'O link da sua vitrine é obrigatório';
      if (slug.length < 3) errors.slug = 'O link deve ter pelo menos 3 caracteres';
      
      // WhatsApp validation
      if (!whatsapp || !isValidWhatsapp(whatsapp)) {
        toast.error('Informe um WhatsApp válido (Ex: 11 99999-9999)');
        return;
      }

      const activeServices = services.filter(s => s.name.trim() !== '');
      if (activeServices.length === 0) {
        console.warn('[OnboardingSave] Validation failed: No active services');
        toast.error('Adicione pelo menos um serviço na etapa anterior.');
        setStep(3); // Go back to services if missing
        return;
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        toast.error('Revise os campos destacados para publicar sua vitrine.');
        
        // Auto-scroll to first error
        setTimeout(() => {
          const firstError = document.querySelector('.form-error-message');
          if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
        return;
      }
    } catch (err) {
      console.error('[OnboardingSave] Validation error:', err);
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0].message);
      } else {
        toast.error(getHumanError(err));
      }
      return;
    }
    
    setLoading(true);
    setIsFinalizing(true);
    console.log('[ONBOARDING] Starting finalization via API. Data:', { 
      uid: user.uid, 
      slug, 
      name, 
      onboardingCompleted: true 
    });

    try {
      const activeServices = services.filter(s => s.name.trim() !== '' && s.price);
      
      const profileData: Partial<UserProfile> = {
        name: name.trim(),
        specialty: specialty.trim(),
        city: (studioAddress.city || city).trim(),
        neighborhood: (studioAddress.neighborhood || neighborhood).trim(),
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        whatsapp: cleanWhatsapp(whatsapp),
        paymentMethods,
        bio: bio.trim(),
        headline: headline.trim(),
        instagram: instagram.trim().replace('@', ''),
        avatar,
        serviceMode,
        serviceAreaType,
        studioAddress: removeEmptyFields({
          street: (studioAddress.street || '').trim(),
          number: (studioAddress.number || '').trim(),
          complement: (studioAddress.complement || '').trim(),
          neighborhood: (studioAddress.neighborhood || '').trim(),
          city: (studioAddress.city || city || '').trim(),
          reference: (studioAddress.reference || '').trim()
        }),
        serviceAreas: serviceAreas.map(area => ({
          name: area.name.trim(),
          fee: Number(area.fee) || 0
        })),
        workingHours: {
          startTime,
          endTime,
          workingDays
        },
        professionalIdentity: {
          mainSpecialty: specialty.trim(),
          yearsExperience,
          serviceStyle: selectedStyles,
          differentials: selectedDifferentials,
          attendsAt: serviceMode as any
        } as ProfessionalIdentity,
        onboardingCompleted: true,
        onboardingStep: 6,
        indexable: true,
        planRank: profile?.planRank || 0,
        avatarSkipped: avatar ? false : avatarSkipped
      };

      const servicesData = activeServices.map(service => ({
        name: service.name.trim(),
        duration: Number(service.duration) || 60,
        price: Number(service.price) || 0,
        description: (service.description || '').trim()
      }));

      const response = await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          profileData,
          services: servicesData
        })
      });

      if (!response.ok) {
        let errorMsg = 'Erro ao publicar seu perfil.';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (e) {
          console.error('[ONBOARDING] Server returned non-JSON error:', response.status);
          errorMsg = `Erro do servidor (${response.status})`;
        }
        throw new Error(errorMsg);
      }

      console.log('[ONBOARDING] Transactional save completed successfully');
      setStep(6);
    } catch (error: any) {
      console.error('[ONBOARDING ERROR] Finalization failed:', error);
      toast.error(getHumanError(error));
    } finally {
      setIsFinalizing(false);
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    console.log('[ONBOARDING] completeOnboarding triggered. Navigating to dashboard.');
    if (!user) return;
    
    setIsFinalizing(true);
    try {
      // Ensure onboardingCompleted is set via local state for UI consistency
      // The API already set it in Firestore, but we confirm here
      console.log('[ONBOARDING] Final check before dashboard...');
      await saveProfilePartial(user.uid, { 
        onboardingCompleted: true,
        onboardingStep: 6
      });
      console.log('[ONBOARDING] Navigation starting...');
      navigate('/dashboard');
    } catch (error) {
      console.error('[ONBOARDING ERROR] final step failed:', error);
      // Even if this partial save fails, we should try to navigate if handleFinish worked
      navigate('/dashboard');
    } finally {
      setIsFinalizing(false);
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
      toast.error('Informe o nome do bairro.');
      return;
    }

    if (pricingStrategy !== 'none' && !newAreaFee) {
      toast.error('Por favor, informe o valor adicional.');
      return;
    }

    const isDuplicate = serviceAreas.some(
      area => area.name.toLowerCase() === newAreaName.trim().toLowerCase()
    );

    if (isDuplicate) {
      toast.error('Este bairro já foi adicionado.');
      return;
    }

    const feeValue = pricingStrategy === 'none' ? 0 : Number(newAreaFee);
    
    setServiceAreas([...serviceAreas, { 
      name: newAreaName.trim(), 
      fee: feeValue 
    }]);
    
    setNewAreaName('');
    setNewAreaFee('');
    toast.success('Bairro adicionado com sucesso.');
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
        
        // 3b. AI Categorization
        let autoCategory = '';
        try {
          autoCategory = await analyzePortfolio({ imageUrl: downloadUrl, specialty });
        } catch {
          // silencioso — categoria fica vazia se falhar
        }

        // 4. Persistence
        console.log('[Portfolio] saving to Firestore');
        const docId = await savePortfolioItem(user.uid, downloadUrl, autoCategory || specialty || 'Geral');
        console.log('[Portfolio] saved successfully');
        
        // Update local state with real ID
        setPortfolio(prev => prev.map(item => 
          item.id === tempId ? { id: docId, url: downloadUrl, category: autoCategory || specialty || 'Geral' } : item
        ));

        toast.success(`Foto adicionada${autoCategory ? ` · ${autoCategory}` : ''}`);
      } catch (error: any) {
        console.error('[Portfolio] upload failed:', error);
        toast.error('Não foi possível carregar a imagem.');
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

    setDeletingId(id);
    try {
      console.log('[Portfolio] Removing item:', id);
      const itemToDelete = portfolio.find(item => item.id === id);
      if (itemToDelete) {
        await deletePortfolioItem(user.uid, itemToDelete);
      } else {
        // Fallback for subcollection if somehow mixed
        await deleteDoc(doc(db, 'users', user.uid, 'portfolio', id));
      }
      setPortfolio(prev => prev.filter(item => item.id !== id));
      toast.success('Imagem removida.');
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

  if (authLoading) return <AppLoadingScreen />;

  const qualityIssues = useMemo(() => {
    const issues = [];

    const servicesWithoutDuration = services.filter(
      s => !s.duration || Number(s.duration) === 0
    );

    if (servicesWithoutDuration.length > 0) {
      issues.push({
        type: "warning",
        message: `${servicesWithoutDuration.length} serviço(s) sem duração. Sua agenda pode abrir horários incorretos.`,
        action: "Corrigir serviços",
        link: 3,
      });
    }

    if (!avatar && !avatarSkipped) {
      issues.push({
        type: "info",
        message: "Perfis com foto recebem mais agendamentos.",
        action: "Adicionar foto",
        link: 1,
      });
    }

    if (!bio || bio.length < 30) {
      issues.push({
        type: "info",
        message: "Adicione uma bio para as clientes conhecerem seu trabalho.",
        action: "Editar bio",
        link: 1,
      });
    }

    return issues;
  }, [services, avatar, avatarSkipped, bio]);

  const progress = (step / (TOTAL_STEPS + 1)) * 100;

  return (
    <div className="min-h-screen bg-brand-parchment flex flex-col">
      <div className="fixed top-0 left-0 w-full bg-brand-parchment/95 backdrop-blur-sm border-b border-brand-mist/50 z-50">
        <div className="w-full h-1 bg-brand-mist/30">
          <motion.div 
            className="h-full bg-brand-ink"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        {step <= TOTAL_STEPS && (
          <div className="py-3 px-6 flex justify-center items-center">
            <p className="text-[10px] text-brand-stone font-semibold uppercase tracking-[0.2em]">
              Passo {step} de {TOTAL_STEPS} <span className="mx-2 text-brand-mist">•</span> {stepDescriptions[step - 1]}
            </p>
          </div>
        )}
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
              <OnboardingLivePreview 
                name={name}
                specialty={specialty}
                headline={headline}
                slug={slug}
                avatar={avatarPreview || avatar}
              />

              <FormIdentity
                title="Sua identidade profissional"
                subtitle="Monte seu perfil com ajuda da IA. Depois você poderá ajustar tudo do seu jeito."
                name={name}
                setName={setName}
                specialty={specialty}
                setSpecialty={setSpecialty}
                avatar={avatar}
                avatarPreview={avatarPreview}
                uploadingImage={uploadingImage}
                onAvatarClick={() => avatarInputRef.current?.click()}
                inputRef={avatarInputRef}
                onFileUpload={handleFileUpload}
                slug={slug}
                setSlug={setSlug}
                slugStatus={slugStatus}
                slugMessage={slugMessage}
                slugSuggestions={slugSuggestions}
                onSelectSuggestion={(val) => setSlug(val)}
                headline={headline}
                setHeadline={setHeadline}
                bio={bio}
                setBio={setBio}
                onGenerateBio={generateIdentityContent}
                isGeneratingBio={isGeneratingContent}
                selectedBioStyle={selectedBioStyle}
                setSelectedBioStyle={setSelectedBioStyle}
                paymentMethods={paymentMethods}
                setPaymentMethods={setPaymentMethods}
                instagram={instagram}
                setInstagram={setInstagram}
                instagramStatus={instagramStatus}
                instagramConfirmed={instagramConfirmed}
                setInstagramConfirmed={setInstagramConfirmed}
                errors={formErrors}
              />

              <button 
                onClick={nextStep}
                disabled={!name || !specialty || !slug || uploadingImage || isSavingStep || slugStatus !== 'available' || paymentMethods.length === 0}
                className="w-full bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
              >
                {isSavingStep || uploadingImage ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Sparkles size={18} />
                  </motion.div>
                ) : <ArrowRight size={18} />}
                {uploadingImage ? 'Processando Foto...' : isSavingStep ? 'Salvando...' : 'Próximo Passo'}
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-12"
            >
              <FormLocation
                title="Onde você atende"
                subtitle="Informe sua cidade, bairro e forma de atendimento para suas clientes saberem como te encontrar."
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

              <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-8">
                <div className="space-y-1">
                  <h3 className="text-xl font-serif text-brand-ink">Dados de Contato</h3>
                  <p className="text-xs text-brand-stone font-light">Como as clientes podem te encontrar fora da plataforma.</p>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
                      WhatsApp de Contato <span className="text-brand-terracotta">*</span>
                    </label>
                    <input 
                      type="tel" 
                      value={whatsapp ? formatWhatsappDisplay(whatsapp) : ''} 
                      onChange={(e) => {
                        const cleaned = cleanWhatsapp(e.target.value);
                        if (cleaned.length <= 11) {
                          setWhatsapp(cleaned);
                        }
                      }} 
                      placeholder="(11) 99999-9999" 
                      className={cn(
                        "w-full px-6 py-4 bg-brand-parchment border rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light",
                        formErrors.whatsapp ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : "border-brand-mist"
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Instagram (@usuario)</label>
                    <div className={cn(
                      "flex items-center gap-2 bg-brand-parchment p-4 rounded-[20px] border transition-all",
                      instagramStatus === 'valid' ? "border-green-200 ring-1 ring-green-100" :
                      instagramStatus === 'invalid' ? "border-brand-terracotta ring-1 ring-brand-terracotta/20" : 
                      "border-brand-mist shadow-sm"
                    )}>
                      <span className="text-brand-stone text-sm ml-1">@</span>
                      <input 
                        type="text" 
                        value={instagram} 
                        onChange={(e) => setInstagram(normalizeInstagram(e.target.value))} 
                        placeholder="seu.usuario" 
                        className="flex-1 bg-transparent outline-none text-brand-ink font-medium text-sm placeholder:font-light" 
                      />
                      <AnimatePresence mode="wait">
                        {instagramStatus === 'valid' && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <CheckCircle2 size={18} className="text-green-500 mr-1" />
                          </motion.div>
                        )}
                        {instagramStatus === 'invalid' && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <X size={18} className="text-brand-terracotta mr-1" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {instagramStatus === 'invalid' && (
                      <p className="text-[10px] text-brand-terracotta font-medium ml-1 flex items-center gap-1.5">
                        <AlertCircle size={12} />
                        Use apenas letras, números, ponto e underline
                      </p>
                    )}

                    {instagramStatus === 'valid' && (
                      <div className="space-y-3 pt-1 ml-1">
                        <div className="space-y-1">
                          <a 
                            href={`https://instagram.com/${instagram}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-brand-terracotta underline flex items-center gap-1.5"
                          >
                            Confirmar: @{instagram} ↗
                          </a>
                          <p className="text-[10px] text-brand-stone font-light italic">
                            Clique para confirmar que é o seu perfil
                          </p>
                        </div>
                        
                        <label className="flex items-center gap-2.5 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input 
                              type="checkbox" 
                              checked={instagramConfirmed} 
                              onChange={(e) => setInstagramConfirmed(e.target.checked)}
                              className="peer appearance-none w-4 h-4 rounded border border-brand-mist checked:bg-brand-terracotta checked:border-brand-terracotta transition-all"
                            />
                            <CheckCircle2 size={10} className="absolute text-brand-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                          </div>
                          <span className="text-[10px] text-brand-stone font-medium uppercase tracking-wider group-hover:text-brand-ink transition-colors">
                            Confirmei que o perfil acima é o meu
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={
                    isSavingStep ||
                    !city || !neighborhood ||
                    (serviceMode !== 'home' && (!studioAddress.street || !studioAddress.number || !studioAddress.neighborhood)) || 
                    (serviceMode === 'home' && serviceAreaType === 'custom' && serviceAreas.length === 0) ||
                    (serviceMode === 'hybrid' && serviceAreaType === 'custom' && serviceAreas.length === 0)
                  }
                  className="flex-1 bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                >
                  {isSavingStep ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                      <Sparkles size={18} />
                    </motion.div>
                  ) : <ArrowRight size={18} />}
                  {isSavingStep ? 'Salvando...' : 'Próximo passo'}
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
              <FormServices
                title="Seus serviços e preços"
                subtitle="Cadastre os serviços que você oferece com duração e valor."
                services={services}
                setServices={setServices}
                errors={servicesErrors}
                workingHours={{ startTime, endTime }}
              />

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={isSavingStep || services.some(s => !s.name || !s.price)}
                  className="flex-1 bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                >
                  {isSavingStep ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                      <Sparkles size={18} />
                    </motion.div>
                  ) : <ArrowRight size={18} />}
                  {isSavingStep ? 'Salvando...' : 'Próximo passo'}
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
                  <Clock size={32} />
                </div>
                <h1 className="text-4xl font-serif font-normal text-brand-ink">Seus horários de atendimento</h1>
                <p className="text-brand-stone font-light text-center">Defina sua disponibilidade inicial. Depois você poderá ajustar dias e horários quando quiser.</p>
              </div>

              <div className="bg-brand-white p-6 md:p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Dias de Atendimento</label>
                  <div className="flex justify-between gap-1 sm:gap-2">
                    {WEEKDAYS.map((day, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleDay(idx)}
                        className={cn(
                          "w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full text-[9px] sm:text-[10px] font-bold transition-all border flex items-center justify-center",
                          workingDays.includes(idx)
                            ? "bg-brand-ink text-brand-white border-brand-ink shadow-md"
                            : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2 min-w-0">
                    <label className="text-[9px] font-bold text-brand-stone uppercase tracking-[0.15em] ml-1">Início <span className="text-brand-terracotta">*</span></label>
                    <div className="relative w-full">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist/40" size={14} />
                      <input 
                        type="time" 
                        value={startTime} 
                        onChange={(e) => setStartTime(e.target.value)} 
                        className="w-full pl-11 pr-4 py-3 bg-brand-parchment border border-brand-mist rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-sm text-brand-ink min-w-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <label className="text-[9px] font-bold text-brand-stone uppercase tracking-[0.15em] ml-1">Fim <span className="text-brand-terracotta">*</span></label>
                    <div className="relative w-full">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist/40" size={14} />
                      <input 
                        type="time" 
                        value={endTime} 
                        onChange={(e) => setEndTime(e.target.value)} 
                        className="w-full pl-11 pr-4 py-3 bg-brand-parchment border border-brand-mist rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-sm text-brand-ink min-w-0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={isSavingStep || workingDays.length === 0}
                  className="flex-1 bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                >
                  {isSavingStep ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                      <Sparkles size={18} />
                    </motion.div>
                  ) : <ArrowRight size={18} />}
                  {isSavingStep ? 'Salvando...' : 'Próximo passo'}
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
              <FormIdentity
                title="Seu perfil está pronto"
                subtitle="Revise suas informações e publique sua página profissional."
                name={name}
                setName={setName}
                specialty={specialty}
                setSpecialty={setSpecialty}
                avatar={avatar}
                avatarPreview={avatarPreview}
                uploadingImage={uploadingImage}
                onAvatarClick={() => avatarInputRef.current?.click()}
                inputRef={avatarInputRef}
                onFileUpload={handleFileUpload}
                slug={slug}
                setSlug={setSlug}
                slugStatus={slugStatus}
                slugMessage={slugMessage}
                slugSuggestions={slugSuggestions}
                onSelectSuggestion={(val) => setSlug(val)}
                headline={headline}
                setHeadline={setHeadline}
                bio={bio}
                setBio={setBio}
                onGenerateBio={generateIdentityContent}
                isGeneratingBio={isGeneratingContent}
                selectedBioStyle={selectedBioStyle}
                setSelectedBioStyle={setSelectedBioStyle}
                paymentMethods={paymentMethods}
                setPaymentMethods={setPaymentMethods}
                whatsapp={whatsapp}
                setWhatsapp={setWhatsapp}
                instagram={instagram}
                setInstagram={setInstagram}
                instagramStatus={instagramStatus}
                instagramConfirmed={instagramConfirmed}
                setInstagramConfirmed={setInstagramConfirmed}
                showLabels={true}
                errors={formErrors}
              />

              {slug && (
                <a
                  href={`/p/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-brand-terracotta hover:underline mt-3"
                >
                  <ExternalLink size={12} />
                  Visualizar como vai ficar
                </a>
              )}

              {/* Mini Preview */}
              <div className="bg-brand-ink p-8 rounded-[40px] text-brand-white flex items-center gap-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="w-16 h-16 bg-brand-linen rounded-full overflow-hidden shrink-0 border border-brand-mist/20 relative z-10">
                  {avatarPreview || avatar ? (
                    <img src={avatarPreview || avatar} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#A85C3A] to-[#C47A5A] flex items-center justify-center">
                      <span className="text-brand-white font-serif text-xl border-brand-white/20 select-none">
                        {name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 relative z-10">
                  <h4 className="font-serif italic text-lg truncate">{name || 'Seu Nome'}</h4>
                  <p className="text-[10px] text-brand-mist uppercase tracking-widest truncate">{specialty || 'Sua Especialidade'}</p>
                  <div className="flex gap-2 mt-3">
                    <div className="w-7 h-7 rounded-full bg-brand-white/10 flex items-center justify-center"><Instagram size={14} /></div>
                    <div className="w-7 h-7 rounded-full bg-brand-white/10 flex items-center justify-center"><MessageCircle size={14} /></div>
                  </div>
                </div>
                <div className="bg-brand-terracotta px-4 py-2 rounded-full text-[8px] font-medium uppercase tracking-widest relative z-10">Preview</div>
              </div>

              {qualityIssues.length > 0 && (
                <div className="p-5 bg-amber-50 rounded-[32px] border border-amber-100 mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-3 ml-1">
                    Antes de publicar
                  </p>
                  <ul className="space-y-4">
                    {qualityIssues.map((issue, i) => (
                      <li key={i} className="flex flex-col gap-2 text-[11px]">
                        <div className="flex items-start gap-2.5 text-brand-ink/80">
                          <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                          <span className="leading-relaxed font-medium">{issue.message}</span>
                        </div>
                        {issue.link && (
                          <button
                            onClick={() => {
                              if (typeof issue.link === 'number') {
                                setStep(issue.link);
                              } else {
                                navigate(issue.link);
                              }
                            }}
                            className="self-start text-[10px] font-bold text-brand-terracotta underline ml-6"
                          >
                            {issue.action}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[9px] text-brand-stone/60 mt-4 italic ml-1">
                    Você pode publicar assim mesmo e corrigir depois.
                  </p>
                </div>
              )}

              {/* Revision Checklist */}
              <div className="bg-brand-white p-8 rounded-[40px] border border-brand-mist shadow-sm space-y-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1 px-3 bg-brand-linen text-brand-ink rounded-full text-[8px] font-bold uppercase tracking-widest">Checklist de Publicação</div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-green-500"><CheckCircle2 size={16} /></div>
                      <span className="text-[11px] text-brand-ink font-medium">Nome e especialidade</span>
                    </div>
                    <span className="text-[9px] text-brand-stone font-bold uppercase tracking-widest">OK</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-green-500"><CheckCircle2 size={16} /></div>
                      <span className="text-[11px] text-brand-ink font-medium">Localização e contato</span>
                    </div>
                    <span className="text-[9px] text-brand-stone font-bold uppercase tracking-widest">OK</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {services.filter(s => s.name.trim() !== '').length > 0 ? (
                        <div className="text-green-500"><CheckCircle2 size={16} /></div>
                      ) : (
                        <div className="text-brand-terracotta"><AlertCircle size={16} /></div>
                      )}
                      <span className="text-[11px] text-brand-ink font-medium">Ao menos 1 serviço cadastrado</span>
                    </div>
                    <span className="text-[9px] text-brand-stone font-bold uppercase tracking-widest">
                      {services.filter(s => s.name.trim() !== '').length} Serviço(s)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {avatar ? (
                        <div className="text-green-500"><CheckCircle2 size={16} /></div>
                      ) : (
                        <div className="text-brand-terracotta/60"><AlertCircle size={16} /></div>
                      )}
                      <span className={cn(
                        "text-[11px] font-medium",
                        avatar ? "text-brand-ink" : "text-brand-stone italic"
                      )}>Foto de perfil</span>
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-widest",
                      avatar ? "text-brand-stone" : "text-brand-terracotta"
                    )}>{avatar ? "OK" : "Pendente"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {bio.trim().length > 20 ? (
                        <div className="text-green-500"><CheckCircle2 size={16} /></div>
                      ) : (
                        <div className="text-brand-terracotta/60"><AlertCircle size={16} /></div>
                      )}
                      <span className={cn(
                        "text-[11px] font-medium",
                        bio.trim().length > 20 ? "text-brand-ink" : "text-brand-stone italic"
                      )}>Biografia detalhada</span>
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-widest",
                      bio.trim().length > 20 ? "text-brand-stone" : "text-brand-terracotta"
                    )}>{bio.trim().length > 20 ? "OK" : "Curta"}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={handleFinish}
                  disabled={loading || isFinalizing}
                  className="flex-1 bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-[0.2em] hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                >
                  {isFinalizing ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                        <Sparkles size={18} />
                      </motion.div>
                      <span>Publicando...</span>
                    </>
                  ) : (
                    <>Publicar meu perfil <CheckCircle2 size={18} /></>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div 
              key="step6"
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
                <h1 className="text-5xl font-serif font-normal text-brand-ink">Seu perfil está no ar!</h1>
                <p className="text-brand-stone text-lg max-w-sm mx-auto font-light">
                  Sua página profissional está pronta para receber agendamentos.
                </p>
              </div>

              <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-8">
                <div className="p-8 bg-brand-parchment rounded-[32px] border border-brand-mist">
                  <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest mb-2">Seu link profissional</p>
                  <p className="text-2xl font-serif italic text-brand-terracotta break-all">nera.app/p/{slug}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <CopyLinkButton slug={slug} />
                  <button 
                    onClick={() => {
                      const text = `Olá! Agora você pode agendar seus horários comigo diretamente pelo meu link: https://nera.app/p/${slug} ✨`;
                      window.open(buildWhatsappLink('', text), '_blank');
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
                  onClick={completeOnboarding}
                  className="w-full bg-brand-ink text-brand-white py-7 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
                  disabled={isFinalizing}
                >
                  {isFinalizing ? 'Preparando acesso...' : 'Acessar meu Painel'} <ArrowRight size={20} />
                </button>
                <Link 
                  to={`/p/${slug}`} 
                  target="_blank"
                  className="text-[11px] font-medium text-brand-terracotta uppercase tracking-widest hover:text-brand-sienna transition-colors text-center"
                >
                  Ver minha página pública
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Avatar Blocker Modal */}
      <AnimatePresence>
        {showAvatarModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowAvatarModal(false)}
              className="absolute inset-0 bg-brand-ink/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-brand-white rounded-[40px] p-10 shadow-2xl overflow-hidden border border-brand-mist text-center"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/10 rounded-full -mr-16 -mt-16 blur-2xl" />
              
              <div className="relative z-10 space-y-8">
                <div className="w-20 h-20 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mx-auto shadow-sm border border-brand-mist">
                  <Camera size={36} />
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-serif text-3xl text-brand-ink">Adicione sua foto</h3>
                  <p className="text-brand-stone font-light text-sm leading-relaxed">
                    Profissionais com foto recebem <span className="font-bold text-brand-ink underline decoration-brand-terracotta/30">3x mais agendamentos</span>. Sua foto é sua primeira impressão.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <button 
                    onClick={() => {
                      setShowAvatarModal(false);
                      setStep(1);
                      setTimeout(() => {
                        avatarInputRef.current?.click();
                      }, 500);
                    }}
                    className="w-full py-6 bg-brand-ink text-brand-white rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-xl flex items-center justify-center gap-2"
                  >
                    Adicionar Foto Agora <Sparkles size={14} />
                  </button>
                  
                  <button 
                    onClick={() => {
                      setAvatarSkipped(true);
                      setShowAvatarModal(false);
                      // Use a timeout to ensure state settles before calling handleFinish
                      setTimeout(() => {
                        handleFinish();
                      }, 100);
                    }}
                    className="w-full py-4 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors"
                  >
                    Usar inicial por enquanto
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Debug Overlay - Only visible during development/debugging if showDebugHUD is true */}
      {process.env.NODE_ENV === 'development' && (window as any).showDebugHUD && (
        <div className="fixed bottom-4 right-4 bg-brand-ink/90 text-brand-white p-4 rounded-2xl text-[8px] font-mono z-[100] border border-brand-mist/20 pointer-events-none opacity-50">
          <p>STEP: {step}</p>
          <p>FINALIZING: {isFinalizing ? 'YES' : 'NO'}</p>
          <p>LOADING: {loading ? 'YES' : 'NO'}</p>
          <p>PROFILE_COMPLETED: {profile?.onboardingCompleted ? 'YES' : 'NO'}</p>
        </div>
      )}
    </div>
  );
}
