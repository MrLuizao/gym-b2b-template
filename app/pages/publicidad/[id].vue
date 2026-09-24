<script setup lang="ts">
import {
  Activity,
  ArrowLeft,
  BatteryFull,
  Check,
  ChevronRight,
  CircleCheck,
  Dumbbell,
  Eye,
  ImageUp,
  MousePointerClick,
  Pause,
  Pencil,
  Play,
  Signal,
  Star,
  Store,
  Trash2,
  TriangleAlert,
  Wifi,
  X,
} from '@lucide/vue';

import type { Branch, SponsorAd } from '#shared/types';

const route = useRoute();
const router = useRouter();
const { updateAd, updateAdStatus, deleteAd } = useCms();
const { session } = useAuth();
/// El contenido publicitario es global — solo el admin lo modifica.
const isAdmin = computed(() => session.value?.role === 'ADMIN');

const ad = ref<SponsorAd | null>(null);
const branches = ref<Branch[]>([]);
const pending = ref(true);
const saving = ref(false);
const editing = ref(false);

const editForm = ref({
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

const statusModalOpen = ref(false);
const deleteModalOpen = ref(false);
const deleting = ref(false);

const branchItems = computed(() => [
  { label: 'Todas las sedes', value: 'todas' },
  ...branches.value.map((b) => ({ label: b.name, value: b.id })),
]);

const placementItems = [
  { label: 'Carrusel del Home', value: 'carousel' },
  { label: 'Directorio de Aliados', value: 'list' },
];

function placementLabel(p: SponsorAd['placement']): string {
  return p === 'carousel' ? 'Carrusel del Home' : 'Directorio de Aliados';
}

const saveModalOpen = ref(false);
const saveModalEmpty = ref(false);
const saveChanges = ref<string[]>([]);
const actionError = ref<string | null>(null);
/// Errores del formulario de edición (pickers, validaciones pre-modal).
const formError = ref<string | null>(null);

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

function formatFullDay(ts: number): string {
  return new Date(ts).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function toInputDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

const ctr = computed(() => {
  if (!ad.value || ad.value.impressions === 0) return '0';
  return ((ad.value.taps / ad.value.impressions) * 100).toFixed(1);
});

const daysLeft = computed(() => {
  if (!ad.value) return 0;
  return Math.max(0, Math.ceil((ad.value.endsAt - Date.now()) / 86_400_000));
});

/// La app oculta anuncios vencidos aunque status siga ACTIVE — el panel
/// lo grita para que nadie guarde una fecha pasada sin darse cuenta.
const isExpired = computed(
  () => !!ad.value && ad.value.endsAt < Date.now(),
);

const editEndsExpired = computed(() => {
  const v = editForm.value.endsAt;
  if (!v) return false;
  return new Date(`${v}T23:59:59`).getTime() < Date.now();
});

const socialLinks = computed(() => {
  const s = ad.value?.socials;
  if (!s) return {};
  const entries: Record<string, string> = {};
  if (s.instagram) entries.instagram = s.instagram;
  if (s.facebook) entries.facebook = s.facebook;
  if (s.tiktok) entries.tiktok = s.tiktok;
  if (s.website) entries.website = s.website;
  if (s.whatsapp) entries.whatsapp = s.whatsapp;
  return entries;
});

const hasSocials = computed(() => Object.keys(socialLinks.value).length > 0);

const preview = computed(() => {
  if (editing.value) {
    return {
      imageUrl: editForm.value.imageUrl,
      badge: editForm.value.badge || 'ALIADO',
      advertiser: editForm.value.advertiser || 'Anunciante',
      title: editForm.value.title || 'Título del anuncio',
      subtitle: editForm.value.subtitle,
      ctaLabel: editForm.value.ctaLabel || 'Ver oferta',
      brandColor: editForm.value.brandColor,
      placement: editForm.value.placement,
    };
  }
  const a = ad.value;
  return {
    imageUrl: a?.imageUrl ?? '',
    badge: a?.badge ?? 'ALIADO',
    advertiser: a?.advertiser ?? '',
    title: a?.title ?? '',
    subtitle: a?.subtitle ?? '',
    ctaLabel: a?.ctaLabel ?? '',
    brandColor: argbToHex(a?.brandColor) ?? '#f4e701',
    placement: a?.placement ?? 'carousel',
  };
});

const onAlly = computed(() => readableOn(preview.value.brandColor));

onMounted(async () => {
  try {
    const [branchList, data] = await Promise.all([
      $api<Branch[]>('/api/branches'),
      $api<SponsorAd>(`/api/cms/ads/${route.params.id}`),
    ]);
    branches.value = branchList;
    ad.value = data;
  } catch {
    ad.value = null;
  } finally {
    pending.value = false;
  }
});

function parseCoord(raw: string): number | null {
  const value = Number(raw.trim());
  return Number.isFinite(value) && raw.trim() !== '' ? value : null;
}

function startEdit(): void {
  if (!ad.value) return;
  editForm.value = {
    advertiser: ad.value.advertiser,
    title: ad.value.title,
    subtitle: ad.value.subtitle,
    badge: ad.value.badge,
    brandColor: argbToHex(ad.value.brandColor) ?? '#f4e701',
    imageUrl: ad.value.imageUrl,
    ctaLabel: ad.value.ctaLabel,
    branchId: ad.value.branchId ?? 'todas',
    placement: ad.value.placement,
    endsAt: toInputDate(ad.value.endsAt),
    description: ad.value.description,
    address: ad.value.address,
    lat: ad.value.lat != null ? String(ad.value.lat) : '',
    lng: ad.value.lng != null ? String(ad.value.lng) : '',
    phone: ad.value.phone,
    instagram: ad.value.socials.instagram,
    facebook: ad.value.socials.facebook,
    tiktok: ad.value.socials.tiktok,
    website: ad.value.socials.website,
    whatsapp: ad.value.socials.whatsapp,
    photos: [...ad.value.photos],
  };
  editing.value = true;
}

const imageWeight = computed(() =>
  imagePayloadChars(editForm.value.imageUrl, editForm.value.photos),
);

function confirmSave(): void {
  const a = ad.value;
  if (!a) return;
  if (imageWeight.value > DOC_IMAGE_LIMIT_CHARS) {
    formError.value =
      `Las imágenes pesan ${formatKb(imageWeight.value)} — el máximo es ~${formatKb(DOC_IMAGE_LIMIT_CHARS)}. ` +
      'Usa una imagen o portada más ligera (JPG de menor resolución).';
    return;
  }
  formError.value = null;
  const endsAt = editForm.value.endsAt
    ? new Date(`${editForm.value.endsAt}T23:59:59`).getTime()
    : a.endsAt;
  const changes: string[] = [];
  if (editForm.value.advertiser !== a.advertiser)
    changes.push(`Anunciante: '${a.advertiser}' → '${editForm.value.advertiser}'`);
  if (editForm.value.title !== a.title)
    changes.push(`Título: '${a.title}' → '${editForm.value.title}'`);
  if (editForm.value.subtitle !== a.subtitle)
    changes.push('Se actualizará el subtítulo');
  if (editForm.value.badge !== a.badge)
    changes.push(`Badge: '${a.badge}' → '${editForm.value.badge || 'ALIADO'}'`);
  if (editForm.value.brandColor !== (argbToHex(a.brandColor) ?? '#f4e701'))
    changes.push(
      `Color de marca: ${argbToHex(a.brandColor) ?? 'acento'} → ${editForm.value.brandColor}`,
    );
  if (editForm.value.ctaLabel !== a.ctaLabel)
    changes.push(`Botón: '${a.ctaLabel}' → '${editForm.value.ctaLabel}'`);
  if (editForm.value.imageUrl !== a.imageUrl)
    changes.push('Se actualizará la imagen del anuncio');
  const newBranch = editForm.value.branchId === 'todas' ? null : editForm.value.branchId;
  if (newBranch !== a.branchId)
    changes.push(`Sede: ${branchName(a.branchId)} → ${branchName(newBranch)}`);
  if (editForm.value.placement !== a.placement)
    changes.push(
      `Espacio: ${placementLabel(a.placement)} → ${placementLabel(editForm.value.placement)}`,
    );
  if (endsAt !== a.endsAt)
    changes.push(`Vigencia: ${formatDay(a.endsAt)} → ${formatDay(endsAt)}`);
  if (editForm.value.description !== a.description)
    changes.push('Se actualizará la descripción del aliado');
  if (editForm.value.address !== a.address)
    changes.push(`Dirección: '${a.address || '—'}' → '${editForm.value.address || '—'}'`);
  const newLat = parseCoord(editForm.value.lat);
  const newLng = parseCoord(editForm.value.lng);
  if (newLat !== a.lat || newLng !== a.lng)
    changes.push('Se actualizará la ubicación (lat/long)');
  if (editForm.value.phone !== a.phone)
    changes.push(`Teléfono: '${a.phone || '—'}' → '${editForm.value.phone || '—'}'`);
  const socialsChanged =
    editForm.value.instagram !== a.socials.instagram ||
    editForm.value.facebook !== a.socials.facebook ||
    editForm.value.tiktok !== a.socials.tiktok ||
    editForm.value.website !== a.socials.website ||
    editForm.value.whatsapp !== a.socials.whatsapp;
  if (socialsChanged) changes.push('Se actualizarán las redes sociales');
  if (JSON.stringify(editForm.value.photos) !== JSON.stringify(a.photos))
    changes.push('Se actualizará la portada del aliado');
  saveChanges.value = changes;
  saveModalEmpty.value = changes.length === 0;
  actionError.value = null;
  saveModalOpen.value = true;
}

async function saveAd(): Promise<void> {
  if (!ad.value || saving.value) return;
  saving.value = true;
  try {
    const endsAt = editForm.value.endsAt
      ? new Date(`${editForm.value.endsAt}T23:59:59`).getTime()
      : ad.value.endsAt;
    await updateAd(ad.value, {
      advertiser: editForm.value.advertiser.trim(),
      title: editForm.value.title.trim(),
      subtitle: editForm.value.subtitle.trim(),
      badge: editForm.value.badge.trim() || 'ALIADO',
      brandColor: hexToArgb(editForm.value.brandColor),
      imageUrl: editForm.value.imageUrl.trim(),
      ctaLabel: editForm.value.ctaLabel.trim() || 'Ver oferta',
      branchId:
        editForm.value.branchId === 'todas' ? null : editForm.value.branchId,
      placement: editForm.value.placement,
      endsAt,
      description: editForm.value.description.trim(),
      address: editForm.value.address.trim(),
      lat: parseCoord(editForm.value.lat),
      lng: parseCoord(editForm.value.lng),
      phone: editForm.value.phone.trim(),
      socials: {
        instagram: editForm.value.instagram.trim(),
        facebook: editForm.value.facebook.trim(),
        tiktok: editForm.value.tiktok.trim(),
        website: editForm.value.website.trim(),
        whatsapp: editForm.value.whatsapp.trim(),
      },
      photos: editForm.value.photos,
    });
    await reload();
    saveModalOpen.value = false;
    editing.value = false;
  } catch (cause) {
    actionError.value =
      cause instanceof Error ? cause.message : 'No se pudo guardar';
  } finally {
    saving.value = false;
  }
}

async function reload(): Promise<void> {
  ad.value = await $api<SponsorAd>(`/api/cms/ads/${route.params.id}`);
}

const statusDescription = computed(() => {
  if (!ad.value) return '';
  return ad.value.status === 'ACTIVE'
    ? `'${ad.value.advertiser}' dejará de mostrarse en el Home de la app — puedes reactivarlo cuando quieras.`
    : `'${ad.value.advertiser}' volverá a mostrarse en el carrusel de Aliados del Home.`;
});

async function toggleStatus(): Promise<void> {
  if (!ad.value || saving.value) return;
  saving.value = true;
  actionError.value = null;
  try {
    await updateAdStatus(
      ad.value,
      ad.value.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
    );
    await reload();
    statusModalOpen.value = false;
  } catch (cause) {
    actionError.value =
      cause instanceof Error ? cause.message : 'No se pudo actualizar';
  } finally {
    saving.value = false;
  }
}

async function removeAd(): Promise<void> {
  if (!ad.value || deleting.value) return;
  deleting.value = true;
  actionError.value = null;
  try {
    await deleteAd(ad.value);
    deleteModalOpen.value = false;
    await navigateTo('/publicidad');
  } catch (cause) {
    actionError.value =
      cause instanceof Error ? cause.message : 'No se pudo eliminar';
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div
    v-if="pending"
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Cargando anuncio…
  </div>

  <div v-else-if="ad" class="space-y-6">
    <button
      type="button"
      class="inline-flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-widest text-text-muted transition hover:text-accent"
      @click="router.back()"
    >
      <ArrowLeft class="h-4 w-4 text-accent" />
      Volver
    </button>

    <div class="flex items-center gap-4">
      <img
        :src="ad.imageUrl"
        :alt="ad.title"
        class="h-20 w-32 rounded-2xl border border-stroke object-cover"
      />
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-black text-text-primary">
          {{ ad.advertiser }}
        </h1>
        <p class="mt-1 truncate text-[11px] text-text-dim">
          {{ ad.title }}
        </p>
        <p class="mt-0.5 flex items-center gap-1.5">
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="
              isExpired
                ? 'bg-red-400'
                : ad.status === 'ACTIVE'
                  ? 'bg-emerald-400'
                  : 'bg-text-dim'
            "
          />
          <span
            class="text-[10px] font-bold uppercase tracking-widest"
            :class="
              isExpired
                ? 'text-red-400'
                : ad.status === 'ACTIVE'
                  ? 'text-emerald-400'
                  : 'text-text-dim'
            "
          >
            {{
              isExpired
                ? 'Vencido'
                : ad.status === 'ACTIVE'
                  ? 'Activo'
                  : 'Pausado'
            }}
          </span>
        </p>
      </div>
      <div v-if="isAdmin" class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[11px] font-black transition"
          :class="
            ad.status === 'ACTIVE'
              ? 'border-amber-400/40 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
              : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20'
          "
          @click="actionError = null; statusModalOpen = true"
        >
          <Pause v-if="ad.status === 'ACTIVE'" class="h-3.5 w-3.5" />
          <Play v-else class="h-3.5 w-3.5" />
          {{ ad.status === 'ACTIVE' ? 'Pausar' : 'Activar' }}
        </button>
        <button
          type="button"
          class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-red-400/40 bg-red-400/10 px-4 text-[11px] font-black text-red-400 transition hover:bg-red-400/20"
          @click="actionError = null; deleteModalOpen = true"
        >
          <Trash2 class="h-3.5 w-3.5" />
          Eliminar
        </button>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div class="space-y-6">

    <div v-if="!editing" class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <Eye class="mx-auto h-4 w-4 text-text-dim" />
        <p class="mt-1 text-xl font-black text-text-primary">
          {{ ad.impressions.toLocaleString('es-MX') }}
        </p>
        <p class="text-[9px] font-bold uppercase tracking-widest text-text-dim">
          Impresiones
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <MousePointerClick class="mx-auto h-4 w-4 text-text-dim" />
        <p class="mt-1 text-xl font-black text-text-primary">
          {{ ad.taps.toLocaleString('es-MX') }}
        </p>
        <p class="text-[9px] font-bold uppercase tracking-widest text-text-dim">
          Taps
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <Activity class="mx-auto h-4 w-4 text-accent" />
        <p class="mt-1 text-xl font-black text-accent">{{ ctr }}%</p>
        <p class="text-[9px] font-bold uppercase tracking-widest text-text-dim">
          CTR
        </p>
      </div>
      <div class="rounded-2xl border border-stroke bg-surface p-4 text-center">
        <p
          class="mt-1 text-xl font-black"
          :class="daysLeft <= 7 ? 'text-amber-400' : 'text-text-primary'"
        >
          {{ daysLeft }}
        </p>
        <p class="text-[9px] font-bold uppercase tracking-widest text-text-dim">
          Días restantes
        </p>
      </div>
    </div>

    <section class="rounded-2xl border border-stroke bg-surface p-5">
      <div class="flex items-center justify-between">
        <h2 class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Información del anuncio
        </h2>
        <button
          v-if="isAdmin && !editing"
          class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 text-[11px] font-black text-base transition hover:opacity-90"
          @click="startEdit"
        >
          <Pencil class="h-3.5 w-3.5" />
          Editar
        </button>
      </div>

      <div v-if="!editing" class="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Anunciante
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ ad.advertiser }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Título
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">{{ ad.title }}</p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Subtítulo
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ ad.subtitle || '—' }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Botón (CTA)
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ ad.ctaLabel }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Sede
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ branchName(ad.branchId) }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Espacio
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ placementLabel(ad.placement) }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Vigencia
          </p>
          <p
            class="mt-1 flex items-center gap-1.5 text-sm font-black"
            :class="isExpired ? 'text-red-400' : 'text-emerald-400'"
          >
            <TriangleAlert v-if="isExpired" class="h-3.5 w-3.5 shrink-0" />
            <CircleCheck v-else class="h-3.5 w-3.5 shrink-0" />
            {{ formatFullDay(ad.endsAt) }}
            <span class="text-[10px] font-bold uppercase tracking-widest opacity-75">
              {{ isExpired ? 'vencido' : 'vigente' }}
            </span>
          </p>
        </div>
        <div class="col-span-2">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Descripción
          </p>
          <p class="mt-1 text-sm font-semibold text-text-muted">
            {{ ad.description || '—' }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Dirección
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ ad.address || '—' }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Teléfono
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ ad.phone || '—' }}
          </p>
        </div>
        <div class="col-span-2">
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Ubicación
          </p>
          <p class="mt-1 font-mono text-xs font-bold text-text-primary">
            {{
              ad.lat != null && ad.lng != null
                ? `${ad.lat}, ${ad.lng}`
                : 'Sin coordenadas'
            }}
          </p>
        </div>
      </div>

      <div v-if="!editing && hasSocials" class="mt-4">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Redes sociales
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <span
            v-for="(url, name) in socialLinks"
            :key="name"
            class="rounded-full border border-stroke bg-base px-3 py-1 font-mono text-[10px] font-bold text-text-muted"
          >
            {{ name }} · {{ url }}
          </span>
        </div>
      </div>

      <div v-if="!editing && ad.photos.length" class="mt-4">
        <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Portada
        </p>
        <div class="mt-2 grid grid-cols-4 gap-2">
          <img
            v-for="(photo, index) in ad.photos"
            :key="index"
            :src="photo"
            :alt="`${ad.advertiser} ${index + 1}`"
            class="h-16 w-full rounded-lg border border-stroke object-cover"
          />
        </div>
      </div>

      <div v-if="editing" class="mt-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Anunciante</span
            >
            <input
              v-model="editForm.advertiser"
              type="text"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Botón (CTA)</span
            >
            <input
              v-model="editForm.ctaLabel"
              type="text"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Título</span
            >
            <input
              v-model="editForm.title"
              type="text"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Subtítulo</span
            >
            <input
              v-model="editForm.subtitle"
              type="text"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Badge</span
            >
            <input
              v-model="editForm.badge"
              type="text"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Color de marca del aliado</span
            >
            <div class="mt-1 flex items-center gap-2">
              <input
                v-model="editForm.brandColor"
                type="color"
                class="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-stroke bg-base p-1"
              />
              <input
                v-model="editForm.brandColor"
                type="text"
                placeholder="#f97316"
                class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
              />
            </div>
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Sede</span
            >
            <USelectMenu
              v-model="editForm.branchId"
              :items="branchItems"
              value-key="value"
              class="mt-1 w-full"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Espacio</span
            >
            <USelectMenu
              v-model="editForm.placement"
              :items="placementItems"
              value-key="value"
              class="mt-1 w-full"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Vigencia hasta</span
            >
            <input
              v-model="editForm.endsAt"
              type="date"
              class="mt-1 w-full rounded-xl border bg-base px-3 py-2 text-sm text-text-primary outline-none"
              :class="
                editEndsExpired
                  ? 'border-red-400/60 focus:border-red-400'
                  : 'border-stroke focus:border-accent'
              "
            />
            <p
              v-if="editEndsExpired"
              class="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-red-400"
            >
              <TriangleAlert class="h-3 w-3 shrink-0" />
              Esta fecha ya venció — el anuncio no se mostrará en la app
            </p>
          </label>
          <label class="col-span-2 block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Descripción</span
            >
            <textarea
              v-model="editForm.description"
              rows="2"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Dirección</span
            >
            <input
              v-model="editForm.address"
              type="text"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Teléfono</span
            >
            <input
              v-model="editForm.phone"
              type="tel"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Latitud</span
            >
            <input
              v-model="editForm.lat"
              type="text"
              inputmode="decimal"
              placeholder="19.2547"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
          <label class="block">
            <span
              class="text-[10px] font-bold uppercase tracking-widest text-text-dim"
              >Longitud</span
            >
            <input
              v-model="editForm.lng"
              type="text"
              inputmode="decimal"
              placeholder="-99.6285"
              class="mt-1 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
          </label>
        </div>
        <div>
          <p
            class="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim"
          >
            Redes sociales
          </p>
          <div class="grid grid-cols-2 gap-3">
            <input
              v-model="editForm.instagram"
              type="text"
              placeholder="Instagram (URL)"
              class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
            />
            <input
              v-model="editForm.facebook"
              type="text"
              placeholder="Facebook (URL)"
              class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
            />
            <input
              v-model="editForm.tiktok"
              type="text"
              placeholder="TikTok (URL)"
              class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
            />
            <input
              v-model="editForm.website"
              type="text"
              placeholder="Sitio web (URL)"
              class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
            />
            <input
              v-model="editForm.whatsapp"
              type="tel"
              placeholder="WhatsApp (ej. +52 722 555 0101)"
              class="col-span-2 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
            />
          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <p
              class="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Imagen del anuncio
            </p>
            <ImagePicker
              v-model="editForm.imageUrl"
              label="Subir imagen del anuncio"
              @error="formError = $event"
            />
          </div>
          <div>
            <p
              class="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-dim"
            >
              Portada
            </p>
            <PhotosPicker v-model="editForm.photos" :max="1" label="Subir portada" @error="formError = $event" />
          </div>
        </div>
      </div>
    </section>
      </div>

      <div class="flex flex-col space-y-4">
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
                <div class="mx-auto mb-2 h-1 w-24 rounded-full bg-text-dim/60" />
              </div>
            </div>
          </div>

          <template v-if="editing">
            <p
              v-if="formError"
              class="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-medium leading-snug text-red-400"
            >
              {{ formError }}
            </p>
            <button
              class="mt-4 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-xs font-black text-base transition hover:opacity-90 disabled:opacity-50"
              :disabled="saving"
              @click="confirmSave"
            >
              <Check class="h-4 w-4" />
              {{ saving ? 'Guardando…' : 'Guardar cambios' }}
            </button>
            <button
              class="mt-2 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-stroke text-[11px] font-black text-text-muted transition hover:text-text-primary"
              @click="editing = false"
            >
              <X class="h-3.5 w-3.5" />
              Cancelar
            </button>
          </template>
        </section>
      </div>
    </div>

    <UModal
      v-model:open="saveModalOpen"
      title="Guardar cambios del anuncio"
      :description="
        saveModalEmpty
          ? 'No se detectaron cambios respecto a los datos actuales.'
          : `${saveChanges.join('. ')}.`
      "
    >
      <template #footer>
        <div class="flex w-full flex-col gap-2">
          <p
            v-if="actionError"
            class="text-[11px] font-bold text-red-400"
          >
            {{ actionError }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="saveModalOpen = false"
            />
            <UButton
              label="Confirmar cambios"
              :disabled="saveModalEmpty"
              :loading="saving"
              @click="saveAd"
            />
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="statusModalOpen"
      :title="ad.status === 'ACTIVE' ? 'Pausar anuncio' : 'Activar anuncio'"
      :description="statusDescription"
    >
      <template #footer>
        <div class="flex w-full flex-col gap-2">
          <p
            v-if="actionError"
            class="text-[11px] font-bold text-red-400"
          >
            {{ actionError }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="statusModalOpen = false"
            />
            <UButton
              label="Confirmar"
              :loading="saving"
              @click="toggleStatus"
            />
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteModalOpen"
      title="Eliminar anuncio"
      :description="`Se eliminará '${ad.advertiser}' y su historial de impresiones. Esta acción no se puede deshacer.`"
    >
      <template #footer>
        <div class="flex w-full flex-col gap-2">
          <p
            v-if="actionError"
            class="text-[11px] font-bold text-red-400"
          >
            {{ actionError }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              @click="deleteModalOpen = false"
            />
            <UButton
              label="Eliminar anuncio"
              color="error"
              :loading="deleting"
              @click="removeAd"
            />
          </div>
        </div>
      </template>
    </UModal>

  </div>

  <div
    v-else
    class="rounded-2xl border border-stroke bg-surface p-10 text-center text-sm font-semibold text-text-dim"
  >
    Anuncio no encontrado
  </div>
</template>
