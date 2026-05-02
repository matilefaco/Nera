import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, MapPin, Star, Filter, ChevronRight, 
  ChevronLeft, ArrowRight, Heart, Sparkles,
  Home, Building2, LayoutGrid, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  collection, query, where, getDocs, 
  limit, startAfter, orderBy, DocumentData, 
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import Logo from '../components/Logo';
import { formatCurrency, cn } from '../lib/utils';
import { SERVICE_MODES as SERVICE_MODE_COPY } from '../lib/copy';
import SEOHead from '../components/SEOHead';

const SPECIALTIES = [
  'Nails', 'Lashes', 'Cabelo', 'Sobrancelhas', 'Maquiagem', 'Estética Face', 'Estética Corpo', 'Depilação'
];

const SERVICE_MODES = [
  { id: 'all', label: 'Todos' },
  { id: 'home', label: SERVICE_MODE_COPY.home.shortLabel },
  { id: 'studio', label: SERVICE_MODE_COPY.studio.shortLabel },
  { id: 'hybrid', label: SERVICE_MODE_COPY.hybrid.shortLabel }
];

export default function DirectoryPage() {
  const [professionals, setProfessionals] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [cityFilter, setCityFilter] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const fetchProfessionals = async (isNextPage = false) => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'users'),
        where('onboardingCompleted', '==', true),
        orderBy('planRank', 'desc'),
        orderBy('averageRating', 'desc'),
        limit(20)
      );

      // Apply indexable filter if we strictly want only those who opt-in
      // However, usually directories show all completed ones unless they opt-out
      // q = query(q, where('indexable', '==', true));

      // Note: city and specialty filters in Firestore would require additional indexes
      // For this build, we'll fetch and filter if we can't build composite indexes dynamically
      // But for a production app, we'd add where('city', '==', cityFilter) if set.
      
      if (isNextPage && lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));

      let result = docs;

      // In-memory filters for fields that might not have composite indexes yet
      if (cityFilter) {
        result = result.filter(p => p.city?.toLowerCase().includes(cityFilter.toLowerCase()));
      }
      if (specialtyFilter) {
        result = result.filter(p => p.specialty === specialtyFilter || p.professionalIdentity?.mainSpecialty === specialtyFilter);
      }
      if (modeFilter !== 'all') {
        result = result.filter(p => p.serviceMode === modeFilter);
      }
      if (ratingFilter > 0) {
        result = result.filter(p => (p.averageRating || 0) >= ratingFilter);
      }

      if (isNextPage) {
        setProfessionals(prev => [...prev, ...result]);
      } else {
        setProfessionals(result);
      }

      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 20);
    } catch (err) {
      console.error('Error fetching professionals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfessionals();
  }, [cityFilter, specialtyFilter, modeFilter, ratingFilter]);

  const seoTitle = cityFilter 
    ? `Profissionais de Beleza em ${cityFilter} | Nera`
    : "Melhores Profissionais de Beleza | Nera";
  
  const seoDescription = cityFilter
    ? `Encontre as melhores profissionais de beleza em ${cityFilter}. Agende unhas, cílios, cabelo e muito mais com profissionais verificadas pelo Nera.`
    : "O diretório oficial das melhores profissionais independentes de beleza. Agende online com segurança e praticidade.";

  const canonicalUrl = `${window.location.origin}/profissionais${cityFilter ? `?cidade=${encodeURIComponent(cityFilter)}` : ''}`;

  return (
    <div className="min-h-screen bg-brand-parchment pb-20">
      <SEOHead 
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalUrl}
      />

      {/* Header */}
      <header className="bg-brand-white border-b border-brand-mist sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowMobileFilters(true)}
              className="lg:hidden p-3 bg-brand-parchment rounded-xl text-brand-ink"
            >
              <Filter size={20} />
            </button>
            <Link to="/register" className="hidden sm:block bg-brand-ink text-brand-white px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all">
              Criar minha vitrine
            </Link>
          </div>
        </div>

        {/* Desktop Filter Bar */}
        <div className="hidden lg:block bg-brand-linen/50 border-t border-brand-mist/30 py-4">
          <div className="max-w-7xl mx-auto px-6 flex items-center gap-6">
            <div className="flex-1 flex items-center gap-4">
              <div className="relative flex-1 max-w-xs">
                <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist" />
                <input 
                  type="text"
                  placeholder="Cidade..."
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-brand-white border border-brand-mist rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink"
                />
              </div>

              <select 
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="px-4 py-3 bg-brand-white border border-brand-mist rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink min-w-[160px]"
              >
                <option value="">Especialidade</option>
                {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <div className="flex bg-brand-white border border-brand-mist rounded-xl p-1">
                {SERVICE_MODES.map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setModeFilter(mode.id)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      modeFilter === mode.id ? "bg-brand-ink text-brand-white" : "text-brand-stone hover:bg-brand-linen"
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-stone mr-2">Avaliação:</span>
              {[4, 3, 2, 1].map(r => (
                <button
                  key={r}
                  onClick={() => setRatingFilter(r === ratingFilter ? 0 : r)}
                  className={cn(
                    "flex items-center gap-1 px-3 py-2 rounded-lg border text-[10px] font-bold transition-all",
                    ratingFilter === r 
                      ? "bg-brand-terracotta border-brand-terracotta text-white" 
                      : "bg-brand-white border-brand-mist text-brand-stone hover:border-brand-stone"
                  )}
                >
                  {r}+ <Star size={10} fill="currentColor" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-4xl font-serif text-brand-ink mb-2 italic">Descubra Excelência</h1>
          <p className="text-brand-stone text-sm font-light">As melhores profissionais da beleza, unidas pelo Nera.</p>
        </div>

        {loading && page === 1 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-brand-white rounded-[32px] aspect-[3/4] animate-pulse border border-brand-mist" />
            ))}
          </div>
        ) : professionals.length === 0 ? (
          <div className="py-32 text-center">
            <Sparkles size={48} className="text-brand-mist mx-auto mb-6" />
            <h2 className="text-2xl font-serif text-brand-ink mb-4 italic">Nenhum profissional encontrado</h2>
            <p className="text-brand-stone text-sm font-light mb-8 max-w-xs mx-auto">
              Tente ajustar seus filtros ou pesquisar por outra cidade.
            </p>
            <button 
              onClick={() => {
                setCityFilter('');
                setSpecialtyFilter('');
                setModeFilter('all');
                setRatingFilter(0);
              }}
              className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta hover:underline"
            >
              Limpar todos os filtros
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <AnimatePresence>
              {professionals.map((pro, idx) => (
                <motion.div
                  key={pro.uid}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx % 4 * 0.1 }}
                  className="group bg-brand-white rounded-[32px] border border-brand-mist overflow-hidden hover:border-brand-terracotta/30 transition-all hover:shadow-xl hover:shadow-brand-ink/5"
                >
                  <div className="aspect-square relative overflow-hidden">
                    <img 
                      src={pro.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&h=400&auto=format&fit=crop'} 
                      alt={pro.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-brand-ink/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    {pro.planRank && pro.planRank >= 1 && (
                      <div className="absolute top-4 left-4 bg-brand-terracotta text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-sm bg-opacity-90">
                        <Star size={8} fill="currentColor" /> Verificada
                      </div>
                    )}

                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                      {pro.averageRating && pro.averageRating > 0 && (
                        <div className="bg-brand-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-sm">
                          <div className="flex items-center gap-1 text-brand-terracotta">
                            <Star size={10} fill="currentColor" />
                            <span className="text-[10px] font-black">{pro.averageRating.toFixed(1)}</span>
                            <span className="text-[9px] text-brand-mist font-medium">({pro.totalReviews || 0})</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="mb-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-terracotta mb-1">
                        {pro.professionalIdentity?.mainSpecialty || pro.specialty}
                      </p>
                      <h3 className="text-xl font-serif text-brand-ink italic truncate">{pro.name}</h3>
                      <div className="flex items-center gap-1 text-brand-stone text-[10px] mt-1">
                        <MapPin size={10} />
                        <span className="truncate">{pro.neighborhood}, {pro.city}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {(pro.professionalIdentity?.differentials || ['Atendimento VIP', 'Pontualidade']).slice(0, 3).map(tag => (
                        <span key={tag} className="px-2 py-1 bg-brand-linen text-brand-stone text-[8px] font-bold uppercase tracking-widest rounded-md">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <Link 
                      to={`/p/${pro.slug}`}
                      className="w-full flex items-center justify-between px-5 py-4 bg-brand-ink text-brand-white rounded-2xl text-[10px] font-bold uppercase tracking-widest group/btn hover:bg-brand-espresso transition-all"
                    >
                      <span>Ver Agenda</span>
                      <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {hasMore && !loading && (
          <div className="mt-16 text-center">
            <button 
              onClick={() => {
                setPage(p => p + 1);
                fetchProfessionals(true);
              }}
              className="bg-brand-linen text-brand-ink px-10 py-4 rounded-full text-[11px] font-bold uppercase tracking-widest border border-brand-mist hover:bg-brand-parchment transition-all"
            >
              Carregar mais profissionais
            </button>
          </div>
        )}
      </main>

      {/* Mobile Filters Side Panel */}
      <AnimatePresence>
        {showMobileFilters && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileFilters(false)}
              className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-[85%] max-w-sm bg-brand-white z-[70] p-8 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-serif text-brand-ink italic">Filtros</h3>
                <button onClick={() => setShowMobileFilters(false)} className="p-2 text-brand-stone">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone mb-3 block">Localização</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist" />
                    <input 
                      type="text"
                      placeholder="Sua cidade..."
                      value={cityFilter}
                      onChange={(e) => setCityFilter(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 bg-brand-parchment border border-brand-mist rounded-2xl text-sm outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone mb-3 block">Especialidade</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SPECIALTIES.map(s => (
                      <button
                        key={s}
                        onClick={() => setSpecialtyFilter(s === specialtyFilter ? '' : s)}
                        className={cn(
                          "px-4 py-3 rounded-xl text-[10px] font-bold border transition-all",
                          specialtyFilter === s 
                            ? "bg-brand-ink border-brand-ink text-white" 
                            : "bg-brand-parchment border-brand-mist text-brand-stone"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone mb-3 block">Modalidade</label>
                  <div className="space-y-2">
                    {SERVICE_MODES.map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => setModeFilter(mode.id)}
                        className={cn(
                          "w-full px-5 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center justify-between",
                          modeFilter === mode.id 
                            ? "bg-brand-linen border-brand-ink text-brand-ink" 
                            : "bg-brand-white border-brand-mist text-brand-stone"
                        )}
                      >
                        {mode.label}
                        {mode.id === 'home' && <Home size={14} />}
                        {mode.id === 'studio' && <Building2 size={14} />}
                        {mode.id === 'hybrid' && <LayoutGrid size={14} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone mb-3 block">Avaliação Mínima</label>
                  <div className="flex gap-2">
                    {[4, 3, 2, 1].map(r => (
                      <button
                        key={r}
                        onClick={() => setRatingFilter(r)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 py-4 rounded-xl border text-[10px] font-bold transition-all",
                          ratingFilter === r 
                            ? "bg-brand-terracotta border-brand-terracotta text-white" 
                            : "bg-brand-parchment border-brand-mist text-brand-stone"
                        )}
                      >
                        {r}+ <Star size={10} fill="currentColor" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <button 
                  onClick={() => setShowMobileFilters(false)}
                  className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-bold uppercase tracking-widest"
                >
                  Ver Resultados
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
