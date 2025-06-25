import supabaseClient from '../lib/supabaseClient'

export const technicianService = {
  getTechnicians: async () => {
    const { data, error } = await supabaseClient
      .from('technicians')
      .select('*')
      .eq('active', true)
      .order('name')
    
    if (error) throw error
    return data
  }
} 