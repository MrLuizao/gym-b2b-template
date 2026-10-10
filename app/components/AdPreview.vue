<script setup lang="ts">
import {
  AtSign,
  BatteryFull,
  Bell,
  Camera,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  Globe,
  ImageUp,
  Link2,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  QrCode,
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
      other_label?: string;
      other_url?: string;
    };
    /// Portada de la ficha — en la app la galería del detalle prioriza
    /// `photos` y solo cae a `imageUrl` si está vacía.
    photos?: string[];
  };
  /// Marca en el mock del teléfono — en /anuncia es el nombre del gym.
  brandName?: string;
  /// Muestra la sección "Así se ve el push" — solo en /anuncia (ahí el
  /// push es producto vendible; en páginas de staff no aplica).
  showPush?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  brandName: 'RIR-HUB',
  showPush: false,
});

const onAlly = computed(() => readableOn(props.preview.brandColor));

/// Superficies cubiertas por el espacio comprado: TODO anuncio sale en
/// el directorio Aliados (el carrusel además se fija al tope); 'list'
/// solo aparece ahí en orden aleatorio.
const inAllies = computed(() => true);
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
      s.other_url?.trim()
        ? { icon: Link2, label: s.other_label?.trim() || 'Enlace' }
        : null,
    ].filter((c): c is { icon: typeof Camera; label: string } => !!c),
  };
});

/// Imagen del hero de la ficha — igual que la app: portada (photos)
/// primero, imagen del anuncio como respaldo.
const detailHero = computed(
  () => props.preview.photos?.[0] || props.preview.imageUrl,
);

/// Pills de la semana del mock "Racha semanal" — Lun–Dom con las fechas
/// reales de esta semana; hoy resaltado, primeros días como visitados.
const weekDays = computed(() => {
  const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const today = (new Date().getDay() + 6) % 7; // Lun=0 … Dom=6
  const monday = new Date();
  monday.setDate(monday.getDate() - today);
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label,
      num: d.getDate(),
      visited: i < Math.min(today, 3),
      today: i === today,
      future: i > today,
    };
  });
});
</script>

