import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInput as TextInputType,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuthStore } from '../store/auth.store';
import authApi from '../api/auth.api';
import type { AuthStackParamList } from '../navigation/types';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

interface FieldErrors {
  email?: string;
  password?: string;
  general?: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address';
  }
  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }
  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginScreen({ navigation }: Props) {
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const passwordRef = useRef<TextInputType>(null);

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate(email, password);
    setErrors((prev) => ({ ...prev, [field]: errs[field] }));
  };

  const handleSubmit = async () => {
    setTouched({ email: true, password: true });
    const errs = validate(email, password);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const { user, tokens } = await authApi.login({
        email: email.trim(),
        password,
      });
      setAuth(user, tokens);
      // RootNavigator auto-switches to Main when isAuthenticated becomes true
    } catch (err) {
      setErrors({
        general: err instanceof Error ? err.message : 'Invalid credentials',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.gradientTop} />
      <View style={styles.gradientBottom} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brandRow}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>⬡</Text>
          </View>
          <View>
            <Text style={styles.brandName}>TaskFlow</Text>
            <Text style={styles.brandTagline}>Team workspace</Text>
          </View>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>
            Sign in to continue to your workspace
          </Text>

          {errors.general ? (
            <View style={styles.generalError}>
              <Text style={styles.generalErrorIcon}>⚠</Text>
              <Text style={styles.generalErrorText}>{errors.general}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <View
              style={[
                styles.inputWrap,
                touched.email && errors.email ? styles.inputError : null,
                !errors.email && touched.email && email
                  ? styles.inputSuccess
                  : null,
              ]}
            >
              <Text style={styles.inputIcon}>✉</Text>
              <TextInput
                style={styles.input}
                placeholder="you@company.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (touched.email) {
                    const e = validate(v, password);
                    setErrors((prev) => ({ ...prev, email: e.email }));
                  }
                }}
                onBlur={() => handleBlur('email')}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!isLoading}
              />
            </View>
            {touched.email && errors.email ? (
              <Text style={styles.fieldError}>{errors.email}</Text>
            ) : null}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View
              style={[
                styles.inputWrap,
                touched.password && errors.password ? styles.inputError : null,
                !errors.password && touched.password && password
                  ? styles.inputSuccess
                  : null,
              ]}
            >
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (touched.password) {
                    const e = validate(email, v);
                    setErrors((prev) => ({ ...prev, password: e.password }));
                  }
                }}
                onBlur={() => handleBlur('password')}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((p) => !p)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.inputIcon}>
                  {showPassword ? '🙈' : '👁'}
                </Text>
              </TouchableOpacity>
            </View>
            {touched.password && errors.password ? (
              <Text style={styles.fieldError}>{errors.password}</Text>
            ) : null}
          </View>

          {/* Forgot password */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={isLoading}
          >
            <Text style={styles.forgotBtnText}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              isLoading ? styles.submitBtnDisabled : null,
            ]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => navigation.navigate('Register')}
            disabled={isLoading}
          >
            <Text style={styles.registerBtnText}>
              Don't have an account?{' '}
              <Text style={styles.registerBtnLink}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: Colors.bg },
  gradientTop: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(99,102,241,0.14)',
  },
  gradientBottom: {
    position: 'absolute',
    bottom: -60,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(56,189,248,0.08)',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: 80,
    paddingBottom: Spacing.xxxl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.xs,
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.primary,
  },
  logoIcon: { fontSize: 26, color: Colors.primaryLight },
  brandName: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginTop: 1,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    ...Shadows.lg,
  },
  cardTitle: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  generalError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.danger,
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  generalErrorIcon: { fontSize: 16, color: Colors.danger },
  generalErrorText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.danger,
  },
  fieldGroup: { marginBottom: Spacing.base },
  fieldLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  inputSuccess: { borderColor: 'rgba(34,197,94,0.4)' },
  inputIcon: { fontSize: 16 },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Typography.base,
    paddingVertical: Spacing.md,
  },
  fieldError: {
    fontSize: Typography.xs,
    color: Colors.danger,
    marginTop: Spacing.xs,
    marginLeft: 2,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.base,
    marginTop: -Spacing.xs,
  },
  forgotBtnText: { fontSize: Typography.xs, color: Colors.primaryLight },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...Shadows.primary,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontSize: Typography.xs, color: Colors.textMuted },
  registerBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  registerBtnText: { fontSize: Typography.sm, color: Colors.textSecondary },
  registerBtnLink: {
    color: Colors.primaryLight,
    fontWeight: Typography.semibold,
  },
});
