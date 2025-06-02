import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Alert } from 'react-native';
import authService, { User, LoginData, RegisterData } from '../services/auth.service';

// Types
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (credentials: LoginData) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string, confirmNewPassword: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

// Create Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider Props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth Provider Component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Initialize auth state on app start
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const isAuthenticated = await authService.isAuthenticated();
      
      if (isAuthenticated) {
        const user = await authService.getCurrentUser();
        setAuthState({
          user,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const login = async (credentials: LoginData) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authService.login(credentials);
      
      setAuthState({
        user: response.user,
        isLoading: false,
        isAuthenticated: true,
      });

      Alert.alert(
        'Đăng nhập thành công!',
        `Chào mừng ${response.user.firstName} quay trở lại!`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      
      Alert.alert(
        'Lỗi đăng nhập',
        error.message || 'Đã xảy ra lỗi khi đăng nhập',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authService.register(userData);
      
      setAuthState(prev => ({ ...prev, isLoading: false }));

      Alert.alert(
        'Đăng ký thành công!',
        response.message,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      
      Alert.alert(
        'Lỗi đăng ký',
        error.message || 'Đã xảy ra lỗi khi đăng ký tài khoản',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const logout = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      await authService.logout();
      
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });

      Alert.alert(
        'Đăng xuất thành công',
        'Bạn đã đăng xuất khỏi tài khoản',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Logout error:', error);
      
      // Even if logout fails on server, clear local state
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authService.forgotPassword(email);
      
      setAuthState(prev => ({ ...prev, isLoading: false }));

      Alert.alert(
        'Yêu cầu đặt lại mật khẩu',
        response.message,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      
      Alert.alert(
        'Lỗi yêu cầu đặt lại mật khẩu',
        error.message || 'Đã xảy ra lỗi khi gửi yêu cầu',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const resetPassword = async (token: string, newPassword: string, confirmNewPassword: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authService.resetPassword(token, newPassword, confirmNewPassword);
      
      setAuthState(prev => ({ ...prev, isLoading: false }));

      Alert.alert(
        'Đặt lại mật khẩu thành công',
        response.message,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      
      Alert.alert(
        'Lỗi đặt lại mật khẩu',
        error.message || 'Đã xảy ra lỗi khi đặt lại mật khẩu',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const resendVerificationEmail = async (email: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      const response = await authService.resendVerificationEmail(email);
      
      setAuthState(prev => ({ ...prev, isLoading: false }));

      Alert.alert(
        'Gửi email xác thực',
        response.message,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      
      Alert.alert(
        'Lỗi gửi email xác thực',
        error.message || 'Đã xảy ra lỗi khi gửi email xác thực',
        [{ text: 'OK' }]
      );
      throw error;
    }
  };

  const refreshUserData = async () => {
    try {
      if (!authState.isAuthenticated) return;
      
      const profileResponse = await authService.getProfile();
      setAuthState(prev => ({
        ...prev,
        user: profileResponse.user,
      }));
    } catch (error) {
      console.error('Refresh user data error:', error);
      // If profile fetch fails, user might be logged out
      await logout();
    }
  };

  const contextValue: AuthContextType = {
    ...authState,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    resendVerificationEmail,
    refreshUserData,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

export default AuthContext; 