<template>
  <section
    class="flex flex-1 flex-col rounded-2xl border border-stroke bg-surface p-5"
  >
    <template v-if="showPush">
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-text-primary"
      >
        <span class="h-4 w-1 rounded-full bg-accent" />
        Así se ve el push
        <span
          class="ml-auto rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-accent"
        >
          Incluido
        </span>
      </h2>
      <div class="mt-3 flex justify-center">
        <div
          class="w-full max-w-[280px] rounded-t-[2.4rem] border-4 border-b-0 border-stroke bg-black p-1.5 pb-0 shadow-2xl"
        >
          <div
            class="relative h-[230px] overflow-hidden rounded-t-[1.9rem] bg-gradient-to-b from-[#1d2637] to-base"
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
            <p
              class="mt-5 text-center text-[34px] font-black leading-none tracking-tight text-white/90"
            >
              9:41
            </p>
            <p
              class="mt-1 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-white/50"
            >
              {{
                new Date().toLocaleDateString('es-MX', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              }}
            </p>

            <div class="mt-4 px-3">
              <div
                class="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.07] p-3 backdrop-blur"
              >
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent"
                >
                  <Dumbbell class="h-5 w-5 text-base" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <p
                      class="truncate text-[8px] font-black uppercase tracking-[0.16em] text-white/60"
                    >
                      {{ brandName }}
                    </p>
                    <p class="shrink-0 text-[8px] font-semibold text-white/50">
                      ahora
                    </p>
                  </div>
                  <p
                    class="mt-0.5 truncate text-[12px] font-black leading-tight text-white"
                  >
                    {{ preview.title }}
                  </p>
                  <p
                    v-if="preview.subtitle"
                    class="truncate text-[10px] leading-tight text-white/70"
                  >
                    {{ preview.subtitle }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div
      :class="showPush ? 'mt-6 border-t border-stroke pt-5' : ''"
    >
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
          class="relative flex h-[480px] flex-col overflow-hidden rounded-[1.9rem] bg-base"
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
          <div class="flex flex-1 flex-col gap-3 overflow-hidden px-3 pt-7">
            <!-- Contexto real del dashboard — difuminado para que el
                 anuncio resalte -->
            <div class="space-y-2.5 opacity-70 blur-[0.6px]">
              <!-- Header: saludo + campana -->
              <div class="flex items-center gap-2 px-1">
                <div
                  class="flex h-6 w-6 items-center justify-center rounded-full border border-stroke bg-surface text-[7px] font-black text-text-dim"
                >
                  L
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-[8px] font-black text-text-primary">
                    Hola, Luis
                  </p>
                  <p class="text-[6px] font-semibold text-text-dim">
                    Listo para entrenar hoy
                  </p>
                </div>
                <Bell class="h-3 w-3 text-text-dim" />
              </div>
              <!-- Mis sedes -->
              <div>
                <div class="flex items-center justify-between px-1">
                  <p
                    class="text-[8px] font-black uppercase tracking-widest text-text-primary"
                  >
                    Mis sedes
                  </p>
                  <p class="text-[7px] font-bold text-accent">Ver todas</p>
                </div>
                <div
                  class="mt-1.5 rounded-xl border border-stroke bg-surface p-2"
                >
                  <div class="flex items-center gap-1.5">
                    <Store class="h-3 w-3 shrink-0 text-accent" />
                    <p class="text-[8px] font-black text-text-primary">
                      Sede Centro
                    </p>
                    <span
                      class="ml-auto rounded-full bg-accent/15 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-wider text-accent"
                    >
                      Abierta
                    </span>
                  </div>
                  <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-base">
                    <div class="h-full w-2/3 rounded-full bg-accent/70" />
                  </div>
                  <p class="mt-1 text-[6px] font-semibold text-text-dim">
                    Aforo actual · 24 personas
                  </p>
                </div>
                <div
                  class="mt-1.5 flex items-center justify-center gap-1.5 rounded-lg bg-accent/90 py-1.5"
                >
                  <QrCode class="h-2.5 w-2.5 text-base" />
                  <p class="text-[7px] font-black uppercase tracking-wider text-base">
                    Hacer check-in
                  </p>
                </div>
              </div>
            </div>

            <!-- Carrusel de sponsors — nítido: esto es lo que compra -->
            <div
              class="relative overflow-hidden rounded-2xl border border-stroke shadow-lg"
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
            <!-- Dots del carrusel: 5 espacios premium -->
            <div class="-mt-1 flex justify-center gap-1">
              <span class="h-1 w-3 rounded-full bg-accent" />
              <span
                v-for="i in 4"
                :key="i"
                class="h-1 w-1 rounded-full bg-text-dim/50"
              />
            </div>

            <!-- Más dashboard difuminado -->
            <div class="space-y-2.5 opacity-70 blur-[0.6px]">
              <!-- Resumen semanal — igual que la app: chip de visitas,
                   barra, texto motivador y pills Lun–Dom -->
              <div
                class="rounded-xl border border-stroke bg-surface p-2.5"
              >
                <div class="flex items-center gap-1.5">
                  <p class="text-[8px] font-black text-text-primary">
                    Racha semanal
                  </p>
                  <span
                    class="ml-auto rounded-full bg-accent/15 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-wider text-accent"
                  >
                    3/4 visitas
                  </span>
                  <ChevronRight class="h-2.5 w-2.5 text-text-dim" />
                </div>
                <div class="mt-2 h-1 overflow-hidden rounded-full bg-base">
                  <div class="h-full w-3/4 rounded-full bg-accent/70" />
                </div>
                <div class="mt-1.5 flex items-center gap-1">
                  <Flame class="h-2.5 w-2.5 shrink-0 text-accent" />
                  <p class="text-[6px] font-semibold text-text-dim">
                    Te falta 1 visita para tu meta de 4 por semana
                  </p>
                </div>
                <div class="mt-2 flex gap-1">
                  <div
                    v-for="d in weekDays"
                    :key="d.label"
                    class="flex flex-1 flex-col items-center gap-0.5 rounded-lg border py-1"
                    :class="[
                      d.today ? 'border-accent bg-accent' : 'border-stroke bg-base',
                      d.future ? 'opacity-40' : '',
                    ]"
                  >
                    <p
                      class="text-[5px] font-black"
                      :class="d.today ? 'text-base' : 'text-text-dim'"
                    >
                      {{ d.label }}
                    </p>
                    <div
                      class="flex h-3 w-3 items-center justify-center rounded-full"
                      :class="
                        d.visited
                          ? d.today
                            ? 'bg-base'
                            : 'bg-accent/25'
                          : d.today
                            ? 'bg-white'
                            : 'border border-stroke bg-surface'
                      "
                    >
                      <Check
                        v-if="d.visited"
                        class="h-2 w-2 text-accent"
                      />
                      <p
                        v-else
                        class="text-[6px] font-black leading-none"
                        :class="d.today ? 'text-base' : 'text-text-primary'"
                      >
                        {{ d.num }}
                      </p>
                    </div>
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
      </h3>
    </div>
    <div class="mt-3 flex justify-center" :class="{ 'opacity-40': !inAllies }">
      <div
        class="w-full max-w-[280px] rounded-t-[2.4rem] border-4 border-b-0 border-stroke bg-black p-1.5 pb-0 shadow-2xl"
      >
        <div
          class="relative h-[268px] overflow-hidden rounded-t-[1.9rem] bg-base"
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

          <div class="px-4 pt-4">
            <p class="text-[15px] font-black tracking-tight text-text-primary">
              Aliados
            </p>
            <p class="mt-0.5 text-[8px] font-semibold text-text-dim">
              Las marcas que apoyan tu entrenamiento
            </p>
            <p
              class="mt-3.5 text-[7px] font-bold uppercase tracking-[0.16em] text-text-dim"
            >
              Nuestros aliados
            </p>

            <!-- El anuncio del comprador — nítido -->
            <div
              class="mt-1.5 flex items-center gap-3 rounded-2xl border border-stroke bg-surface p-2.5 shadow-lg"
            >
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-base"
              >
                <img
                  v-if="preview.imageUrl"
                  :src="preview.imageUrl"
                  :alt="preview.advertiser"
                  class="h-full w-full object-cover"
                />
                <Store v-else class="h-4 w-4 text-text-dim" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1">
                  <p
                    class="truncate text-[8px] font-black uppercase tracking-widest text-accent"
                  >
                    {{ preview.advertiser }}
                  </p>
                  <Star
                    v-if="preview.placement !== 'list'"
                    class="h-2.5 w-2.5 shrink-0 fill-accent text-accent"
                  />
                </div>
                <p class="truncate text-[12px] font-black text-text-primary">
                  {{ preview.title }}
                </p>
                <p class="truncate text-[10px] font-semibold text-text-muted">
                  {{ preview.subtitle }}
                </p>
              </div>
              <ChevronRight class="h-4 w-4 shrink-0 text-text-dim" />
            </div>

            <!-- El resto del listado — difuminado y recortado -->
            <div class="mt-2 space-y-2 opacity-50 blur-[0.6px]">
              <div
                v-for="i in 2"
                :key="i"
                class="flex items-center gap-3 rounded-2xl border border-stroke bg-surface p-2.5"
              >
                <div class="h-12 w-12 shrink-0 rounded-xl bg-base" />
                <div class="min-w-0 flex-1 space-y-1.5">
                  <div class="h-1.5 w-14 rounded-full bg-base" />
                  <div class="h-2 w-24 rounded-full bg-base" />
                  <div class="h-1.5 w-20 rounded-full bg-base" />
                </div>
                <ChevronRight class="h-4 w-4 shrink-0 text-text-dim" />
              </div>
            </div>
          </div>
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
