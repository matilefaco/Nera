import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import {
  db,
  auth,
  storage,
  app,
  handleFirestoreError,
  OperationType,
  uploadImageToStorage,
  saveProfilePartial,
  savePortfolioItem,
  deletePortfolioItem,
} from "../firebase";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  uploadBytesResumable,
  uploadString,
} from "firebase/storage";
import {
  User,
  MapPin,
  Home,
  Building2,
  Briefcase,
  Clock,
  DollarSign,
  Instagram,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Camera,
  Plus,
  X,
  Globe,
  Copy,
  Share2,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { notify } from "../lib/notify";
import imageCompression from "browser-image-compression";
import {
  generateSlug,
  formatCurrency,
  cn,
  removeUndefinedDeep,
  getHumanError,
  cleanWhatsapp,
  buildWhatsappLink,
  formatWhatsappDisplay,
  isValidWhatsapp,
  normalizeInstagram,
  INSTAGRAM_REGEX,
} from "../lib/utils";
import Logo from "../components/Logo";
import AppLoadingScreen from "../components/AppLoadingScreen";
import { FormIdentity } from "../components/FormIdentity";
import { FormLocation } from "../components/FormLocation";
import { FormServices } from "../components/FormServices";
import { analyzePortfolio } from "../services/aiService";
import { OnboardingLivePreview } from "../components/OnboardingLivePreview";
import { ProfessionalIdentity, UserProfile, Service } from "../types";
import { userProfileSchema, serviceSchema } from "../lib/validation";
import { z } from "zod";
import { useProfileForm } from "../hooks/useProfileForm";
import { APP_URL, getPublicProfileUrl } from "../lib/env";
import { getNormalizedPaymentMethods } from "../lib/payment";
import { PROFESSIONAL_DIFFERENTIALS } from "../lib/differentials";

type ServiceMode = "home" | "studio" | "hybrid";

const IDENTITY_STYLES = [
  "Delicada e detalhista",
  "Rápida e eficiente",
  "Técnica e rigorosa",
  "Segura e estruturada",
  "Natural e leve",
];

const ONBOARDING_DIFFERENTIALS = PROFESSIONAL_DIFFERENTIALS;

const CopyLinkButton = ({ slug }: { slug: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(getPublicProfileUrl(slug));
    setCopied(true);
    notify.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex flex-col items-center gap-4 p-8 bg-brand-parchment rounded-[32px] border border-brand-mist hover:bg-brand-linen transition-all group"
    >
      <div className="w-12 h-12 bg-brand-white rounded-2xl flex items-center justify-center text-brand-ink border border-brand-mist group-hover:scale-110 transition-transform">
        {copied ? (
          <CheckCircle2 size={24} className="text-green-500" />
        ) : (
          <Copy size={24} />
        )}
      </div>
      <span className="text-[10px] font-medium uppercase tracking-widest">
        {copied ? "Copiado! ✓" : "Copiar Link"}
      </span>
    </button>
  );
};

const EXPERIENCE_OPTIONS = [
  { label: "1-2 anos", value: "1-2" },
  { label: "3-5 anos", value: "3-5" },
  { label: "5+ anos", value: "5+" },
];

const isDev =
  import.meta.env.DEV ||
  (typeof window !== "undefined" && window.location.hostname.includes("ais-"));
const devLog = (...args: any[]) => isDev && console.log(...args);

export default function OnboardingPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const TOTAL_STEPS = 3;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");

  const {
    name,
    setName,
    specialty,
    setSpecialty,
    subSpecialties,
    setSubSpecialties,
    bio,
    setBio,
    city,
    setCity,
    whatsapp,
    setWhatsapp,
    instagram,
    setInstagram,
    slug,
    setSlug,
    avatar,
    setAvatar,
    neighborhood,
    setNeighborhood,
    headline,
    setHeadline,
    serviceMode,
    setServiceMode,
    studioAddress,
    setStudioAddress,
    serviceAreas,
    setServiceAreas,
    serviceAreaType,
    setServiceAreaType,
    travelFeeMode,
    setTravelFeeMode,
    fixedTravelFee,
    setFixedTravelFee,
    pricingStrategy,
    setPricingStrategy,
    differentials: selectedDifferentials,
    setDifferentials: setSelectedDifferentials,
    paymentMethods,
    setPaymentMethods,
    acceptsInstallments,
    setAcceptsInstallments,
    yearsExperience,
    setYearsExperience,
    serviceStyle: selectedStyles,
    setServiceStyle: setSelectedStyles,
    workingDays,
    setWorkingDays,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    avatarSkipped,
    setAvatarSkipped,
    profileTheme,
    setProfileTheme,
  } = useProfileForm(profile);

  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [bioContext, setBioContext] = useState("");
  const [selectedBioStyle, setSelectedBioStyle] = useState("elegante");

  const handleGenerateBio = async () => {
    if (isGeneratingBio) return;
    setIsGeneratingBio(true);
    try {
      const { suggestBio } = await import('../services/aiService');
      const result = await suggestBio({
        context: bioContext,
        style: selectedBioStyle,
        specialty,
        yearsExperience,
        differentials: selectedDifferentials
      });
      if (result.bio) setBio(result.bio);
      if (result.headline) setHeadline(result.headline);
      notify.success("Texto sugerido com sucesso! Sinta-se à vontade para editar.");
    } catch (e: any) {
      notify.error(getHumanError(e.message));
    } finally {
      setIsGeneratingBio(false);
    }
  };

  // Sanitize differentials loaded from profile/elsewhere
  useEffect(() => {
    if (selectedDifferentials.length > 0) {
      const validDifferentials = selectedDifferentials.filter((d) =>
        ONBOARDING_DIFFERENTIALS.includes(d)
      );
      if (validDifferentials.length !== selectedDifferentials.length) {
        setSelectedDifferentials(validDifferentials);
      }
    }
  }, [selectedDifferentials.length]);

  const [instagramConfirmed, setInstagramConfirmed] = useState(false);
  const instagramStatus = useMemo(() => {
    if (!instagram) return "idle";
    return INSTAGRAM_REGEX.test(instagram) ? "valid" : "invalid";
  }, [instagram]);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const prevNameRef = useRef(name);

  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "unavailable" | "invalid"
  >("idle");
  const [slugMessage, setSlugMessage] = useState("");
  const [slugSuggestions, setSlugSuggestions] = useState<string[]>([]);
  const slugCheckRef = useRef<string>("");

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
      setSlugStatus("idle");
      setSlugMessage("");
      slugCheckRef.current = "";
      return;
    }

    const cleanSlug = slug.toLowerCase().trim();
    const slugRegex = /^[a-z0-9-]+$/;

    if (cleanSlug.length < 3 || cleanSlug.length > 50) {
      setSlugStatus("invalid");
      setSlugMessage("Seu link precisa ter pelo menos 3 caracteres");
      slugCheckRef.current = cleanSlug;
      return;
    }

    if (!slugRegex.test(cleanSlug)) {
      setSlugStatus("invalid");
      setSlugMessage("Use apenas letras, números e hífens.");
      slugCheckRef.current = cleanSlug;
      return;
    }

    slugCheckRef.current = cleanSlug;
    setSlugStatus("checking");
    setSlugMessage("Verificando link...");

    const timer = setTimeout(async () => {
      // If the slug changed during the debounce, don't proceed with the old one
      if (slugCheckRef.current !== cleanSlug) return;

      try {
        const queryParams = new URLSearchParams({
          slug: cleanSlug,
          uid: user?.uid || "",
          city: city || "",
        });

        devLog(`[SlugCheck] Requesting check for slug: ${cleanSlug}`);
        const res = await fetch(`/api/slug/check?${queryParams}`);

        // If the slug changed while the fetch was in progress, ignore result
        if (slugCheckRef.current !== cleanSlug) return;

        let data: any = {};
        try {
          data = await res.json();
        } catch (e) {
          if (isDev) console.error("[SlugCheck] JSON parse error", e);
        }

        let finalStatus: "available" | "unavailable" | "invalid" = "invalid";
        if (res.ok) {
          if (data.available === true) {
            finalStatus = "available";
          } else if (data.available === false) {
            finalStatus = "unavailable";
          }
        }

        devLog("[SlugCheck]", {
          status: res.status,
          body: data,
          finalStatus,
        });

        if (finalStatus === "available") {
          setSlugStatus("available");
          setSlugMessage(data.message || "Seu link está disponível!");
          setSlugSuggestions([]);
        } else if (finalStatus === "unavailable") {
          setSlugStatus("unavailable");
          setSlugMessage(data.message || "Esse link já está sendo usado");
          setSlugSuggestions(data.suggestions || []);
        } else {
          setSlugStatus("invalid");
          setSlugMessage(
            data.error || "Não consegui verificar agora. Tente novamente.",
          );
        }
      } catch (err) {
        if (isDev) console.error("[SlugCheck] Caught error:", err);
        // Only update if it's still the same slug
        if (slugCheckRef.current === cleanSlug) {
          const finalStatus = "invalid";
          devLog("[SlugCheck]", {
            status: "caught_error",
            error: String(err),
            finalStatus,
          });
          setSlugStatus(finalStatus);
          setSlugMessage("Erro de rede. Tente novamente.");
        }
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [slug]);

  // Step 2: Service Mode Details
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaFee, setNewAreaFee] = useState("");
  const [portfolio, setPortfolio] = useState<
    { id?: string; url: string; category: string; isUploading?: boolean }[]
  >([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);

  // Step 3: Services
  const [services, setServices] = useState<
    {
      name: string;
      duration: string;
      price: string;
      description: string;
      serviceCategory?: string;
    }[]
  >([
    { name: "", duration: "", price: "", description: "", serviceCategory: "" },
  ]);

  const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [servicesErrors, setServicesErrors] = useState<any[]>([]);

  // Step 3: Schedule state extensions
  const [showBreak, setShowBreak] = useState(false);
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [showAllDifferentials, setShowAllDifferentials] = useState(false);

  // Local Draft Hydration and Saving
  const draftKey = user ? `nera:onboarding:draft:${user.uid}` : "";

  useEffect(() => {
    if (!draftKey || isFinalizing) return;

    // Auto-save any changes to a local draft
    const draft = {
      name,
      specialty,
      headline,
      bio,
      whatsapp,
      slug,
      paymentMethods,
      services,
      yearsExperience,
      selectedStyles,
      selectedDifferentials,
      step,
      serviceMode,
      serviceAreaType,
      travelFeeMode,
      fixedTravelFee,
      city,
      neighborhood,
      studioAddress,
      instagram,
      workingDays,
      startTime,
      endTime,
      showBreak,
      breakStart,
      breakEnd,
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch (e) {}
  }, [
    draftKey,
    isFinalizing,
    name,
    specialty,
    headline,
    bio,
    whatsapp,
    slug,
    instagram,
    paymentMethods,
    services,
    yearsExperience,
    selectedStyles,
    selectedDifferentials,
    step,
    serviceMode,
    serviceAreaType,
    travelFeeMode,
    fixedTravelFee,
    city,
    neighborhood,
    studioAddress,
    workingDays,
    startTime,
    endTime,
    showBreak,
    breakStart,
    breakEnd,
  ]);

  const hasHydratedDraft = useRef(false);
  useEffect(() => {
    if (!draftKey || !profile || hasHydratedDraft.current) return;

    try {
      const draftStr = localStorage.getItem(draftKey);
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        let safeStep = draft.step || 1;
        if (
          safeStep > 1 &&
          (!draft.name || !draft.specialty || !draft.whatsapp || !draft.slug)
        )
          safeStep = 1;
        if (
          safeStep > 2 &&
          (!draft.city ||
            !draft.neighborhood ||
            !draft.services ||
            draft.services.length === 0 ||
            !draft.services[0].name)
        )
          safeStep = 2;
        setStep(safeStep);
        if (draft.name && !name) setName(draft.name);
        if (draft.specialty && !specialty) setSpecialty(draft.specialty);
        if (draft.headline && !headline) setHeadline(draft.headline);
        if (draft.bio && !bio) setBio(draft.bio);
        if (draft.whatsapp && !whatsapp) setWhatsapp(draft.whatsapp);
        if (draft.slug && !slug) setSlug(draft.slug);
        if (draft.instagram && !instagram) setInstagram(draft.instagram);

        if (draft.paymentMethods?.length > 0 && paymentMethods.length === 0)
          setPaymentMethods(draft.paymentMethods);
        if (
          draft.services?.length > 0 &&
          (!services ||
            services.length === 0 ||
            (services.length === 1 && services[0].name === ""))
        )
          setServices(draft.services);
        if (draft.yearsExperience && yearsExperience === "")
          setYearsExperience(draft.yearsExperience);
        if (draft.selectedStyles?.length > 0 && selectedStyles.length === 0)
          setSelectedStyles(draft.selectedStyles);
        
        if (
          draft.selectedDifferentials?.length > 0 &&
          selectedDifferentials.length === 0
        ) {
          const validDifferentials = draft.selectedDifferentials.filter((d: string) => ONBOARDING_DIFFERENTIALS.includes(d));
          setSelectedDifferentials(validDifferentials);
        }
        
        if (draft.serviceMode && serviceMode === "studio")
          setServiceMode(draft.serviceMode);
        if (draft.serviceAreaType && serviceAreaType === "city_wide")
          setServiceAreaType(draft.serviceAreaType);
        if (draft.travelFeeMode) setTravelFeeMode(draft.travelFeeMode);
        if (draft.fixedTravelFee) setFixedTravelFee(draft.fixedTravelFee);
        if (draft.city && !city) setCity(draft.city);
        if (draft.neighborhood && !neighborhood)
          setNeighborhood(draft.neighborhood);
        if (draft.studioAddress) setStudioAddress(draft.studioAddress);

        if (draft.workingDays?.length) setWorkingDays(draft.workingDays);
        if (draft.startTime) setStartTime(draft.startTime);
        if (draft.endTime) setEndTime(draft.endTime);
        if (draft.showBreak !== undefined) setShowBreak(draft.showBreak);
        if (draft.breakStart) setBreakStart(draft.breakStart);
        if (draft.breakEnd) setBreakEnd(draft.breakEnd);

        devLog("[Onboarding] Hydrated from local draft");
      }
    } catch (e) {
      // Quiet fail on draft hydration
    }

    hasHydratedDraft.current = true;
  }, [draftKey, profile]);

  useEffect(() => {
    if (profile) {
      devLog("[Onboarding] Profile snapshot received:", {
        step: profile.onboardingStep,
        completed: profile.onboardingCompleted,
        isFinalizing,
        currentStep: step,
      });

      // 1. If onboarding is already completed on server, App.tsx guard will handle redirect.
      if (profile.onboardingCompleted && !isFinalizing && step !== 4) {
        // step 4 is considered out of bounds, meaning done. Or we check 3. It used to be 5.
        // Actually we will just return if it's already completed.
        if (draftKey) {
          try {
            localStorage.removeItem(draftKey);
          } catch (e) {}
        }
        return;
      }

      // Sync specific onboarding fields not covered by common hook
      if (!loading && !isFinalizing) {
        if (profile.serviceAreaType)
          setServiceAreaType(profile.serviceAreaType);
        if (profile.travelFeeMode) setTravelFeeMode(profile.travelFeeMode);
        if (profile.fixedTravelFee)
          setFixedTravelFee(String(profile.fixedTravelFee));
        if ((profile as any).servicesDraft)
          setServices((profile as any).servicesDraft);
        if (profile.professionalIdentity?.yearsExperience)
          setYearsExperience(profile.professionalIdentity.yearsExperience);
        if (profile.professionalIdentity?.serviceStyle)
          setSelectedStyles(profile.professionalIdentity.serviceStyle);
        if (profile.portfolio && profile.portfolio.length > 0)
          setPortfolio(profile.portfolio as any);
        if (profile.paymentMethods && profile.paymentMethods.length > 0)
          setPaymentMethods(profile.paymentMethods);
        if (profile.studioAddress) setStudioAddress(profile.studioAddress);
        if (profile.onboardingStep !== undefined) {
          let safeStep = profile.onboardingStep;
          const currentName = profile.name || name;
          const currentSpecialty =
            profile.specialty ||
            profile.professionalIdentity?.mainSpecialty ||
            specialty;
          const currentWhatsapp = profile.whatsapp || whatsapp;
          const currentSlug = profile.slug || slug;
          const currentCity = profile.city || city;
          const currentNeighborhood = profile.neighborhood || neighborhood;
          const currentServices = (profile as any).servicesDraft || services;

          if (
            safeStep > 1 &&
            (!currentName ||
              !currentSpecialty ||
              !currentWhatsapp ||
              !currentSlug)
          )
            safeStep = 1;
          if (
            safeStep > 2 &&
            (!currentCity ||
              !currentNeighborhood ||
              !currentServices ||
              currentServices.length === 0 ||
              !currentServices[0].name)
          )
            safeStep = 2;

          setStep(safeStep);
        }
        if (profile.workingHours?.breakStart)
          setBreakStart(profile.workingHours.breakStart);
        if (profile.workingHours?.breakEnd)
          setBreakEnd(profile.workingHours.breakEnd);
        if (profile.workingHours?.breakStart || profile.workingHours?.breakEnd)
          setShowBreak(true);
      }
    }
  }, [profile?.uid, isFinalizing, loading]);

  const generateIdentityContent = async () => {
    if (!name || !specialty) {
      notify.error("Informe seu nome e especialidade primeiro.");
      return;
    }
    setIsGeneratingContent(true);

    try {
      const token = await user?.getIdToken();
      const response = await fetch("/api/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          specialty,
          yearsExperience,
          serviceStyle: selectedStyles,
          differentials: selectedDifferentials,
          bioStyle: selectedBioStyle,
          bioContext,
        }),
      });

      const data = await response.json();
      devLog("[BioAI] Response payload:", data);

      if (!response.ok) {
        throw new Error(data.error || "Erro na resposta do servidor.");
      }

      // Robust extraction & cleanup
      let parsedData = data;
      if (Array.isArray(data) && data.length > 0) {
        parsedData = data[0];
      }

      // Case-insensitive key lookup
      const getVal = (obj: any, keys: string[]) => {
        if (!obj || typeof obj !== "object") return "";
        const lowerObj = Object.keys(obj).reduce(
          (acc, k) => {
            acc[k.toLowerCase()] = obj[k];
            return acc;
          },
          {} as Record<string, any>,
        );
        for (const k of keys) {
          if (lowerObj[k] && typeof lowerObj[k] === "string")
            return lowerObj[k];
        }
        return "";
      };

      const nestedContainer =
        parsedData.properties ||
        parsedData.content ||
        parsedData.data ||
        parsedData.response ||
        parsedData;

      let newBio = getVal(nestedContainer, [
        "bio",
        "description",
        "bio_profissional",
        "biografia",
      ]).trim();
      let newHeadline = getVal(nestedContainer, [
        "headline",
        "title",
        "frase_principal",
        "frase",
      ]).trim();

      // If LLaMA failed to JSON wrap and just returned plain text
      if (!newBio && !newHeadline && typeof data === "string") {
        const parts = data.split("\n").filter((p) => p.trim());
        if (parts.length > 0) {
          newHeadline = parts[0];
          newBio = parts.slice(1).join(" ").trim() || parts[0];
        }
      }

      if (!newBio || !newHeadline) {
        if (isDev)
          console.error(
            "[BioAI] Extraction failed or incomplete. Raw data:",
            data,
          );
        throw new Error(
          "Não consegui preencher sua bio agora. Você pode escrever manualmente e tentar novamente.",
        );
      }

      devLog("[BioAI] Extracted:", { newBio, newHeadline });

      if (newBio) setBio(newBio);
      if (newHeadline) setHeadline(newHeadline);

      // Delay success toast sligthly to let react state update if needed, though not strictly required
      notify.success("Sua marca foi personalizada com IA ✨");
    } catch (error: any) {
      console.error("[BioAI] Generation failed:", error);
      notify.error(
        error.message ===
          "Muitas solicitações. Tente novamente em um minuto." ||
          error.message === "Configuração de IA ausente."
          ? error.message
          : "Não consegui gerar sua bio agora. Você pode escrever manualmente e tentar novamente depois.",
      );
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
      slug: slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-"),
      whatsapp: cleanWhatsapp(whatsapp),
      instagram: instagram.trim().replace("@", ""), // Save instagram
      bio,
      headline,
      city,
      neighborhood,
      serviceMode,
      serviceAreaType,
      travelFeeMode,
      fixedTravelFee:
        travelFeeMode === "fixed" ? Number(fixedTravelFee) || 0 : 0,
      pricingStrategy,
      paymentMethods: getNormalizedPaymentMethods(paymentMethods) as any,
      acceptsInstallments: paymentMethods.includes('credit_card') ? Boolean(acceptsInstallments) : false,
      profileTheme: profileTheme || { variant: "terracotta" },
      onboardingStep: nextStepNum,
      servicesDraft: services as any, // Save services temporarily before finalizing
      studioAddress: {
        street: (studioAddress.street || "").trim(),
        number: (studioAddress.number || "").trim(),
        complement: (studioAddress.complement || "").trim(),
        neighborhood: (studioAddress.neighborhood || "").trim(),
        city: (studioAddress.city || city || "").trim(),
        reference: (studioAddress.reference || "").trim(),
        privacyMode: (studioAddress.privacyMode || "neighborhood_only") as
          | "public_full"
          | "neighborhood_only"
          | "reveal_after_booking",
        hasParking: !!studioAddress.hasParking,
        parkingInfo: (studioAddress.parkingInfo || "").trim(),
        hasAccessibility: !!studioAddress.hasAccessibility,
        accessibilityInfo: (studioAddress.accessibilityInfo || "").trim(),
        isSafeLocation: !!studioAddress.isSafeLocation,
        locationNotes: (studioAddress.locationNotes || "").trim(),
      },
      workingHours: {
        startTime,
        endTime,
        workingDays,
        ...(showBreak ? { breakStart, breakEnd } : {}),
      },
      professionalIdentity: {
        subSpecialties,
        yearsExperience,
        serviceStyle: selectedStyles,
        differentials: selectedDifferentials,
        attendsAt: serviceMode as any,
      } as ProfessionalIdentity,
    };

    try {
      await saveProfilePartial(user.uid, payload);
    } catch (error) {
      console.error("[Onboarding] Error saving progress:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file && user) {
      if (!auth.currentUser || auth.currentUser.uid !== user.uid) {
        notify.warning(
          "Sua sessão expirou. Entre novamente para atualizar sua foto.",
          { id: "auth_expire_avatar" },
        );
        return;
      }

      try {
        await auth.currentUser.getIdToken(true);
      } catch (err) {
        notify.warning(
          "Sua sessão expirou. Entre novamente para atualizar sua foto.",
          { id: "auth_expire_avatar" },
        );
        return;
      }

      setUploadingImage(true);

      // 1. Immediate Local Preview
      const localUrl = URL.createObjectURL(file);
      setAvatarPreview(localUrl);

      try {
        // 2. Compression
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 800,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(file, options);

        // 3. Upload
        const downloadUrl = await uploadImageToStorage(
          compressedFile,
          `avatars/${user.uid}`,
        );

        // Update local state
        setAvatar(downloadUrl);

        // PERSISTENCE: Save immediately to Firestore if profile exists
        if (profile) {
          await saveProfilePartial(user.uid, { avatar: downloadUrl });
        }

        notify.success("Foto atualizada com sucesso.");
      } catch (error: any) {
        console.error("[Avatar] upload flow failed:", error);
        notify.error("Não foi possível salvar a imagem agora.");
        // Revert preview on error
        setAvatarPreview(avatar);
      } finally {
        setUploadingImage(false);
        // Reset input
        if (avatarInputRef.current) avatarInputRef.current.value = "";
      }
    }
  };

  const nextStep = async () => {
    if (isSavingStep) return;
    setFormErrors({});

    // Validation per step
    if (step === 1) {
      const errors: Record<string, string> = {};
      if (!name.trim()) errors.name = "O nome é obrigatório";
      if (!specialty.trim())
        errors.specialty = "Informe seu título profissional";
      if (!isValidWhatsapp(whatsapp)) {
        errors.whatsapp =
          "Número inválido. Use um formato brasileiro: (DDD) 9XXXX-XXXX";
      }
      if (!subSpecialties || subSpecialties.length === 0) {
        errors.subSpecialties = "Selecione pelo menos uma área de atendimento";
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        notify.error("Por favor, preencha os campos destacados.");
        return;
      }

      // Auto-generate only if empty to give a "gift" to those who didn't use the button
      if (!bio && !headline) {
        generateIdentityContent();
      }
      if (paymentMethods.length === 0) setPaymentMethods(["pix"]);
    }

    if (step === 2) {
      const errors: Record<string, string> = {};
      if (!city.trim()) errors.city = "Informe sua cidade";
      if (!neighborhood.trim()) errors.neighborhood = "Informe seu bairro";

      if (serviceMode !== "home") {
        // Relaxing address block to allow saving without full details on day 1
      }

      let hasServiceError = false;
      const newServiceErrors = services.map((s, idx) => {
        if (idx === 0 || s.name || s.duration || s.price || s.serviceCategory) {
          const errs: any = {};
          if (!s.name.trim()) errs.name = "Informe o nome do serviço";
          if (!s.serviceCategory)
            errs.serviceCategory = "Selecione uma categoria";
          if (
            !s.duration ||
            Number(s.duration) < 15 ||
            Number(s.duration) > 480
          ) {
            errs.duration = "Duração inválida (15 a 480 min).";
          }
          if (!s.price.trim()) errs.price = "Informe o preço";

          if (Object.keys(errs).length > 0) hasServiceError = true;
          return Object.keys(errs).length > 0 ? errs : null;
        }
        return null;
      });

      if (hasServiceError) {
        setServicesErrors(newServiceErrors);
        notify.error("Preencha os dados do seu serviço principal.");
        return;
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        notify.error("Por favor, informe sua localização.");
        return;
      }
    }

    setIsSavingStep(true);
    try {
      const nextStepNum = step + 1;
      await saveProgress(nextStepNum);
      setStep(nextStepNum);
      // Scroll to top on step change for better UX
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("[Onboarding] Failed to move to next step:", error);
      notify.error("Não foi possível salvar seu progresso agora.");
    } finally {
      setIsSavingStep(false);
    }
  };

  const prevStep = () => setStep((s) => s - 1);

  const handleFinish = async () => {
    setFormErrors({});

    if (!user || isFinalizing || profile?.onboardingCompleted) {
      if (profile?.onboardingCompleted) navigate("/dashboard?tab=hoje");
      return;
    }

    // 1. Validation
    try {
      const errors: Record<string, string> = {};

      if (!name.trim()) errors.name = "O nome profissional é obrigatório";
      if (!specialty.trim())
        errors.specialty = "Seu título profissional é obrigatório";
      if (!subSpecialties || subSpecialties.length === 0)
        errors.subSpecialties = "Selecione pelo menos uma área de atendimento";
      if (!slug.trim()) errors.slug = "O link da sua vitrine é obrigatório";
      if (slug.length < 3)
        errors.slug = "O link deve ter pelo menos 3 caracteres";
      if (!city.trim()) errors.city = "A cidade é obrigatória";
      if (!neighborhood.trim()) errors.neighborhood = "O bairro é obrigatório";

      // WhatsApp validation
      if (!whatsapp || !isValidWhatsapp(whatsapp)) {
        notify.error("Informe um WhatsApp válido (Ex: 11 99999-9999)");
        return;
      }

      if (workingDays.length === 0) {
        notify.error("Selecione ao menos um dia de atendimento na agenda.");
        return;
      }

      const activeServices = services.filter((s) => s.name.trim() !== "");
      if (activeServices.length === 0) {
        devLog("[OnboardingSave] Validation failed: No active services");
        notify.error("Cadastre pelo menos um serviço antes de publicar.");
        return;
      }

      const invalidService = activeServices.find((s) => !s.serviceCategory);
      if (invalidService) {
        notify.error(
          "Por favor, volte e selecione uma categoria para o seu serviço.",
        );
        return;
      }

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        notify.error("Revise os campos destacados para publicar sua vitrine.");

        // Auto-scroll to first error
        setTimeout(() => {
          const firstError = document.querySelector(".form-error-message");
          if (firstError) {
            firstError.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 150);
        return;
      }
    } catch (err) {
      console.error("[OnboardingSave] Validation error:", err);
      if (err instanceof z.ZodError) {
        notify.error(err.issues[0].message);
      } else {
        notify.error(err);
      }
      return;
    }

    setLoading(true);
    setIsFinalizing(true);

    const activeServices = services.filter(
      (s) => s.name.trim() !== "" && s.price,
    );

    const rawProfileData: Partial<UserProfile> = {
      name: name.trim(),
      specialty: specialty.trim(),
      city: (studioAddress.city || city).trim(),
      neighborhood: (studioAddress.neighborhood || neighborhood).trim(),
      slug: slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-"),
      whatsapp: cleanWhatsapp(whatsapp),
      paymentMethods: getNormalizedPaymentMethods(paymentMethods) as any,
      acceptsInstallments: paymentMethods.includes('credit_card') ? Boolean(acceptsInstallments) : false,
      bio: bio.trim(),
      headline: headline.trim(),
      instagram: instagram.trim().replace("@", ""),
      avatar,
      profileTheme: profileTheme || { variant: "terracotta" },
      serviceMode,
      serviceAreaType,
      travelFeeMode,
      fixedTravelFee:
        travelFeeMode === "fixed" ? Number(fixedTravelFee) || 0 : 0,
      pricingStrategy,
      studioAddress: {
        street: (studioAddress.street || "").trim(),
        number: (studioAddress.number || "").trim(),
        complement: (studioAddress.complement || "").trim(),
        neighborhood: (studioAddress.neighborhood || "").trim(),
        city: (studioAddress.city || city || "").trim(),
        reference: (studioAddress.reference || "").trim(),
        privacyMode: (studioAddress.privacyMode || "neighborhood_only") as
          | "public_full"
          | "neighborhood_only"
          | "reveal_after_booking",
        hasParking: !!studioAddress.hasParking,
        parkingInfo: (studioAddress.parkingInfo || "").trim(),
        hasAccessibility: !!studioAddress.hasAccessibility,
        accessibilityInfo: (studioAddress.accessibilityInfo || "").trim(),
        isSafeLocation: !!studioAddress.isSafeLocation,
        locationNotes: (studioAddress.locationNotes || "").trim(),
      },
      serviceAreas: serviceAreas.map((area) => ({
        name: area.name.trim(),
        fee: Number(area.fee) || 0,
      })),
      workingHours: {
        startTime,
        endTime,
        workingDays,
        ...(showBreak ? { breakStart, breakEnd } : {}),
      },
      professionalIdentity: {
        subSpecialties,
        yearsExperience,
        serviceStyle: selectedStyles,
        differentials: selectedDifferentials,
        attendsAt: serviceMode as any,
      } as ProfessionalIdentity,
      published: true, // Explicitly marked as published
      onboardingCompleted: false, // We delay this so they can see step 4
      onboardingStep: 4,
      indexable: true,
      planRank: profile?.planRank || 0,
      avatarSkipped: avatar ? false : true, // If no avatar, consider skipped
      updatedAt: new Date().toISOString(),
    };

    const rawServicesData = activeServices.map((service) => ({
      name: service.name.trim(),
      duration: Number(service.duration) || 0,
      price: Number(service.price) || 0,
      description: (service.description || "").trim(),
      serviceCategory: service.serviceCategory || undefined,
    }));

    // SANITIZATION: Remove all undefined/empty fields to prevent Firestore errors
    const profileData = removeUndefinedDeep(rawProfileData);
    const servicesData = removeUndefinedDeep(rawServicesData);

    const payload = {
      uid: user.uid,
      profileData,
      services: servicesData,
    };

    try {
      if (!auth.currentUser) {
        notify.error("Sua sessão expirou. Entre novamente para salvar.");
        setIsFinalizing(false);
        return;
      }
      const token = await auth.currentUser.getIdToken(true);
      const response = await fetch("/api/profile/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const isJson = response.headers
        .get("content-type")
        ?.includes("application/json");
      const responseBody = isJson
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        throw new Error(
          typeof responseBody === "object" ? responseBody.error : responseBody,
        );
      }

      if (responseBody?.draftMessage) {
        notify.info(responseBody.draftMessage, { duration: 6000 });
      }

      setStep(4); // Advance to completion viewing step
    } catch (error: any) {
      notify.error(error);
    } finally {
      setIsFinalizing(false);
      setLoading(false);
    }
  };

  const completeOnboarding = async () => {
    if (!user) return;

    setIsFinalizing(true);
    try {
      if (draftKey) {
        localStorage.removeItem(draftKey);
      }

      await saveProfilePartial(user.uid, {
        onboardingCompleted: true,
        onboardingStep: 4,
      });
      navigate("/dashboard?tab=hoje");
    } catch (error) {
      console.error("[ONBOARDING ERROR] final step failed:", error);
      navigate("/dashboard?tab=hoje");
    } finally {
      setIsFinalizing(false);
    }
  };

  const addService = () => {
    setServices([
      ...services,
      { name: "", duration: "", price: "", description: "" },
    ]);
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
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day].sort());
    }
  };

  const addArea = () => {
    if (!newAreaName.trim()) {
      notify.error("Informe o nome do bairro.");
      return;
    }

    if (pricingStrategy !== "none" && !newAreaFee) {
      notify.error("Por favor, informe o valor adicional.");
      return;
    }

    const isDuplicate = serviceAreas.some(
      (area) => area.name.toLowerCase() === newAreaName.trim().toLowerCase(),
    );

    if (isDuplicate) {
      notify.error("Este bairro já foi adicionado.");
      return;
    }

    const feeValue = pricingStrategy === "none" ? 0 : Number(newAreaFee);

    setServiceAreas([
      ...serviceAreas,
      {
        name: newAreaName.trim(),
        fee: feeValue,
      },
    ]);

    setNewAreaName("");
    setNewAreaFee("");
    notify.success("Bairro adicionado com sucesso.");
  };

  const handlePortfolioUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;

    if (files && files.length > 0 && user) {
      if (!auth.currentUser || auth.currentUser.uid !== user.uid) {
        notify.warning(
          "Sua sessão expirou. Entre novamente para enviar imagens.",
          { id: "auth_expire_portfolio" },
        );
        return;
      }

      try {
        await auth.currentUser.getIdToken(true);
      } catch (err) {
        notify.warning(
          "Sua sessão expirou. Entre novamente para enviar imagens.",
          { id: "auth_expire_portfolio" },
        );
        return;
      }

      setUploadingImage(true);
      const file = files[0];
      const tempId = "temp-" + Date.now();

      // 1. Immediate Local Preview
      try {
        const localUrl = URL.createObjectURL(file);
        setPortfolio((prev) => [
          {
            id: tempId,
            url: localUrl,
            category: specialty || "Geral",
            isUploading: true,
          },
          ...prev,
        ]);
      } catch (previewErr) {
        console.error("[Portfolio] error creating preview:", previewErr);
      }

      let uniqueFilename = "";
      // 3. Upload
      try {
        // 2. Compression
        const options = {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 1200,
          useWebWorker: false,
        };
        const compressedFile = await imageCompression(file, options);
        devLog(
          `[Portfolio Onboarding] Compression done. Original: ${file.size}, Compressed: ${compressedFile.size}`,
        );

        // 3. Upload
        uniqueFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "")}`;
        const downloadUrl = await uploadImageToStorage(
          compressedFile,
          `portfolio/${user.uid}/${uniqueFilename}`,
        );
        devLog("[Portfolio Onboarding] upload finished:", downloadUrl);

        // 3b. AI Categorization
        let autoCategory = "";
        try {
          autoCategory = await analyzePortfolio({
            imageUrl: downloadUrl,
            specialty,
          });
        } catch (catErr) {
          // silently fail
        }

        // 4. Persistence
        const docId = await savePortfolioItem(
          user.uid,
          downloadUrl,
          autoCategory || specialty || "Geral",
        );
        devLog("[Portfolio Onboarding] saved successfully with ID:", docId);

        // Update local state with real ID
        setPortfolio((prev) =>
          prev.map((item) =>
            item.id === tempId
              ? {
                  id: docId,
                  url: downloadUrl,
                  category: autoCategory || specialty || "Geral",
                }
              : item,
          ),
        );

        notify.success(
          `Foto adicionada${autoCategory ? ` · ${autoCategory}` : ""}`,
        );
        setDiagnosticInfo(null);
      } catch (error: any) {
        console.error("[Portfolio] upload failed:", error);

        // Fetch diagnostic info
        const storageAny = storage as any;
        const diag = {
          authUid: auth.currentUser?.uid,
          authProjectId: auth.app.options.projectId,
          authStorageBucket: auth.app.options.storageBucket,
          storageProjectId: storage.app.options.projectId,
          storageBucket: storage.app.options.storageBucket,
          storageCustomBucket:
            storageAny._location?.bucket ||
            storageAny._bucket?.bucket ||
            storageAny.customBucket ||
            "N/A",
          fileRefPath:
            error.__diag_fileRefPath ||
            `portfolio/${user.uid}/${uniqueFilename}`,
          fileRefBucket: error.__diag_fileRefBucket || "N/A",
          fileRefFullUrl: error.__diag_fullUrl || "N/A",
          errorCode: error.code,
          errorMessage: error.message,
          appsCount:
            (globalThis as any).firebaseAppsCount ||
            (window as any)?.firebaseAppsCount ||
            1,
          authEqualsStorageApp: auth.app === storage.app,
        };

        if (isDev) {
          console.error("[DIAGNÓSTICO OBRIGATÓRIO]", diag);
          setDiagnosticInfo(diag);
        }

        let errorMessage =
          "Não conseguimos enviar essa imagem. Tente novamente.";
        if (error.code === "storage/unauthorized") {
          errorMessage =
            "Permissão negada. Verifique se você está logada corretamente.";
        } else if (error.code === "storage/canceled") {
          errorMessage = "O upload foi cancelado.";
        } else if (error.message && error.message.includes("corrupted")) {
          errorMessage =
            "A imagem parece estar corrompida. Tente selecionar outra foto.";
        } else if (error.message && error.message.includes("format")) {
          errorMessage = "Esse formato ainda não é suportado.";
        }
        notify.error(errorMessage);
        setPortfolio((prev) => prev.filter((item) => item.id !== tempId));
      } finally {
        setUploadingImage(false);
        if (portfolioInputRef.current) portfolioInputRef.current.value = "";
      }
    }
  };

  const removePortfolioImage = async (id: string) => {
    if (!user || !id) return;

    // Don't allow removing temp items that are still uploading
    if (id.startsWith("temp-")) return;

    setDeletingId(id);
    try {
      const itemToDelete = portfolio.find((item) => item.id === id);
      if (itemToDelete) {
        await deletePortfolioItem(user.uid, itemToDelete as any);
      } else {
        // Fallback for subcollection if somehow mixed
        await deleteDoc(doc(db, "users", user.uid, "portfolio", id));
      }
      setPortfolio((prev) => prev.filter((item) => item.id !== id));
      notify.success("Imagem removida.");
    } catch (err) {
      console.error("[Portfolio] Error removing:", err);
      notify.error("Não foi possível remover a imagem.");
    } finally {
      setDeletingId(null);
    }
  };

  const removeArea = (index: number) => {
    setServiceAreas(serviceAreas.filter((_, i) => i !== index));
  };

  const qualityIssues = useMemo(() => {
    const issues = [];

    const servicesWithoutDuration = services.filter(
      (s) => !s.duration || Number(s.duration) === 0,
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

  if (authLoading) return <AppLoadingScreen />;

  const progress = (step / (TOTAL_STEPS + 1)) * 100;

  // Gate for users who selected a paid plan but haven't finished checkout
  const needsVerification =
    (profile?.signupPlan === "essencial" || profile?.signupPlan === "pro") &&
    profile?.plan === "free";

  if (needsVerification && !profile?.onboardingCompleted) {
    return (
      <div className="min-h-screen bg-brand-parchment flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-xl border border-brand-mist space-y-8">
          <div className="w-20 h-20 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck size={40} />
          </div>
          <div>
            <h2 className="text-3xl font-serif text-brand-ink mb-3">
              Ative seu teste gratuito
            </h2>
            <p className="text-brand-stone text-sm font-light leading-relaxed">
              Você selecionou o plano{" "}
              <span className="font-semibold text-brand-terracotta capitalize">
                {profile?.signupPlan}
              </span>
              . Para começar seu teste de 15 dias e configurar sua vitrine, é
              necessário confirmar sua assinatura no Stripe.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={async () => {
                const planType = profile?.signupPlan as "essencial" | "pro";
                try {
                  const token = await user?.getIdToken();
                  const response = await fetch("/api/plans/create-checkout", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ plan: planType }),
                  });
                  const data = await response.json();
                  if (data.checkoutUrl) {
                    window.location.href = data.checkoutUrl;
                  } else {
                    notify.error(data.error || "Erro ao iniciar checkout.");
                  }
                } catch (err) {
                  notify.error("Erro de conexão ao iniciar checkout.");
                }
              }}
              className="w-full bg-brand-terracotta text-brand-white py-5 rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-brand-sienna transition-all flex items-center justify-center gap-3"
            >
              Completar e Iniciar Trial <ArrowRight size={18} />
            </button>
            <button
              onClick={async () => {
                const docRef = doc(db, "users", user!.uid);
                await updateDoc(docRef, { signupPlan: "free" });
                window.location.reload();
              }}
              className="w-full bg-transparent text-brand-stone py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:text-brand-ink transition-all"
            >
              Continuar com plano Gratuito
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="py-4 px-6 flex flex-col items-center gap-3">
            <p className="text-[9px] text-brand-stone font-bold uppercase tracking-[0.25em]">
              Passo {step} <span className="opacity-40">de {TOTAL_STEPS}</span>
            </p>
            <div className="w-48 h-[2px] bg-brand-mist/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[var(--theme-accent,var(--color-brand-terracotta))]"
                initial={{ width: `${((step - 1) / TOTAL_STEPS) * 100}%` }}
                animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center gap-1.5 md:gap-3 text-[10px] tracking-wide font-medium mt-1">
              {[
                { label: "Identidade", idx: 1 },
                { label: "Serviço e Local", idx: 2 },
                { label: "Vitrine", idx: 3 },
              ].map((s) => (
                <div key={s.idx} className="flex items-center gap-1.5 md:gap-2">
                  <span
                    className={cn(
                      "flex flex-row items-center gap-1",
                      step === s.idx
                        ? "text-brand-ink font-bold"
                        : step > s.idx
                          ? "text-brand-terracotta"
                          : "text-brand-stone/40",
                    )}
                  >
                    {step > s.idx ? "✓" : step === s.idx ? "●" : "○"}{" "}
                    <span className="hidden sm:inline">{s.label}</span>
                  </span>
                  {s.idx < 3 && (
                    <span className="text-brand-mist/60 mx-0.5">•</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 md:px-8 max-w-2xl mx-auto w-full pt-36 pb-24 md:pt-32">
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
                subSpecialties={subSpecialties}
                headline={headline || bio}
                slug={slug}
                avatar={avatarPreview || avatar}
              />

              <FormIdentity
                title="Sua identidade profissional"
                subtitle="Comece com o essencial. Você poderá ajustar tudo depois."
                name={name}
                setName={setName}
                specialty={specialty}
                setSpecialty={setSpecialty}
                subSpecialties={subSpecialties}
                setSubSpecialties={setSubSpecialties}
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
                yearsExperience={yearsExperience}
                setYearsExperience={setYearsExperience}
                whatsapp={whatsapp}
                setWhatsapp={setWhatsapp}
                showLabels={true}
                errors={formErrors}
                onGenerateBio={handleGenerateBio}
                isGeneratingBio={isGeneratingBio}
                bioContext={bioContext}
                setBioContext={setBioContext}
                selectedBioStyle={selectedBioStyle}
                setSelectedBioStyle={setSelectedBioStyle}
              />

              <button
                onClick={nextStep}
                disabled={
                  !name ||
                  !specialty ||
                  !slug ||
                  !whatsapp ||
                  uploadingImage ||
                  isSavingStep ||
                  slugStatus !== "available"
                }
                className={cn(
                  "w-full py-6 rounded-full text-[11px] font-medium uppercase tracking-widest transition-all duration-500 ease-out flex items-center justify-center gap-3 relative overflow-hidden group",
                  !name ||
                    !specialty ||
                    !slug ||
                    !whatsapp ||
                    uploadingImage ||
                    isSavingStep ||
                    slugStatus !== "available"
                    ? "bg-brand-mist/20 text-brand-stone/40 border border-brand-mist/50 cursor-not-allowed"
                    : "bg-brand-ink text-brand-white shadow-[0_8px_32px_rgba(var(--theme-accent-rgb),20,20,20,0.15)] hover:shadow-[0_16px_48px_rgba(var(--theme-accent-rgb),20,20,20,0.25)] hover:-translate-y-0.5 hover:bg-brand-espresso",
                )}
              >
                {isSavingStep || uploadingImage ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                  >
                    <Sparkles size={18} />
                  </motion.div>
                ) : (
                  <ArrowRight size={18} />
                )}
                {uploadingImage
                  ? "Processando Foto..."
                  : isSavingStep
                    ? "Salvando..."
                    : "Próximo Passo"}
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full space-y-6 sm:space-y-8"
            >
              <div className="bg-brand-parchment/60 border border-brand-mist/50 p-4 rounded-xl flex gap-3 text-brand-stone mt-0 mb-0 sm:mt-2 sm:mb-2">
                <AlertCircle
                  size={20}
                  className="text-brand-terracotta shrink-0 mt-0.5"
                />
                <p className="text-[12px] sm:text-[13px] font-light leading-relaxed">
                  <span className="font-medium text-brand-ink">
                    Estamos criando a vitrine.
                  </span>{" "}
                  Cadastre apenas o serviço que mais realiza agora. Adicione os
                  demais depois no painel.
                </p>
              </div>

              <FormServices
                title="Seu primeiro serviço"
                subtitle="Vamos cadastrar apenas o serviço que você mais realiza. Os demais poderão ser adicionados facilmente depois no painel."
                services={services}
                setServices={setServices as any}
                errors={servicesErrors}
                workingHours={{ startTime, endTime }}
                specialty={specialty}
                allowMultiple={false}
              />

              <FormLocation
                minimalOnboarding={true}
                title="Onde você atende"
                subtitle="Como suas clientes podem ser atendidas?"
                city={city}
                setCity={setCity}
                neighborhood={neighborhood}
                setNeighborhood={setNeighborhood}
                serviceMode={serviceMode}
                setServiceMode={setServiceMode}
                studioAddress={studioAddress}
                setStudioAddress={setStudioAddress}
                serviceAreaType={serviceAreaType as any}
                setServiceAreaType={setServiceAreaType as any}
                travelFeeMode={travelFeeMode}
                setTravelFeeMode={setTravelFeeMode}
                fixedTravelFee={fixedTravelFee}
                setFixedTravelFee={setFixedTravelFee}
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

              <div className="flex gap-4">
                <button
                  onClick={prevStep}
                  className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm"
                >
                  <ArrowLeft size={24} />
                </button>
                <button
                  onClick={nextStep}
                  disabled={
                    isSavingStep ||
                    !city ||
                    !neighborhood ||
                    (serviceMode === "home" &&
                      serviceAreaType === "custom" &&
                      serviceAreas.length === 0) ||
                    (serviceMode === "hybrid" &&
                      serviceAreaType === "custom" &&
                      serviceAreas.length === 0)
                  }
                  className={cn(
                    "flex-1 py-6 rounded-full text-[11px] font-medium uppercase tracking-widest transition-all duration-500 ease-out flex items-center justify-center gap-3 relative overflow-hidden group",
                    isSavingStep ||
                      !city ||
                      !neighborhood ||
                      (serviceMode === "home" &&
                        serviceAreaType === "custom" &&
                        serviceAreas.length === 0) ||
                      (serviceMode === "hybrid" &&
                        serviceAreaType === "custom" &&
                        serviceAreas.length === 0)
                      ? "bg-brand-mist/20 text-brand-stone/40 border border-brand-mist/50 cursor-not-allowed"
                      : "bg-brand-ink text-brand-white shadow-[0_8px_32px_rgba(var(--theme-accent-rgb),20,20,20,0.15)] hover:shadow-[0_16px_48px_rgba(var(--theme-accent-rgb),20,20,20,0.25)] hover:-translate-y-0.5 hover:bg-brand-espresso",
                  )}
                >
                  {isSavingStep ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1 }}
                    >
                      <Sparkles size={18} />
                    </motion.div>
                  ) : (
                    <ArrowRight size={18} />
                  )}
                  {isSavingStep ? "Salvando..." : "Próximo passo"}
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
                  <Clock size={32} />
                </div>
                <h1 className="text-4xl font-serif font-normal text-brand-ink">
                  Sua agenda de atendimento
                </h1>
                <p className="text-brand-stone font-light text-center">
                  Defina quando suas clientes poderão solicitar horários.
                  <br />
                  Você poderá ajustar dias específicos depois.
                </p>
              </div>

              <div className="bg-brand-white p-6 md:p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1 block">
                    Dias de Atendimento
                  </label>
                  <p className="text-[11px] text-brand-stone font-light ml-1 -mt-2 mb-2">
                    Selecione os dias em que você costuma atender.
                  </p>
                  <div className="flex justify-between gap-1 sm:gap-2">
                    {WEEKDAYS.map((day, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleDay(idx)}
                        className={cn(
                          "w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full text-[9px] sm:text-[10px] font-bold transition-all duration-300 border flex items-center justify-center active:scale-95",
                          workingDays.includes(idx)
                            ? "bg-brand-ink text-brand-white border-brand-terracotta/40 shadow-lg shadow-brand-terracotta/20"
                            : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone/50 hover:bg-brand-mist/20",
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="md:col-span-2">
                    <p className="text-[11px] text-brand-stone font-light ml-1 -mb-1">
                      Esse será seu horário padrão disponível para reservas.
                    </p>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <label className="text-[9px] font-bold text-brand-stone uppercase tracking-[0.15em] ml-1">
                      Início <span className="text-brand-terracotta">*</span>
                    </label>
                    <div className="relative w-full">
                      <Clock
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist/40"
                        size={14}
                      />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-[#FAF9F8] border border-brand-mist rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-sm text-brand-ink min-w-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <label className="text-[9px] font-bold text-brand-stone uppercase tracking-[0.15em] ml-1">
                      Fim <span className="text-brand-terracotta">*</span>
                    </label>
                    <div className="relative w-full">
                      <Clock
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist/40"
                        size={14}
                      />
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-[#FAF9F8] border border-brand-mist rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-sm text-brand-ink min-w-0"
                      />
                    </div>
                  </div>
                </div>

                {!showBreak ? (
                  <button
                    onClick={() => setShowBreak(true)}
                    className="text-[11px] font-medium text-brand-stone hover:text-brand-ink transition-colors flex items-center gap-2 px-2"
                  >
                    + Adicionar intervalo
                  </button>
                ) : (
                  <div className="space-y-4 pt-4 border-t border-brand-mist/50">
                    <div className="flex justify-between items-start px-1 pb-1">
                      <div>
                        <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest block">
                          Horário de intervalo
                        </label>
                        <p className="text-[10px] text-brand-stone font-light mt-0.5">
                          Esse período não aparecerá como disponível para
                          clientes.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowBreak(false)}
                        className="text-[10px] text-brand-terracotta hover:text-red-700 transition-colors mt-0.5"
                      >
                        Remover
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 min-w-0">
                        <label className="text-[9px] font-bold text-brand-stone uppercase tracking-[0.15em] ml-1">
                          Início da pausa
                        </label>
                        <div className="relative w-full">
                          <Clock
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist/40"
                            size={14}
                          />
                          <input
                            type="time"
                            value={breakStart}
                            onChange={(e) => setBreakStart(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-brand-mist/60 rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-sm text-brand-ink min-w-0"
                          />
                        </div>
                      </div>
                      <div className="space-y-2 min-w-0">
                        <label className="text-[9px] font-bold text-brand-stone uppercase tracking-[0.15em] ml-1">
                          Fim da pausa
                        </label>
                        <div className="relative w-full">
                          <Clock
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-mist/40"
                            size={14}
                          />
                          <input
                            type="time"
                            value={breakEnd}
                            onChange={(e) => setBreakEnd(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-white border border-brand-mist/60 rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all font-medium text-sm text-brand-ink min-w-0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-5 border-t border-brand-mist/30">
                  <div>
                    <h3 className="text-lg sm:text-xl font-serif font-normal text-brand-ink">
                      Formas de pagamento
                    </h3>
                    <p className="text-[11px] sm:text-[12px] text-brand-stone font-light leading-relaxed mt-0.5 mb-2">
                      Essas informações aparecem na sua vitrine para evitar
                      dúvidas antes da reserva.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "pix",
                      "credit_card",
                      "debit_card",
                      "cash",
                      "bank_transfer",
                      "digital_wallet",
                    ].map((methodId) => {
                      const labels: Record<string, string> = {
                        pix: "PIX",
                        credit_card: "Cartão de crédito",
                        debit_card: "Cartão de débito",
                        cash: "Dinheiro",
                        bank_transfer: "Transferência bancária",
                        digital_wallet: "Carteira digital",
                      };
                      const isActive = paymentMethods.includes(methodId);
                      return (
                        <button
                          key={methodId}
                          type="button"
                          onClick={() => {
                            if (isActive) {
                              setPaymentMethods(
                                paymentMethods.filter((m) => m !== methodId),
                              );
                            } else {
                              setPaymentMethods([...paymentMethods, methodId]);
                            }
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 ease-out border flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/50",
                            isActive
                              ? "bg-brand-ink text-brand-white border-brand-ink shadow-sm"
                              : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone/40 hover:bg-white active:scale-95",
                          )}
                        >
                          {labels[methodId]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {paymentMethods.includes('credit_card') && (
                  <div className="space-y-3 pt-5 border-t border-brand-mist/30">
                    <div>
                      <h3 className="text-lg sm:text-xl font-serif font-normal text-brand-ink">
                        Parcelamento
                      </h3>
                      <p className="text-[11px] sm:text-[12px] text-brand-stone font-light leading-relaxed mt-0.5 mb-2">
                        Informe se você costuma aceitar pagamentos parcelados no cartão.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAcceptsInstallments(true)}
                        className={cn(
                          "px-6 py-2 rounded-full text-[12px] font-medium transition-all duration-300 ease-out border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/50",
                          acceptsInstallments === true
                            ? "bg-brand-ink text-brand-white border-brand-ink shadow-sm"
                            : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone/40 hover:bg-white active:scale-95",
                        )}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setAcceptsInstallments(false)}
                        className={cn(
                          "px-6 py-2 rounded-full text-[12px] font-medium transition-all duration-300 ease-out border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/50",
                          acceptsInstallments === false
                            ? "bg-brand-ink text-brand-white border-brand-ink shadow-sm"
                            : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone/40 hover:bg-white active:scale-95",
                        )}
                      >
                        Não
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-5 border-t border-brand-mist/30">
                  <div>
                    <h3 className="text-lg sm:text-xl font-serif font-normal text-brand-ink">
                      Diferenciais
                    </h3>
                    <p className="text-[11px] sm:text-[12px] text-brand-stone font-light leading-relaxed mt-0.5 mb-2">
                      Escolha até 3 características que melhor representam seu
                      atendimento.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ONBOARDING_DIFFERENTIALS.slice(0, showAllDifferentials ? undefined : 6).map((diff) => {
                      const isActive = selectedDifferentials.includes(diff);
                      return (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => {
                            if (isActive) {
                              setSelectedDifferentials(
                                selectedDifferentials.filter((d) => d !== diff),
                              );
                            } else if (selectedDifferentials.length < 3) {
                              setSelectedDifferentials([
                                ...selectedDifferentials,
                                diff,
                              ]);
                            }
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 ease-out border flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta/50",
                            isActive
                              ? "bg-brand-ink text-brand-white border-brand-ink shadow-sm"
                              : "bg-brand-parchment text-brand-stone border-brand-mist hover:border-brand-stone/40 hover:bg-white active:scale-95",
                            !isActive &&
                              selectedDifferentials.length >= 3 &&
                              "opacity-50 cursor-not-allowed",
                          )}
                        >
                          {diff}
                        </button>
                      );
                    })}
                    {!showAllDifferentials && ONBOARDING_DIFFERENTIALS.length > 6 && (
                      <button
                        type="button"
                        onClick={() => setShowAllDifferentials(true)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300 ease-out border border-transparent bg-transparent text-brand-terracotta hover:bg-brand-terracotta/10"
                      >
                        + Ver mais opções
                      </button>
                    )}
                  </div>
                </div>

                {workingDays.length > 0 && (
                  <div className="pt-6 border-t border-brand-mist/30">
                    <p className="text-[10px] font-bold text-brand-ink uppercase tracking-[0.15em] mb-4">
                      Confira suas informações
                    </p>
                    <div className="bg-[#FAF9F8] rounded-2xl p-5 border border-brand-mist/40 flex flex-col gap-2">
                      <p className="text-sm text-brand-stone">
                        Dias:{" "}
                        <span className="font-semibold text-brand-ink">
                          {workingDays.map((d) => WEEKDAYS[d]).join(", ")}
                        </span>
                      </p>
                      <p className="text-sm text-brand-stone">
                        Horário:{" "}
                        <span className="font-semibold text-brand-ink">
                          {startTime} às {endTime}
                        </span>
                      </p>
                      {showBreak && (
                        <p className="text-sm text-brand-stone">
                          Intervalo:{" "}
                          <span className="font-semibold text-brand-ink">
                            {breakStart} às {breakEnd}
                          </span>
                        </p>
                      )}
                      
                      {paymentMethods.length > 0 && (
                        <p className="text-sm text-brand-stone mt-1">
                          Formas de pagamento:{" "}
                          <span className="font-semibold text-brand-ink">
                            {paymentMethods.map(m => {
                               const labels: Record<string, string> = {
                                  pix: "PIX",
                                  credit_card: "Crédito",
                                  debit_card: "Débito",
                                  cash: "Dinheiro",
                                  bank_transfer: "Transferência",
                                  digital_wallet: "Carteira digital",
                               };
                               return labels[m];
                            }).join(" • ")}
                          </span>
                        </p>
                      )}

                      {paymentMethods.includes('credit_card') && acceptsInstallments === true && (
                        <p className="text-sm text-brand-stone mt-1">
                          Parcelamento:{" "}
                          <span className="font-semibold text-brand-ink">
                            Disponível
                          </span>
                        </p>
                      )}
                      
                      {selectedDifferentials.length > 0 && (
                        <p className="text-sm text-brand-stone mt-1">
                          Diferenciais:{" "}
                          <span className="font-semibold text-brand-ink">
                            {selectedDifferentials.join(" • ")}
                          </span>
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] text-brand-stone/80 font-light mt-3 pl-1">
                      Você poderá alterar essas configurações depois pelo
                      painel.
                    </p>
                  </div>
                )}
              </div>

              <div className="text-center pb-2 mt-4">
                <p className="text-[11px] text-brand-stone font-medium uppercase tracking-widest text-center px-4">
                  ✨ Tudo pronto para começar a receber agendamentos.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={prevStep}
                  className="p-6 bg-brand-white rounded-full text-brand-stone border border-brand-mist hover:border-brand-stone transition-all shadow-sm"
                >
                  <ArrowLeft size={24} />
                </button>
                <button
                  onClick={handleFinish}
                  disabled={
                    loading ||
                    isFinalizing ||
                    slugStatus !== "available" ||
                    workingDays.length === 0
                  }
                  className={cn(
                    "flex-1 py-6 rounded-full text-[11px] font-medium uppercase tracking-[0.2em] transition-all duration-500 ease-out flex items-center justify-center gap-3 relative overflow-hidden group",
                    loading ||
                      isFinalizing ||
                      slugStatus !== "available" ||
                      workingDays.length === 0
                      ? "bg-brand-mist/20 text-brand-stone/40 border border-brand-mist/50 cursor-not-allowed"
                      : "bg-brand-ink text-brand-white shadow-[0_8px_32px_rgba(var(--theme-accent-rgb),20,20,20,0.15)] hover:shadow-[0_16px_48px_rgba(var(--theme-accent-rgb),20,20,20,0.25)] hover:-translate-y-0.5 hover:bg-brand-espresso",
                  )}
                >
                  {isFinalizing ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1 }}
                      >
                        <Sparkles size={18} />
                      </motion.div>
                      <span>Publicando...</span>
                    </>
                  ) : (
                    <>
                      Publicar minha vitrine <CheckCircle2 size={18} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full space-y-12 text-center"
            >
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12, delay: 0.2 }}
                  className="w-32 h-32 bg-brand-terracotta text-brand-white rounded-[40px] flex items-center justify-center mx-auto shadow-2xl shadow-brand-terracotta/20"
                >
                  <CheckCircle2 size={64} />
                </motion.div>
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-brand-ink text-brand-white rounded-2xl flex items-center justify-center shadow-lg rotate-12 animate-bounce">
                  <Sparkles size={24} />
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl font-serif font-normal text-brand-ink">
                  ✨ Sua página profissional está pronta
                </h1>
                <p className="text-brand-stone text-lg max-w-md mx-auto font-light">
                  Compartilhe seu link. Suas clientes já podem te encontrar e
                  agendar.
                </p>
              </div>

              <div className="bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-xl space-y-8">
                <div className="p-8 bg-brand-parchment rounded-[32px] border border-brand-mist">
                  <p className="text-[10px] font-medium text-brand-stone uppercase tracking-widest mb-2">
                    {name}
                  </p>
                  <p className="text-2xl font-serif italic text-brand-terracotta break-all">
                    {getPublicProfileUrl(slug).replace(/^https?:\/\//, "")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <CopyLinkButton slug={slug} />
                  <button
                    onClick={() => {
                      const text = `Olá! Minha agenda já está disponível. Você pode conferir meus serviços e agendar seu horário diretamente pelo meu link: ${getPublicProfileUrl(slug)}`;
                      window.open(buildWhatsappLink("", text), "_blank");
                    }}
                    className="flex flex-col items-center gap-4 p-8 bg-brand-parchment rounded-[32px] border border-brand-mist hover:bg-brand-linen transition-all group"
                  >
                    <div className="w-12 h-12 bg-brand-white rounded-2xl flex items-center justify-center text-brand-ink border border-brand-mist group-hover:scale-110 transition-transform">
                      <Share2 size={24} />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-widest">
                      Compartilhar
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <button
                  onClick={completeOnboarding}
                  className="w-full bg-brand-ink text-brand-white py-7 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
                  disabled={isFinalizing}
                >
                  {isFinalizing ? "Preparando..." : "Ir para painel"}{" "}
                  <ArrowRight size={20} />
                </button>
                <Link
                  to={`/p/${slug}`}
                  target="_blank"
                  className="text-[11px] font-medium text-brand-terracotta uppercase tracking-widest hover:text-brand-sienna transition-colors text-center"
                >
                  Ver minha página
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Debug Overlay - Only visible during development/debugging if showDebugHUD is true */}
      {process.env.NODE_ENV === "development" &&
        (window as any).showDebugHUD && (
          <div className="fixed bottom-4 right-4 bg-brand-ink/90 text-brand-white p-4 rounded-2xl text-[8px] font-mono z-[100] border border-brand-mist/20 pointer-events-none opacity-50">
            <p>STEP: {step}</p>
            <p>FINALIZING: {isFinalizing ? "YES" : "NO"}</p>
            <p>LOADING: {loading ? "YES" : "NO"}</p>
            <p>
              PROFILE_COMPLETED: {profile?.onboardingCompleted ? "YES" : "NO"}
            </p>
          </div>
        )}
    </div>
  );
}
