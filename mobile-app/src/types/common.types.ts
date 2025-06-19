// Common types used throughout the app

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  streak: number;
  level: number;
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface DailyProgress {
  date: string;
  percentage: number;
  completedLessons: number;
  totalLessons: number;
  streakDay: number;
}

export interface LearningSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  backgroundColor: string;
  progress: number;
  isLocked: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

// Gemini API types
export interface GeminiApiRequest {
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{
      text: string;
    }>;
  }>;
}

export interface GeminiApiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

// Screen props types
export interface BaseScreenProps {
  navigation: any;
  route: any;
}

// Animation types
export interface FadeInUpConfig {
  duration?: number;
  delay?: number;
  useNativeDriver?: boolean;
}

// Device orientation
export type DeviceOrientation = 'portrait' | 'landscape';

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
} 