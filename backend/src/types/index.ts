// User related types
export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  notificationSettings: NotificationSettings;
  privacySettings: PrivacySettings;
  theme: 'light' | 'dark' | 'auto';
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  topicUpdates: boolean;
  lawUpdates: boolean;
  weeklyDigest: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends';
  showEmail: boolean;
  showLocation: boolean;
}

// Topic related types
export interface Topic {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  category: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserTopic {
  id: string;
  userId: string;
  topicId: string;
  isFollowed: boolean;
  notificationLevel: 'none' | 'low' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

// Law related types
export interface Law {
  id: string;
  title: string;
  slug: string;
  description: string;
  summary: string;
  stage: LawStage;
  type: LawType;
  proposer: string;
  proposerParty: string;
  introductionDate: Date;
  lastUpdated: Date;
  isActive: boolean;
  congressExpediente?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type LawStage = 'proposed' | 'debating' | 'voting' | 'passed' | 'rejected' | 'withdrawn';
export type LawType = 'bill' | 'amendment' | 'resolution' | 'motion';

export interface LawDetail {
  id: string;
  lawId: string;
  problem: string;
  pros: string[];
  cons: string[];
  impact: string;
  cost: string;
  timeline: LawTimeline[];
  officialSource: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LawTimeline {
  id: string;
  lawId: string;
  event: string;
  date: Date;
  status: LawStage;
  description?: string;
  createdAt: Date;
}

export interface LawParty {
  id: string;
  lawId: string;
  partyName: string;
  position: 'support' | 'oppose' | 'neutral';
  votes?: number;
  createdAt: Date;
}

export interface LawTopic {
  id: string;
  lawId: string;
  topicId: string;
  relevance: number; // 0-100
  createdAt: Date;
}

export interface UserLaw {
  id: string;
  userId: string;
  lawId: string;
  isFollowed: boolean;
  isBookmarked: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Political party types
export interface PoliticalParty {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  color: string;
  ideology: string;
  leader: string;
  seats: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Data and analytics types
export interface LawStatistics {
  total: number;
  byStage: Record<LawStage, number>;
  byType: Record<LawType, number>;
  byTopic: Record<string, number>;
  byParty: Record<string, number>;
  monthlyTrends: MonthlyTrend[];
}

export interface MonthlyTrend {
  month: string;
  proposed: number;
  passed: number;
  rejected: number;
}

export interface TopicStatistics {
  topicId: string;
  topicName: string;
  lawCount: number;
  followerCount: number;
  averageEngagement: number;
  topLaws: string[];
}

// Authentication types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  token: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Search and filter types
export interface LawFilters {
  stage?: LawStage[];
  type?: LawType[];
  topics?: string[];
  proposer?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

export interface TopicFilters {
  category?: string;
  isActive?: boolean;
  search?: string;
}

// Error types
export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;
}

// Database types
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

// Environment types
export interface Environment {
  NODE_ENV: string;
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
  DB_PASSWORD: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CORS_ORIGIN: string;
}

// Spanish Congress XML types
export interface CongressInitiative {
  LEGISLATURA: string;
  SUPERTIPO: string;
  AGRUPACION: string;
  TIPO: string;
  OBJETO: string;
  NUMEXPEDIENTE: string;
  FECHAPRESENTACION: string;
  FECHACALIFICACION: string;
  AUTOR: string;
  TIPOTRAMITACION: string;
  RESULTADOTRAMITACION: string;
  SITUACIONACTUAL: string;
  COMISIONCOMPETENTE: string;
  PLAZOS: string;
  PONENTES: string;
  TRAMITACIONSEGUIDA: string;
  INICIATIVASRELACIONADAS: string;
  INICIATIVASDEORIGEN: string;
  ENLACESBOCG: string;
  ENLACESDS: string;
}

export interface CongressResults {
  results: {
    result: CongressInitiative[];
  };
}

export interface CongressDataProcessor {
  fetchData(): Promise<CongressInitiative[]>;
  parseXML(xmlData: string): Promise<CongressInitiative[]>;
  mapToLaw(initiative: CongressInitiative): Partial<Law>;
  updateDatabase(initiatives: CongressInitiative[]): Promise<void>;
}

export interface CongressUpdateResult {
  totalProcessed: number;
  newLaws: number;
  updatedLaws: number;
  errors: string[];
  processingTime: number;
} 