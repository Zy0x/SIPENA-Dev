import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabaseExternal as supabase } from '@/lib/supabase-external';
import { useAuth } from './AuthContext';

interface AvatarContextType {
  avatarUrl: string | null;
  isLoading: boolean;
  refreshAvatar: () => Promise<void>;
  updateAvatar: (url: string) => void;
}

const AvatarContext = createContext<AvatarContextType | undefined>(undefined);

export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadAvatar = useCallback(async () => {
    if (!user?.id) {
      setAvatarUrl(null);
      return;
    }

    setIsLoading(true);
    try {
      // Priority: Supabase storage > Google avatar
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(`${user.id}/avatar`);

      const response = await fetch(data.publicUrl, { method: 'HEAD' });
      if (response.ok) {
        setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
      } else if (user.user_metadata?.avatar_url) {
        // Fallback to Google avatar
        setAvatarUrl(user.user_metadata.avatar_url);
      } else {
        setAvatarUrl(null);
      }
    } catch (error) {
      console.log('No avatar found');
      // Fallback to Google avatar
      if (user.user_metadata?.avatar_url) {
        setAvatarUrl(user.user_metadata.avatar_url);
      } else {
        setAvatarUrl(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.user_metadata?.avatar_url]);

  useEffect(() => {
    loadAvatar();
  }, [loadAvatar]);

  const refreshAvatar = useCallback(async () => {
    await loadAvatar();
  }, [loadAvatar]);

  const updateAvatar = useCallback((url: string) => {
    setAvatarUrl(url);
  }, []);

  return (
    <AvatarContext.Provider value={{ avatarUrl, isLoading, refreshAvatar, updateAvatar }}>
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatar() {
  const context = useContext(AvatarContext);
  if (context === undefined) {
    throw new Error('useAvatar must be used within an AvatarProvider');
  }
  return context;
}
