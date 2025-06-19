import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../../../constants/theme';

export interface LoadingProps {
  type?: 'spinner' | 'progress';
  progress?: number; // 0 to 100
  size?: 'small' | 'medium' | 'large';
  color?: string;
  text?: string;
  style?: ViewStyle;
  showText?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  type = 'spinner',
  progress = 0,
  size = 'medium',
  color = Theme.colors.softAuroraPurple,
  text,
  style,
  showText = true,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Progress bar animation
  useEffect(() => {
    if (type === 'progress') {
      Animated.timing(progressAnim, {
        toValue: progress / 100,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, type]);

  // Spinner rotation animation
  useEffect(() => {
    if (type === 'spinner') {
      const spin = () => {
        rotateAnim.setValue(0);
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }).start(() => spin());
      };
      spin();
    }
  }, [type]);

  const getSpinnerSize = () => {
    switch (size) {
      case 'small':
        return 20;
      case 'medium':
        return 30;
      case 'large':
        return 40;
      default:
        return 30;
    }
  };

  const containerStyle: ViewStyle = {
    ...styles.container,
    ...style,
  };

  if (type === 'spinner') {
    const rotate = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View style={containerStyle}>
        <Animated.View
          style={[
            styles.spinner,
            {
              width: getSpinnerSize(),
              height: getSpinnerSize(),
              transform: [{ rotate }],
            },
          ]}
        >
          <View
            style={[
              styles.spinnerInner,
              {
                borderTopColor: color,
                borderWidth: size === 'small' ? 2 : 3,
              },
            ]}
          />
        </Animated.View>
        {showText && text && (
          <Text style={styles.text}>{text}</Text>
        )}
      </View>
    );
  }

  if (type === 'progress') {
    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <View style={containerStyle}>
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
              <LinearGradient
                colors={Theme.gradients.progressBarFill}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </Animated.View>
          </View>
        </View>
        {showText && (
          <Text style={styles.progressText}>
            {text || `${Math.round(progress)}%`}
          </Text>
        )}
      </View>
    );
  }

  // Fallback to default ActivityIndicator
  return (
    <View style={containerStyle}>
      <ActivityIndicator
        size={size === 'small' ? 'small' : 'large'}
        color={color}
      />
      {showText && text && (
        <Text style={styles.text}>{text}</Text>
      )}
    </View>
  );
};

export const LoadingOverlay: React.FC<{
  visible: boolean;
  text?: string;
  type?: 'spinner' | 'progress';
  progress?: number;
}> = ({ visible, text, type = 'spinner', progress = 0 }) => {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.overlayContent}>
        <Loading
          type={type}
          progress={progress}
          text={text}
          size="large"
          showText={true}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.spacing.md,
  },
  spinner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerInner: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderColor: Theme.colors.lightAuroraGlow,
    borderTopColor: Theme.colors.softAuroraPurple,
  },
  text: {
    fontSize: Theme.fontSizes.sm,
    color: Theme.colors.inactiveGray,
    marginTop: Theme.spacing.sm,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    maxWidth: 200,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Theme.colors.starlightMistBg,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: Theme.fontSizes.sm,
    color: Theme.colors.cosmicSoftContrast,
    marginTop: Theme.spacing.sm,
    textAlign: 'center',
    fontWeight: Theme.fontWeights.semibold,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  overlayContent: {
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.xxxl,
    ...Theme.shadows.large,
  },
}); 