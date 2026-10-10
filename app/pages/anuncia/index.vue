<script setup lang="ts">
import {
  Bell,
  Building2,
  Check,

  Dumbbell,
  ImageUp,
  Loader2,
  Lock,
  ShieldCheck,
  TriangleAlert,
} from '@lucide/vue';

import type { AdSelfServeInfo, SponsorAd } from '#shared/types';

definePageMeta({ layout: false });

const route = useRoute();
const cancelled = computed(() => route.query.cancelado === '1');

const info = ref<AdSelfServeInfo | null>(null);
const pending = ref(true);
const loadError = ref(false);

const form = ref({
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  title: '',
  subtitle: '',
  badge: 'ALIADO',
  brandColor: '#f4e701',
  imageUrl: '',
  ctaLabel: 'Ver oferta',
  description: '',
  address: '',
  /// Pin del mapa — null hasta que se geocodifica la dirección o el
  /// usuario toca/arrastra el marcador.
  lat: null as number | null,
  lng: null as number | null,
  instagram: '',
  facebook: '',
  tiktok: '',
  website: '',
  whatsapp: '',
  otherUrl: '',
  photos: [] as string[],
  placement: 'carousel' as SponsorAd['placement'],
  weeks: 1,
  wantsPush: false,
  /// Honeypot — invisible para humanos, los bots lo llenan.
  company: '',
});

const formError = ref<string | null>(null);
const saving = ref(false);

/// True cuando el usuario movió el pin a mano — la auto-geocodificación
/// de la dirección deja de tocar lat/lng para no pisar su ajuste.
const pinTouched = ref(false);
const geocoding = ref(false);
let geocodeTimer: ReturnType<typeof setTimeout> | null = null;

/// Centro del mapa: la primera sede con coords; CDMX como último
/// recurso (los anuncios ya no se segmentan por sede).
const mapCenter = computed(() => {
  const branches = info.value?.branches ?? [];
  const c = branches.find((b) => b.lat != null && b.lng != null);
  return c && c.lat != null && c.lng != null
    ? { lat: c.lat, lng: c.lng }
    : { lat: 19.4326, lng: -99.1332 };
});

/// Ubicamos la dirección automáticamente ~1s después de que el usuario
/// deja de escribir — no depende de blur/TAB. Si ya movió el pin a mano
/// no se toca. Fallo silencioso: el mapa sigue permitiendo marcar a mano.
watch(
  () => form.value.address,
  () => {
    if (geocodeTimer) clearTimeout(geocodeTimer);
    if (pinTouched.value || form.value.address.trim().length < 8) return;
    geocodeTimer = setTimeout(geocodeDraft, 900);
  },
);

