<script setup lang="ts">
import {
  Activity,
  ArrowLeft,
  Check,
  CircleCheck,
  Eye,
  Hourglass,
  MousePointerClick,
  Pause,
  Pencil,
  Play,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from '@lucide/vue';

import type { SponsorAd } from '#shared/types';
import { PLACEMENT_RANK } from '#shared/types';

const route = useRoute();
const router = useRouter();
const {
  updateAd,
  updateAdStatus,
  deleteAd,
  orders,
  loadOrders,
  approveOrder,
  rejectOrder,
} = useCms();
const { session } = useAuth();
/// El contenido publicitario es global — solo el admin lo modifica.
const isAdmin = computed(() => session.value?.role === 'ADMIN');

/// Revisión de la orden ligada: admin cualquiera; gerente solo si la
/// orden compró SU sede ("todas las sedes" sigue siendo admin-only).
/// Como ya no se vende por sede, toda orden es global → admin-only.
const canReviewLinkedOrder = computed(() => isAdmin.value);

const ad = ref<SponsorAd | null>(null);
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
  otherLabel: '',
  otherUrl: '',
  photos: [] as string[],
});

const statusModalOpen = ref(false);
const deleteModalOpen = ref(false);
const deleting = ref(false);
/// Razón obligatoria para degradar/pausar/borrar un anuncio COMPRADO —
/// queda en /auditLogs como evidencia para el anunciante.
const overrideReason = ref('');
const pauseReason = ref('');
const deleteReason = ref('');



const placementItems = [
  { label: 'Carrusel destacado', value: 'carousel' },
  { label: 'Directorio de Aliados', value: 'list' },
];

function placementLabel(p: SponsorAd['placement']): string {
  return p === 'carousel' ? 'Carrusel destacado' : 'Directorio de Aliados';
}

const saveModalOpen = ref(false);
const saveModalEmpty = ref(false);
const saveChanges = ref<string[]>([]);
const actionError = ref<string | null>(null);
/// Errores del formulario de edición (pickers, validaciones pre-modal).
const formError = ref<string | null>(null);

function branchName(_id: string | null): string {
  /// Los anuncios ya no se segmentan por sede — siempre global.
  return 'Todas las sedes';
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
/// PENDING tiene ends_at null (arranca al aprobarse), nunca es "vencido".
const isExpired = computed(
  () =>
    !!ad.value &&
    ad.value.status !== 'PENDING' &&
    ad.value.endsAt < Date.now(),
);

/// Orden self-serve ligada a este anuncio (null = creado por staff).
const linkedOrder = computed(
  () => orders.value.find((o) => o.sponsorAdId === ad.value?.id) ?? null,
);
const isPendingReview = computed(() => ad.value?.status === 'PENDING');
/// Anuncio comprado por un anunciante — su superficie pagada no se
/// degrada sin razón + log (order_id es la fuente, la orden puede
/// no haber cargado en esta vista).
const isPaidAd = computed(() => !!ad.value?.orderId);
/// Borrar un anuncio comprado exige razón solo mientras está vigente —
/// expirado ya cumplió su pauta y borrarlo es limpieza normal.
const paidDeleteProtected = computed(
  () => isPaidAd.value && !isExpired.value,
);
const downgradeSelected = computed(
  () =>
    isPaidAd.value &&
    !!ad.value &&
    PLACEMENT_RANK[editForm.value.placement] <
      PLACEMENT_RANK[ad.value.placement],
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
  if (s.other_url) entries[s.other_label || 'enlace'] = s.other_url;
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
      description: editForm.value.description,
      address: editForm.value.address,
      phone: editForm.value.phone,
      socials: {
        instagram: editForm.value.instagram,
        facebook: editForm.value.facebook,
        tiktok: editForm.value.tiktok,
        website: editForm.value.website,
        whatsapp: editForm.value.whatsapp,
        other_label: editForm.value.otherLabel,
        other_url: editForm.value.otherUrl,
      },
      photos: editForm.value.photos,
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
    description: a?.description ?? '',
    address: a?.address ?? '',
    phone: a?.phone ?? '',
    socials: a?.socials,
    photos: a?.photos,
  };
});

/// Serie diaria 30d desde `adStats` (eventos únicos deduplicados).
interface AdDailyStat {
  date: string;
  impressions: number;
  taps: number;
}
const dailyStats = ref<AdDailyStat[]>([]);
const maxImpressions = computed(() =>
  Math.max(1, ...dailyStats.value.map((d) => d.impressions)),
);

