import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { usePlanFeatures } from './usePlanFeatures';
import { Appointment } from '../types';

export type UpgradeFeature = 'unlimitedBookings' | 'whatsappNotifications' | 'advancedDashboard' | 'waitlist' | 'antiNoShow' | 'coupons' | 'analytics' | 'reports';

export function useUpgradeTriggers(appointments: Appointment[] = []) {
  const { profile } = useAuth();
  const { plan, features } = usePlanFeatures();
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState<UpgradeFeature>('unlimitedBookings');
  const [usageCount, setUsageCount] = useState(0);

  const checkFeatureAccess = useCallback((requestedFeature: UpgradeFeature) => {
    if (features[requestedFeature]) return true;
    
    setFeature(requestedFeature);
    setIsOpen(true);
    return false;
  }, [features]);

  // Usage logic
  useEffect(() => {
    if (plan !== 'free') return;

    const currentMonthAppts = appointments.filter(a => {
      const d = new Date(a.date + 'T12:00:00');
      const now = new Date();
      return (
        d.getMonth() === now.getMonth() && 
        d.getFullYear() === now.getFullYear() &&
        ['confirmed', 'completed', 'pending_confirmation', 'accepted'].includes(a.status)
      );
    });

    setUsageCount(currentMonthAppts.length);
  }, [appointments, plan]);

  const closeUpgradeModal = () => setIsOpen(false);

  return {
    isUpgradeModalOpen: isOpen,
    upgradeFeature: feature,
    usageCount,
    checkFeatureAccess,
    closeUpgradeModal,
    openUpgradeModal: (f: UpgradeFeature = 'unlimitedBookings') => {
      setFeature(f);
      setIsOpen(true);
    }
  };
}
