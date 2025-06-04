import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface BiometricConfig {
  promptMessage?: string;
  promptDescription?: string;
  promptCancel?: string;
  promptFallback?: string;
  disableDeviceFallback?: boolean;
}

export interface BiometricCapabilities {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  securityLevel: 'none' | 'weak' | 'strong';
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  warning?: string;
}

export class BiometricAuthService {
  private static readonly BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
  private static readonly ENCRYPTED_CREDENTIALS_KEY = 'encrypted_credentials';
  private static readonly FALLBACK_PIN_KEY = 'fallback_pin';

  /**
   * Check if device supports biometric authentication
   */
  async checkBiometricCapabilities(): Promise<BiometricCapabilities> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      // Determine security level
      let securityLevel: 'none' | 'weak' | 'strong' = 'none';
      
      if (hasHardware && isEnrolled) {
        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ||
            supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          securityLevel = 'strong';
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          securityLevel = 'strong';
        } else {
          securityLevel = 'weak';
        }
      }

      return {
        hasHardware,
        isEnrolled,
        supportedTypes,
        securityLevel
      };
    } catch (error) {
      console.error('Error checking biometric capabilities:', error);
      return {
        hasHardware: false,
        isEnrolled: false,
        supportedTypes: [],
        securityLevel: 'none'
      };
    }
  }

  /**
   * Check if biometric authentication is enabled for the app
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(BiometricAuthService.BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric enabled status:', error);
      return false;
    }
  }

  /**
   * Enable biometric authentication for the app
   */
  async enableBiometricAuth(credentials?: { email: string; token: string }): Promise<BiometricAuthResult> {
    try {
      const capabilities = await this.checkBiometricCapabilities();
      
      if (!capabilities.hasHardware) {
        return {
          success: false,
          error: 'Device không hỗ trợ xác thực sinh trắc học'
        };
      }

      if (!capabilities.isEnrolled) {
        return {
          success: false,
          error: 'Chưa thiết lập xác thực sinh trắc học trên thiết bị. Vui lòng thiết lập trong Settings.'
        };
      }

      // Authenticate user before enabling
      const authResult = await this.authenticateWithBiometric({
        promptMessage: 'Xác thực để bật đăng nhập sinh trắc học',
        promptDescription: 'Sử dụng vân tay hoặc khuôn mặt để xác thực'
      });

      if (!authResult.success) {
        return authResult;
      }

      // Enable biometric authentication
      await AsyncStorage.setItem(BiometricAuthService.BIOMETRIC_ENABLED_KEY, 'true');

      // Store encrypted credentials if provided
      if (credentials) {
        await this.storeEncryptedCredentials(credentials);
      }

      return {
        success: true
      };
    } catch (error) {
      console.error('Error enabling biometric auth:', error);
      return {
        success: false,
        error: 'Không thể bật xác thực sinh trắc học'
      };
    }
  }

  /**
   * Disable biometric authentication
   */
  async disableBiometricAuth(): Promise<BiometricAuthResult> {
    try {
      await AsyncStorage.setItem(BiometricAuthService.BIOMETRIC_ENABLED_KEY, 'false');
      await this.clearEncryptedCredentials();
      
      return {
        success: true
      };
    } catch (error) {
      console.error('Error disabling biometric auth:', error);
      return {
        success: false,
        error: 'Không thể tắt xác thực sinh trắc học'
      };
    }
  }

  /**
   * Authenticate user with biometric
   */
  async authenticateWithBiometric(config?: BiometricConfig): Promise<BiometricAuthResult> {
    try {
      const capabilities = await this.checkBiometricCapabilities();
      
      if (!capabilities.hasHardware) {
        return {
          success: false,
          error: 'Device không hỗ trợ xác thực sinh trắc học'
        };
      }

      if (!capabilities.isEnrolled) {
        return {
          success: false,
          error: 'Chưa thiết lập xác thực sinh trắc học'
        };
      }

      // Prepare authentication options
      const authOptions: LocalAuthentication.LocalAuthenticationOptions = {
        promptMessage: config?.promptMessage || 'Xác thực để đăng nhập',
        cancelLabel: config?.promptCancel || 'Hủy',
        disableDeviceFallback: config?.disableDeviceFallback || false,
        requireConfirmation: false,
      };

      // Add fallback label for iOS
      if (Platform.OS === 'ios') {
        authOptions.fallbackLabel = config?.promptFallback || 'Sử dụng mật khẩu';
      }

      const result = await LocalAuthentication.authenticateAsync(authOptions);

      if (result.success) {
        return {
          success: true
        };
      } else {
        let error = 'Xác thực không thành công';
        
        if (result.error === 'user_cancel') {
          error = 'Người dùng đã hủy xác thực';
        } else if (result.error === 'user_fallback') {
          error = 'Người dùng chọn phương thức khác';
        } else if (result.error === 'system_cancel') {
          error = 'Hệ thống đã hủy xác thực';
        } else if (result.error === 'passcode_not_set') {
          error = 'Chưa thiết lập mật khẩu thiết bị';
        } else if (result.error === 'not_available') {
          error = 'Xác thực sinh trắc học không khả dụng';
        } else if (result.error === 'not_enrolled') {
          error = 'Chưa đăng ký xác thực sinh trắc học';
        }

        return {
          success: false,
          error
        };
      }
    } catch (error) {
      console.error('Error during biometric authentication:', error);
      return {
        success: false,
        error: 'Lỗi xác thực sinh trắc học'
      };
    }
  }

  /**
   * Get stored biometric login credentials
   */
  async getBiometricCredentials(): Promise<{ email: string; token: string } | null> {
    try {
      const isBiometricEnabled = await this.isBiometricEnabled();
      if (!isBiometricEnabled) {
        return null;
      }

      // Authenticate with biometric first
      const authResult = await this.authenticateWithBiometric({
        promptMessage: 'Xác thực để đăng nhập',
        promptDescription: 'Sử dụng vân tay hoặc khuôn mặt để đăng nhập'
      });

      if (!authResult.success) {
        throw new Error(authResult.error);
      }

      const encryptedData = await SecureStore.getItemAsync(BiometricAuthService.ENCRYPTED_CREDENTIALS_KEY);
      
      if (!encryptedData) {
        return null;
      }

      return JSON.parse(encryptedData);
    } catch (error) {
      console.error('Error getting biometric credentials:', error);
      return null;
    }
  }

  /**
   * Store encrypted credentials for biometric login
   */
  private async storeEncryptedCredentials(credentials: { email: string; token: string }): Promise<void> {
    try {
      const encryptedData = JSON.stringify(credentials);
      await SecureStore.setItemAsync(
        BiometricAuthService.ENCRYPTED_CREDENTIALS_KEY,
        encryptedData,
        {
          requireAuthentication: true,
          authenticationPrompt: 'Xác thực để lưu thông tin đăng nhập'
        }
      );
    } catch (error) {
      console.error('Error storing encrypted credentials:', error);
      throw error;
    }
  }

  /**
   * Clear stored encrypted credentials
   */
  private async clearEncryptedCredentials(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(BiometricAuthService.ENCRYPTED_CREDENTIALS_KEY);
    } catch (error) {
      console.error('Error clearing encrypted credentials:', error);
    }
  }

  /**
   * Get biometric authentication type name in Vietnamese
   */
  getBiometricTypeName(types: LocalAuthentication.AuthenticationType[]): string {
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID / Vân tay';
    } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris / Mống mắt';
    }
    return 'Xác thực sinh trắc học';
  }

  /**
   * Set up fallback PIN for when biometric fails
   */
  async setupFallbackPIN(pin: string): Promise<BiometricAuthResult> {
    try {
      if (pin.length !== 6 || !/^\d+$/.test(pin)) {
        return {
          success: false,
          error: 'Mã PIN phải có 6 chữ số'
        };
      }

      // Hash the PIN before storing
      const hashedPIN = await this.hashPIN(pin);
      await SecureStore.setItemAsync(BiometricAuthService.FALLBACK_PIN_KEY, hashedPIN);

      return {
        success: true
      };
    } catch (error) {
      console.error('Error setting up fallback PIN:', error);
      return {
        success: false,
        error: 'Không thể thiết lập mã PIN'
      };
    }
  }

  /**
   * Verify fallback PIN
   */
  async verifyFallbackPIN(pin: string): Promise<BiometricAuthResult> {
    try {
      const storedHash = await SecureStore.getItemAsync(BiometricAuthService.FALLBACK_PIN_KEY);
      
      if (!storedHash) {
        return {
          success: false,
          error: 'Chưa thiết lập mã PIN'
        };
      }

      const hashedPIN = await this.hashPIN(pin);
      
      if (hashedPIN === storedHash) {
        return {
          success: true
        };
      } else {
        return {
          success: false,
          error: 'Mã PIN không chính xác'
        };
      }
    } catch (error) {
      console.error('Error verifying fallback PIN:', error);
      return {
        success: false,
        error: 'Lỗi xác thực mã PIN'
      };
    }
  }

  /**
   * Simple PIN hashing (in production, use proper cryptographic hash)
   */
  private async hashPIN(pin: string): Promise<string> {
    // Simple hash for demo - use proper cryptographic hash in production
    return btoa(pin + 'salt123').replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Get biometric security recommendations
   */
  async getSecurityRecommendations(): Promise<string[]> {
    const capabilities = await this.checkBiometricCapabilities();
    const recommendations: string[] = [];

    if (!capabilities.hasHardware) {
      recommendations.push('Thiết bị không hỗ trợ xác thực sinh trắc học');
    } else if (!capabilities.isEnrolled) {
      recommendations.push('Thiết lập xác thực sinh trắc học trong Settings để tăng bảo mật');
    } else {
      if (capabilities.supportedTypes.length === 1) {
        recommendations.push('Cân nhắc thiết lập thêm phương thức xác thực sinh trắc học khác');
      }
      
      if (capabilities.securityLevel === 'weak') {
        recommendations.push('Phương thức xác thực hiện tại có độ bảo mật thấp');
      }
    }

    // Always recommend PIN backup
    try {
      const hasFallbackPIN = await SecureStore.getItemAsync(BiometricAuthService.FALLBACK_PIN_KEY);
      if (!hasFallbackPIN) {
        recommendations.push('Thiết lập mã PIN dự phòng cho trường hợp xác thực sinh trắc học thất bại');
      }
    } catch (error) {
      recommendations.push('Thiết lập mã PIN dự phòng cho trường hợp xác thực sinh trắc học thất bại');
    }

    return recommendations;
  }
}

// Export singleton instance
export const biometricAuthService = new BiometricAuthService(); 