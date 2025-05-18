import { SupabaseExample } from '@/components/example-supabase-usage';

export default function SupabaseDemo() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Supabase Integration Demo</h1>
      <p className="mb-6 text-gray-600">
        This page demonstrates the integration with Supabase using the new supabaseClient implementation.
      </p>
      
      <SupabaseExample />
    </div>
  );
} 