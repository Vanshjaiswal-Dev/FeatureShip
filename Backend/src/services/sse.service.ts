import { Response } from 'express';
import { redisSubscriber } from '../config/redis';

class SSEService {
  // Map of clientKey to an array of active SSE response objects
  private clients: Map<string, Response[]> = new Map();

  constructor() {
    this.init();
  }

  private init() {
    // Subscribe to the global 'flag-updates' channel
    redisSubscriber.subscribe('flag-updates', (message) => {
      try {
        const payload = JSON.parse(message);
        const { clientKey, ...data } = payload;
        
        if (clientKey) {
          this.broadcastToClient(clientKey, data);
        }
      } catch (error) {
        console.error('SSE Service: Error parsing Redis message', error);
      }
    });
  }

  public addClient(clientKey: string, res: Response) {
    if (!this.clients.has(clientKey)) {
      this.clients.set(clientKey, []);
    }
    this.clients.get(clientKey)!.push(res);
  }

  public removeClient(clientKey: string, res: Response) {
    const activeClients = this.clients.get(clientKey);
    if (activeClients) {
      this.clients.set(
        clientKey,
        activeClients.filter(client => client !== res)
      );

      if (this.clients.get(clientKey)!.length === 0) {
        this.clients.delete(clientKey);
      }
    }
  }

  private broadcastToClient(clientKey: string, data: any) {
    const activeClients = this.clients.get(clientKey);
    if (activeClients) {
      const eventString = `data: ${JSON.stringify(data)}\n\n`;
      activeClients.forEach(res => {
        res.write(eventString);
      });
    }
  }
}

export const sseService = new SSEService();
