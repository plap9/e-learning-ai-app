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
import { BaseScreenProps, LoginFormData } from '../../types/common.types';
import { Button, Input, Loading } from '../../components/ui';
import { geminiService } from '../../services/gemini.service';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
});

interface LoginScreenProps extends BaseScreenProps {}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(false);
  const [inspirationalSentence, setInspirationalSentence] = useState('Click the button below!');
  const [isGenerating, setIsGenerating] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      // TODO: Implement actual login logic
      console.log('Login data:', data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Navigate to main app
      navigation.replace('Main');
    } catch (error) {
      Alert.alert('Lỗi', 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSentence = async () => {
    setIsGenerating(true);
    try {
      const sentence = await geminiService.generateInspirationalSentence();
      setInspirationalSentence(sentence);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tạo câu cảm hứng. Vui lòng thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  const navigateToRegister = () => {
    navigation.navigate('Register');
  };

  const navigateToForgotPassword = () => {
    navigation.navigate('ForgotPassword');
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
          <Text style={styles.title}>Chào mừng trở lại!</Text>

          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={errors.email?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Mật khẩu"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="••••••••"
                  secureTextEntry
                  error={errors.password?.message}
                />
              )}
            />

            <TouchableOpacity 
              onPress={navigateToForgotPassword}
              style={styles.forgotPasswordLink}
            >
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            <Button
              title="Đăng nhập"
              onPress={handleSubmit(handleLogin)}
              loading={isLoading}
              fullWidth
              style={styles.loginButton}
            />

            <View style={styles.registerLinkContainer}>
              <Text style={styles.registerLinkText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={navigateToRegister}>
                <Text style={styles.registerLinkAction}>Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Gemini Feature Box */}
          <View style={styles.geminiBox}>
            <Text style={styles.geminiTitle}>Câu nói truyền cảm hứng</Text>
            
            <View style={styles.sentenceContainer}>
              {isGenerating ? (
                <Loading 
                  type="spinner" 
                  size="small" 
                  showText={false}
                />
              ) : (
                <Text style={styles.sentenceText}>{inspirationalSentence}</Text>
              )}
            </View>

            <TouchableOpacity 
              onPress={handleGenerateSentence}
              disabled={isGenerating}
              style={styles.generateButton}
            >
              <Text style={styles.generateButtonIcon}>✨</Text>
              <Text style={styles.generateButtonText}>Tạo câu mới</Text>
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
  title: {
    fontSize: ResponsiveUtils.scaleFontSize(28),
    fontWeight: Theme.fontWeights.bold,
    color: Theme.colors.cosmicSoftContrast,
    textAlign: 'center',
    marginBottom: ResponsiveUtils.scaleHeight(10),
  },
  form: {
    gap: ResponsiveUtils.scaleHeight(20),
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginTop: ResponsiveUtils.scaleHeight(-10),
  },
  forgotPasswordText: {
    fontSize: ResponsiveUtils.scaleFontSize(14),
    color: Theme.colors.softAuroraPurple,
    fontWeight: Theme.fontWeights.semibold,
  },
  loginButton: {
    marginTop: ResponsiveUtils.scaleHeight(10),
  },
  registerLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: ResponsiveUtils.scaleHeight(10),
  },
  registerLinkText: {
    fontSize: ResponsiveUtils.scaleFontSize(14),
    color: Theme.colors.inactiveGray,
  },
  registerLinkAction: {
    fontSize: ResponsiveUtils.scaleFontSize(14),
    color: Theme.colors.softAuroraPurple,
    fontWeight: Theme.fontWeights.semibold,
  },
  
  // Gemini Box Styles
  geminiBox: {
    backgroundColor: Theme.colors.white,
    borderRadius: ResponsiveUtils.scaleWidth(16),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Theme.colors.lightAuroraGlow,
    padding: ResponsiveUtils.scaleWidth(20),
    alignItems: 'center',
    ...Theme.shadows.small,
  },
  geminiTitle: {
    fontSize: ResponsiveUtils.scaleFontSize(16),
    fontWeight: Theme.fontWeights.semibold,
    color: Theme.colors.softAuroraPurple,
    marginBottom: ResponsiveUtils.scaleHeight(15),
  },
  sentenceContainer: {
    minHeight: ResponsiveUtils.scaleHeight(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: ResponsiveUtils.scaleHeight(15),
  },
  sentenceText: {
    fontSize: ResponsiveUtils.scaleFontSize(14),
    fontWeight: Theme.fontWeights.medium,
    color: Theme.colors.darkText,
    textAlign: 'center',
    lineHeight: ResponsiveUtils.scaleFontSize(20),
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ResponsiveUtils.scaleWidth(8),
    paddingVertical: ResponsiveUtils.scaleHeight(8),
    paddingHorizontal: ResponsiveUtils.scaleWidth(12),
  },
  generateButtonIcon: {
    fontSize: ResponsiveUtils.scaleFontSize(16),
  },
  generateButtonText: {
    fontSize: ResponsiveUtils.scaleFontSize(14),
    fontWeight: Theme.fontWeights.semibold,
    color: Theme.colors.cosmicSoftContrast,
  },
}); 