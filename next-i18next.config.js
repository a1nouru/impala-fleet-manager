module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'pt'],
    localePath: './public/locales',
    defaultNS: 'common',
    fallbackLng: 'en',
  },
  reloadOnPrerender: process.env.NODE_ENV === 'development',
  saveMissing: false,
  debug: process.env.NODE_ENV === 'development',
  react: {
    useSuspense: false,
  },
} 