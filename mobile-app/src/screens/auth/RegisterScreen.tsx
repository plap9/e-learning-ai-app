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

import { Theme } from '../../constants/theme';
import { ResponsiveUtils } from '../../utils/responsive.utils';
import { BaseScreenProps } from '../../types/common.types';
import { Button, Input } from '../../components/ui';

// Validation schema
const registerSchema = z.object({
  emailOrPhone: z.string().min(1, 'Vui lòng nhập email hoặc số điện thoại'),
});

interface RegisterFormData {
  emailOrPhone: string;
}

interface RegisterScreenProps extends BaseScreenProps {}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      emailOrPhone: '',
    },
  });

  const handleContinue = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      // TODO: Implement actual registration logic
      console.log('Register data:', data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Navigate to verification with register context
      navigation.navigate('Verify', { 
        context: 'register',
        emailOrPhone: data.emailOrPhone 
      });
    } catch (error) {
      Alert.alert('Lỗi', 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToLogin = () => {
    navigation.navigate('Login');
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
            <Text style={styles.title}>Tạo tài khoản</Text>
            <Text style={styles.subtitle}>Bắt đầu hành trình chinh phục tiếng Anh!</Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="emailOrPhone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email hoặc số điện thoại"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={errors.emailOrPhone?.message}
                />
              )}
            />

            <Button
              title="Tiếp tục"
              onPress={handleSubmit(handleContinue)}
              loading={isLoading}
              fullWidth
              style={styles.continueButton}
            />

            <View style={styles.loginLinkContainer}>
              <Text style={styles.loginLinkText}>Đã có tài khoản? </Text>
              <TouchableOpacity onPress={navigateToLogin}>
                <Text style={styles.loginLinkAction}>Đăng nhập</Text>
              </TouchableOpacity>
            </View>
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
  },
  form: {
    gap: ResponsiveUtils.scaleHeight(20),
  },
  continueButton: {
    marginTop: ResponsiveUtils.scaleHeight(10),
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: ResponsiveUtils.scaleHeight(10),
  },
  loginLinkText: {
    fontSize: ResponsiveUtils.scaleFontSize(14),
    color: Theme.colors.inactiveGray,
  },
  loginLinkAction: {
    fontSize: ResponsiveUtils.scaleFontSize(14),
    color: Theme.colors.softAuroraPurple,
    fontWeight: Theme.fontWeights.semibold,
  },
}); 