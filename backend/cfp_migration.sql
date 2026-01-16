-- Migration: CFP Compliance Adaptation & CRP Uniqueness
-- Date: 2026-01-16

-- 1. Add theoretical_approach to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS theoretical_approach TEXT DEFAULT 'Integrativa';

-- 2. Add clinical documentation fields to sessions
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS registro_descritivo TEXT,
ADD COLUMN IF NOT EXISTS hipoteses_clinicas TEXT,
ADD COLUMN IF NOT EXISTS direcoes_intervencao TEXT;

-- 3. Add UNIQUE constraint to CRP
-- WARNING: This may fail if there are already duplicate CRPs in the database.
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_crp_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_crp_key UNIQUE (crp);
    END IF;
END $$;

-- 4. Migration: Populate new fields from legacy ones
UPDATE public.sessions
SET registro_descritivo = summary,
    hipoteses_clinicas = insights
WHERE registro_descritivo IS NULL AND summary IS NOT NULL;

-- 5. Set default for direcoes_intervencao for old sessions
UPDATE public.sessions
SET direcoes_intervencao = 'Pode-se observar evolução clínica para futuras intervenções.'
WHERE direcoes_intervencao IS NULL AND registro_descritivo IS NOT NULL;
