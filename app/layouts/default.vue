<script setup lang="ts">
import {
  BarChart3,
  Bell,
  CalendarDays,
  CreditCard,
  DoorClosed,
  Dumbbell,
  Handshake,
  LayoutDashboard,
  LogOut,
  MapPin,
  Medal,
  Megaphone,
  ScanLine,
  Users,
} from '@lucide/vue';
import type { Component } from 'vue';
import type { Branch } from '#shared/types';
import type { StaffRole } from '~/composables/useAuth';

const route = useRoute();
const { session, logout } = useAuth();

const logoutConfirmOpen = ref(false);

/// Cierre de sede desde el header — final del día: archiva los check-ins
/// abiertos de la sede a dailyStats y resetea su aforo a 0. Cualquier
/// rol puede cerrar; admin elige sede, staff opera la suya.
const closeDayOpen = ref(false);
const closingDay = ref(false);
const closeDayError = ref<string | null>(null);
const closeDayDone = ref<string | null>(null);
const closeBranches = ref<Branch[]>([]);
const closeBranchId = ref('');
const { closeDay } = useCloseDay();

const isAdmin = computed(() => session.value?.role === 'ADMIN');
const closeBranchItems = computed(() =>
  closeBranches.value.map((b) => ({ label: b.name, value: b.id })),
);

async function openCloseDay(): Promise<void> {
  closeDayError.value = null;
  closeBranchId.value = session.value?.branchId ?? '';
  if (isAdmin.value && closeBranches.value.length === 0) {
    try {
      closeBranches.value = await $api<Branch[]>('/api/branches');
    } catch {
      closeBranches.value = [];
    }
    closeBranchId.value =
      closeBranchId.value || closeBranches.value[0]?.id || '';
  }
  closeDayOpen.value = true;
}

async function confirmCloseDay(): Promise<void> {
  if (!closeBranchId.value || closingDay.value) return;
  closingDay.value = true;
  closeDayError.value = null;
  try {
    const swept = await closeDay(closeBranchId.value);
    closeDayOpen.value = false;
    closeDayDone.value =
      swept === 0
        ? 'Aforo en 0 — no había check-ins por archivar'
        : `Sede cerrada — ${swept} check-in${swept === 1 ? '' : 's'} archivado${swept === 1 ? '' : 's'} y aforo en 0`;
    setTimeout(() => (closeDayDone.value = null), 6000);
  } catch (cause) {
    closeDayError.value =
      cause instanceof Error ? cause.message : 'No se pudo cerrar la sede';
  } finally {
    closingDay.value = false;
  }
}

type NavItem = {
  to: string;
  label: string;
  icon: Component;
  roles: StaffRole[];
};

const navGroups: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      {
        to: '/',
        label: 'Dashboard',
        icon: LayoutDashboard,
        roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
      },
      {
        to: '/recepcion',
        label: 'Recepción',
        icon: ScanLine,
        roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
      },
    ],
  },
  {
    label: 'Operación',
    items: [
      {
        to: '/sedes',
        label: 'Sedes',
        icon: MapPin,
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        to: '/clases',
        label: 'Clases',
        icon: CalendarDays,
        roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
      },
      {
        to: '/entrenadores',
        label: 'Entrenadores',
        icon: Medal,
        roles: ['ADMIN', 'MANAGER'],
      },
    ],
  },
  {
    label: 'Miembros',
    items: [
      {
        to: '/socios',
        label: 'Socios',
        icon: Users,
        roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
      },
      {
        to: '/membresias',
        label: 'Membresías',
        icon: CreditCard,
        // Recepción ve el catálogo (read-only) para cotizar altas.
        roles: ['ADMIN', 'MANAGER', 'RECEPTIONIST'],
      },
    ],
  },
  {
    label: 'Comercial',
    items: [
      {
        to: '/publicidad',
        label: 'Publicidad',
        icon: Handshake,
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        to: '/cms',
        label: 'CMS & Push',
        icon: Megaphone,
        roles: ['ADMIN', 'MANAGER'],
      },
      {
        to: '/reportes',
        label: 'Reportes',
        icon: BarChart3,
        roles: ['ADMIN', 'MANAGER'],
      },
    ],
  },
];

const visibleGroups = computed(() =>
  navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.roles.includes(session.value?.role ?? 'RECEPTIONIST'),
      ),
    }))
    .filter((group) => group.items.length > 0),
);

const navItems = navGroups.flatMap((group) => group.items);

const pageTitle = computed(() => {
  const item = navItems.find(
    (item) =>
      route.path === item.to ||
      (item.to !== '/' && route.path.startsWith(`${item.to}/`)),
  );
  return item?.label ?? 'RIR-HUB';
});
</script>

