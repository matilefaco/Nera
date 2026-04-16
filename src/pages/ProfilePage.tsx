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
import { formatCurrency, cn } from '../lib/utils';
import Logo from '../components/Logo';
import MobileNav from '../components/MobileNav';

const IDENTITY_DIFFERENTIALS = [
  'Pontualidade',
  'Biossegurança',
  'Produtos premium',
  'Atendimento exclusivo',
  'Técnica avançada'
];

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

  useEffect(() => {
    if (profile && user) {
      setName(profile.name || '');
      setSpecialty(profile.specialty || profile.professionalIdentity?.mainSpecialty || '');
      setBio(profile.bio || profile.professionalIdentity?.bio || '');
      setCity(profile.city || profile.studioAddress?.city || profile.location || '');
      setWhatsapp(profile.whatsapp || '');
      setSlug(profile.slug || '');
      setAvatar(profile.avatar || '');
      setAvatarPreview(profile.avatar || '');
      setNeighborhood(profile.neighborhood || profile.studioAddress?.neighborhood || '');
      setHeadline(profile.headline || profile.professionalIdentity?.headline || '');
      setDifferentials(profile.professionalIdentity?.differentials || []);
      setServiceMode(profile.serviceMode || 'studio');
      if (profile.studioAddress) {
        setStudioAddress(profile.studioAddress);
      } else if (profile.address) {
        setStudioAddress(prev => ({ ...prev, street: profile.address }));
      }
      setServiceAreas(profile.serviceAreas || []);
      setPricingStrategy(profile.pricingStrategy || 'none');

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
    return <div className="flex items-center justify-center h-screen bg-brand-parchment text-brand-stone font-light">Carregando perfil...</div>;
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
      toast.error('Usuário não autenticado');
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
      const sanitizedWhatsapp = whatsapp.trim().replace(/\D/g, '');
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
        slug: sanitizedSlug,
        serviceMode,
        serviceAreas: sanitizedAreas,
        pricingStrategy,
        avatar,
        professionalIdentity: {
          ...profile?.professionalIdentity,
          headline: headline.trim(),
          differentials: differentials,
          bio: sanitizedBio,
          mainSpecialty: sanitizedSpecialty
        },
        updatedAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'users', user.uid), finalPayload, { merge: true });
        console.log('[ProfileSave] Success');
        toast.success('Perfil atualizado com sucesso!');
      } catch (err: any) {
        console.error('[ProfileSave] Failed:', err);
        if (err?.code === 'resource-exhausted' || err?.message?.includes('too large')) {
          toast.error('O perfil está muito grande. Tente remover algumas fotos do portfólio.');
        } else {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
        }
      }
    } catch (error: any) {
      console.error('[ProfileSave] CRITICAL ERROR:', error);
      const technicalDetail = error.code || error.message || 'Erro desconhecido';
      toast.error(`Erro ao atualizar perfil: ${technicalDetail}`);
    } finally {
      setLoading(false);
      console.log('[ProfileSave] Done');
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
        
        toast.success('Foto de perfil atualizada!');
      } catch (err: any) {
        console.error('[Avatar] upload flow failed:', err);
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

        toast.success('Imagem adicionada ao portfólio!');
      } catch (err: any) {
        console.error('[Portfolio] upload failed:', err);
        toast.error('Erro ao salvar imagem no portfólio');
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
      toast.success('Imagem removida do portfólio');
    } catch (err) {
      console.error('[Portfolio] Error removing:', err);
      toast.error('Erro ao remover imagem');
    }
  };

  const removeArea = (index: number) => {
    setServiceAreas(serviceAreas.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-brand-parchment pb-24 md:pb-0 md:flex">
      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex w-64 bg-brand-white border-r border-brand-mist p-8 flex-col">
        <div className="mb-12">
          <Logo />
        </div>
        <nav className="flex-1 space-y-2">
          <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-xl font-medium text-sm transition-all">
            <Calendar size={18} /> Dashboard
          </Link>
          <Link to="/agenda" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-xl font-medium text-sm transition-all">
            <Calendar size={18} /> Agenda
          </Link>
          <Link to="/clients" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-xl font-medium text-sm transition-all">
            <Users size={18} /> Clientes
          </Link>
          <Link to="/services" className="flex items-center gap-3 px-4 py-3 text-brand-stone hover:bg-brand-parchment rounded-xl font-medium text-sm transition-all">
            <List size={18} /> Serviços
          </Link>
          <Link to="/profile" className="flex items-center gap-3 px-4 py-3 bg-brand-linen text-brand-ink rounded-xl font-medium text-sm">
            <Settings size={18} /> Perfil
          </Link>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-12 max-w-5xl mx-auto w-full">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-serif font-normal text-brand-ink mb-2">Sua Vitrine Premium</h1>
            <p className="text-brand-stone font-light">Personalize sua vitrine digital para encantar clientes.</p>
          </div>
          <Link to={`/p/${profile?.slug}`} target="_blank" className="flex items-center gap-2 text-brand-terracotta font-medium text-sm hover:text-brand-sienna transition-colors">
            Ver minha página <ExternalLink size={16} />
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
          {/* Left Column: Avatar & Identity */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm text-center">
              <div className="relative w-32 h-32 mx-auto mb-8">
                <div 
                  onClick={() => {
                    console.log('[Upload] Avatar click triggered');
                    avatarInputRef.current?.click();
                  }}
                  className="w-full h-full bg-brand-linen rounded-full flex items-center justify-center text-brand-terracotta border-4 border-brand-white shadow-sm overflow-hidden cursor-pointer group relative"
                >
                  {avatarPreview || avatar ? (
                    <img src={avatarPreview || avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={48} className="opacity-20" />
                  )}
                  <div className="absolute inset-0 bg-brand-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {uploadingImage ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                        <Sparkles size={24} className="text-brand-white" />
                      </motion.div>
                    ) : (
                      <Camera size={24} className="text-brand-white" />
                    )}
                  </div>
                </div>
                <input 
                  ref={avatarInputRef}
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  disabled={uploadingImage}
                  onChange={handleAvatarUpload} 
                />
                <div className="absolute bottom-0 right-0 w-10 h-10 bg-brand-ink text-brand-white rounded-full flex items-center justify-center border-4 border-brand-white shadow-lg pointer-events-none">
                  <Camera size={16} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Details */}
          <div className="lg:col-span-2 space-y-10">
            <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm space-y-8">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Camera size={20} className="text-brand-terracotta" />
                  <h3 className="font-serif italic text-xl text-brand-ink">Seu Portfólio</h3>
                </div>
                <p className="text-[10px] text-brand-stone font-medium uppercase tracking-widest">Organize por categorias</p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {portfolio.map((item, idx) => (
                  <div key={item.id || idx} className="aspect-square bg-brand-parchment rounded-2xl overflow-hidden relative group border border-brand-mist">
                    <img src={item.url} className={`w-full h-full object-cover ${item.isUploading ? 'opacity-50 blur-sm' : ''}`} referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-brand-ink/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-3 backdrop-blur-[2px]">
                      <input 
                        type="text" 
                        value={item.category} 
                        onChange={async (e) => {
                          const newCategory = e.target.value;
                          const newPortfolio = [...portfolio];
                          newPortfolio[idx].category = newCategory;
                          setPortfolio(newPortfolio);
                          
                          // PERSISTENCE: Update the entire portfolio array in the user document
                          try {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, {
                              portfolio: newPortfolio
                            });
                          } catch (err) {
                            console.error('[Portfolio] Error updating category:', err);
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
            </div>

            <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-sm space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Nome Profissional</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Especialidade</label>
                  <input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ex: Nail Designer" className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Sua Headline (Frase de impacto)</label>
                <input 
                  type="text" 
                  value={headline} 
                  onChange={(e) => setHeadline(e.target.value)} 
                  placeholder="Ex: Especialista em beleza natural"
                  className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Bio / Descrição Boutique</label>
                <textarea 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)} 
                  className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all h-32 resize-none font-light" 
                  placeholder="Conte o diferencial do seu atendimento..." 
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Seus Diferenciais</label>
                <div className="flex flex-wrap gap-2">
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Cidade / Localização</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade, Bairro" className="w-full pl-12 pr-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">WhatsApp de Contato</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
                    <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" className="w-full pl-12 pr-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Link Personalizado (Slug)</label>
                <div className="relative">
                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
                  <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full pl-12 pr-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-mono text-sm text-brand-terracotta" required />
                </div>
                <p className="text-[10px] text-brand-stone mt-3 ml-1">Seu link público: <span className="text-brand-terracotta font-medium">nera.app/p/{slug}</span></p>
              </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Bairro Base</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
                    <input 
                      type="text" 
                      value={neighborhood} 
                      onChange={(e) => setNeighborhood(e.target.value)} 
                      placeholder="Ex: Aldeota" 
                      className="w-full pl-12 pr-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" 
                    />
                  </div>
                </div>

                {/* Service Mode Section */}
                <div className="pt-8 border-t border-brand-mist space-y-8">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif italic text-xl text-brand-ink">Modo de Atendimento</h3>
                      <p className="text-xs text-brand-stone font-light">Onde você realiza seus serviços?</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <button 
                      type="button"
                      onClick={() => setServiceMode('studio')}
                      className={`p-5 rounded-[24px] border transition-all flex flex-col items-center gap-2 ${serviceMode === 'studio' ? 'border-brand-ink bg-brand-linen text-brand-ink' : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'}`}
                    >
                      <Building2 size={24} />
                      <span className="text-[10px] font-medium uppercase">Estúdio</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setServiceMode('home')}
                      className={`p-5 rounded-[24px] border transition-all flex flex-col items-center gap-2 ${serviceMode === 'home' ? 'border-brand-ink bg-brand-linen text-brand-ink' : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'}`}
                    >
                      <Home size={24} />
                      <span className="text-[10px] font-medium uppercase">Domicílio</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setServiceMode('hybrid')}
                      className={`p-5 rounded-[24px] border transition-all flex flex-col items-center gap-2 ${serviceMode === 'hybrid' ? 'border-brand-ink bg-brand-linen text-brand-ink' : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'}`}
                    >
                      <Briefcase size={24} />
                      <span className="text-[10px] font-medium uppercase">Híbrido</span>
                    </button>
                  </div>
                </div>

                {(serviceMode === 'studio' || serviceMode === 'hybrid') && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6">
                    <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Endereço do Estúdio</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
                        <input 
                          type="text" 
                          value={studioAddress.street} 
                          onChange={(e) => setStudioAddress({...studioAddress, street: e.target.value})} 
                          placeholder="Rua / Logradouro" 
                          className="w-full pl-12 pr-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" 
                        />
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={studioAddress.number} 
                          onChange={(e) => setStudioAddress({...studioAddress, number: e.target.value})} 
                          placeholder="Número" 
                          className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" 
                        />
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={studioAddress.complement} 
                          onChange={(e) => setStudioAddress({...studioAddress, complement: e.target.value})} 
                          placeholder="Complemento (opcional)" 
                          className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" 
                        />
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={studioAddress.neighborhood} 
                          onChange={(e) => setStudioAddress({...studioAddress, neighborhood: e.target.value})} 
                          placeholder="Bairro" 
                          className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" 
                        />
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={studioAddress.city || city} 
                          onChange={(e) => setStudioAddress({...studioAddress, city: e.target.value})} 
                          placeholder="Cidade" 
                          className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" 
                        />
                      </div>
                      <div className="md:col-span-2 relative">
                        <input 
                          type="text" 
                          value={studioAddress.reference} 
                          onChange={(e) => setStudioAddress({...studioAddress, reference: e.target.value})} 
                          placeholder="Ponto de Referência" 
                          className="w-full px-5 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light" 
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {(serviceMode === 'home' || serviceMode === 'hybrid') && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-8">
                    <div className="space-y-4">
                      <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest">Você cobra o mesmo valor em todos os bairros?</p>
                      <div className="flex gap-4">
                        <button 
                          type="button"
                          onClick={() => setPricingStrategy('none')}
                          className={`flex-1 py-4 px-6 rounded-2xl border transition-all text-xs font-medium ${pricingStrategy === 'none' ? 'border-brand-ink bg-brand-linen text-brand-ink' : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'}`}
                        >
                          Sim, mesmo valor
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPricingStrategy('extra')}
                          className={`flex-1 py-4 px-6 rounded-2xl border transition-all text-xs font-medium ${pricingStrategy === 'extra' ? 'border-brand-ink bg-brand-linen text-brand-ink' : 'border-brand-mist bg-brand-parchment text-brand-stone hover:border-brand-stone'}`}
                        >
                          Não, varia por região
                        </button>
                      </div>
                    </div>

                    <div className="bg-brand-parchment p-8 rounded-[32px] border border-brand-mist space-y-6">
                      <h4 className="text-[10px] font-medium text-brand-ink uppercase tracking-widest">Configurar Regiões</h4>
                      <div className="flex flex-col md:flex-row items-end gap-4">
                        <div className="flex-1 space-y-2 w-full">
                          <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Bairro / Região</label>
                          <input type="text" value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} placeholder="Ex: Aldeota" className="w-full px-5 py-3 bg-brand-white border border-brand-mist rounded-xl outline-none text-sm font-light focus:ring-1 focus:ring-brand-ink transition-all" />
                        </div>
                        <div className="w-full md:w-48 space-y-2">
                          <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">{pricingStrategy === 'extra' ? 'Valor Adicional (R$)' : 'Atendimento (R$)'}</label>
                          {pricingStrategy === 'extra' ? (
                            <input type="number" value={newAreaFee} onChange={(e) => setNewAreaFee(e.target.value)} placeholder="0,00" className="w-full px-5 py-3 bg-brand-white border border-brand-mist rounded-xl outline-none text-sm font-light focus:ring-1 focus:ring-brand-ink transition-all" />
                          ) : (
                            <div className="w-full px-5 py-3 bg-brand-linen/50 rounded-xl text-xs text-brand-stone flex items-center italic h-[46px] font-light">Preço fixo</div>
                          )}
                        </div>
                        <button type="button" onClick={addArea} className="bg-brand-ink text-brand-white px-8 h-[46px] rounded-xl text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-sm">Adicionar</button>
                      </div>

                      <div className="space-y-2">
                        {serviceAreas.map((area, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-brand-white p-4 rounded-2xl border border-brand-mist">
                            <span className="text-sm font-medium text-brand-ink">{area.name}</span>
                            <div className="flex items-center gap-4">
                              {pricingStrategy === 'extra' && area.fee > 0 && (
                                <span className="text-xs font-medium text-brand-terracotta">+{formatCurrency(area.fee)}</span>
                              )}
                              <button type="button" onClick={() => removeArea(idx)} className="text-brand-stone hover:text-brand-terracotta transition-all">
                                <X size={16} />
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
              className="w-full bg-brand-ink text-brand-white py-7 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl"
            >
              <Save size={18} /> {loading ? 'Salvando...' : 'Atualizar Minha Vitrine'}
            </button>
          </div>
        </form>
      </main>
      <MobileNav />
    </div>
  );
}
