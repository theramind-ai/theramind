-- Add subscription fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active', -- active, past_due, canceled, incomplete
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS daily_requests_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_request_date DATE DEFAULT CURRENT_DATE;

-- Create enum for clarity (optional, using text check constraint is safer for migrations sometimes)
ALTER TABLE public.profiles ADD CONSTRAINT check_subscription_plan CHECK (subscription_plan IN ('free', 'plus', 'premium'));

-- Function to reset daily usage if date changed (can be called on request or scheduled)
-- For simplicity, we will handle the reset logic in the application code (Python) upon checking limits.

-- Restrict Appointments to Plus/Premium
-- Note: This policy assumes RLS is enabled on appointments
CREATE POLICY "Restrict appointments to Plus/Premium"
ON public.appointments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND subscription_plan IN ('plus', 'premium')
  )
);
