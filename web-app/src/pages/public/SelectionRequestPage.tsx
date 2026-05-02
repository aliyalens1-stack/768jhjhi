// Sprint 1 — Repositioning placeholder. Full logic → Sprint 2 (Auto Request Core).
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, ArrowLeft, Wrench, Car, MapPin, Sparkles } from 'lucide-react';

export default function SelectionRequestPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6 py-12" data-testid="selection-request-page">
      <Link to="/" className="inline-flex items-center gap-1 text-sm font-bold text-[var(--text-2)] hover:text-[var(--text)] mb-6" data-testid="selection-request-back">
        <ArrowLeft size={16} /> {t('common.back')}
      </Link>

      <div className="inline-flex items-center gap-2 rounded-full bg-[var(--primary-soft)] text-[var(--primary-h)] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] mb-4">
        <Sparkles size={14} /> {t('selection_request.soon')}
      </div>

      <h1 className="text-3xl md:text-4xl font-extrabold leading-tight" data-testid="selection-request-title">
        {t('selection_request.title')}
      </h1>
      <p className="mt-3 text-[var(--text-2)] max-w-2xl">
        {t('selection_request.subtitle')}
      </p>

      <div className="mt-8 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="grid gap-4 md:grid-cols-2">
          <Field icon={<Car size={18} />} label={t('selection_request.fields.brand')} placeholder="BMW" />
          <Field icon={<Car size={18} />} label={t('selection_request.fields.model')} placeholder="320d" />
          <Field icon={<Wrench size={18} />} label={t('selection_request.fields.budget_max')} placeholder="20000 €" />
          <Field icon={<MapPin size={18} />} label={t('selection_request.fields.cities')} placeholder="Berlin, München, Paris" />
        </div>
        <div className="mt-5">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-soft)]">{t('selection_request.fields.links')}</label>
          <textarea
            disabled
            rows={3}
            placeholder={t('selection_request.fields.links_placeholder')}
            className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm disabled:opacity-70"
            data-testid="selection-request-links"
          />
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button disabled className="btn-primary btn-lg opacity-70 cursor-not-allowed" data-testid="selection-request-submit">
            <ClipboardCheck size={16} /> {t('selection_request.submit')}
          </button>
          <p className="text-xs text-[var(--text-soft)]">{t('selection_request.coming_soon_hint')}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, placeholder }: { icon: React.ReactNode; label: string; placeholder: string }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-soft)]">{label}</label>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
        <span className="text-[var(--text-soft)]">{icon}</span>
        <input disabled placeholder={placeholder} className="flex-1 bg-transparent text-sm outline-none disabled:opacity-70" />
      </div>
    </div>
  );
}
