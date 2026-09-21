<script setup lang="ts">
import { Building2, Crown, TrendingUp, Users } from '@lucide/vue';

import type { MemberAdmin, MembershipPlan } from '#shared/types';

const plans = ref<MembershipPlan[]>([]);
const members = ref<MemberAdmin[]>([]);
const pending = ref(true);

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
  [...plans.value].sort((a, b) => a.priceBs - b.priceBs),
);

const activeMembers = computed(() =>
  members.value.filter((m) => m.membershipStatus === 'ACTIVE'),
);

function membersOnPlan(planName: string): number {
  return members.value.filter((m) => m.membershipType === planName).length;
}

function planRevenue(plan: MembershipPlan): number {
  return membersOnPlan(plan.name) * plan.priceBs;
}

const totalRevenue = computed(() =>
  plans.value.reduce((sum, plan) => sum + planRevenue(plan), 0),
);

const topPlan = computed(() => {
  let best: MembershipPlan | null = null;
  let bestCount = 0;
  for (const plan of plans.value) {
    const count = membersOnPlan(plan.name);
    if (count > bestCount) {
      best = plan;
      bestCount = count;
    }
  }
  return best ? { name: best.name, count: bestCount } : null;
});

function planColor(plan: MembershipPlan): 'primary' | 'info' | 'neutral' {
  if (plan.level === 'BLACK') return 'primary';
  if (plan.level === 'PLUS') return 'info';
  return 'neutral';
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <Crown class="h-4 w-4 text-accent" />
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Planes activos
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ plans.length }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <Users class="h-4 w-4 text-accent" />
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Socios con membresía
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ activeMembers.length }}
          <span class="text-[11px] font-bold text-text-dim">
            / {{ members.length }}
          </span>
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <TrendingUp class="h-4 w-4 text-accent" />
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Ingreso mensual estimado
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          Bs {{ totalRevenue }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <Building2 class="h-4 w-4 text-accent" />
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Plan más popular
          </p>
        </div>
        <p class="mt-2 truncate text-xl font-black text-text-primary">
          {{ topPlan?.name ?? '—' }}
        </p>
        <p v-if="topPlan" class="text-[10px] font-semibold text-text-dim">
          {{ topPlan.count }} socios
        </p>
      </div>
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
              v-for="plan in sortedPlans"
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
                  Bs {{ plan.priceBs }}
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
                Bs {{ planRevenue(plan) }}
              </td>
              <td class="px-5 py-3 text-right text-[11px] text-text-muted">
                {{ plan.features.length }} beneficios
              </td>
            </tr>
          </tbody>
        </table>
        <p
          v-if="!pending && plans.length === 0"
          class="py-8 text-center text-xs font-semibold text-text-dim"
        >
          Sin planes configurados
        </p>
      </div>

    </section>
  </div>
</template>
