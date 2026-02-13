-- ============================================
-- QueueH: Migration for New Features
-- Run this in Supabase SQL Editor BEFORE deploy
-- ============================================

-- 1. Add 'rating' column to consultations table (for doctor rating feature)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'consultations' AND column_name = 'rating'
    ) THEN
        ALTER TABLE consultations ADD COLUMN rating smallint DEFAULT NULL CHECK (rating >= 1 AND rating <= 5);
    END IF;
END $$;

-- 2. Ensure 'credibility_score' column exists on profiles (for MyQueue cancel penalty)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'credibility_score'
    ) THEN
        ALTER TABLE profiles ADD COLUMN credibility_score integer DEFAULT 100;
    END IF;
END $$;

-- 3. Ensure 'doctor_id' FK exists on consultations
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'consultations' AND column_name = 'doctor_id'
    ) THEN
        ALTER TABLE consultations ADD COLUMN doctor_id uuid REFERENCES profiles(id);
    END IF;
END $$;

-- ============================================
-- Enable RLS on all tables (safe to re-run)
-- ============================================
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for consultations table
-- Drop then recreate to avoid conflicts
-- ============================================

-- Patients read their own consultations
DROP POLICY IF EXISTS "patients_read_own_consultations" ON consultations;
CREATE POLICY "patients_read_own_consultations" ON consultations
    FOR SELECT USING (auth.uid() = patient_id);

-- Doctors/Admins can read all consultations (for patient history feature)
DROP POLICY IF EXISTS "doctors_read_all_consultations" ON consultations;
CREATE POLICY "doctors_read_all_consultations" ON consultations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('doctor_online', 'doctor_opd', 'admin')
        )
    );

-- Patients can insert their own consultation requests
DROP POLICY IF EXISTS "patients_insert_consultations" ON consultations;
CREATE POLICY "patients_insert_consultations" ON consultations
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Patients can update their own consultations (cancel, submit rating)
DROP POLICY IF EXISTS "patients_update_own_consultations" ON consultations;
CREATE POLICY "patients_update_own_consultations" ON consultations
    FOR UPDATE USING (auth.uid() = patient_id);

-- Doctors/Admins can update any consultation (accept call, complete, add summary)
DROP POLICY IF EXISTS "doctors_update_consultations" ON consultations;
CREATE POLICY "doctors_update_consultations" ON consultations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('doctor_online', 'doctor_opd', 'admin')
        )
    );

-- Doctors/Admins can delete consultations (clear waiting list)
DROP POLICY IF EXISTS "doctors_delete_consultations" ON consultations;
CREATE POLICY "doctors_delete_consultations" ON consultations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('doctor_online', 'admin')
        )
    );

-- ============================================
-- RLS Policies for prescriptions table
-- ============================================

-- Patients read prescriptions for their consultations
DROP POLICY IF EXISTS "patients_read_own_prescriptions" ON prescriptions;
CREATE POLICY "patients_read_own_prescriptions" ON prescriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM consultations 
            WHERE consultations.id = prescriptions.consultation_id 
            AND consultations.patient_id = auth.uid()
        )
    );

-- Doctors/Admins read all prescriptions
DROP POLICY IF EXISTS "doctors_read_all_prescriptions" ON prescriptions;
CREATE POLICY "doctors_read_all_prescriptions" ON prescriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('doctor_online', 'doctor_opd', 'admin')
        )
    );

-- Doctors insert prescriptions
DROP POLICY IF EXISTS "doctors_insert_prescriptions" ON prescriptions;
CREATE POLICY "doctors_insert_prescriptions" ON prescriptions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('doctor_online', 'doctor_opd', 'admin')
        )
    );

-- Doctors update prescriptions
DROP POLICY IF EXISTS "doctors_update_prescriptions" ON prescriptions;
CREATE POLICY "doctors_update_prescriptions" ON prescriptions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('doctor_online', 'doctor_opd', 'admin')
        )
    );

-- Patients update prescriptions (confirm payment)
DROP POLICY IF EXISTS "patients_update_prescriptions" ON prescriptions;
CREATE POLICY "patients_update_prescriptions" ON prescriptions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM consultations 
            WHERE consultations.id = prescriptions.consultation_id 
            AND consultations.patient_id = auth.uid()
        )
    );

-- ============================================
-- RLS Policies for profiles table
-- ============================================

-- Anyone authenticated can read profiles (needed for doctor names in history)
DROP POLICY IF EXISTS "authenticated_read_profiles" ON profiles;
CREATE POLICY "authenticated_read_profiles" ON profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users update their own profile (including credibility score deduction)
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Admin update any profile (role changes, hospital assignment)
DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;
CREATE POLICY "admin_update_profiles" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Users insert their own profile (registration)
DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- RLS Policies for hospitals table
-- ============================================

-- Anyone can read hospitals
DROP POLICY IF EXISTS "anyone_read_hospitals" ON hospitals;
CREATE POLICY "anyone_read_hospitals" ON hospitals
    FOR SELECT USING (true);

-- Doctors/Admins can update hospitals (open/close)
DROP POLICY IF EXISTS "doctors_update_hospitals" ON hospitals;
CREATE POLICY "doctors_update_hospitals" ON hospitals
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('doctor_opd', 'admin')
        )
    );

-- Admins can insert/delete hospitals
DROP POLICY IF EXISTS "admin_manage_hospitals" ON hospitals;
CREATE POLICY "admin_manage_hospitals" ON hospitals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- ============================================
-- RLS Policies for queues table
-- ============================================

-- Anyone authenticated can read queues
DROP POLICY IF EXISTS "authenticated_read_queues" ON queues;
CREATE POLICY "authenticated_read_queues" ON queues
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Patients insert their own queue entries
DROP POLICY IF EXISTS "patients_insert_queues" ON queues;
CREATE POLICY "patients_insert_queues" ON queues
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Patients update their own queues (cancel)
DROP POLICY IF EXISTS "patients_update_own_queues" ON queues;
CREATE POLICY "patients_update_own_queues" ON queues
    FOR UPDATE USING (auth.uid() = user_id);

-- Doctors/Admins update any queue (call next, complete)
DROP POLICY IF EXISTS "doctors_update_queues" ON queues;
CREATE POLICY "doctors_update_queues" ON queues
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('doctor_opd', 'admin')
        )
    );

-- Admins delete queues
DROP POLICY IF EXISTS "admin_delete_queues" ON queues;
CREATE POLICY "admin_delete_queues" ON queues
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('doctor_opd', 'admin')
        )
    );

-- ============================================
-- Enable Realtime on tables (safe to re-run)
-- ============================================
DO $$ 
BEGIN
    -- These may error if already added, wrap in exception handler
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE consultations; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE profiles; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE hospitals; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE queues; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE prescriptions; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
