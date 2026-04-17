import React, { useState, useEffect, useRef } from 'react';
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
  Camera, Plus, X, Globe, Copy, Share2
} from 'lucide-react';
import { toast } from 'sonner';
import imageCompression from 'browser-image-compression';
import { generateSlug, formatCurrency, cn, removeEmptyFields } from '../lib/utils';
import Logo from '../components/Logo';
import { FormIdentity } from '../components/FormIdentity';
import { FormLocation } from '../components/FormLocation';
import { FormServices } from '../components/FormServices';
import { ProfessionalIdentity, UserProfile, Service } from '../types';
import { userProfileSchema, serviceSchema } from '../lib/validation';
import { z } from 'zod';

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

const FORTALEZA_NEIGHBORHOODS = [
  'Aldeota', 'Meireles', 'Papicu', 'Cocó', 'Praia de Iracema', 'Dionísio Torres', 
  'Fátima', 'Centro', 'Parangaba', 'Messejana', 'Cambeba', 'Cidade dos Funcionários', 
  'Sapiranga', 'Edson Queiroz', 'Passaré', 'Guararapes', 'Joquei Clube', 'Montese',
  'Praia do Futuro', 'Varjota', 'Mucuripe', 'Benfica', 'Maraponga', 'Mondubim'
].sort();

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
  const [serviceAreaType, setServiceAreaType] = useState<'city_wide' | 'custom'>('city_wide');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaFee, setNewAreaFee] = useState('');
  const [neighborhoodSuggestions, setNeighborhoodSuggestions] = useState<string[]>([]);
  const [pricingStrategy, setPricingStrategy] = useState<'extra' | 'none'>('none');
  const [portfolio, setPortfolio] = useState<{id?: string, url: string, category: string, isUploading?: boolean}[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);

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
      console.log('[Onboarding] Profile snapshot received:', {
        step: profile.onboardingStep,
        completed: profile.onboardingCompleted,
        isFinalizing,
        currentStep: step
      });

      // 1. If onboarding is already completed on server, App.tsx guard will handle redirect.
      // We don't need complex local logic here.
      if (profile.onboardingCompleted && !isFinalizing && step !== 5) {
        return;
      }

      // 2. Sync local state with profile
      if (!loading && !isFinalizing) {
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
          setStudioAddress(prev => ({ ...prev, street: profile.address }));
        }
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
        }
        
        if (profile.portfolio && profile.portfolio.length > 0) {
          setPortfolio(profile.portfolio);
        }
        
        if (profile.onboardingStep !== undefined) {
          setStep(profile.onboardingStep);
        }
      }
    }
  }, [profile, isFinalizing, loading, user?.uid]); // Removed 'step' to prevent infinite loop or fighting

  const generateIdentityContent = async () => {
    if (!name || !specialty) return;
    setIsGeneratingContent(true);

    // Simulate AI reflection
    await new Promise(resolve => setTimeout(resolve, 1500));

    const stylesStr = selectedStyles.length > 0 
      ? selectedStyles.join(' e ') 
      : 'excelência';
    
    const diffsStr = selectedDifferentials.length > 0
      ? selectedDifferentials.join(', ')
      : 'qualidade';

    const expText = yearsExperience === '5+' ? 'mais de 5' : yearsExperience;
    
    // More natural headline generation using templates
    const style1 = selectedStyles[0]?.toLowerCase() || 'premium';
    const style2 = selectedStyles[1]?.toLowerCase();
    
    // Normalization of concepts for better readability
    const conceptsMap: Record<string, string> = {
      'delicada e detalhista': 'foco em detalhes e delicadeza',
      'rápida e eficiente': 'agilidade com alta qualidade',
      'premium e sofisticada': 'acabamento sofisticado',
      'técnica e precisa': 'técnica precisa',
      'espontânea e criativa': 'design criativo',
      'minimalista': 'estilo minimalista',
      'moderna': 'visão moderna',
      'atenciosa': 'atendimento humanizado',
      'inovadora': 'técnicas inovadoras'
    };

    const normalize = (text: string) => conceptsMap[text.toLowerCase()] || text;
    
    const trait1 = normalize(selectedStyles[0] || 'Premium');
    const trait2 = normalize(selectedStyles[1] || 'Exclusivo');

    const headlines = [
      `${specialty} | ${trait1}${selectedStyles.length > 1 ? ' · ' + trait2 : ''}`,
      `${specialty} com ${expText} anos de experiência.`,
      `Design de ${specialty.toLowerCase()} focado em ${trait1}.`,
      `${specialty}: Excelência e ${trait1}.`
    ];
    
    const bioTemplates = [
      `${specialty} há ${expText} anos. Meu trabalho busca unir ${trait1} e ${trait2}, sempre priorizando ${diffsStr.toLowerCase()}.`,
      `Especialista em ${specialty.toLowerCase()} com trajetória de ${expText} anos. Minha assinatura é o ${trait1}. Foco total em ${diffsStr.toLowerCase()}.`,
      `${expText} anos transformando olhares e autoestimar. Atendimento voltado para ${trait1} com o diferencial de ${diffsStr.toLowerCase()}.`
    ];
    
    const newHeadline = headlines[Math.floor(Math.random() * headlines.length)];
    const newBio = bioTemplates[Math.floor(Math.random() * bioTemplates.length)];
    
    setHeadline(newHeadline);
    setBio(newBio);
    setIsGeneratingContent(false);
  };

  const saveProgress = async (nextStepNum: number) => {
    if (!user || isFinalizing || profile?.onboardingCompleted) {
      return;
    }
    
    const payload: Partial<UserProfile> = {
      name,
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      whatsapp: whatsapp.replace(/\D/g, ''),
      bio,
      headline,
      serviceMode,
      onboardingStep: nextStepNum,
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
    if (step === 1) {
      generateIdentityContent();
    }
    const nextStepNum = step + 1;
    await saveProgress(nextStepNum);
    setStep(nextStepNum);
  };

  const prevStep = () => setStep(s => s - 1);

  const handleFinish = async () => {
    if (!user || isFinalizing || profile?.onboardingCompleted) {
      if (profile?.onboardingCompleted) navigate('/dashboard');
      return;
    }

    // 1. Validation
    try {
      userProfileSchema.parse({
        name,
        slug,
        whatsapp,
        email: user.email,
        bio,
        serviceMode,
        workingHours: { startTime, endTime, workingDays }
      });
      
      const activeServices = services.filter(s => s.name.trim() !== '');
      if (activeServices.length === 0) {
        toast.error('Adicione pelo menos um serviço');
        return;
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0].message);
      } else {
        toast.error('Erro de validação');
      }
      return;
    }
    
    setLoading(true);
    setIsFinalizing(true);

    try {
      // 2. Prepare Final Data (without setting completed: true yet)
      const finalData: Partial<UserProfile> = {
        name: name.trim(),
        specialty: specialty.trim(),
        city: (studioAddress.city || city).trim(),
        neighborhood: (studioAddress.neighborhood || neighborhood).trim(),
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        whatsapp: whatsapp.replace(/\D/g, ''),
        bio: bio.trim(),
        headline: headline.trim(),
        instagram: instagram.trim().replace('@', ''),
        avatar,
        serviceMode,
        serviceAreaType,
        studioAddress: removeEmptyFields({
          street: studioAddress.street.trim(),
          number: studioAddress.number.trim(),
          complement: studioAddress.complement.trim(),
          neighborhood: studioAddress.neighborhood.trim(),
          city: studioAddress.city.trim() || city.trim(),
          reference: studioAddress.reference.trim()
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
        onboardingStep: 5
      };

      // 3. Save Services
      const activeServices = services.filter(s => s.name && s.price);
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

      // 4. Save Profile
      await saveProfilePartial(user.uid, finalData);

      setStep(5);
    } catch (error: any) {
      console.error('[Onboarding] Finalization error:', error);
      toast.error('Erro ao salvar dados');
      setIsFinalizing(false);
    } finally {
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    if (!user || isFinalizing) return;
    
    setIsFinalizing(true);
    try {
      await saveProfilePartial(user.uid, { onboardingCompleted: true });
      navigate('/dashboard');
    } catch (error) {
      toast.error('Erro ao concluir');
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
      const itemToDelete = portfolio.find(item => item.id === id);
      if (itemToDelete) {
        await deletePortfolioItem(user.uid, itemToDelete);
      } else {
        // Fallback for subcollection if somehow mixed
        await deleteDoc(doc(db, 'users', user.uid, 'portfolio', id));
      }
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

  const progress = (step / 5) * 100;

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
              <FormIdentity
                title="Como as clientes devem te conhecer?"
                subtitle="Sua identidade é o primeiro passo para criar confiança."
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
              />

              <button 
                onClick={nextStep}
                disabled={!name || !specialty || uploadingImage}
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
              <FormLocation
                title="Onde você atende?"
                subtitle="Configure sua logística de atendimento."
                city={city}
                setCity={setCity}
                neighborhood={neighborhood}
                setNeighborhood={setNeighborhood}
                serviceMode={serviceMode}
                setServiceMode={setServiceMode}
              />

              <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-10">
                {/* AI Bio Preview Section */}

                {/* AI Bio Preview Section */}
                <div className="pt-6 border-t border-brand-mist space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-brand-terracotta" />
                      <h3 className="text-[10px] font-medium text-brand-stone uppercase tracking-widest">Sua Bio Inteligente</h3>
                    </div>
                    {isGeneratingContent ? (
                      <span className="text-[10px] text-brand-stone animate-pulse uppercase tracking-widest">Refinando...</span>
                    ) : (
                      <button 
                        onClick={generateIdentityContent}
                        className="text-[10px] text-brand-terracotta hover:underline uppercase tracking-widest font-medium"
                      >
                        Recriar
                      </button>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {isGeneratingContent ? (
                      <motion.div 
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                      >
                        <div className="h-4 bg-brand-parchment rounded-full w-3/4 animate-pulse" />
                        <div className="space-y-2">
                          <div className="h-3 bg-brand-parchment rounded-full w-full animate-pulse" />
                          <div className="h-3 bg-brand-parchment rounded-full w-5/6 animate-pulse" />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div 
                        key="content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                      >
                        <div className="bg-brand-parchment p-6 rounded-[24px] border border-brand-mist space-y-4 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Sparkles size={14} className="text-brand-terracotta/40" />
                          </div>
                          
                          <div className="space-y-3">
                            <input 
                              type="text"
                              value={headline}
                              onChange={(e) => setHeadline(e.target.value)}
                              className="w-full bg-transparent font-serif text-xl text-brand-ink outline-none border-b border-transparent focus:border-brand-mist transition-all"
                              placeholder="Sua frase de destaque..."
                            />
                            <textarea 
                              value={bio}
                              onChange={(e) => setBio(e.target.value)}
                              className="w-full bg-transparent font-light text-sm text-brand-stone outline-none border-b border-transparent focus:border-brand-mist transition-all resize-none h-20"
                              placeholder="Sua biografia profissional..."
                            />
                          </div>
                        </div>

                        {/* Visual Preview Badge */}
                        <div className="flex items-center gap-3 p-4 bg-brand-linen/30 rounded-2xl border border-brand-linen/50">
                          <div className="w-12 h-12 bg-brand-white rounded-full flex-shrink-0 border border-brand-mist overflow-hidden shadow-sm">
                            {avatarPreview || avatar ? (
                              <img src={avatarPreview || avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-brand-stone">
                                <User size={20} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-serif text-brand-ink truncate">{name || 'Seu Nome'}</p>
                            <p className="text-[10px] text-brand-stone truncate italic">{headline || 'Headline automática...'}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

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
                      <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Área de Atendimento</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button 
                          onClick={() => setServiceAreaType('city_wide')}
                          className={`p-5 rounded-[24px] border text-left transition-all ${serviceAreaType === 'city_wide' ? 'border-brand-ink bg-brand-linen' : 'border-brand-mist bg-brand-parchment hover:border-brand-stone'}`}
                        >
                          <p className="text-xs font-medium text-brand-ink mb-1">Toda a cidade</p>
                          <p className="text-[10px] text-brand-stone font-light leading-tight">Você atende em qualquer bairro de {city || 'sua cidade'}.</p>
                        </button>
                        <button 
                          onClick={() => setServiceAreaType('custom')}
                          className={`p-5 rounded-[24px] border text-left transition-all ${serviceAreaType === 'custom' ? 'border-brand-ink bg-brand-linen' : 'border-brand-mist bg-brand-parchment hover:border-brand-stone'}`}
                        >
                          <p className="text-xs font-medium text-brand-ink mb-1">Bairros específicos</p>
                          <p className="text-[10px] text-brand-stone font-light leading-tight">Escolha exatamente quais bairros você atende e defina taxas.</p>
                        </button>
                      </div>
                    </div>

                    {serviceAreaType === 'custom' && (
                      <div className="space-y-6">
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

                        <div className="space-y-6 pt-6 bg-brand-white p-8 rounded-[32px] border border-brand-mist shadow-sm">
                          <div className="flex flex-col md:flex-row items-end gap-3">
                            <div className="flex-1 space-y-2 w-full relative">
                              <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Bairro / Região</label>
                              <input 
                                type="text" 
                                value={newAreaName} 
                                onChange={(e) => setNewAreaName(e.target.value)} 
                                onFocus={() => setNeighborhoodSuggestions(FORTALEZA_NEIGHBORHOODS.filter(n => n.toLowerCase().includes(newAreaName.toLowerCase())))}
                                onKeyDown={(e) => e.key === 'Enter' && addArea()}
                                placeholder="Busque ou digite o bairro" 
                                className="w-full px-5 py-3 bg-brand-parchment border border-brand-mist rounded-xl outline-none text-sm focus:ring-1 focus:ring-brand-ink transition-all font-light" 
                              />
                              {newAreaName && (
                                <div className="absolute left-0 top-[100%] w-full bg-brand-white border border-brand-mist rounded-xl shadow-xl mt-1 z-50 max-h-48 overflow-auto">
                                  {FORTALEZA_NEIGHBORHOODS.filter(n => n.toLowerCase().includes(newAreaName.toLowerCase())).map(suggestion => (
                                    <button 
                                      key={suggestion}
                                      onClick={() => { setNewAreaName(suggestion); setNeighborhoodSuggestions([]); }}
                                      className="w-full text-left px-5 py-3 text-xs hover:bg-brand-linen transition-colors border-b border-brand-mist last:border-0"
                                    >
                                      {suggestion}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {pricingStrategy === 'extra' && (
                              <div className="w-full md:w-32 space-y-2">
                                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Taxa Extra</label>
                                <input 
                                  type="number" 
                                  value={newAreaFee} 
                                  onChange={(e) => setNewAreaFee(e.target.value)} 
                                  onKeyDown={(e) => e.key === 'Enter' && addArea()}
                                  placeholder="0,00" 
                                  className="w-full px-5 py-3 bg-brand-parchment border border-brand-mist rounded-xl outline-none text-sm focus:ring-1 focus:ring-brand-ink transition-all font-light" 
                                />
                              </div>
                            )}
                            <button 
                              onClick={addArea} 
                              className="bg-brand-ink text-brand-white px-8 h-[46px] rounded-xl text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-sm"
                            >
                              Adicionar
                            </button>
                          </div>
                        </div>

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
                )}
              </div>

              <div className="flex gap-4">
                <button onClick={prevStep} className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm">
                  <ArrowLeft size={24} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={
                    !city || !neighborhood ||
                    (serviceMode !== 'home' && (!studioAddress.street || !studioAddress.number || !studioAddress.neighborhood)) || 
                    (serviceMode === 'home' && serviceAreaType === 'custom' && serviceAreas.length === 0) ||
                    (serviceMode === 'hybrid' && serviceAreaType === 'custom' && serviceAreas.length === 0)
                  }
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
              <FormServices
                title="Seus Serviços"
                subtitle="O que suas clientes vão agendar?"
                services={services}
                setServices={setServices}
              />

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
                  onClick={handleFinish}
                  disabled={loading || !slug || !whatsapp}
                  className="flex-1 bg-brand-ink text-brand-white py-6 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
                >
                  {loading ? 'Finalizando...' : 'Concluir Vitrine'} <CheckCircle2 size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div 
              key="step5"
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
                  onClick={completeOnboarding}
                  className="w-full bg-brand-ink text-brand-white py-7 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
                  disabled={isFinalizing}
                >
                  {isFinalizing ? 'Finalizando...' : 'Ir para meu Dashboard'} <ArrowRight size={20} />
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
