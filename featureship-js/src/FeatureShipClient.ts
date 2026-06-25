import EventEmitter from 'eventemitter3';
import { EventSource } from 'eventsource';

export interface FeatureShipOptions {
  baseUrl?: string;
}

export interface FeatureFlagConfig {
  isActive: boolean;
  rolloutPercentage: number;
  type: string;
  defaultVariant?: string;
  [key: string]: any;
}

export type FlagsMap = Record<string, FeatureFlagConfig>;

export class FeatureShipClient extends EventEmitter {
  private clientKey: string;
  private baseUrl: string;
  private flags: FlagsMap = {};
  private eventSource: EventSource | null = null;
  private initialized: boolean = false;

  constructor(clientKey: string, options?: FeatureShipOptions) {
    super();
    this.clientKey = clientKey;
    this.baseUrl = options?.baseUrl || 'http://localhost:5000/api/v1';
  }

  /**
   * Initializes the SDK, fetches the initial configuration, and connects to SSE stream.
   */
  public async init(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.fetchInitialConfig();
      this.connectStream();
      this.initialized = true;
      this.emit('ready', this.flags);
    } catch (error) {
      this.emit('error', error);
      console.error('[FeatureShip] Failed to initialize:', error);
    }
  }

  private async fetchInitialConfig() {
    const url = `${this.baseUrl}/client/config`;
    
    // Polyfill fetch for node environments if needed, or assume global fetch is available (Node 18+)
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.clientKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`[FeatureShip] Failed to fetch config: ${response.statusText}`);
    }

    const data = await response.json();
    this.flags = data;
  }

  private connectStream() {
    const url = `${this.baseUrl}/client/stream?clientKey=${this.clientKey}`;
    
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);
        this.handleStreamEvent(data);
      } catch (err) {
        console.error('[FeatureShip] Failed to parse stream event', err);
      }
    };

    this.eventSource.onerror = (err: any) => {
      // EventSource will automatically try to reconnect
      console.error('[FeatureShip] SSE Stream Error Details:', err);
      this.emit('error', new Error(`SSE Stream Error: ${err.message || err.status || 'Unknown error'}`));
    };
  }

  private handleStreamEvent(data: any) {
    if (data.type === 'FLAG_UPDATED' || data.type === 'FLAG_CREATED') {
      const { flagKey, config } = data;
      this.flags[flagKey] = config;
      this.emit('update', flagKey, config);
      this.emit('change', this.flags);
    } else if (data.type === 'CONNECTED') {
      // console.log('[FeatureShip] SSE Connected');
    }
  }

  /**
   * Evaluates a feature flag's state synchronously from memory.
   * Rollout percentage logic is evaluated here or assumed to be evaluated correctly on backend?
   * Since Edge API provides rolloutPercentage, if we need user-based hashing, we'd need userId.
   * For Phase 5, we stick to simple boolean evaluation based on isActive.
   */
  public getFlag(key: string, defaultValue: boolean = false): boolean {
    const flag = this.flags[key];
    if (!flag) return defaultValue;

    // Simple evaluation for now: 
    // If it has a rollout percentage, we can just use isActive for now, 
    // proper hashing requires a user context.
    return flag.isActive;
  }

  public getAllFlags(): FlagsMap {
    return this.flags;
  }
  
  public close() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.initialized = false;
  }
}
