<script setup lang="ts">
import {
  BarChart3,
  Bell,
  CalendarDays,
  CreditCard,
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

const route = useRoute();
const { session, logout } = useAuth();

const logoutConfirmOpen = ref(false);

const navGroups = [
  {
    label: null,
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/recepcion', label: 'Recepción', icon: ScanLine },
    ],
  },
  {
    label: 'Operación',
    items: [
      { to: '/sedes', label: 'Sedes', icon: MapPin },
      { to: '/clases', label: 'Clases', icon: CalendarDays },
      { to: '/entrenadores', label: 'Entrenadores', icon: Medal },
    ],
  },
  {
    label: 'Miembros',
    items: [
      { to: '/socios', label: 'Socios', icon: Users },
      { to: '/membresias', label: 'Membresías', icon: CreditCard },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { to: '/publicidad', label: 'Publicidad', icon: Handshake },
      { to: '/cms', label: 'CMS & Push', icon: Megaphone },
      { to: '/reportes', label: 'Reportes', icon: BarChart3 },
    ],
  },
];

const navItems = navGroups.flatMap((group) => group.items);

const pageTitle = computed(() => {
  const item = navItems.find(
    (item) =>
      route.path === item.to ||
      (item.to !== '/' && route.path.startsWith(`${item.to}/`)),
  );
  return item?.label ?? 'Capital Fitness B2B';
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
          <p class="text-sm font-black tracking-wide text-text-primary">CAPITAL FITNESS</p>
          <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-text-dim">
            Panel B2B
          </p>
        </div>
      </div>

      <nav class="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        <div v-for="group in navGroups" :key="group.label ?? 'main'">
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
            Sede: Select
          </span>
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
  </div>
</template>
