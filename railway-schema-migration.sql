-- =====================================================
-- RAILWAY DATABASE SCHEMA MIGRATION
-- Purpose: Align Railway DB schema with local DB
-- Date: 2025-10-22
-- =====================================================

-- This script adds missing columns that exist in local DB
-- but may not exist in Railway DB

-- =====================================================
-- 1. DOCUMENTS TABLE - Add approval columns
-- =====================================================
DO $$
BEGIN
    -- Add approval_status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='documents' AND column_name='approval_status'
    ) THEN
        ALTER TABLE documents
        ADD COLUMN approval_status VARCHAR(50) DEFAULT 'PENDING';

        ALTER TABLE documents
        ADD CONSTRAINT documents_approval_status_check
        CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
    END IF;

    -- Add approved_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='documents' AND column_name='approved_by'
    ) THEN
        ALTER TABLE documents
        ADD COLUMN approved_by BIGINT;

        -- Add FK constraint if users table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users') THEN
            ALTER TABLE documents
            ADD CONSTRAINT fk_documents_approved_by
            FOREIGN KEY (approved_by) REFERENCES users(id);
        END IF;
    END IF;

    -- Add approval_date column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='documents' AND column_name='approval_date'
    ) THEN
        ALTER TABLE documents
        ADD COLUMN approval_date TIMESTAMP;
    END IF;

    -- Add rejection_reason column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='documents' AND column_name='rejection_reason'
    ) THEN
        ALTER TABLE documents
        ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

-- =====================================================
-- 2. STUDENTS TABLE - Add optional columns
-- =====================================================
DO $$
BEGIN
    -- Add pais column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='pais'
    ) THEN
        ALTER TABLE students
        ADD COLUMN pais VARCHAR(100) DEFAULT 'Chile';
    END IF;

    -- Add region column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='region'
    ) THEN
        ALTER TABLE students
        ADD COLUMN region VARCHAR(100);
    END IF;

    -- Add comuna column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='comuna'
    ) THEN
        ALTER TABLE students
        ADD COLUMN comuna VARCHAR(100);
    END IF;

    -- Add admission_preference column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='admission_preference'
    ) THEN
        ALTER TABLE students
        ADD COLUMN admission_preference VARCHAR(50);
    END IF;

    -- Add target_school column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='target_school'
    ) THEN
        ALTER TABLE students
        ADD COLUMN target_school VARCHAR(50) DEFAULT 'MONTE_TABOR';
    END IF;

    -- Add age column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='age'
    ) THEN
        ALTER TABLE students
        ADD COLUMN age INTEGER;
    END IF;

    -- Add special category columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='is_employee_child'
    ) THEN
        ALTER TABLE students
        ADD COLUMN is_employee_child BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='employee_parent_name'
    ) THEN
        ALTER TABLE students
        ADD COLUMN employee_parent_name VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='is_alumni_child'
    ) THEN
        ALTER TABLE students
        ADD COLUMN is_alumni_child BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='alumni_parent_year'
    ) THEN
        ALTER TABLE students
        ADD COLUMN alumni_parent_year INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='is_inclusion_student'
    ) THEN
        ALTER TABLE students
        ADD COLUMN is_inclusion_student BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='inclusion_type'
    ) THEN
        ALTER TABLE students
        ADD COLUMN inclusion_type VARCHAR(100);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='inclusion_notes'
    ) THEN
        ALTER TABLE students
        ADD COLUMN inclusion_notes TEXT;
    END IF;
END $$;

-- =====================================================
-- 3. GUARDIANS TABLE - Add optional columns
-- =====================================================
DO $$
BEGIN
    -- Add profession column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='guardians' AND column_name='profession'
    ) THEN
        ALTER TABLE guardians
        ADD COLUMN profession VARCHAR(255);
    END IF;

    -- Add workplace column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='guardians' AND column_name='workplace'
    ) THEN
        ALTER TABLE guardians
        ADD COLUMN workplace VARCHAR(255);
    END IF;
END $$;

-- =====================================================
-- 4. APPLICATIONS TABLE - Add optional columns
-- =====================================================
DO $$
BEGIN
    -- Add deleted_at column if it doesn't exist (soft delete)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='applications' AND column_name='deleted_at'
    ) THEN
        ALTER TABLE applications
        ADD COLUMN deleted_at TIMESTAMP;
    END IF;

    -- Add is_archived column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='applications' AND column_name='is_archived'
    ) THEN
        ALTER TABLE applications
        ADD COLUMN is_archived BOOLEAN DEFAULT false NOT NULL;
    END IF;
END $$;

-- =====================================================
-- 5. PARENTS TABLE - Add workplace column
-- =====================================================
DO $$
BEGIN
    -- Add workplace column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='parents' AND column_name='workplace'
    ) THEN
        ALTER TABLE parents
        ADD COLUMN workplace VARCHAR(255);
    END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this after migration to verify all columns exist:
/*
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('students', 'applications', 'parents', 'guardians', 'supporters', 'documents')
ORDER BY table_name, ordinal_position;
*/
