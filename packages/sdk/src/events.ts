type EventMap = {
  'authorize': { passportId: string; action: string; allowed: boolean; reason?: string };
  'authorize:denied': { passportId: string; action: string; reason: string };
  'delegate': { parentId: string; childId: string; agent: string };
  'revoke': { passportId: string; count: number };
  'spend': { passportId: string; amount: number; remaining: number };
};

type EventName = keyof EventMap;
type Listener<T> = (data: T) => void;

export class PassportEvents {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  on<K extends EventName>(event: K, listener: Listener<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const set = this.listeners.get(event)!;
    set.add(listener as Listener<unknown>);
    return () => set.delete(listener as Listener<unknown>);
  }

  once<K extends EventName>(event: K, listener: Listener<EventMap[K]>): () => void {
    const unsub = this.on(event, (data) => {
      unsub();
      listener(data);
    });
    return unsub;
  }

  emit<K extends EventName>(event: K, data: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) for (const fn of set) fn(data);
  }

  removeAll(event?: EventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export const passportEvents = new PassportEvents();