onMounted(async () => {
  try {
    const [data, stats] = await Promise.all([
      $api<SponsorAd>(`/api/cms/ads/${route.params.id}`),
      $api<{ days: AdDailyStat[] }>(`/api/ads/${route.params.id}/stats`),
    ]);
    ad.value = data;
    dailyStats.value = stats.days;
    /// Órdenes self-serve — para ligar PENDING ↔ pago del anunciante.
    loadOrders().catch(() => {});
  } catch {
    ad.value = null;
  } finally {
    pending.value = false;
  }
});

// ── Revisión de orden self-serve (anuncio PENDING) ──

const approving = ref(false);
const rejectModalOpen = ref(false);
const rejectReason = ref('');

function orderAmount(): string {
  return `$${(linkedOrder.value?.amount ?? 0).toLocaleString('es-MX')} MXN`;
}

async function approvePending(): Promise<void> {
  const o = linkedOrder.value;
  if (!o || approving.value) return;
  approving.value = true;
  actionError.value = null;
  try {
    await approveOrder(o);
    await reload();
  } catch (cause) {
    actionError.value =
      cause instanceof Error ? cause.message : 'No se pudo aprobar';
  } finally {
    approving.value = false;
  }
}

async function confirmReject(): Promise<void> {
  const o = linkedOrder.value;
  if (!o || approving.value) return;
  approving.value = true;
  actionError.value = null;
  try {
    await rejectOrder(o, rejectReason.value);
    rejectModalOpen.value = false;
    await navigateTo('/publicidad');
  } catch (cause) {
    actionError.value =
      cause instanceof Error ? cause.message : 'No se pudo reembolsar';
  } finally {
    approving.value = false;
  }
}

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
    otherLabel: ad.value.socials.other_label,
    otherUrl: ad.value.socials.other_url,
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
  if (editForm.value.placement !== a.placement)
    changes.push(
      `Espacio: ${placementLabel(a.placement)} → ${placementLabel(editForm.value.placement)}` +
        (downgradeSelected.value ? ' — quedará en el log de auditoría' : ''),
    );
  if (downgradeSelected.value && !overrideReason.value.trim()) {
    formError.value =
      'Este anuncio fue comprado — bajar de espacio requiere una razón (queda en el log)';
    return;
  }
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
    editForm.value.whatsapp !== a.socials.whatsapp ||
    editForm.value.otherLabel !== a.socials.other_label ||
    editForm.value.otherUrl !== a.socials.other_url;
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
      /// Los anuncios ya no se segmentan por sede — siempre global.
      branchId: null,
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
        other_label: editForm.value.otherLabel.trim(),
        other_url: editForm.value.otherUrl.trim(),
      },
      photos: editForm.value.photos,
      overrideReason: overrideReason.value.trim() || undefined,
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
  /// Pausar un anuncio comprado quita la superficie que el anunciante
  /// pagó — el server exige razón y la registra en /auditLogs.
  const pausing = ad.value.status === 'ACTIVE';
  if (pausing && isPaidAd.value && !pauseReason.value.trim()) {
    actionError.value =
      'Este anuncio fue comprado — pausarlo requiere una razón (queda en el log)';
    return;
  }
  saving.value = true;
  actionError.value = null;
  try {
    await updateAdStatus(
      ad.value,
      pausing ? 'PAUSED' : 'ACTIVE',
      pausing ? pauseReason.value.trim() : undefined,
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
  /// Borrar un anuncio comprado VIGENTE destruye lo pagado — razón
  /// obligatoria y snapshot en /auditLogs. Expirado = borrado libre.
  if (paidDeleteProtected.value && !deleteReason.value.trim()) {
    actionError.value =
      'Este anuncio fue comprado — eliminarlo requiere una razón (queda en el log)';
    return;
  }
  deleting.value = true;
  actionError.value = null;
  try {
    await deleteAd(
      ad.value,
      paidDeleteProtected.value ? deleteReason.value.trim() : undefined,
    );
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
              isPendingReview
                ? 'bg-amber-400'
                : isExpired
                  ? 'bg-red-400'
                  : ad.status === 'ACTIVE'
                    ? 'bg-emerald-400'
                    : 'bg-text-dim'
            "
          />
          <span
            class="text-[10px] font-bold uppercase tracking-widest"
            :class="
              isPendingReview
                ? 'text-amber-400'
                : isExpired
                  ? 'text-red-400'
                  : ad.status === 'ACTIVE'
                    ? 'text-emerald-400'
                    : 'text-text-dim'
            "
          >
            {{
              isPendingReview
                ? 'En revisión'
                : isExpired
                  ? 'Vencido'
                  : ad.status === 'ACTIVE'
                    ? 'Activo'
                    : 'Pausado'
            }}
          </span>
        </p>
      </div>
      <div
        v-if="(isPendingReview && linkedOrder && canReviewLinkedOrder) || isAdmin"
        class="flex shrink-0 items-center gap-2"
      >
        <template v-if="isPendingReview && linkedOrder && canReviewLinkedOrder">
          <button
            type="button"
            class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 text-[11px] font-black text-emerald-400 transition hover:bg-emerald-400/20 disabled:opacity-50"
            :disabled="approving"
            @click="approvePending"
          >
            <Check class="h-3.5 w-3.5" />
            {{ approving ? 'Publicando…' : 'Aprobar y publicar' }}
          </button>
          <button
            type="button"
            class="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-red-400/40 bg-red-400/10 px-4 text-[11px] font-black text-red-400 transition hover:bg-red-400/20 disabled:opacity-50"
            :disabled="approving"
            @click="actionError = null; rejectModalOpen = true"
          >
            <Undo2 class="h-3.5 w-3.5" />
            Rechazar y reembolsar
          </button>
        </template>
        <template v-else-if="isAdmin">
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
        </template>
      </div>
    </div>

    <p
      v-if="actionError && !statusModalOpen && !deleteModalOpen && !rejectModalOpen && !saveModalOpen"
      class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-medium text-red-400"
    >
      {{ actionError }}
    </p>

    <div class="grid gap-6 lg:grid-cols-[3fr_2fr]">
      <div class="space-y-6">

    <!-- Orden self-serve — el negocio ya pagó, espera tu aprobación -->
    <section
      v-if="isPendingReview && linkedOrder"
      class="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5"
    >
      <h2
        class="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-amber-400"
      >
        <Hourglass class="h-4 w-4" />
        Solicitud pagada — pendiente de tu aprobación
      </h2>
      <div class="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Negocio
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ linkedOrder.businessName }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Contacto
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ linkedOrder.contactName }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Email
          </p>
          <p class="mt-1 truncate text-sm font-bold text-text-primary">
            {{ linkedOrder.email }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Teléfono
          </p>
          <p class="mt-1 text-sm font-bold text-text-primary">
            {{ linkedOrder.phone }}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Vigencia contratada
          </p>
          <p class="mt-1 text-sm font-black text-text-primary">
            {{ linkedOrder.weeks }} semana{{ linkedOrder.weeks > 1 ? 's' : '' }}
            <span class="text-[10px] font-bold text-text-dim">
              desde la aprobación
            </span>
          </p>
        </div>
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
            Pagado
          </p>
          <p class="mt-1 text-sm font-black text-emerald-400">
            {{ orderAmount() }}
          </p>
        </div>
      </div>
      <p class="mt-3 text-[10px] font-semibold leading-snug text-text-dim">
        Aprobar publica el anuncio al instante; rechazar reembolsa el pago
        completo al anunciante y borra el creativo.
      </p>
    </section>

    <div
      v-if="!editing && !isPendingReview"
      class="grid grid-cols-2 gap-4 md:grid-cols-4"
    >
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

    <!-- Rendimiento diario — eventos únicos por socio/día -->
    <section
      v-if="dailyStats.length"
      class="rounded-2xl border border-stroke bg-surface p-5"
    >
      <div class="flex items-center justify-between">
        <h2 class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
          Rendimiento · últimos 30 días
        </h2>
        <div class="flex items-center gap-3 text-[10px] font-bold text-text-dim">
          <span class="flex items-center gap-1">
            <i class="inline-block h-2 w-2 rounded-full bg-text-dim" />
            Impresiones
          </span>
          <span class="flex items-center gap-1">
            <i class="inline-block h-2 w-2 rounded-full bg-accent" />
            Taps
          </span>
        </div>
      </div>
      <div class="mt-4 flex h-24 items-end gap-[3px]">
        <div
          v-for="d in dailyStats"
          :key="d.date"
          class="relative flex-1 rounded-t-[3px] bg-stroke/60"
          :style="{
            height: `${Math.max(4, (d.impressions / maxImpressions) * 100)}%`,
          }"
          :title="`${d.date} — ${d.impressions} imp · ${d.taps} taps`"
        >
          <div
            class="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-accent"
            :style="{
              height: `${Math.min(100, (d.taps / Math.max(1, d.impressions)) * 100)}%`,
            }"
          />
        </div>
      </div>
      <p class="mt-2 text-[10px] font-semibold text-text-dim">
        Una impresión/tap por socio por día — métrica honesta para el
        patrocinador.
      </p>
    </section>

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
            :class="
              isPendingReview
                ? 'text-amber-400'
                : isExpired
                  ? 'text-red-400'
                  : 'text-emerald-400'
            "
          >
            <Hourglass v-if="isPendingReview" class="h-3.5 w-3.5 shrink-0" />
            <TriangleAlert v-else-if="isExpired" class="h-3.5 w-3.5 shrink-0" />
            <CircleCheck v-else class="h-3.5 w-3.5 shrink-0" />
            {{
              isPendingReview
                ? 'Arranca al aprobar'
                : formatFullDay(ad.endsAt)
            }}
            <span
              v-if="!isPendingReview"
              class="text-[10px] font-bold uppercase tracking-widest opacity-75"
            >
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
              >Espacio</span
            >
            <USelectMenu
              v-model="editForm.placement"
              :items="placementItems"
              value-key="value"
              class="mt-1 w-full"
            />
          </label>
          <div
            v-if="downgradeSelected"
            class="col-span-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5"
          >
            <p class="flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
              <TriangleAlert class="h-3.5 w-3.5 shrink-0" />
              Este anuncio fue comprado por el anunciante — bajar de
              espacio quedará en el log de auditoría. Razón obligatoria:
            </p>
            <textarea
              v-model="overrideReason"
              rows="2"
              placeholder="ej. Incumplió política de contenido / acuerdo con el anunciante"
              class="mt-2 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-amber-400"
            />
          </div>
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
            <div class="col-span-2 flex gap-3">
              <input
                v-model="editForm.otherLabel"
                type="text"
                placeholder="Otra red (ej. YouTube, X…)"
                class="w-2/5 rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
              />
              <input
                v-model="editForm.otherUrl"
                type="text"
                placeholder="URL del enlace"
                class="flex-1 rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
              />
            </div>
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
        <AdPreview :preview="preview">
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
        </AdPreview>
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
      <template
        v-if="ad.status === 'ACTIVE' && isPaidAd"
        #body
      >
        <div
          class="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5"
        >
          <p class="text-[11px] font-bold leading-relaxed text-amber-400">
            Este anuncio fue comprado — pausarlo quita la superficie
            pagada y quedará en el log de auditoría. Razón obligatoria:
          </p>
          <textarea
            v-model="pauseReason"
            rows="2"
            placeholder="ej. Contenido reportado / acuerdo con el anunciante"
            class="mt-2 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-amber-400"
          />
        </div>
      </template>
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
      v-model:open="rejectModalOpen"
      title="Rechazar y reembolsar"
      :description="`Se reembolsará ${orderAmount()} a ${linkedOrder?.businessName ?? ''} y el anuncio no se publicará.`"
    >
      <template #body>
        <textarea
          v-model="rejectReason"
          rows="2"
          placeholder="Motivo del rechazo (opcional — se envía al anunciante por correo)"
          class="w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-accent"
        />
      </template>
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
              @click="rejectModalOpen = false"
            />
            <UButton
              label="Rechazar y reembolsar"
              color="error"
              :loading="approving"
              @click="confirmReject"
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
      <template v-if="paidDeleteProtected" #body>
        <div
          class="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2.5"
        >
          <p class="text-[11px] font-bold leading-relaxed text-red-400">
            Este anuncio fue comprado por el anunciante — eliminarlo
            destruye lo que pagó. Se guardará un snapshot de evidencia en
            el log de auditoría y el reembolso queda a tu criterio.
            Razón obligatoria:
          </p>
          <textarea
            v-model="deleteReason"
            rows="2"
            placeholder="ej. Fraude / incumplimiento grave / acuerdo de cancelación"
            class="mt-2 w-full rounded-xl border border-stroke bg-base px-3 py-2 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-red-400"
          />
        </div>
      </template>
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
