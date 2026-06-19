import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import {
  X,
  Clock,
  Calendar as CalendarIcon,
  Check,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Zap,
  MapPin,
  Home,
  Building2,
  MessageCircle,
  Share2,
  Heart,
  Sparkles,
  LogOut,
  Settings,
  Tag,
  CircleSlash,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import {
  db,
  createBookingRequest,
  handleBookingError,
  markWaitlistAsBooked,
} from "../firebase";
import {
  UserProfile,
  Service,
  ServiceArea,
  Appointment,
  BlockedSchedule,
  WaitlistEntry,
} from "../types";
import {
  formatCurrency,
  cn,
  buildWhatsappLink,
  cleanWhatsapp,
  formatWhatsappDisplay,
  generateBookingConfirmationMessage,
  formatDateKey,
  getTodayLocale,
} from "../lib/utils";
import { getAvailableSlots, canBookSlot } from "../lib/bookingUtils";
import { isActiveSlotStatus } from "../constants/appointmentStatus";
import { notify } from "../lib/notify";
import {
  SERVICE_MODES,
  getServiceModeShortLabel,
  getBookingNotificationCopy,
} from "../lib/copy";
import PremiumButton from "./PremiumButton";
import WaitlistModal from "./WaitlistModal";

interface BookingModalProps {
  profile: UserProfile;
  services: Service[];
  onClose: () => void;
  open: boolean;
  initialService?: Service | null;
  initialDate?: string | null;
  waitlistEntry?: WaitlistEntry | null;
}

import BookingStep from "./BookingStep";

import { PLAN_CONFIGS, PlanType } from "../constants/plans";

const isDev =
  import.meta.env.DEV ||
  (typeof window !== "undefined" && window.location.hostname.includes("ais-"));
const devLog = (...args: any[]) => isDev && console.log(...args);

export default function BookingModal({
  profile,
  services,
  onClose,
  open,
  initialService,
  initialDate,
  waitlistEntry,
}: BookingModalProps) {
  const [step, setStep] = useState(1);
  const profilePlan = (profile?.plan || "free") as PlanType;
  const features = PLAN_CONFIGS[profilePlan]?.features;
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [additionalServices, setAdditionalServices] = useState<Service[]>([]);
  const [showServiceSelector, setShowServiceSelector] = useState(false);
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<
    string | null
  >(null);
  const allSelectedServices = selectedService
    ? [selectedService, ...additionalServices]
    : [];
  const totalDuration = allSelectedServices.reduce(
    (acc, s) => acc + (Number(s.duration) || 0),
    0,
  );
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const dateScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);

  const handleDateScroll = () => {
    if (dateScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = dateScrollRef.current;
      setShowLeftScroll(scrollLeft > 10);
      setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scrollDates = (dir: "left" | "right") => {
    if (dateScrollRef.current) {
      const amount = dir === "left" ? -200 : 200;
      dateScrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };
  const [selectedArea, setSelectedArea] = useState<ServiceArea | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [addressNeighborhood, setAddressNeighborhood] = useState("");
  const [addressCity, setAddressCity] = useState(profile?.city || "");
  const [addressReference, setAddressReference] = useState("");

  const [bookingAttempted, setBookingAttempted] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [successDraft, setSuccessDraft] = useState<any>(null);
  const [bookingMode, setBookingMode] = useState<"studio" | "home" | null>(
    null,
  );
  const [bookingLoading, setBookingLoading] = useState(false);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    // Poll for debug logs periodically when modal is open and in dev/ais mode
    if (
      !(
        import.meta.env.DEV ||
        (typeof window !== "undefined" &&
          window.location.hostname.includes("ais-"))
      )
    )
      return;

    const interval = setInterval(() => {
      forceUpdate({});
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [appointmentToken, setAppointmentToken] = useState<string | null>(null);
  const [reservationCode, setReservationCode] = useState<string | null>(null);
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);
  const [blockedSchedules, setBlockedSchedules] = useState<any[]>([]);
  const [showRestoreDraft, setShowRestoreDraft] = useState(false);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState("");
  const [isCheckingCoupon, setIsCheckingCoupon] = useState(false);

  const isHomeService = bookingMode === "home";

  // 1. MODAL OPEN/CLOSE SYNC & RESET
  useEffect(() => {
    if (open) {
      if (profile?.city && !addressCity) {
        setAddressCity(profile.city);
      }

      // If it's null, we allow the "Restore Draft" logic to take over later if no service is selected
      if (initialService) {
        setSelectedService(initialService);
        setShowRestoreDraft(false);
      } else if (initialDate) {
        setSelectedDate(initialDate);
        setShowRestoreDraft(false);
      } else if (waitlistEntry) {
        const service = services.find((s) => s.id === waitlistEntry.serviceId);
        if (service) setSelectedService(service);
        setSelectedDate(waitlistEntry.requestedDate);
        if (waitlistEntry.preferredTime)
          setSelectedTime(waitlistEntry.preferredTime);
        if (waitlistEntry.assignedTime)
          setSelectedTime(waitlistEntry.assignedTime);
        setClientName(waitlistEntry.clientName);
        setClientPhone(waitlistEntry.clientWhatsapp);
        setShowRestoreDraft(false);
        setStep(3); // Changed from 4 to 3 to allow review before confirming
      } else if (!selectedService) {
        // Only reset if we don't have a selection already (to avoid flickering if re-rendering)
        setSelectedService(null);
      }

      // For any opening, ensure we start from the beginning unless a restore happens later
      if (step === 4) setStep(1); // If they reached success and re-opened, reset step

      // Pre-select booking mode if not hybrid for fresh openings
      if (
        profile?.serviceMode &&
        profile.serviceMode !== "hybrid" &&
        !bookingMode
      ) {
        setBookingMode(profile.serviceMode === "studio" ? "studio" : "home");
      }
    } else {
      // 2. Proactive reset when closed (after animation)
      const timer = setTimeout(() => {
        setStep(1);
        setSelectedService(null);
        setAdditionalServices([]);
        setShowServiceSelector(false);
        setSelectedServiceCategory(null);
        setSelectedDate("");
        setSelectedTime("");
        setSelectedArea(null);
        setBookingAttempted(false);
        setBookingMode(
          profile?.serviceMode && profile.serviceMode !== "hybrid"
            ? profile.serviceMode === "studio"
              ? "studio"
              : "home"
            : null,
        );
        setBookingLoading(false);
        setBookingSuccess(false);
        setClientName("");
        setClientPhone("");
        setClientEmail("");
        setClientAddress("");
      }, 400); // Wait for exit animations
      return () => clearTimeout(timer);
    }
  }, [open, initialService, profile?.serviceMode]);

  // Persistence Logic: Saving draft to localStorage
  useEffect(() => {
    const profId = profile?.professionalId || profile?.uid;
    if (!profId || !open) return;

    const draft = {
      professionalId: profId,
      serviceId: selectedService?.id,
      mode: bookingMode,
      date: selectedDate,
      time: selectedTime,
      clientName,
      clientPhone,
      clientEmail,
      selectedAreaId: selectedArea?.name,
    };

    if (selectedService || selectedDate || clientName || clientPhone) {
      const profId = profile?.professionalId || profile?.uid;
      const draft = {
        professionalId: profId,
        serviceId: selectedService?.id,
        mode: bookingMode,
        date: selectedDate,
        time: selectedTime,
        clientName,
        clientPhone,
        clientEmail,
        selectedAreaId: selectedArea?.name,
        address: {
          street: addressStreet,
          number: addressNumber,
          complement: addressComplement,
          neighborhood: addressNeighborhood || selectedArea?.name,
          city: addressCity || profile?.city,
          reference: addressReference,
        },
      };
      localStorage.setItem("booking_draft", JSON.stringify(draft));
    }
  }, [
    selectedService,
    bookingMode,
    selectedDate,
    selectedTime,
    clientName,
    clientPhone,
    clientEmail,
    selectedArea,
    profile?.professionalId,
    profile?.uid,
    open,
    addressStreet,
    addressNumber,
    addressComplement,
    addressNeighborhood,
    addressCity,
    addressReference,
  ]);

  // Persistence Logic: Checking for existing draft
  useEffect(() => {
    const savedDraft = localStorage.getItem("booking_draft");
    const profId = profile?.professionalId || profile?.uid;
    if (savedDraft && profId && open && step === 2 && !selectedService) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.professionalId === profId) {
          if (parsed.clientPhone) setClientPhone(parsed.clientPhone);
          setShowRestoreDraft(true);
        }
      } catch (e) {
        localStorage.removeItem("booking_draft");
      }
    }
  }, [profile?.professionalId, profile?.uid, open, step, selectedService]);

  const handleRestoreDraft = () => {
    const savedDraft = localStorage.getItem("booking_draft");
    if (!savedDraft) return;

    try {
      const draft = JSON.parse(savedDraft);
      const profId = profile?.professionalId || profile?.uid;

      // Basic profile check to ensure we don't restore drafts from other professionals
      if (draft.professionalId !== profId) {
        localStorage.removeItem("booking_draft");
        return;
      }

      if (draft.serviceId) {
        const service = services.find((s) => s.id === draft.serviceId);
        if (service) setSelectedService(service);
      }
      if (draft.mode) setBookingMode(draft.mode);
      if (draft.date) {
        const today = getTodayLocale();
        if (draft.date < today) {
          // Date is in the past, don't restore date/time but keep the rest
          setSelectedDate("");
          setSelectedTime("");
        } else {
          setSelectedDate(draft.date);
          if (draft.time) setSelectedTime(draft.time);
        }
      }
      if (draft.clientName) setClientName(draft.clientName);
      if (draft.clientPhone) setClientPhone(draft.clientPhone);
      if (draft.clientEmail) setClientEmail(draft.clientEmail);
      if (draft.address) {
        if (draft.address.street) setAddressStreet(draft.address.street);
        if (draft.address.number) setAddressNumber(draft.address.number);
        if (draft.address.complement)
          setAddressComplement(draft.address.complement);
        if (draft.address.neighborhood)
          setAddressNeighborhood(draft.address.neighborhood);
        if (draft.address.city) setAddressCity(draft.address.city);
        if (draft.address.reference)
          setAddressReference(draft.address.reference);
      }
      if (draft.selectedAreaId && profile?.serviceAreas) {
        const area = profile.serviceAreas.find(
          (a: ServiceArea) => a.name === draft.selectedAreaId,
        );
        if (area) setSelectedArea(area);
      }

      // Determine initial step after restore
      if (draft.clientName || draft.clientPhone) {
        setStep(2);
      } else {
        setStep(1);
      }

      setShowRestoreDraft(false);

      // Set a flag to trigger re-validation once slots are loaded
      setWasRestored(true);
    } catch (e) {
      localStorage.removeItem("booking_draft");
    }
  };

  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsLoadError, setSlotsLoadError] = useState<"timeout" | null>(null);
  const [retrySlotsCount, setRetrySlotsCount] = useState(0);

  const availableSlots = useMemo(() => {
    if (!profile?.workingHours || !selectedDate) {
      if (isDev)
        console.log(
          `[Slots] Missing requirements for slot generation: workingHours=${!!profile?.workingHours}, selectedDate=${!!selectedDate}`,
        );
      return [];
    }
    const duration = totalDuration || 60;
    const result = getAvailableSlots({
      selectedDate,
      serviceDuration: duration,
      workingHours: profile.workingHours,
      appointments: dayAppointments,
      blockedSchedules,
    });
    if (isDev)
      console.log(
        `[Slots] generatedSlots count=${result.length} (after internal blocks/appts filtering)`,
      );
    return result;
  }, [
    selectedDate,
    selectedService,
    profile,
    dayAppointments,
    blockedSchedules,
  ]);

  const [wasRestored, setWasRestored] = useState(false);

  // Re-validation logic for restored slots
  useEffect(() => {
    // Only validate if we have a full target to check against AND we finished loading
    if (
      wasRestored &&
      selectedDate &&
      selectedTime &&
      !isLoadingSlots &&
      dayAppointments.length >= 0
    ) {
      const isStillAvailable = availableSlots.includes(selectedTime);

      if (!isStillAvailable) {
        setSelectedDate("");
        setSelectedTime("");
        setStep(3);
        notify.error("Este horário não está mais disponível.", undefined, {
          description:
            "A profissional pode ter recebido outra reserva ou alterado a agenda. Por favor, escolha um novo horário.",
        });
      }
      setWasRestored(false);
    }
  }, [
    wasRestored,
    selectedDate,
    selectedTime,
    availableSlots,
    dayAppointments,
    isLoadingSlots,
  ]);

  const handleClearDraft = () => {
    localStorage.removeItem("booking_draft");
    setSelectedService(null);
    setSelectedDate("");
    setSelectedTime("");
    setClientName("");
    setClientPhone("");
    setClientEmail("");
    setClientAddress("");
    setAddressStreet("");
    setAddressNumber("");
    setAddressComplement("");
    setAddressNeighborhood("");
    setAddressCity(profile?.city || "");
    setAddressReference("");
    setSelectedArea(null);
    setBookingMode(null);
    setStep(2);
    setShowRestoreDraft(false);
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const handleApplyCoupon = async () => {
    const profId = profile?.professionalId || profile?.uid;
    if (!couponCode.trim() || !profId) return;
    setIsCheckingCoupon(true);
    setCouponError("");
    try {
      const q = query(
        collection(db, "coupons"),
        where("professionalId", "==", profId),
        where("code", "==", couponCode.trim().toUpperCase()),
        where("active", "==", true),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setCouponError("Cupom não encontrado ou inativo.");
        setAppliedCoupon(null);
        return;
      }
      const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;

      // Validations
      if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
        setCouponError("Este cupom expirou.");
        setAppliedCoupon(null);
        return;
      }
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        setCouponError("Este cupom esgotado.");
        setAppliedCoupon(null);
        return;
      }

      // Applicable Services Check
      const applicableIds =
        coupon.applicableServiceIds || coupon.serviceIds || [];
      if (
        applicableIds.length > 0 &&
        selectedService &&
        !applicableIds.includes(selectedService.id)
      ) {
        setCouponError("Este cupom não é válido para o serviço selecionado.");
        setAppliedCoupon(null);
        return;
      }

      // Per-Client Limit Check
      if (coupon.perClientLimit === 1) {
        const appointmentsRef = collection(db, "appointments");
        const cleanPhone = clientPhone.replace(/\D/g, "");
        const cleanEmail = clientEmail.trim().toLowerCase();

        // Check if client info is present
        if (!cleanPhone && !cleanEmail) {
          setCouponError(
            "Preencha seu nome, WhatsApp e e-mail antes de aplicar o cupom.",
          );
          setAppliedCoupon(null);
          return;
        }

        const q = query(
          appointmentsRef,
          where("professionalId", "==", profId),
          where("appliedCouponCode", "==", coupon.code),
        );

        const snap = await getDocs(q);
        const alreadyUsed = snap.docs.some((doc) => {
          const data = doc.data();
          return (
            isActiveSlotStatus(data.status) &&
            (data.clientWhatsapp === cleanPhone ||
              data.clientEmail === cleanEmail)
          );
        });

        if (alreadyUsed) {
          setCouponError("Você já utilizou este cupom.");
          setAppliedCoupon(null);
          return;
        }
      }

      setAppliedCoupon(coupon);
      notify.success(`Cupom "${coupon.code}" aplicado!`);
    } catch (err) {
      console.error("Error checking coupon:", err);
      setCouponError("Erro ao verificar cupom.");
    } finally {
      setIsCheckingCoupon(false);
    }
  };

  // Urgency logic based on real availability
  const urgencyInfo = useMemo(() => {
    if (!selectedDate || !availableSlots.length) return null;

    const count = availableSlots.length;

    if (count >= 1 && count <= 3) {
      return {
        message: "Últimos horários disponíveis",
        isUrgent: true,
      };
    }

    if (count >= 4 && count <= 8) {
      return {
        message: "Agenda com boa procura",
        isUrgent: false,
      };
    }

    return null;
  }, [selectedDate, availableSlots]);

  const fullSlotsFetchedRef = useRef(false);

  useEffect(() => {
    const profId = profile?.professionalId || profile?.uid;

    if (!open) {
      fullSlotsFetchedRef.current = false;
      return;
    }

    if (
      !selectedDate ||
      !profId ||
      profId === "undefined" ||
      profId === "null"
    ) {
      if (isDev)
        console.log(
          `[Slots] Aborting fetch: Invalid professional ID (${profId})`,
        );
      return;
    }

    if (fullSlotsFetchedRef.current && !slotsLoadError) {
      return; // Already loaded full 15-day window
    }

    let isMounted = true;
    setIsLoadingSlots(true);
    setSlotsLoadError(null);
    if (isDev)
      console.log(`[Slots] start - Date: ${selectedDate}, Pro: ${profId}`);
    if (isDev) console.log(`[Slots] selectedService ID:`, selectedService?.id);
    if (isDev)
      console.log(
        `[Slots] serviceDuration:`,
        Number(selectedService?.duration),
      );
    if (isDev)
      console.log(
        `[Slots] businessHours/professional availability:`,
        profile?.workingHours,
      );

    const fetchAvailabilityData = async () => {
      try {
        let currentBlocked: any[] = [];
        let currentAppts: any[] = [];

        // 1. Fetch Blocked Schedules (we fetch this every time the date changes to ensure we have the latest, though it fetches all for the pro)
        try {
          if (isDev) console.log(`[Slots] blockedTimes query start`);
          const blockedRef = collection(db, "blocked_schedules");
          const blockedSnap = await getDocs(
            query(blockedRef, where("professionalId", "==", profId)),
          );
          currentBlocked = blockedSnap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as any,
          );
          if (isDev)
            console.log(
              `[Slots] blockedTimes query success count=${currentBlocked.length}`,
            );
        } catch (err) {
          if (isDev)
            console.error("[Slots] error actual= blockedTimes query:", err);
        }

        // 2. Fetch Appointments securely via backend
        try {
          if (isDev) console.log(`[Slots] fetching occupied slots securely`);

          let fetchTimeoutId: any;
          const fetchTimeoutPromise = new Promise<never>((_, reject) => {
            fetchTimeoutId = setTimeout(
              () => reject(new Error("FETCH_TIMEOUT")),
              20000,
            );
          });
          fetchTimeoutPromise.catch(() => {});

          const today = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 15);
          const startStr = formatDateKey(today);
          const endStr = formatDateKey(endDate);

          const res = await Promise.race([
            fetch(
              `/api/public/occupied-slots/${profId}?start=${startStr}&end=${endStr}`,
            ),
            fetchTimeoutPromise,
          ]);
          clearTimeout(fetchTimeoutId);

          if (res instanceof Response && res.ok) {
            const data = await res.json();
            const allAppts = data.slots as Appointment[];
            currentAppts = allAppts.filter((a) => isActiveSlotStatus(a.status));
            if (isDev)
              console.log(
                `[Slots] appointments fetch success count=${currentAppts.length}`,
              );
          } else {
            console.error(
              "[Slots] Error fetching occupied slots, res not ok",
              res,
            );
            setSlotsLoadError("timeout");
            setSelectedTime("");
            return; // Abort loading slots if backend request failed
          }
        } catch (error) {
          if (isDev)
            console.error(`[Slots] error actual= appointments fetch:`, error);
          setSlotsLoadError("timeout");
          setSelectedTime("");
          return; // Abort loading slots on network error/timeout
        }

        if (!isMounted) return;

        setBlockedSchedules(currentBlocked);
        setDayAppointments(currentAppts);
        fullSlotsFetchedRef.current = true;
        if (isDev)
          console.log(
            `[Slots] arrays set. currentAppts: ${currentAppts.length}, currentBlocked: ${currentBlocked.length}`,
          );
      } catch (error) {
        if (isDev)
          console.error(`[Slots] error actual= general fetch error:`, error);
      } finally {
        if (isMounted) {
          setIsLoadingSlots(false);
          if (isDev) console.log(`[Slots] finally setIsLoadingSlots(false)`);
        }
      }
    };

    fetchAvailabilityData();

    return () => {
      isMounted = false;
    };
  }, [
    selectedDate,
    profile?.professionalId,
    profile?.uid,
    open,
    retrySlotsCount,
  ]);

  const getTravelFee = () => {
    if (bookingMode !== "home") return 0;
    if (profile?.travelFeeMode === "fixed") {
      return Number(profile.fixedTravelFee) || 0;
    }
    return selectedArea?.fee || 0;
  };

  const calculateTotalPrice = () => {
    let basePrice = 0;
    allSelectedServices.forEach((s) => (basePrice += Number(s.price) || 0));
    if (basePrice === 0) return 0;
    const total = basePrice + getTravelFee();

    if (appliedCoupon) {
      if (appliedCoupon.type === "percentage") {
        return Math.max(0, total - (total * appliedCoupon.value) / 100);
      }
      return Math.max(0, total - appliedCoupon.value);
    }

    return total;
  };

  const handleBooking = async () => {
    const totalPrice = calculateTotalPrice();

    setBookingAttempted(true);

    const profId = profile?.professionalId || profile?.uid;
    if (
      !profId ||
      profId === "undefined" ||
      profId === "null" ||
      !selectedService?.id ||
      (selectedService?.price ?? 0) < 0
    ) {
      if (isDev) {
        console.error("[BOOKING_ERROR] Invalid service or profile data", {
          service: selectedService,
          profileId: profId,
        });
      }
      notify.error("Dados de agendamento incompletos ou inválidos.");
      return;
    }

    // Core validations
    const isBaseValid =
      clientName.trim().length >= 2 && clientPhone.trim() && clientEmail.trim();
    let isAddressValid = true;

    if (isHomeService) {
      isAddressValid = !!(
        addressStreet.trim() &&
        addressNumber.trim() &&
        (addressNeighborhood.trim() || selectedArea?.name) &&
        (addressCity.trim() || profile?.city)
      );
    }

    if (!isBaseValid || !isAddressValid) {
      notify.error(
        "Por favor, preencha todos os campos obrigatórios corretamente.",
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail.trim())) {
      notify.error("O e-mail informado parece não ser válido.");
      return;
    }

    setBookingLoading(true);
    try {
      // Final availability check before submitting
      const availabilityCheck = canBookSlot({
        date: selectedDate,
        time: selectedTime,
        workingHours: profile.workingHours,
        appointments: dayAppointments,
        blockedSchedules,
        serviceDuration: totalDuration || 60,
      });

      if (!availabilityCheck.canBook) {
        notify.error("Este horário não está mais disponível.", undefined, {
          description:
            availabilityCheck.reason || "Por favor, escolha outro horário.",
        });
        setStep(1);
        setBookingLoading(false);
        return;
      }

      const totalPrice = calculateTotalPrice();

      const structuredAddress = isHomeService
        ? {
            street: addressStreet.trim(),
            number: addressNumber.trim(),
            complement: addressComplement.trim(),
            neighborhood:
              addressNeighborhood.trim() || selectedArea?.name || "",
            city: addressCity.trim() || profile?.city || "",
            reference: addressReference.trim(),
          }
        : undefined;

      const paymentMethodsList = (profile.paymentMethods || []).map((id) => {
        const names: Record<string, string> = {
          pix: "Pix",
          credito: "Cartão de crédito",
          debito: "Cartão de débito",
          dinheiro: "Dinheiro",
          transferencia: "Transferência",
        };
        return names[id] || id;
      });

      let bookingId = "";
      let token = "";
      let resCode = "";

      if (profile.professionalId === "demo-helena-prado") {
        // Simulate a delay
        await new Promise((r) => setTimeout(r, 1500));
        bookingId = "demo-booking-123";
        token = "demo-token";
        resCode = "HPRADO01";
      } else {
        const result = await createBookingRequest({
          professionalId: profile.professionalId || profile.uid,
          professionalName: profile.name,
          professionalWhatsapp: profile.whatsapp,
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          additionalServices: additionalServices.map((s) => ({
            id: s.id,
            name: s.name,
            duration: Number(s.duration) || 0,
            price: s.price,
          })),
          duration: totalDuration || 60,
          price: selectedService.price,
          travelFee: getTravelFee(),
          totalPrice: totalPrice,
          locationType: isHomeService ? "home" : "studio",
          neighborhood:
            (isHomeService
              ? addressNeighborhood.trim() || selectedArea?.name
              : profile.neighborhood) || "",
          address: structuredAddress,
          clientName: clientName.trim(),
          clientWhatsapp: clientPhone.replace(/\D/g, ""),
          clientEmail: clientEmail.trim().toLowerCase(),
          date: selectedDate,
          time: selectedTime,
          couponId: appliedCoupon?.id,
          appliedCouponCode: appliedCoupon?.code,
        });
        bookingId = result.bookingId;
        token = result.token;
        resCode = result.reservationCode || "";
      }

      setAppointmentId(bookingId);
      setAppointmentToken(token);
      setReservationCode(resCode || null);
      setBookingSuccess(true);

      // Post-booking notifications (BOOKING_PENDING_CLIENT and NEW_BOOKING_REQUEST)
      // are now handled safely and securely by the backend inside the
      // /api/public/create-booking endpoint.

      // If booking from waitlist, mark it as booked
      if (waitlistEntry?.id && profile.professionalId !== "demo-helena-prado") {
        await markWaitlistAsBooked(waitlistEntry.id);
      }

      localStorage.removeItem("booking_draft");
      setTimeout(() => {
        setStep(4);
      }, 800);
    } catch (error: any) {
      if (isDev) {
        if (!(window as any).__BOOKING_DEBUG__)
          (window as any).__BOOKING_DEBUG__ = [];
        (window as any).__BOOKING_DEBUG__.push(
          `[FATAL ERROR] ${error.message || error}`,
        );
      }
      handleBookingError(error);
    } finally {
      setBookingLoading(false);
    }
  };

  if (!open && step !== 4) return null;

  const totalSteps = 3;

  return (
    <>
      <AnimatePresence>
        {showRestoreDraft && step === 2 && (
          <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-md z-[600] flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-brand-white w-full max-w-md rounded-[40px] p-10 text-center shadow-2xl border border-brand-mist"
            >
              <div className="w-16 h-16 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mx-auto mb-8">
                <Clock size={32} />
              </div>
              <h3 className="text-2xl font-serif text-brand-ink mb-3">
                Seu horário ainda pode estar disponível.
              </h3>
              <p className="text-sm text-brand-stone font-light mb-10 leading-relaxed">
                Continue sua reserva de onde parou.
              </p>
              <div className="flex flex-col gap-4">
                <PremiumButton
                  variant="terracotta"
                  className="w-full py-6"
                  onClick={handleRestoreDraft}
                >
                  Continuar Reserva
                </PremiumButton>
                <button
                  onClick={handleClearDraft}
                  className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone hover:text-brand-ink transition-colors py-2"
                >
                  Começar novamente
                </button>
                {clientPhone && profile.plan === "pro" && (
                  <div className="mt-6 pt-6 border-t border-brand-mist">
                    <p className="text-[10px] text-brand-stone uppercase tracking-widest mb-4">
                      Precisa de ajuda?
                    </p>
                    <a
                      href={buildWhatsappLink(
                        profile.whatsapp,
                        "Olá! Estava iniciando um agendamento e gostaria de tirar uma dúvida.",
                      )}
                      target="_blank"
                      className="flex items-center justify-center gap-2 text-brand-ink font-medium text-xs hover:text-brand-terracotta transition-colors"
                    >
                      <MessageCircle size={16} /> Fale direto com a profissional
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && step >= 1 && step <= 4 && (
          <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-[200] flex items-end md:items-center justify-center p-0 md:p-6 overflow-hidden">
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-brand-white w-full max-w-2xl rounded-t-[40px] md:rounded-[40px] p-6 sm:p-8 md:p-12 shadow-2xl relative max-h-[95dvh] md:max-h-[90vh] overflow-y-auto no-scrollbar pb-[calc(140px+env(safe-area-inset-bottom))] md:pb-12"
            >
              <button
                onClick={onClose}
                className="absolute right-8 top-8 text-brand-stone hover:text-brand-ink transition-colors"
              >
                <X size={24} />
              </button>

              {profile.professionalId === "demo-helena-prado" && (
                <div className="mb-6 p-4 bg-brand-linen/60 border border-brand-mist/50 rounded-2xl text-[11px] font-medium text-brand-stone text-center max-w-lg mx-auto">
                  Você está visualizando uma{" "}
                  <strong className="text-brand-ink">
                    vitrine de demonstração oficial da Nera
                  </strong>
                  .
                  <br />O processo de reserva a seguir é apenas ilustrativo e
                  não gerará compromissos reais.
                </div>
              )}

              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <BookingStep
                    step={1}
                    total={totalSteps}
                    title="Escolha o serviço e horário"
                  />

                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                        Serviços Selecionados
                      </label>
                      <div className="space-y-3">
                        {allSelectedServices.map((service, idx) => (
                          <div
                            key={service.id + idx}
                            className="w-full p-4 md:p-6 text-left rounded-[24px] bg-brand-linen/30 border border-brand-mist flex justify-between items-center group relative overflow-hidden"
                          >
                            <div className="flex-1 relative z-10 flex items-center gap-3">
                              <div className="w-5 h-5 rounded-full bg-brand-terracotta/10 flex items-center justify-center shrink-0">
                                <Check
                                  size={12}
                                  className="text-brand-terracotta"
                                />
                              </div>
                              <div>
                                <h4 className="font-serif text-lg text-brand-ink">
                                  {service.name || "Serviço"}
                                </h4>
                                <span className="text-[10px] uppercase tracking-widest opacity-60 text-brand-stone">
                                  {service.duration || 0} min
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-xl font-serif text-brand-terracotta relative z-10">
                                {formatCurrency(service.price || 0)}
                              </div>
                              {idx > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAdditionalServices((prev) =>
                                      prev.filter((_, i) => i !== idx - 1),
                                    );
                                  }}
                                  className="text-brand-stone/50 hover:text-brand-terracotta transition-colors p-2"
                                  aria-label="Remover serviço"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {!showServiceSelector ? (
                        <button
                          onClick={() => {
                            setShowServiceSelector(true);
                            setSelectedServiceCategory(null);
                          }}
                          className="w-full py-4 text-[10px] font-bold text-brand-ink uppercase tracking-widest border border-dashed border-brand-mist rounded-[20px] hover:border-brand-ink hover:bg-brand-linen/30 transition-all"
                        >
                          + Adicionar outro serviço
                        </button>
                      ) : (
                        <div className="mt-4 p-4 md:p-6 border border-brand-mist rounded-[24px] bg-brand-white">
                          <div className="flex justify-between items-center mb-6">
                            {selectedServiceCategory ? (
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() =>
                                    setSelectedServiceCategory(null)
                                  }
                                  className="w-8 h-8 rounded-full border border-brand-mist flex items-center justify-center text-brand-stone hover:text-brand-ink hover:border-brand-ink transition-all"
                                >
                                  <ChevronLeft size={16} />
                                </button>
                                <h5 className="font-serif text-brand-ink text-lg uppercase tracking-wider">
                                  {selectedServiceCategory}
                                </h5>
                              </div>
                            ) : (
                              <h5 className="font-serif text-brand-ink text-lg">
                                Adicionar Serviço
                              </h5>
                            )}
                            <button
                              onClick={() => {
                                setShowServiceSelector(false);
                                setSelectedServiceCategory(null);
                              }}
                              className="text-brand-stone hover:text-brand-ink"
                            >
                              <X size={20} />
                            </button>
                          </div>

                          <div className="max-h-[300px] overflow-y-auto no-scrollbar">
                            {(() => {
                              const availableServices = services.filter(
                                (s) =>
                                  !allSelectedServices.some(
                                    (as) => as.id === s.id,
                                  ),
                              );

                              if (availableServices.length === 0) {
                                return (
                                  <p className="text-[10px] uppercase tracking-widest text-brand-stone text-center py-4">
                                    Nenhum serviço extra disponível.
                                  </p>
                                );
                              }

                              if (!selectedServiceCategory) {
                                const categories = Array.from(
                                  new Set(
                                    availableServices.map(
                                      (s) => s.category || "Outros",
                                    ),
                                  ),
                                );
                                return (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {categories.map((cat) => (
                                      <button
                                        key={cat}
                                        onClick={() =>
                                          setSelectedServiceCategory(cat)
                                        }
                                        className="w-full p-4 text-left rounded-2xl border border-brand-mist hover:border-brand-ink hover:bg-brand-linen/30 transition-all flex justify-between items-center group"
                                      >
                                        <span className="font-serif text-brand-ink uppercase tracking-wider text-sm">
                                          {cat}
                                        </span>
                                        <ChevronRight
                                          size={16}
                                          className="text-brand-stone opacity-50 group-hover:opacity-100 group-hover:text-brand-ink transition-all"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                );
                              }

                              const filteredServices = availableServices.filter(
                                (s) =>
                                  (s.category || "Outros") ===
                                  selectedServiceCategory,
                              );
                              return (
                                <div className="space-y-2 pr-2">
                                  {filteredServices.map((service) => (
                                    <button
                                      key={service.id}
                                      onClick={() => {
                                        setAdditionalServices((prev) => [
                                          ...prev,
                                          service,
                                        ]);
                                        setShowServiceSelector(false);
                                        setSelectedServiceCategory(null);
                                      }}
                                      className="w-full p-4 text-left rounded-2xl border border-brand-mist hover:border-brand-ink hover:bg-brand-linen/30 transition-all flex justify-between items-center"
                                    >
                                      <div>
                                        <h4 className="font-serif text-brand-ink">
                                          {service.name}
                                        </h4>
                                        <span className="text-[10px] uppercase tracking-widest text-brand-stone opacity-60">
                                          {service.duration || 0} min
                                        </span>
                                      </div>
                                      <div className="font-serif text-brand-terracotta">
                                        {formatCurrency(service.price || 0)}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      <div className="p-4 md:p-5 bg-brand-ink rounded-[24px] text-brand-white">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] uppercase tracking-widest font-bold">
                            {allSelectedServices.length}{" "}
                            {allSelectedServices.length === 1
                              ? "serviço selecionado"
                              : "serviços selecionados"}
                          </span>
                          <span className="text-[10px] uppercase tracking-widest font-bold text-brand-white/50">
                            {totalDuration} min
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase tracking-widest text-brand-white/70">
                            Subtotal
                          </span>
                          <div className="font-serif text-lg text-brand-terracotta">
                            {formatCurrency(
                              allSelectedServices.reduce(
                                (acc, s) => acc + (Number(s.price) || 0),
                                0,
                              ),
                            )}
                          </div>
                        </div>
                        {getTravelFee() > 0 && (
                          <div className="mt-2 pt-2 border-t border-brand-white/10 flex justify-between items-center opacity-80">
                            <span className="text-[9px] uppercase tracking-widest">
                              + {formatCurrency(getTravelFee())} deslocamento
                            </span>
                            <span className="text-[11px] font-serif">
                              Total: {formatCurrency(calculateTotalPrice())}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-8 border-t border-brand-mist/30">
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1 block">
                          Selecione o melhor momento
                        </label>
                        <div className="hidden md:flex items-center gap-1">
                          <button
                            onClick={() => scrollDates("left")}
                            className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                              showLeftScroll
                                ? "bg-brand-linen text-brand-ink hover:bg-brand-mist"
                                : "bg-transparent text-brand-stone/30 cursor-default",
                            )}
                            disabled={!showLeftScroll}
                            aria-label="Rolar para a esquerda"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <button
                            onClick={() => scrollDates("right")}
                            className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                              showRightScroll
                                ? "bg-brand-linen text-brand-ink hover:bg-brand-mist"
                                : "bg-transparent text-brand-stone/30 cursor-default",
                            )}
                            disabled={!showRightScroll}
                            aria-label="Rolar para a direita"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <div
                          className={cn(
                            "hidden md:block absolute left-0 top-0 bottom-4 w-6 bg-gradient-to-r from-brand-white to-transparent z-10 pointer-events-none transition-opacity duration-300",
                            showLeftScroll ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div
                          className={cn(
                            "hidden md:block absolute right-0 top-0 bottom-4 w-6 bg-gradient-to-l from-brand-white to-transparent z-10 pointer-events-none transition-opacity duration-300",
                            showRightScroll ? "opacity-100" : "opacity-0",
                          )}
                        />

                        <div
                          ref={dateScrollRef}
                          onScroll={handleDateScroll}
                          className="flex overflow-x-auto gap-3 pb-4 mb-6 no-scrollbar -mx-2 px-2"
                        >
                          {[
                            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
                          ].map((offset) => {
                            const date = new Date();
                            date.setDate(date.getDate() + offset);
                            const dateStr = formatDateKey(date);
                            const isSelected = selectedDate === dateStr;
                            const dayOfWeek = date.getDay();
                            const isWorkingDay =
                              profile?.workingHours?.workingDays?.includes(
                                dayOfWeek,
                              );
                            return (
                              <button
                                key={offset}
                                onClick={() => {
                                  if (!isWorkingDay) {
                                    notify.info(
                                      "A profissional não atende neste dia",
                                    );
                                    return;
                                  }
                                  setSelectedDate(dateStr);
                                  setSelectedTime("");
                                }}
                                className={cn(
                                  "min-w-[70px] aspect-[4/5] rounded-2xl flex flex-col items-center justify-center transition-all border shrink-0",
                                  isSelected
                                    ? "bg-brand-ink text-brand-white border-brand-ink premium-shadow scale-105"
                                    : isWorkingDay
                                      ? "bg-brand-parchment border-brand-mist hover:border-brand-ink"
                                      : "bg-brand-mist/10 border-transparent text-brand-stone/40 cursor-not-allowed",
                                )}
                              >
                                <span
                                  className={cn(
                                    "text-[8px] font-bold uppercase tracking-widest mb-1",
                                    isWorkingDay ? "opacity-40" : "opacity-20",
                                  )}
                                >
                                  {date
                                    .toLocaleDateString("pt-BR", {
                                      weekday: "short",
                                    })
                                    .replace(".", "")}
                                </span>
                                <span
                                  className={cn(
                                    "text-lg font-serif",
                                    !isWorkingDay && "opacity-40",
                                  )}
                                >
                                  {date.getDate()}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {selectedDate ? (
                          !profile?.workingHours ? (
                            <div className="col-span-3 py-10 text-center bg-brand-linen/30 rounded-3xl border border-dashed border-brand-mist px-6">
                              <p className="text-[10px] text-brand-stone font-bold uppercase tracking-widest mb-2">
                                Sem expediente
                              </p>
                              <p className="text-[9px] text-brand-stone/60">
                                Esta profissional ainda não configurou horários
                                de atendimento.
                              </p>
                            </div>
                          ) : slotsLoadError ? (
                            <div className="col-span-3 py-10 text-center bg-brand-linen/30 rounded-3xl border border-dashed border-brand-mist px-6">
                              <p className="text-[10px] text-brand-stone font-bold uppercase tracking-widest mb-2">
                                Não conseguimos carregar os horários agora.
                              </p>
                              <p className="text-[9px] text-brand-stone/60 mb-4">
                                Verifique sua conexão ou tente novamente.
                              </p>
                              <button
                                onClick={() => setRetrySlotsCount((c) => c + 1)}
                                className="px-4 py-2 border border-brand-sand text-brand-navy rounded-full text-[10px] hover:bg-brand-sand/20 transition-colors mx-auto block"
                              >
                                Tentar novamente
                              </button>
                            </div>
                          ) : isLoadingSlots ? (
                            <div className="col-span-3 space-y-4 py-2">
                              <p className="text-[10px] font-bold text-brand-stone uppercase tracking-widest text-center animate-pulse">
                                Buscando horários disponíveis...
                              </p>
                              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                  <div
                                    key={i}
                                    className="py-3.5 rounded-xl border border-brand-mist bg-brand-mist/10 animate-pulse h-[42px] flex items-center justify-center"
                                  >
                                    <div className="h-3 w-12 bg-brand-mist/40 rounded-full"></div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : availableSlots.length > 0 ? (
                            availableSlots.map((time) => (
                              <button
                                key={time}
                                onClick={() => setSelectedTime(time)}
                                className={cn(
                                  "py-3.5 rounded-xl border transition-all text-[11px] font-bold flex items-center justify-center gap-1.5",
                                  selectedTime === time
                                    ? "bg-brand-ink text-brand-white border-brand-ink"
                                    : "bg-brand-white border-brand-mist hover:border-brand-ink text-brand-stone",
                                )}
                              >
                                <Clock
                                  size={12}
                                  className={
                                    selectedTime === time
                                      ? "text-brand-terracotta"
                                      : "text-brand-mist/40"
                                  }
                                />
                                {time}
                              </button>
                            ))
                          ) : features?.waitlist ? (
                            <div className="col-span-3 py-10 text-center bg-brand-linen/30 rounded-3xl border border-dashed border-brand-mist px-6">
                              <p className="text-[10px] text-brand-terracotta font-bold uppercase tracking-widest mb-2">
                                Alta procura neste dia
                              </p>
                              <button
                                onClick={() => setIsWaitlistOpen(true)}
                                className="flex items-center gap-2 bg-brand-ink text-brand-white px-5 py-3 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-xl mx-auto"
                              >
                                <Zap
                                  size={12}
                                  className="fill-brand-terracotta text-brand-terracotta"
                                />{" "}
                                Entrar na Lista
                              </button>
                            </div>
                          ) : (
                            <div className="col-span-3 py-10 text-center bg-brand-linen/30 rounded-3xl border border-dashed border-brand-mist px-6">
                              <p className="text-[10px] text-brand-stone font-bold uppercase tracking-widest mb-2">
                                Não há horários disponíveis neste dia.
                              </p>
                              <p className="text-[9px] text-brand-stone/60">
                                Escolha outra data ou fale diretamente com a
                                profissional.
                              </p>
                            </div>
                          )
                        ) : (
                          <div className="col-span-3 py-10 text-center bg-brand-parchment/50 rounded-3xl border border-dashed border-brand-mist">
                            <p className="text-[10px] text-brand-stone font-light italic uppercase tracking-widest">
                              Selecione uma data acima
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <PremiumButton
                      className="w-full mt-8 hidden md:flex"
                      variant="terracotta"
                      disabled={
                        !selectedService ||
                        !selectedDate ||
                        !selectedTime ||
                        isLoadingSlots ||
                        !!slotsLoadError
                      }
                      onClick={() => setStep(2)}
                    >
                      Próximo Passo <ArrowRight size={18} className="ml-1" />
                    </PremiumButton>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <button
                      onClick={() => setStep(1)}
                      className="text-brand-stone hover:text-brand-ink"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <BookingStep
                      step={2}
                      total={totalSteps}
                      title="Seus Dados"
                    />
                  </div>

                  <div className="space-y-6">
                    {profile.serviceMode === "hybrid" && (
                      <div className="space-y-4">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                          Onde prefere o atendimento?
                        </label>
                        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
                          <button
                            onClick={() => setBookingMode("studio")}
                            className={cn(
                              "flex items-start gap-4 p-5 rounded-3xl border transition-all text-left",
                              bookingMode === "studio"
                                ? "bg-brand-ink text-brand-white border-brand-ink"
                                : "bg-brand-white border-brand-mist text-brand-stone hover:border-brand-ink/30",
                            )}
                          >
                            <Building2
                              size={24}
                              className={cn(
                                "shrink-0",
                                bookingMode === "studio"
                                  ? "text-brand-terracotta"
                                  : "text-brand-mist",
                              )}
                            />
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-widest mb-1 leading-tight">
                                Atendimento
                                <br />
                                no Estúdio
                              </div>
                              <div
                                className={cn(
                                  "text-[9px] leading-tight",
                                  bookingMode === "studio"
                                    ? "text-brand-white/70"
                                    : "text-brand-stone/60",
                                )}
                              >
                                No espaço da profissional
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() => setBookingMode("home")}
                            className={cn(
                              "flex items-start gap-4 p-5 rounded-3xl border transition-all text-left",
                              bookingMode === "home"
                                ? "bg-brand-ink text-brand-white border-brand-ink"
                                : "bg-brand-white border-brand-mist text-brand-stone hover:border-brand-ink/30",
                            )}
                          >
                            <Home
                              size={24}
                              className={cn(
                                "shrink-0",
                                bookingMode === "home"
                                  ? "text-brand-terracotta"
                                  : "text-brand-mist",
                              )}
                            />
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-widest mb-1 leading-tight">
                                Atendimento
                                <br />
                                em Domicílio
                              </div>
                              <div
                                className={cn(
                                  "text-[9px] leading-tight",
                                  bookingMode === "home"
                                    ? "text-brand-white/70"
                                    : "text-brand-stone/60",
                                )}
                              >
                                No seu endereço
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 mb-8">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                          Seu Nome{" "}
                          <span className="text-brand-terracotta">*</span>
                        </label>
                        <input
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="Nome completo"
                          className={cn(
                            "w-full px-5 py-4 min-h-[56px] bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-xs",
                            clientName.trim().length < 2 && bookingAttempted
                              ? "border-brand-terracotta ring-1 ring-brand-terracotta/20"
                              : "border-brand-mist",
                          )}
                        />
                        {clientName.trim().length < 2 && bookingAttempted && (
                          <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">
                            Digite seu nome completo
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 md:gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                            WhatsApp{" "}
                            <span className="text-brand-terracotta">*</span>
                          </label>
                          <input
                            type="tel"
                            value={formatWhatsappDisplay(clientPhone)}
                            onChange={(e) =>
                              setClientPhone(cleanWhatsapp(e.target.value))
                            }
                            placeholder="(85) 99999-9999"
                            className={cn(
                              "w-full px-5 py-4 min-h-[56px] bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-xs min-w-0",
                              !clientPhone && bookingAttempted
                                ? "border-brand-terracotta ring-1 ring-brand-terracotta/20"
                                : "border-brand-mist",
                            )}
                          />
                          {!clientPhone && bookingAttempted && (
                            <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">
                              WhatsApp obrigatório
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1 truncate">
                            E-mail{" "}
                            <span className="text-brand-terracotta">*</span>
                          </label>
                          <input
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            value={clientEmail}
                            onChange={(e) => setClientEmail(e.target.value)}
                            placeholder="Ex: seu@email.com"
                            className={cn(
                              "w-full px-5 py-4 min-h-[56px] bg-brand-parchment border rounded-[18px] outline-none focus:ring-1 focus:ring-brand-ink transition-all text-xs min-w-0",
                              !clientEmail && bookingAttempted
                                ? "border-brand-terracotta ring-1 ring-brand-terracotta/20"
                                : "border-brand-mist",
                            )}
                          />
                          {!clientEmail && bookingAttempted && (
                            <p className="text-[9px] text-brand-terracotta font-bold uppercase tracking-wider ml-2 mt-1">
                              E-mail obrigatório
                            </p>
                          )}
                          <p className="text-[9px] text-brand-stone/70 font-medium ml-2 mt-2 leading-relaxed italic">
                            Usaremos seu e-mail para enviar confirmações,
                            atualizações da reserva e informações importantes
                            sobre seu atendimento.
                          </p>
                        </div>
                      </div>

                      {isHomeService && (
                        <div className="space-y-6 pt-4 mt-4 border-t border-brand-mist/30">
                          <div className="flex items-center gap-2 mb-2">
                            <Home size={14} className="text-brand-terracotta" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink">
                              Endereço do Atendimento
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-3 space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                                Rua{" "}
                                <span className="text-brand-terracotta">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Nome da rua"
                                value={addressStreet}
                                onChange={(e) =>
                                  setAddressStreet(e.target.value)
                                }
                                className={cn(
                                  "w-full px-4 py-3 min-h-[48px] bg-brand-parchment border rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink transition-all",
                                  !addressStreet && bookingAttempted
                                    ? "border-brand-terracotta"
                                    : "border-brand-mist",
                                )}
                              />
                            </div>
                            <div className="col-span-1 space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                                Nº{" "}
                                <span className="text-brand-terracotta">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="123"
                                value={addressNumber}
                                onChange={(e) =>
                                  setAddressNumber(e.target.value)
                                }
                                className={cn(
                                  "w-full px-2 py-3 min-h-[48px] bg-brand-parchment border rounded-xl text-xs text-center outline-none focus:ring-1 focus:ring-brand-ink transition-all",
                                  !addressNumber && bookingAttempted
                                    ? "border-brand-terracotta"
                                    : "border-brand-mist",
                                )}
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                              Complemento
                            </label>
                            <input
                              type="text"
                              placeholder="Apto, Bloco, etc."
                              value={addressComplement}
                              onChange={(e) =>
                                setAddressComplement(e.target.value)
                              }
                              className="w-full px-4 py-3 bg-brand-parchment border border-brand-mist rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink transition-all"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                                Região/Bairro{" "}
                                <span className="text-brand-terracotta">*</span>
                              </label>
                              {profile?.serviceAreas &&
                              profile.serviceAreas.length > 0 &&
                              profile.travelFeeMode !== "fixed" ? (
                                <select
                                  value={selectedArea?.name || ""}
                                  onChange={(e) => {
                                    const area = profile.serviceAreas?.find(
                                      (a) => a.name === e.target.value,
                                    );
                                    if (area) {
                                      setSelectedArea(area);
                                      setAddressNeighborhood(area.name);
                                    } else {
                                      setSelectedArea(null);
                                      setAddressNeighborhood("");
                                    }
                                  }}
                                  className={cn(
                                    "w-full px-4 py-3 bg-brand-parchment border rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink transition-all appearance-none",
                                    !selectedArea && bookingAttempted
                                      ? "border-brand-terracotta"
                                      : "border-brand-mist",
                                  )}
                                >
                                  <option value="">
                                    Selecione sua região...
                                  </option>
                                  {profile.serviceAreas.map((area) => (
                                    <option key={area.name} value={area.name}>
                                      {area.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Sua vizinhança"
                                  value={
                                    addressNeighborhood ||
                                    selectedArea?.name ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    setAddressNeighborhood(e.target.value)
                                  }
                                  className={cn(
                                    "w-full px-4 py-3 bg-brand-parchment border rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink transition-all",
                                    !addressNeighborhood &&
                                      !selectedArea?.name &&
                                      bookingAttempted
                                      ? "border-brand-terracotta"
                                      : "border-brand-mist",
                                  )}
                                />
                              )}
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                                Cidade{" "}
                                <span className="text-brand-terracotta">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="Cidade"
                                value={addressCity || profile?.city || ""}
                                onChange={(e) => setAddressCity(e.target.value)}
                                className={cn(
                                  "w-full px-4 py-3 bg-brand-parchment border rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink transition-all",
                                  !addressCity &&
                                    !profile?.city &&
                                    bookingAttempted
                                    ? "border-brand-terracotta"
                                    : "border-brand-mist",
                                )}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">
                                Ponto de Referência
                              </label>
                              <input
                                type="text"
                                placeholder="Perto de onde?"
                                value={addressReference}
                                onChange={(e) =>
                                  setAddressReference(e.target.value)
                                }
                                className="w-full px-4 py-3 bg-brand-parchment border border-brand-mist rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-ink transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <p className="text-[9px] text-brand-stone/70 font-medium uppercase tracking-wider ml-2 mt-4 leading-relaxed italic">
                        Você receberá a confirmação e atualizações do
                        agendamento por e-mail.
                      </p>
                    </div>
                    <div className="hidden md:block">
                      <PremiumButton
                        className="w-full mt-8"
                        variant="terracotta"
                        disabled={
                          !clientName ||
                          !clientPhone ||
                          !clientEmail ||
                          (isHomeService && (!addressStreet || !addressNumber))
                        }
                        onClick={() => setStep(3)}
                      >
                        Revisar Agendamento{" "}
                        <ArrowRight size={18} className="ml-1" />
                      </PremiumButton>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <button
                      onClick={() => setStep(2)}
                      className="text-brand-stone hover:text-brand-ink"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <BookingStep
                      step={3}
                      total={totalSteps}
                      title="Revisão Final"
                    />
                  </div>

                  <div className="bg-brand-ink text-brand-white rounded-[32px] p-5 md:p-6 mb-6 shadow-xl relative overflow-hidden group">
                    <div className="flex flex-col relative z-10">
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-terracotta mb-3">
                        Resumo
                      </span>
                      <div className="flex flex-col md:flex-row justify-between items-start mb-5 gap-4">
                        <div className="space-y-3 w-full">
                          <div className="space-y-1">
                            {allSelectedServices.map((service, idx) => (
                              <h4
                                key={idx}
                                className="text-lg md:text-xl font-serif text-brand-linen flex justify-between items-center w-full"
                              >
                                <span>{service.name}</span>
                                <span className="text-sm text-brand-linen/60 font-sans">
                                  {formatCurrency(service.price)}
                                </span>
                              </h4>
                            ))}
                          </div>
                          <p className="text-xs font-light text-brand-linen/60 flex flex-wrap items-center gap-y-2 gap-x-3">
                            <span>
                              {selectedDate
                                ?.split("-")
                                .reverse()
                                .slice(0, 2)
                                .join("/")}{" "}
                              às {selectedTime}
                            </span>
                            <span className="w-px h-3 bg-brand-white/10" />
                            <span>{totalDuration} min</span>
                            <span className="w-px h-3 bg-brand-white/10" />
                            <span>
                              {isHomeService ? "Em Domicílio" : "No Estúdio"}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0 w-full md:w-auto p-4 md:p-0 bg-brand-white/5 md:bg-transparent rounded-2xl md:rounded-none">
                          {getTravelFee() > 0 && (
                            <div className="space-y-1 mb-3 pr-1 border-b border-brand-white/10 pb-3 md:border-b-0 md:pb-0">
                              <div className="flex justify-between md:justify-end gap-6 text-xs text-brand-linen/70">
                                <span>Subtotal</span>
                                <span>
                                  {formatCurrency(
                                    allSelectedServices.reduce(
                                      (acc, s) => acc + (Number(s.price) || 0),
                                      0,
                                    ),
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between md:justify-end gap-6 text-xs text-brand-linen/70">
                                <span>Deslocamento</span>
                                <span>{formatCurrency(getTravelFee())}</span>
                              </div>
                            </div>
                          )}
                          <div className="flex justify-between md:flex-col items-center md:items-end">
                            <div className="text-[10px] text-brand-linen/40 uppercase tracking-widest mb-1">
                              Total
                            </div>
                            <span className="text-2xl font-serif text-brand-terracotta">
                              {formatCurrency(calculateTotalPrice())}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-brand-white/10 space-y-3">
                        <div className="flex items-start gap-3">
                          <Check
                            size={14}
                            className="text-brand-terracotta mt-0.5 shrink-0"
                          />
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-linen">
                              {clientName}
                            </p>
                            <p className="text-[10px] text-brand-linen/60">
                              {formatWhatsappDisplay(clientPhone)}
                            </p>
                          </div>
                        </div>
                        {isHomeService && (
                          <div className="flex items-start gap-3">
                            <MapPin
                              size={14}
                              className="text-brand-terracotta mt-0.5 shrink-0"
                            />
                            <p className="text-[10px] text-brand-linen/60">
                              {addressStreet}, {addressNumber} -{" "}
                              {addressNeighborhood}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Coupon Section moved to step 3 */}
                  <div className="mb-8 space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-brand-stone">
                        Tenho um cupom
                      </p>
                      {!appliedCoupon && !couponCode && (
                        <span className="text-[8px] text-brand-stone/40 italic uppercase tracking-widest">
                          Opcional
                        </span>
                      )}
                    </div>

                    {!appliedCoupon ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) =>
                            setCouponCode(e.target.value.toUpperCase())
                          }
                          placeholder="DIGITE O CÓDIGO"
                          className="flex-1 px-5 py-3.5 bg-brand-parchment border border-brand-mist rounded-[18px] text-xs outline-none focus:ring-1 focus:ring-brand-ink transition-all uppercase font-mono tracking-widest"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={isCheckingCoupon || !couponCode.trim()}
                          className="px-6 py-3.5 bg-brand-ink text-brand-white rounded-[18px] text-[10px] font-bold uppercase tracking-widest disabled:opacity-40 transition-all active:scale-95"
                        >
                          {isCheckingCoupon ? "..." : "Validar"}
                        </button>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-brand-linen border border-brand-terracotta/20 p-4 rounded-2xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-terracotta/10 flex items-center justify-center text-brand-terracotta">
                            <Tag size={14} />
                          </div>
                          <div>
                            <p className="text-[10px] text-brand-ink font-bold uppercase tracking-widest">
                              {appliedCoupon.code}
                            </p>
                            <p className="text-[9px] text-brand-terracotta font-medium italic">
                              Desconto de{" "}
                              {appliedCoupon.type === "percentage"
                                ? appliedCoupon.value + "%"
                                : formatCurrency(appliedCoupon.value)}{" "}
                              aplicado
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setAppliedCoupon(null);
                            setCouponCode("");
                          }}
                          className="text-brand-stone hover:text-brand-ink transition-colors"
                        >
                          <CircleSlash size={16} />
                        </button>
                      </motion.div>
                    )}

                    {couponError && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] text-red-600 font-bold uppercase tracking-wide ml-2"
                      >
                        {couponError}
                      </motion.p>
                    )}
                  </div>

                  <div className="bg-brand-linen/30 border border-brand-mist rounded-3xl p-6 mb-10">
                    <p className="text-[10px] text-brand-stone font-light text-center leading-relaxed">
                      Ao confirmar, seu horário fica reservado aguardando
                      confirmação da profissional.
                      {
                        getBookingNotificationCopy(
                          profile.plan,
                          !!profile.whatsapp,
                        ).notification
                      }
                    </p>
                  </div>

                  {/* DEBUG PANEL FOR MOBILE DEV/PREVIEW ONLY */}
                  {import.meta.env.DEV === true &&
                    typeof window !== "undefined" &&
                    window.location.hostname.includes("localhost") &&
                    step === 3 && (
                      <div className="mb-10 p-4 bg-brand-linen rounded-2xl border border-brand-mist text-left">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-[9px] font-bold text-brand-stone uppercase tracking-widest">
                            Debug Info (DEV ONLY)
                          </h4>
                          <button
                            onClick={() => {
                              (window as any).__BOOKING_DEBUG__ = [];
                              forceUpdate({});
                            }}
                            className="text-[9px] text-brand-terracotta underline"
                          >
                            Limpar
                          </button>
                        </div>
                        <div className="max-h-60 overflow-y-auto text-[9px] font-mono text-brand-ink space-y-1">
                          {(window as any).__BOOKING_DEBUG__?.length > 0 ? (
                            (window as any).__BOOKING_DEBUG__.map(
                              (log: string, i: number) => (
                                <div
                                  key={i}
                                  className="border-b border-brand-mist/30 pb-2"
                                >
                                  <pre className="whitespace-pre-wrap">
                                    {log}
                                  </pre>
                                </div>
                              ),
                            )
                          ) : (
                            <p className="text-brand-stone italic">
                              Nenhum log capturado ainda. Toque em "Confirmar
                              Agora".
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                  <div className="hidden md:block">
                    <PremiumButton
                      variant="terracotta"
                      className="w-full py-7"
                      onClick={handleBooking}
                      loading={bookingLoading}
                      loadingText="Confirmando..."
                    >
                      Confirmar Agendamento <Check size={18} className="ml-1" />
                    </PremiumButton>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && step >= 1 && step <= 3 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-[250] md:hidden px-4 sm:px-6 pt-16 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-[rgba(255,255,255,1)] via-[rgba(255,255,255,0.95)] to-transparent pointer-events-none"
          >
            <div className="pointer-events-auto">
              <PremiumButton
                variant="terracotta"
                className="w-full py-7"
                disabled={
                  (step === 1 &&
                    (!selectedService ||
                      !selectedDate ||
                      !selectedTime ||
                      isLoadingSlots ||
                      !!slotsLoadError)) ||
                  (step === 2 &&
                    (!clientName ||
                      !clientPhone ||
                      !clientEmail ||
                      (isHomeService && (!addressStreet || !addressNumber))))
                }
                loading={step === 3 && bookingLoading}
                onClick={() => {
                  if (step === 1) setStep(2);
                  else if (step === 2) setStep(3);
                  else if (step === 3) handleBooking();
                }}
              >
                {step === 1 && "Continuar para Dados"}
                {step === 2 && "Revisar Agendamento"}
                {step === 3 && "Confirmar Agora"}
                <ArrowRight size={18} className="ml-1" />
              </PremiumButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === 4 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-brand-white z-[300] flex flex-col items-center p-6 sm:p-8 text-center overflow-y-auto no-scrollbar pt-16 pb-32 md:justify-center md:pt-8 md:pb-8"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 15 }}
              className="w-24 h-24 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-8 shrink-0"
            >
              <Check size={48} />
            </motion.div>
            <h2 className="text-3xl md:text-4xl font-serif text-brand-ink mb-3 leading-tight">
              Sua reserva foi registrada
            </h2>
            <p className="body-text text-brand-stone mb-10 max-w-xs mx-auto">
              {
                getBookingNotificationCopy(profile.plan, !!profile.whatsapp)
                  .notification
              }
              <span className="block mt-2 text-[10px] text-brand-stone italic">
                Verifique sua caixa de entrada e spam ✨
              </span>
            </p>
            {allSelectedServices.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-brand-parchment rounded-3xl border border-brand-mist p-8 w-full max-w-md mb-12 text-left shadow-sm"
              >
                <div className="flex justify-between items-center mb-6 border-b border-brand-mist/50 pb-4">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-brand-stone block">
                    Resumo da reserva
                  </span>
                  {reservationCode && (
                    <div className="text-right">
                      <span className="text-[7px] text-brand-stone uppercase tracking-widest block mb-0.5">
                        Código
                      </span>
                      <span className="text-[10px] font-mono font-bold text-brand-terracotta">
                        {reservationCode}
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-1">
                      Serviços ({allSelectedServices.length})
                    </span>
                    <ul className="space-y-1 mt-2">
                      {allSelectedServices.map((service, idx) => (
                        <li
                          key={idx}
                          className="font-serif text-brand-ink flex justify-between items-center text-sm"
                        >
                          <span className="truncate pr-2">{service.name}</span>
                          <span className="font-sans text-xs text-brand-stone tabular-nums">
                            {formatCurrency(service.price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-1">
                        Data
                      </span>
                      <span className="text-sm font-medium text-brand-ink">
                        {selectedDate
                          ? (() => {
                              const [year, month, day] = selectedDate
                                .split("-")
                                .map(Number);
                              return new Date(
                                year,
                                month - 1,
                                day,
                              ).toLocaleDateString("pt-BR", {
                                day: "numeric",
                                month: "short",
                              });
                            })()
                          : "---"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-1">
                        Horário
                      </span>
                      <span className="text-sm font-medium text-brand-ink">
                        {selectedTime}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-brand-mist/30 space-y-2">
                    {getTravelFee() > 0 && (
                      <>
                        <div className="flex justify-between text-[11px] text-brand-stone">
                          <span>Subtotal</span>
                          <span>
                            {formatCurrency(
                              allSelectedServices.reduce(
                                (acc, s) => acc + (Number(s.price) || 0),
                                0,
                              ),
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-brand-stone">
                          <span>Taxa de deslocamento</span>
                          <span>{formatCurrency(getTravelFee())}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center text-brand-ink font-serif pt-1">
                      <span className="text-sm">Total</span>
                      <span className="text-lg text-brand-terracotta">
                        {formatCurrency(calculateTotalPrice())}
                      </span>
                    </div>
                  </div>

                  {/* Payment Methods in Success Screen */}
                  <div className="pt-4 border-t border-brand-mist/30">
                    <span className="text-[10px] text-brand-stone uppercase tracking-wide block mb-2">
                      Pagamento
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.paymentMethods &&
                      profile.paymentMethods.length > 0 ? (
                        profile.paymentMethods.map((id) => {
                          const names: Record<string, string> = {
                            pix: "Pix",
                            credito: "Crédito",
                            debito: "Débito",
                            dinheiro: "Dinheiro",
                            transferencia: "Transferência",
                          };
                          return (
                            <span
                              key={id}
                              className="px-2 py-0.5 bg-brand-linen border border-brand-mist rounded-md text-[8px] font-bold text-brand-ink uppercase tracking-wider"
                            >
                              {names[id] || id}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[9px] text-brand-stone/60 italic">
                          A combinar com a profissional.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Link de Gerenciamento - Temporário conforme pedido */}
                  {appointmentToken && (
                    <div className="mt-4 pt-4 border-t border-brand-mist/30">
                      <span className="text-[7px] text-brand-stone uppercase tracking-widest block mb-1">
                        Link de Gerenciamento
                      </span>
                      <p className="text-[8px] font-mono text-brand-ink/60 break-all">
                        {window.location.origin}/r/{appointmentToken}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            <div className="w-full max-w-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PremiumButton
                  variant="secondary"
                  className="w-full py-4 !text-[9px]"
                  onClick={() => {
                    if (!selectedDate || !selectedTime) return;
                    const [year, month, day] = selectedDate
                      .split("-")
                      .map(Number);
                    const [hours, minutes] = selectedTime
                      .split(":")
                      .map(Number);
                    const start = new Date(
                      year,
                      month - 1,
                      day,
                      hours,
                      minutes,
                    );
                    const end = new Date(
                      start.getTime() +
                        (Number(selectedService?.duration) || 60) * 60000,
                    );
                    const formatTemplate = (d: Date) =>
                      d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
                    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Reserva: " + selectedService?.name)}&dates=${formatTemplate(start)}/${formatTemplate(end)}&details=${encodeURIComponent("Agendamento realizado via Nera.")}&location=${encodeURIComponent(profile?.city || "")}`;
                    window.open(url, "_blank");
                  }}
                >
                  <CalendarIcon size={14} /> Adicionar calendário
                </PremiumButton>

                {appointmentToken && (
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        window.location.href = `/r/${appointmentToken}`;
                      }}
                      className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-brand-ink text-brand-white rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all border border-brand-ink shadow-lg shadow-brand-ink/10"
                    >
                      <Settings size={14} className="animate-spin-slow" />{" "}
                      Gerenciar reserva
                    </button>
                  </div>
                )}

                {profile.plan === "pro" && (
                  <a
                    href={buildWhatsappLink(
                      profile?.whatsapp || "",
                      generateBookingConfirmationMessage(
                        allSelectedServices.map((s) => s.name),
                        selectedDate,
                        selectedTime,
                        getTravelFee(),
                        calculateTotalPrice(),
                      ),
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-linen text-brand-ink rounded-full text-[9px] font-medium uppercase tracking-widest hover:bg-brand-mist transition-all border border-brand-mist sm:col-span-2"
                  >
                    <MessageCircle size={14} /> Falar com a profissional
                  </a>
                )}
              </div>
              <div className="bg-brand-linen/30 border border-brand-mist rounded-[32px] p-6 md:p-8 mt-8 md:mt-12 text-center w-full">
                <div className="w-12 h-12 bg-brand-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-brand-terracotta shadow-sm">
                  <Heart size={24} className="fill-brand-terracotta/10" />
                </div>
                <h4 className="text-lg font-serif text-brand-ink mb-2">
                  Gostou da experiência? Indique uma amiga.
                </h4>
                <p className="text-[10px] text-brand-stone uppercase tracking-widest mb-6">
                  Compartilhe sua descoberta com quem você ama
                </p>
                <PremiumButton
                  variant="primary"
                  className="w-full py-5 !text-[10px]"
                  onClick={async () => {
                    const url =
                      window.location.origin + "/p/" + (profile?.slug || "");
                    const text = "Te recomendo essa profissional ✨";
                    const fullText = `${text} Reserve online aqui: ${url}`;
                    try {
                      if (navigator.share) {
                        await navigator
                          .share({ title: profile?.name, text: text, url: url })
                          .catch(async () => {
                            await navigator.clipboard.writeText(fullText);
                            notify.success("Link de indicação copiado!");
                          });
                      } else {
                        await navigator.clipboard.writeText(fullText);
                        notify.success("Link de indicação copiado!");
                      }
                    } catch (err) {
                      console.error("[Share] error:", err);
                    }
                  }}
                >
                  Compartilhar perfil <Share2 size={14} className="ml-1" />
                </PremiumButton>
              </div>
              <button
                onClick={() => {
                  setStep(1);
                  setSelectedService(null);
                  setSelectedDate("");
                  setSelectedTime("");
                  setBookingSuccess(false);
                  onClose();
                }}
                className="mt-8 text-[10px] font-bold text-brand-stone uppercase tracking-widest hover:text-brand-ink transition-colors"
              >
                Voltar para o perfil
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <WaitlistModal
        profile={profile}
        services={services}
        open={isWaitlistOpen}
        onClose={() => setIsWaitlistOpen(false)}
        initialDate={selectedDate}
        initialService={selectedService}
      />
    </>
  );
}
