import { createClient } from '@/lib/supabase/client';
import { busParts } from '../data/partsData'

const supabaseClient = createClient();

// Initialize local storage for custom parts if it doesn't exist
const initializeLocalStorage = () => {
  if (typeof window !== 'undefined') {
    if (!localStorage.getItem('custom_parts')) {
      localStorage.setItem('custom_parts', JSON.stringify([]));
    }
  }
};

// Load custom parts from local storage
const loadCustomParts = () => {
  if (typeof window !== 'undefined') {
    initializeLocalStorage();
    try {
      const customParts = JSON.parse(localStorage.getItem('custom_parts') || '[]');
      return customParts;
    } catch (error) {
      console.error('Error loading custom parts:', error);
      return [];
    }
  }
  return [];
};

// Save custom parts to local storage
const saveCustomParts = (customParts) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('custom_parts', JSON.stringify(customParts));
    } catch (error) {
      console.error('Error saving custom parts:', error);
    }
  }
};

export const partService = {
  getPartsByCategory: async () => {
    try {
      // Get custom parts from local storage
      const customParts = loadCustomParts();
      
      // Transform our hardcoded data to match the format expected by the application
      const formattedData = busParts.map(category => {
        // Find custom parts for this category
        const categoryCustomParts = customParts
          .filter(part => part.category === category.category)
          .map(part => ({
            id: `custom-${part.name.replace(/\s+/g, '-').toLowerCase()}`,
            name: part.name
          }));
        
        return {
          id: category.category.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          name: category.category,
          parts: [
            ...category.items.map(item => ({
              id: item.id,
              name: item.name
            })),
            ...categoryCustomParts
          ]
        };
      });
      
      return formattedData;
    } catch (error) {
      console.error('Error getting parts data:', error);
      throw error;
    }
    
    // Commented out Supabase implementation for reference
    /*
    const { data, error } = await supabase
      .from('part_categories')
      .select(`
        id,
        name,
        parts(id, name)
      `)
      .order('name')
    
    if (error) throw error
    return data
    */
  },
  
  // Add a custom part
  addCustomPart: async (category, name) => {
    try {
      // Ensure name doesn't end with (Custom)
      const partName = name.endsWith(' (Custom)') 
        ? name.slice(0, -9) // Remove " (Custom)" from end
        : name;
      
      // Load existing custom parts
      const customParts = loadCustomParts();
      
      // Check if part already exists
      const partExists = customParts.some(part => 
        part.category === category && part.name === partName
      );
      
      if (!partExists) {
        // Add new custom part
        customParts.push({
          category,
          name: partName
        });
        
        // Save updated custom parts
        saveCustomParts(customParts);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error adding custom part:', error);
      throw error;
    }
  }
} 