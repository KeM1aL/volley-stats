import { toast } from '@/hooks/use-toast';

export class ConnectionHandler {
  private isOnline: boolean = true;
  private onlineCallback?: () => Promise<void>;
  private offlineCallback?: () => void;

  constructor(
    onOnline: () => Promise<void>,
    onOffline: () => void
  ) {
    this.onlineCallback = onOnline;
    this.offlineCallback = onOffline;
    this.setupHandlers();
  }

  private setupHandlers() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      this.isOnline = navigator.onLine;
    }
  }

  private handleOnline = async () => {
    this.isOnline = true;
    if (this.onlineCallback) {
      await this.onlineCallback();
      toast({
        title: 'Connection restored',
        description: 'Synchronizing data...',
      });
    }
  };

  private handleOffline = () => {
    this.isOnline = false;
    if (this.offlineCallback) {
      this.offlineCallback();
      toast({
        variant: "destructive",
        title: 'Connection lost',
        description: 'Changes will sync when connection is restored',
      });
    }
  };

  getIsOnline(): boolean {
    return this.isOnline;
  }

  cleanup() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }
}