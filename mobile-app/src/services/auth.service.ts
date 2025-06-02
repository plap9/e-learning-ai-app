import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
const API_BASE_URL = 'http://localhost:3000/api/users'; // API Gateway URL
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_DATA_KEY = 'user_data';

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  currentPlan: 'FREE' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// HTTP helper function
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Add authorization header if access token exists
  const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  if (accessToken) {
    (defaultOptions.headers as any)['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(url, defaultOptions);
    
    // Handle token expiration
    if (response.status === 401) {
      const errorData = await response.json();
      if (errorData.action === 'REFRESH_TOKEN') {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry request with new token
          const newAccessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
          (defaultOptions.headers as any)['Authorization'] = `Bearer ${newAccessToken}`;
          const retryResponse = await fetch(url, defaultOptions);
          return retryResponse.json();
        }
      }
      throw new Error(errorData.message || 'Unauthorized');
    }

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Network error');
    }
    
    return data;
  } catch (error: any) {
    console.error('API Request error:', error);
    throw error;
  }
}

// Auth Service Class
class AuthService {
  // Register new user
  async register(userData: RegisterData): Promise<{ message: string; userId: string }> {
    return apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Login user
  async login(credentials: LoginData): Promise<AuthResponse> {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    // Store tokens and user data
    await this.storeAuthData(response);
    return response;
  }

  // Logout user
  async logout(): Promise<void> {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local storage
      await this.clearAuthData();
    }
  }

  // Forgot password
  async forgotPassword(email: string): Promise<{ message: string }> {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Reset password
  async resetPassword(token: string, newPassword: string, confirmNewPassword: string): Promise<{ message: string }> {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword, confirmNewPassword }),
    });
  }

  // Resend verification email
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    return apiRequest('/auth/resend-verification-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Get user profile
  async getProfile(): Promise<{ user: User }> {
    return apiRequest('/auth/profile');
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    return !!(accessToken && refreshToken);
  }

  // Get current user data
  async getCurrentUser(): Promise<User | null> {
    const userData = await AsyncStorage.getItem(USER_DATA_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  // Store authentication data
  private async storeAuthData(authResponse: AuthResponse): Promise<void> {
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, authResponse.accessToken],
      [REFRESH_TOKEN_KEY, authResponse.refreshToken],
      [USER_DATA_KEY, JSON.stringify(authResponse.user)],
    ]);
  }

  // Clear authentication data
  private async clearAuthData(): Promise<void> {
    await AsyncStorage.multiRemove([
      ACCESS_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
      USER_DATA_KEY,
    ]);
  }

  // Get access token
  async getAccessToken(): Promise<string | null> {
    return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  }

  // Get refresh token
  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  }
}

// Refresh access token function
async function refreshAccessToken(): Promise<boolean> {
  try {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      // Refresh token expired, clear auth data
      await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_DATA_KEY]);
      return false;
    }

    const data = await response.json();
    
    // Update access token and user data
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, data.accessToken],
      [USER_DATA_KEY, JSON.stringify(data.user)],
    ]);

    return true;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}

export const authService = new AuthService();
export default authService; 