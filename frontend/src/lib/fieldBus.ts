// ============================================================
// NERO PARTY - reaction bus
// A tiny typed emitter: socket handlers publish every reaction
// here so visual layers (the art pulse, future flourishes) can
// react without re-rendering the React tree.
// ============================================================
import type { ReactionType } from './types';

export interface FieldEvents {
  reaction: {
    type: ReactionType;
    frac: number;
    weight: number;
    isBot: boolean;
    participantId: string;
  };
}

type Handler<T> = (payload: T) => void;

const handlers = new Map<keyof FieldEvents, Set<Handler<never>>>();

export const fieldBus = {
  // returns an unsubscribe
  on<K extends keyof FieldEvents>(key: K, fn: Handler<FieldEvents[K]>): () => void {
    let set = handlers.get(key);
    if (!set) handlers.set(key, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => set.delete(fn as Handler<never>);
  },
  emit<K extends keyof FieldEvents>(key: K, payload: FieldEvents[K]): void {
    handlers.get(key)?.forEach((fn) => (fn as Handler<FieldEvents[K]>)(payload));
  },
};
