import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '../context/ThemeContext';
import { theme } from '../../src/context/ThemeContext';
const colors = theme.colors;

// Sprint QR-1: Quick Request Hero CTA — главный путь к "магии".
// 1 тап — мастера уже ищут.
//
// Усиления конверсии:
//   • Red primary (без вариантов выбора)
//   • Sub-copy: "1 тап — мастера уже ищут" → подчеркивает мгновенность
//   • Right-arrow → визуальный сигнал движения
//   • Live-dot bullet → создает ощущение "система работает прямо сейчас"
export default function QuickRequestCTA() {
  const router = useRouter();
  const { theme } = useThemeContext();
  const palette = theme === 'dark'
    ? { primary: colors.brand, primaryPressed: colors.brand, onPrimary: colors.text, live: colors.success }
    : { primary: colors.brand, primaryPressed: colors.brand, onPrimary: colors.text, live: colors.success };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push('/quick-request')}
      style={[styles.cta, { backgroundColor: palette.primary }]}
      testID="home-quick-request-cta"
    >
      <View style={styles.iconBubble}>
        <Ionicons name="flash" size={22} color={palette.onPrimary} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: palette.onPrimary }]}>Быстро решить</Text>
          <View style={[styles.liveDot, { backgroundColor: palette.live }]} />
        </View>
        <Text style={[styles.subtitle, { color: palette.onPrimary }]}>
          1 тап — мастера уже ищут
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={palette.onPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: colors.brand,
        shadowOpacity: 0.28,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  subtitle: { fontSize: 13, fontWeight: '600', opacity: 0.86, marginTop: 2 },
});
