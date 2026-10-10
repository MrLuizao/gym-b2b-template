<script setup lang="ts">
import 'leaflet/dist/leaflet.css';

/// Mapa de OSM para que el usuario confirme/arrastre el pin de su
/// negocio — /anuncia lo usa para capturar lat/lng del anunciante.
/// El pin es un divIcon (sin assets); los cambios salen por v-model
/// lat/lng. Leaflet se importa en onMounted (necesita window).
const props = defineProps<{
  lat: number | null;
  lng: number | null;
  /// Centro inicial cuando aún no hay pin (sede elegida o CDMX).
  center: { lat: number; lng: number };
}>();
const emit = defineEmits<{
  'update:lat': [v: number];
  'update:lng': [v: number];
  /// Señal de que el usuario movió el pin a mano — el padre deja de
  /// auto-geocodificar la dirección para no pisar su ajuste.
  manual: [];
}>();

const mapEl = ref<HTMLElement | null>(null);
let map: import('leaflet').Map | null = null;
let marker: import('leaflet').Marker | null = null;
let L: typeof import('leaflet') | null = null;
/// Movimientos originados en el mapa — el watch de props no debe
/// re-volar al mismo punto cuando el usuario arrastró el pin.
let internalMove = false;

function pinIcon(): import('leaflet').DivIcon {
  return L!.divIcon({
    className: '',
    html: '<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#c8f04a;border:3px solid #0d0f14;box-shadow:0 2px 8px rgba(0,0,0,.55)"></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
}

function setPoint(lat: number, lng: number): void {
  internalMove = true;
  emit('update:lat', lat);
  emit('update:lng', lng);
  emit('manual');
}

function placeMarker(lat: number, lng: number, fly = true): void {
  if (!map || !L) return;
  if (marker) {
    marker.setLatLng([lat, lng]);
  } else {
    marker = L.marker([lat, lng], { draggable: true, icon: pinIcon() })
      .addTo(map);
    marker.on('dragend', () => {
      const p = marker!.getLatLng();
      setPoint(p.lat, p.lng);
    });
  }
  if (fly) map.flyTo([lat, lng], 17, { duration: 0.7 });
}

onMounted(async () => {
  L = await import('leaflet');
  if (!mapEl.value) return;
  map = L.map(mapEl.value, {
    zoomControl: false,
    attributionControl: false,
  }).setView([props.center.lat, props.center.lng], 15);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  /// OSM estándar — cobertura global completa sin API key. Se
  /// oscurece con un filtro CSS (.lp-tiles img) porque los tiles
  /// dark gratuitos ya no existen: Carto exige key desde sept-2026
  /// y Esri Dark Gray no cubre MX a zoom alto ("Map data not yet
  /// available").
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    className: 'lp-tiles',
  }).addTo(map);
  map.on('click', (e) => {
    setPoint(e.latlng.lat, e.latlng.lng);
    placeMarker(e.latlng.lat, e.latlng.lng, false);
  });
  if (props.lat != null && props.lng != null) {
    placeMarker(props.lat, props.lng, false);
  }
});

/// Cuando el padre actualiza lat/lng (geocoding de la dirección),
/// vuela el pin — excepto si el cambio vino del propio mapa.
watch(
  () => [props.lat, props.lng],
  ([lat, lng]) => {
    if (internalMove) {
      internalMove = false;
      return;
    }
    if (lat != null && lng != null) placeMarker(lat, lng);
  },
);

onUnmounted(() => {
  map?.remove();
  map = null;
  marker = null;
});
</script>

<template>
  <div class="relative overflow-hidden rounded-xl border border-stroke">
    <div ref="mapEl" class="h-44 w-full" />
    <p
      class="pointer-events-none absolute left-2 top-2 z-[500] rounded-full bg-base/90 px-2.5 py-1 text-[9px] font-bold text-text-dim backdrop-blur"
    >
      {{ lat != null ? 'Arrastra el pin para ajustar' : 'Toca el mapa para ubicar tu negocio' }}
    </p>
    <p
      class="pointer-events-none absolute bottom-1.5 left-2 z-[500] text-[8px] font-semibold text-white/50"
    >
      © OpenStreetMap contributors
    </p>
  </div>
</template>

<style scoped>
/* Dark-mode hack: invierte los tiles claros de OSM para mantener la
   estética oscura sin depender de proveedores con API key. */
:deep(.lp-tiles) {
  filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9)
    saturate(0.4);
}
</style>
