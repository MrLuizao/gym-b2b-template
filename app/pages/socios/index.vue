<script setup lang="ts">
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Globe,
  Plus,
  UserCheck,
  UserX,
} from '@lucide/vue';

import type { Branch, MemberAdmin } from '#shared/types';

const { session } = useAuth();
const canViewBranches = computed(() =>
  canAccess(session.value?.role, '/sedes'),
);

/// Alta de socio: los tres roles pueden inscribir (es trabajo de mostrador);
/// admin elige sede, gerente/recepcionista quedan fijos en la suya.
const canCreateMember = computed(() => !!session.value?.role);

const members = ref<MemberAdmin[]>([]);
const branches = ref<Branch[]>([]);
const pending = ref(true);
const search = ref('');
/// Gerente/recepcionista arrancan filtrados a su sede (pueden cambiar el filtro).
const selectedBranch = ref(session.value?.branchId ?? 'todas');
const statusFilter = ref<'todos' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'multi'>(
  'todos',
);
const page = ref(1);
const pageSize = 8;

onMounted(async () => {
  try {
    const [memberList, branchList] = await Promise.all([
      $api<MemberAdmin[]>('/api/members'),
      $api<Branch[]>('/api/branches'),
    ]);
    members.value = memberList;
    branches.value = branchList;
  } finally {
    pending.value = false;
  }
});

const activeCount = computed(
  () => members.value.filter((m) => m.adminStatus === 'ACTIVE').length,
);
const expiringCount = computed(
  () => members.value.filter((m) => m.adminStatus === 'EXPIRING').length,
);
const expiredCount = computed(
  () => members.value.filter((m) => m.adminStatus === 'EXPIRED').length,
);
const allAccessCount = computed(
  () => members.value.filter((m) => m.allBranchesAccess).length,
);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return members.value.filter(
    (m) =>
      (selectedBranch.value === 'todas' ||
        m.branchId === selectedBranch.value ||
        m.allBranchesAccess) &&
      (statusFilter.value === 'todos' ||
        (statusFilter.value === 'multi'
          ? m.allBranchesAccess
          : m.adminStatus === statusFilter.value)) &&
      (!q ||
        m.name.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q)),
  );
});

const pageCount = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / pageSize)),
);

const paged = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize),
);

watch([search, selectedBranch, statusFilter], () => {
  page.value = 1;
});

function toggleStatusFilter(
  key: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'multi',
): void {
  statusFilter.value = statusFilter.value === key ? 'todos' : key;
}
watch(pageCount, (pages) => {
  if (page.value > pages) page.value = pages;
});

function branchName(branchId: string): string {
  return branches.value.find((b) => b.id === branchId)?.name ?? '—';
}

