/**
 * Sprint 2 — Inspector jobs board (mobile).
 * GET /api/inspector/jobs · POST /api/inspector/jobs/:id/claim
 */
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API = (Constants.expoConfig as any)?.extra?.apiUrl
  || process.env.EXPO_PUBLIC_BACKEND_URL
  || 'http://localhost:8001';

interface Job {
  id: string; requestId: string; city: string; status: string;
  brand: string; model: string; budget: number; createdAt: string;
}

export default function InspectorJobsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${API}/api/inspector/jobs`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (e: any) { setError(e?.message || 'failed'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem('token');
      setToken(t);
      await load();
    })();
  }, [load]);

  const claim = async (job: Job) => {
    if (!token) {
      Alert.alert('Sign in required', 'To claim a job you need to be signed in as a provider/inspector.', [
        { text: 'Cancel' }, { text: 'Sign in', onPress: () => router.push('/login?role=provider') },
      ]);
      return;
    }
    try {
      const res = await fetch(`${API}/api/inspector/jobs/${job.id}/claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 409) { Alert.alert('Already claimed', 'This job was just taken by someone else.'); load(); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      Alert.alert('Claimed ✓', `${job.city} · ${job.brand} ${job.model}`);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'failed');
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="inspector-jobs-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#0b0d11" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Available jobs</Text>
        <TouchableOpacity onPress={() => { setRefreshing(true); load(); }} testID="inspector-refresh">
          <Ionicons name="refresh" size={22} color="#0b0d11" />
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 40 }} />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <Text style={styles.kicker}>INSPECTOR · {jobs.length} OPEN</Text>
        <Text style={styles.title}>Pick a job near you</Text>
        <Text style={styles.subtitle}>Earn per inspection. Claim → drive → checklist → report.</Text>

        {!loading && jobs.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="search" size={28} color="#8b92a1" />
            <Text style={styles.emptyTitle}>No open jobs right now</Text>
            <Text style={styles.emptySub}>New car-selection requests will appear here.</Text>
          </View>
        )}

        {jobs.map((j) => (
          <View key={j.id} style={styles.card} testID={`inspector-job-${j.id}`}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}><Ionicons name="car-sport" size={18} color="#a77700" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{j.brand} {j.model}</Text>
                <Text style={styles.cardSub}><Ionicons name="location-outline" size={12} /> {j.city} · до {Number(j.budget).toLocaleString('de-DE')} €</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.claimBtn} onPress={() => claim(j)} testID={`inspector-claim-${j.id}`}>
              <Ionicons name="hand-right" size={16} color="#0b0d11" />
              <Text style={styles.claimText}>Take job</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#eef0f2' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0b0d11' },
  body: { padding: 18, paddingBottom: 60 },
  kicker: { fontSize: 11, fontWeight: '800', color: '#a77700', letterSpacing: 1.5 },
  title: { fontSize: 24, fontWeight: '900', color: '#0b0d11', marginTop: 4 },
  subtitle: { fontSize: 14, color: '#5e6574', marginTop: 6, marginBottom: 18 },
  emptyBox: { alignItems: 'center', padding: 40, borderWidth: 1, borderColor: '#eef0f2', borderRadius: 16, borderStyle: 'dashed' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0b0d11', marginTop: 10 },
  emptySub: { fontSize: 13, color: '#8b92a1', marginTop: 3, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: '#eef0f2', borderRadius: 16, padding: 14, marginBottom: 10, backgroundColor: '#fff' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardIcon: { height: 38, width: 38, borderRadius: 10, backgroundColor: '#fde5a7', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0b0d11' },
  cardSub: { fontSize: 12, color: '#5e6574', marginTop: 2 },
  claimBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#ffd94b', borderRadius: 12, paddingVertical: 12 },
  claimText: { fontWeight: '900', color: '#0b0d11', fontSize: 14 },
  errorText: { marginTop: 40, textAlign: 'center', color: '#b42626', fontWeight: '700' },
});
