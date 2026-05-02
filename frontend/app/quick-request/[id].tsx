import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Animated, Easing, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useThemeContext } from '../../src/context/ThemeContext';
import { quickRequestAPI, telemetryAPI } from '../../src/services/api';
import { theme } from '../../src/context/ThemeContext';
const colors = theme.colors;

// Sprint QR-1: Searching screen — psychological process, not a loader.
// Polling every 2s. Rotating messages every 1.5s.
const HYBRID_THRESHOLD = 0.8;

export default function QuickRequestStatusScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useThemeContext();
  const { t } = useTranslation();
  const palette = theme === 'dark'
    ? { bg: colors.bg, surface: colors.backgroundSecondary, text: colors.text, textMuted: colors.textMuted, border: colors.border, primary: colors.brand, live: colors.success, onPrimary: colors.text }
    : { bg: colors.backgroundTertiary, surface: colors.text, text: colors.brandText, textMuted: colors.textMuted, border: colors.border, primary: colors.brand, live: colors.success, onPrimary: colors.text };
  const styles = makeStyles(palette);

  const rotatingMessages = useMemo(() => {
    const arr = t('quick_request_status.rotating', { returnObjects: true }) as unknown;
    return Array.isArray(arr) ? arr as string[] : [];
  }, [t]);

  const [messageIdx, setMessageIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [redirecting, setRedirecting] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulse animation
  useEffect(() => {
    if (Platform.OS === 'web') return; // RN web Animated quirks
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0,  duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  // Rotating messages every 1.5s
  useEffect(() => {
    if (rotatingMessages.length === 0) return;
    const t = setInterval(() => {
      setMessageIdx((p) => (p + 1) % rotatingMessages.length);
    }, 1500);
    return () => clearInterval(t);
  }, [rotatingMessages.length]);

  // Polling status every 2s
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let triggered = false; // prevent double-redirect

    const poll = async () => {
      try {
        const res = await quickRequestAPI.getStatus(String(id));
        const data = res.data;
        if (!alive || triggered) return;

        setSecondsLeft(data.secondsLeft ?? 0);

        // assigned → booking
        if (data.status === 'assigned' && data.bookingId) {
          triggered = true;
          await AsyncStorage.removeItem('active_request');
          telemetryAPI.track('qr_assigned', {
            requestId: String(id),
            bookingId: data.bookingId,
            providerSlug: data.providerId,
            secondsToAssign: 60 - (data.secondsLeft ?? 0),
          }).catch(() => {});
          setRedirecting(true);
          router.replace(`/booking/${data.bookingId}` as any);
          return;
        }

        // expired → failed
        if (data.status === 'expired') {
          triggered = true;
          await AsyncStorage.removeItem('active_request');
          telemetryAPI.track('qr_expired', { requestId: String(id) }).catch(() => {});
          setRedirecting(true);
          router.replace(`/quick-request/failed?id=${id}` as any);
          return;
        }

        // hybrid: bestScore < 0.8 → offers UI чтобы юзер сам выбрал
        // (при этом searching на бэке остаётся — race с провайдером всё ещё активен)
        const bestScore = Number(data.bestScore || 0);
        if (data.status === 'searching' && bestScore > 0 && bestScore < HYBRID_THRESHOLD && data.solutions?.length >= 2) {
          triggered = true;
          telemetryAPI.track('qr_offers_shown', { requestId: String(id), bestScore, count: data.solutions?.length }).catch(() => {});
          router.replace(`/quick-request/${id}/offers` as any);
          return;
        }
      } catch (e: any) {
        // 404 → request не найден (сервер перезагрузился?)
        if (e?.response?.status === 404) {
          triggered = true;
          await AsyncStorage.removeItem('active_request');
          router.replace('/quick-request/failed?reason=not_found' as any);
        }
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [id, router]);

  const handleCancel = async () => {
    await AsyncStorage.removeItem('active_request');
    telemetryAPI.track('qr_cancelled_by_user', { requestId: String(id) }).catch(() => {});
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']} testID="qr-searching">
      <View style={styles.body}>
        <View style={styles.pulseWrap}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulse }] }]} />
          <Animated.View style={[styles.pulseRingMid, { transform: [{ scale: pulse }] }]} />
          <View style={styles.pulseCore}>
            <ActivityIndicator size="large" color={palette.onPrimary} />
          </View>
        </View>

        <View style={styles.kickerRow}>
          <View style={[styles.liveDot, { backgroundColor: palette.live }]} />
          <Text style={styles.kicker}>{t('quick_request_status.kicker')}</Text>
        </View>
        <Text style={styles.title} testID="qr-rotating-message">
          {redirecting ? t('quick_request_status.redirecting_title') : (rotatingMessages[messageIdx] || '')}
        </Text>
        <Text style={styles.subtitle}>
          {redirecting
            ? t('quick_request_status.redirecting_subtitle')
            : t('quick_request_status.subtitle')}
        </Text>

        <View style={styles.timerCard}>
          <Ionicons name="time-outline" size={18} color={palette.text} />
          <Text style={styles.timerText} testID="qr-timer">
            {t('quick_request_status.timer_left')} <Text style={styles.timerNum}>{t('quick_request_status.timer_seconds', { n: Math.max(0, secondsLeft) })}</Text>
          </Text>
        </View>
      </View>

      <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn} testID="qr-cancel">
        <Text style={styles.cancelText}>{t('quick_request_status.cancel')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24 },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    pulseWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
    pulseRing: {
      position: 'absolute', width: 160, height: 160, borderRadius: 80,
      backgroundColor: 'rgba(215, 25, 32, 0.10)',
    },
    pulseRingMid: {
      position: 'absolute', width: 116, height: 116, borderRadius: 58,
      backgroundColor: 'rgba(215, 25, 32, 0.18)',
    },
    pulseCore: {
      width: 80, height: 80, borderRadius: 40,
      backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center',
    },
    kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    liveDot: { width: 8, height: 8, borderRadius: 4 },
    kicker: { color: c.live, fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
    title: { color: c.text, fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5, paddingHorizontal: 12 },
    subtitle: { color: c.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 320 },
    timerCard: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 28, paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14,
    },
    timerText: { color: c.text, fontSize: 14, fontWeight: '700' },
    timerNum: { color: c.primary, fontWeight: '900' },
    cancelBtn: { paddingVertical: 14, alignItems: 'center' },
    cancelText: { color: c.textMuted, fontSize: 15, fontWeight: '700' },
  });
}
