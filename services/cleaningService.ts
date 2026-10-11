import { createClient } from '@/lib/supabase/client'
import type { CleaningType } from '@/lib/cleaning/status'

const supabaseClient = createClient()

export interface CleaningLog {
  id: string
  vehicle_id: string
  type: CleaningType
  cleaning_date: string
  location: string
  performed_by: string | null
  product: string | null
  cost: number | null
  notes: string | null
  created_at: string
}

export type CleaningLogInput = Omit<CleaningLog, 'id' | 'created_at'>

export const cleaningService = {
  getLogs: async (): Promise<CleaningLog[]> => {
    const { data, error } = await supabaseClient
      .from('vehicle_cleaning_logs')
      .select('*')
      .order('cleaning_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  createLog: async (input: CleaningLogInput): Promise<CleaningLog> => {
    const { data, error } = await supabaseClient
      .from('vehicle_cleaning_logs')
      .insert(input)
      .select()
      .single()
    if (error) throw error
    return data
  },

  deleteLog: async (id: string): Promise<void> => {
    const { error } = await supabaseClient.from('vehicle_cleaning_logs').delete().eq('id', id)
    if (error) throw error
  },
}
