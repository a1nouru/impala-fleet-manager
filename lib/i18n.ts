"use client";

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

const isClient = typeof window !== 'undefined'

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'maintenance'],
    
    lng: isClient ? localStorage.getItem('preferred-language') || 'en' : 'en',
    
    interpolation: {
      escapeValue: false,
    },
    
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      crossDomain: true,
      allowMultiLoading: false,
      requestOptions: {
        mode: 'cors',
        credentials: 'same-origin',
        cache: 'default'
      }
    },
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'preferred-language',
    },
    
    react: {
      useSuspense: false,
    },
    
    supportedLngs: ['en', 'pt'],
    load: 'languageOnly',
    debug: false,
    
    saveMissing: false,
    saveMissingTo: 'fallback',
    
    partialBundledLanguages: true,
    preload: ['en', 'pt'],
    cleanCode: true,
    
    // Completely disable fallback namespace loading
    fallbackNS: false,
    
    keySeparator: '.',
    nsSeparator: ':',
    
    returnEmptyString: false,
    returnNull: false,
    returnObjects: false,
  })

export default i18n 