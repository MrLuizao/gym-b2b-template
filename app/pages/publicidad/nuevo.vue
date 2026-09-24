<script setup lang="ts">
import {
  ArrowLeft,
  BatteryFull,
  Check,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  ImageUp,
  Signal,
  Star,
  Store,
  TriangleAlert,
  Wifi,
  X,
} from '@lucide/vue';

import type { Branch, SponsorAd } from '#shared/types';

const { createAd } = useCms();
const { session } = useAuth();

const branches = ref<Branch[]>([]);
const saving = ref(false);
const formError = ref<string | null>(null);
const confirmModalOpen = ref(false);

/// Secciones colapsables — todas cerradas de inicio.
const detailOpen = ref(false);
const socialsOpen = ref(false);
const galleryOpen = ref(false);

const form = ref({
  advertiser: '',
  title: '',
  subtitle: '',
  badge: 'ALIADO',
  brandColor: '#f4e701',
  imageUrl: '',
  ctaLabel: 'Ver oferta',
  branchId: 'todas',
  placement: 'carousel' as SponsorAd['placement'],
  endsAt: '',
  status: 'ACTIVE' as SponsorAd['status'],
  description: '',
  address: '',
  lat: '',
  lng: '',
  phone: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  website: '',
  whatsapp: '',
  photos: [] as string[],
});

const branchItems = computed(() => [
  { label: 'Todas las sedes', value: 'todas' },
  ...branches.value.map((b) => ({ label: b.name, value: b.id })),
]);

/// Espacios publicitarios vendibles — el carrusel del Home es el
/// premium; el directorio de Aliados es la presencia básica.
const placementItems = [
  { label: 'Carrusel del Home', value: 'carousel' },
  { label: 'Directorio de Aliados', value: 'list' },
];

const placementLabel = computed(() =>
  placementItems.find((p) => p.value === form.value.placement)?.label ?? '',
);

const preview = computed(() => ({
  imageUrl: form.value.imageUrl,
  badge: form.value.badge || 'ALIADO',
  advertiser: form.value.advertiser || 'Anunciante',
  title: form.value.title || 'Título del anuncio',
  subtitle: form.value.subtitle,
  ctaLabel: form.value.ctaLabel || 'Ver oferta',
  brandColor: form.value.brandColor,
  placement: form.value.placement,
}));

const onAlly = computed(() => readableOn(preview.value.brandColor));

function branchName(id: string | null): string {
  if (!id) return 'Todas las sedes';
  return branches.value.find((b) => b.id === id)?.name ?? '—';
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
  });
}

function parseCoord(raw: string): number | null {
  const value = Number(raw.trim());
  return Number.isFinite(value) && raw.trim() !== '' ? value : null;
}

const endsAtTs = computed(() =>
  form.value.endsAt
    ? new Date(`${form.value.endsAt}T23:59:59`).getTime()
    : 0,
);

/// Una vigencia pasada = el anuncio nace oculto en la app.
const endsExpired = computed(
  () => form.value.endsAt !== '' && endsAtTs.value < Date.now(),
);

const confirmDescription = computed(() => {
  const active = form.value.status === 'ACTIVE';
  return `"${form.value.advertiser.trim()}" ${active ? 'aparecerá' : 'quedará pausado sin aparecer'} en ${placementLabel.value} (${branchName(form.value.branchId === 'todas' ? null : form.value.branchId)}) hasta el ${formatDay(endsAtTs.value)}.`;
});

const missingFields = computed(() => {
  const f = form.value;
  const missing: string[] = [];
  if (!f.advertiser.trim()) missing.push('anunciante');
  if (!f.ctaLabel.trim()) missing.push('botón (CTA)');
  if (!f.title.trim()) missing.push('título');
  if (!f.subtitle.trim()) missing.push('subtítulo');
  if (!f.badge.trim()) missing.push('badge');
  if (!f.imageUrl) missing.push('imagen del anuncio');
  if (!f.endsAt) missing.push('vigencia');
  if (!f.description.trim()) missing.push('descripción');
  if (!f.address.trim()) missing.push('dirección');
  if (!f.phone.trim()) missing.push('teléfono');
  if (parseCoord(f.lat) === null) missing.push('latitud');
  if (parseCoord(f.lng) === null) missing.push('longitud');
  if (f.photos.length === 0) missing.push('portada');
  return missing;
});

