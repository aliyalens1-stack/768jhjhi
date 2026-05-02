import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Star, ShieldCheck, Clock, Wrench, Zap, ArrowRight, Link2 } from 'lucide-react';
import { marketplaceAPI } from '../../services/api';
import { ProviderCard } from '../../components/marketplace/ProviderCard';

const PROBLEM_CHIP_KEYS = [
  'engine_wont_start',
  'urgent',
  'diagnostics',
  'oil_change',
  'brakes',
  'electrical',
  'suspension',
];

export default function MarketplaceHome() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [providers, setProviders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('Berlin');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [providersRes, statsRes] = await Promise.all([
        marketplaceAPI.getProviders(),
        marketplaceAPI.getStats(),
      ]);
      const list = providersRes.data?.providers ?? providersRes.data ?? [];
      setProviders(Array.isArray(list) ? list : []);
      setStats(statsRes.data);
    } catch (e) {
      console.error('home load failed', e);
    }
  }

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (city) params.set('city', city);
    navigate(`/search?${params.toString()}`);
  };

  const onChip = (problem: string) => {
    navigate(`/search?problem=${problem}`);
  };

  return (
    <div data-testid="marketplace-home">
      {/* ── Berlin Launch B2 — mobile.de inspection CTA banner ─── */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 pt-6">
        <Link
          to="/inspect"
          className="block rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[#fef3c7] via-white to-white p-5 md:p-6 shadow-[var(--shadow-card)] hover:shadow-md transition-shadow group"
          data-testid="home-inspect-banner"
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-[var(--primary)] text-black inline-flex items-center justify-center shrink-0">
              <Link2 size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-h)] mb-0.5">
                {t('home.banner.kicker')}
              </div>
              <div className="font-extrabold text-lg md:text-xl truncate">
                {t('home.banner.title')}
              </div>
              <div className="text-sm text-[var(--text-2)] hidden md:block">
                {t('home.banner.subtitle')}
              </div>
            </div>
            <ArrowRight size={20} className="text-[var(--text-soft)] group-hover:text-[var(--text)] transition-colors shrink-0" />
          </div>
        </Link>
      </section>

      {/* ── Hero Search ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 pt-10 pb-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--primary-h)]" data-testid="home-eyebrow">
              {t('home.eyebrow')}
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--text)] max-w-3xl" data-testid="home-title">
              {t('home.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-[var(--text-2)]" data-testid="home-subtitle">
              {t('home.subtitle')}
            </p>

            {/* Search box */}
            <form onSubmit={submitSearch} className="mt-7 rounded-2xl border border-[var(--border)] bg-white p-3 md:p-4 shadow-[var(--shadow-card)]" data-testid="home-search-form">
              <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                <div className="flex-1 input-shell input-lg">
                  <Search size={18} className="text-[var(--text-soft)]" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t('home.search_placeholder')}
                    data-testid="home-search-q"
                  />
                </div>
                <div className="md:w-48 input-shell input-lg">
                  <MapPin size={18} className="text-[var(--text-soft)]" />
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t('home.city_placeholder')}
                    data-testid="home-search-city"
                  />
                </div>
                <button type="submit" className="btn-primary btn-lg md:w-auto" data-testid="home-search-submit">
                  <Search size={16} /> {t('home.search_btn')}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2" data-testid="home-problem-chips">
                {PROBLEM_CHIP_KEYS.map((key) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => onChip(key)}
                    className="chip"
                    data-testid={`home-chip-${key}`}
                  >
                    {t(`home.chips.${key}`)}
                  </button>
                ))}
              </div>
            </form>

            {/* Trust strip */}
            <div className="mt-6 flex flex-wrap items-center gap-6 text-sm text-[var(--text-2)]" data-testid="home-trust-strip">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-[var(--success)]" /> {t('home.trust.verified')}</span>
              <span className="inline-flex items-center gap-2"><Clock size={16} className="text-[var(--warning)]" /> {t('home.trust.live_eta')}</span>
              <span className="inline-flex items-center gap-2"><Star size={16} className="text-[var(--primary)] fill-[var(--primary)]" /> {t('home.trust.real_reviews')}</span>
            </div>
          </div>

          {/* ── Live Stats Panel ─────────────────────────── */}
          <aside className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)]" data-testid="home-live-stats">
            <div className="mb-4 flex items-center gap-2">
              <span className="live-dot" />
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-2)]">
                {t('home.live.title')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label={t('home.live.providers_online')} value={stats?.onlineProviders ?? '—'} />
              <Stat label={t('home.live.avg_eta')} value={stats?.avgEta ? `${stats.avgEta} ${t('common.minutes_short')}` : '—'} />
              <Stat label={t('home.live.avg_rating')} value={stats?.avgRating ? Number(stats.avgRating).toFixed(1) : '—'} />
              <Stat label={t('home.live.today_bookings')} value={stats?.todayBookings ?? '—'} />
            </div>

            {Array.isArray(stats?.recentEvents) && stats.recentEvents.length > 0 && (
              <div className="mt-5 border-t border-[var(--border)] pt-4">
                <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-[var(--text-soft)] mb-2">{t('home.live.recent_activity')}</div>
                <ul className="space-y-2 text-sm">
                  {stats.recentEvents.slice(0, 3).map((ev: any, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${ev.type === 'accept' ? 'bg-[var(--success)]' : ev.type === 'online' ? 'bg-[var(--primary)]' : 'bg-[var(--text-soft)]'}`} />
                      <div>
                        <div className="text-[var(--text)]">{ev.text}</div>
                        <div className="text-xs text-[var(--text-soft)]">{ev.time}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button onClick={() => navigate('/search?urgent=1')} className="btn-dark w-full mt-5" data-testid="home-quick-request">
              <Zap size={16} /> {t('home.live.quick_request')}
            </button>
          </aside>
        </div>
      </section>

      {/* ── Recommended Providers ─────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 pb-16" data-testid="home-recommended">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--primary-h)]">{t('home.recommended.eyebrow')}</p>
            <h2 className="text-2xl md:text-3xl font-extrabold mt-1">{t('home.recommended.title')}</h2>
          </div>
          <Link to="/search" className="text-sm font-bold inline-flex items-center gap-1 hover:text-[var(--primary-h)]" data-testid="home-view-all">
            {t('home.recommended.view_all')} <ArrowRight size={14} />
          </Link>
        </div>

        {providers.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4">
            {providers.slice(0, 6).map((p) => (
              <ProviderCard key={p.id || p._id || p.slug} provider={p} />
            ))}
          </div>
        )}
      </section>

      {/* ── How it works ────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 pb-20" data-testid="home-how-it-works">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--primary-h)]">{t('home.how.eyebrow')}</p>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-1">{t('home.how.title')}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Step n={1} title={t('home.how.step1_title')} text={t('home.how.step1_text')} icon={<Wrench size={18} />} />
          <Step n={2} title={t('home.how.step2_title')} text={t('home.how.step2_text')} icon={<Star size={18} />} />
          <Step n={3} title={t('home.how.step3_title')} text={t('home.how.step3_text')} icon={<MapPin size={18} />} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl bg-[var(--surface-soft)] border border-[var(--border)] p-3.5">
      <div className="text-2xl font-extrabold text-[var(--text)]">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-soft)]">{label}</div>
    </div>
  );
}

function Step({ n, title, text, icon }: { n: number; title: string; text: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-[var(--primary-soft)] text-[var(--primary-p)] inline-flex items-center justify-center font-extrabold">
          {n}
        </div>
        <div className="text-[var(--text-2)]">{icon}</div>
      </div>
      <h3 className="text-lg font-extrabold mb-1">{title}</h3>
      <p className="text-sm text-[var(--text-2)]">{text}</p>
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-white p-10 text-center" data-testid="home-empty">
      <Wrench size={28} className="mx-auto text-[var(--text-soft)] mb-3" />
      <div className="font-bold mb-1">{t('home.recommended.empty_title')}</div>
      <p className="text-sm text-[var(--text-2)] max-w-md mx-auto">{t('home.recommended.empty_subtitle')}</p>
    </div>
  );
}
