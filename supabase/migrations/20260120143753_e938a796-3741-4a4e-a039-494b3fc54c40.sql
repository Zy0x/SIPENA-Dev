-- Create team_profiles table for About page
CREATE TABLE public.team_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_profiles ENABLE ROW LEVEL SECURITY;

-- Public read access for team profiles
CREATE POLICY "Team profiles are publicly readable" 
ON public.team_profiles 
FOR SELECT 
USING (is_active = true);

-- Create trigger for updated_at
CREATE TRIGGER update_team_profiles_updated_at
  BEFORE UPDATE ON public.team_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial team members
INSERT INTO public.team_profiles (name, role, description, order_index) VALUES
  ('Ali Ridho', 'Founder / Pengembang', 'Pengembang utama SIPENA', 1),
  ('Kana Noviyanti', 'Content Writer / QA & QC Control', 'Guru Sekolah Dasar', 2);