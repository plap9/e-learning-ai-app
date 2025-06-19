import { Dimensions, PixelRatio } from 'react-native';
import { DeviceOrientation } from '../types/common.types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 12/13/14 as reference)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export class ResponsiveUtils {
  // Get current screen dimensions
  static getScreenDimensions() {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  }

  // Get device orientation
  static getOrientation(): DeviceOrientation {
    const { width, height } = ResponsiveUtils.getScreenDimensions();
    return width > height ? 'landscape' : 'portrait';
  }

  // Scale width based on screen width
  static scaleWidth(size: number): number {
    const { width } = ResponsiveUtils.getScreenDimensions();
    return PixelRatio.roundToNearestPixel((size * width) / BASE_WIDTH);
  }

  // Scale height based on screen height
  static scaleHeight(size: number): number {
    const { height } = ResponsiveUtils.getScreenDimensions();
    return PixelRatio.roundToNearestPixel((size * height) / BASE_HEIGHT);
  }

  // Scale font size
  static scaleFontSize(size: number): number {
    const { width } = ResponsiveUtils.getScreenDimensions();
    const scale = width / BASE_WIDTH;
    const newSize = size * scale;
    
    // Don't let font size get too small or too large
    return Math.max(12, Math.min(newSize, size * 1.3));
  }

  // Moderate scale - less aggressive scaling
  static moderateScale(size: number, factor: number = 0.5): number {
    const { width } = ResponsiveUtils.getScreenDimensions();
    const scale = width / BASE_WIDTH;
    return size + (scale - 1) * factor;
  }

  // Check if device is tablet
  static isTablet(): boolean {
    const { width, height } = ResponsiveUtils.getScreenDimensions();
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    return Math.min(width, height) >= 600 && aspectRatio < 1.6;
  }

  // Check if device is small (iPhone SE, etc.)
  static isSmallDevice(): boolean {
    const { width, height } = ResponsiveUtils.getScreenDimensions();
    return width <= 375 && height <= 667;
  }

  // Check if device is large (iPhone Plus, Max, etc.)
  static isLargeDevice(): boolean {
    const { width, height } = ResponsiveUtils.getScreenDimensions();
    return width >= 414 || height >= 896;
  }

  // Get responsive padding
  static getResponsivePadding() {
    if (ResponsiveUtils.isTablet()) {
      return {
        horizontal: ResponsiveUtils.scaleWidth(32),
        vertical: ResponsiveUtils.scaleHeight(24),
      };
    }
    
    if (ResponsiveUtils.isSmallDevice()) {
      return {
        horizontal: ResponsiveUtils.scaleWidth(16),
        vertical: ResponsiveUtils.scaleHeight(12),
      };
    }

    return {
      horizontal: ResponsiveUtils.scaleWidth(20),
      vertical: ResponsiveUtils.scaleHeight(16),
    };
  }

  // Get responsive grid columns
  static getGridColumns(): number {
    if (ResponsiveUtils.isTablet()) {
      return ResponsiveUtils.getOrientation() === 'landscape' ? 4 : 3;
    }
    
    return 2; // Mobile always 2 columns
  }

  // Get responsive card dimensions
  static getCardDimensions() {
    const { width } = ResponsiveUtils.getScreenDimensions();
    const padding = ResponsiveUtils.getResponsivePadding();
    const gap = ResponsiveUtils.scaleWidth(15);
    const columns = ResponsiveUtils.getGridColumns();
    
    const availableWidth = width - (padding.horizontal * 2) - (gap * (columns - 1));
    const cardWidth = availableWidth / columns;
    
    return {
      width: cardWidth,
      height: cardWidth * 0.8, // Maintain aspect ratio
    };
  }

  // Get responsive font sizes based on device
  static getResponsiveFontSizes() {
    const base = {
      xs: 10,
      sm: 12,
      md: 14,
      lg: 16,
      xl: 18,
      xxl: 20,
      xxxl: 24,
      xxxxl: 28,
      xxxxxl: 32,
    };

    if (ResponsiveUtils.isTablet()) {
      return Object.fromEntries(
        Object.entries(base).map(([key, value]) => [
          key,
          ResponsiveUtils.scaleFontSize(value * 1.2),
        ])
      );
    }

    if (ResponsiveUtils.isSmallDevice()) {
      return Object.fromEntries(
        Object.entries(base).map(([key, value]) => [
          key,
          ResponsiveUtils.scaleFontSize(value * 0.9),
        ])
      );
    }

    return Object.fromEntries(
      Object.entries(base).map(([key, value]) => [
        key,
        ResponsiveUtils.scaleFontSize(value),
      ])
    );
  }

  // Get safe area insets (approximate)
  static getSafeAreaInsets() {
    const { height } = ResponsiveUtils.getScreenDimensions();
    
    // Approximate safe area for different devices
    if (height >= 812) { // iPhone X and newer
      return {
        top: 44,
        bottom: 34,
        left: 0,
        right: 0,
      };
    }
    
    return {
      top: 20,
      bottom: 0,
      left: 0,
      right: 0,
    };
  }

  // Responsive spacing
  static getSpacing() {
    const base = {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      xxl: 24,
      xxxl: 30,
      xxxxl: 40,
    };

    return Object.fromEntries(
      Object.entries(base).map(([key, value]) => [
        key,
        ResponsiveUtils.moderateScale(value),
      ])
    );
  }
}

// Export commonly used functions
export const {
  scaleWidth,
  scaleHeight,
  scaleFontSize,
  moderateScale,
  isTablet,
  isSmallDevice,
  isLargeDevice,
  getOrientation,
  getScreenDimensions,
  getResponsivePadding,
  getGridColumns,
  getCardDimensions,
  getResponsiveFontSizes,
  getSafeAreaInsets,
  getSpacing,
} = ResponsiveUtils; 