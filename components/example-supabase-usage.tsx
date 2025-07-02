"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { vehicleService } from '@/services/supabaseService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export function SupabaseExample() {
  const { user, signOut, loading: authLoading } = useAuth();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState({
    vehicles: true,
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch vehicles on component mount
  useEffect(() => {
    async function fetchVehicles() {
      try {
        setLoading(prev => ({ ...prev, vehicles: true }));
        const data = await vehicleService.getVehicles();
        setVehicles(data);
      } catch (err) {
        console.error('Error fetching vehicles:', err);
        setError('Failed to fetch vehicles. Please try again later.');
      } finally {
        setLoading(prev => ({ ...prev, vehicles: false }));
      }
    }

    fetchVehicles();
  }, []);

  const handleAddVehicle = async () => {
    try {
      setLoading(prev => ({ ...prev, vehicles: true }));
      
      // Example vehicle data
      const newVehicle = {
        plate: `Sample-${Math.floor(Math.random() * 1000)}`,
        model: 'Sample Model',
        created_at: new Date().toISOString()
      };
      
      // Add new vehicle
      await vehicleService.createVehicle(newVehicle);
      
      // Refresh the list
      const updatedVehicles = await vehicleService.getVehicles();
      setVehicles(updatedVehicles);
      
    } catch (err) {
      console.error('Error adding vehicle:', err);
      setError('Failed to add sample vehicle. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, vehicles: false }));
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // No need to set user to null, the context will handle it
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Failed to sign out. Please try again.');
    }
  };

  if (loading.vehicles || authLoading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading data...</span>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Supabase Integration Example</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Authentication Status</h3>
          {user ? (
            <div>
              <p className="mb-2">Logged in as: <span className="font-bold">{user.email}</span></p>
              <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
            </div>
          ) : (
            <p>Not logged in</p>
          )}
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Vehicles ({vehicles.length})</h3>
            <Button onClick={handleAddVehicle}>Add Sample Vehicle</Button>
          </div>
          
          {vehicles.length === 0 ? (
            <p className="text-gray-500">No vehicles found. Add one to get started.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Plate</th>
                    <th className="p-2 text-left">Model</th>
                    <th className="p-2 text-left">Added On</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="border-t">
                      <td className="p-2">{vehicle.plate}</td>
                      <td className="p-2">{vehicle.model}</td>
                      <td className="p-2">
                        {new Date(vehicle.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500">
          <p className="mb-1">This example demonstrates:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Fetching and displaying data from Supabase</li>
            <li>Creating new records</li>
            <li>User authentication status</li>
            <li>Error handling</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
} 