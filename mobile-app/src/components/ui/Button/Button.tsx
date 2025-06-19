import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../../../constants/theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  gradientColors?: string[];
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  gradientColors,
}) => {
  const buttonStyle = [
    styles.button,
    styles[`${variant}Button`],
    styles[`${size}Button`],
    fullWidth && styles.fullWidth,
    disabled && styles.disabledButton,
    style,
  ];

  const textStyleCombined = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  const renderContent = () => (
    <>
      {loading && (
        <ActivityIndicator
          size="small"
          color={
            variant === 'primary' 
              ? Theme.colors.white 
              : Theme.colors.softAuroraPurple
          }
          style={styles.loader}
        />
      )}
      <Text style={textStyleCombined}>{title}</Text>
    </>
  );

  if (variant === 'primary' && !disabled) {
    const colors = gradientColors || [
      Theme.colors.softAuroraPurple,
      Theme.colors.mediumAuroraDepth,
    ];

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={[buttonStyle, { backgroundColor: 'transparent' }]}
      >
        <LinearGradient
          colors={colors}
          style={[StyleSheet.absoluteFill, { borderRadius: Theme.borderRadius.md }]}
        />
        {renderContent()}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={buttonStyle}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    ...Theme.shadows.small,
  },
  fullWidth: {
    width: '100%',
  },
  
  // Variants
  primaryButton: {
    backgroundColor: Theme.colors.softAuroraPurple,
  },
  secondaryButton: {
    backgroundColor: Theme.colors.lightAuroraGlow,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Theme.colors.softAuroraPurple,
  },
  textButton: {
    backgroundColor: 'transparent',
    ...Theme.shadows.small,
    shadowOpacity: 0,
    elevation: 0,
  },
  
  // Sizes
  smallButton: {
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
  },
  mediumButton: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
  },
  largeButton: {
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.lg,
  },
  
  // Disabled state
  disabledButton: {
    opacity: 0.6,
  },
  
  // Text styles
  text: {
    fontWeight: Theme.fontWeights.semibold,
    textAlign: 'center',
  },
  primaryText: {
    color: Theme.colors.white,
    fontSize: Theme.fontSizes.lg,
  },
  secondaryText: {
    color: Theme.colors.softAuroraPurple,
    fontSize: Theme.fontSizes.lg,
  },
  outlineText: {
    color: Theme.colors.softAuroraPurple,
    fontSize: Theme.fontSizes.lg,
  },
  textText: {
    color: Theme.colors.softAuroraPurple,
    fontSize: Theme.fontSizes.lg,
  },
  
  // Text sizes
  smallText: {
    fontSize: Theme.fontSizes.sm,
  },
  mediumText: {
    fontSize: Theme.fontSizes.lg,
  },
  largeText: {
    fontSize: Theme.fontSizes.xl,
  },
  
  disabledText: {
    opacity: 0.6,
  },
  
  loader: {
    marginRight: Theme.spacing.sm,
  },
}); 