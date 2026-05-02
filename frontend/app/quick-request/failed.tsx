import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeContext } from '../../src/context/ThemeContext';
import { theme } from '../../src/context/ThemeContext';
const colors = theme.colors;

// Sprint QR-1: Failed screen — failure that's not the user's fault.
export default function QuickRequestFailedScreen() {
  const router = useRouter();
  const { theme } = useThemeContext();
  const { t } = useTranslation();
  const palette = theme === 'dark'
    ? { bg: colors.bg, surface: colors.backgroundSecondary, text: colors.text, textMuted: colors.textMuted, border: colors.border, primary: colors.brand, onPrimary: colors.text }
    : { bg: colors.backgroundTertiary, surface: colors.text, text: colors.brandText, textMuted: colors.textMuted, border: colors.border, primary: colors.brand, onPrimary: colors.text };
  const styles = makeStyles(palette);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']} testID="qr-failed">
      <View style={styles.body}>
        <View style={styles.iconBubble}>
          <Ionicons name="time-outline" size={36} color={palette.primary} />
        </View>
        <Text style={styles.title}>{t('quick_request_failed.title')}</Text>
        <Text style={styles.subtitle}>
          {t('quick_request_failed.subtitle')}
        </Text>

        <View style={styles.tipsCard}>
          <Tip icon="time" text={t('quick_request_failed.tip_wait')} palette={palette} />
          <Tip icon="location" text={t('quick_request_failed.tip_radius')} palette={palette} />
          <Tip icon="cash" text={t('quick_request_failed.tip_price')} palette={palette} />
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.9}
          onPress={() => router.replace('/quick-request')}
          testID="qr-failed-retry"
        >
          <Ionicons name="refresh" size={20} color={palette.onPrimary} />
          <Text style={styles.primaryText}>{t('quick_request_failed.retry')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          activeOpacity={0.85}
          onPress={() => router.replace('/(tabs)/services' as any)}
          testID="qr-failed-browse"
        >
          <Text style={styles.secondaryText}>{t('quick_request_failed.browse')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(tabs)')} testID="qr-failed-home">
          <Text style={styles.linkText}>{t('quick_request_failed.home')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Tip({ icon, text, palette }: any) {
  return (
    <View style={tipStyles(palette).row}>
      <Ionicons name={icon} size={16} color={palette.textMuted} />
      <Text style={tipStyles(palette).text}>{text}</Text>
    </View>
  );
}

const tipStyles = (c: any) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  text: { color: c.textMuted, fontSize: 14, fontWeight: '600' },
});

function makeStyles(c: any) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24 },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    iconBubble: {
      width: 84, height: 84, borderRadius: 24,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    title: { color: c.text, fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, paddingHorizontal: 12 },
    subtitle: { color: c.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, maxWidth: 360 },
    tipsCard: {
      marginTop: 28, padding: 14, borderRadius: 16,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, width: '100%', maxWidth: 360,
    },
    actions: { gap: 10, maxWidth: 460, width: '100%', alignSelf: 'center' },
    primaryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      backgroundColor: c.primary, borderRadius: 18, paddingVertical: 17,
      ...Platform.select({
        ios: { shadowColor: c.primary, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
        android: { elevation: 5 },
        default: {},
      }),
    },
    primaryText: { color: c.onPrimary, fontSize: 17, fontWeight: '900' },
    secondaryBtn: {
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, paddingVertical: 16,
    },
    secondaryText: { color: c.text, textAlign: 'center', fontSize: 16, fontWeight: '900' },
    linkText: { color: c.textMuted, textAlign: 'center', fontSize: 14, fontWeight: '700', paddingVertical: 8 },
  });
}
