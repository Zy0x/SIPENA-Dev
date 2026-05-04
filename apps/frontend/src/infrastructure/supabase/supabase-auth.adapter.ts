import type { AuthPort } from "@/core/ports/auth.port";
import { mapProviderError } from "@/core/errors/error-mapper";
import { supabaseExternal } from "./supabase-client";
import { mapSupabaseSession, mapSupabaseUser } from "./supabase.mapper";

export class SupabaseAuthAdapter implements AuthPort {
  async login(email: string, password: string) {
    const { data, error } = await supabaseExternal.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw mapProviderError(error, "Supabase login failed");
    return mapSupabaseSession(data.session);
  }

  async register(email: string, password: string) {
    const { data, error } = await supabaseExternal.auth.signUp({ email, password });
    if (error || !data.session) throw mapProviderError(error, "Supabase register failed");
    return mapSupabaseSession(data.session);
  }

  async logout() {
    const { error } = await supabaseExternal.auth.signOut();
    if (error) throw mapProviderError(error, "Supabase logout failed");
  }

  async getCurrentUser() {
    const { data, error } = await supabaseExternal.auth.getUser();
    if (error) throw mapProviderError(error, "Supabase get user failed");
    return mapSupabaseUser(data.user);
  }

  async refreshSession() {
    const { data, error } = await supabaseExternal.auth.refreshSession();
    if (error) throw mapProviderError(error, "Supabase refresh session failed");
    return data.session ? mapSupabaseSession(data.session) : null;
  }
}
