<script setup lang="ts">
import { Dumbbell } from '@lucide/vue';

definePageMeta({ layout: false });

const { login } = useAuth();

const email = ref('recepcion@capitalfitness.bo');
const password = ref('demo1234');
const role = ref<StaffRole>('RECEPTIONIST');
const errorMessage = ref<string | null>(null);
const submitting = ref(false);

async function submit(): Promise<void> {
  errorMessage.value = null;
  submitting.value = true;
  try {
    await login(email.value, password.value, role.value);
    await navigateTo(homeFor(role.value));
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : 'No se pudo iniciar sesión';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-base px-4">
    <div class="w-full max-w-sm rounded-2xl border border-stroke bg-surface p-8">
      <div class="flex flex-col items-center gap-3 text-center">
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
          <Dumbbell class="h-7 w-7 text-base" />
        </div>
        <div>
          <h1 class="text-lg font-black tracking-tight text-text-primary">
            CAPITAL FITNESS
          </h1>
          <p class="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-text-dim">
            Panel B2B · Recepción
          </p>
        </div>
      </div>

      <form class="mt-8 space-y-4" @submit.prevent="submit()">
        <div>
          <label
            for="email"
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Email corporativo
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            class="mt-1.5 w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition focus:border-accent"
          />
        </div>
        <div>
          <label
            for="password"
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Contraseña
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="mt-1.5 w-full rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition focus:border-accent"
          />
        </div>

        <div>
          <label
            for="role"
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Perfil (demo)
          </label>
          <select
            id="role"
            v-model="role"
            class="mt-1.5 w-full cursor-pointer rounded-xl border border-stroke bg-base px-4 py-2.5 text-sm text-text-primary outline-none transition focus:border-accent"
          >
            <option value="ADMIN">Admin global</option>
            <option value="MANAGER">Gerente de sede</option>
            <option value="RECEPTIONIST">Recepcionista</option>
          </select>
        </div>

        <p
          v-if="errorMessage"
          class="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-xs font-bold text-red-400"
        >
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full rounded-xl bg-accent py-2.5 text-sm font-black text-base transition hover:brightness-110 disabled:opacity-50"
        >
          {{ submitting ? 'Ingresando…' : 'Ingresar al panel' }}
        </button>

        <p class="text-center text-[10px] leading-relaxed text-text-dim">
          Modo demo: cualquier email válido y contraseña de 4+ caracteres. Al configurar
          Firebase Auth la validación es real.
        </p>
      </form>
    </div>
  </div>
</template>
