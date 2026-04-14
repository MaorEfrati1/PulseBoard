import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { api } from '../api/axios';
import type { AuthStackParamList } from '../navigation/types';
import { Colors, Typography, Spacing, Radius, Shadows } from '../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail]       = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [generalError, setGeneralError] = useState('');

  const validate = (): boolean => {
    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setGeneralError('');
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      setGeneralError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      );
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
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        {/* Icon */}
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>🔑</Text>
        </View>

        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we'll send you a link to reset your password.
        </Text>

        {submitted ? (
          /* ── Success state ────────────────────────────────────────────── */
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Check your email</Text>
            <Text style={styles.successBody}>
              If an account exists for{' '}
              <Text style={styles.successEmail}>{email}</Text>, you'll receive
              a reset link shortly.
            </Text>
            <TouchableOpacity
              style={styles.backToLoginBtn}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.backToLoginText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Form ─────────────────────────────────────────────────────── */
          <View style={styles.card}>
            {generalError ? (
              <View style={styles.generalError}>
                <Text style={styles.generalErrorIcon}>⚠</Text>
                <Text style={styles.generalErrorText}>{generalError}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <View style={[styles.inputWrap, emailError ? styles.inputError : null]}>
                <Text style={styles.inputIcon}>✉</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@company.com"
                  placeholderTextColor={Colors.textMuted}
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (emailError) setEmailError('');
                  }}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  editable={!isLoading}
                />
              </View>
              {emailError ? (
                <Text style={styles.fieldError}>{emailError}</Text>
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
                <Text style={styles.submitBtnText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
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
    left: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(99,102,241,0.10)',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: 60,
    paddingBottom: Spacing.xxxl,
  },
  backBtn: { marginBottom: Spacing.xxl, alignSelf: 'flex-start' },
  backBtnText: { fontSize: Typography.sm, color: Colors.primaryLight },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primaryGlow,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.primary,
  },
  iconText: { fontSize: 28 },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
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
  inputError: { borderColor: Colors.danger, backgroundColor: 'rgba(239,68,68,0.05)' },
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

  // Success state
  successCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.lg,
  },
  successIcon: {
    fontSize: 40,
    color: Colors.success,
    marginBottom: Spacing.md,
  },
  successTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  successBody: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  successEmail: {
    color: Colors.primaryLight,
    fontWeight: Typography.semibold,
  },
  backToLoginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    ...Shadows.primary,
  },
  backToLoginText: {
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },
});
