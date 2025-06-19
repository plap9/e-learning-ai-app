import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Import screens
import { SplashScreen } from './src/screens/SplashScreen';
import {
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  VerifyScreen,
  CreatePasswordScreen,
} from './src/screens/auth';

// Import types
import { AuthStackParamList } from './src/types/navigation.types';

const AuthStack = createStackNavigator<AuthStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
      }}
    >
      <AuthStack.Screen name="Splash" component={SplashScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen 
        name="Verify" 
        component={VerifyScreen}
        initialParams={{ context: 'register', emailOrPhone: 'demo@email.com' }}
      />
      <AuthStack.Screen 
        name="CreatePassword" 
        component={CreatePasswordScreen}
        initialParams={{ 
          context: 'register', 
          emailOrPhone: 'demo@email.com',
          otpCode: '1234'
        }}
      />
    </AuthStack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthNavigator />
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
} 