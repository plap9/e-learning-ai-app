import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Theme } from '../../../constants/theme';

export interface CardProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  onPress?: () => void;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  variant?: 'default' | 'gradient' | 'outlined' | 'elevated';
  disabled?: boolean;
  gradientColors?: string[];
  padding?: number;
  borderRadius?: number;
  shadowLevel?: 'none' | 'small' | 'medium' | 'large';
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  onPress,
  style,
  titleStyle,
  subtitleStyle,
  variant = 'default',
  disabled = false,
  gradientColors,
  padding = Theme.spacing.xl,
  borderRadius = Theme.borderRadius.lg,
  shadowLevel = 'small',
}) => {
  const getShadowStyle = () => {
    switch (shadowLevel) {
      case 'none':
        return {};
      case 'small':
        return Theme.shadows.small;
      case 'medium':
        return Theme.shadows.medium;
      case 'large':
        return Theme.shadows.large;
      default:
        return Theme.shadows.small;
    }
  };

  const baseCardStyle: ViewStyle = {
    borderRadius,
    padding,
    ...getShadowStyle(),
    ...(disabled && { opacity: 0.6 }),
  };

  const cardStyle: ViewStyle = {
    ...baseCardStyle,
    ...getVariantStyle(variant),
    ...style,
  };

  const titleTextStyle: TextStyle = {
    ...styles.title,
    ...titleStyle,
  };

  const subtitleTextStyle: TextStyle = {
    ...styles.subtitle,
    ...subtitleStyle,
  };

  const renderContent = () => (
    <>
      {title && <Text style={titleTextStyle}>{title}</Text>}
      {subtitle && <Text style={subtitleTextStyle}>{subtitle}</Text>}
      {children}
    </>
  );

  if (variant === 'gradient') {
    const colors = gradientColors || Theme.gradients.gradientFlow;
    
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || !onPress}
        activeOpacity={onPress ? 0.8 : 1}
        style={[baseCardStyle, { backgroundColor: 'transparent' }, style]}
      >
        <LinearGradient
          colors={colors}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.gradientContent}>
          {renderContent()}
        </View>
      </TouchableOpacity>
    );
  }

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        style={cardStyle}
      >
        {renderContent()}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle}>
      {renderContent()}
    </View>
  );
};

const getVariantStyle = (variant: CardProps['variant']): ViewStyle => {
  switch (variant) {
    case 'default':
      return {
        backgroundColor: Theme.colors.white,
        borderWidth: 1,
        borderColor: Theme.colors.borderColor,
      };
    case 'gradient':
      return {
        backgroundColor: 'transparent',
      };
    case 'outlined':
      return {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: Theme.colors.softAuroraPurple,
      };
    case 'elevated':
      return {
        backgroundColor: Theme.colors.white,
        ...Theme.shadows.medium,
      };
    default:
      return {
        backgroundColor: Theme.colors.white,
        borderWidth: 1,
        borderColor: Theme.colors.borderColor,
      };
  }
};

// Section Card for Learning Categories
export interface SectionCardProps {
  icon: string;
  title: string;
  description: string;
  iconColor: string;
  backgroundColor: string;
  progress?: number;
  isLocked?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  icon,
  title,
  description,
  iconColor,
  backgroundColor,
  progress = 0,
  isLocked = false,
  onPress,
  style,
}) => {
  const cardStyle: ViewStyle = {
    ...styles.sectionCard,
    ...style,
  };

  const iconContainerStyle: ViewStyle = {
    ...styles.iconContainer,
    backgroundColor,
  };

  return (
    <Card
      onPress={onPress}
      style={cardStyle}
      disabled={isLocked}
      shadowLevel="small"
    >
      <View style={iconContainerStyle}>
        <Text style={[styles.iconText, { color: iconColor }]}>
          {icon}
        </Text>
      </View>
      
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDescription}>{description}</Text>
      
      {progress > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${progress}%`, backgroundColor: iconColor }
              ]} 
            />
          </View>
        </View>
      )}
      
      {isLocked && (
        <View style={styles.lockOverlay}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: Theme.fontSizes.xl,
    fontWeight: Theme.fontWeights.semibold,
    color: Theme.colors.darkText,
    marginBottom: Theme.spacing.xs,
  },
  subtitle: {
    fontSize: Theme.fontSizes.md,
    color: Theme.colors.inactiveGray,
    marginBottom: Theme.spacing.sm,
  },
  gradientContent: {
    // Content inside gradient cards should have appropriate text colors
  },
  
  // Section Card styles
  sectionCard: {
    padding: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    position: 'relative',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 24,
  },
  sectionTitle: {
    fontSize: Theme.fontSizes.lg,
    fontWeight: Theme.fontWeights.semibold,
    color: Theme.colors.darkText,
  },
  sectionDescription: {
    fontSize: Theme.fontSizes.sm,
    color: Theme.colors.inactiveGray,
  },
  progressContainer: {
    marginTop: Theme.spacing.sm,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Theme.colors.borderColor,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Theme.borderRadius.lg,
  },
  lockIcon: {
    fontSize: 24,
    opacity: 0.6,
  },
}); 