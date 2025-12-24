-- Migration to add profile fields
-- Run this in Supabase SQL Editor

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS crp TEXT,
ADD COLUMN IF NOT EXISTS recovery_email TEXT;