const imageWeight = computed(() =>
  imagePayloadChars(form.value.imageUrl, form.value.photos),
);

function askPublish(): void {
  if (missingFields.value.length > 0) {
    formError.value = `Todos los campos son obligatorios — falta: ${missingFields.value.join(', ')}`;
    return;
  }
  if (imageWeight.value > DOC_IMAGE_LIMIT_CHARS) {
    formError.value =
      `Las imágenes pesan ${formatKb(imageWeight.value)} — el máximo es ~${formatKb(DOC_IMAGE_LIMIT_CHARS)}. ` +
      'Usa una imagen o portada más ligera (JPG de menor resolución).';
    return;
  }
  formError.value = null;
  confirmModalOpen.value = true;
}

async function publish(): Promise<void> {
  if (saving.value) return;
  saving.value = true;
  try {
    const ad = await createAd({
      advertiser: form.value.advertiser.trim(),
      title: form.value.title.trim(),
      subtitle: form.value.subtitle.trim(),
      badge: form.value.badge.trim() || 'ALIADO',
      imageUrl: form.value.imageUrl,
      ctaLabel: form.value.ctaLabel.trim() || 'Ver oferta',
      branchId: form.value.branchId === 'todas' ? null : form.value.branchId,
      placement: form.value.placement,
      endsAt: endsAtTs.value,
      status: form.value.status,
      description: form.value.description.trim(),
      brandColor: hexToArgb(form.value.brandColor),
      address: form.value.address.trim(),
      lat: parseCoord(form.value.lat),
      lng: parseCoord(form.value.lng),
      phone: form.value.phone.trim(),
      socials: {
        instagram: form.value.instagram.trim(),
        facebook: form.value.facebook.trim(),
        tiktok: form.value.tiktok.trim(),
        website: form.value.website.trim(),
        whatsapp: form.value.whatsapp.trim(),
      },
      photos: form.value.photos,
    });
    confirmModalOpen.value = false;
    await navigateTo(`/publicidad/${ad.id}`);
  } catch (cause) {
    formError.value =
      cause instanceof Error ? cause.message : 'No se pudo publicar';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  /// El inventario publicitario es global — solo el admin crea anuncios.
  if (session.value?.role !== 'ADMIN') {
    await navigateTo('/publicidad');
    return;
  }
  try {
    branches.value = await $api<Branch[]>('/api/branches');
  } catch {
    branches.value = [];
  }
});
</script>

