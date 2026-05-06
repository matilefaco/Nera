import { useState, useEffect } from 'react';
import { notify } from '../lib/notify';
import { auth } from '../firebase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  async function checkSubscription() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setIsSubscribed(!!subscription);
  }

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  async function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), ms)
      )
    ]);
  }

  async function requestPermission() {
    console.log("[PUSH STEP 1] requestPermission iniciado");
    
    if (!isSupported) {
      console.error("[PUSH] Web Push is not supported in this browser.");
      throw new Error("Este navegador não suporta Web Push.");
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error("[PUSH] VITE_VAPID_PUBLIC_KEY is not defined.");
      throw new Error("VITE_VAPID_PUBLIC_KEY não configurada.");
    }

    try {
      console.log("[PUSH STEP 2] permissão solicitada. Atual:", Notification.permission);
      const result = await Notification.requestPermission();
      console.log("[PUSH STEP 3] resultado da permissão:", result);
      setPermission(result);

      if (result !== 'granted') {
        return false;
      }

      console.log("[PUSH STEP 4] verificando registros do service worker...");
      let registrations = await navigator.serviceWorker.getRegistrations();
      console.log("[PUSH DEBUG] service worker registrations found:", registrations.length);
      
      if (registrations.length === 0) {
        console.log("[PUSH] Nenhum SW encontrado. Registrando /sw-push.js...");
        try {
          await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
          // Give it a moment to register
          await new Promise(resolve => setTimeout(resolve, 1000));
          registrations = await navigator.serviceWorker.getRegistrations();
          console.log("[PUSH DEBUG] service worker registrations after manual registration:", registrations.length);
        } catch (regErr) {
          console.error("[PUSH] Falha ao registrar SW manualmente:", regErr);
        }
      }

      if (registrations.length === 0) {
        throw new Error("Service Worker não registrado. Certifique-se de que está usando HTTPS e que o app está instalado.");
      }

      console.log("[PUSH STEP 5] aguardando serviceWorker.ready...");
      const registration = await withTimeout(
        navigator.serviceWorker.ready,
        8000,
        "Service Worker não ficou pronto a tempo. Recarregue o app e tente novamente."
      );
      console.log("[PUSH STEP 6] service worker pronto");
      
      // Subscribe to push notifications
      console.log("[PUSH STEP 7] criando subscription...");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      console.log("[PUSH STEP 8] subscription obtida:", !!subscription);
      if (!subscription) {
        throw new Error("Falha ao criar inscrição de notificações.");
      }

      // Save subscription to backend
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Usuário não autenticado.");
      }

      const token = await user.getIdToken();
      console.log("[PUSH STEP 9] enviando subscription ao backend...");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            userId: user.uid,
            userAgent: navigator.userAgent
          }),
        });

        clearTimeout(timeoutId);
        console.log("[PUSH STEP 10] backend respondeu");

        const responseData = await response.json();

        if (response.ok && responseData.success) {
          console.log("[PUSH SUCCESS] Inscrição salva e verificada no backend:", responseData.path);
          setIsSubscribed(true);
          return true;
        } else {
          console.error("[PUSH] Backend error saving subscription:", responseData);
          throw new Error(responseData.error || 'Permissão concedida, mas não foi possível salvar o dispositivo no servidor.');
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error("Servidor demorou para salvar a inscrição de notificações.");
        }
        throw err;
      }
    } catch (error: any) {
      console.error('[PUSH ERROR AT STEP]', error);
      notify.error(`Erro ao ativar notificações: ${error.message}`);
      throw error;
    }
  }

  return {
    isSupported,
    isSubscribed,
    permission,
    requestPermission
  };
}
