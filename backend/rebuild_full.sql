-- DANGER: DATA LOSS
-- This script completely resets the public schema for the application.

-- 1. DROP EVERYTHING
-- Note: DROP TABLE ... CASCADE automatically drops associated triggers.
-- We must drop tables in dependency order (dependents first) or just use CASCADE.

DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS copilot_messages CASCADE;
DROP TABLE IF EXISTS copilot_conversations CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS patients CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- 2. CREATE BASE TABLES (from schema_full.sql)

-- PATIENTS
CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    audio_url TEXT,
    transcription TEXT,
    summary TEXT,
    insights TEXT,
    themes TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COPILOT CONVERSATIONS
CREATE TABLE IF NOT EXISTS copilot_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- COPILOT MESSAGES
CREATE TABLE IF NOT EXISTS copilot_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS FOR BASE TABLES
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own patients" ON patients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own patients" ON patients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own patients" ON patients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own patients" ON patients FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- Sessions are linked to patients, so we check if the patient belongs to the user
CREATE POLICY "Users can view their own sessions" ON sessions FOR SELECT USING (
    EXISTS (SELECT 1 FROM patients WHERE patients.id = sessions.patient_id AND patients.user_id = auth.uid())
);
CREATE POLICY "Users can insert their own sessions" ON sessions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM patients WHERE patients.id = sessions.patient_id AND patients.user_id = auth.uid())
);
CREATE POLICY "Users can update their own sessions" ON sessions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM patients WHERE patients.id = sessions.patient_id AND patients.user_id = auth.uid())
);
CREATE POLICY "Users can delete their own sessions" ON sessions FOR DELETE USING (
    EXISTS (SELECT 1 FROM patients WHERE patients.id = sessions.patient_id AND patients.user_id = auth.uid())
);

ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own conversations" ON copilot_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own conversations" ON copilot_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations" ON copilot_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversations" ON copilot_conversations FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;
-- Messages are linked to conversations
CREATE POLICY "Users can view their own messages" ON copilot_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM copilot_conversations WHERE copilot_conversations.id = copilot_messages.conversation_id AND copilot_conversations.user_id = auth.uid())
);
CREATE POLICY "Users can insert their own messages" ON copilot_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM copilot_conversations WHERE copilot_conversations.id = copilot_messages.conversation_id AND copilot_conversations.user_id = auth.uid())
);


-- 3. CREATE FINANCIAL TABLES (from financial_migration.sql)

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    crp TEXT,
    recovery_email TEXT,
    pix_key TEXT,
    pix_key_type TEXT, -- 'CPF', 'EMAIL', 'PHONE', 'RANDOM', etc.
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 50,
    status TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
    
    -- Financial fields
    price DECIMAL(10,2) DEFAULT 0.00,
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
    payment_method TEXT, -- 'pix', 'money', 'card', etc.
    paid_at TIMESTAMP WITH TIME ZONE,
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own appointments" ON appointments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own appointments" ON appointments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own appointments" ON appointments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own appointments" ON appointments FOR DELETE USING (auth.uid() = user_id);

-- TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
