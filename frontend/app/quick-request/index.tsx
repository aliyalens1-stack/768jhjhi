import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeContext } from '../../src/context/ThemeContext';
import { quickRequestAPI, telemetryAPI } from '../../src/services/api';
import { useLocation } from '../../src/context/LocationContext';
import { parseCarLink, getInputCopy } from '../../src/utils/clusterHelpers';
import { useTranslation } from 'react-i18next';
import { theme } from '../../src/context/ThemeContext';
const colors = theme.colors;

// Sprint QR-1: Quick Request entry — palette-grid problem select + GPS + resolve.
// Sprint 33: cluster-aware. Cluster comes from Home cluster block; default=repair.
// Block 2 i18n: copy and problem labels live in i18n (quick_request.*).
const CLUSTER_COPY_TONE: Record<string, { titleKey: string; chipKey: string; helperKey: string }> = {
  repair:     { titleKey: 'quick_request.problem_title',     chipKey: 'quick_request.problem_chip', helperKey: 'quick_request.helper' },
  inspection: { titleKey: 'quick_request.inspection_title',  chipKey: 'quick_request.service_chip', helperKey: 'quick_request.inspection_helper' },
  selection:  { titleKey: 'quick_request.selection_title',   chipKey: 'quick_request.request_chip', helperKey: 'quick_request.selection_helper' },
  delivery:   { titleKey: 'quick_request.delivery_title',    chipKey: 'quick_request.route_chip',   helperKey: 'quick_request.delivery_helper' },
};

type ProblemDef = { key: string; icon: any; color: string };

const CLUSTER_PROBLEMS: Record<string, ProblemDef[]> = {
  repair: [
    { key: 'engine_start_failure', icon: 'flash-off-outline',     color: colors.brand },
    { key: 'battery',              icon: 'battery-dead-outline',  color: colors.warning },
    { key: 'tires',                icon: 'disc-outline',          color: colors.brand },
    { key: 'tow',                  icon: 'car-outline',           color: colors.brand },
    { key: 'brakes',               icon: 'hand-left-outline',     color: colors.brand },
    { key: 'electrical',           icon: 'flash-outline',         color: colors.brand },
    { key: 'noise',                icon: 'volume-high-outline',   color: colors.success },
    { key: 'general',              icon: 'help-circle-outline',   color: colors.textSecondary },
  ],
  inspection: [
    { key: 'pre_purchase_check', icon: 'shield-checkmark-outline', color: colors.success },
    { key: 'body_check',         icon: 'car-sport-outline',        color: colors.brand },
    { key: 'engine_check',       icon: 'cog-outline',              color: colors.warning },
    { key: 'diagnostic_scan',    icon: 'hardware-chip-outline',    color: colors.brand },
  ],
  selection: [
    { key: 'car_selection', icon: 'list-outline',  color: colors.brand },
    { key: 'remote_buying', icon: 'globe-outline', color: colors.success },
  ],
  delivery: [
    { key: 'delivery', icon: 'car-sport-outline', color: colors.warning },
    { key: 'import',   icon: 'airplane-outline',  color: colors.brand },
  ],
};

// Fallback problem-text map (used in payload `text`). Localised at runtime via t().
function getProblemText(t: (k: string) => string, key: string): string {
  // try localised label first; else fallback to raw key
  const k = `quick_request.problems.${key}`;
  const v = t(k);
  return v && v !== k ? v : key;
}

