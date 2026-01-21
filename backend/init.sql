-- ############################################################################
-- THERAMIND DATABASE REBUILD (V2 - CFP COMPLIANT)
-- This script resets the entire public schema. 
-- WARNING: ALL DATA WILL BE LOST.
-- ############################################################################

-- 1. CLEANUP
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.copilot_messages CASCADE;
DROP TABLE IF EXISTS public.copilot_conversations CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user_profile CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column CASCADE;

-- 2. CORE TABLES

-- PATIENTS
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PROFILES (Centralized Identity & Settings)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    crp TEXT UNIQUE, -- Mandatory uniqueness for professionals
    theoretical_approach TEXT DEFAULT 'Integrativa',
    recovery_email TEXT,
    
    -- PIX / Financial
    pix_key TEXT,
    pix_key_type TEXT DEFAULT 'CPF',
    
    -- Terms of Use
    terms_accepted BOOLEAN DEFAULT FALSE,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    

    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SESSIONS (CFP Compliant Schema)
CREATE TABLE public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    audio_url TEXT,
    transcription TEXT,
    
    -- CFP Structure
    registro_descritivo TEXT,
    hipoteses_clinicas TEXT,
    direcoes_intervencao TEXT,
    temas_relevantes TEXT[],
    
    -- Legacy Compatibility Fields (mapped to above in code)
    summary TEXT,
    insights TEXT,
    themes TEXT[],

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- APPOINTMENTS
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 50,
    status TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
    
    -- Financial
    price DECIMAL(10,2) DEFAULT 0.00,
    payment_status TEXT DEFAULT 'pending',
    payment_method TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COPILOT CHAT
CREATE TABLE public.copilot_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.copilot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.copilot_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. SECURITY (RLS)
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

-- Policies: Patients
CREATE POLICY "Users can manage their own patients" ON public.patients 
    FOR ALL USING (auth.uid() = user_id);

-- Policies: Profiles
CREATE POLICY "Users can manage their own profile" ON public.profiles 
    FOR ALL USING (auth.uid() = id);

-- Policies: Sessions (Linked to owned patients)
CREATE POLICY "Users can manage their own sessions" ON public.sessions 
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.patients WHERE patients.id = sessions.patient_id AND patients.user_id = auth.uid())
    );

-- Policies: Appointments
CREATE POLICY "Users can manage their own appointments" ON public.appointments 
    FOR ALL USING (auth.uid() = user_id);

-- Policies: Copilot
CREATE POLICY "Users can manage their own conversations" ON public.copilot_conversations 
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own messages" ON public.copilot_messages 
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.copilot_conversations WHERE copilot_conversations.id = copilot_messages.conversation_id AND copilot_conversations.user_id = auth.uid())
    );

-- 4. TRIGGERS & FUNCTIONS

-- Ensure profile exists for every user
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ language plpgsql security definer;

CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_profile();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
CREATE TRIGGER update_copilot_updated_at BEFORE UPDATE ON public.copilot_conversations FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- ############################################################################
-- REBUILD COMPLETE
-- ############################################################################
