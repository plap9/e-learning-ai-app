// User types
export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  phone?: string;
  dateOfBirth?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends User {
  learningLevel: LearningLevel;
  nativeLanguage: string;
  targetLanguage: string;
  subscription?: Subscription;
  progress: LearningProgress;
}

// Learning types
export interface Course {
  id: string;
  title: string;
  description: string;
  level: LearningLevel;
  language: string;
  thumbnail?: string;
  duration: number; // in minutes
  lessonCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  content: string;
  order: number;
  duration: number; // in minutes
  exerciseCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Exercise {
  id: string;
  lessonId: string;
  title: string;
  type: ExerciseType;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  difficulty: DifficultyLevel;
  points: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// Progress tracking types
export interface LearningProgress {
  userId: string;
  courseId: string;
  completedLessons: string[];
  completedExercises: string[];
  currentLessonId?: string;
  totalPoints: number;
  streak: number;
  lastStudyDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExerciseResult {
  id: string;
  userId: string;
  exerciseId: string;
  answer: string;
  isCorrect: boolean;
  points: number;
  timeSpent: number; // in seconds
  attempts: number;
  completedAt: Date;
}

// Payment types
export interface Subscription {
  id: string;
  userId: string;
  planType: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  provider: PaymentProvider;
  status: PaymentStatus;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Audio processing types
export interface AudioFile {
  id: string;
  url: string;
  filename: string;
  format: AudioFormat;
  duration: number; // in seconds
  size: number; // in bytes
  language: string;
  createdAt: Date;
}

export interface PronunciationAnalysis {
  id: string;
  userId: string;
  audioFileId: string;
  referenceText: string;
  transcription: string;
  score: number; // 0-100
  phonemeScores: PhonemeScore[];
  feedback: string;
  createdAt: Date;
}

export interface PhonemeScore {
  phoneme: string;
  score: number; // 0-100
  feedback: string;
}

// AI service types
export interface AITextAnalysis {
  text: string;
  language: string;
  difficulty: DifficultyLevel;
  readabilityScore: number;
  wordCount: number;
  sentenceCount: number;
  vocabularyLevel: VocabularyLevel;
  grammarComplexity: GrammarComplexity;
}

export interface TranslationResult {
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  confidence: number; // 0-1
  alternatives?: string[];
}

export interface GrammarCheck {
  text: string;
  errors: GrammarError[];
  correctedText: string;
  score: number; // 0-100
}

export interface GrammarError {
  position: number;
  length: number;
  message: string;
  suggestions: string[];
  category: GrammarErrorCategory;
}

// Enums
export enum LearningLevel {
  BEGINNER = 'beginner',
  ELEMENTARY = 'elementary',
  INTERMEDIATE = 'intermediate',
  UPPER_INTERMEDIATE = 'upper_intermediate',
  ADVANCED = 'advanced',
  PROFICIENT = 'proficient'
}

export enum ExerciseType {
  MULTIPLE_CHOICE = 'multiple_choice',
  FILL_IN_BLANK = 'fill_in_blank',
  MATCHING = 'matching',
  PRONUNCIATION = 'pronunciation',
  LISTENING = 'listening',
  READING_COMPREHENSION = 'reading_comprehension',
  WRITING = 'writing',
  SPEAKING = 'speaking'
}

export enum DifficultyLevel {
  VERY_EASY = 'very_easy',
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  VERY_HARD = 'very_hard'
}

export enum SubscriptionPlan {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PENDING = 'pending'
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  MOMO = 'momo',
  ZALOPAY = 'zalopay',
  BANK_TRANSFER = 'bank_transfer'
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  MOMO = 'momo',
  ZALOPAY = 'zalopay'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export enum AudioFormat {
  MP3 = 'mp3',
  WAV = 'wav',
  M4A = 'm4a',
  OGG = 'ogg'
}

export enum VocabularyLevel {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  ACADEMIC = 'academic'
}

export enum GrammarComplexity {
  SIMPLE = 'simple',
  COMPOUND = 'compound',
  COMPLEX = 'complex',
  COMPOUND_COMPLEX = 'compound_complex'
}

export enum GrammarErrorCategory {
  SPELLING = 'spelling',
  GRAMMAR = 'grammar',
  PUNCTUATION = 'punctuation',
  STYLE = 'style',
  VOCABULARY = 'vocabulary'
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Request types
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  [key: string]: any;
}

// Authentication types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
}

// Export all types
export * from './index'; 