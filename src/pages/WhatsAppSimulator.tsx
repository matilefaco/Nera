import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, RefreshCcw, Search, ShieldAlert, Smartphone, Send, CheckCircle2, AlertCircle, Loader2, TestTube2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import PremiumButton from '../components/PremiumButton';
import { db } from '../firebase';
import { notify } from '../lib/notify';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

const EVENT_TYPES = [
  { id: 'NEW_BOOKING', label: 'Novo Pedido', icon: MessageSquare },
  { id: 'CONFIRMED', label: 'Confirmação', icon: CheckCircle2 },
  { id: 'CANCELLED', label: 'Cancelamento', icon: AlertCircle },
  { id: 'REMINDER_24H', label: 'Lembrete 24h', icon: Smartphone },
  { id: 'REMINDER_2H', label: 'Lembrete 2h', icon: Smartphone },
  { id: 'REVIEW', label: 'Avaliação', icon: TestTube2 },
];

export default function WhatsAppSimulator() {
  const [phone, setPhone] = useState('');
  const [inboundMsg, setInboundMsg] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [inboundLogs, setInboundLogs] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);

  // Subscribe to logs
  React.useEffect(() => {
    const qOut = query(
      collection(db, 'whatsapp_logs'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubOut = onSnapshot(qOut, (snap) => {
      try {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => { console.error("Firestore onSnapshot error:", error); });

    const qIn = query(
      collection(db, 'whatsapp_inbound_logs'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubIn = onSnapshot(qIn, (snap) => {
      try {
        setInboundLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error in onSnapshot callback:", err);
      }
    }, (error) => { console.error("Firestore onSnapshot error:", error); });

    return () => {
      unsubOut();
      unsubIn();
    };
  }, []);

  const triggerTest = async (type: string) => {
    if (!phone) return notify.warning('Insira um número de WhatsApp');
    setLoading(type);
    setResult(null);

    try {
      const res = await fetch(`/api/test-whatsapp?phone=${phone}&type=${type}`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setResult({ success: false, error: 'Erro na chamada de API' });
    } finally {
      setLoading(null);
    }
  };

  const simulateInbound = async () => {
    if (!phone || !inboundMsg) return notify.warning('Insira telefone e mensagem');
    setLoading('inbound');
    setResult(null);

    try {
      const res = await fetch(`/api/test-whatsapp?phone=${phone}&message=${encodeURIComponent(inboundMsg)}&simulateInbound=true`);
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setResult({ success: false, error: 'Erro na simulação' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="mb-12 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-all">
            <ArrowLeft size={14} /> Painel
          </Link>
          <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full border border-amber-100">
            <ShieldAlert size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Ambiente de Simulação</span>
          </div>
        </div>

        <header className="mb-12">
          <h1 className="text-4xl font-serif text-brand-ink mb-4 italic">WhatsApp Simulator</h1>
          <p className="text-brand-stone text-sm font-light">
            Valide a experiência da cliente simulando disparos automáticos. <br/>
            Nenhuma reserva real será afetada.
          </p>
        </header>

        <section className="bg-white rounded-[40px] border border-brand-mist shadow-sm overflow-hidden mb-12">
          <div className="p-10 border-b border-brand-mist">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-ink block mb-3">WhatsApp de Teste</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: 5585999999999"
                    className="w-full bg-brand-parchment/50 border border-brand-mist rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-terracotta/20"
                  />
                  <Smartphone className="absolute right-6 top-1/2 -translate-y-1/2 text-brand-mist" size={20} />
                </div>
                <p className="text-[9px] text-brand-stone uppercase tracking-tight mt-3">Use o formato DDI + DDD + NÚMERO (Ex: 55859...)</p>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-brand-ink block mb-3">Simular Mensagem Recebida</label>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={inboundMsg}
                    onChange={(e) => setInboundMsg(e.target.value)}
                    placeholder="Ex: 1, sim, quero cancelar..."
                    className="flex-1 bg-brand-parchment/50 border border-brand-mist rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-terracotta/20"
                  />
                  <button 
                    onClick={simulateInbound}
                    disabled={loading !== null}
                    className="bg-brand-ink text-white px-6 rounded-2xl hover:bg-brand-ink/90 transition-colors disabled:opacity-50"
                  >
                    {loading === 'inbound' ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                  </button>
                </div>
                <p className="text-[9px] text-brand-stone uppercase tracking-tight mt-3">Teste como o sistema interpreta as respostas</p>
              </div>
            </div>
          </div>

          <div className="p-10">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone">Disparos Outbound (Simular Eventos)</h3>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {EVENT_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => triggerTest(type.id)}
                  disabled={loading !== null}
                  className="flex flex-col items-center justify-center p-6 rounded-3xl border border-brand-mist hover:border-brand-terracotta hover:bg-brand-parchment/50 transition-all group relative overflow-hidden"
                >
                  {loading === type.id ? (
                    <Loader2 className="animate-spin text-brand-terracotta mb-3" size={24} />
                  ) : (
                    <Icon className="text-brand-stone group-hover:text-brand-terracotta mb-3 transition-colors" size={24} />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-3xl mb-12 border ${result.success ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}
          >
            <div className="flex items-center gap-3">
              {result.success ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest">{result.success ? 'Mensagem disparada com sucesso' : 'Falha no disparo'}</p>
                {result.error && <p className="text-xs mt-1 opacity-80">{result.error}</p>}
                {result.logId && <p className="text-[9px] mt-1 opacity-60">Log: {result.logId}</p>}
              </div>
            </div>
          </motion.div>
        )}

        <section className="grid md:grid-cols-2 gap-12">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-stone">Outbound Logs</h2>
              <button className="text-brand-mist hover:text-brand-ink transition-colors">
                <RefreshCcw size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {logs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-brand-mist rounded-[40px]">
                  <p className="text-[10px] text-brand-mist uppercase tracking-widest">Vazio</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="bg-white p-6 rounded-3xl border border-brand-mist shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-brand-ink">{log.type}</span>
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${log.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs text-brand-stone italic font-light mb-2 line-clamp-2">"{log.message}"</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-brand-mist uppercase tracking-tight">{log.phone}</span>
                      <span className="text-[8px] text-brand-mist uppercase tracking-tight">
                        {log.createdAt?.toDate?.()?.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-stone">Inbound Logs (Respostas)</h2>
              <button className="text-brand-mist hover:text-brand-ink transition-colors">
                <RefreshCcw size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {inboundLogs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-brand-mist rounded-[40px]">
                  <p className="text-[10px] text-brand-mist uppercase tracking-widest">Vazio</p>
                </div>
              ) : (
                inboundLogs.map((log) => (
                  <div key={log.id} className="bg-brand-parchment/30 p-6 rounded-3xl border border-brand-mist shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare size={12} className="text-brand-ink" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-brand-ink">{log.intent}</span>
                      </div>
                      <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${log.status === 'processed' ? 'bg-indigo-100 text-indigo-700' : 'bg-brand-mist text-brand-stone'}`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs text-brand-ink font-medium mb-2">"{log.rawMessage}"</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-brand-stone uppercase tracking-tight">{log.phone}</span>
                      <span className="text-[8px] text-brand-stone uppercase tracking-tight">
                        {log.createdAt?.toDate?.()?.toLocaleTimeString()}
                      </span>
                    </div>
                    {log.appointmentId && (
                      <div className="mt-3 pt-3 border-t border-brand-mist flex items-center justify-between">
                        <span className="text-[8px] font-bold uppercase text-brand-stone">Agendamento:</span>
                        <span className="text-[8px] font-mono text-brand-mist">{log.appointmentId.substring(0, 8)}...</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
