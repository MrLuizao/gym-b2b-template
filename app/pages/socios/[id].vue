<script setup lang="ts">
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Download, Pencil, X } from '@lucide/vue';

import type { Branch, CheckInRecord, MemberDetail, MembershipPlan, PaymentRecord } from '#shared/types';

const route = useRoute();
const { session } = useAuth();
const detail = ref<MemberDetail | null>(null);
const branches = ref<Branch[]>([]);
const plans = ref<MembershipPlan[]>([]);
const pending = ref(true);

/// Admin edita cualquier socio; gerente solo los de su sede; recepcionista nunca.
const isAdmin = computed(() => session.value?.role === 'ADMIN');
const canEditMember = computed(() => {
  if (isAdmin.value) return true;
  return (
    session.value?.role === 'MANAGER' &&
    detail.value?.member.branchId === session.value?.branchId
  );
});

const editing = ref(false);
const saving = ref(false);
const editForm = ref({
  name: '',
  branchId: '',
  membershipType: '',
  membershipUntil: '',
});

const saveModalOpen = ref(false);
const saveModalDescription = ref('');
const saveModalEmpty = ref(false);

const PAGE_SIZE = 8;

const payFrom = ref('');
const payTo = ref('');
const payPage = ref(1);

const ciFrom = ref('');
const ciTo = ref('');
const ciPage = ref(1);

onMounted(async () => {
  try {
    const [memberDetail, branchList, planList] = await Promise.all([
      $fetch<MemberDetail>(`/api/members/${route.params.id}`),
      $fetch<Branch[]>('/api/branches'),
      $fetch<MembershipPlan[]>('/api/plans'),
    ]);
    detail.value = memberDetail;
    branches.value = branchList;
    plans.value = planList;
  } finally {
    pending.value = false;
  }
});

function inRange(ts: number, from: string, to: string): boolean {
  if (from && ts < new Date(`${from}T00:00:00`).getTime()) return false;
  if (to && ts > new Date(`${to}T23:59:59`).getTime()) return false;
  return true;
}

const filteredPayments = computed(() =>
  (detail.value?.payments ?? [])
    .filter((p) => inRange(p.createdAt, payFrom.value, payTo.value))
    .sort((a, b) => b.createdAt - a.createdAt),
);

const filteredCheckIns = computed(() =>
  (detail.value?.checkIns ?? [])
    .filter((c) => inRange(c.checkInAt, ciFrom.value, ciTo.value))
    .sort((a, b) => b.checkInAt - a.checkInAt),
);

const payPages = computed(() =>
  Math.max(1, Math.ceil(filteredPayments.value.length / PAGE_SIZE)),
);
const ciPages = computed(() =>
  Math.max(1, Math.ceil(filteredCheckIns.value.length / PAGE_SIZE)),
);

const pagedPayments = computed(() =>
  filteredPayments.value.slice(
    (payPage.value - 1) * PAGE_SIZE,
    payPage.value * PAGE_SIZE,
  ),
);
const pagedCheckIns = computed(() =>
  filteredCheckIns.value.slice(
    (ciPage.value - 1) * PAGE_SIZE,
    ciPage.value * PAGE_SIZE,
  ),
);

watch([payFrom, payTo], () => {
  payPage.value = 1;
});
watch([ciFrom, ciTo], () => {
  ciPage.value = 1;
});
watch(payPages, (pages) => {
  if (payPage.value > pages) payPage.value = pages;
});
watch(ciPages, (pages) => {
  if (ciPage.value > pages) ciPage.value = pages;
});

function statusMeta(status: string) {
  switch (status) {
    case 'EXPIRING':
      return {
        label: 'POR VENCER',
        cls: 'border-amber-400/30 bg-amber-400/10 text-amber-400',
      };
    case 'EXPIRED':
      return {
        label: 'VENCIDA',
        cls: 'border-red-400/30 bg-red-400/10 text-red-400',
      };
    default:
      return {
        label: 'ACTIVA',
        cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400',
      };
  }
}

function planColor(plan: string): 'primary' | 'info' | 'neutral' {
  const normalized = plan.toLowerCase();
  if (normalized.includes('black')) return 'primary';
  if (normalized.includes('plus')) return 'info';
  return 'neutral';
}

