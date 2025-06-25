import { useTranslation as useReactI18nextTranslation } from 'react-i18next'

export const useTranslation = (namespace?: string) => {
  const { t, i18n } = useReactI18nextTranslation(namespace || 'common')
  
  const changeLanguage = async (locale: string) => {
    try {
      // Change the language in i18next
      await i18n.changeLanguage(locale)
      
      // Store preference in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('preferred-language', locale)
      }
      
      // Reload the page to apply the new locale properly
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    } catch (error) {
      console.error('Error changing language:', error)
    }
  }
  
  return {
    t,
    locale: i18n.language,
    isLoading: !i18n.isInitialized,
    changeLanguage,
    isPortuguese: i18n.language === 'pt',
    isEnglish: i18n.language === 'en',
  }
}

// Helper function to get language preference from localStorage
export const getStoredLanguagePreference = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('preferred-language')
  }
  return null
}

// Helper function to format currency based on locale
export const formatCurrency = (amount: number, locale?: string): string => {
  const currentLocale = locale || 'en'
  
  if (currentLocale === 'pt') {
    return `${amount.toLocaleString('pt-PT')} Kz`
  }
  
  return `${amount.toLocaleString('en-US')} Kz`
}

// Helper function to format date based on locale
export const formatDate = (date: string | Date, locale?: string): string => {
  const currentLocale = locale || 'en'
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (currentLocale === 'pt') {
    return dateObj.toLocaleDateString('pt-PT')
  }
  
  return dateObj.toLocaleDateString('en-US')
} 