import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthStore } from '../store/auth.store';
import { useSocket } from '../hooks/useSocket';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { usePushNotifications } from '../hooks/usePushNotifications';

import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';
import { Colors } from '../theme';

// ─── Auth screens ─────────────────────────────────────────────────────────────

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

// ─── Modal screens ────────────────────────────────────────────────────────────

import TaskDetailScreen from '../screens/TaskDetailScreen';
import NewTaskScreen from '../screens/NewTaskScreen';

// ─── Stack ────────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Loading splash ───────────────────────────────────────────────────────────

function LoadingScreen(): React.JSX.Element {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={Colors.primaryLight} />
    </View>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────

export function RootNavigator(): React.JSX.Element {
  const { isAuthenticated, tokens } = useAuthStore();

  // Bootstrap app-level services once on mount
  useSocket({ autoConnect: true });
  useOfflineSync();
  usePushNotifications();

  const [isHydrated, setIsHydrated] = React.useState(false);
  const hydrationChecked = useRef(false);

  useEffect(() => {
    if (hydrationChecked.current) return;
    hydrationChecked.current = true;

    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });

    if (useAuthStore.persist.hasHydrated()) {
      setIsHydrated(true);
    }

    return () => unsub();
  }, []);

  if (!isHydrated) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated && tokens?.accessToken ? (
          // ── Authenticated ────────────────────────────────────────────────
          <>
            <Stack.Screen name="Main" component={MainTabs} />

            <Stack.Screen
              name="TaskDetail"
              component={TaskDetailScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                title: 'Task Detail',
                headerBackTitle: 'Back',
                headerStyle: { backgroundColor: Colors.bgCard },
                headerTintColor: Colors.primaryLight,
                headerTitleStyle: { color: Colors.textPrimary },
              }}
            />
            <Stack.Screen
              name="NewTask"
              component={NewTaskScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                title: 'New Task',
                headerBackTitle: 'Cancel',
                headerStyle: { backgroundColor: Colors.bgCard },
                headerTintColor: Colors.primaryLight,
                headerTitleStyle: { color: Colors.textPrimary },
              }}
            />
          </>
        ) : (
          // ── Unauthenticated ──────────────────────────────────────────────
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── Auth Stack (nested) ──────────────────────────────────────────────────────

import { createNativeStackNavigator as createAuthStack } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';

const Auth = createAuthStack<AuthStackParamList>();

function AuthStack(): React.JSX.Element {
  return (
    <Auth.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="Login"
    >
      <Auth.Screen name="Login"          component={LoginScreen}          />
      <Auth.Screen name="Register"       component={RegisterScreen}       />
      <Auth.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Auth.Navigator>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,   // dark theme (was hardcoded #FFFFFF)
  },
});
