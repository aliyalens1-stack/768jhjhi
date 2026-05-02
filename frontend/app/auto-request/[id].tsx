/**
 * Sprint 2 — Request detail (mobile).
 * Reads GET /api/customer/requests/:id/jobs.
 */
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const API = (Constants.expoConfig as any)?.extra?.apiUrl
  || process.env.EXPO_PUBLIC_BACKEND_URL
  || 'http://localhost:8001';

export default function RequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const res = await fetch(`${API}/api/customer/requests/${id}/jobs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: any) { setError(e?.message || 'failed'); }
  }

  return (
    <SafeAreaView style={styles.safe} testID="request-detail-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#0b0d11" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request</Text>
        <View style={{ width: 24 }} />
      </View>

      {!data && !error && <ActivityIndicator style={{ marginTop: 40 }} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {data && (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.kicker}>REQUEST</Text>
          <Text style={styles.title}>{data.request.brand} {data.request.model}</Text>

          <View style={styles.metaRow}>
            <Meta icon="cash-outline" label={`до ${Number(data.request.budget).toLocaleString('de-DE')} €`} />
            <Meta icon="location-outline" label={data.request.cities.join(' · ')} />
          </View>

          <View style={styles.statsRow}>
            <Stat label="Total" value={data.request.jobsTotal} />
            <Stat label="Claimed" value={data.request.jobsClaimed} accent />
            <Stat label="Done" value={data.request.jobsDone} />
          </View>

          <Text style={styles.sectionTitle}>Inspection jobs</Text>
          {data.jobs.map((j: any) => (
            <View key={j.id} style={styles.jobRow} testID={`job-${j.id}`}>
              <View style={styles.jobLeft}>
                <View style={styles.jobIcon}><Ionicons name="location" size={16} color="#a77700" /></View>
                <View>
                  <Text style={styles.jobCity}>{j.city}</Text>
                  <Text style={styles.jobSub}>{j.inspectorId ? `Inspector ${j.inspectorId.substring(0, 8)}…` : 'Waiting for inspector'}</Text>
                </View>
              </View>
              <View style={[styles.pill, pillStyle(j.status)]}>
                <Text style={[styles.pillText, pillTextStyle(j.status)]}>{j.status}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Meta({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color="#5e6574" />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}
function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <View style={[styles.statBox, accent && { backgroundColor: '#fde5a7', borderColor: '#f5c54e' }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function pillStyle(s: string) {
  if (s === 'claimed') return { backgroundColor: '#fef3c7', borderColor: '#f5c54e' };
  if (s === 'done') return { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' };
  return { backgroundColor: '#eef2f7', borderColor: '#dfe3ea' };
}
function pillTextStyle(s: string) {
  if (s === 'claimed') return { color: '#7a5b05' };
  if (s === 'done') return { color: '#065f46' };
  return { color: '#424b5c' };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#eef0f2' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0b0d11' },
  body: { padding: 18, paddingBottom: 60 },
  kicker: { fontSize: 11, fontWeight: '800', color: '#a77700', letterSpacing: 1.5 },
  title: { fontSize: 26, fontWeight: '900', color: '#0b0d11', marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: '#5e6574' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  statBox: { flex: 1, borderWidth: 1, borderColor: '#dfe3ea', borderRadius: 12, padding: 12, backgroundColor: '#f7f8fa' },
  statValue: { fontSize: 22, fontWeight: '900', color: '#0b0d11' },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#7b8291', letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0b0d11', marginTop: 24, marginBottom: 10 },
  jobRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#eef0f2', borderRadius: 14, padding: 14, marginBottom: 8, backgroundColor: '#fff' },
  jobLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  jobIcon: { height: 36, width: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fde5a7' },
  jobCity: { fontSize: 15, fontWeight: '800', color: '#0b0d11' },
  jobSub: { fontSize: 12, color: '#7b8291', marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  errorText: { marginTop: 40, textAlign: 'center', color: '#b42626', fontWeight: '700' },
});
