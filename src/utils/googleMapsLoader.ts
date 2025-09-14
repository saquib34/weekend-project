// Global Google Maps API loader to prevent duplicate script loading
interface GoogleMapsLoader {
  load(): Promise<void>;
  isLoaded(): boolean;
  isLoading(): boolean;
}

class GoogleMapsLoaderImpl implements GoogleMapsLoader {
  private static instance: GoogleMapsLoaderImpl;
  private loadPromise: Promise<void> | null = null;
  private loaded = false;
  private loading = false;

  private constructor() {}

  static getInstance(): GoogleMapsLoaderImpl {
    if (!GoogleMapsLoaderImpl.instance) {
      GoogleMapsLoaderImpl.instance = new GoogleMapsLoaderImpl();
    }
    return GoogleMapsLoaderImpl.instance;
  }

  isLoaded(): boolean {
    return this.loaded && !!(window as any).google?.maps;
  }

  isLoading(): boolean {
    return this.loading;
  }

  private cleanupExistingScripts(): void {
    // Remove any existing Google Maps scripts to prevent duplicates
    const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]');
    existingScripts.forEach(script => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    });
    
    // Reset the global Google object if it exists but is incomplete
    if ((window as any).google && !(window as any).google.maps) {
      delete (window as any).google;
    }
  }

  async load(): Promise<void> {
    // If already loaded, return immediately
    if (this.isLoaded()) {
      return Promise.resolve();
    }

    // If currently loading, return the existing promise
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // Clean up any existing scripts first to prevent duplicates
    this.cleanupExistingScripts();

    // Create new load promise
    this.loadPromise = new Promise<void>((resolve, reject) => {
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          reject(new Error('Google Maps API key not found'));
          return;
        }

        // Check one more time if already loaded after cleanup
        if (this.isLoaded()) {
          this.loading = false;
          resolve();
          return;
        }

        this.loading = true;

        // Create and load the script
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&loading=async`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
          // Wait a bit for the API to be fully ready
          setTimeout(() => {
            if ((window as any).google?.maps) {
              this.loaded = true;
              this.loading = false;
              resolve();
            } else {
              this.loading = false;
              reject(new Error('Google Maps API loaded but not available'));
            }
          }, 100);
        };

        script.onerror = () => {
          this.loading = false;
          reject(new Error('Failed to load Google Maps API script'));
        };

        document.head.appendChild(script);
      } catch (error) {
        this.loading = false;
        reject(error);
      }
    });

    return this.loadPromise;
  }
}

export const googleMapsLoader = GoogleMapsLoaderImpl.getInstance();
