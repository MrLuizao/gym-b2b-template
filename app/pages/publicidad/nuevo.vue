<script setup lang="ts">
import { ArrowLeft, Check, ImageUp } from '@lucide/vue';

import type { Branch, SponsorAd } from '#shared/types';

const { createAd } = useCms();
const { session } = useAuth();

const branches = ref<Branch[]>([]);
const saving = ref(false);
const formError = ref<string | null>(null);
const confirmModalOpen = ref(false);

const form = ref({
  advertiser: '',
  title: '',
  subtitle: '',
  badge: 'ALIADO',
  brandColor: '#f4e701',
  imageUrl: '',
  ctaLabel: 'Ver oferta',
  branchId: 'todas',
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

const preview = computed(() => ({
  imageUrl: form.value.imageUrl,
  badge: form.value.badge || 'ALIADO',
  advertiser: form.value.advertiser || 'Anunciante',
  title: form.value.title || 'Título del anuncio',
  subtitle: form.value.subtitle,
  ctaLabel: form.value.ctaLabel || 'Ver oferta',
  brandColor: form.value.brandColor,
}));

const onAlly = computed(() => readableOn(preview.value.brandColor));

function branchName(id: string | null): string {
  if (!id) return 'Todas las sedes';
  return branches.value.find((b) => b.id === id)?.name ?? '—';
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString('es-BO', {
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

const confirmDescription = computed(() => {
  const active = form.value.status === 'ACTIVE';
  return `"${form.value.advertiser.trim()}" ${active ? 'aparecerá' : 'quedará pausado sin aparecer'} en el carrusel de Aliados del Home (${branchName(form.value.branchId === 'todas' ? null : form.value.branchId)}) hasta el ${formatDay(endsAtTs.value)}.`;
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
  if (f.photos.length === 0) missing.push('galería de fotos');
  return missing;
});

function askPublish(): void {
  if (missingFields.value.length > 0) {
    formError.value = `Todos los campos son obligatorios — falta: ${missingFields.value.join(', ')}`;
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
    branches.value = await $fetch<Branch[]>('/api/branches');
  } catch {
    branches.value = [];
  }
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-black text-text-primary">Nuevo anuncio</h1>
      <p class="mt-1 text-[11px] text-text-dim">
        Espacio publicitario vendible — se muestra en el carrusel de Aliados
        del Home de la app.
      </p>
    </div>

    <section>
      <h2
        class="mb-3 text-sm font-black uppercase tracking-widest text-text-muted"
      >
        Así se verá en el Home de la app
      </h2>
      <div
        class="relative max-w-md overflow-hidden rounded-2xl border border-stroke bg-surface"
      >
        <div class="relative h-40">
          <img
            v-if="preview.imageUrl"
            :src="preview.imageUrl"
            :alt="preview.title"
            class="h-full w-full object-cover"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center bg-base"
          >
            <ImageUp class="h-5 w-5 text-text-dim" />
          </div>
          <div
            class="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent"
          />
          <div
            class="absolute inset-x-0 bottom-0 backdrop-blur-md"
            :style="{ backgroundColor: `${preview.brandColor}9e` }"
          >
            <div
              class="flex items-center justify-between gap-2 px-3 py-2.5"
            >
              <div class="min-w-0">
                <p
                  class="text-[8px] font-black uppercase tracking-[0.14em]"
                  :style="{ color: `${onAlly}bf` }"
                >
                  {{ preview.advertiser }}
                </p>
                <p
                  class="truncate text-xs font-black"
                  :style="{ color: onAlly }"
                >
                  {{ preview.title }}
                </p>
                <p
                  class="truncate text-[10px] font-semibold"
                  :style="{ color: `${onAlly}bf` }"
                >
                  {{ preview.subtitle }}
                </p>
              </div>
              <span
                class="shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black"
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
    </section>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2 class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
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
        <div class="col-span-2">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Imagen del anuncio *</span
          >
          <ImagePicker
            v-model="form.imageUrl"
            label="Subir imagen del anuncio"
            compact
            class="mt-1"
            @error="formError = $event"
          />
        </div>
        <label class="block">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >Vigencia hasta *</span
          >
          <input
            v-model="form.endsAt"
            type="date"
            class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          />
        </label>
      </div>
    </section>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2 class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
        Detalle del aliado · se muestra al abrir el anuncio en la app
      </h2>
      <div class="mt-4 grid grid-cols-2 gap-3">
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
      <h2 class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
        Redes sociales · opcionales
      </h2>
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
          class="col-span-2 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
        />
      </div>
    </section>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <h2 class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
        Galería de fotos · mínimo 1
      </h2>
      <div class="mt-4">
        <PhotosPicker v-model="form.photos" @error="formError = $event" />
      </div>
    </section>

    <div
      class="flex items-center justify-between rounded-2xl border border-stroke bg-surface px-5 py-4"
    >
      <span class="text-[11px] font-bold text-text-muted">
        Visible en el Home desde su publicación
      </span>
      <button
        type="button"
        class="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition"
        :class="
          form.status === 'ACTIVE'
            ? 'bg-accent'
            : 'border border-stroke bg-base'
        "
        @click="form.status = form.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'"
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

    <p v-if="formError" class="text-[11px] font-bold text-red-400">
      {{ formError }}
    </p>

    <button
      class="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-xs font-black text-base transition hover:opacity-90 disabled:opacity-50"
      :disabled="saving"
      @click="askPublish"
    >
      <Check class="h-4 w-4" />
      {{ saving ? 'Publicando…' : 'Publicar anuncio' }}
    </button>

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

    <NuxtLink
      to="/publicidad"
      class="flex h-11 items-center justify-center gap-2 rounded-full border border-stroke bg-surface text-xs font-black text-text-primary transition hover:border-accent"
    >
      <ArrowLeft class="h-4 w-4" />
      Volver a Publicidad
    </NuxtLink>
  </div>
</template>
