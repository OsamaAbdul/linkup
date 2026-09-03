import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import { SavedAddress } from '../types';
import { toast } from 'sonner';

const LOCAL_STORAGE_KEY = 'linkup_send_saved_addresses';

export function useSavedAddresses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: addresses = [], isLoading } = useQuery<SavedAddress[]>({
    queryKey: ['send_saved_addresses', user?.id],
    queryFn: async () => {
      if (!user) {
        try {
          const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
          return stored ? JSON.parse(stored) : [];
        } catch {
          return [];
        }
      }

      const { data, error } = await (supabase as any)
        .from('send_saved_addresses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not fetch remote saved addresses, falling back to local:', error);
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      }

      return data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 mins
  });

  const saveAddressMutation = useMutation({
    mutationFn: async (newAddress: Omit<SavedAddress, 'id' | 'user_id' | 'created_at'>) => {
      const addressObj: SavedAddress = {
        ...newAddress,
        id: crypto.randomUUID ? crypto.randomUUID() : `addr_${Date.now()}`,
        user_id: user?.id || 'guest',
        created_at: new Date().toISOString(),
      };

      if (user) {
        const { data, error } = await (supabase as any)
          .from('send_saved_addresses')
          .insert({
            user_id: user.id,
            label: addressObj.label,
            type: addressObj.type,
            contact_name: addressObj.contact_name,
            contact_phone: addressObj.contact_phone,
            address: addressObj.address,
            directions: addressObj.directions,
            latitude: addressObj.latitude,
            longitude: addressObj.longitude,
          })
          .select()
          .single();

        if (!error && data) {
          return data as SavedAddress;
        }
      }

      // Also persist to localStorage for instant availability
      const current = (() => {
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      })();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([addressObj, ...current]));
      return addressObj;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['send_saved_addresses', user?.id] });
      toast.success('Address saved for future deliveries');
    },
    onError: (err: any) => {
      toast.error('Failed to save address: ' + err.message);
    },
  });

  return {
    addresses,
    isLoading,
    saveAddress: saveAddressMutation.mutateAsync,
    isSaving: saveAddressMutation.isPending,
  };
}
