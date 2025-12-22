-- Run this script in your Supabase SQL Editor to fix the missing columns

-- Add missing columns to patients table
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add missing columns to sessions table (needed for the analysis features)
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS themes TEXT[];

-- Optional: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_patient_id ON sessions(patient_id);
