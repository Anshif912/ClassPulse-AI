export interface MeetAddonContext {
  isInsideMeet: boolean;
  cloudProjectId?: string;
  sidePanelClient?: any;
  mainStageClient?: any;
  error?: string;
}

class MeetAddonSdkService {
  private isLoaded: boolean = false;
  private sidePanelClient: any = null;
  private mainStageClient: any = null;

  public async initializeSdk(): Promise<MeetAddonContext> {
    if (typeof window === 'undefined') {
      return { isInsideMeet: false };
    }

    // Check if running inside Google Meet iframe or standalone
    const isInsideMeetIframe = window.self !== window.top;

    try {
      // Dynamically load official Google Meet Add-ons SDK script if not already present
      if (!(window as any).meet?.addons) {
        await this.loadSdkScript();
      }

      const meetAddons = (window as any).meet?.addons;
      if (meetAddons && typeof meetAddons.createMeetAddonClient === 'function') {
        const addonClient = await meetAddons.createMeetAddonClient();
        console.log('[Meet Add-on SDK] Initialized successfully.');

        // Try initializing side panel or main stage depending on path
        if (window.location.pathname.includes('main-stage')) {
          this.mainStageClient = await addonClient.loadMainStageClient();
          console.log('[Meet Add-on SDK] Main stage client loaded.');
        } else {
          this.sidePanelClient = await addonClient.loadSidePanelClient();
          console.log('[Meet Add-on SDK] Side panel client loaded.');
        }

        this.isLoaded = true;
        return {
          isInsideMeet: true,
          sidePanelClient: this.sidePanelClient,
          mainStageClient: this.mainStageClient,
        };
      }
    } catch (err: any) {
      console.log('[Meet Add-on SDK] Running in development preview / standalone mode:', err.message);
    }

    return {
      isInsideMeet: isInsideMeetIframe,
      sidePanelClient: null,
      mainStageClient: null,
    };
  }

  private loadSdkScript(): Promise<void> {
    return new Promise((resolve) => {
      if (document.getElementById('google-meet-addons-sdk')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-meet-addons-sdk';
      script.src = 'https://www.gstatic.com/meet/addons/1.0.0/meet.addons.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        console.log('[Meet Add-on SDK] SDK script could not be loaded from gstatic, using standalone fallback.');
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  public async promoteToMainStage(mainStageUrl: string): Promise<boolean> {
    if (this.sidePanelClient && typeof this.sidePanelClient.startActivityOrientation === 'function') {
      try {
        await this.sidePanelClient.startActivityOrientation({
          mainStageUrl,
        });
        return true;
      } catch (e: any) {
        console.warn('[Meet Add-on SDK] Main stage orientation notice:', e.message);
      }
    }
    // Fallback: open in new tab
    window.open(mainStageUrl, '_blank');
    return false;
  }
}

export const meetAddonSdk = new MeetAddonSdkService();
