import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';
import { Theme } from '../../../constants/theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  style?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete = 'off',
  style,
  inputStyle,
  labelStyle,
  errorStyle,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Theme.colors.borderColor, Theme.colors.softAuroraPurple],
  });

  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });

  // Build styles dynamically
  const containerStyle: ViewStyle = {
    ...styles.container,
    ...style,
  };

  const animatedInputStyle = {
    ...styles.input,
    borderColor,
    shadowColor: Theme.colors.lightAuroraGlow,
    shadowOpacity,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: isFocused ? 4 : 0,
    ...(error && styles.inputError),
    ...(disabled && styles.inputDisabled),
    ...(multiline && { height: numberOfLines * 24 + 28 }),
    ...inputStyle,
  };

  const labelTextStyle: TextStyle = {
    ...styles.label,
    ...(isFocused && styles.labelFocused),
    ...(error && styles.labelError),
    ...labelStyle,
  };

  const errorTextStyle: TextStyle = {
    ...styles.error,
    ...errorStyle,
  };

  return (
    <View style={containerStyle}>
      {label && (
        <Text style={labelTextStyle}>
          {label}
        </Text>
      )}
      <Animated.View style={animatedInputStyle}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Theme.colors.inactiveGray}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          style={[
            styles.textInput,
            multiline && styles.textInputMultiline,
          ]}
          {...rest}
        />
      </Animated.View>
      {error && (
        <Text style={errorTextStyle}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Theme.spacing.lg,
  },
  label: {
    fontSize: Theme.fontSizes.md,
    fontWeight: Theme.fontWeights.semibold,
    color: Theme.colors.cosmicSoftContrast,
    marginBottom: Theme.spacing.sm,
    paddingLeft: Theme.spacing.xs,
  },
  labelFocused: {
    color: Theme.colors.softAuroraPurple,
  },
  labelError: {
    color: '#EF4444', // Red color for error
  },
  input: {
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Theme.colors.borderColor,
    backgroundColor: Theme.colors.white,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.md,
    minHeight: 52,
  },
  textInput: {
    fontSize: Theme.fontSizes.lg,
    color: Theme.colors.darkText,
    fontWeight: Theme.fontWeights.normal,
    padding: 0,
    margin: 0,
    flex: 1,
  },
  textInputMultiline: {
    textAlignVertical: 'top',
    paddingTop: Theme.spacing.md,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputDisabled: {
    backgroundColor: Theme.colors.lightBg,
    opacity: 0.6,
  },
  error: {
    fontSize: Theme.fontSizes.sm,
    color: '#EF4444',
    marginTop: Theme.spacing.xs,
    paddingLeft: Theme.spacing.xs,
  },
}); 