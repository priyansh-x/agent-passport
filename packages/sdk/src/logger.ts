import { passportEvents } from './events.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface PassportLoggerOptions {
  level?: LogLevel;
  output?: (entry: LogEntry) => void;
}

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export class PassportLogger {
  private minLevel: number;
  private output: (entry: LogEntry) => void;
  private unsubscribers: (() => void)[] = [];

  constructor(options?: PassportLoggerOptions) {
    this.minLevel = LEVELS[options?.level ?? 'info'];
    this.output = options?.output ?? ((e) => console.log(JSON.stringify(e)));
    this.attach();
  }

  private log(level: LogLevel, event: string, data: Record<string, unknown>) {
    if (LEVELS[level] < this.minLevel) return;
    this.output({ level, event, data, timestamp: new Date().toISOString() });
  }

  private attach() {
    this.unsubscribers.push(
      passportEvents.on('authorize', (d) => {
        this.log(d.allowed ? 'info' : 'warn', 'authorize', d);
      }),
      passportEvents.on('authorize:denied', (d) => {
        this.log('warn', 'authorize:denied', d);
      }),
      passportEvents.on('delegate', (d) => {
        this.log('info', 'delegate', d);
      }),
      passportEvents.on('revoke', (d) => {
        this.log('info', 'revoke', d);
      }),
      passportEvents.on('spend', (d) => {
        this.log('info', 'spend', d);
      }),
    );
  }

  detach() {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }
}
