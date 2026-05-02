/**
 * Sprint 2 — Auto Request create form (mobile companion).
 * Posts to POST /api/customer/requests (optional auth).
 */
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const DEFAULT_CITIES = ['Berlin', 'München', 'Hamburg', 'Frankfurt', 'Köln', 'Paris', 'Wien', 'Warszawa'];
const API = (Constants.expoConfig as any)?.extra?.apiUrl
  || process.env.EXPO_PUBLIC_BACKEND_URL
  || 'http://localhost:8001';

export default function CreateAutoRequestScreen() {
  const router = useRouter();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [budget, setBudget] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState('');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCity = (c: string) => {
    setCities((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };
  const addCustomCity = () => {
    const v = cityInput.trim();
    if (v && !cities.includes(v) && cities.length < 10) {
      setCities([...cities, v]);
      setCityInput('');
    }
  };

  const submit = async () => {
    setError(null);
    if (!brand.trim() || !model.trim()) { setError('Brand and model are required'); return; }
    const b = parseInt(budget, 10);
    if (!Number.isFinite(b) || b < 500 || b > 500000) { setError('Budget: 500 — 500,000 €'); return; }
    if (cities.length === 0) { setError('Select at least one city'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/customer/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: brand.trim(),
          model: model.trim(),
          budget: b,
          links: link.trim() ? [link.trim()] : [],
          cities,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      router.replace(`/auto-request/${data.id}`);
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="auto-request-create-screen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="auto-request-create-back">
            <Ionicons name="chevron-back" size={24} color="#0b0d11" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Request</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>AUTO SELECTION</Text>
          <Text style={styles.title}>Describe the car you're looking for</Text>
          <Text style={styles.subtitle}>A TÜV-inspector will check it on-site and send a report with photos and video.</Text>

          <Field label="Brand">
            <TextInput value={brand} onChangeText={setBrand} placeholder="BMW" style={styles.input} testID="ar-brand" />
          </Field>
          <Field label="Model">
            <TextInput value={model} onChangeText={setModel} placeholder="320d" style={styles.input} testID="ar-model" />
          </Field>
          <Field label="Budget (max, €)">
            <TextInput
              value={budget}
              onChangeText={(v) => setBudget(v.replace(/[^0-9]/g, ''))}
              placeholder="20000"
              keyboardType="numeric"
              style={styles.input}
              testID="ar-budget"
            />
          </Field>

          <Field label={`Cities (${cities.length})`}>
            <View style={styles.chipsRow}>
              {cities.map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, styles.chipActive]} onPress={() => toggleCity(c)} testID={`ar-city-chip-${c}`}>
                  <Text style={styles.chipActiveText}>{c} ×</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.chipsRow}>
              {DEFAULT_CITIES.filter((c) => !cities.includes(c)).map((c) => (
                <TouchableOpacity key={c} style={styles.chip} onPress={() => toggleCity(c)} testID={`ar-city-suggest-${c}`}>
                  <Text style={styles.chipText}>+ {c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.row}>
              <TextInput value={cityInput} onChangeText={setCityInput} placeholder="Add city…" style={[styles.input, { flex: 1 }]} testID="ar-city-input" />
              <TouchableOpacity style={styles.addBtn} onPress={addCustomCity} testID="ar-city-add">
                <Ionicons name="add" size={20} color="#0b0d11" />
              </TouchableOpacity>
            </View>
          </Field>

          <Field label="Listing URL (optional)">
            <TextInput
              value={link}
              onChangeText={setLink}
              placeholder="https://www.mobile.de/…"
              autoCapitalize="none"
              keyboardType="url"
              style={styles.input}
              testID="ar-link"
            />
          </Field>

          {error && <Text style={styles.error} testID="ar-error">{error}</Text>}

          <TouchableOpacity style={[styles.submit, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading} testID="ar-submit">
            {loading ? <ActivityIndicator color="#0b0d11" /> : (
              <>
                <Ionicons name="shield-checkmark" size={18} color="#0b0d11" />
                <Text style={styles.submitText}>Create request</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.hint}>Beta: no payment yet. Packages ship in Sprint 3.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#eef0f2' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0b0d11' },
  body: { padding: 18, paddingBottom: 60 },
  kicker: { fontSize: 11, fontWeight: '800', color: '#a77700', letterSpacing: 1.5, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '900', color: '#0b0d11', lineHeight: 30 },
  subtitle: { fontSize: 14, color: '#5e6574', marginTop: 8, marginBottom: 20, lineHeight: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: '#7b8291', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#dfe3ea', backgroundColor: '#f7f8fa', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: '#0b0d11' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#dfe3ea', backgroundColor: '#f7f8fa' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#424b5c' },
  chipActive: { backgroundColor: '#fde5a7', borderColor: '#f5c54e' },
  chipActiveText: { fontSize: 13, fontWeight: '800', color: '#7a5b05' },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  addBtn: { height: 44, width: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffd94b' },
  error: { marginTop: 6, color: '#b42626', backgroundColor: '#fde3e3', borderColor: '#f3bcbc', borderWidth: 1, borderRadius: 10, padding: 10, fontWeight: '700', fontSize: 13 },
  submit: { marginTop: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: 14, backgroundColor: '#ffd94b' },
  submitText: { fontWeight: '900', fontSize: 16, color: '#0b0d11' },
  hint: { textAlign: 'center', marginTop: 10, fontSize: 11, color: '#8b92a1', fontWeight: '600' },
});
