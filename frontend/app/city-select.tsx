/**
 * Stage 2 — Geo + Search.
 * City selector screen: pick city → save → return to map / home.
 */
import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeContext } from '../src/context/ThemeContext';
import { useCity } from '../src/context/CityContext';
import { CityDTO } from '../src/services/api';

const FLAG_BY_COUNTRY: Record<string, string> = { DE: '🇩🇪', UA: '🇺🇦' };

export default function CitySelectScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { colors } = useThemeContext();
  const { t } = useTranslation();
  const { cities, selectedCity, selectCity, loading, refresh } = useCity();

  const handleSelect = async (c: CityDTO) => {
    await selectCity(c.code);
    if (redirect) {
      router.replace(redirect as any);
    } else {
      router.back();
    }
  };

  const renderItem = ({ item }: { item: CityDTO }) => {
    const active = selectedCity?.code === item.code;
    return (
      <TouchableOpacity
        testID={`city-row-${item.code}`}
        activeOpacity={0.85}
        onPress={() => handleSelect(item)}
        style={[
          styles.row,
          {
            backgroundColor: colors.card,
            borderColor: active ? colors.primary : colors.border,
            borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View style={[styles.flagWrap, { backgroundColor: colors.backgroundTertiary }]}>
          <Text style={styles.flagText}>{FLAG_BY_COUNTRY[item.country] || '🌍'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cityName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.cityMeta, { color: colors.textMuted }]}>
            {item.country} · {t('city_select.providers_count', { count: item.providersCount, defaultValue: `${item.providersCount} providers` })}
          </Text>
        </View>
        {active ? (
          <View style={[styles.checkWrap, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark" size={16} color={colors.onPrimary || '#000'} />
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity
          testID="city-back"
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.backgroundTertiary }]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('city_select.title', { defaultValue: 'Выберите город' })}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <Text style={[styles.intro, { color: colors.textSecondary }]}>
        {t('city_select.intro', {
          defaultValue: 'Мы покажем СТО рядом с центром выбранного города',
        })}
      </Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={cities}
          keyExtractor={(c) => c.code}
          renderItem={renderItem}
          onRefresh={refresh}
          refreshing={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  intro: { fontSize: 14, lineHeight: 20, paddingHorizontal: 16, paddingVertical: 12 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14,
  },
  flagWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  flagText: { fontSize: 22 },
  cityName: { fontSize: 16, fontWeight: '700' },
  cityMeta: { fontSize: 12, marginTop: 2 },
  checkWrap: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
