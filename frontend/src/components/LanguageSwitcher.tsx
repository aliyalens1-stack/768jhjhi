/**
 * LanguageSwitcher (mobile)
 * Compact 3-segment switch DE / EN / RU with brand-yellow active state.
 * Uses react-i18next as the SINGLE SOURCE OF TRUTH.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setAppLanguage, type AppLang } from '../i18n';
import { useThemeContext } from '../context/ThemeContext';
import { theme } from '../../src/context/ThemeContext';
const colors = theme.colors;

const ORDER: Array<{ code: AppLang; label: string }> = [
  { code: 'de', label: 'DE' },
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
];

export default function LanguageSwitcher({ compact = true }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const { colors } = useThemeContext();
  const current = (i18n.language || 'de').split('-')[0] as AppLang;

  return (
    <View
      testID="lang-switcher"
      style={[
        styles.wrap,
        { backgroundColor: colors.card, borderColor: colors.border },
        !compact && { paddingHorizontal: 6 },
      ]}
    >
      {ORDER.map(({ code, label }) => {
        const active = current === code;
        return (
          <TouchableOpacity
            key={code}
            testID={`lang-${code}`}
            activeOpacity={0.85}
            onPress={() => setAppLanguage(code)}
            style={[
              styles.btn,
              compact && styles.btnCompact,
              active && { backgroundColor: colors.brand || colors.brand },
            ]}
          >
            <Text
              style={[
                styles.txt,
                { color: active ? (colors.brandText || colors.brandText) : (colors.textMuted || colors.textSecondary) },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnCompact: { paddingHorizontal: 9, paddingVertical: 5 },
  txt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
});
