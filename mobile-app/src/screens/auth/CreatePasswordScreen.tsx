import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';

import { Theme } from '../../constants/theme';
import { ResponsiveUtils } from '../../utils/responsive.utils';
import { BaseScreenProps } from '../../types/common.types';
import { Button, Input } from '../../components/ui';

// Validation schema
const createPasswordSchema = z.object({
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
  confirmPassword: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
});

interface CreatePasswordFormData {
  password: string;
  confirmPassword: string;
}

interface CreatePasswordScreenProps extends BaseScreenProps {
  route: {
    params: {
      context: 'register' | 'forgot_password';
      emailOrPhone: string;
      otpCode: string;
    };
  };
}

export const CreatePasswordScreen: React.FC<CreatePasswordScreenProps> = ({ navigation, route }) => {
  const { context, emailOrPhone, otpCode } = route.params;
  const insets = useSafeAreaInsets();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePasswordFormData>({
    resolver: zodResolver(createPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const handleFinishSetup = async (data: CreatePasswordFormData) => {
    setIsLoading(true);
    try {
      // TODO: Implement actual password creation logic
      console.log('Create password:', { 
        password: data.password, 
        context, 
        emailOrPhone, 
        otpCode 
      });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Navigate based on context
      if (context === 'register') {
        // Success registration - go to main app
        Alert.alert(
          'Thành công!', 
          'Tài khoản đã được tạo thành công',
          [{ text: 'OK', onPress: () => navigation.replace('Main') }]
        );
      } else {
        // Success reset password - go back to login
        Alert.alert(
          'Thành công!', 
          'Mật khẩu đã được đặt lại thành công',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tạo mật khẩu. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Context-aware titles
  const getTitle = () => {
    return context === 'register' ? 'Tạo mật khẩu' : 'Tạo mật khẩu mới';
  };

  const getSubtitle = () => {
    return context === 'register' 
      ? 'Mật khẩu phải có ít nhất 8 ký tự.'
      : 'Nhập mật khẩu mới cho tài khoản của bạn.';
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
            <Text style={styles.title}>{getTitle()}</Text>
            <Text style={styles.subtitle}>{getSubtitle()}</Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.passwordInputContainer}>
                  <Input
                    label="Mật khẩu mới"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    error={errors.password?.message}
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity 
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons 
                      name={showPassword ? 'eye-off' : 'eye'} 
                      size={20} 
                      color={Theme.colors.inactiveGray}
                    />
                  </TouchableOpacity>
                </View>
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.passwordInputContainer}>
                  <Input
                    label="Xác nhận mật khẩu"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="••••••••"
                    secureTextEntry={!showConfirmPassword}
                    error={errors.confirmPassword?.message}
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity 
                    style={styles.passwordToggle}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons 
                      name={showConfirmPassword ? 'eye-off' : 'eye'} 
                      size={20} 
                      color={Theme.colors.inactiveGray}
                    />
                  </TouchableOpacity>
                </View>
              )}
            />

            <Button
              title="Hoàn tất"
              onPress={handleSubmit(handleFinishSetup)}
              loading={isLoading}
              fullWidth
              style={styles.finishButton}
            />
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
  
  // Password Input with Toggle
  passwordInputContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: ResponsiveUtils.scaleWidth(50), // Space for toggle button
  },
  passwordToggle: {
    position: 'absolute',
    right: ResponsiveUtils.scaleWidth(15),
    top: ResponsiveUtils.scaleHeight(38), // Adjust based on label height
    padding: ResponsiveUtils.scaleWidth(5),
    zIndex: 1,
  },
  
  finishButton: {
    marginTop: ResponsiveUtils.scaleHeight(20),
  },
}); 