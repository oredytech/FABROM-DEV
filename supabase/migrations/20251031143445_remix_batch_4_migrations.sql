
-- Migration: 20251030131157

-- Migration: 20251030121842

-- Migration: 20251030114314
-- Create table for conversation history
CREATE TABLE public.conversation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  files JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for file versions
CREATE TABLE public.file_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversation_history(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no authentication required for this app)
CREATE POLICY "Allow all access to conversation_history" 
ON public.conversation_history 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all access to file_versions" 
ON public.file_versions 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_conversation_user_project ON public.conversation_history(user_id, project_name);
CREATE INDEX idx_file_versions_conversation ON public.file_versions(conversation_id);
CREATE INDEX idx_file_versions_file_name ON public.file_versions(file_name);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for conversation_history
CREATE TRIGGER update_conversation_history_updated_at
BEFORE UPDATE ON public.conversation_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251030114333
-- Fix function search path with CASCADE
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Recreate trigger for conversation_history
CREATE TRIGGER update_conversation_history_updated_at
BEFORE UPDATE ON public.conversation_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- Migration: 20251030122049
-- Create conversation_history table if not exists
CREATE TABLE IF NOT EXISTS public.conversation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  files JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create file_versions table if not exists
CREATE TABLE IF NOT EXISTS public.file_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversation_history(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON public.conversation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_project ON public.conversation_history(project_name);
CREATE INDEX IF NOT EXISTS idx_file_versions_conversation ON public.file_versions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_file_versions_filename ON public.file_versions(file_name);

-- Enable Row Level Security
ALTER TABLE public.conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Allow all operations on conversation_history" ON public.conversation_history;
DROP POLICY IF EXISTS "Allow all operations on file_versions" ON public.file_versions;

CREATE POLICY "Allow all operations on conversation_history"
  ON public.conversation_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on file_versions"
  ON public.file_versions
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- Migration: 20251030133020
-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$;

-- Trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251031074120
-- Fix RLS policies for security (corrected)

-- 1. Fix profiles table - only allow users to see their own profile
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- The update and insert policies already exist, so we skip them

-- 2. Fix conversation_history table - restrict to user's own conversations
DROP POLICY IF EXISTS "Allow all access to conversation_history" ON conversation_history;
DROP POLICY IF EXISTS "Allow all operations on conversation_history" ON conversation_history;

CREATE POLICY "Users can view their own conversations"
  ON conversation_history FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON conversation_history FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own conversations"
  ON conversation_history FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON conversation_history FOR DELETE
  USING (auth.uid()::text = user_id);

-- 3. Fix file_versions table - restrict to user's own files via conversation ownership
DROP POLICY IF EXISTS "Allow all access to file_versions" ON file_versions;
DROP POLICY IF EXISTS "Allow all operations on file_versions" ON file_versions;

CREATE POLICY "Users can view their own file versions"
  ON file_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_history 
      WHERE conversation_history.id = file_versions.conversation_id 
      AND conversation_history.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert their own file versions"
  ON file_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_history 
      WHERE conversation_history.id = file_versions.conversation_id 
      AND conversation_history.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can update their own file versions"
  ON file_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_history 
      WHERE conversation_history.id = file_versions.conversation_id 
      AND conversation_history.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete their own file versions"
  ON file_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM conversation_history 
      WHERE conversation_history.id = file_versions.conversation_id 
      AND conversation_history.user_id = auth.uid()::text
    )
  );

-- Migration: 20251031074525
-- Add DELETE policy for profiles table to allow users to delete their own data
CREATE POLICY "Users can delete their own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);
