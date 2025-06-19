import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../constants/theme';
import { ResponsiveUtils } from '../utils/responsive.utils';
import { BaseScreenProps } from '../types/common.types';

interface SplashScreenProps extends BaseScreenProps {}

export const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start animations sequence
    startAnimations();

    // Navigate to login after animations complete
    const timer = setTimeout(() => {
      navigation.replace('Auth');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  const startAnimations = () => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Logo scale animation
    Animated.sequence([
      Animated.timing(logoScaleAnim, {
        toValue: 1.1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(logoScaleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow animation (repeating)
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Progress bar animation (starts after delay)
    setTimeout(() => {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: false,
      }).start();
    }, 500);
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

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

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Logo Container */}
        <View style={styles.logoSection}>
          <Animated.View
            style={[
              styles.logoContainer,
              {
                transform: [{ scale: logoScaleAnim }],
              },
            ]}
          >
            {/* Glow effect */}
            <Animated.View
              style={[
                styles.logoGlow,
                {
                  opacity: glowOpacity,
                },
              ]}
            />
            
            {/* Logo */}
            <View style={styles.logo}>
              <Text style={styles.logoIcon}>✨</Text>
            </View>
          </Animated.View>

          {/* App Title */}
          <Text style={styles.title}>AI English Learning</Text>
          <Text style={styles.subtitle}>Your personal fluency coach</Text>
        </View>

        {/* Loading Section */}
        <View style={styles.loadingSection}>
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
                <LinearGradient
                  colors={[Theme.colors.mediumAuroraDepth, Theme.colors.softAuroraPurple]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </Animated.View>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.backgroundMain,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ResponsiveUtils.getResponsivePadding().horizontal,
  },
  logoSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    position: 'relative',
    marginBottom: ResponsiveUtils.scaleHeight(40),
  },
  logoGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: Theme.colors.lightAuroraGlow,
    borderRadius: ResponsiveUtils.scaleWidth(70),
    zIndex: 0,
  },
  logo: {
    width: ResponsiveUtils.scaleWidth(120),
    height: ResponsiveUtils.scaleWidth(120),
    backgroundColor: Theme.colors.white,
    borderRadius: ResponsiveUtils.scaleWidth(30),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    ...Theme.shadows.large,
  },
  logoIcon: {
    fontSize: ResponsiveUtils.scaleFontSize(50),
    textShadowColor: Theme.colors.lightAuroraGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
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
    fontWeight: Theme.fontWeights.medium,
    color: Theme.colors.mediumAuroraDepth,
    textAlign: 'center',
  },
  loadingSection: {
    width: '100%',
    paddingBottom: ResponsiveUtils.scaleHeight(80),
  },
  progressContainer: {
    width: '80%',
    alignSelf: 'center',
  },
  progressTrack: {
    height: ResponsiveUtils.scaleHeight(8),
    backgroundColor: Theme.colors.starlightMistBg,
    borderRadius: ResponsiveUtils.scaleHeight(4),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: ResponsiveUtils.scaleHeight(4),
  },
}); 