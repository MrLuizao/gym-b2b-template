export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  modules: ['@nuxt/ui'],

  /* App dark-only: el color-mode module prioriza localStorage sobre
     preference y cualquier valor viejo deja los componentes Nuxt UI en
     light — se desactiva y la clase `dark` va fija en htmlAttrs */
  ui: { colorMode: false },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'RIR-HUB',
      htmlAttrs: { lang: 'es' },
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      firebaseConfig: '',
      /// App Check web (reCAPTCHA Enterprise) — site key de Firebase
      /// Console → App Check → registrar app web. Vacío = no se activa.
      recaptchaSiteKey: '',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
});
