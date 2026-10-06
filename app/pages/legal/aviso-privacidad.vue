<script setup lang="ts">
import { ArrowLeft, Dumbbell } from '@lucide/vue';

definePageMeta({ layout: false });

const { isAuthenticated } = useAuth();
</script>

<template>
  <div class="min-h-screen bg-base px-4 py-10">
    <div class="mx-auto max-w-2xl">
      <NuxtLink
        :to="isAuthenticated ? '/' : '/login'"
        class="mb-6 inline-flex items-center gap-2 text-xs font-bold text-text-dim transition hover:text-text-primary"
      >
        <ArrowLeft class="h-3.5 w-3.5" />
        {{ isAuthenticated ? 'Volver al panel' : 'Volver al login' }}
      </NuxtLink>

      <div class="rounded-2xl border border-stroke bg-surface p-8">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
            <Dumbbell class="h-5 w-5 text-base" />
          </div>
          <div>
            <h1 class="text-base font-black tracking-tight text-text-primary">
              Aviso de privacidad
            </h1>
            <p class="text-[10px] font-bold uppercase tracking-widest text-text-dim">
              RIR-HUB · Plataforma para gimnasios
            </p>
          </div>
        </div>

        <p class="mt-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-[11px] font-bold text-accent">
          Documento en revisión legal — puede sufrir ajustes.
        </p>

        <div class="mt-6 space-y-6 text-sm leading-relaxed text-text-muted">
          <p class="text-xs italic">
            Conforme a la Ley Federal de Protección de Datos Personales en Posesión
            de los Particulares (LFPDPPP), su Reglamento y los Lineamientos del
            Aviso de Privacidad, o la normativa vigente que los sustituya.
          </p>

          <section>
            <h2 class="mb-2 text-sm font-black text-text-primary">1. Identidad y domicilio del responsable</h2>
            <p>
              <strong class="text-text-primary">[RAZÓN SOCIAL O NOMBRE DE LA PERSONA FÍSICA]</strong>
              (en adelante "RIR-HUB"), con domicilio en
              <strong class="text-text-primary">[DIRECCIÓN FISCAL COMPLETA, Ciudad, C.P., México]</strong>,
              es responsable del tratamiento de tus datos personales.
            </p>
            <p class="mt-2">
              Contacto para temas de datos personales:
              <strong class="text-text-primary">rirhubcontact@gmail.com</strong>
            </p>
          </section>

          <section>
            <h2 class="mb-2 text-sm font-black text-text-primary">2. Datos personales que recabamos</h2>
            <p class="font-bold text-text-primary">a) De usuarios administrativos de la consola B2B (personal del gimnasio)</p>
            <ul class="mt-1 list-disc space-y-1 pl-5">
              <li>Nombre completo</li>
              <li>Correo electrónico</li>
              <li>Rol y sede asignada</li>
              <li>Registros de actividad dentro de la consola (auditoría operativa)</li>
            </ul>
            <p class="mt-3 font-bold text-text-primary">b) De visitantes y prospectos comerciales</p>
            <ul class="mt-1 list-disc space-y-1 pl-5">
              <li>Nombre, correo electrónico y teléfono proporcionados en contacto comercial</li>
            </ul>
            <p class="mt-3 font-bold text-text-primary">c) Datos de socios de gimnasios (procesados como encargado)</p>
            <p class="mt-1">
              Los datos de los socios finales de cada gimnasio (asistencias,
              membresías, reservas, pagos) son tratados por RIR-HUB
              <strong class="text-text-primary">en calidad de encargado</strong>, por cuenta
              y bajo instrucciones del gimnasio correspondiente, quien actúa como
              responsable frente a sus socios. Este aviso complementa, no sustituye,
              el aviso de privacidad del gimnasio.
            </p>
          </section>

          <section>
            <h2 class="mb-2 text-sm font-black text-text-primary">3. Finalidades</h2>
            <p class="font-bold text-text-primary">Primarias (necesarias)</p>
            <ul class="mt-1 list-disc space-y-1 pl-5">
              <li>Proveer, operar y mantener la plataforma RIR-HUB (app y consola)</li>
              <li>Autenticación y control de acceso de usuarios administrativos</li>
              <li>Soporte técnico y atención al usuario</li>
              <li>Cumplimiento de obligaciones contractuales con los gimnasios clientes</li>
            </ul>
            <p class="mt-3 font-bold text-text-primary">Secundarias (opcionales)</p>
            <ul class="mt-1 list-disc space-y-1 pl-5">
              <li>Comunicaciones comerciales y de seguimiento a prospectos</li>
              <li>Mejora del producto mediante métricas de uso agregadas y anonimizadas</li>
            </ul>
            <p class="mt-2">
              Si no deseas que tus datos sean tratados para finalidades secundarias,
              manifúestalo en <strong class="text-text-primary">rirhubcontact@gmail.com</strong>.
            </p>
          </section>

          <section>
            <h2 class="mb-2 text-sm font-black text-text-primary">4. Transferencias de datos personales</h2>
            <p>
              Tus datos pueden ser transferidos a los siguientes encargados/terceros,
              exclusivamente para operar el servicio:
            </p>
            <div class="mt-3 overflow-hidden rounded-xl border border-stroke">
              <table class="w-full text-xs">
                <thead>
                  <tr class="border-b border-stroke bg-base text-left text-text-dim">
                    <th class="px-4 py-2.5 font-bold">Tercero</th>
                    <th class="px-4 py-2.5 font-bold">Función</th>
                    <th class="px-4 py-2.5 font-bold">Ubicación</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-stroke">
                  <tr>
                    <td class="px-4 py-2.5 font-semibold text-text-primary">Google Firebase (Google LLC)</td>
                    <td class="px-4 py-2.5">Autenticación, base de datos, notificaciones push</td>
                    <td class="px-4 py-2.5">EE.UU.</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-2.5 font-semibold text-text-primary">Stripe, Inc.</td>
                    <td class="px-4 py-2.5">Procesamiento de pagos</td>
                    <td class="px-4 py-2.5">EE.UU.</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-2.5 font-semibold text-text-primary">Vercel, Inc.</td>
                    <td class="px-4 py-2.5">Hospedaje de la consola y API</td>
                    <td class="px-4 py-2.5">EE.UU.</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-2.5 font-semibold text-text-primary">Proveedor SMTP</td>
                    <td class="px-4 py-2.5">Envío de correos operativos</td>
                    <td class="px-4 py-2.5">[SEGÚN PROVEEDOR]</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="mt-3">
              No vendemos ni comercializamos datos personales. No se realizarán
              transferencias adicionales sin consentimiento, salvo las previstas en
              el artículo 37 de la LFPDPPP.
            </p>
          </section>

          <section>
            <h2 class="mb-2 text-sm font-black text-text-primary">5. Medios para ejercer derechos ARCO</h2>
            <p>
              Puedes ejercer tus derechos de
              <strong class="text-text-primary">Acceso, Rectificación, Cancelación u Oposición</strong>
              (ARCO), así como revocar tu consentimiento, enviando solicitud a
              <strong class="text-text-primary">rirhubcontact@gmail.com</strong> con:
            </p>
            <ul class="mt-1 list-disc space-y-1 pl-5">
              <li>Nombre completo y correo asociado a tu cuenta</li>
              <li>Descripción clara del derecho que deseas ejercer</li>
              <li>Documento que acredite tu identidad (si se requiere)</li>
            </ul>
            <p class="mt-2">
              RIR-HUB responderá en un plazo máximo de
              <strong class="text-text-primary">20 días hábiles</strong> y hará efectivo el
              derecho en los <strong class="text-text-primary">15 días hábiles</strong>
              siguientes, conforme a la normativa vigente.
            </p>
            <p class="mt-2">
              Nota: si eres socio de un gimnasio, tu responsable directo es el
              gimnasio; puedes ejercer ARCO ante ellos o ante nosotros y
              canalizaremos tu solicitud.
            </p>
          </section>

          <section>
            <h2 class="mb-2 text-sm font-black text-text-primary">6. Medios para revocar el consentimiento</h2>
            <p>
              Puedes revocar tu consentimiento en cualquier momento sin que se
              leguen efectos retroactivos, mediante correo a
              <strong class="text-text-primary">rirhubcontact@gmail.com</strong>. La revocación
              puede implicar la imposibilidad de seguir usando el servicio.
            </p>
          </section>

          <section>
            <h2 class="mb-2 text-sm font-black text-text-primary">7. Uso de tecnologías de rastreo</h2>
            <p>
              La consola B2B y la app utilizan tokens de sesión y notificaciones
              push. No utilizamos cookies de rastreo publicitario de terceros. Los
              eventos de interacción con anuncios dentro de la app se registran de
              forma agregada para métricas de desempeño de campañas (impresiones,
              toques, CTR).
            </p>
          </section>

          <section>
            <h2 class="mb-2 text-sm font-black text-text-primary">8. Medidas de seguridad</h2>
            <ul class="list-disc space-y-1 pl-5">
              <li>Acceso autenticado (Google/Apple) y autorización por rol y sede</li>
              <li>Reglas de seguridad en base de datos (Firestore Security Rules)</li>
              <li>Cifrado en tránsito (HTTPS/TLS) en todas las comunicaciones</li>
              <li>Los datos de tarjeta son procesados directamente por Stripe; RIR-HUB nunca almacena números de tarjeta</li>
              <li>Check-in por código QR vinculado a número de socio</li>
            </ul>
          </section>

          <section>
            <h2 class="mb-2 text-sm font-black text-text-primary">9. Cambios al aviso de privacidad</h2>
            <p>
              Cualquier modificación a este aviso se comunicará mediante la app, la
              consola o correo electrónico a la dirección registrada.
            </p>
          </section>

          <p class="border-t border-stroke pt-4 text-xs font-bold text-text-primary">
            Última actualización: [FECHA]
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