export default function QuickRequestScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useThemeContext();
  const { location, refreshLocation } = useLocation();
  const params = useLocalSearchParams<{ cluster?: string; preselect?: string }>();
  const cluster = (params.cluster && CLUSTER_PROBLEMS[params.cluster]) ? params.cluster : 'repair';
  const clusterCopy = CLUSTER_COPY_TONE[cluster] || CLUSTER_COPY_TONE.repair;
  const clusterProblems = useMemo(
    () => CLUSTER_PROBLEMS[cluster] || CLUSTER_PROBLEMS.repair,
    [cluster]
  );

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [problem, setProblem] = useState<string | null>(params.preselect || null);
  const [loading, setLoading] = useState(false);
  // Sprint 33 C6 — cluster-specific extra input (carLink/budget/addressHint)
  const inputCopy = useMemo(() => getInputCopy(cluster), [cluster]);
  const [extraInput, setExtraInput] = useState('');

  const handleSubmit = async () => {
    if (!problem) return;
    if (inputCopy.field === 'carLink') {
      const parsed = parseCarLink(extraInput);
      if (!parsed.valid) {
        Alert.alert(t('common.error'), t('quick_request.helper'));
        return;
      }
    }
    if (inputCopy.field === 'budget' && !extraInput.trim()) {
      Alert.alert(t('common.error'), t('quick_request.helper'));
      return;
    }
    if (inputCopy.field === 'addressHint' && !extraInput.trim()) {
      Alert.alert(t('common.error'), t('quick_request.helper'));
      return;
    }
    setLoading(true);
    try {
      const lat = location?.lat ?? 50.4501;
      const lng = location?.lng ?? 30.5234;
      if (!location) {
        await refreshLocation();
      }
      const text = getProblemText(t, problem);
      const payload: any = { text, location: { lat, lng }, cluster };
      if (inputCopy.field === 'carLink')     payload.carLink = extraInput.trim();
      if (inputCopy.field === 'budget')      payload.budget  = parseFloat(extraInput) || extraInput.trim();
      if (inputCopy.field === 'addressHint') payload.addressHint = extraInput.trim();
      const res = await quickRequestAPI.resolve(payload);
      const data = res.data;

      await AsyncStorage.setItem('active_request', data.requestId);
      telemetryAPI.track('qr_started', { problemType: data.problemType, surge: data.surge, cluster }).catch(() => {});
      router.replace(`/quick-request/${data.requestId}`);
    } catch (e: any) {
      console.log('QR resolve error', e?.message || e);
      const msg = e?.response?.data?.message || t('errors.network') || 'Network error';
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']} testID="qr-entry">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="qr-back">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.kickerRow}>
            <View style={styles.kickerDot} />
            <Text style={styles.kicker}>QUICK REQUEST</Text>
          </View>
        </View>

        <Text style={styles.title}>{t(clusterCopy.titleKey)}</Text>
        <Text style={styles.subtitle}>
          {t(clusterCopy.helperKey)}
        </Text>

        {/* 2x2 palette grid for ≤4 items, 2-col flex grid for more */}
        <View style={styles.grid}>
          {clusterProblems.map((p) => {
            const active = problem === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                activeOpacity={0.85}
                onPress={() => setProblem(p.key)}
                style={[
                  styles.tile,
                  active && styles.tileActive,
                ]}
                testID={`qr-chip-${p.key}`}
              >
                <View
                  style={[
                    styles.tileIconWrap,
                    {
                      backgroundColor: active ? 'rgba(15,15,16,0.16)' : p.color + '1A',
                      borderColor: active ? 'rgba(15,15,16,0.24)' : p.color + '33',
                    },
                  ]}
                >
                  <Ionicons
                    name={p.icon}
                    size={26}
                    color={active ? colors.brandText : p.color}
                  />
                </View>
                <Text
                  style={[styles.tileLabel, active && styles.tileLabelActive]}
                  numberOfLines={2}
                >
                  {t(`quick_request.problems.${p.key}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sprint 33 C6 — cluster-specific input (carLink / budget / addressHint) */}
        {inputCopy.field && (
          <View style={styles.extraInputWrap} testID={`qr-extra-${inputCopy.field}`}>
            <Text style={styles.extraLabel}>{inputCopy.label}</Text>
            <TextInput
              value={extraInput}
              onChangeText={setExtraInput}
              placeholder={inputCopy.placeholder}
              placeholderTextColor={colors.textMuted}
              style={styles.extraInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={inputCopy.field === 'budget' ? 'numeric' : 'default'}
              testID={`qr-extra-input-${inputCopy.field}`}
            />
            {inputCopy.helper ? <Text style={styles.extraHelper}>{inputCopy.helper}</Text> : null}
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      <TouchableOpacity
        style={[styles.submitBtn, (!problem || loading) && styles.submitBtnDisabled]}
        activeOpacity={0.9}
        onPress={handleSubmit}
        disabled={!problem || loading}
        testID="qr-submit"
      >
        {loading ? (
          <ActivityIndicator color={colors.brandText} />
        ) : (
          <>
            <Ionicons name="flash" size={20} color={colors.brandText} />
            <Text style={styles.submitText}>{problem ? t('quick_request.find_workshop') : t('common.next')}</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        {location
          ? `${t('quick_request.location_label')}: ${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}`
          : t('quick_request.helper')}
      </Text>
    </SafeAreaView>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 14,
    },
    scrollContent: {
      paddingBottom: 8,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18,
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
    kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    kickerDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.brand,
    },
    kicker: {
      color: c.brand,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.6,
    },
    title: {
      color: c.text,
      fontSize: 28,
      fontWeight: '900',
      letterSpacing: -0.6,
      lineHeight: 34,
    },
    subtitle: {
      color: c.textMuted || c.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 8,
      marginBottom: 22,
    },

    // ── 2x2 palette grid ──
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
    },
    tile: {
      width: '48%',
      minHeight: 124,
      paddingHorizontal: 14,
      paddingVertical: 16,
      borderRadius: 18,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    tileActive: {
      backgroundColor: c.brand,
      borderColor: c.brand,
      ...Platform.select({
        ios: {
          shadowColor: c.brand,
          shadowOpacity: 0.35,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
        },
        android: { elevation: 4 },
        default: {},
      }),
    },
    tileIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    tileLabel: {
      color: c.text,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
      letterSpacing: -0.1,
    },
    tileLabelActive: { color: c.brandText },

    // ── extra input ──
    extraInputWrap: { marginTop: 22, gap: 8 },
    extraLabel: {
      color: c.text,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    extraInput: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
      color: c.text,
      fontSize: 15,
    },
    extraHelper: { color: c.textMuted || c.textSecondary, fontSize: 12, marginTop: 2 },

    // ── submit (yellow brand CTA, sticky) ──
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: c.brand,
      borderRadius: 18,
      paddingVertical: 18,
      marginTop: 10,
      ...Platform.select({
        ios: {
          shadowColor: c.brand,
          shadowOpacity: 0.32,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
        },
        android: { elevation: 5 },
        default: {},
      }),
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitText: {
      color: c.brandText,
      fontSize: 17,
      fontWeight: '900',
      letterSpacing: -0.2,
    },
    disclaimer: {
      color: c.textMuted || c.textSecondary,
      textAlign: 'center',
      fontSize: 12,
      marginTop: 10,
    },
  });
}
