export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  modules: ['@nuxt/ui'],

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

  colorMode: {
    preference: 'dark',
  },

  runtimeConfig: {
    public: {
      firebaseConfig: '',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
});
