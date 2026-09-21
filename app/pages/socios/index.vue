<script setup lang="ts">
import { h, resolveComponent } from 'vue';
import type { Branch, MemberAdmin } from '#shared/types';

const UBadge = resolveComponent('UBadge');

const members = ref<MemberAdmin[]>([]);
const branches = ref<Branch[]>([]);
const pending = ref(true);
const search = ref('');
const selectedBranch = ref('todas');
const pagination = ref({ pageIndex: 0, pageSize: 8 });
const page = ref(1);
const pageSize = 8;

onMounted(async () => {
  try {
    const [memberList, branchList] = await Promise.all([
      $fetch<MemberAdmin[]>('/api/members'),
      $fetch<Branch[]>('/api/branches'),
    ]);
    members.value = memberList;
    branches.value = branchList;
  } finally {
    pending.value = false;
  }
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return members.value.filter(
    (m) =>
      (selectedBranch.value === 'todas' ||
        m.branchId === selectedBranch.value ||
        m.allBranchesAccess) &&
      (!q ||
        m.name.toLowerCase().includes(q) ||
        m.memberNumber.toLowerCase().includes(q)),
  );
});

function branchName(branchId: string): string {
  return branches.value.find((b) => b.id === branchId)?.name ?? '—';
}

const pageCount = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / pageSize)),
);

const paged = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize),
);

watch([search, selectedBranch], () => {
  page.value = 1;
});

function statusMeta(status: MemberAdmin['adminStatus']) {
  switch (status) {
    case 'EXPIRING':
      return { label: 'POR VENCER', color: 'warning' as const };
    case 'EXPIRED':
      return { label: 'VENCIDA', color: 'error' as const };
    default:
      return { label: 'ACTIVA', color: 'success' as const };
  }
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const columns = [
  {
    accessorKey: 'name',
    header: 'Socio',
    cell: ({ row }: any) => {
      const m = row.original;
      return h('div', { class: 'flex items-center gap-3' }, [
        h('img', {
          src: m.photoUrl,
          alt: m.name,
          class: 'h-9 w-9 rounded-full border border-stroke object-cover',
        }),
        h('div', {}, [
          h(
            'button',
            {
              class:
                'cursor-pointer text-left text-sm font-bold text-text-primary transition hover:text-accent hover:underline',
              onClick: () => navigateTo(`/socios/${m.id}`),
            },
            m.name,
          ),
          h(
            'p',
            { class: 'font-mono text-[10px] text-text-dim' },
            m.memberNumber,
          ),
        ]),
      ]);
    },
  },
  {
    accessorKey: 'membershipType',
    header: 'Plan',
    cell: ({ row }: any) => {
      const m = row.original;
      const color =
        m.membershipLevel === 'BLACK'
          ? 'primary'
          : m.membershipLevel === 'PLUS'
            ? 'info'
            : 'neutral';
      return h(
        UBadge,
        { color, variant: 'subtle', size: 'sm' },
        () => m.membershipType,
      );
    },
  },
  {
    accessorKey: 'branchId',
    header: 'Sede de registro',
    cell: ({ row }: any) => {
      const m = row.original;
      return h(
        'button',
        {
          class:
            'cursor-pointer rounded-full border border-stroke bg-base px-2.5 py-0.5 text-[10px] font-bold text-text-muted transition hover:border-accent hover:text-accent',
          onClick: () => navigateTo(`/sedes/${m.branchId}`),
        },
        branchName(m.branchId),
      );
    },
  },
  {
    accessorKey: 'adminStatus',
    header: 'Estado',
    cell: ({ row }: any) => {
      const meta = statusMeta(row.original.adminStatus);
      return h(
        UBadge,
        { color: meta.color, variant: 'subtle' },
        () => meta.label,
      );
    },
  },
  {
    accessorKey: 'membershipUntil',
    header: 'Vence',
    cell: ({ row }: any) =>
      h('span', { class: 'text-[11px] text-text-dim' }, formatDate(row.original.membershipUntil)),
  },
];
</script>

<template>
  <div class="space-y-6">
    <section>
      <h2
        class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted"
      >
        Filtrar por sede
      </h2>
      <div class="flex flex-wrap gap-2">
        <button
          class="rounded-full border px-4 py-1.5 text-xs font-bold transition"
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
          class="rounded-full border px-4 py-1.5 text-xs font-bold transition"
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
      <span
        class="ml-auto rounded-full border border-stroke bg-surface px-3 py-1 text-[11px] font-bold text-text-muted"
      >
        {{ filtered.length }} socios
      </span>
    </div>

    <UTable
      v-model:pagination="pagination"
      :data="paged"
      :columns="columns"
      :loading="pending"
      :ui="{
        th: 'text-text-dim text-[10px] uppercase tracking-widest',
        td: 'text-text-primary',
      }"
    />

    <div class="flex justify-end">
      <UPagination
        :page="pagination.pageIndex + 1"
        :items-per-page="pagination.pageSize"
        :total="filtered.length"
        @update:page="(p: number) => (pagination.pageIndex = p - 1)"
      />
    </div>
  </div>
</template>
