import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { applyActionCode } from 'firebase/auth';
import { auth } from '../firebase';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, Loader2, Mail, ArrowRight } from 'lucide-react';
import Logo from '../components/Logo';

type ActionStatus = 'loading' | 'success' | 'error';

export default function AuthActionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ActionStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');
  const continueUrl = searchParams.get('continueUrl');

  useEffect(() => {
    if (!mode || !oobCode) {
      setStatus('error');
      setErrorMsg('Link de ação inválido ou incompleto.');
      return;
    }

    if (mode === 'verifyEmail') {
      handleVerifyEmail(oobCode).catch(err => {
        console.error('[AuthActionPage] Uncaught error in verification handler:', err);
      });
    } else {
      setStatus('error');
      setErrorMsg('Este tipo de ação ainda não é suportado por este link.');
    }
  }, [mode, oobCode]);

  const handleVerifyEmail = async (code: string) => {
    try {
      await applyActionCode(auth, code);
      setStatus('success');
      
      // We can try to reload the user if they are logged in
      if (auth.currentUser) {
        await auth.currentUser.reload();
      }
    } catch (err: any) {
      console.error('[AuthActionPage] Error applying action code:', err);
      setStatus('error');
      
      if (err.code === 'auth/expired-action-code') {
        setErrorMsg('Este link de confirmação expirou.');
      } else if (err.code === 'auth/invalid-action-code') {
        setErrorMsg('Este link de confirmação é inválido ou já foi utilizado.');
      } else {
        setErrorMsg('Ocorreu um erro ao confirmar seu e-mail. Tente novamente mais tarde.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-brand-parchment flex flex-col items-center justify-center p-6 text-brand-ink">
      <Link to="/" className="mb-12">
        <Logo className="scale-110" />
      </Link>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-2xl text-center"
      >
        {status === 'loading' && (
          <div className="py-10">
            <Loader2 className="w-12 h-12 text-brand-terracotta animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-serif mb-2">Confirmando seu e-mail</h2>
            <p className="text-brand-stone font-light">Aguarde um instante enquanto validamos sua conta.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6">
            <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6 mx-auto">
              <CheckCircle size={40} />
            </div>
            <h2 className="text-2xl font-serif mb-4">E-mail verificado com sucesso!</h2>
            <p className="text-brand-stone font-light mb-10 leading-relaxed">
              Sua conta na Nera foi ativada. Agora você pode acessar sua agenda e construir sua vitrine profissional.
            </p>
            
            <Link 
              to={continueUrl || '/dashboard'}
              className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3"
            >
              Continuar para a Nera <ArrowRight size={18} />
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 mx-auto">
              <XCircle size={40} />
            </div>
            <h2 className="text-2xl font-serif mb-4">Ops! Algo deu errado</h2>
            <p className="text-brand-stone font-light mb-10 leading-relaxed">
              {errorMsg}
            </p>
            
            <div className="flex flex-col gap-4">
              <Link 
                to="/verificar-email"
                className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3"
              >
                Reenviar e-mail <Mail size={18} />
              </Link>
              <Link 
                to="/login"
                className="text-[10px] font-medium text-brand-stone uppercase tracking-widest hover:text-brand-terracotta transition-colors"
              >
                Voltar para o Login
              </Link>
            </div>
          </div>
        )}
      </motion.div>

      <p className="mt-12 text-[10px] text-brand-stone font-light uppercase tracking-widest">
        Nera · Excelência Profissional
      </p>
    </div>
  );
}