async function geocodeDraft(): Promise<void> {
  const q = form.value.address.trim();
  if (q.length < 8 || pinTouched.value) return;
  geocoding.value = true;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=mx`,
      { headers: { 'Accept-Language': 'es' } },
    );
    const results = (await res.json()) as { lat: string; lon: string }[];
    const first = results[0];
    if (first) {
      form.value.lat = Number(first.lat);
      form.value.lng = Number(first.lon);
    }
  } catch {
    /// El mapa queda para marcar a mano.
  } finally {
    geocoding.value = false;
  }
}

const slotLabels: Record<SponsorAd['placement'], string> = {
  carousel: 'Carrusel destacado',
  list: 'Directorio de Aliados',
};

const slotDescriptions: Record<SponsorAd['placement'], string> = {
  carousel:
    'Banner en la pantalla principal + primeros lugares del directorio Aliados',
  list: 'Tu negocio en el directorio que exploran los socios',
};

/// Ocupación del carrusel — el server cuenta ads ACTIVE + órdenes
/// pagadas en revisión. Lleno no bloquea la venta: el anuncio entra a
/// la lista y sube al carrusel cuando se libere lugar.
const carouselFull = computed(
  () =>
    (info.value?.carousel.occupied ?? 0) >=
    (info.value?.carousel.slots ?? 5),
);
const nextFreeLabel = computed(() => {
  const at = info.value?.carousel.nextFreeAt;
  if (!at) return null;
  return new Date(at).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
  });
});

/// Precio por semana, cobertura siempre nacional (todas las sedes) —
/// la segmentación por sede se eliminó: el anuncio lo ve toda la app.
/// El push es un cobro único adicional.
const weeklyPrice = computed(
  () => info.value?.slots[form.value.placement]?.pricePerWeek ?? 0,
);
const pushPrice = computed(() =>
  form.value.wantsPush &&
  info.value?.push.enabled &&
  (info.value?.push.count ?? 0) > 0
    ? (info.value?.push.price ?? 0)
    : 0,
);
const total = computed(
  () => weeklyPrice.value * form.value.weeks + pushPrice.value,
);

const preview = computed(() => ({
  imageUrl: form.value.imageUrl,
  badge: form.value.badge || 'ALIADO',
  advertiser: form.value.businessName || 'Tu negocio',
  title: form.value.title || 'Tu promoción',
  subtitle: form.value.subtitle,
  ctaLabel: form.value.ctaLabel || 'Ver oferta',
  brandColor: form.value.brandColor,
  placement: form.value.placement,
  description: form.value.description,
  address: form.value.address,
  phone: form.value.phone,
  socials: {
    instagram: form.value.instagram,
    facebook: form.value.facebook,
    tiktok: form.value.tiktok,
    website: form.value.website,
    whatsapp: form.value.whatsapp,
    other_url: form.value.otherUrl,
  },
  photos: form.value.photos,
}));

const imageWeight = computed(() =>
  imagePayloadChars(form.value.imageUrl, form.value.photos),
);

const missingFields = computed(() => {
  const f = form.value;
  const missing: string[] = [];
  if (!f.businessName.trim()) missing.push('nombre del negocio');
  if (!f.contactName.trim()) missing.push('contacto');
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) missing.push('email válido');
  if (!f.phone.trim()) missing.push('teléfono');
  if (!f.title.trim()) missing.push('título del anuncio');
  if (!f.subtitle.trim()) missing.push('subtítulo');
  if (!f.imageUrl) missing.push('imagen');
  if (!f.ctaLabel.trim()) missing.push('botón (CTA)');
  return missing;
});

async function pay(): Promise<void> {
  if (missingFields.value.length > 0) {
    formError.value = `Revisa el formulario — falta: ${missingFields.value.join(', ')}`;
    return;
  }
  if (imageWeight.value > DOC_IMAGE_LIMIT_CHARS) {
    formError.value =
      `Las imágenes pesan ${formatKb(imageWeight.value)} — el máximo es ~${formatKb(DOC_IMAGE_LIMIT_CHARS)}. ` +
      'Usa un JPG más ligero o de menor resolución.';
    return;
  }
  formError.value = null;
  saving.value = true;
  try {
    const res = await $fetch<{ checkoutUrl: string | null }>(
      '/api/ads/orders',
      {
        method: 'POST',
        body: {
          businessName: form.value.businessName.trim(),
          contactName: form.value.contactName.trim(),
          email: form.value.email.trim(),
          phone: form.value.phone.trim(),
          title: form.value.title.trim(),
          subtitle: form.value.subtitle.trim(),
          badge: form.value.badge.trim() || 'ALIADO',
          brandColor: hexToArgb(form.value.brandColor),
          imageUrl: form.value.imageUrl,
          ctaLabel: form.value.ctaLabel.trim() || 'Ver oferta',
          description: form.value.description.trim(),
          address: form.value.address.trim(),
          lat: form.value.lat,
          lng: form.value.lng,
          socials: {
            instagram: form.value.instagram.trim(),
            facebook: form.value.facebook.trim(),
            tiktok: form.value.tiktok.trim(),
            website: form.value.website.trim(),
            whatsapp: form.value.whatsapp.trim(),
            other_url: form.value.otherUrl.trim(),
          },
          photos: form.value.photos,
          placement: form.value.placement,
          weeks: form.value.weeks,
          wantsPush: form.value.wantsPush,
          company: form.value.company,
        },
      },
    );
    if (res.checkoutUrl) {
      window.location.href = res.checkoutUrl;
      return;
    }
    /// checkoutUrl null = honeypot disparado — nada que hacer.
    formError.value = 'No se pudo iniciar el pago — intenta de nuevo';
  } catch (cause) {
    formError.value =
      cause instanceof Error && 'statusMessage' in cause
        ? String(cause.statusMessage)
        : 'No se pudo iniciar el pago — intenta de nuevo';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    info.value = await $fetch<AdSelfServeInfo>('/api/ads/self-serve');
    /// Si el slot default está apagado, cae al primero que sí esté a la venta.
    if (info.value.slots.carousel.enabled === false) {
      const fallback = (['list'] as const).find(
        (s) => info.value!.slots[s]?.enabled !== false,
      );
      form.value.placement = fallback ?? 'carousel';
    }
  } catch {
    loadError.value = true;
  } finally {
    pending.value = false;
  }
});
</script>

<template>
  <div class="min-h-screen bg-base px-4 py-10">
    <div class="mx-auto max-w-5xl">
      <div
        v-if="pending"
        class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
      >
        <Loader2 class="mx-auto h-5 w-5 animate-spin text-accent" />
      </div>

      <div
        v-else-if="loadError || !info?.enabled"
        class="mx-auto max-w-lg rounded-2xl border border-stroke bg-surface p-10 text-center"
      >
        <div
          class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent"
        >
          <Dumbbell class="h-6 w-6 text-base" />
        </div>
        <h1 class="mt-4 text-lg font-black text-text-primary">
          Publicidad con {{ info?.brandName || 'RIR-HUB' }}
        </h1>
        <p class="mt-2 text-sm leading-relaxed text-text-muted">
          La venta directa de anuncios no está disponible por ahora. Acércate
          a recepción o a tu contacto comercial para anunciar tu negocio en la
          app de los socios.
        </p>
      </div>

      <template v-else>
        <div class="mb-8 text-center">
          <div
            class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent"
          >
            <Dumbbell class="h-6 w-6 text-base" />
          </div>
          <h1 class="mt-4 text-2xl font-black tracking-tight text-text-primary">
            Anuncia tu negocio en la app de {{ info.brandName }}
          </h1>
          <p
            class="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-text-muted"
          >
            Los socios de {{ info.brandName }} viven en la app — pon tu
            promoción frente a ellos. Subes tu anuncio, pagas en línea y el
            equipo lo revisa antes de publicarlo.
          </p>
          <p
            class="mx-auto mt-2 flex max-w-xl items-center justify-center gap-1.5 text-[11px] font-bold text-text-dim"
          >
            <ShieldCheck class="h-3.5 w-3.5 text-accent" />
            Si tu anuncio no se aprueba, tu pago se reembolsa automáticamente
          </p>
          <p
            v-if="cancelled"
            class="mx-auto mt-3 max-w-xl rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-[11px] font-bold text-amber-400"
          >
            El pago se canceló — puedes ajustar tu anuncio y volver a intentarlo.
          </p>
        </div>

        <div class="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
          <div class="space-y-6">
            <section class="rounded-2xl border border-stroke bg-surface p-5">
              <h2
                class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
              >
                <span class="h-4 w-1 rounded-full bg-accent" />
                Elige tu espacio
              </h2>
              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  v-for="slot in (['carousel', 'list'] as const)"
                  :key="slot"
                  type="button"
                  :disabled="info.slots[slot]?.enabled === false"
                  class="cursor-pointer rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-40"
                  :class="
                    form.placement === slot
                      ? 'border-accent bg-accent/10'
                      : 'border-stroke bg-base hover:border-accent/50'
                  "
                  @click="form.placement = slot"
                >
                  <div class="flex items-center justify-between gap-2">
                    <p class="text-xs font-black text-text-primary">
                      {{ slotLabels[slot] }}
                    </p>
                    <Check
                      v-if="form.placement === slot"
                      class="h-4 w-4 shrink-0 text-accent"
                    />
                  </div>
                  <p class="mt-1 text-[11px] leading-snug text-text-muted">
                    {{ slotDescriptions[slot] }}
                  </p>
                  <p class="mt-2 text-sm font-black text-accent">
                    ${{ info.slots[slot]?.pricePerWeek.toLocaleString('es-MX') }}
                    <span class="text-[10px] font-bold text-text-dim">
                      MXN/semana
                    </span>
                  </p>
                  <p
                    v-if="slot === 'carousel'"
                    class="mt-1 text-[10px] font-bold uppercase tracking-widest"
                    :class="carouselFull ? 'text-amber-400' : 'text-emerald-400'"
                  >
                    <template v-if="carouselFull">Espacios llenos</template>
                    <template v-else>
                      {{ info.carousel.slots - info.carousel.occupied }} de
                      {{ info.carousel.slots }} espacios libres
                    </template>
                  </p>
                  <p
                    v-else-if="slot === 'list'"
                    class="mt-1 text-[10px] font-bold uppercase tracking-widest text-text-dim"
                  >
                    Orden aleatorio — sin favoritismo
                  </p>
                  <p
                    v-if="info.slots[slot]?.enabled === false"
                    class="mt-1 text-[10px] font-bold uppercase tracking-widest text-text-dim"
                  >
                    No disponible
                  </p>
                </button>
              </div>

              <div
                v-if="form.placement === 'carousel' && carouselFull"
                class="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3"
              >
                <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p class="text-[11px] font-semibold leading-relaxed text-amber-300">
                  Los {{ info.carousel.slots }} espacios del carrusel están
                  ocupados. Tu anuncio aparecerá en el directorio de Aliados
                  desde la aprobación y subirá al carrusel cuando se libere el
                  próximo espacio<template v-if="nextFreeLabel">
                    (aprox. el {{ nextFreeLabel }})</template
                  >.
                </p>
              </div>

              <div
                class="mt-3 flex items-center gap-2.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3"
              >
                <Bell class="h-4 w-4 shrink-0 text-emerald-400" />
                <p class="text-[11px] font-bold leading-snug text-emerald-300">
                  Tu compra incluye 1 notificación push
                  <span class="text-emerald-400">GRATIS</span> a todos los
                  socios el día que se publique tu anuncio.
                </p>
              </div>

              <div v-if="info.push.enabled && info.push.count > 0" class="mt-4">
                <p
                  class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >
                  ¿Cuántos pushes quieres? *
                </p>
                <div class="mt-2 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    class="cursor-pointer rounded-2xl border p-4 text-left transition"
                    :class="
                      !form.wantsPush
                        ? 'border-accent bg-accent/10'
                        : 'border-stroke bg-base hover:border-accent/50'
                    "
                    @click="form.wantsPush = false"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-xs font-black text-text-primary">
                        Solo el incluido
                      </p>
                      <Check
                        v-if="!form.wantsPush"
                        class="h-4 w-4 shrink-0 text-accent"
                      />
                    </div>
                    <p class="mt-1 text-[11px] leading-snug text-text-muted">
                      1 notificación a todos los socios el día que se publique
                      tu anuncio.
                    </p>
                    <p class="mt-2 text-sm font-black text-emerald-400">
                      $0
                      <span class="text-[10px] font-bold text-text-dim">
                        incluido
                      </span>
                    </p>
                  </button>
                  <button
                    type="button"
                    class="cursor-pointer rounded-2xl border p-4 text-left transition"
                    :class="
                      form.wantsPush
                        ? 'border-accent bg-accent/10'
                        : 'border-stroke bg-base hover:border-accent/50'
                    "
                    @click="form.wantsPush = true"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-xs font-black text-text-primary">
                        Paquete de {{ info.push.count }} pushes
                      </p>
                      <Check
                        v-if="form.wantsPush"
                        class="h-4 w-4 shrink-0 text-accent"
                      />
                    </div>
                    <p class="mt-1 text-[11px] leading-snug text-text-muted">
                      Además del incluido: 1 notificación por semana al celular
                      de todos los socios.
                    </p>
                    <p class="mt-2 text-sm font-black text-accent">
                      +${{ info.push.price.toLocaleString('es-MX') }}
                      <span class="text-[10px] font-bold text-text-dim">
                        MXN · cobro único
                      </span>
                    </p>
                  </button>
                </div>
              </div>

              <div class="mt-4 grid grid-cols-2 gap-3">
                <label class="block">
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                    >Duración</span
                  >
                  <USelectMenu
                    v-model="form.weeks"
                    :items="
                      [1, 2, 4].map((w) => ({
                        label: `${w} semana${w > 1 ? 's' : ''}`,
                        value: w,
                      }))
                    "
                    value-key="value"
                    class="mt-1 w-full"
                  />
                </label>
              </div>

              <div
                class="mt-4 flex items-center justify-between rounded-xl border border-accent/30 bg-accent/10 px-4 py-3"
              >
                <p class="text-[11px] font-bold text-text-muted">
                  {{ slotLabels[form.placement] }} ·
                  {{ form.weeks }} semana{{ form.weeks > 1 ? 's' : '' }} ·
                  todas las sedes<template v-if="pushPrice > 0">
                    + paquete push</template
                  >
                </p>
                <p class="text-lg font-black text-accent">
                  ${{ total.toLocaleString('es-MX') }}
                  <span class="text-[10px] font-bold text-text-dim">MXN</span>
                </p>
              </div>
            </section>

            <section class="rounded-2xl border border-stroke bg-surface p-5">
              <h2
                class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
              >
                <span class="h-4 w-1 rounded-full bg-accent" />
                Datos del negocio
              </h2>
              <div class="mt-4 grid grid-cols-2 gap-3">
                <label class="block">
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                    >Negocio *</span
                  >
                  <input
                    v-model="form.businessName"
                    type="text"
                    placeholder="ej. NutriShop"
                    class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                  />
                </label>
                <label class="block">
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                    >Persona de contacto *</span
                  >
                  <input
                    v-model="form.contactName"
                    type="text"
                    placeholder="Tu nombre"
                    class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                  />
                </label>
                <label class="block">
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                    >Email *</span
                  >
                  <input
                    v-model="form.email"
                    type="email"
                    placeholder="contacto@tunegocio.com"
                    class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                  />
                </label>
                <label class="block">
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                    >Teléfono *</span
                  >
                  <input
                    v-model="form.phone"
                    type="tel"
                    placeholder="+52 722 555 0101"
                    class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                  />
                </label>
                <label class="col-span-2 hidden" aria-hidden="true">
                  <input
                    v-model="form.company"
                    type="text"
                    tabindex="-1"
                    autocomplete="off"
                  />
                </label>
              </div>
            </section>

            <section class="rounded-2xl border border-stroke bg-surface p-5">
              <h2
                class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
              >
                <span class="h-4 w-1 rounded-full bg-accent" />
                Tu anuncio
              </h2>
              <div class="mt-4 grid grid-cols-2 gap-3">
                <label class="block">
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                    >Título *</span
                  >
                  <input
                    v-model="form.title"
                    type="text"
                    placeholder="ej. Whey X-Treme -20%"
                    class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                  />
                </label>
                <label class="block">
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                    >Subtítulo *</span
                  >
                  <input
                    v-model="form.subtitle"
                    type="text"
                    placeholder="Condiciones de la promo"
                    class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                  />
                </label>
                <label class="block">
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                    >Texto del botón *</span
                  >
                  <input
                    v-model="form.ctaLabel"
                    type="text"
                    placeholder="Ver oferta"
                    class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                  />
                </label>
                <label class="block">
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                    >Color de tu marca</span
                  >
                  <div class="mt-1 flex items-center gap-2">
                    <input
                      v-model="form.brandColor"
                      type="color"
                      class="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-stroke bg-base p-1"
                    />
                    <input
                      v-model="form.brandColor"
                      type="text"
                      placeholder="#f97316"
                      class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                    />
                  </div>
                </label>
                <label class="col-span-2 block">
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                    >Descripción</span
                  >
                  <textarea
                    v-model="form.description"
                    rows="2"
                    placeholder="Qué ofreces y por qué al socio le conviene"
                    class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                  />
                </label>
                <label class="col-span-2 block">
                  <span
                    class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                    >Dirección</span
                  >
                  <input
                    v-model="form.address"
                    type="text"
                    placeholder="Calle, número, colonia, ciudad"
                    class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                  />
                  <span class="mt-1 block text-[10px] font-semibold text-text-dim">
                    El mapa ubica tu negocio mientras escribes — el botón
                    "Cómo llegar" de la app lleva a los socios a tu puerta.
                  </span>
                </label>
                <div class="col-span-2">
                  <div class="mb-1.5 flex items-center justify-between">
                    <span
                      class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                      >Confirma tu ubicación</span
                    >
                    <span
                      v-if="geocoding"
                      class="text-[10px] font-bold text-text-dim"
                      >Buscando en el mapa…</span
                    >
                    <span
                      v-else-if="form.lat != null"
                      class="text-[10px] font-bold text-emerald-400"
                      >Ubicación marcada ✓</span
                    >
                  </div>
                  <ClientOnly>
                    <LocationPicker
                      v-model:lat="form.lat"
                      v-model:lng="form.lng"
                      :center="mapCenter"
                      @manual="pinTouched = true"
                    />
                  </ClientOnly>
                </div>
              </div>
              <div class="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p
                    class="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim"
                  >
                    Imagen del anuncio *
                  </p>
                  <ImagePicker
                    v-model="form.imageUrl"
                    label="Subir imagen del anuncio"
                    @error="formError = $event"
                  />
                </div>
                <div>
                  <p
                    class="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim"
                  >
                    Portada del perfil
                  </p>
                  <PhotosPicker
                    v-model="form.photos"
                    :max="1"
                    label="Subir portada"
                    @error="formError = $event"
                  />
                </div>
              </div>
            </section>

            <section class="rounded-2xl border border-stroke bg-surface p-5">
              <h2
                class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
              >
                <span class="h-4 w-1 rounded-full bg-accent" />
                Redes y contacto
              </h2>
              <p class="mt-0.5 text-[10px] font-semibold text-text-dim">
                Opcionales — adónde lleva tu anuncio
              </p>
              <div class="mt-4 grid grid-cols-2 gap-3">
                <input
                  v-model="form.instagram"
                  type="text"
                  placeholder="Instagram (URL)"
                  class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                />
                <input
                  v-model="form.facebook"
                  type="text"
                  placeholder="Facebook (URL)"
                  class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                />
                <input
                  v-model="form.tiktok"
                  type="text"
                  placeholder="TikTok (URL)"
                  class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                />
                <input
                  v-model="form.website"
                  type="text"
                  placeholder="Sitio web (URL)"
                  class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                />
                <input
                  v-model="form.whatsapp"
                  type="tel"
                  placeholder="WhatsApp (ej. +52 722 555 0101)"
                  class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                />
                <input
                  v-model="form.otherUrl"
                  type="text"
                  placeholder="Otra red (ej. YouTube, X…)"
                  class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
                />
              </div>
            </section>
          </div>

          <AdPreview
            :preview="preview"
            :brand-name="info.brandName || 'RIR-HUB'"
            show-push
          />
        </div>

        <div class="mt-8 border-t border-stroke pt-6">
          <div
            class="flex items-start gap-2 rounded-xl border border-stroke bg-base px-3 py-2.5"
          >
            <Lock class="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <p class="text-[10px] font-semibold leading-snug text-text-dim">
              Pago seguro con Stripe. Tu anuncio entra a revisión y el equipo
              de {{ info.brandName }} lo aprueba antes de publicarse — si no
              se aprueba, el reembolso es automático.
            </p>
          </div>
          <p
            v-if="formError"
            class="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-medium leading-snug text-red-400"
          >
            {{ formError }}
          </p>
          <p
            v-if="missingFields.length"
            class="mt-2 text-[10px] font-semibold text-text-dim"
          >
            Pendiente: {{ missingFields.join(', ') }}
          </p>
          <button
            class="mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-xs font-black text-base transition hover:opacity-90 disabled:opacity-50"
            :disabled="saving || info.slots[form.placement]?.enabled === false"
            @click="pay"
          >
            <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
            <Check v-else class="h-4 w-4" />
            {{
              saving
                ? 'Abriendo pago seguro…'
                : `Pagar $${total.toLocaleString('es-MX')} MXN`
            }}
          </button>
        </div>

        <p
          class="mt-8 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-text-dim"
        >
          <Building2 class="h-3 w-3" />
          Venta de espacios publicitarios de {{ info.brandName }} — operado con
          RIR-HUB
        </p>
      </template>
    </div>
  </div>
</template>
