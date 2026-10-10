<script setup lang="ts">
import {
  Bell,
  Check,
  Dumbbell,
  Hourglass,
  Mail,
  RefreshCcw,
} from '@lucide/vue';

definePageMeta({ layout: false });
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-base px-4">
    <div
      class="w-full max-w-md rounded-2xl border border-stroke bg-surface p-8 text-center"
    >
      <div
        class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15"
      >
        <Check class="h-7 w-7 text-emerald-400" />
      </div>
      <h1 class="mt-4 text-xl font-black tracking-tight text-text-primary">
        ¡Pago recibido!
      </h1>
      <p class="mt-2 text-sm leading-relaxed text-text-muted">
        Tu anuncio entró a revisión. El equipo del gimnasio lo revisa antes de
        publicarlo y te avisaremos por correo cuando quede en vivo.
      </p>

      <div class="mt-6 space-y-2.5 text-left">
        <div class="flex items-start gap-3">
          <Hourglass class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p class="text-xs font-semibold leading-snug text-text-muted">
            La revisión suele tomar menos de 48 horas — tu vigencia empieza a
            contar cuando el anuncio se publica, no desde hoy.
          </p>
        </div>
        <div class="flex items-start gap-3">
          <Bell class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p class="text-xs font-semibold leading-snug text-text-muted">
            El día que se publique, todos los socios recibirán tu oferta
            como notificación en su celular — va incluida en tu compra.
          </p>
        </div>
        <div class="flex items-start gap-3">
          <RefreshCcw class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p class="text-xs font-semibold leading-snug text-text-muted">
            Si el anuncio no se aprueba, tu pago se reembolsa automáticamente a
            la misma tarjeta.
          </p>
        </div>
        <div class="flex items-start gap-3">
          <Mail class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p class="text-xs font-semibold leading-snug text-text-muted">
            Te llegó un correo de confirmación con el detalle de tu compra.
          </p>
        </div>
      </div>

      <p
        class="mt-8 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-text-dim"
      >
        <Dumbbell class="h-3 w-3" />
        Operado con RIR-HUB
      </p>
    </div>
  </div>
</template>
