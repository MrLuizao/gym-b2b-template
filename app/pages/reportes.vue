<script setup lang="ts">
import { Download, FileBarChart, Play } from '@lucide/vue';

import type {
  AdsReportResponse,
  Branch,
  CheckInsReport,
  PaymentsReport,
} from '#shared/types';

const branches = ref<Branch[]>([]);
const pending = ref(true);
const generating = ref(false);

type ReportType = 'payments' | 'checkins' | 'ads';

const reportTypes = [
  { label: 'Pagos por rango de fechas', value: 'payments' },
  { label: 'Check-ins por rango de fechas', value: 'checkins' },
  { label: 'Publicidad de aliados', value: 'ads' },
];

const reportType = ref<ReportType>('payments');
const fromDate = ref('');
const toDate = ref('');
const selectedBranch = ref('todas');
const generated = ref(false);

const paymentsReport = ref<PaymentsReport | null>(null);
const checkInsReport = ref<CheckInsReport | null>(null);
const adsReport = ref<AdsReportResponse | null>(null);

onMounted(async () => {
  try {
    branches.value = await $fetch<Branch[]>('/api/branches');
    const today = new Date();
    toDate.value = toInputDate(today);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    fromDate.value = toInputDate(weekAgo);
  } finally {
    pending.value = false;
  }
});

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function applyPreset(days: number): void {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  fromDate.value = toInputDate(start);
  toDate.value = toInputDate(end);
}

function rangeMs(): { from: number; to: number } {
  const from = fromDate.value ? new Date(`${fromDate.value}T00:00:00`).getTime() : 0;
  const to = toDate.value ? new Date(`${toDate.value}T23:59:59`).getTime() : Date.now();
  return { from, to };
}

async function generate(): Promise<void> {
  if (generating.value) return;
  generating.value = true;
  const { from, to } = rangeMs();
  const qs = `from=${from}&to=${to}&branchId=${selectedBranch.value}`;
  try {
    if (reportType.value === 'payments') {
      paymentsReport.value = await $fetch<PaymentsReport>(
        `/api/reports/payments?${qs}`,
      );
      checkInsReport.value = null;
      adsReport.value = null;
    } else if (reportType.value === 'checkins') {
      checkInsReport.value = await $fetch<CheckInsReport>(
        `/api/reports/checkins?${qs}`,
      );
      paymentsReport.value = null;
      adsReport.value = null;
    } else {
      adsReport.value = await $fetch<AdsReportResponse>(
        `/api/reports/ads?${qs}`,
      );
      paymentsReport.value = null;
      checkInsReport.value = null;
    }
    generated.value = true;
  } finally {
    generating.value = false;
  }
}

watch(reportType, () => {
  generated.value = false;
});

function branchName(branchId: string): string {
  return branches.value.find((b) => b.id === branchId)?.name ?? '—';
}

