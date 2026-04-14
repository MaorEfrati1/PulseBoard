import type { NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// ─── Auth Stack ───────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// ─── Main Tabs ────────────────────────────────────────────────────────────────

export type MainTabsParamList = {
  Feed: undefined;
  Tasks: undefined;
  Team: undefined;
  Profile: undefined;
};

// ─── Root Navigator ───────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabsParamList>;
  // Modal screens — accessible from anywhere in the app
  TaskDetail: { taskId: string };
  NewTask: { assigneeId?: string } | undefined;
};

// ─── Typed screen props helpers ───────────────────────────────────────────────

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabsParamList> =
  BottomTabScreenProps<MainTabsParamList, T>;

// ─── Global useNavigation type augmentation ───────────────────────────────────
// Lets useNavigation() be fully typed everywhere without explicit generics

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
