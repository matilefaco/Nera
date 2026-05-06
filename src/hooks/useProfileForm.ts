import { useState, useEffect } from 'react';
import { UserProfile } from '../types';

export function useProfileForm(profile: UserProfile | null) {
  const [name, setName] = useState(profile?.name || '');
  const [specialty, setSpecialty] = useState(profile?.specialty || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [headline, setHeadline] = useState(profile?.headline || '');
  const [city, setCity] = useState(profile?.city || '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '');
  const [instagram, setInstagram] = useState(profile?.instagram || '');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(profile?.paymentMethods || []);
  const [antiNoShowEnabled, setAntiNoShowEnabled] = useState(profile?.antiNoShowEnabled || false);
  const [advancePaymentRequired, setAdvancePaymentRequired] = useState(profile?.advancePaymentRequired || false);
  const [delayTolerance, setDelayTolerance] = useState<10 | 15 | 20>(profile?.delayTolerance || 15);
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
      setName(profile.name || '');
      setSpecialty(profile.specialty || '');
      setBio(profile.bio || '');
      setHeadline(profile.headline || '');
      setCity(profile.city || '');
      setWhatsapp(profile.whatsapp || '');
      setInstagram(profile.instagram || '');
      setPaymentMethods(profile.paymentMethods || []);
      setAntiNoShowEnabled(profile.antiNoShowEnabled || false);
      setAdvancePaymentRequired(profile.advancePaymentRequired || false);
      setDelayTolerance(profile.delayTolerance || 15);
      setSlug(profile.slug || '');
      setAvatar(profile.avatar || '');
      setNeighborhood(profile.neighborhood || '');
      setServiceMode(profile.serviceMode || 'studio');
      setAvatarSkipped(profile.avatarSkipped || false);
      setProfileTheme(profile.profileTheme || { variant: 'terracotta' });
      setStudioAddress(profile.studioAddress || {
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        reference: '',
        privacyMode: 'reveal_after_booking'
      });
      setServiceAreas(profile.serviceAreas || []);
      setServiceAreaType(profile.serviceAreaType || 'city_wide');
      setPricingStrategy(profile.pricingStrategy || 'none');
      setDifferentials(profile.professionalIdentity?.differentials || []);
      
      const wh = profile.workingHours;
      if (wh) {
        setWorkingDays(wh.workingDays || [1, 2, 3, 4, 5]);
        setStartTime(wh.startTime || '09:00');
        setEndTime(wh.endTime || '18:00');
      } else {
        // Fallback legado (apenas leitura)
        setWorkingDays(profile.workingDays || [1, 2, 3, 4, 5]);
        setStartTime(profile.startTime || '09:00');
        setEndTime(profile.endTime || '18:00');
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
