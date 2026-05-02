// ═════════════════════════════════════════════════════════
// 🏠 Welcome (single source) — продающая структура, brand amber
// Sprint UI-System: только UI Kit, никаких inline цветов.
// Sprint i18n-1: все строки через `useTranslation` (DE/EN/RU).
// ═════════════════════════════════════════════════════════
import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeContext } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import Text from '../src/components/ui/Text';
import Brand from '../src/components/Brand';
import LanguageSwitcher from '../src/components/LanguageSwitcher';
import { tokens } from '../src/theme/tokens';
import { theme } from '../src/context/ThemeContext';
const colors = theme.colors;

export default function WelcomeScreen() {
  const { colors, isDark } = useThemeContext();
  const router = useRouter();
  const auth = useAuth();
  const { t } = useTranslation();
  const styles = makeStyles(colors, isDark);

  // Если уже залогинен — пропускаем welcome и роутим по роли
  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated && auth.user) {
      const role = auth.user.role || '';
      if (role.startsWith('provider')) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.user, router]);

  const goCustomer = async () => {
    await auth.chooseCustomer();
    router.replace('/(tabs)');
  };

  const goProvider = async () => {
    await auth.chooseProvider();
    // Без промежуточного экрана — сразу на login с ?role=provider
    router.push('/login?role=provider');
  };

  const goLogin = () => router.push('/login');

  const goGuest = async () => {
    await auth.continueAsGuest();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']} testID="welcome-screen">
      {/* Brand top-left, language switcher top-right */}
      <View style={styles.topRow}>
        <Brand height={26} testID="welcome-logo" />
        <LanguageSwitcher />
      </View>

      <View style={styles.heroBlock}>
        <View style={styles.kickerRow}>
          <View style={styles.kickerDot} />
          <Text variant="kicker" tone="brand" testID="welcome-kicker">
            {t('welcome.kicker')}
          </Text>
        </View>

        <Text variant="h1" testID="welcome-title" style={styles.title}>
          {t('welcome.title')}
        </Text>

        <Text variant="body" tone="muted" testID="welcome-subtitle" style={styles.subtitle}>
          {t('welcome.subtitle')}
        </Text>
      </View>

      <View style={styles.actions}>
        {/* PRIMARY #1: Inspect car (Auto Selection core) */}
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.9}
          onPress={() => router.push('/auto-request/create')}
          testID="welcome-find-master"
        >
          <View style={styles.primaryRow}>
            <View style={styles.primaryIcon}>
              <Ionicons name="shield-checkmark" size={22} color={tokens.colors.onBrand} />
            </View>
            <View style={styles.primaryTextBlock}>
              <Text variant="h3" weight="900" style={styles.primaryText}>
                {t('welcome.find_master')}
              </Text>
              <Text variant="caption" weight="600" style={styles.primaryHint}>
                {t('welcome.find_master_hint')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={tokens.colors.onBrand} />
          </View>
        </TouchableOpacity>

        {/* PRIMARY #2: Request selection */}
        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.85}
          onPress={() => router.push('/auto-request/create')}
          testID="welcome-request-selection"
        >
          <View style={styles.primaryRow}>
            <View style={styles.secondaryIcon}>
              <Ionicons name="clipboard-outline" size={20} color={colors.brand} />
            </View>
            <View style={styles.primaryTextBlock}>
              <Text variant="h3" weight="800">{t('welcome.request_selection')}</Text>
              <Text variant="caption" tone="muted" weight="600">
                {t('welcome.request_selection_hint')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* TERTIARY: Provider / Inspector */}
        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.85}
          onPress={() => router.push('/inspector/jobs')}
          testID="welcome-i-am-master"
        >
          <View style={styles.primaryRow}>
            <View style={styles.secondaryIcon}>
              <Ionicons name="construct" size={20} color={colors.brand} />
            </View>
            <View style={styles.primaryTextBlock}>
              <Text variant="h3" weight="800">{t('welcome.start_earning')}</Text>
              <Text variant="caption" tone="muted" weight="600">
                {t('welcome.start_earning_hint')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* Repair quick link — moved to secondary inline */}
        <TouchableOpacity style={styles.repairLink} onPress={goGuest} testID="welcome-repair-link">
          <Ionicons name="build-outline" size={14} color={colors.textSecondary} />
          <Text variant="caption" tone="muted" weight="700">
            {t('welcome.repair_secondary')}
          </Text>
        </TouchableOpacity>

        {/* Login */}
        <TouchableOpacity style={styles.loginButton} onPress={goLogin} testID="welcome-login-link">
          <Text variant="body" weight="800" align="center">
            {t('welcome.have_account_login')}
          </Text>
        </TouchableOpacity>

        {/* Skip: Guest */}
        <TouchableOpacity style={styles.skipButton} onPress={goGuest} testID="welcome-skip">
          <Text variant="caption" tone="muted" weight="700" align="center">
            {t('welcome.continue_as_guest')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 22,
      paddingTop: 28,
      paddingBottom: 24,
      justifyContent: 'space-between',
    },
    heroBlock: {
      flex: 1,
      justifyContent: 'center',
      maxWidth: 460,
      width: '100%',
      alignSelf: 'center',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    kickerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
    title: { marginBottom: 14 },
    subtitle: { maxWidth: 360 },
    actions: { gap: 10, maxWidth: 460, width: '100%', alignSelf: 'center' },

    primaryButton: {
      backgroundColor: colors.brand,
      borderRadius: tokens.radius.lg,
      paddingVertical: 16,
      paddingHorizontal: 18,
      ...Platform.select({
        ios: {
          shadowColor: colors.brand,
          shadowOpacity: isDark ? 0.32 : 0.22,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        },
        android: { elevation: 6 },
        default: {},
      }),
    },
    primaryRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    primaryIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: 'rgba(0,0,0,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryTextBlock: { flex: 1 },
    primaryText: { color: tokens.colors.onBrand },
    primaryHint: { color: tokens.colors.onBrand, opacity: 0.78, marginTop: 2 },

    secondaryButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: tokens.radius.lg,
      paddingVertical: 15,
      paddingHorizontal: 18,
    },
    secondaryIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },

    loginButton: { paddingVertical: 12, marginTop: 4 },
    skipButton: { paddingVertical: 4 },
    repairLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      marginTop: 2,
    },
  });
}
