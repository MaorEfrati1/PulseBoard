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

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  general?: string;
}

// ─── Password Strength ────────────────────────────────────────────────────────

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
}

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '', color: Colors.border };
  let score = 0;
  if (password.length >= 8)                                    score++;
  if (password.length >= 12)                                   score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password))       score++;
  if (/\d/.test(password))                                     score++;
  if (/[^A-Za-z0-9]/.test(password))                          score++;

  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const map: Record<1 | 2 | 3 | 4, { label: string; color: string }> = {
    1: { label: 'Weak',   color: Colors.danger  },
    2: { label: 'Fair',   color: Colors.warning },
    3: { label: 'Good',   color: Colors.info    },
    4: { label: 'Strong', color: Colors.success },
  };
  if (clamped === 0) return { score: 0, label: 'Too short', color: Colors.danger };
  return { score: clamped, ...map[clamped] };
}

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (!password) return null;
  return (
    <View style={styles.strengthContainer}>
      <View style={styles.strengthBars}>
        {[1, 2, 3, 4].map((level) => (
          <View
            key={level}
            style={[
              styles.strengthBar,
              { backgroundColor: strength.score >= level ? strength.color : Colors.border },
            ]}
          />
        ))}
      </View>
      {strength.label ? (
        <Text style={[styles.strengthLabel, { color: strength.color }]}>
          {strength.label}
        </Text>
      ) : null}
    </View>
  );
}

function PasswordRequirements({ password }: { password: string }) {
  const requirements = [
    { met: password.length >= 8,           label: '8+ characters'     },
    { met: /[A-Z]/.test(password),         label: 'Uppercase letter'  },
    { met: /\d/.test(password),            label: 'Number'            },
    { met: /[^A-Za-z0-9]/.test(password), label: 'Special character' },
  ];
  if (!password) return null;
  return (
    <View style={styles.requirementsContainer}>
      {requirements.map((req) => (
        <View key={req.label} style={styles.requirementRow}>
          <Text
            style={[
              styles.requirementDot,
              { color: req.met ? Colors.success : Colors.textMuted },
            ]}
          >
            {req.met ? '✓' : '○'}
          </Text>
          <Text
            style={[
              styles.requirementText,
              {
                color: req.met ? Colors.textSecondary : Colors.textMuted,
                textDecorationLine: req.met ? 'line-through' : 'none',
              },
            ]}
          >
            {req.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validate(fullName: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!fullName.trim())          errors.fullName = 'Full name is required';
  else if (fullName.trim().length < 2) errors.fullName = 'Name must be at least 2 characters';
  if (!email.trim())             errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                                 errors.email = 'Enter a valid email address';
  if (!password)                 errors.password = 'Password is required';
  else if (password.length < 8)  errors.password = 'Password must be at least 8 characters';
  else if (getPasswordStrength(password).score < 2)
                                 errors.password = 'Password is too weak — add numbers or symbols';
  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterScreen({ navigation }: Props) {
  const setAuth = useAuthStore((s) => s.setAuth);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState({
    fullName: false,
    email: false,
    password: false,
  });

  const emailRef    = useRef<TextInputType>(null);
  const passwordRef = useRef<TextInputType>(null);

  const handleBlur = (field: 'fullName' | 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errs = validate(fullName, email, password);
    setErrors((prev) => ({ ...prev, [field]: errs[field] }));
  };

  const handleSubmit = async () => {
    setTouched({ fullName: true, email: true, password: true });
    const errs = validate(fullName, email, password);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setIsLoading(true);
    try {
      const { user, tokens } = await authApi.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });
      setAuth(user, tokens);
    } catch (err) {
      setErrors({
        general: err instanceof Error ? err.message : 'Registration failed',
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

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          disabled={isLoading}
        >
          <Text style={styles.backBtnText}>← Back to sign in</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join your team workspace in seconds</Text>

        <View style={styles.card}>
          {errors.general ? (
            <View style={styles.generalError}>
              <Text style={styles.generalErrorIcon}>⚠</Text>
              <Text style={styles.generalErrorText}>{errors.general}</Text>
            </View>
          ) : null}

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>FULL NAME</Text>
            <View style={[styles.inputWrap, touched.fullName && errors.fullName ? styles.inputError : null]}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                placeholder="Jane Smith"
                placeholderTextColor={Colors.textMuted}
                value={fullName}
                onChangeText={(v) => {
                  setFullName(v);
                  if (touched.fullName) {
                    const e = validate(v, email, password);
                    setErrors((prev) => ({ ...prev, fullName: e.fullName }));
                  }
                }}
                onBlur={() => handleBlur('fullName')}
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                editable={!isLoading}
              />
            </View>
            {touched.fullName && errors.fullName ? (
              <Text style={styles.fieldError}>{errors.fullName}</Text>
            ) : null}
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>WORK EMAIL</Text>
            <View style={[styles.inputWrap, touched.email && errors.email ? styles.inputError : null]}>
              <Text style={styles.inputIcon}>✉</Text>
              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder="you@company.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (touched.email) {
                    const e = validate(fullName, v, password);
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
            <View style={[styles.inputWrap, touched.password && errors.password ? styles.inputError : null]}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="Min. 8 characters"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (touched.password) {
                    const e = validate(fullName, email, v);
                    setErrors((prev) => ({ ...prev, password: e.password }));
                  }
                }}
                onBlur={() => handleBlur('password')}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((p) => !p)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.inputIcon}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
            <PasswordStrengthBar password={password} />
            <PasswordRequirements password={password} />
            {touched.password && errors.password ? (
              <Text style={styles.fieldError}>{errors.password}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, isLoading ? styles.submitBtnDisabled : null]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.terms}>
            By creating an account you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
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
    top: -60,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: 60,
    paddingBottom: Spacing.xxxl,
  },
  backBtn: { marginBottom: Spacing.xl, alignSelf: 'flex-start' },
  backBtnText: { fontSize: Typography.sm, color: Colors.primaryLight },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    ...Shadows.lg,
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
  generalErrorText: { flex: 1, fontSize: Typography.sm, color: Colors.danger },
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
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    minWidth: 44,
    textAlign: 'right',
  },
  requirementsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '48%',
  },
  requirementDot: { fontSize: Typography.xs, width: 14 },
  requirementText: { fontSize: Typography.xs },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
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
  terms: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.base,
    lineHeight: 18,
  },
  termsLink: { color: Colors.primaryLight },
});
