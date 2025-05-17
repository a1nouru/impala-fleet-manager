import { supabase } from '../lib/supabase'

export const technicianService = {
  getTechnicians: async () => {
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('active', true)
      .order('name')
    
    if (error) throw error
    return data
  }
} 