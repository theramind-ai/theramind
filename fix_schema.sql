-- Execute this in your Supabase SQL Editor
ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes TEXT;
