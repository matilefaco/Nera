import React, { useState } from "react";
import { motion } from "motion/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import {
  User as UserIcon,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  LogOut,
  Gift,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { notify } from "../lib/notify";
import { toast } from "sonner";
import {
  generateSlug,
  getHumanError,
  generateReferralCode,
  cn,
} from "../lib/utils";
import Logo from "../components/Logo";

export default function RegisterPage() {
  const { user: currentUser, profile } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [manualReferralCode, setManualReferralCode] = useState(() => {
    const refFromUrl = searchParams.get("ref");
    if (refFromUrl) {
      const normalized = refFromUrl.trim().toUpperCase().replace(/\s+/g, "");
      sessionStorage.setItem("nera_referred_by", normalized);
      return normalized;
    }
    const saved = sessionStorage.getItem("nera_referred_by");
    return saved ? saved.trim().toUpperCase().replace(/\s+/g, "") : "";
  });
  const [activePlan, setActivePlan] = useState<"free" | "essencial" | "pro">(
    (searchParams.get("plan") as any) || "free",
  );

  const handlePostRegisterCheckout = async (user: User, email: string) => {
    if (activePlan === "free") {
      navigate("/onboarding");
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/plans/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: activePlan,
          professionalId: user.uid,
          email: email,
        }),
      });

      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        const errorMsg =
          data.details ||
          data.error ||
          "Erro ao iniciar checkout do plano selecionado.";
        console.error("[SIGNUP FLOW ERROR] Server response:", errorMsg);
        notify.error(errorMsg, undefined, { duration: 6000 });
        navigate("/onboarding");
      }
    } catch (err: any) {
      console.error("[SIGNUP FLOW FETCH ERROR]:", err);
      notify.error(err, "Erro de conexão ao iniciar checkout.");
      navigate("/onboarding");
    }
  };

  const handleGoogleRegister = async () => {
    if (!acceptedTerms) {
      notify.error(
        "Para criar sua conta, é preciso aceitar os Termos de Uso e a Política de Privacidade.",
      );
      return;
    }
    setLoading(true);
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const token = await user.getIdToken();
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: user.displayName || "",
          email: user.email || "",
          referredBy: manualReferralCode.trim().toUpperCase().replace(/\s+/g, ""),
        }),
      });

      if (!response.ok) {
        let errData: any = {};
        try {
          errData = await response.json();
        } catch (e) {}

        if (response.status === 409 || errData.code === "USER_ALREADY_EXISTS") {
          console.log("[SIGNUP FLOW] User already exists in Firestore (idempotent Google login/register).");
        } else {
          throw new Error(errData.error || "Erro ao registrar perfil no servidor.");
        }
      }

      notify.success("Que prazer ter você conosco! Bem-vinda à Nera.", {
        icon: <Sparkles className="text-brand-terracotta" size={18} />,
      });

      await handlePostRegisterCheckout(user, user.email || "");
    } catch (error: any) {
      console.error("[SIGNUP FLOW] Fatal error:", error);
      notify.error(error, "Não foi possível criar sua conta.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!acceptedTerms) {
      notify.error(
        "Para criar sua conta, é preciso aceitar os Termos de Uso e a Política de Privacidade.",
      );
      return;
    }

    setLoading(true);

    try {
      if (auth.currentUser) {
        await signOut(auth);
      }

      if (password.length < 6) {
        notify.error("Use uma senha com pelo menos 6 caracteres.");
        setLoading(false);
        return;
      }

      // 1. Create user in Firebase Auth via Client SDK first to avoid ADC issues in preview
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      // Update basic profile
      await updateProfile(user, { displayName: name });

      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            name,
            email,
            referredBy: manualReferralCode.trim().toUpperCase().replace(/\s+/g, ""),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (response.status === 409 || data.code === "USER_ALREADY_EXISTS") {
            console.log("[SIGNUP FLOW] User already exists in Firestore (idempotent email signup).");
            toast.success("Tudo certo! Criando seu perfil...");
          } else {
            throw new Error(data.error || data.message || "Erro ao registrar perfil no servidor.");
          }
        } else if (data.code === "VERIFICATION_EMAIL_FAILED") {
          toast.warning(
            data.message ||
              "Sua conta foi criada, mas não conseguimos enviar o e-mail agora. Tente reenviar em instantes.",
          );
        } else {
          toast.success("Tudo certo! Criando seu perfil...");
        }
      } catch (fetchErr: any) {
        console.error("[SIGNUP FLOW] Backend registration failed:", fetchErr);
        toast.error(fetchErr.message || "Erro ao finalizar o cadastro no servidor. Por favor, tente novamente.");
        return;
      }

      // 3. Handle Plan Checkout if applicable
      if (user && activePlan !== "free") {
        await handlePostRegisterCheckout(user, email);
        return;
      }

      // 4. Redirect to verification landing
      navigate("/verificar-email");
    } catch (error: any) {
      console.error("[SIGNUP FLOW] Manual registration error:", {
        errorCode: error?.code,
        message: error?.message,
      });
      // Handle Firebase Client Errors
      if (error.code === "auth/email-already-in-use") {
        toast.error(
          "Esse e-mail já está cadastrado. Entre na sua conta ou use outro e-mail.",
        );
      } else if (error.code === "auth/invalid-email") {
        toast.error("Digite um e-mail válido.");
      } else if (error.code === "auth/weak-password") {
        toast.error("Use uma senha com pelo menos 6 caracteres.");
      } else if (error.code === "auth/network-request-failed") {
        toast.error(
          "Não foi possível conectar agora. Verifique sua internet e tente novamente.",
        );
      } else {
        toast.error(
          `Falha no cadastro: ${error?.message || "Erro desconhecido"}`,
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAndStay = async () => {
    await signOut(auth);
    notify.success("Até breve!");
  };

  return (
    <div className="min-h-screen bg-brand-parchment flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 border border-brand-ink rounded-full" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] border border-brand-ink rounded-full" />
      </div>

      <Link to="/" className="mb-12">
        <Logo className="scale-110" />
      </Link>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-2xl relative"
      >
        {currentUser && !loading && (
          <div className="absolute inset-0 z-50 bg-brand-white/95 backdrop-blur-sm rounded-[40px] flex flex-col items-center justify-center p-10 text-center">
            <div className="w-20 h-20 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-6">
              <LogOut size={32} />
            </div>
            <h3 className="text-2xl font-serif font-normal text-brand-ink mb-4">
              Você já está conectada
            </h3>
            <p className="text-brand-stone text-sm mb-8 leading-relaxed font-light">
              Para criar uma nova vitrine, você precisa sair da conta atual (
              {profile?.name || currentUser.displayName || currentUser.email}).
            </p>
            <div className="flex flex-col w-full gap-3">
              <button
                onClick={handleLogoutAndStay}
                className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all"
              >
                Sair e criar nova conta
              </button>
              <Link
                to="/dashboard"
                className="w-full bg-brand-linen text-brand-ink py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-mist transition-all text-center"
              >
                Ir para meu Painel
              </Link>
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <h2 className="text-3xl font-serif font-normal text-brand-ink mb-3">
            Crie sua presença profissional
          </h2>
          <p className="text-brand-stone text-sm font-light">
            Comece no Gratuito ou teste o Essencial por 15 dias. Você pode mudar
            de plano quando quiser.
          </p>
        </div>

        {/* Plan Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
          {/* FREE */}
          <button
            type="button"
            onClick={() => setActivePlan("free")}
            className={cn(
              "flex flex-col p-4 rounded-[24px] border transition-all text-left group",
              activePlan === "free"
                ? "bg-brand-linen border-brand-ink ring-1 ring-brand-ink"
                : "bg-white border-brand-mist hover:border-brand-stone",
            )}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-stone group-hover:text-brand-ink transition-colors">
                Gratuito
              </span>
            </div>
            <p className="text-[11px] text-brand-stone font-light leading-snug mb-3">
              Para criar sua vitrine e começar no seu ritmo.
            </p>
            <div className="mt-auto pt-2 border-t border-brand-mist/50">
              <span className="text-lg font-serif text-brand-ink">R$0</span>
            </div>
          </button>

          {/* ESSENCIAL */}
          <button
            type="button"
            onClick={() => setActivePlan("essencial")}
            className={cn(
              "flex flex-col p-4 rounded-[24px] border transition-all text-left group relative overflow-hidden",
              activePlan === "essencial"
                ? "bg-brand-linen bg-[#F8F5F2] border-brand-terracotta ring-1 ring-brand-terracotta"
                : "bg-white border-brand-mist hover:border-brand-stone",
            )}
          >
            <div className="absolute top-0 right-0 bg-brand-terracotta text-white text-[8px] font-bold uppercase tracking-tighter px-2 py-1 rounded-bl-lg">
              15 dias grátis
            </div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta">
                Essencial
              </span>
            </div>
            <p className="text-[11px] text-brand-stone font-light leading-snug mb-3">
              Agenda ilimitada, bloqueios de horário e experiência profissional
              por e-mail.
            </p>
            <div className="mt-auto pt-2 border-t border-brand-mist/50">
              <span className="text-lg font-serif text-brand-ink">
                R$49<span className="text-[10px] text-brand-stone">/mês</span>
              </span>
              <p className="text-[8px] text-brand-mist uppercase tracking-widest font-medium mt-1 leading-none">
                Cartão obrigatório · cancele quando quiser
              </p>
            </div>
          </button>

          {/* PRO */}
          <button
            type="button"
            onClick={() => setActivePlan("pro")}
            className={cn(
              "flex flex-col p-4 rounded-[24px] border transition-all text-left group",
              activePlan === "pro"
                ? "bg-brand-linen border-brand-ink ring-1 ring-brand-ink"
                : "bg-white border-brand-mist hover:border-brand-stone",
            )}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">
                Pro
              </span>
            </div>
            <p className="text-[11px] text-brand-stone font-light leading-snug mb-3">
              Para crescer com WhatsApp, lista de espera, cupons e recursos
              avançados.
            </p>
            <div className="mt-auto pt-2 border-t border-brand-mist/50">
              <span className="text-lg font-serif text-brand-ink">
                R$89<span className="text-[10px] text-brand-stone">/mês</span>
              </span>
              <p className="text-[8px] text-brand-mist uppercase tracking-widest font-medium mt-1 leading-none">
                Plano completo da Nera
              </p>
            </div>
          </button>
        </div>

        <form onSubmit={handleRegister} className="space-y-5 mb-10">
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
              Seu Nome
            </label>
            <div className="relative">
              <UserIcon
                className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist"
                size={18}
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Qual o seu nome profissional?"
                className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] focus:ring-1 focus:ring-brand-ink outline-none transition-all text-brand-ink font-light"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
              Seu E-mail
            </label>
            <div className="relative">
              <Mail
                className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist"
                size={18}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@estudio.com"
                className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] focus:ring-1 focus:ring-brand-ink outline-none transition-all text-brand-ink font-light"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
              Crie uma Senha
            </label>
            <div className="relative">
              <Lock
                className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist"
                size={18}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="No mínimo 6 caracteres"
                className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] focus:ring-1 focus:ring-brand-ink outline-none transition-all text-brand-ink font-light"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">
              Código de Indicação (Opcional)
            </label>
            <div className="relative">
              <Gift
                className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist"
                size={18}
              />
              <input
                type="text"
                value={manualReferralCode}
                onChange={(e) =>
                  setManualReferralCode(e.target.value.toUpperCase())
                }
                placeholder="Ex: MARI2A"
                className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] focus:ring-1 focus:ring-brand-ink outline-none transition-all text-brand-ink font-light uppercase"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 py-2">
            <input
              type="checkbox"
              id="acceptedTerms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-brand-mist text-brand-terracotta focus:ring-brand-terracotta cursor-pointer"
            />
            <label
              htmlFor="acceptedTerms"
              className="text-[11px] text-brand-stone leading-relaxed cursor-pointer select-none"
            >
              Li e aceito os{" "}
              <Link
                to="/termos"
                target="_blank"
                className="text-brand-terracotta font-medium hover:underline"
              >
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link
                to="/privacidade"
                target="_blank"
                className="text-brand-terracotta font-medium hover:underline"
              >
                Política de Privacidade
              </Link>{" "}
              da Nera.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !acceptedTerms}
            className="w-full bg-brand-terracotta text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-sienna transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
          >
            {loading
              ? "Preparando seu perfil..."
              : activePlan === "essencial"
                ? "Ativar teste do Essencial"
                : activePlan === "pro"
                  ? "Começar como Pro"
                  : "Criar conta grátis"}{" "}
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="relative mb-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-mist"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
            <span className="bg-brand-white px-4 text-brand-mist font-medium">
              Ou continue com
            </span>
          </div>
        </div>

        <button
          onClick={handleGoogleRegister}
          disabled={loading || !acceptedTerms}
          className="w-full bg-brand-white border border-brand-mist text-brand-ink py-4 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all flex items-center justify-center gap-4 disabled:opacity-50"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5"
          />
          Continuar com Google
        </button>

        <p className="text-center mt-10 text-sm text-brand-stone font-light">
          Já tem uma conta?{" "}
          <Link
            to="/login"
            className="text-brand-terracotta font-medium hover:underline"
          >
            Fazer login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
