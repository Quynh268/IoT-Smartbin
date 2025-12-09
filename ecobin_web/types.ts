export enum AppView {
  DASHBOARD = 'DASHBOARD',
  HISTORY = 'HISTORY',
  ASSISTANT = 'ASSISTANT',
  SETTINGS = 'SETTINGS'
}

export enum TrashStatus {
  EMPTY = 'EMPTY',
  NORMAL = 'NORMAL',
  FULL = 'FULL',
  CRITICAL = 'CRITICAL'
}

export interface TrashCanData {
  id: string;
  level: number; // 0-100
  lidOpen: boolean;
  battery: number; // 0-100
  temperature: number; // Celsius
  humidity: number; // Percentage
  odorLevel: number; // 0-10 (simulated VOC sensor)
  lastEmptied: string;
  emptiedCountToday: number;
  isConnected: boolean;
}

export interface UsageLog {
  id: string;
  timestamp: string;
  type: 'OPEN' | 'EMPTY' | 'ALERT' | 'AUTO_CLOSE';
  details: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}
