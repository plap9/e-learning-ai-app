import { NavigatorScreenParams } from '@react-navigation/native';

// Root Stack Navigator
export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Auth Stack Navigator  
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Verify: {
    context: 'register' | 'forgot_password';
    emailOrPhone: string;
  };
  CreatePassword: {
    context: 'register' | 'forgot_password';
    emailOrPhone: string;
    otpCode: string;
  };
};

// Main Bottom Tab Navigator
export type MainTabParamList = {
  Home: undefined;
  Progress: undefined;
  Challenges: undefined;
  Settings: undefined;
};

// Screen names
export const ScreenNames = {
  // Root Stack
  Splash: 'Splash' as const,
  Auth: 'Auth' as const,
  Main: 'Main' as const,
  
  // Auth Stack
  Login: 'Login' as const,
  Register: 'Register' as const,
  ForgotPassword: 'ForgotPassword' as const,
  
  // Main Tab
  Home: 'Home' as const,
  Progress: 'Progress' as const,
  Challenges: 'Challenges' as const,
  Settings: 'Settings' as const,
} as const; 