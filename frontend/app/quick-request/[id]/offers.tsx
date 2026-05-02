import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { quickRequestAPI, telemetryAPI } from '../../../src/services/api';
import { useThemeContext } from '../../../src/context/ThemeContext';
import { ProviderCard, ProviderCardData } from '../../../src/components/ProviderCard';

// Sprint QR-1 / Day 4: Offers screen — single ProviderCard, brand-only CTA.
// One decision per card: choose this mechanic. No "details" / "call" / "view"
// fallback links — Day 4 rule.
function mapSolutionToProvider(s: any): ProviderCardData {
  // backend `solution` shape (from quickRequestAPI.getStatus → solutions[]):
  //   slug | providerId, name, rating, reviewsCount, isOnline, distance, eta,
  //   distanceText?, etaText?, finalPrice?, priceFrom?, surgeKind?, surgeLabel?,
  //   trust?: { tuvVerified?, yearsExperience?, vehiclesInspected? },
  //   meta?: { responseTime? }
  const trust = s.trust || {};
  const meta = s.meta || {};
  const distanceKm =
    typeof s.distance === 'number' ? s.distance :
    typeof s.distanceKm === 'number' ? s.distanceKm :
    undefined;
  const etaMinutes =
    typeof s.eta === 'number' ? s.eta :
    typeof s.etaMinutes === 'number' ? s.etaMinutes :
    undefined;
  return {
    id: String(s.slug || s.providerId || s.id || s._id),
    name: s.name || s.organizationName || '',
    rating: typeof s.rating === 'number' ? s.rating : (s.ratingAvg || undefined),
    reviewsCount: s.reviewsCount,
    isVerified: !!(s.isVerified || trust.verified),
    distanceKm,
    etaMinutes,
    experienceYears: trust.yearsExperience,
    completedJobs: trust.vehiclesInspected || trust.jobsCompleted,
    responseMinutes: meta.responseTime || s.responseTime,
    tuvCertified: !!trust.tuvVerified,
    priceFrom: typeof s.finalPrice === 'number' ? s.finalPrice :
               typeof s.priceFrom === 'number' ? s.priceFrom :
               undefined,
    priceCurrencySymbol: s.priceCurrency || '€',
    surgeBadge: s.surgeKind === 'high' && s.surgeLabel ? s.surgeLabel : undefined,
  };
}

export default function QuickRequestOffersScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useThemeContext();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [solutions, setSolutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const res = await quickRequestAPI.getStatus(String(id));
        if (!alive) return;
        const data = res.data;
        if (data.status === 'assigned' && data.bookingId) {
          await AsyncStorage.removeItem('active_request');
          router.replace(`/booking/${data.bookingId}` as any);
          return;
        }
        if (data.status === 'expired') {
          await AsyncStorage.removeItem('active_request');
          router.replace('/quick-request/failed' as any);
          return;
        }
        setSolutions(data.solutions || []);
      } catch (e) {
        console.log('offers fetch error', e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id, router]);

  // Soft polling — if a provider accepts during selection, route forward.
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(async () => {
      try {
        const res = await quickRequestAPI.getStatus(String(id));
        const data = res.data;
        if (data.status === 'assigned' && data.bookingId) {
          await AsyncStorage.removeItem('active_request');
          router.replace(`/booking/${data.bookingId}` as any);
        }
        if (data.status === 'expired') {
          await AsyncStorage.removeItem('active_request');
          router.replace('/quick-request/failed' as any);
        }
      } catch { /* swallow */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [id, router]);

  const handleAccept = async (providerId: string) => {
    if (accepting) return;
    setAccepting(providerId);
    try {
      const res = await quickRequestAPI.accept(String(id), providerId);
      const data = res.data;
      await AsyncStorage.removeItem('active_request');
      telemetryAPI.track('qr_assigned', {
        requestId: String(id),
        bookingId: data.bookingId,
        providerSlug: providerId,
        source: 'customer_choice',
      }).catch(() => {});
      router.replace(`/booking/${data.bookingId}` as any);
    } catch (e: any) {
      const code = e?.response?.status;
      if (code === 409) {
        Alert.alert(t('quick_request_offers.taken_title'), t('quick_request_offers.taken_msg'));
      } else {
        Alert.alert(t('quick_request_offers.error_title'), t('quick_request_offers.error_msg'));
      }
    } finally {
      setAccepting(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      </SafeAreaView>
    );
  }

  const visible = solutions.slice(0, 3).map(mapSolutionToProvider);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']} testID="qr-offers">
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.replace(`/quick-request/${id}` as any)}
          style={styles.backBtn}
          testID="qr-offers-back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.kickerRow}>
          <View style={[styles.kickerDot, { backgroundColor: colors.brand }]} />
          <Text style={[styles.kicker, { color: colors.brand }]}>
            {t('quick_request_offers.kicker')}
          </Text>
        </View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        {t('quick_request_offers.title')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {t('quick_request_offers.subtitle')}
      </Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {visible.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            onSelect={handleAccept}
            loading={accepting === p.id}
            disabled={accepting !== null && accepting !== p.id}
            testID={`qr-offer-${p.id}`}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.bg,
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 18,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 14,
      paddingHorizontal: 4,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    kickerDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    kicker: {
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.6,
    },
    title: {
      fontSize: 26,
      fontWeight: '900',
      letterSpacing: -0.5,
      paddingHorizontal: 4,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      marginTop: 6,
      paddingHorizontal: 4,
    },
    list: {
      marginTop: 16,
    },
    listContent: {
      paddingBottom: 24,
    },
  });
}
