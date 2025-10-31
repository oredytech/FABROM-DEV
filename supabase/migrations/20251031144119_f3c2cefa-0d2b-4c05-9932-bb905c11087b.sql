-- Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS public.file_versions CASCADE;
DROP TABLE IF EXISTS public.conversation_history CASCADE;

-- Create conversation_history table
CREATE TABLE public.conversation_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  files JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own conversations" 
ON public.conversation_history 
FOR ALL
USING (user_id::text = auth.uid()::text);

-- Create file_versions table
CREATE TABLE public.file_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own file versions" 
ON public.file_versions 
FOR ALL
USING (
  conversation_id IN (
    SELECT id FROM public.conversation_history 
    WHERE user_id::text = auth.uid()::text
  )
);

-- Add foreign key
ALTER TABLE public.file_versions
ADD CONSTRAINT fk_conversation
FOREIGN KEY (conversation_id) 
REFERENCES public.conversation_history(id) 
ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_conversation_history_user_id ON public.conversation_history(user_id);
CREATE INDEX idx_file_versions_conversation_id ON public.file_versions(conversation_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_conversation_history_updated_at
BEFORE UPDATE ON public.conversation_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();