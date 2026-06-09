import { io } from 'socket.io-client';
import { API_BASE } from './nero';

export const socket = io(API_BASE, {
  autoConnect: false,
  transports: ['websocket'],
});

// Promise wrapper around an ack-style emit.
export function emitAck<T = any>(event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve) => {
    socket.timeout(8000).emit(event, payload, (err: unknown, res: T) => {
      if (err) resolve({ ok: false, reason: 'timeout' } as unknown as T);
      else resolve(res);
    });
  });
}
