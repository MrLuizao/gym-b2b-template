<script setup lang="ts">
import {
  AtSign,
  BatteryFull,
  Camera,
  ChevronRight,
  Dumbbell,
  Globe,
  ImageUp,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Signal,
  Star,
  Store,
  Wifi,
} from '@lucide/vue';

import type { SponsorAd } from '#shared/types';

/// Vista previa del anuncio tal como se ve en la app del socio —
/// la reusan /publicidad (staff) y /anuncia (compra self-serve).
interface Props {
  preview: {
    imageUrl: string;
    badge: string;
    advertiser: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    /// Hex CSS — el ARGB de Firestore se convierte antes con argbToHex.
    brandColor: string;
    placement: SponsorAd['placement'];
    /// Ficha de detalle (la pantalla que abre el socio al tocar el
    /// anuncio) — secciones opcionales, se ocultan si van vacías.
    description?: string;
    address?: string;
    phone?: string;
    socials?: {
      instagram?: string;
      facebook?: string;
      tiktok?: string;
      website?: string;
      whatsapp?: string;
    };
    /// Portada de la ficha — en la app la galería del detalle prioriza
    /// `photos` y solo cae a `imageUrl` si está vacía.
    photos?: string[];
  };
  /// Marca en el mock del teléfono — en /anuncia es el nombre del gym.
  brandName?: string;
}

const props = withDefaults(defineProps<Props>(), { brandName: 'RIR-HUB' });

const onAlly = computed(() => readableOn(props.preview.brandColor));

/// Superficies cubiertas por el espacio comprado:
/// 'carousel' solo Home, 'list' solo Aliados, 'both' ambas.
const inAllies = computed(() => props.preview.placement !== 'carousel');
const inHome = computed(() => props.preview.placement !== 'list');

/// Ficha de detalle — la ve el socio al tocar CUALQUIER anuncio, así
/// que no depende del placement comprado.
const detailSections = computed(() => {
  const p = props.preview;
  const s = p.socials ?? {};
  return {
    description: (p.description ?? '').trim(),
    address: (p.address ?? '').trim(),
    phone: (p.phone ?? '').trim(),
    whatsapp: (s.whatsapp ?? '').trim(),
    socialChips: [
      s.instagram?.trim() ? { icon: Camera, label: 'Instagram' } : null,
      s.facebook?.trim() ? { icon: AtSign, label: 'Facebook' } : null,
      s.tiktok?.trim() ? { icon: Music2, label: 'TikTok' } : null,
      s.website?.trim() ? { icon: Globe, label: 'Sitio web' } : null,
    ].filter((c): c is { icon: typeof Camera; label: string } => !!c),
  };
});

/// Imagen del hero de la ficha — igual que la app: portada (photos)
/// primero, imagen del anuncio como respaldo.
const detailHero = computed(
  () => props.preview.photos?.[0] || props.preview.imageUrl,
);
</script>

