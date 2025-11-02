# Migration: Add Nationality and Passport Support

## 📋 Overview

This migration adds support for international students who don't have Chilean RUT.

**Date**: 2025-01-21
**Migration File**: `add-nationality-passport-columns.sql`

## 🎯 Changes Made

### New Columns Added to `students` table:

1. **`nationality`** (VARCHAR(20))
   - Values: `'CHILENA'` or `'EXTRANJERA'`
   - Default: `'CHILENA'` (for existing records)
   - NOT NULL

2. **`passport`** (VARCHAR(50))
   - For foreign students' passport number
   - NULL allowed (only required if nationality = EXTRANJERA)

### Modified Columns:

3. **`rut`**
   - Changed from NOT NULL to **NULLABLE**
   - Required only if nationality = CHILENA

### Constraints Added:

1. **`students_nationality_check`**
   - Ensures nationality is either 'CHILENA' or 'EXTRANJERA'

2. **`students_rut_or_passport_check`**
   - Chilean students: RUT must be present
   - Foreign students: Passport must be present

## 🚀 How to Execute Migration

### Option 1: Via Railway CLI (Recommended)

```bash
# Connect to Railway database
railway run psql

# Once connected, run the migration
\i add-nationality-passport-columns.sql

# Verify the changes
\d students
```

### Option 2: Via Direct psql Connection

```bash
# Replace with your Railway database credentials
PGPASSWORD=your_password psql \
  -h junction.proxy.rlwy.net \
  -U postgres \
  -d railway \
  -p 26187 \
  -f add-nationality-passport-columns.sql
```

### Option 3: Via Railway Dashboard

1. Go to Railway dashboard
2. Select your PostgreSQL database
3. Open "Query" tab
4. Copy and paste the SQL from `add-nationality-passport-columns.sql`
5. Click "Execute"

## ✅ Verification

After running the migration, verify with these queries:

```sql
-- Check new columns exist
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'students'
  AND column_name IN ('nationality', 'passport', 'rut')
ORDER BY ordinal_position;

-- Check constraints
SELECT
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'students'::regclass
  AND conname LIKE '%nationality%' OR conname LIKE '%passport%' OR conname LIKE '%rut%';

-- Verify existing records have default nationality
SELECT
    COUNT(*) as total_students,
    nationality
FROM students
GROUP BY nationality;
```

Expected results:
- All existing students should have `nationality = 'CHILENA'`
- RUT column should allow NULL
- Passport column should exist and be NULL for existing records

## 🔄 Rollback (if needed)

If you need to rollback this migration:

```sql
-- Drop constraints
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_rut_or_passport_check;
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_nationality_check;

-- Make RUT NOT NULL again (only if no NULL values)
ALTER TABLE students ALTER COLUMN rut SET NOT NULL;

-- Drop new columns
ALTER TABLE students DROP COLUMN IF EXISTS passport;
ALTER TABLE students DROP COLUMN IF EXISTS nationality;
```

## 📝 Next Steps After Migration

1. **Update Backend Models**:
   - Add `nationality` and `passport` fields to Student model
   - Update StudentService validation logic

2. **Update Backend Validation**:
   ```javascript
   // In StudentService.js or StudentController.js
   if (nationality === 'CHILENA') {
     // Validate RUT
     if (!rut) throw new Error('RUT is required for Chilean students');
   } else if (nationality === 'EXTRANJERA') {
     // Validate passport
     if (!passport) throw new Error('Passport is required for foreign students');
   }
   ```

3. **Update Frontend** (separate task):
   - Add nationality dropdown in ApplicationForm
   - Conditional rendering: RutInput for Chilean, Input for foreign
   - Update form validation

## ⚠️ Important Notes

- **Existing Data**: All existing students will automatically get `nationality = 'CHILENA'`
- **Backward Compatibility**: Chilean students can continue using RUT as before
- **Validation**: The CHECK constraint ensures data integrity at database level
- **Frontend**: Frontend changes will be made in a separate commit

## 🐛 Troubleshooting

**Issue**: Migration fails with "column already exists"
- **Solution**: The script uses `IF NOT EXISTS`, so it's safe to re-run

**Issue**: "violates check constraint"
- **Cause**: Trying to insert a student with neither RUT nor passport
- **Solution**: Ensure either RUT (for Chilean) or passport (for foreign) is provided

**Issue**: "rut cannot be null" error
- **Cause**: Migration didn't remove NOT NULL constraint
- **Solution**: Run: `ALTER TABLE students ALTER COLUMN rut DROP NOT NULL;`

## 📊 Testing After Migration

1. **Test Chilean student (existing behavior)**:
   ```sql
   INSERT INTO students (first_name, rut, nationality)
   VALUES ('Test Chilean', '12.345.678-9', 'CHILENA');
   ```

2. **Test foreign student (new behavior)**:
   ```sql
   INSERT INTO students (first_name, passport, nationality)
   VALUES ('Test Foreign', 'P123456', 'EXTRANJERA');
   ```

3. **Test validation (should FAIL)**:
   ```sql
   -- Should fail: Chilean student without RUT
   INSERT INTO students (first_name, nationality)
   VALUES ('Test Invalid', 'CHILENA');

   -- Should fail: Foreign student without passport
   INSERT INTO students (first_name, nationality)
   VALUES ('Test Invalid', 'EXTRANJERA');
   ```

## ✅ Success Criteria

Migration is successful if:
- [ ] All new columns exist with correct data types
- [ ] All CHECK constraints are active
- [ ] Existing students have `nationality = 'CHILENA'`
- [ ] Can insert Chilean student with RUT
- [ ] Can insert foreign student with passport
- [ ] Cannot insert student without proper identification

---

**Created by**: Claude Code Assistant
**Date**: 2025-01-21
**Related Issue**: Support for international students without Chilean RUT