<template>
  <div class="min-h-screen bg-base">
    <aside
      class="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-stroke bg-surface md:flex"
    >
      <div class="flex items-center gap-3 border-b border-stroke px-6 py-5">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
          <Dumbbell class="h-5 w-5 text-base" />
        </div>
        <div>
          <p class="text-sm font-black tracking-wide text-text-primary">RIR-HUB</p>
          <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-text-dim">
            B2B & DMS
          </p>
        </div>
      </div>

      <nav class="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        <div v-for="group in visibleGroups" :key="group.label ?? 'main'">
          <p
            v-if="group.label"
            class="mb-1.5 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-text-dim"
          >
            {{ group.label }}
          </p>
          <div class="space-y-1">
            <NuxtLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition"
              :class="
                route.path === item.to
                  ? 'bg-accent/10 text-text-primary'
                  : 'text-text-muted hover:bg-white/5 hover:text-text-primary'
              "
            >
              <span
                class="h-4 w-1 rounded-full"
                :class="route.path === item.to ? 'bg-accent' : 'bg-transparent'"
              />
              <component :is="item.icon" class="h-4 w-4" />
              {{ item.label }}
            </NuxtLink>
          </div>
        </div>
      </nav>

      <div class="border-t border-stroke px-4 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-[11px] font-black text-accent">
            {{ (session?.name ?? 'ST').slice(0, 2).toUpperCase() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs font-bold text-text-primary">{{ session?.name }}</p>
            <p class="truncate text-[10px] text-text-dim">{{ session?.email }}</p>
          </div>
          <button
            class="rounded-lg p-1.5 text-text-dim transition hover:bg-white/5 hover:text-accent"
            title="Cerrar sesión"
            @click="logoutConfirmOpen = true"
          >
            <LogOut class="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>

    <div class="flex min-h-screen flex-col md:pl-60">
      <header
        class="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-stroke bg-surface/90 px-6 backdrop-blur"
      >
        <h1 class="text-base font-black tracking-tight text-text-primary">{{ pageTitle }}</h1>
        <div class="ml-auto flex items-center gap-3">
          <span
            class="hidden rounded-full border border-stroke bg-base px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-text-muted sm:inline-block"
          >
            {{ ROLE_LABELS[session?.role ?? 'RECEPTIONIST']
            }}{{ session?.branchName ? ` · ${session.branchName}` : '' }}
          </span>
          <button
            class="flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-400/10 px-3.5 py-2 text-[10px] font-black uppercase tracking-widest text-red-400 transition hover:bg-red-400/20"
            :title="
              isAdmin
                ? 'Cierre de día — eliges qué sede cerrar'
                : `Cierre de día de ${session?.branchName ?? 'tu sede'} — archiva check-ins y resetea el aforo`
            "
            @click="openCloseDay"
          >
            <DoorClosed class="h-4 w-4" />
            <span class="hidden sm:inline">Cerrar sede</span>
          </button>
          <!-- Avisos y avatar ocultos por ahora — sin uso real todavía.
          <button
            class="relative rounded-full border border-stroke bg-white/5 p-2 text-text-muted transition hover:text-text-primary"
            title="Avisos"
          >
            <Bell class="h-4 w-4" />
            <span
              class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent"
            />
          </button>
          <div
            class="flex h-9 w-9 items-center justify-center rounded-full border border-stroke bg-white/5 text-xs font-black text-text-primary"
          >
            {{ (session?.name ?? 'ST').slice(0, 2).toUpperCase() }}
          </div>
          -->

        </div>
      </header>

      <main class="flex-1 px-6 py-6 lg:px-8">
        <slot />
      </main>
    </div>

    <UModal
      v-model:open="logoutConfirmOpen"
      title="Cerrar sesión"
      description="Saldrás del panel y tendrás que ingresar tus credenciales de nuevo."
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="logoutConfirmOpen = false"
          />
          <UButton
            label="Cerrar sesión"
            icon="i-lucide-log-out"
            color="error"
            @click="logout()"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="closeDayOpen"
      title="Cerrar sede"
      description="Se archivan los check-ins abiertos en las estadísticas del día y el aforo queda en 0."
    >
      <template #body>
        <template v-if="isAdmin">
          <p class="mb-3 text-[11px] font-semibold text-text-muted">
            Como admin global no tienes sede fija — elige cuál cerrar. El
            gerente o recepcionista de cada sede también puede hacerlo desde
            su propio botón.
          </p>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Sede a cerrar</span
            >
            <USelectMenu
              v-model="closeBranchId"
              :items="closeBranchItems"
              value-key="value"
              class="mt-1 w-full"
            />
          </label>
        </template>
        <p v-else class="text-sm font-bold text-text-primary">
          {{ session?.branchName ?? 'Tu sede' }}
        </p>
      </template>
      <template #footer>
        <p
          v-if="closeDayError"
          class="w-full text-left text-[11px] font-bold text-red-400"
        >
          {{ closeDayError }}
        </p>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="closeDayOpen = false"
          />
          <UButton
            label="Cerrar sede"
            icon="i-lucide-door-closed"
            color="error"
            :loading="closingDay"
            :disabled="!closeBranchId"
            @click="confirmCloseDay"
          />
        </div>
      </template>
    </UModal>

    <div
      v-if="closeDayDone"
      class="fixed bottom-5 right-5 z-50 rounded-xl border border-emerald-400/30 bg-surface px-4 py-3 text-xs font-bold text-emerald-400 shadow-2xl"
    >
      {{ closeDayDone }}
    </div>
  </div>
</template>