<template>
  <section
    class="flex flex-1 flex-col rounded-2xl border border-stroke bg-surface p-5"
  >
    <h2
      class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
    >
      <span class="h-4 w-1 rounded-full bg-accent" />
      Así se ve en Aliados
      <span
        class="ml-auto rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
        :class="
          inAllies
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-stroke bg-base text-text-dim'
        "
      >
        {{ inAllies ? 'Incluido' : 'No incluido' }}
      </span>
    </h2>
    <div class="mt-3 flex justify-center">
      <div class="w-full max-w-[260px]" :class="{ 'opacity-40': !inAllies }">
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
                v-if="preview.placement !== 'list'"
                class="h-3 w-3 shrink-0 fill-accent text-accent"
              />
            </div>
            <p class="truncate text-[13px] font-black text-text-primary">
              {{ preview.title }}
            </p>
            <p class="truncate text-[11px] font-semibold text-text-muted">
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
        <span
          class="ml-auto rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
          :class="
            inHome
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-stroke bg-base text-text-dim'
          "
        >
          {{ inHome ? 'Incluido' : 'No incluido' }}
        </span>
      </h3>
    </div>

    <div
      class="mt-4 flex flex-1 items-center justify-center"
      :class="{ 'opacity-40': !inHome }"
    >
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
                {{ brandName }}
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
          <div class="mx-auto mb-2 h-1 w-24 rounded-full bg-text-dim/60" />
        </div>
      </div>
    </div>

    <div class="mt-6 border-t border-stroke pt-5">
      <h3
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Tu ficha de aliado
        <span
          class="ml-auto rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-accent"
        >
          Siempre incluida
        </span>
      </h3>
      <p class="mt-1 text-[11px] font-semibold text-text-dim">
        Al tocar tu anuncio, el socio abre esta pantalla con toda tu
        información.
      </p>
    </div>

    <div class="mt-4 flex flex-1 items-center justify-center">
      <div
        class="w-full max-w-[260px] rounded-[2.4rem] border-4 border-stroke bg-black p-1.5 shadow-2xl"
      >
        <div
          class="relative flex h-[460px] flex-col overflow-hidden rounded-[1.9rem] bg-base"
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

          <!-- Hero de la ficha — portada (photos[0]) o imagen del anuncio -->
          <div class="relative mt-2 h-24 shrink-0 overflow-hidden">
            <img
              v-if="detailHero"
              :src="detailHero"
              :alt="preview.advertiser"
              class="h-full w-full object-cover"
            />
            <div
              v-else
              class="flex h-full w-full items-center justify-center bg-surface"
            >
              <ImageUp class="h-5 w-5 text-text-dim" />
            </div>
            <div
              class="absolute inset-0 bg-gradient-to-t from-base via-black/30 to-black/40"
            />
            <div class="absolute bottom-1.5 left-3 right-3">
              <span
                class="rounded-full border px-1.5 py-0.5 text-[6px] font-black uppercase tracking-widest"
                :style="{
                  color: preview.brandColor,
                  borderColor: `${preview.brandColor}8c`,
                  backgroundColor: `${preview.brandColor}26`,
                }"
              >
                Publicidad · {{ preview.badge }}
              </span>
              <p
                class="mt-1 truncate text-[15px] font-black leading-tight tracking-tight text-white"
              >
                {{ preview.advertiser }}
              </p>
            </div>
          </div>

          <div class="flex-1 space-y-2.5 overflow-hidden px-3 py-2.5">
            <!-- Oferta -->
            <div
              class="rounded-xl border px-2.5 py-2"
              :style="{
                borderColor: `${preview.brandColor}59`,
                backgroundColor: `${preview.brandColor}1f`,
              }"
            >
              <p
                class="truncate text-[11px] font-black"
                :style="{ color: preview.brandColor }"
              >
                {{ preview.title }}
              </p>
              <p
                v-if="preview.subtitle"
                class="truncate text-[8px] font-semibold text-white/75"
              >
                {{ preview.subtitle }}
              </p>
            </div>

            <div v-if="detailSections.description">
              <p
                class="text-[6px] font-black uppercase tracking-[0.16em] text-white/50"
              >
                Sobre {{ preview.advertiser }}
              </p>
              <p
                class="mt-0.5 line-clamp-2 text-[8px] font-medium leading-snug text-white/80"
              >
                {{ detailSections.description }}
              </p>
            </div>

            <div
              v-if="detailSections.phone || detailSections.whatsapp"
            >
              <p
                class="text-[6px] font-black uppercase tracking-[0.16em] text-white/50"
              >
                Contacto
              </p>
              <div class="mt-1 flex gap-1.5">
                <div
                  v-if="detailSections.phone"
                  class="flex flex-1 items-center gap-1 rounded-lg border border-stroke bg-surface px-1.5 py-1"
                >
                  <Phone class="h-2.5 w-2.5 shrink-0 text-accent" />
                  <div class="min-w-0">
                    <p class="text-[7px] font-black text-white">Llamar</p>
                    <p class="truncate text-[6px] font-semibold text-white/60">
                      {{ detailSections.phone }}
                    </p>
                  </div>
                </div>
                <div
                  v-if="detailSections.whatsapp"
                  class="flex flex-1 items-center gap-1 rounded-lg border border-stroke bg-surface px-1.5 py-1"
                >
                  <MessageCircle class="h-2.5 w-2.5 shrink-0 text-accent" />
                  <div class="min-w-0">
                    <p class="text-[7px] font-black text-white">WhatsApp</p>
                    <p class="truncate text-[6px] font-semibold text-white/60">
                      {{ detailSections.whatsapp }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="detailSections.socialChips.length">
              <p
                class="text-[6px] font-black uppercase tracking-[0.16em] text-white/50"
              >
                Redes sociales
              </p>
              <div class="mt-1 flex flex-wrap gap-1">
                <span
                  v-for="chip in detailSections.socialChips"
                  :key="chip.label"
                  class="flex items-center gap-0.5 rounded-full border border-stroke bg-surface px-1.5 py-0.5 text-[7px] font-bold text-white/80"
                >
                  <component :is="chip.icon" class="h-2 w-2 text-accent" />
                  {{ chip.label }}
                </span>
              </div>
            </div>

            <div v-if="detailSections.address">
              <p
                class="text-[6px] font-black uppercase tracking-[0.16em] text-white/50"
              >
                Ubicación
              </p>
              <div
                class="mt-1 rounded-xl border border-stroke bg-surface p-2"
              >
                <div class="flex items-center gap-1.5">
                  <MapPin class="h-3 w-3 shrink-0 text-accent" />
                  <p
                    class="truncate text-[8px] font-bold text-white"
                  >
                    {{ detailSections.address }}
                  </p>
                </div>
                <div
                  class="mt-1.5 flex h-5 items-center justify-center rounded-full"
                  :style="{ backgroundColor: preview.brandColor }"
                >
                  <span
                    class="text-[7px] font-black uppercase tracking-widest"
                    :style="{ color: onAlly }"
                  >
                    Cómo llegar
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="mx-auto mb-2 h-1 w-24 shrink-0 rounded-full bg-text-dim/60" />
        </div>
      </div>
    </div>

    <slot />
  </section>
</template>
