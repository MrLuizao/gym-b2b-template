<script setup lang="ts">
import { Crown, Layers, Medal, Star } from '@lucide/vue';

import type { MemberAdmin, MembershipLevel, MembershipPlan } from '#shared/types';

const plans = ref<MembershipPlan[]>([]);
const members = ref<MemberAdmin[]>([]);
const pending = ref(true);

const levelFilter = ref<MembershipLevel | 'todos'>('todos');

onMounted(async () => {
  try {
    const [planList, memberList] = await Promise.all([
      $fetch<MembershipPlan[]>('/api/plans'),
      $fetch<MemberAdmin[]>('/api/members'),
    ]);
    plans.value = planList;
    members.value = memberList;
  } finally {
    pending.value = false;
  }
});

const sortedPlans = computed(() =>
  [...plans.value].sort((a, b) => a.price - b.price),
);

const filteredPlans = computed(() =>
  levelFilter.value === 'todos'
    ? sortedPlans.value
    : sortedPlans.value.filter((p) => p.level === levelFilter.value),
);

function membersOnPlan(planName: string): number {
  return members.value.filter((m) => m.membershipType === planName).length;
}

function planRevenue(plan: MembershipPlan): number {
  return membersOnPlan(plan.name) * plan.price;
}

function levelStats(level: MembershipLevel | 'todos') {
  const list =
    level === 'todos'
      ? plans.value
      : plans.value.filter((p) => p.level === level);
  return {
    plans: list.length,
    members: list.reduce((sum, p) => sum + membersOnPlan(p.name), 0),
    revenue: list.reduce((sum, p) => sum + planRevenue(p), 0),
  };
}

function toggleLevelFilter(level: MembershipLevel | 'todos'): void {
  levelFilter.value = levelFilter.value === level ? 'todos' : level;
}

function planColor(plan: MembershipPlan): 'primary' | 'info' | 'neutral' {
  if (plan.level === 'BLACK') return 'primary';
  if (plan.level === 'PLUS') return 'info';
  return 'neutral';
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          levelFilter === 'todos'
            ? 'border-accent bg-accent/10'
            : 'border-stroke bg-surface hover:border-accent/50'
        "
        @click="toggleLevelFilter('todos')"
      >
        <div class="flex items-center gap-2">
          <Layers class="h-4 w-4 text-accent" />
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Todos los planes
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ levelStats('todos').plans }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          {{ levelStats('todos').members }} socios · $
          {{ levelStats('todos').revenue }}/mes
        </p>
      </button>
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          levelFilter === 'CLASSIC'
            ? 'border-white/50 bg-white/5'
            : 'border-stroke bg-surface hover:border-white/30'
        "
        @click="toggleLevelFilter('CLASSIC')"
      >
        <div class="flex items-center gap-2">
          <Medal class="h-4 w-4 text-text-muted" />
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Classic
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ levelStats('CLASSIC').plans }} planes
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          {{ levelStats('CLASSIC').members }} socios · $
          {{ levelStats('CLASSIC').revenue }}/mes
        </p>
      </button>
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          levelFilter === 'PLUS'
            ? 'border-sky-400 bg-sky-400/10'
            : 'border-stroke bg-surface hover:border-sky-400/50'
        "
        @click="toggleLevelFilter('PLUS')"
      >
        <div class="flex items-center gap-2">
          <Star class="h-4 w-4 text-sky-400" />
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Plus
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-sky-400">
          {{ levelStats('PLUS').plans }} planes
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          {{ levelStats('PLUS').members }} socios · $
          {{ levelStats('PLUS').revenue }}/mes
        </p>
      </button>
      <button
        class="cursor-pointer rounded-2xl border p-4 text-left transition"
        :class="
          levelFilter === 'BLACK'
            ? 'border-accent bg-accent/10'
            : 'border-stroke bg-surface hover:border-accent/50'
        "
        @click="toggleLevelFilter('BLACK')"
      >
        <div class="flex items-center gap-2">
          <Crown class="h-4 w-4 text-accent" />
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Black
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ levelStats('BLACK').plans }} planes
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          {{ levelStats('BLACK').members }} socios · $
          {{ levelStats('BLACK').revenue }}/mes
        </p>
      </button>
    </div>

    <section>
      <h2
        class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted"
      >
        Catálogo de planes
      </h2>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left">
          <thead>
            <tr
              class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
            >
              <th class="px-5 py-3 font-bold">Plan</th>
              <th class="px-5 py-3 font-bold">Nivel</th>
              <th class="px-5 py-3 font-bold">Precio</th>
              <th class="px-5 py-3 font-bold">Acceso a sedes</th>
              <th class="px-5 py-3 font-bold">Socios</th>
              <th class="px-5 py-3 font-bold">Ingreso/mes</th>
              <th class="px-5 py-3 text-right font-bold">Beneficios</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="plan in filteredPlans"
              :key="plan.id"
              class="border-t border-stroke"
              :class="plan.highlight ? 'bg-accent/5' : ''"
            >
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <button
                    class="cursor-pointer text-xs font-black text-text-primary transition hover:text-accent hover:underline"
                    @click="navigateTo(`/membresias/${plan.id}`)"
                  >
                    {{ plan.name }}
                  </button>
                  <span
                    v-if="plan.highlight"
                    class="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-black text-accent"
                  >
                    PREMIUM
                  </span>
                </div>
              </td>
              <td class="px-5 py-3">
                <UBadge
                  :color="planColor(plan)"
                  variant="subtle"
                  size="sm"
                  :label="plan.level"
                />
              </td>
              <td class="px-5 py-3">
                <span class="text-sm font-black text-text-primary">
                  $ {{ plan.price }}
                </span>
                <span class="text-[10px] font-bold text-text-dim">/mes</span>
              </td>
              <td class="px-5 py-3">
                <span
                  class="rounded-full border px-2.5 py-0.5 text-[10px] font-black"
                  :class="
                    plan.allBranches
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-stroke bg-base text-text-muted'
                  "
                >
                  {{ plan.allBranches ? 'Todas las sedes' : 'Sede de registro' }}
                </span>
              </td>
              <td class="px-5 py-3 text-sm font-bold text-text-primary">
                {{ membersOnPlan(plan.name) }}
              </td>
              <td class="px-5 py-3 text-sm font-black text-text-primary">
                $ {{ planRevenue(plan) }}
              </td>
              <td class="px-5 py-3 text-right text-[11px] text-text-muted">
                {{ plan.features.length }} beneficios
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="!pending && filteredPlans.length === 0"
          class="py-8 text-center text-xs font-semibold text-text-dim"
        >
          {{
            levelFilter === 'todos'
              ? 'Sin planes configurados'
              : 'Sin planes en este nivel'
          }}
        </p>
      </div>
    </section>
  </div>
</template>