<template>
  <div class="space-y-6">
    <button
      type="button"
      class="inline-flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-widest text-text-muted transition hover:text-accent"
      @click="navigateTo('/publicidad')"
    >
      <ArrowLeft class="h-4 w-4 text-accent" />
      Volver
    </button>

    <div class="flex items-center gap-4">
      <div
        class="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-stroke bg-surface"
      >
        <img
          v-if="preview.imageUrl"
          :src="preview.imageUrl"
          :alt="preview.title"
          class="h-full w-full object-cover"
        />
        <ImageUp v-else class="h-5 w-5 text-text-dim" />
      </div>
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-black text-text-primary">Nuevo anuncio</h1>
        <p class="mt-1 truncate text-[11px] text-text-dim">
          Espacio publicitario vendible — se publica en la app según el
          espacio elegido.
        </p>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div class="space-y-6">
        <section class="rounded-2xl border border-stroke bg-surface p-5">
          <h2
            class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
          >
            <span class="h-4 w-1 rounded-full bg-accent" />
            Contenido del anuncio
          </h2>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Anunciante *</span
              >
              <input
                v-model="form.advertiser"
                type="text"
                placeholder="ej. NutriShop"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
              />
            </label>
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Botón (CTA) *</span
              >
              <input
                v-model="form.ctaLabel"
                type="text"
                placeholder="ej. Ver oferta"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
              />
            </label>
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
                >Badge *</span
              >
              <input
                v-model="form.badge"
                type="text"
                placeholder="ALIADO"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
              />
            </label>
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Color de marca del aliado</span
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
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Sede *</span
              >
              <USelectMenu
                v-model="form.branchId"
                :items="branchItems"
                value-key="value"
                class="mt-1 w-full"
              />
            </label>
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Espacio *</span
              >
              <USelectMenu
                v-model="form.placement"
                :items="placementItems"
                value-key="value"
                class="mt-1 w-full"
              />
            </label>
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Vigencia hasta *</span
              >
              <input
                v-model="form.endsAt"
                type="date"
                class="mt-1 w-full rounded-xl border bg-base px-3 py-2 text-sm text-text-primary outline-none"
                :class="
                  endsExpired
                    ? 'border-red-400/60 focus:border-red-400'
                    : 'border-stroke focus:border-accent'
                "
              />
              <p
                v-if="endsExpired"
                class="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-red-400"
              >
                <TriangleAlert class="h-3 w-3 shrink-0" />
                Esta fecha ya venció — el anuncio no se mostrará en la app
              </p>
            </label>
          </div>
        </section>

        <section class="rounded-2xl border border-stroke bg-surface p-5">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between"
            @click="detailOpen = !detailOpen"
          >
            <div class="text-left">
              <h2
                class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
              >
                <span class="h-4 w-1 rounded-full bg-accent" />
                Detalle del aliado
              </h2>
              <p class="mt-0.5 text-[10px] font-semibold text-text-dim">
                Se muestra al abrir el anuncio en la app
              </p>
            </div>
            <ChevronDown
              class="h-4 w-4 shrink-0 text-text-muted transition-transform duration-200"
              :class="detailOpen ? 'rotate-180' : ''"
            />
          </button>
          <div v-if="detailOpen" class="mt-4 grid grid-cols-2 gap-3">
            <label class="col-span-2 block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Descripción *</span
              >
              <textarea
                v-model="form.description"
                rows="2"
                placeholder="Descripción del negocio y de la promoción"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
              />
            </label>
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Dirección *</span
              >
              <input
                v-model="form.address"
                type="text"
                placeholder="Calle, número, colonia"
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
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Latitud *</span
              >
              <input
                v-model="form.lat"
                type="text"
                inputmode="decimal"
                placeholder="19.2547"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
              />
            </label>
            <label class="block">
              <span
                class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                >Longitud *</span
              >
              <input
                v-model="form.lng"
                type="text"
                inputmode="decimal"
                placeholder="-99.6285"
                class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
              />
            </label>
          </div>
        </section>

        <section class="rounded-2xl border border-stroke bg-surface p-5">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between"
            @click="socialsOpen = !socialsOpen"
          >
            <div class="text-left">
              <h2
                class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
              >
                <span class="h-4 w-1 rounded-full bg-accent" />
                Redes sociales
              </h2>
              <p class="mt-0.5 text-[10px] font-semibold text-text-dim">
                Opcionales — enlaces que aparecen en el perfil del aliado
              </p>
            </div>
            <ChevronDown
              class="h-4 w-4 shrink-0 text-text-muted transition-transform duration-200"
              :class="socialsOpen ? 'rotate-180' : ''"
            />
          </button>
          <div v-if="socialsOpen" class="mt-4 grid grid-cols-2 gap-3">
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
              class="col-span-2 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
            />
          </div>
        </section>

        <section class="rounded-2xl border border-stroke bg-surface p-5">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between"
            @click="galleryOpen = !galleryOpen"
          >
            <div class="text-left">
              <h2
                class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
              >
                <span class="h-4 w-1 rounded-full bg-accent" />
                Imágenes
              </h2>
              <p class="mt-0.5 text-[10px] font-semibold text-text-dim">
                Imagen del anuncio + portada del perfil del aliado
              </p>
            </div>
            <ChevronDown
              class="h-4 w-4 shrink-0 text-text-muted transition-transform duration-200"
              :class="galleryOpen ? 'rotate-180' : ''"
            />
          </button>
          <div v-if="galleryOpen" class="mt-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <span
                  class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                  >Imagen del anuncio *</span
                >
                <ImagePicker
                  v-model="form.imageUrl"
                  label="Subir imagen del anuncio"
                  class="mt-1"
                  @error="formError = $event"
                />
              </div>
              <div>
                <span
                  class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
                  >Portada *</span
                >
                <div class="mt-1">
                  <PhotosPicker
                    v-model="form.photos"
                    :max="1"
                    label="Subir portada"
                    @error="formError = $event"
                  />
                </div>
              </div>
            </div>
            <p
              class="mt-2 text-[10px] font-medium"
              :class="imageWeight > DOC_IMAGE_LIMIT_CHARS ? 'text-red-400' : 'text-text-dim'"
            >
              Peso total de imágenes: {{ formatKb(imageWeight) }} / ~{{ formatKb(DOC_IMAGE_LIMIT_CHARS) }}
            </p>
          </div>
        </section>

        <div
          class="flex items-center justify-between rounded-2xl border border-stroke bg-surface px-5 py-4"
        >
          <span class="text-[11px] font-bold text-text-muted">
            {{
              form.status === 'ACTIVE'
                ? 'Visible en la app desde su publicación'
                : 'Borrador — se guarda pausado y no se muestra en la app'
            }}
          </span>
          <button
            type="button"
            class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition"
            :class="
              form.status === 'ACTIVE'
                ? 'bg-accent'
                : 'border border-stroke bg-base'
            "
            @click="
              form.status = form.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
            "
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full transition-all"
              :class="
                form.status === 'ACTIVE'
                  ? 'left-[22px] bg-base'
                  : 'left-0.5 bg-white'
              "
            />
          </button>
        </div>
      </div>

      <section
        class="flex flex-1 flex-col rounded-2xl border border-stroke bg-surface p-5"
      >
        <h2
          class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
        >
          <span class="h-4 w-1 rounded-full bg-accent" />
          Así se ve en Aliados
        </h2>
        <div class="mt-3 flex justify-center">
          <div class="w-full max-w-[260px]">
            <div
              class="flex items-center gap-3 rounded-2xl border border-stroke bg-base p-3"
            >
              <div
                class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface"
              >
                <img
                  v-if="preview.imageUrl"
                  :src="preview.imageUrl"
                  :alt="preview.advertiser"
                  class="h-full w-full object-cover"
                />
                <Store v-else class="h-5 w-5 text-text-dim" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1">
                  <p
                    class="truncate text-[9px] font-black uppercase tracking-widest text-accent"
                  >
                    {{ preview.advertiser }}
                  </p>
                  <Star
                    v-if="preview.placement === 'carousel'"
                    class="h-3 w-3 shrink-0 fill-accent text-accent"
                  />
                </div>
                <p
                  class="truncate text-[13px] font-black text-text-primary"
                >
                  {{ preview.title }}
                </p>
                <p
                  class="truncate text-[11px] font-semibold text-text-muted"
                >
                  {{ preview.subtitle }}
                </p>
              </div>
              <ChevronRight class="h-5 w-5 shrink-0 text-text-dim" />
            </div>
          </div>
        </div>

        <div class="mt-6 border-t border-stroke pt-5">
          <h3
            class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
          >
            <span class="h-4 w-1 rounded-full bg-accent" />
            Así se ve en el Home
          </h3>
        </div>

        <div class="mt-4 flex flex-1 items-center justify-center">
          <div
            class="w-full max-w-[260px] rounded-[2.4rem] border-4 border-stroke bg-black p-1.5 shadow-2xl"
          >
            <div
              class="relative flex h-[420px] flex-col overflow-hidden rounded-[1.9rem] bg-base"
            >
              <div
                class="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black"
              />
              <div
                class="flex items-center justify-between px-6 pt-3 text-[9px] font-bold text-text-primary"
              >
                <span>9:41</span>
                <span class="flex items-center gap-1 text-text-primary">
                  <Signal class="h-2.5 w-2.5" />
                  <Wifi class="h-2.5 w-2.5" />
                  <BatteryFull class="h-3 w-3" />
                </span>
              </div>
              <div class="flex flex-1 flex-col px-3 pt-8">
                <div class="flex items-center gap-1.5 px-1">
                  <div
                    class="flex h-5 w-5 items-center justify-center rounded-md bg-accent"
                  >
                    <Dumbbell class="h-3 w-3 text-base" />
                  </div>
                  <p
                    class="text-[9px] font-black uppercase tracking-widest text-text-primary"
                  >
                    RIR-HUB
                  </p>
                </div>
                <p
                  class="mt-3 px-1 text-[8px] font-bold uppercase tracking-widest text-text-dim"
                >
                  Aliados
                </p>
                <div
                  class="relative mt-1.5 overflow-hidden rounded-2xl border border-stroke"
                >
                  <div class="relative h-32">
                    <img
                      v-if="preview.imageUrl"
                      :src="preview.imageUrl"
                      :alt="preview.title"
                      class="h-full w-full object-cover"
                    />
                    <div
                      v-else
                      class="flex h-full w-full items-center justify-center bg-surface"
                    >
                      <ImageUp class="h-5 w-5 text-text-dim" />
                    </div>
                    <div
                      class="absolute inset-x-0 bottom-0 backdrop-blur-md"
                      :style="{ backgroundColor: `${preview.brandColor}9e` }"
                    >
                      <div
                        class="flex items-center justify-between gap-2 px-2.5 py-2"
                      >
                        <div class="min-w-0">
                          <p
                            class="text-[7px] font-black uppercase tracking-[0.14em]"
                            :style="{ color: `${onAlly}bf` }"
                          >
                            {{ preview.advertiser }}
                          </p>
                          <p
                            class="truncate text-[10px] font-black"
                            :style="{ color: onAlly }"
                          >
                            {{ preview.title }}
                          </p>
                          <p
                            class="truncate text-[8px] font-semibold"
                            :style="{ color: `${onAlly}bf` }"
                          >
                            {{ preview.subtitle }}
                          </p>
                        </div>
                        <span
                          class="shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-black"
                          :style="{
                            color: onAlly,
                            borderColor: `${onAlly}8c`,
                            backgroundColor: `${onAlly}29`,
                          }"
                        >
                          {{ preview.ctaLabel }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                class="mx-auto mb-2 h-1 w-24 rounded-full bg-text-dim/60"
              />
            </div>
          </div>
        </div>

        <p
          v-if="formError"
          class="mt-3 text-[11px] font-bold text-red-400"
        >
          {{ formError }}
        </p>

        <button
          class="mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-xs font-black text-base transition hover:opacity-90 disabled:opacity-50"
          :disabled="saving"
          @click="askPublish"
        >
          <Check class="h-4 w-4" />
          {{ saving ? 'Publicando…' : 'Publicar anuncio' }}
        </button>
        <button
          class="mt-2 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-stroke text-[11px] font-black text-text-muted transition hover:text-text-primary"
          @click="navigateTo('/publicidad')"
        >
          <X class="h-3.5 w-3.5" />
          Cancelar
        </button>
      </section>
    </div>

    <UModal
      v-model:open="confirmModalOpen"
      title="Publicar anuncio de aliado"
      :description="confirmDescription"
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="confirmModalOpen = false"
          />
          <UButton
            label="Publicar anuncio"
            :loading="saving"
            @click="publish"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
