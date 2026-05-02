// Sprint 1 — Repositioning placeholder. Full logic → Sprint 2 (Auto Request Core).
import { Sparkles, ClipboardCheck } from 'lucide-react';

export default function AutoRequestsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6" data-testid="auto-requests-page">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 inline-flex items-center justify-center">
          <ClipboardCheck size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold">Auto Requests</h1>
          <p className="text-sm text-slate-400">Client inspection / car selection requests (Auto 2.0 core)</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800 p-10 text-center">
        <Sparkles size={32} className="mx-auto text-amber-400 mb-3" />
        <h2 className="text-xl font-extrabold mb-2">Coming in Sprint 2 — Auto Request Core</h2>
        <p className="text-slate-400 max-w-xl mx-auto">
          Here admin will see all incoming client requests to find/inspect a car:
          filters by city, budget, status · assign inspectors · track SLA · manage inspection packages.
        </p>
        <ul className="mt-6 text-left text-sm text-slate-300 max-w-xl mx-auto space-y-2">
          <li>· <code className="text-amber-400">car_requests</code> — таблица заявок на подбор</li>
          <li>· <code className="text-amber-400">inspection_jobs</code> — задания на осмотр, назначение инспекторов</li>
          <li>· <code className="text-amber-400">inspection_reports</code> — отчёты, score, photos, videos</li>
          <li>· <code className="text-amber-400">inspection_packages</code> — пакеты 1 / 3 / 5 осмотров (Stripe + PayPal)</li>
        </ul>
      </div>
    </div>
  );
}
