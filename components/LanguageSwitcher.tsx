"use client";

import { Button } from '@/components/ui/button'
import { useTranslation } from '@/hooks/useTranslation'
import { Globe } from 'lucide-react'
import { useState } from 'react'

export function LanguageSwitcher() {
  const { locale, changeLanguage, isLoading } = useTranslation('common')
  const [switching, setSwitching] = useState(false)
  
  const toggleLanguage = async () => {
    if (switching || isLoading) return
    
    setSwitching(true)
    try {
      const newLocale = locale === 'en' ? 'pt' : 'en'
      await changeLanguage(newLocale)
    } catch (error) {
      console.error('Error switching language:', error)
    } finally {
      setSwitching(false)
    }
  }
  
  const getLanguageDisplay = () => {
    if (switching) return '...'
    return locale === 'en' ? '🇵🇹 PT' : '🇬🇧 EN'
  }
  
  const getTooltip = () => {
    return locale === 'en' ? 'Switch to Portuguese' : 'Mudar para Inglês'
  }
  
  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={toggleLanguage}
      disabled={switching || isLoading}
      className="flex items-center gap-2 min-w-[80px]"
      title={getTooltip()}
    >
      <Globe className="h-4 w-4" />
      <span className="text-sm font-medium">
        {getLanguageDisplay()}
      </span>
    </Button>
  )
}

// Compact version for mobile/tight spaces
export function LanguageSwitcherCompact() {
  const { locale, changeLanguage, isLoading } = useTranslation('common')
  const [switching, setSwitching] = useState(false)
  
  const toggleLanguage = async () => {
    if (switching || isLoading) return
    
    setSwitching(true)
    try {
      const newLocale = locale === 'en' ? 'pt' : 'en'
      await changeLanguage(newLocale)
    } catch (error) {
      console.error('Error switching language:', error)
    } finally {
      setSwitching(false)
    }
  }
  
  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={toggleLanguage}
      disabled={switching || isLoading}
      className="h-8 w-12 p-0"
      title={locale === 'en' ? 'Switch to Portuguese' : 'Mudar para Inglês'}
    >
      <span className="text-xs font-medium">
        {switching ? '...' : (locale === 'en' ? 'PT' : 'EN')}
      </span>
    </Button>
  )
} 