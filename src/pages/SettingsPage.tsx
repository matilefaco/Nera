import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Key, CreditCard, ChevronRight, User, Monitor, Trash2, Palette, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { notify } from '../lib/notify';

export default function SettingsPage() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const { user, profile } = useAuth();

  const sections = [
    {
      title: 'Segurança',
      items: [
        {
          id: 'password',
          label: 'Trocar Senha',
          description: 'Atualize sua credencial de acesso com segurança.',
          icon: Key,
          path: '/trocar-senha'
        },
        {
          id: 'sessions',
          label: 'Sessões e acesso',
          description: 'Veja dispositivos conectados e proteja sua conta.',
          icon: Monitor,
          comingSoon: true
        }
      ]
    },
    {
      title: 'Conta',
      items: [
        {
          id: 'profile',
          label: 'Dados do Perfil',
          description: 'Atualize seu nome, bio e foto.',
          icon: User,
          path: '/profile'
        },
        {
          id: 'delete-account',
          label: 'Solicitar exclusão da conta',
          description: 'Peça a remoção da sua conta com segurança.',
          icon: Trash2,
          isDestructive: true,
          onClick: () => setShowDeleteModal(true)
        }
      ]
    },
    {
      title: 'Plano e Cobrança',
      items: [
        {
          id: 'plan',
          label: 'Assinatura Nera',
          description: 'Gerencie seu plano atual e pagamentos.',
          icon: CreditCard,
          path: '/planos'
        }
      ]
    },
    {
      title: 'Preferências',
      items: [
        {
          id: 'appearance',
          label: 'Aparência da conta',
          description: 'Ajustes visuais e preferências da experiência Nera.',
          icon: Palette,
          comingSoon: true
        }
      ]
    }
  ];

  useEffect(() => {
    async function checkExistingRequest() {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'accountDeletionRequests'),
          where('userId', '==', user.uid),
          where('status', '==', 'pending'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setHasRequested(true);
        }
      } catch (err) {
        console.error('[Settings] Error checking deletion requests:', err);
      }
    }
    checkExistingRequest();
  }, [user]);

  const handleRequestDeletion = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      // Final check for duplicates before writing
      const q = query(
        collection(db, 'accountDeletionRequests'),
        where('userId', '==', user.uid),
        where('status', '==', 'pending'),
        limit(1)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        setHasRequested(true);
        notify.info('Você já possui uma solicitação em análise.');
        setShowDeleteModal(false);
        return;
      }

      await addDoc(collection(db, 'accountDeletionRequests'), {
        userId: user.uid,
        email: user.email,
        displayName: profile?.name || user.displayName || null,
        status: 'pending',
        createdAt: serverTimestamp(),
        source: 'settings_page'
      });

      setHasRequested(true);
      notify.success('Solicitação recebida com sucesso.');
      setShowDeleteModal(false);
    } catch (err) {
      console.error('[Settings] Error requesting deletion:', err);
      notify.error('Não conseguimos enviar sua solicitação agora. Tente novamente em alguns instantes.');
      handleFirestoreError(err, OperationType.CREATE, 'accountDeletionRequests');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout activeRoute="settings">
      <div className="p-6 md:p-12 pb-32 md:pb-12 max-w-3xl mx-auto w-full">
        <header className="mb-10 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-serif font-normal text-brand-ink mb-3">Configurações</h1>
          <p className="text-sm text-brand-stone font-light">Ajuste preferências da sua conta e da experiência na Nera.</p>
        </header>

        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title} className="space-y-4">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone px-2">
                {section.title}
              </h2>
              <div className="bg-white border border-brand-mist rounded-2xl overflow-hidden shadow-sm">
                {section.items.map((item, idx) => {
                  const content = (
                    <div 
                      onClick={item.onClick}
                      className="flex items-center gap-4 p-5 w-full text-left transition-colors hover:bg-brand-parchment/30 cursor-pointer"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                        item.isDestructive 
                          ? 'bg-red-50 text-red-500 border-red-100' 
                          : 'bg-brand-linen text-brand-terracotta border-brand-terracotta/10'
                      }`}>
                        <item.icon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-semibold ${item.isDestructive ? 'text-red-600' : 'text-brand-ink'}`}>
                            {item.label}
                          </h3>
                          {item.comingSoon && (
                            <span className="px-1.5 py-0.5 bg-brand-linen text-brand-stone text-[8px] font-bold uppercase tracking-wider rounded border border-brand-mist/50">
                              Breve
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-brand-stone font-light line-clamp-1">{item.description}</p>
                      </div>
                      {!item.comingSoon && <ChevronRight size={16} className={item.isDestructive ? 'text-red-200' : 'text-brand-mist'} />}
                    </div>
                  );

                  return (
                    <div key={item.id}>
                      {item.path ? (
                        <Link to={item.path}>
                          {content}
                        </Link>
                      ) : (
                        <div className={item.comingSoon ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}>
                          {content}
                        </div>
                      )}
                      {idx < section.items.length - 1 && (
                        <div className="h-px bg-brand-mist mx-5" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="pt-6 text-center">
            <p className="text-[10px] text-brand-stone italic font-light">
              Configurações avançadas serão liberadas aos poucos. Por enquanto, você já pode gerenciar sua conta, segurança e assinatura.
            </p>
          </div>
        </div>
      </div>

      {/* Delete Account Info Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-brand-ink/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-brand-mist"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center border border-red-100">
                    <AlertTriangle size={24} />
                  </div>
                  <button 
                    onClick={() => setShowDeleteModal(false)}
                    className="p-2 text-brand-stone hover:text-brand-ink transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <h3 className="text-xl font-serif text-brand-ink mb-4">Solicitar exclusão da conta</h3>
                <p className="text-sm text-brand-stone font-light leading-relaxed mb-8">
                  {hasRequested 
                    ? "Sua solicitação de exclusão já foi recebida e está em processamento. Nossa equipe entrará em contato em breve para concluir o processo com segurança."
                    : "Entendemos. A exclusão da sua conta será feita com cuidado para proteger seus dados, agenda e assinatura. Ao confirmar, nossa equipe receberá sua solicitação e entrará em contato para concluir o processo com segurança."}
                </p>

                <div className="flex flex-col gap-3">
                  {hasRequested ? (
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="w-full bg-brand-ink text-brand-white py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-md active:scale-[0.98]"
                    >
                      Entendi
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleRequestDeletion}
                        disabled={isDeleting}
                        className="w-full bg-red-600 text-brand-white py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isDeleting ? <RefreshCw size={16} className="animate-spin" /> : "Solicitar exclusão"}
                      </button>
                      <button
                        onClick={() => setShowDeleteModal(false)}
                        disabled={isDeleting}
                        className="w-full bg-brand-white text-brand-stone border border-brand-mist py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-brand-parchment transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
