import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { WhatsAppLog } from '../types';
import { 
  MessageSquare, 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Search,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const WhatsAppHistoryPage: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'whatsapp_logs'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const logsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as WhatsAppLog[];
setLogs(logsData);
setLoading(false);
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => {
      console.error("Error fetching logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredLogs = logs.filter(log => 
    (log.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     log.phone.includes(searchTerm) ||
     log.messageType?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-gray-400 animate-pulse" />;
      default: return null;
    }
  };

  const getFriendlyType = (type?: string) => {
    switch (type) {
      case 'professional_new_booking': return 'Nova Reserva (Pro)';
      case 'booking_rejected': return 'Reserva Rejeitada';
      case 'booking_cancelled_pro': return 'Cancelamento (Pro)';
      case 'booking_cancelled_client': return 'Cancelamento (Cliente)';
      case 'booking_confirmed_client': return 'Confirmação';
      case 'reminder_24h_client': return 'Lembrete 24h';
      case 'reminder_2h': return 'Lembrete 2h';
      case 'review_request': return 'Pedido de Avaliação';
      case 'meta_official': return 'Oficial Meta';
      default: return type || 'Automática';
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return format(date, "dd MMM, HH:mm", { locale: ptBR });
  };

  return (
    <div className="min-h-screen bg-brand-background pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-brand-white/80 backdrop-blur-md z-30 border-b border-brand-mist/50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          <button 
            onClick={() => window.history.back()}
            className="p-2 hover:bg-brand-mist rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-brand-dark" />
          </button>
          <h1 className="text-lg font-serif font-bold text-brand-dark">Histórico de WhatsApp</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-brand-white p-4 rounded-3xl border border-brand-mist/50 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Total</p>
            <p className="text-xl font-bold text-brand-dark">{logs.length}</p>
          </div>
          <div className="bg-brand-white p-4 rounded-3xl border border-brand-mist/50 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-green-500 font-bold mb-1">Enviados</p>
            <p className="text-xl font-bold text-brand-dark">{logs.filter(l => l.status === 'sent').length}</p>
          </div>
          <div className="bg-brand-white p-4 rounded-3xl border border-brand-mist/50 shadow-sm">
            <p className="text-[10px] uppercase tracking-wider text-red-500 font-bold mb-1">Falhas</p>
            <p className="text-xl font-bold text-brand-dark">{logs.filter(l => l.status === 'failed').length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text"
            placeholder="Buscar por cliente ou tipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-brand-white border border-brand-mist rounded-[24px] focus:ring-2 focus:ring-brand-purple outline-none shadow-sm transition-all"
          />
        </div>

        {/* Logs List */}
        <div className="bg-brand-white rounded-[32px] border border-brand-mist/50 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-400">
              <Clock className="w-8 h-8 animate-spin mb-4" />
              <p>Carregando histórico...</p>
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="divide-y divide-brand-mist/30">
              <AnimatePresence mode="popLayout">
                {filteredLogs.map((log) => (
                  <motion.div 
                    key={log.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 hover:bg-brand-mist/20 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${log.status === 'sent' ? 'bg-green-50' : log.status === 'failed' ? 'bg-red-50' : 'bg-gray-50'}`}>
                          {getStatusIcon(log.status)}
                        </div>
                        <div>
                          <h3 className="font-bold text-brand-dark leading-tight">
                            {log.clientName || 'Cliente'}
                          </h3>
                          <p className="text-xs text-gray-400 font-medium">
                            {formatDate(log.createdAt)} • {getFriendlyType(log.messageType)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                          log.status === 'sent' ? 'text-green-600 bg-green-50' : 
                          log.status === 'failed' ? 'text-red-600 bg-red-50' : 
                          'text-gray-400 bg-gray-50'
                        }`}>
                          {log.status === 'sent' ? 'Enviado' : log.status === 'failed' ? 'Falha' : 'Pendente'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-brand-mist/30 rounded-2xl p-4 text-sm text-gray-600 font-medium line-clamp-3 group-hover:line-clamp-none transition-all cursor-pointer">
                      {log.message}
                    </div>

                    {log.error && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600 font-mono">
                        Erro: {log.error}
                      </div>
                    )}
                    
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-[11px] text-gray-400 font-mono">{log.phone}</p>
                      {log.appointmentId && (
                        <button className="text-[11px] text-brand-purple font-bold flex items-center gap-1 hover:underline">
                          Ver Agendamento <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-brand-mist rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-bold text-brand-dark mb-2">Nenhum log encontrado</h3>
              <p className="text-sm text-gray-500 max-w-[240px]">
                As mensagens automáticas serão listadas aqui assim que forem disparadas.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default WhatsAppHistoryPage;
