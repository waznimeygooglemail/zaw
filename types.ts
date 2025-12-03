
export interface Config {
  telegramToken: string;
  chatId: string;
  threadCount: number;
  useRealNetwork: boolean; // If false, uses simulation mode
  targetUrl: string;
  useProxy: boolean; // New: Toggle for CORS Proxy
  
  // Generator Configs
  codeLength: number;
  charSetMode: 'digits' | 'lowercase' | 'alphanumeric' | 'custom';
  customCharSet: string;
  
  // Session Config
  sessionFetchUrl: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'debug';
}

export interface Stats {
  tested: number;
  valid: number;
  rpm: number; // Requests per minute
  startTime: number;
  sessionId: string | null;
}
