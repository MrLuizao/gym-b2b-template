<script setup lang="ts">
import { Crown, Layers, Plus, Users } from '@lucide/vue';

import type { MemberAdmin, MembershipPlan } from '#shared/types';

const { session } = useAuth();
/// Los planes y sus precios son datos globales — solo el admin los crea/edita.
const isAdmin = computed(() => session.value?.role === 'ADMIN');

const plans = ref<MembershipPlan[]>([]);
const members = ref<MemberAdmin[]>([]);
const pending = ref(true);

onMounted(async () => {
  try {
    const [planList, memberList] = await Promise.all([
      $api<MembershipPlan[]>('/api/plans'),
      $api<MemberAdmin[]>('/api/members'),
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

function membersOnPlan(planId: string): number {
  return members.value.filter((m) => m.membershipPlanId === planId).length;
}

function planRevenue(plan: MembershipPlan): number {
  return membersOnPlan(plan.id) * plan.price;
}

const totalMembers = computed(() =>
  plans.value.reduce((sum, p) => sum + membersOnPlan(p.id), 0),
);

const totalRevenue = computed(() =>
  plans.value.reduce((sum, p) => sum + planRevenue(p), 0),
);

const multiBranchPlans = computed(
  () => plans.value.filter((p) => p.allBranches).length,
);
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <Layers class="h-4 w-4 text-accent" />
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Planes
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ plans.length }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <Users class="h-4 w-4 text-text-muted" />
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Socios
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          {{ totalMembers }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <Crown class="h-4 w-4 text-accent" />
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Ingreso mensual
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-text-primary">
          $ {{ totalRevenue }}
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4">
        <div class="flex items-center gap-2">
          <Layers class="h-4 w-4 text-sky-400" />
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Multi-sede
          </p>
        </div>
        <p class="mt-2 text-xl font-black text-sky-400">
          {{ multiBranchPlans }}
        </p>
        <p class="text-[10px] font-semibold text-text-dim">
          planes con acceso a todas las sedes
        </p>
      </div>
    </div>

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2
          class="text-sm font-black uppercase tracking-widest text-text-muted"
        >
          Catálogo de planes
        </h2>
        <button
          v-if="isAdmin"
          class="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[11px] font-black text-base transition hover:opacity-90"
          @click="navigateTo('/membresias/nuevo')"
        >
          <Plus class="h-3.5 w-3.5" />
          Nueva membresía
        </button>
      </div>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left">
          <thead>
            <tr
              class="border-b border-stroke text-[10px] uppercase tracking-widest text-text-dim"
            >
              <th class="px-5 py-3 font-bold">Plan</th>
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
          v-if="!pending && sortedPlans.length === 0"
          class="py-8 text-center text-xs font-semibold text-text-dim"
        >
          Sin planes configurados
        </p>
      </div>
    </section>
  </div>
</template>