function branchName(id: string): string {
  return branches.value.find((b) => b.id === id)?.name ?? id.toUpperCase();
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('es-BO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function downloadCsv(filename: string, rows: string[][]): void {
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

function exportPayments(): void {
  if (!detail.value) return;
  downloadCsv(`pagos-${detail.value.member.memberNumber}.csv`, [
    ['Plan', 'Método', 'Monto (Bs)', 'Estado', 'Transacción', 'Fecha'],
    ...filteredPayments.value.map((p: PaymentRecord) => [
      p.plan,
      p.method,
      String(p.amountBs),
      p.status,
      p.transactionId,
      new Date(p.createdAt).toISOString(),
    ]),
  ]);
}

function exportCheckIns(): void {
  if (!detail.value) return;
  downloadCsv(`checkins-${detail.value.member.memberNumber}.csv`, [
    ['Sede', 'Método', 'Resultado', 'Fecha'],
    ...filteredCheckIns.value.map((c: CheckInRecord) => [
      branchName(c.branchId),
      c.method,
      c.granted ? 'OK' : 'DENEGADO',
      new Date(c.checkInAt).toISOString(),
    ]),
  ]);
}

function toDateInput(ts: number | null): string {
  return ts ? new Date(ts).toISOString().slice(0, 10) : '';
}

function startEdit(): void {
  if (!detail.value) return;
  const m = detail.value.member;
  editForm.value = {
    name: m.name,
    branchId: m.branchId,
    membershipType: m.membershipType,
    membershipUntil: toDateInput(m.membershipUntil),
  };
  editing.value = true;
}

function confirmSaveMember(): void {
  const m = detail.value?.member;
  if (!m) return;
  const changes: string[] = [];
  if (editForm.value.name.trim() !== m.name)
    changes.push(`Nombre: '${m.name}' → '${editForm.value.name.trim()}'`);
  if (isAdmin.value && editForm.value.branchId !== m.branchId)
    changes.push(
      `Sede: ${branchName(m.branchId)} → ${branchName(editForm.value.branchId)}`,
    );
  if (editForm.value.membershipType !== m.membershipType)
    changes.push(
      `Plan: ${m.membershipType} → ${editForm.value.membershipType}`,
    );
  if (editForm.value.membershipUntil !== toDateInput(m.membershipUntil))
    changes.push(
      `Vigencia: ${formatDate(m.membershipUntil)} → ${editForm.value.membershipUntil || 'sin fecha'}`,
    );
  saveModalDescription.value = changes.length
    ? `${changes.join('. ')}.`
    : 'No se detectaron cambios respecto a los datos actuales.';
  saveModalEmpty.value = changes.length === 0;
  saveModalOpen.value = true;
}

async function saveMember(): Promise<void> {
  const m = detail.value?.member;
  if (!m || saving.value) return;
  saving.value = true;
  try {
    await $fetch(`/api/members/${m.id}`, {
      method: 'PUT',
      body: {
        name: editForm.value.name.trim(),
        ...(isAdmin.value ? { branchId: editForm.value.branchId } : {}),
        membershipType: editForm.value.membershipType,
        membershipUntil: editForm.value.membershipUntil
          ? new Date(`${editForm.value.membershipUntil}T23:59:59`).getTime()
          : null,
      },
    });
    detail.value = await $fetch<MemberDetail>(`/api/members/${m.id}`);
    saveModalOpen.value = false;
    editing.value = false;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    v-if="pending"
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Cargando socio…
  </div>

  <div v-else-if="detail" class="space-y-6">
    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <div class="mt-4 flex items-center gap-4">
        <img
          :src="detail.member.photoUrl"
          :alt="detail.member.name"
          class="h-16 w-16 rounded-2xl border border-stroke object-cover"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-lg font-black text-text-primary">
            {{ detail.member.name }}
          </p>
          <p class="font-mono text-[11px] text-text-dim">
            {{ detail.member.memberNumber }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="rounded-full border px-3 py-1 text-[11px] font-bold"
            :class="statusMeta(detail.member.adminStatus).cls"
          >
            {{ statusMeta(detail.member.adminStatus).label }}
          </span>
          <button
            v-if="canEditMember && !editing"
            class="flex cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-3 py-1 text-[10px] font-black text-text-muted transition hover:border-accent hover:text-accent"
            @click="startEdit"
          >
            <Pencil class="h-3 w-3" />
            Editar
          </button>
        </div>
      </div>

      <div v-if="!editing" class="mt-5 grid grid-cols-3 gap-4 border-t border-stroke pt-4">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Plan
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ detail.member.membershipType }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Nivel
          </p>
          <p class="mt-1 text-sm font-black text-accent">
            {{ detail.member.membershipLevel }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Vence
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ formatDate(detail.member.membershipUntil) }}
          </p>
        </div>
      </div>

      <div v-else class="mt-5 space-y-3 border-t border-stroke pt-4">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Nombre
            </span>
            <input
              v-model="editForm.name"
              type="text"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label v-if="isAdmin" class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Sede
            </span>
            <select
              v-model="editForm.branchId"
              class="mt-1 w-full cursor-pointer rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            >
              <option v-for="b in branches" :key="b.id" :value="b.id">
                {{ b.name }}
              </option>
            </select>
          </label>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Plan
            </span>
            <select
              v-model="editForm.membershipType"
              class="mt-1 w-full cursor-pointer rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            >
              <option v-for="p in plans" :key="p.id" :value="p.name">
                {{ p.name }} — Bs {{ p.priceBs }}
              </option>
            </select>
          </label>
          <label class="block">
            <span class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              Vigencia hasta
            </span>
            <input
              v-model="editForm.membershipUntil"
              type="date"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>
        <div class="flex justify-end gap-2">
          <button
            class="flex cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-4 py-1.5 text-[11px] font-black text-text-muted transition hover:text-text-primary"
            @click="editing = false"
          >
            <X class="h-3.5 w-3.5" />
            Cancelar
          </button>
          <button
            class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 text-[11px] font-black text-base transition hover:opacity-90 disabled:opacity-50"
            @click="confirmSaveMember"
          >
            <Check class="h-3.5 w-3.5" />
            Guardar
          </button>
        </div>
      </div>
    </section>

    <section>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-sm font-black uppercase tracking-widest text-text-muted">
          Historial de pagos
        </h2>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="payFrom"
            type="date"
            class="rounded-xl border border-stroke bg-base px-3 py-1.5 text-[11px] text-text-primary outline-none focus:border-accent"
          />
          <span class="text-[10px] font-bold text-text-dim">a</span>
          <input
            v-model="payTo"
            type="date"
            class="rounded-xl border border-stroke bg-base px-3 py-1.5 text-[11px] text-text-primary outline-none focus:border-accent"
          />
          <button
            class="flex cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-3 py-1.5 text-[10px] font-black text-text-muted transition hover:border-accent hover:text-accent"
            :disabled="filteredPayments.length === 0"
            @click="exportPayments"
          >
            <Download class="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      </div>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left">
          <thead>
            <tr
              class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
            >
              <th class="px-5 py-3 font-bold">Plan</th>
              <th class="px-5 py-3 font-bold">Método</th>
              <th class="px-5 py-3 font-bold">Monto</th>
              <th class="px-5 py-3 font-bold">Estado</th>
              <th class="px-5 py-3 font-bold">Transacción</th>
              <th class="px-5 py-3 text-right font-bold">Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="payment in pagedPayments"
              :key="payment.id"
              class="border-t border-stroke"
            >
              <td class="px-5 py-3">
                <UBadge
                  :color="planColor(payment.plan)"
                  variant="subtle"
                  size="sm"
                  :label="payment.plan"
                />
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
              <td class="px-5 py-3 font-mono text-[10px] text-text-dim">
                {{ payment.transactionId }}
              </td>
              <td class="px-5 py-3 text-right font-mono text-[10px] text-text-dim">
                {{ formatDateTime(payment.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="filteredPayments.length === 0"
          class="py-8 text-center text-xs font-semibold text-text-dim"
        >
          Sin pagos en el rango seleccionado
        </p>
        <div
          v-if="filteredPayments.length > PAGE_SIZE"
          class="flex items-center justify-between border-t border-stroke px-5 py-2.5"
        >
          <p class="text-[10px] font-semibold text-text-dim">
            {{ filteredPayments.length }} pagos · página {{ payPage }} de
            {{ payPages }}
          </p>
          <div class="flex gap-1.5">
            <button
              class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-stroke text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-30"
              :disabled="payPage === 1"
              @click="payPage--"
            >
              <ChevronLeft class="h-3.5 w-3.5" />
            </button>
            <button
              class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-stroke text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-30"
              :disabled="payPage === payPages"
              @click="payPage++"
            >
              <ChevronRight class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-sm font-black uppercase tracking-widest text-text-muted">
          Check-ins
        </h2>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="ciFrom"
            type="date"
            class="rounded-xl border border-stroke bg-base px-3 py-1.5 text-[11px] text-text-primary outline-none focus:border-accent"
          />
          <span class="text-[10px] font-bold text-text-dim">a</span>
          <input
            v-model="ciTo"
            type="date"
            class="rounded-xl border border-stroke bg-base px-3 py-1.5 text-[11px] text-text-primary outline-none focus:border-accent"
          />
          <button
            class="flex cursor-pointer items-center gap-1.5 rounded-full border border-stroke px-3 py-1.5 text-[10px] font-black text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-40"
            :disabled="filteredCheckIns.length === 0"
            @click="exportCheckIns"
          >
            <Download class="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      </div>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left">
          <thead>
            <tr
              class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
            >
              <th class="px-5 py-3 font-bold">Sede</th>
              <th class="px-5 py-3 font-bold">Método</th>
              <th class="px-5 py-3 font-bold">Resultado</th>
              <th class="px-5 py-3 text-right font-bold">Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="checkIn in pagedCheckIns"
              :key="checkIn.id"
              class="border-t border-stroke"
            >
              <td class="px-5 py-3 text-[11px] font-bold text-text-primary">
                {{ branchName(checkIn.branchId) }}
              </td>
              <td class="px-5 py-3 font-mono text-[10px] uppercase text-text-dim">
                {{ checkIn.method }}
              </td>
              <td class="px-5 py-3">
                <span
                  class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
                  :class="
                    checkIn.granted
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                      : 'border-red-400/30 bg-red-400/10 text-red-400'
                  "
                >
                  {{ checkIn.granted ? 'OK' : 'DENEGADO' }}
                </span>
              </td>
              <td class="px-5 py-3 text-right font-mono text-[10px] text-text-dim">
                {{ formatDateTime(checkIn.checkInAt) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="filteredCheckIns.length === 0"
          class="py-8 text-center text-xs font-semibold text-text-dim"
        >
          Sin check-ins en el rango seleccionado
        </p>
        <div
          v-if="filteredCheckIns.length > PAGE_SIZE"
          class="flex items-center justify-between border-t border-stroke px-5 py-2.5"
        >
          <p class="text-[10px] font-semibold text-text-dim">
            {{ filteredCheckIns.length }} check-ins · página {{ ciPage }} de
            {{ ciPages }}
          </p>
          <div class="flex gap-1.5">
            <button
              class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-stroke text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-30"
              :disabled="ciPage === 1"
              @click="ciPage--"
            >
              <ChevronLeft class="h-3.5 w-3.5" />
            </button>
            <button
              class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-stroke text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-30"
              :disabled="ciPage === ciPages"
              @click="ciPage++"
            >
              <ChevronRight class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <NuxtLink
      to="/socios"
      class="flex h-11 items-center justify-center gap-2 rounded-full border border-stroke bg-surface text-xs font-black text-text-primary transition hover:border-accent"
    >
      <ArrowLeft class="h-4 w-4" />
      Volver a Socios
    </NuxtLink>

    <UModal
      v-model:open="saveModalOpen"
      title="Guardar cambios del socio"
      :description="saveModalDescription"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="saveModalOpen = false"
          />
          <UButton
            label="Guardar"
            icon="i-lucide-check"
            :disabled="saveModalEmpty"
            :loading="saving"
            @click="saveMember"
          />
        </div>
      </template>
    </UModal>
  </div>

  <div
    v-else
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Socio no encontrado
  </div>
</template>
