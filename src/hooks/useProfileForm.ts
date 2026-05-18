import { useState, useEffect } from 'react';
import { UserProfile } from '../types';

export function useProfileForm(profile: UserProfile | null) {
  const [name, setName] = useState(profile?.name || '');
  const [specialty, setSpecialty] = useState(profile?.professionalIdentity?.mainSpecialty || profile?.specialty || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [headline, setHeadline] = useState(profile?.headline || '');
  const [city, setCity] = useState(profile?.city || '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '');
  const [instagram, setInstagram] = useState(profile?.instagram || '');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(profile?.paymentMethods || []);
  const [antiNoShowEnabled, setAntiNoShowEnabled] = useState(profile?.antiNoShowEnabled || false);
  const [advancePaymentRequired, setAdvancePaymentRequired] = useState(profile?.advancePaymentRequired || false);
  const [delayTolerance, setDelayTolerance] = useState<10 | 15 | 20 | 0>(profile?.delayTolerance ?? 15);
  const [slug, setSlug] = useState(profile?.slug || '');
  const [avatar, setAvatar] = useState(profile?.avatar || '');
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood || '');
  const [serviceMode, setServiceMode] = useState<'home' | 'studio' | 'hybrid'>(profile?.serviceMode || 'studio');
  const [studioAddress, setStudioAddress] = useState(profile?.studioAddress || {
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    reference: '',
    privacyMode: 'reveal_after_booking'
  });
  const [serviceAreas, setServiceAreas] = useState<any[]>(profile?.serviceAreas || []);
  const [serviceAreaType, setServiceAreaType] = useState<'city_wide' | 'custom'>(profile?.serviceAreaType || 'city_wide');
  const [pricingStrategy, setPricingStrategy] = useState<'extra' | 'none'>(profile?.pricingStrategy || 'none');
  const [differentials, setDifferentials] = useState<string[]>(profile?.professionalIdentity?.differentials || []);
  
  // Working Hours (Official format prioritized)
  const [workingDays, setWorkingDays] = useState<number[]>(profile?.workingHours?.workingDays || profile?.workingDays || [1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState(profile?.workingHours?.startTime || profile?.startTime || '09:00');
  const [endTime, setEndTime] = useState(profile?.workingHours?.endTime || profile?.endTime || '18:00');
  const [profileTheme, setProfileTheme] = useState<{ variant: "terracotta" | "rose" | "sage" | "navy" | "plum" }>(profile?.profileTheme || { variant: 'terracotta' });
  const [avatarSkipped, setAvatarSkipped] = useState(profile?.avatarSkipped || false);

  // Sincronizar quando profile mudar
  useEffect(() => {
    if (profile) {
      if (profile.name) setName(profile.name);
      if (profile.professionalIdentity?.mainSpecialty || profile.specialty) setSpecialty(profile.professionalIdentity?.mainSpecialty || profile.specialty);
      if (profile.bio) setBio(profile.bio);
      if (profile.headline) setHeadline(profile.headline);
      if (profile.city) setCity(profile.city);
      if (profile.whatsapp) setWhatsapp(profile.whatsapp);
      if (profile.instagram) setInstagram(profile.instagram);
      if (profile.paymentMethods?.length) setPaymentMethods(profile.paymentMethods);
      if (profile.antiNoShowEnabled !== undefined) setAntiNoShowEnabled(profile.antiNoShowEnabled);
      if (profile.advancePaymentRequired !== undefined) setAdvancePaymentRequired(profile.advancePaymentRequired);
      if (profile.delayTolerance !== undefined) setDelayTolerance(profile.delayTolerance);
      if (profile.slug) setSlug(profile.slug);
      if (profile.avatar) setAvatar(profile.avatar);
      if (profile.neighborhood) setNeighborhood(profile.neighborhood);
      if (profile.serviceMode) setServiceMode(profile.serviceMode);
      if (profile.avatarSkipped !== undefined) setAvatarSkipped(profile.avatarSkipped);
      if (profile.profileTheme) setProfileTheme(profile.profileTheme);
      if (profile.studioAddress) setStudioAddress(profile.studioAddress);
      if (profile.serviceAreas?.length) setServiceAreas(profile.serviceAreas);
      if (profile.serviceAreaType) setServiceAreaType(profile.serviceAreaType);
      if (profile.pricingStrategy) setPricingStrategy(profile.pricingStrategy);
      if (profile.professionalIdentity?.differentials?.length) setDifferentials(profile.professionalIdentity.differentials);
      
      const wh = profile.workingHours;
      if (wh) {
        if (wh.workingDays?.length) setWorkingDays(wh.workingDays);
        if (wh.startTime) setStartTime(wh.startTime);
        if (wh.endTime) setEndTime(wh.endTime);
      } else {
        // Fallback legado (apenas leitura)
        if (profile.workingDays?.length) setWorkingDays(profile.workingDays);
        if (profile.startTime) setStartTime(profile.startTime);
        if (profile.endTime) setEndTime(profile.endTime);
      }
    }
  }, [profile?.uid]);

  return {
    name, setName,
    specialty, setSpecialty,
    bio, setBio,
    headline, setHeadline,
    city, setCity,
    whatsapp, setWhatsapp,
    instagram, setInstagram,
    paymentMethods, setPaymentMethods,
    antiNoShowEnabled, setAntiNoShowEnabled,
    advancePaymentRequired, setAdvancePaymentRequired,
    delayTolerance, setDelayTolerance,
    slug, setSlug,
    avatar, setAvatar,
    neighborhood, setNeighborhood,
    serviceMode, setServiceMode,
    studioAddress, setStudioAddress,
    serviceAreas, setServiceAreas,
    serviceAreaType, setServiceAreaType,
    pricingStrategy, setPricingStrategy,
    differentials, setDifferentials,
    workingDays, setWorkingDays,
    startTime, setStartTime,
    endTime, setEndTime,
    avatarSkipped, setAvatarSkipped,
    profileTheme, setProfileTheme
  };
}
