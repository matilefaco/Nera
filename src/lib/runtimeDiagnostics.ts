export interface RuntimeEvent {
  type: 'route_change' | 'listener_start' | 'listener_end' | 'firestore_query' | 'error' | 'visibility_change';
  details: any;
  timestamp: string;
}

class RuntimeDiagnostics {
  private events: RuntimeEvent[] = [];
  private readonly MAX_EVENTS = 30;
  private readonly STORAGE_KEY = 'nera_runtime_diagnostics';

  constructor() {
    this.restore();
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => this.log('visibility_change', { state: document.visibilityState }));
    }
  }

  log(type: RuntimeEvent['type'], details: any = {}) {
    const event: RuntimeEvent = {
      type,
      details,
      timestamp: new Date().toISOString()
    };
    
    this.events.unshift(event);
    if (this.events.length > this.MAX_EVENTS) {
      this.events.pop();
    }
    
    this.save();
  }

  getEvents() {
    return [...this.events];
  }

  dump() {
    console.error("[RuntimeDiagnostics] Dump:", this.events);
  }

  private save() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events));
      }
    } catch (e) {
      // Ignored
    }
  }

  private restore() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const data = sessionStorage.getItem(this.STORAGE_KEY);
        if (data) {
          this.events = JSON.parse(data);
        }
      }
    } catch (e) {
      // Ignored
    }
  }
}

export const runtimeLogger = new RuntimeDiagnostics();