function statusMeta(status: MemberAdmin['adminStatus']) {
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

function planColor(plan: string) {
  const normalized = plan.toLowerCase();
  if (normalized.includes('black')) return 'primary' as const;
  if (normalized.includes('plus')) return 'info' as const;
  return 'neutral' as const;
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          statusFilter === 'ACTIVE'
            ? 'border-accent bg-accent/10'
            : 'border-stroke bg-surface hover:border-accent/50'
        "
        @click="toggleStatusFilter('ACTIVE')"
      >
        <div class="flex items-center gap-2">
          <UserCheck class="h-4 w-4 text-accent" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Activos
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ activeCount }}
          <span class="text-[11px] font-bold text-text-dim">
            / {{ members.length }}
          </span>
        </p>
      </button>
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          statusFilter === 'EXPIRING'
            ? 'border-amber-400 bg-amber-400/10'
            : 'border-stroke bg-surface hover:border-amber-400/50'
        "
        @click="toggleStatusFilter('EXPIRING')"
      >
        <div class="flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 text-amber-400" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Por vencer
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-amber-400">
          {{ expiringCount }}
        </p>
      </button>
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          statusFilter === 'EXPIRED'
            ? 'border-red-400 bg-red-400/10'
            : 'border-stroke bg-surface hover:border-red-400/50'
        "
        @click="toggleStatusFilter('EXPIRED')"
      >
        <div class="flex items-center gap-2">
          <UserX class="h-4 w-4 text-red-400" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Vencidas
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-red-400">
          {{ expiredCount }}
        </p>
      </button>
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          statusFilter === 'multi'
            ? 'border-accent bg-accent/10'
            : 'border-stroke bg-surface hover:border-accent/50'
        "
        @click="toggleStatusFilter('multi')"
      >
        <div class="flex items-center gap-2">
          <Globe class="h-4 w-4 text-accent" />
          <p
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Acceso multi-sede
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ allAccessCount }}
        </p>
      </button>
    </div>

    <section>
      <h2
        class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted"
      >
        Filtrar por sede
      </h2>
      <div class="flex flex-wrap gap-2">
        <button
          class="cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition"
          :class="
            selectedBranch === 'todas'
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-stroke bg-surface text-text-dim hover:text-text-muted'
          "
          @click="selectedBranch = 'todas'"
        >
          Todas
        </button>
        <button
          v-for="branch in branches"
          :key="branch.id"
          class="cursor-pointer rounded-full border px-4 py-1.5 text-xs font-bold transition"
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
      <p
        v-if="selectedBranch !== 'todas'"
        class="mt-2 text-[10px] font-semibold text-text-dim"
      >
        Los socios con acceso a todas las sedes aparecen en cualquier filtro.
      </p>
    </section>

    <div class="flex items-center gap-4">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Buscar por nombre o Nº de socio…"
        class="w-full max-w-sm"
        size="lg"
      />
      <button
        v-if="canCreateMember"
        class="ml-auto flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-base transition hover:opacity-90"
        @click="navigateTo('/socios/nuevo')"
      >
        <Plus class="h-3.5 w-3.5" />
        Nuevo socio
      </button>
      <span
        :class="canCreateMember ? '' : 'ml-auto'"
        class="rounded-full border border-stroke bg-surface px-3 py-1 text-[11px] font-bold text-text-muted"
      >
        {{ filtered.length }} socios
      </span>
    </div>

    <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
      <table class="w-full text-left">
        <thead>
          <tr
            class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
          >
            <th class="px-5 py-3 font-bold">Socio</th>
            <th class="px-5 py-3 font-bold">Plan</th>
            <th class="px-5 py-3 font-bold">Sede de registro</th>
            <th class="px-5 py-3 font-bold">Estado</th>
            <th class="px-5 py-3 text-right font-bold">Vence</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="member in paged"
            :key="member.id"
            class="border-t border-stroke"
          >
            <td class="px-5 py-3">
              <div class="flex items-center gap-3">
                <img
                  :src="member.photoUrl"
                  :alt="member.name"
                  class="h-9 w-9 rounded-full border border-stroke object-cover"
                />
                <div>
                  <button
                    class="cursor-pointer text-xs font-bold text-text-primary transition hover:text-accent hover:underline"
                    @click="navigateTo(`/socios/${member.id}`)"
                  >
                    {{ member.name }}
                  </button>
                  <p class="font-mono text-[10px] text-text-dim">
                    {{ member.memberNumber }}
                  </p>
                </div>
              </div>
            </td>
            <td class="px-5 py-3">
              <UBadge
                :color="planColor(member.membershipType)"
                variant="subtle"
                size="sm"
                :label="member.membershipType"
              />
            </td>
            <td class="px-5 py-3">
              <button
                :disabled="!canViewBranches"
                class="rounded-full border border-stroke bg-base px-2.5 py-0.5 text-[10px] font-bold text-text-muted transition"
                :class="
                  canViewBranches
                    ? 'cursor-pointer hover:border-accent hover:text-accent'
                    : 'cursor-default'
                "
                @click="canViewBranches && navigateTo(`/sedes/${member.branchId}`)"
              >
                {{ branchName(member.branchId) }}
              </button>
            </td>
            <td class="px-5 py-3">
              <span
                class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
                :class="statusMeta(member.adminStatus).cls"
              >
                {{ statusMeta(member.adminStatus).label }}
              </span>
            </td>
            <td
              class="px-5 py-3 text-right font-mono text-[10px] text-text-dim"
            >
              {{ formatDate(member.membershipUntil) }}
            </td>
          </tr>
        </tbody>
      </table>
      <p
        v-if="!pending && filtered.length === 0"
        class="py-8 text-center text-xs font-semibold text-text-dim"
      >
        Sin socios que coincidan con el filtro
      </p>
      <div
        v-if="filtered.length > 0"
        class="flex items-center justify-between border-t border-stroke px-5 py-2.5"
      >
        <p class="text-[10px] font-semibold text-text-dim">
          {{ filtered.length }} socios · página {{ page }} de {{ pageCount }}
        </p>
        <div class="flex gap-1.5">
          <button
            class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-stroke text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-30"
            :disabled="page === 1"
            @click="page--"
          >
            <ChevronLeft class="h-3.5 w-3.5" />
          </button>
          <button
            class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-stroke text-text-muted transition hover:border-accent hover:text-accent disabled:opacity-30"
            :disabled="page === pageCount"
            @click="page++"
          >
            <ChevronRight class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