function planColor(plan: string): 'primary' | 'info' | 'neutral' {
  const normalized = plan.toLowerCase();
  if (normalized.includes('black')) return 'primary';
  if (normalized.includes('plus')) return 'info';
  return 'neutral';
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function exportCsv(): void {
  let rows: string[][];
  let filename: string;
  if (reportType.value === 'payments' && paymentsReport.value) {
    filename = 'reporte-pagos.csv';
    rows = [
      ['Socio', 'Nº socio', 'Plan', 'Sede', 'Método', 'Monto (Bs)', 'Estado', 'Fecha'],
      ...paymentsReport.value.payments.map((p) => [
        p.memberName,
        p.memberNumber ?? '',
        p.plan,
        branchName(p.branchId),
        p.method,
        String(p.amountBs),
        p.status,
        new Date(p.createdAt).toISOString(),
      ]),
    ];
  } else if (reportType.value === 'checkins' && checkInsReport.value) {
    filename = 'reporte-checkins.csv';
    rows = [
      ['Socio', 'Sede', 'Método', 'Resultado', 'Fecha'],
      ...checkInsReport.value.checkIns.map((c) => [
        c.memberName,
        branchName(c.branchId),
        c.method,
        c.granted ? 'OK' : 'DENEGADO',
        new Date(c.checkInAt).toISOString(),
      ]),
    ];
  } else if (reportType.value === 'ads' && adsReport.value) {
    filename = 'reporte-ads.csv';
    rows = [
      [
        'Anunciante',
        'Anuncio',
        'Sede',
        'Estado',
        'Vigencia',
        'Impresiones',
        'Taps',
        'CTR %',
      ],
      ...adsReport.value.ads.map((ad) => [
        ad.advertiser,
        ad.title,
        ad.branchId ? branchName(ad.branchId) : 'Todas las sedes',
        ad.status,
        new Date(ad.endsAt).toISOString().slice(0, 10),
        String(ad.impressions),
        String(ad.taps),
        ad.impressions > 0
          ? ((ad.taps / ad.impressions) * 100).toFixed(1)
          : '0',
      ]),
    ];
  } else {
    return;
  }
  const csv = rows
    .map((r) => r.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent"
        >
          <FileBarChart class="h-5 w-5" />
        </div>
        <div>
          <h2 class="text-sm font-black text-text-primary">Generar reporte</h2>
          <p class="text-[10px] font-semibold text-text-dim">
            Selecciona el tipo, el rango de fechas y la sede.
          </p>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <label class="block md:col-span-2">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Tipo de reporte
          </span>
          <USelectMenu
            v-model="reportType"
            :items="reportTypes"
            value-key="value"
            class="mt-1 w-full"
          />
        </label>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Desde
          </span>
          <input
            v-model="fromDate"
            type="date"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </label>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Hasta
          </span>
          <input
            v-model="toDate"
            type="date"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </label>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <button
          v-for="preset in [
            { label: 'Hoy', days: 0 },
            { label: '7 días', days: 7 },
            { label: '30 días', days: 30 },
          ]"
          :key="preset.days"
          class="cursor-pointer rounded-full border border-stroke bg-base px-3 py-1 text-[10px] font-bold text-text-muted transition hover:border-accent hover:text-accent"
          @click="applyPreset(preset.days)"
        >
          {{ preset.label }}
        </button>
        <span class="mx-1 h-4 w-px bg-stroke" />
        <button
          class="cursor-pointer rounded-full border px-3 py-1 text-[10px] font-bold transition"
          :class="
            selectedBranch === 'todas'
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-stroke bg-surface text-text-dim hover:text-text-muted'
          "
          @click="selectedBranch = 'todas'"
        >
          Todas las sedes
        </button>
        <button
          v-for="branch in branches"
          :key="branch.id"
          class="cursor-pointer rounded-full border px-3 py-1 text-[10px] font-bold transition"
          :class="
            selectedBranch === branch.id
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-stroke bg-surface text-text-dim hover:text-text-muted'
          "
          @click="selectedBranch = branch.id"
        >
          {{ branch.name }}
        </button>
      </div>

      <div class="mt-4 flex justify-end">
        <button
          class="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-accent px-5 text-[11px] font-black text-base transition hover:opacity-90 disabled:opacity-50"
          :disabled="generating"
          @click="generate"
        >
          <Play class="h-3.5 w-3.5" />
          {{ generating ? 'Generando…' : 'Generar reporte' }}
        </button>
      </div>
    </section>

    <template v-if="generated && paymentsReport">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Pagos
          </p>
          <p class="mt-1 text-xl font-black text-text-primary">
            {{ paymentsReport.stats.total }}
          </p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Aprobados
          </p>
          <p class="mt-1 text-xl font-black text-emerald-400">
            {{ paymentsReport.stats.approved }}
          </p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Rechazados
          </p>
          <p class="mt-1 text-xl font-black text-red-400">
            {{ paymentsReport.stats.declined }}
          </p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Recaudado
          </p>
          <p class="mt-1 text-xl font-black text-text-primary">
            Bs {{ paymentsReport.stats.amountApprovedBs }}
          </p>
        </div>
      </div>

      <section v-if="paymentsReport.stats.byPlan.length">
        <h2
          class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted"
        >
          Recaudado por plan
        </h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="row in paymentsReport.stats.byPlan"
            :key="row.plan"
            class="flex items-center justify-between rounded-2xl border border-stroke bg-surface px-4 py-3"
          >
            <UBadge
              :color="planColor(row.plan)"
              variant="subtle"
              size="sm"
              :label="row.plan"
            />
            <div class="text-right">
              <p class="text-sm font-black text-text-primary">
                Bs {{ row.amountBs }}
              </p>
              <p class="text-[10px] text-text-dim">{{ row.count }} pagos</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="mb-3 flex items-center justify-between">
          <h2
            class="text-sm font-black uppercase tracking-widest text-text-muted"
          >
            Detalle de pagos
          </h2>
          <button
            class="flex cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-3 py-1.5 text-[10px] font-black text-text-muted transition hover:border-accent hover:text-accent"
            @click="exportCsv"
          >
            <Download class="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
        <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
          <table class="w-full text-left">
            <thead>
              <tr
                class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
              >
                <th class="px-5 py-3 font-bold">Socio</th>
                <th class="px-5 py-3 font-bold">Plan</th>
                <th class="px-5 py-3 font-bold">Sede</th>
                <th class="px-5 py-3 font-bold">Método</th>
                <th class="px-5 py-3 font-bold">Monto</th>
                <th class="px-5 py-3 font-bold">Estado</th>
                <th class="px-5 py-3 text-right font-bold">Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="payment in paymentsReport.payments"
                :key="payment.id"
                class="border-t border-stroke"
              >
                <td class="px-5 py-3">
                  <div class="flex items-center gap-3">
                    <img
                      v-if="payment.memberPhotoUrl"
                      :src="payment.memberPhotoUrl"
                      :alt="payment.memberName"
                      class="h-9 w-9 rounded-full border border-stroke object-cover"
                    />
                    <div>
                      <button
                        class="cursor-pointer text-xs font-bold text-text-primary transition hover:text-accent hover:underline"
                        @click="navigateTo(`/socios/${payment.memberId}`)"
                      >
                        {{ payment.memberName }}
                      </button>
                      <p
                        v-if="payment.memberNumber"
                        class="font-mono text-[10px] text-text-dim"
                      >
                        {{ payment.memberNumber }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="px-5 py-3">
                  <UBadge
                    :color="planColor(payment.plan)"
                    variant="subtle"
                    size="sm"
                    :label="payment.plan"
                  />
                </td>
                <td class="px-5 py-3 text-[11px] text-text-muted">
                  {{ branchName(payment.branchId) }}
                </td>
                <td class="px-5 py-3 font-mono text-[10px] text-text-dim">
                  {{ payment.method }}
                </td>
                <td class="px-5 py-3 text-sm font-black text-text-primary">
                  Bs {{ payment.amountBs }}
                </td>
                <td class="px-5 py-3">
                  <span
                    class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
                    :class="
                      payment.status === 'APPROVED'
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                        : 'border-red-400/30 bg-red-400/10 text-red-400'
                    "
                  >
                    {{ payment.status === 'APPROVED' ? 'APROBADO' : 'RECHAZADO' }}
                  </span>
                </td>
                <td class="px-5 py-3 text-right font-mono text-[10px] text-text-dim">
                  {{ formatDate(payment.createdAt) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="paymentsReport.payments.length === 0"
            class="py-8 text-center text-xs font-semibold text-text-dim"
          >
            Sin pagos en el rango seleccionado
          </p>
        </div>
      </section>
    </template>

    <template v-else-if="generated && checkInsReport">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Check-ins
          </p>
          <p class="mt-1 text-xl font-black text-text-primary">
            {{ checkInsReport.stats.total }}
          </p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Permitidos
          </p>
          <p class="mt-1 text-xl font-black text-emerald-400">
            {{ checkInsReport.stats.granted }}
          </p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Denegados
          </p>
          <p class="mt-1 text-xl font-black text-red-400">
            {{ checkInsReport.stats.denied }}
          </p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Socios únicos
          </p>
          <p class="mt-1 text-xl font-black text-text-primary">
            {{ checkInsReport.stats.uniqueMembers }}
          </p>
        </div>
      </div>

      <section v-if="checkInsReport.stats.byBranch.length">
        <h2
          class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted"
        >
          Check-ins por sede
        </h2>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="row in checkInsReport.stats.byBranch"
            :key="row.branchId"
            class="flex items-center justify-between rounded-2xl border border-stroke bg-surface px-4 py-3"
          >
            <span class="text-xs font-bold text-text-primary">
              {{ branchName(row.branchId) }}
            </span>
            <span class="text-sm font-black text-accent">{{ row.count }}</span>
          </div>
        </div>
      </section>

      <section>
        <div class="mb-3 flex items-center justify-between">
          <h2
            class="text-sm font-black uppercase tracking-widest text-text-muted"
          >
            Detalle de check-ins
          </h2>
          <button
            class="flex cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-3 py-1.5 text-[10px] font-black text-text-muted transition hover:border-accent hover:text-accent"
            @click="exportCsv"
          >
            <Download class="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
        <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
          <table class="w-full text-left">
            <thead>
              <tr
                class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
              >
                <th class="px-5 py-3 font-bold">Socio</th>
                <th class="px-5 py-3 font-bold">Sede</th>
                <th class="px-5 py-3 font-bold">Método</th>
                <th class="px-5 py-3 font-bold">Resultado</th>
                <th class="px-5 py-3 text-right font-bold">Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="record in checkInsReport.checkIns"
                :key="record.id"
                class="border-t border-stroke"
              >
                <td class="px-5 py-3">
                  <button
                    class="cursor-pointer text-xs font-bold text-text-primary transition hover:text-accent hover:underline"
                    @click="navigateTo(`/socios/${record.userId}`)"
                  >
                    {{ record.memberName }}
                  </button>
                </td>
                <td class="px-5 py-3 text-[11px] text-text-muted">
                  {{ branchName(record.branchId) }}
                </td>
                <td class="px-5 py-3 font-mono text-[10px] uppercase text-text-dim">
                  {{ record.method }}
                </td>
                <td class="px-5 py-3">
                  <span
                    class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
                    :class="
                      record.granted
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                        : 'border-red-400/30 bg-red-400/10 text-red-400'
                    "
                  >
                    {{ record.granted ? 'OK' : 'DENEGADO' }}
                  </span>
                </td>
                <td class="px-5 py-3 text-right font-mono text-[10px] text-text-dim">
                  {{ formatDate(record.checkInAt) }}
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="checkInsReport.checkIns.length === 0"
            class="py-8 text-center text-xs font-semibold text-text-dim"
          >
            Sin check-ins en el rango seleccionado
          </p>
        </div>
      </section>
    </template>

    <template v-else-if="generated && adsReport">
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Impresiones
          </p>
          <p class="mt-1 text-xl font-black text-text-primary">
            {{ adsReport.stats.impressions.toLocaleString('es-BO') }}
          </p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Taps
          </p>
          <p class="mt-1 text-xl font-black text-text-primary">
            {{ adsReport.stats.taps.toLocaleString('es-BO') }}
          </p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            CTR global
          </p>
          <p class="mt-1 text-xl font-black text-accent">
            {{ adsReport.stats.ctr }}%
          </p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Audiencia promos
          </p>
          <p class="mt-1 text-xl font-black text-text-primary">
            {{ adsReport.stats.optedInMembers.toLocaleString('es-BO') }}
          </p>
          <p class="text-[9px] text-text-dim">socios con promos de aliados</p>
        </div>
      </div>

      <section>
        <div class="mb-3 flex items-center justify-between">
          <h2
            class="text-sm font-black uppercase tracking-widest text-text-muted"
          >
            Rendimiento por anuncio
          </h2>
          <button
            class="flex cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-3 py-1.5 text-[10px] font-black text-text-muted transition hover:border-accent hover:text-accent"
            @click="exportCsv"
          >
            <Download class="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
        <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
          <table class="w-full text-left">
            <thead>
              <tr
                class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
              >
                <th class="px-5 py-3 font-bold">Anuncio</th>
                <th class="px-5 py-3 font-bold">Sede</th>
                <th class="px-5 py-3 font-bold">Vigencia</th>
                <th class="px-5 py-3 font-bold">Estado</th>
                <th class="px-5 py-3 font-bold">Impresiones</th>
                <th class="px-5 py-3 font-bold">Taps</th>
                <th class="px-5 py-3 text-right font-bold">CTR</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="ad in adsReport.ads"
                :key="ad.id"
                class="border-t border-stroke"
              >
                <td class="px-5 py-3">
                  <div class="flex items-center gap-3">
                    <img
                      :src="ad.imageUrl"
                      :alt="ad.title"
                      class="h-9 w-14 rounded-lg border border-stroke object-cover"
                    />
                    <div>
                      <p class="text-xs font-bold text-text-primary">
                        {{ ad.advertiser }}
                      </p>
                      <p class="text-[10px] text-text-dim">{{ ad.title }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-5 py-3 text-[11px] text-text-muted">
                  {{ ad.branchId ? branchName(ad.branchId) : 'Todas' }}
                </td>
                <td class="px-5 py-3 font-mono text-[10px] text-text-dim">
                  {{ new Date(ad.endsAt).toLocaleDateString('es-BO') }}
                </td>
                <td class="px-5 py-3">
                  <span
                    class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
                    :class="
                      ad.status === 'ACTIVE'
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                        : 'border-stroke bg-base text-text-dim'
                    "
                  >
                    {{ ad.status === 'ACTIVE' ? 'ACTIVO' : 'PAUSADO' }}
                  </span>
                </td>
                <td class="px-5 py-3 text-[11px] font-bold text-text-primary">
                  {{ ad.impressions.toLocaleString('es-BO') }}
                </td>
                <td class="px-5 py-3 text-[11px] font-bold text-text-primary">
                  {{ ad.taps.toLocaleString('es-BO') }}
                </td>
                <td class="px-5 py-3 text-right">
                  <span
                    class="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-black text-accent"
                  >
                    {{
                      ad.impressions > 0
                        ? ((ad.taps / ad.impressions) * 100).toFixed(1) + '%'
                        : '—'
                    }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="adsReport.ads.length === 0"
            class="py-8 text-center text-xs font-semibold text-text-dim"
          >
            Sin anuncios en el rango seleccionado
          </p>
        </div>
        <p class="mt-2 text-[10px] text-text-dim">
          Este reporte es el que el comercial le muestra al anunciante para
          justificar el costo del espacio publicitario.
        </p>
      </section>
    </template>

    <div
      v-else-if="!pending"
      class="rounded-2xl border border-dashed border-stroke bg-surface p-10 text-center"
    >
      <FileBarChart class="mx-auto h-8 w-8 text-text-dim" />
      <p class="mt-3 text-xs font-semibold text-text-dim">
        Configura el tipo, el rango de fechas y la sede, luego genera el
        reporte.
      </p>
    </div>
  </div>
</template>
