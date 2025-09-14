

import type { WeekendPlan } from '../types';

// Unused interface - keeping for future implementation
// interface OfflineStorageEvent {
//   type: 'sync-required' | 'sync-complete' | 'sync-failed' | 'storage-full';
//   data?: any;
// }

interface SyncStatus {
  lastSync: Date;
  pendingUploads: string[];
  conflictCount: number;
}

class OfflineStorageService {
  private dbName = 'WeekendlyOfflineDB';
  private dbVersion = 2;
  private db: IDBDatabase | null = null;
  private eventListeners = new Map<string, Function[]>();
  private isOnline = navigator.onLine;

  constructor() {
    this.initializeDatabase();
    this.setupNetworkListeners();
  }

  /**
   * Initialize IndexedDB database
   */
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Weekend Plans store
        if (!db.objectStoreNames.contains('weekendPlans')) {
          const planStore = db.createObjectStore('weekendPlans', { keyPath: 'id' });
          planStore.createIndex('createdAt', 'createdAt', { unique: false });
          planStore.createIndex('mood', 'mood', { unique: false });
          planStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Activities cache store
        if (!db.objectStoreNames.contains('activitiesCache')) {
          const activityStore = db.createObjectStore('activitiesCache', { keyPath: 'id' });
          activityStore.createIndex('category', 'category', { unique: false });
          activityStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('priority', 'priority', { unique: false });
        }

        // User preferences store
        if (!db.objectStoreNames.contains('userPreferences')) {
          db.createObjectStore('userPreferences', { keyPath: 'key' });
        }

              };
    });
  }

  /**
   * Setup network connectivity listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.emit('network-online');
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.emit('network-offline');
    });
  }

  /**
   * Save weekend plan with offline support
   */
  async savePlan(plan: WeekendPlan, forceOffline = false): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Add metadata for offline tracking
    const enhancedPlan = {
      ...plan,
      syncStatus: this.isOnline && !forceOffline ? 'synced' : 'pending',
      lastModified: new Date(),
      offlineVersion: true
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['weekendPlans'], 'readwrite');
      const store = transaction.objectStore('weekendPlans');
      const request = store.put(enhancedPlan);

      request.onsuccess = () => {
                
        // Add to sync queue if offline or forced
        if (!this.isOnline || forceOffline) {
          this.addToSyncQueue('save-plan', { planId: plan.id });
        }
        
        this.emit('plan-saved', { plan: enhancedPlan, offline: !this.isOnline || forceOffline });
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to save plan offline'));
      };
    });
  }

  /**
   * Load all weekend plans with offline support
   */
  async loadAllPlans(): Promise<WeekendPlan[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['weekendPlans'], 'readonly');
      const store = transaction.objectStore('weekendPlans');
      const request = store.getAll();

      request.onsuccess = () => {
        const plans = request.result as (WeekendPlan & { syncStatus?: string })[];
        
        // Filter and clean up plans
        const cleanPlans = plans.map(plan => {
          // Remove any sync-related properties that might exist
          const { syncStatus, ...cleanPlan } = plan;
          return cleanPlan as WeekendPlan;
        });

                resolve(cleanPlans);
      };

      request.onerror = () => {
        reject(new Error('Failed to load plans from offline storage'));
      };
    });
  }

  /**
   * Load specific weekend plan
   */
  async loadPlan(planId: string): Promise<WeekendPlan | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['weekendPlans'], 'readonly');
      const store = transaction.objectStore('weekendPlans');
      const request = store.get(planId);

      request.onsuccess = () => {
        const plan = request.result;
        if (plan) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { syncStatus, lastModified, offlineVersion, ...cleanPlan } = plan as any;
          resolve(cleanPlan as WeekendPlan);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to load plan from offline storage'));
      };
    });
  }

  /**
   * Delete weekend plan
   */
  async deletePlan(planId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['weekendPlans'], 'readwrite');
      const store = transaction.objectStore('weekendPlans');
      const request = store.delete(planId);

      request.onsuccess = () => {
                
        // Add to sync queue for deletion
        if (!this.isOnline) {
          this.addToSyncQueue('delete-plan', { planId });
        }
        
        this.emit('plan-deleted', { planId, offline: !this.isOnline });
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete plan from offline storage'));
      };
    });
  }

  /**
   * Cache activities for offline use
   */
  async cacheActivities(activities: any[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['activitiesCache'], 'readwrite');
      const store = transaction.objectStore('activitiesCache');

      let completed = 0;
      const total = activities.length;

      activities.forEach(activity => {
        const enhancedActivity = {
          ...activity,
          lastAccessed: new Date(),
          cached: true
        };

        const request = store.put(enhancedActivity);
        
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
                        resolve();
          }
        };

        request.onerror = () => {
          reject(new Error('Failed to cache activity'));
        };
      });

      if (total === 0) {
        resolve();
      }
    });
  }

  /**
   * Get cached activities
   */
  async getCachedActivities(): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['activitiesCache'], 'readonly');
      const store = transaction.objectStore('activitiesCache');
      const request = store.getAll();

      request.onsuccess = () => {
        const activities = request.result.map(activity => {
          const { lastAccessed, cached, ...cleanActivity } = activity;
          return cleanActivity;
        });
        
                resolve(activities);
      };

      request.onerror = () => {
        reject(new Error('Failed to retrieve cached activities'));
      };
    });
  }

  /**
   * Add item to sync queue
   */
  private async addToSyncQueue(action: string, data: any, priority = 1): Promise<void> {
    if (!this.db) return;

    const syncItem = {
      id: `${action}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      data,
      priority,
      timestamp: new Date(),
      retryCount: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.add(syncItem);

      request.onsuccess = () => {
                resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to add to sync queue'));
      };
    });
  }

  /**
   * Process sync queue when online
   */
  async processSyncQueue(): Promise<void> {
    if (!this.db || !this.isOnline) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.getAll();

      request.onsuccess = async () => {
        const syncItems = request.result;
        
        for (const item of syncItems) {
          try {
            await this.processSyncItem(item);
            
            // Remove from queue after successful sync
            const deleteRequest = store.delete(item.id);
            deleteRequest.onsuccess = () => {
                          };
          } catch (error) {
            console.error('Failed to sync item:', item, error);
            
            // Increment retry count
            item.retryCount++;
            if (item.retryCount < 3) {
              store.put(item);
            } else {
              // Remove after 3 failed attempts
              store.delete(item.id);
              console.warn('Sync item removed after 3 failed attempts:', item);
            }
          }
        }

        this.emit('sync-complete', { processedCount: syncItems.length });
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to process sync queue'));
      };
    });
  }

  /**
   * Process individual sync item
   */
  private async processSyncItem(item: any): Promise<void> {
    // This would integrate with your backend API
    // For now, we'll just simulate the sync
        
    // In a real implementation, you'd make API calls here
    // await apiService.syncPlan(item.data.planId);
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue', 'weekendPlans'], 'readonly');
      const syncStore = transaction.objectStore('syncQueue');
      const planStore = transaction.objectStore('weekendPlans');

      const syncRequest = syncStore.getAll();
      const planRequest = planStore.index('syncStatus').getAll('pending');

      Promise.all([
        new Promise(res => { syncRequest.onsuccess = () => res(syncRequest.result); }),
        new Promise(res => { planRequest.onsuccess = () => res(planRequest.result); })
      ]).then((results) => {
        const pendingPlans = results[1] as any[];
        resolve({
          lastSync: new Date(), // You'd track this properly
          pendingUploads: pendingPlans.map(p => p.id),
          conflictCount: 0 // You'd detect conflicts here
        });
      }).catch(reject);
    });
  }

  /**
   * Clear all offline data
   */
  async clearOfflineData(): Promise<void> {
    if (!this.db) return;

    const stores = ['weekendPlans', 'activitiesCache', 'syncQueue', 'userPreferences'];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(stores, 'readwrite');
      
      let completed = 0;
      stores.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          completed++;
          if (completed === stores.length) {
                        this.emit('data-cleared');
            resolve();
          }
        };
      });

      transaction.onerror = () => {
        reject(new Error('Failed to clear offline data'));
      };
    });
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{ used: number; available: number; percentage: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const available = estimate.quota || 0;
      const percentage = available > 0 ? (used / available) * 100 : 0;

      return { used, available, percentage };
    }

    return { used: 0, available: 0, percentage: 0 };
  }

  /**
   * Check if offline mode is available
   */
  isOfflineAvailable(): boolean {
    return 'indexedDB' in window && this.db !== null;
  }

  /**
   * Check if currently online
   */
  isCurrentlyOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Event system
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
}

// Create and export singleton instance
export const offlineStorageService = new OfflineStorageService();
export default offlineStorageService;

