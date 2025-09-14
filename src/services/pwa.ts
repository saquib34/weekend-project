/**
 * PWA Service for Weekendly
 * Handles service worker registration, offline detection, and install prompts
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

class PWAService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled = false;
  private isOnline = navigator.onLine;
  private eventListeners = new Map<string, Function[]>();

  constructor() {
    this.initializeServiceWorker();
    this.setupEventListeners();
    this.checkInstallationStatus();
  }

  /**
   * Initialize and register service worker
   */
  private async initializeServiceWorker(): Promise<ServiceWorkerRegistration> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        
        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                this.emit('update-available', { registration });
              }
            });
          }
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          this.handleServiceWorkerMessage(event.data);
        });

        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        throw error;
      }
    } else {
      console.warn('Service Worker not supported in this browser');
      throw new Error('Service Worker not supported');
    }
  }

  /**
   * Set up PWA event listeners
   */
  private setupEventListeners(): void {
    // Install prompt
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event as BeforeInstallPromptEvent;
      this.emit('install-prompt-available');
    });

    // App installed
    window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
      this.deferredPrompt = null;
      this.emit('app-installed');
    });

    // Online/offline detection
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.emit('online');
      this.syncWhenOnline();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.emit('offline');
    });

    // Visibility change (for background sync)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.syncWhenOnline();
      }
    });
  }

  /**
   * Check if app is already installed
   */
  private checkInstallationStatus(): void {
    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
    }

    // Check for iOS Safari "Add to Home Screen"
    const nav = window.navigator as any;
    if (nav.standalone !== undefined) {
      // iOS Safari
      this.isInstalled = nav.standalone;
    }
  }

  /**
   * Show install prompt to user
   */
  async showInstallPrompt(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.warn('Install prompt not available');
      return false;
    }

    try {
      await this.deferredPrompt.prompt();
      const choiceResult = await this.deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
                this.emit('install-accepted');
        return true;
      } else {
                this.emit('install-dismissed');
        return false;
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
      return false;
    } finally {
      this.deferredPrompt = null;
    }
  }

  /**
   * Check if install prompt is available
   */
  canShowInstallPrompt(): boolean {
    return !!this.deferredPrompt && !this.isInstalled;
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    this.emit('notification-permission-changed', { permission });
    return permission;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPushNotifications(): Promise<PushSubscription | null> {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (!registration.pushManager) {
        console.warn('Push notifications not supported');
        return null;
      }

      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        const applicationServerKey = this.urlBase64ToUint8Array(
          import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
        );

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }

            this.emit('push-subscription-created', { subscription });
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }

  /**
   * Schedule weekend reminder notification
   */
  async scheduleWeekendReminder(): Promise<void> {
    const permission = await this.requestNotificationPermission();
    if (permission !== 'granted') return;

    // Calculate next Friday at 6 PM
    const now = new Date();
    const nextFriday = new Date();
    const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
    nextFriday.setDate(now.getDate() + daysUntilFriday);
    nextFriday.setHours(18, 0, 0, 0);

    const msUntilReminder = nextFriday.getTime() - now.getTime();

    if (msUntilReminder > 0) {
      setTimeout(() => {
        this.showNotification({
          title: 'Weekend Planning Time! 🌟',
          body: 'Ready to plan an amazing weekend? Check out personalized recommendations!',
          tag: 'weekend-reminder',
          actions: [
            { action: 'plan-now', title: 'Plan Now' },
            { action: 'remind-later', title: 'Remind Later' },
          ],
        });
      }, Math.min(msUntilReminder, 2147483647)); // Max setTimeout value
    }
  }

  /**
   * Show local notification
   */
  async showNotification(options: {
    title: string;
    body: string;
    tag?: string;
    icon?: string;
    badge?: string;
    actions?: Array<{ action: string; title: string; icon?: string }>;
    data?: any;
  }): Promise<void> {
    const permission = await this.requestNotificationPermission();
    if (permission !== 'granted') return;

    const notificationOptions: NotificationOptions = {
      body: options.body,
      icon: options.icon || '/icons/icon-192x192.png',
      badge: options.badge || '/icons/badge-72x72.png',
      tag: options.tag || 'weekendly-notification',
      data: options.data,
      requireInteraction: false,
    };

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(options.title, notificationOptions);
    } else {
      new Notification(options.title, notificationOptions);
    }
  }

  /**
   * Handle messages from service worker
   */
  private handleServiceWorkerMessage(data: any): void {
    switch (data.type) {
      case 'CACHE_UPDATED':
        this.emit('cache-updated');
        break;
      case 'OFFLINE_READY':
        this.emit('offline-ready');
        break;
      case 'BACKGROUND_SYNC_SUCCESS':
        this.emit('sync-success', data.payload);
        break;
      case 'BACKGROUND_SYNC_FAILED':
        this.emit('sync-failed', data.payload);
        break;
      default:
            }
  }

  /**
   * Trigger background sync when coming back online
   */
  private async syncWhenOnline(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const syncRegistration = registration as any;
        if (syncRegistration.sync) {
          await syncRegistration.sync.register('weekend-plan-sync');
                  }
      } catch (error) {
        console.error('Background sync registration failed:', error);
      }
    }
  }

  /**
   * Update service worker to new version
   */
  async updateServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        // Send message to skip waiting
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  }

  /**
   * Get installation instructions for current platform
   */
  getInstallInstructions(): { platform: string; instructions: string[] } {
    const userAgent = navigator.userAgent;
    
    if (/iPhone|iPad|iPod/.test(userAgent)) {
      return {
        platform: 'iOS Safari',
        instructions: [
          'Tap the Share button at the bottom of the screen',
          'Scroll down and tap "Add to Home Screen"',
          'Tap "Add" to install Weekendly',
        ],
      };
    } else if (/Android/.test(userAgent)) {
      return {
        platform: 'Android Chrome',
        instructions: [
          'Tap the menu button (three dots) in the top right',
          'Select "Add to Home screen"',
          'Tap "Add" to install Weekendly',
        ],
      };
    } else {
      return {
        platform: 'Desktop',
        instructions: [
          'Look for the install icon in your browser\'s address bar',
          'Click it and select "Install Weekendly"',
          'The app will be added to your applications',
        ],
      };
    }
  }

  /**
   * Check app capabilities
   */
  getCapabilities(): {
    canInstall: boolean;
    hasNotifications: boolean;
    hasPushNotifications: boolean;
    hasBackgroundSync: boolean;
    isOnline: boolean;
    isInstalled: boolean;
  } {
    return {
      canInstall: this.canShowInstallPrompt(),
      hasNotifications: 'Notification' in window,
      hasPushNotifications: 'PushManager' in window,
      hasBackgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      isOnline: this.isOnline,
      isInstalled: this.isInstalled,
    };
  }

  /**
   * Event subscription
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Event unsubscription
   */
  off(event: string, callback?: Function): void {
    if (!this.eventListeners.has(event)) return;

    if (callback) {
      const callbacks = this.eventListeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.eventListeners.delete(event);
    }
  }

  /**
   * Emit event to subscribers
   */
  private emit(event: string, data?: any): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in PWA event callback:', error);
        }
      });
    }
  }

  /**
   * Convert VAPID key for push notifications
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// Export singleton instance
export const pwaService = new PWAService();

// Export types
export type PWACapabilities = ReturnType<PWAService['getCapabilities']>;
export type InstallInstructions = ReturnType<PWAService['getInstallInstructions']>;

