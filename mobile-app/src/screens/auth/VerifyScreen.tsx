import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Theme } from '../../constants/theme';
import { ResponsiveUtils } from '../../utils/responsive.utils';
import { BaseScreenProps } from '../../types/common.types';
import { Button } from '../../components/ui';

interface VerifyScreenProps extends BaseScreenProps {
  route: {
    params: {
      context: 'register' | 'forgot_password';
      emailOrPhone: string;
    };
  };
}

export const VerifyScreen: React.FC<VerifyScreenProps> = ({ navigation, route }) => {
  const { context, emailOrPhone } = route.params;
  const insets = useSafeAreaInsets();
  
  const [isLoading, setIsLoading] = useState(false);
  const [otpValues, setOtpValues] = useState(['', '', '', '']);
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(30);
  
  // Refs for OTP inputs
  const otpRefs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  useEffect(() => {
    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleOtpChange = (text: string, index: number) => {
    const newOtpValues = [...otpValues];
    
    // Only allow one character
    if (text.length > 1) {
      return;
    }
    
    newOtpValues[index] = text;
    setOtpValues(newOtpValues);

    // Auto-focus next input
    if (text && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace') {
      const newOtpValues = [...otpValues];
      
      if (otpValues[index]) {
        // Clear current input
        newOtpValues[index] = '';
        setOtpValues(newOtpValues);
      } else if (index > 0) {
        // Move to previous input and clear it
        newOtpValues[index - 1] = '';
        setOtpValues(newOtpValues);
        otpRefs[index - 1].current?.focus();
      }
    }
  };

  const handleVerifyCode = async () => {
    const otpCode = otpValues.join('');
    
    if (otpCode.length !== 4) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ mã xác thực');
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Implement actual verification logic
      console.log('Verify OTP:', { otpCode, context, emailOrPhone });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Navigate based on context
      navigation.navigate('CreatePassword', { 
        context,
        emailOrPhone,
        otpCode 
      });
    } catch (error) {
      Alert.alert('Lỗi', 'Mã xác thực không đúng. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    
    try {
      // TODO: Implement actual resend logic
      console.log('Resend OTP for:', emailOrPhone);
      
      // Reset countdown
      setCanResend(false);
      setCountdown(30);
      
      // Clear OTP inputs
      setOtpValues(['', '', '', '']);
      otpRefs[0].current?.focus();
      
      Alert.alert('Thành công', 'Mã xác thực đã được gửi lại');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể gửi lại mã. Vui lòng thử lại.');
    }
  };

  const containerStyle = {
    ...styles.container,
    paddingTop: insets.top,
  };

  return (
    <View style={containerStyle}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />
      
      <LinearGradient
        colors={Theme.gradients.splashBgGradient}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Xác thực mã</Text>
            <Text style={styles.subtitle}>
              Nhập mã 4 chữ số được gửi đến {emailOrPhone}
            </Text>
          </View>

          <View style={styles.form}>
            {/* OTP Input Container */}
            <View style={styles.otpContainer}>
              {otpValues.map((value, index) => (
                <TextInput
                  key={index}
                  ref={otpRefs[index]}
                  style={[
                    styles.otpInput,
                    value ? styles.otpInputFilled : null,
                  ]}
                  value={value}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
                  keyboardType="numeric"
                  maxLength={1}
                  textAlign="center"
                  selectTextOnFocus
                />
              ))}
            </View>

            <Button
              title="Xác thực"
              onPress={handleVerifyCode}
              loading={isLoading}
              fullWidth
              style={styles.verifyButton}
            />

            {/* Resend Button */}
            <TouchableOpacity 
              onPress={handleResendCode}
              disabled={!canResend}
              style={styles.resendButton}
            >
              <Text style={[
                styles.resendButtonText,
                !canResend && styles.resendButtonTextDisabled
              ]}>
                {canResend ? 'Gửi lại mã' : `Gửi lại mã sau (${countdown}s)`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.backgroundMain,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: ResponsiveUtils.getResponsivePadding().horizontal,
    paddingVertical: ResponsiveUtils.scaleHeight(40),
  },
  formContainer: {
    gap: ResponsiveUtils.scaleHeight(25),
  },
  header: {
    alignItems: 'center',
    marginBottom: ResponsiveUtils.scaleHeight(10),
  },
  title: {
    fontSize: ResponsiveUtils.scaleFontSize(28),
    fontWeight: Theme.fontWeights.bold,
    color: Theme.colors.cosmicSoftContrast,
    textAlign: 'center',
    marginBottom: ResponsiveUtils.scaleHeight(8),
  },
  subtitle: {
    fontSize: ResponsiveUtils.scaleFontSize(16),
    color: Theme.colors.inactiveGray,
    textAlign: 'center',
    lineHeight: ResponsiveUtils.scaleFontSize(22),
  },
  form: {
    gap: ResponsiveUtils.scaleHeight(20),
  },
  
  // OTP Input Styles
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: ResponsiveUtils.scaleWidth(10),
    marginVertical: ResponsiveUtils.scaleHeight(10),
  },
  otpInput: {
    width: ResponsiveUtils.scaleWidth(45),
    height: ResponsiveUtils.scaleHeight(50),
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.borderColor,
    backgroundColor: Theme.colors.white,
    fontSize: ResponsiveUtils.scaleFontSize(24),
    fontWeight: Theme.fontWeights.semibold,
    color: Theme.colors.darkText,
    textAlign: 'center',
    ...Theme.shadows.small,
  },
  otpInputFilled: {
    borderColor: Theme.colors.softAuroraPurple,
    backgroundColor: Theme.colors.whisperPinkBg,
  },
  
  verifyButton: {
    marginTop: ResponsiveUtils.scaleHeight(20),
  },
  
  resendButton: {
    alignItems: 'center',
    paddingVertical: ResponsiveUtils.scaleHeight(10),
  },
  resendButtonText: {
    fontSize: ResponsiveUtils.scaleFontSize(14),
    fontWeight: Theme.fontWeights.semibold,
    color: Theme.colors.softAuroraPurple,
  },
  resendButtonTextDisabled: {
    color: Theme.colors.inactiveGray,
  },
}); 