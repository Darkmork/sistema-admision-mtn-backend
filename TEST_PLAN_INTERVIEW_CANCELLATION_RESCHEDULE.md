# Test Plan: Interview Cancellation and Rescheduling Feature

**Feature Branch:** `feature/interview-cancellation-reschedule`
**Date:** November 3, 2025
**Status:** Ready for Testing

---

## Overview

This document provides a comprehensive test plan for the interview cancellation and rescheduling feature implementation.

### Components Implemented

1. **Database Changes (Completed)**
   - Added `RESCHEDULED` status to interviews
   - Created `interview_history` table for audit trail
   - Added cancellation fields to `interviews` table
   - Created automatic history tracking trigger
   - Migration file: `database-migrations/001-add-interview-cancellation-support.sql`

2. **Backend API (Completed)**
   - `PATCH /api/interviews/:id/cancel` - Cancel interview with reason
   - `PATCH /api/interviews/:id/reschedule` - Reschedule interview with new date/time/reason
   - Automatic schedule liberation (interviewer_schedules)
   - Service: `evaluation-service`

3. **Email Templates (Completed)**
   - `interview-cancelled.hbs` - Cancellation notification template
   - `interview-rescheduled.hbs` - Rescheduling notification template
   - Service: `notification-service`

4. **Frontend UI (Completed)**
   - `CancelInterviewModal.tsx` - Modal for cancellation with validation
   - `RescheduleInterviewModal.tsx` - Modal for rescheduling with DayScheduleSelector
   - Updated `InterviewManagement.tsx` - Integration with modals
   - Updated `interviewService.ts` - Service methods for API calls

---

## Prerequisites for Testing

### 1. Backend Services

Ensure the following services are running and up-to-date:

- **evaluation-service** (Port 8084 local, Railway deployed)
- **notification-service** (Port 8085 local, Railway deployed)
- **user-service** (Port 8082 local, Railway deployed)
- **gateway-service** (Port 8080 local, Railway deployed)
- **PostgreSQL Database** (Port 5432, with migration applied)

### 2. Frontend

- **Frontend dev server** running on http://localhost:5175
- Or deployed to Vercel: https://admision-mtn-frontend.vercel.app

### 3. Test Data Requirements

You need:
- At least one SCHEDULED interview in the database
- Valid interviewer(s) with available schedule slots
- Valid student application associated with the interview
- Valid guardian email address for notifications

---

## Test Cases

### Test Case 1: Cancel Interview - Happy Path

**Objective:** Verify that users can successfully cancel an interview with a valid reason.

**Preconditions:**
- User is authenticated as ADMIN or COORDINATOR
- At least one interview exists with status = 'SCHEDULED'

**Steps:**
1. Navigate to Interview Management page
2. Locate a SCHEDULED interview in the table
3. Click the red "Cancel" button (X icon)
4. Verify the CancelInterviewModal opens
5. Observe that the modal displays:
   - Interview details (student name, type, date, time, interviewer(s))
   - Red warning alert
   - Empty textarea for cancellation reason
6. Enter a cancellation reason (less than 10 characters)
7. Verify error message: "El motivo debe tener al menos 10 caracteres"
8. Enter a valid cancellation reason (at least 10 characters)
9. Click "Cancelar Entrevista" button
10. Verify loading state shows "Cancelando..."

**Expected Results:**
- Modal closes after successful submission
- Success toast message: "Entrevista cancelada exitosamente"
- Interview table refreshes
- Interview status changes to 'CANCELLED' in the database
- Interview disappears from SCHEDULED list or shows CANCELLED status
- `interview_history` table has new record with action='CANCELLED'
- Cancellation email sent to guardian and interviewer
- Interviewer schedule slot is liberated (available again)

**Database Verification:**
```sql
-- Check interview status and cancellation details
SELECT id, status, cancelled_at, cancelled_by, cancellation_reason
FROM interviews
WHERE id = [INTERVIEW_ID];

-- Check history record
SELECT * FROM interview_history
WHERE interview_id = [INTERVIEW_ID] AND action = 'CANCELLED'
ORDER BY performed_at DESC
LIMIT 1;

-- Check schedule was liberated
SELECT * FROM interviewer_schedules
WHERE evaluator_id = [INTERVIEWER_ID]
  AND schedule_date = '[ORIGINAL_DATE]'
  AND start_time = '[ORIGINAL_TIME]'
  AND is_available = true;
```

---

### Test Case 2: Cancel Interview - Validation Errors

**Objective:** Verify that validation prevents invalid cancellation attempts.

**Test 2.1: Empty Reason**

**Steps:**
1. Open CancelInterviewModal
2. Leave the textarea empty
3. Click "Cancelar Entrevista"

**Expected Result:**
- Error message: "Por favor ingrese un motivo de cancelación"
- Form does not submit
- Modal remains open

**Test 2.2: Reason Too Short**

**Steps:**
1. Open CancelInterviewModal
2. Enter "Test" (only 4 characters)
3. Click "Cancelar Entrevista"

**Expected Result:**
- Error message: "El motivo debe tener al menos 10 caracteres"
- Form does not submit
- Character counter shows "4/500 caracteres"

**Test 2.3: Maximum Length**

**Steps:**
1. Open CancelInterviewModal
2. Enter exactly 500 characters
3. Try to enter more characters

**Expected Result:**
- Cannot type beyond 500 characters
- Character counter shows "500/500 caracteres"
- Can still submit (500 is valid)

---

### Test Case 3: Reschedule Interview - Happy Path

**Objective:** Verify that users can successfully reschedule an interview with a new date/time and reason.

**Preconditions:**
- User is authenticated as ADMIN or COORDINATOR
- At least one interview exists with status = 'SCHEDULED'
- Interviewer has available schedule slots

**Steps:**
1. Navigate to Interview Management page
2. Locate a SCHEDULED interview in the table
3. Click the blue "Reschedule" button (refresh icon)
4. Verify the RescheduleInterviewModal opens
5. Observe that the modal displays:
   - Current interview details (blue info box)
   - DayScheduleSelector component
   - Empty textarea for reschedule reason
6. Select a new available date in the calendar
7. Select a new available time slot
8. Verify the "Resumen del Cambio" section appears showing:
   - Current date/time (left)
   - Arrow icon (center)
   - New date/time (right, highlighted in green)
9. Enter reschedule reason (less than 10 characters)
10. Verify error message: "El motivo debe tener al menos 10 caracteres"
11. Enter a valid reschedule reason (at least 10 characters)
12. Click "Reagendar Entrevista" button
13. Verify loading state shows "Reagendando..."

**Expected Results:**
- Modal closes after successful submission
- Success toast message: "Entrevista reagendada exitosamente"
- Interview table refreshes
- Interview shows new date/time
- Interview status remains 'SCHEDULED' (not RESCHEDULED)
- `interview_history` table has new record with action='RESCHEDULED'
- Old schedule slot is liberated (available)
- New schedule slot is marked as occupied
- Reschedule email sent to guardian and interviewer

**Database Verification:**
```sql
-- Check interview updated details
SELECT id, status, scheduled_date, scheduled_time, updated_at
FROM interviews
WHERE id = [INTERVIEW_ID];

-- Check history record for reschedule
SELECT * FROM interview_history
WHERE interview_id = [INTERVIEW_ID] AND action = 'RESCHEDULED'
ORDER BY performed_at DESC
LIMIT 1;

-- Check old schedule was liberated
SELECT * FROM interviewer_schedules
WHERE evaluator_id = [INTERVIEWER_ID]
  AND schedule_date = '[OLD_DATE]'
  AND start_time = '[OLD_TIME]'
  AND is_available = true;

-- Check new schedule was occupied
SELECT * FROM interviewer_schedules
WHERE evaluator_id = [INTERVIEWER_ID]
  AND schedule_date = '[NEW_DATE]'
  AND start_time = '[NEW_TIME]'
  AND is_available = false;
```

---

### Test Case 4: Reschedule Interview - Validation Errors

**Objective:** Verify that validation prevents invalid reschedule attempts.

**Test 4.1: No Date Selected**

**Steps:**
1. Open RescheduleInterviewModal
2. Enter valid reason
3. Don't select any date/time
4. Click "Reagendar Entrevista"

**Expected Result:**
- Button is disabled (grayed out)
- Error message: "Por favor seleccione una nueva fecha y hora"

**Test 4.2: Same Date/Time as Current**

**Steps:**
1. Open RescheduleInterviewModal
2. Select the same date and time as the current interview
3. Enter valid reason
4. Click "Reagendar Entrevista"

**Expected Result:**
- Error message: "La nueva fecha y hora deben ser diferentes a las actuales"
- Form does not submit

**Test 4.3: Empty Reason**

**Steps:**
1. Open RescheduleInterviewModal
2. Select new valid date/time
3. Leave reason textarea empty
4. Click "Reagendar Entrevista"

**Expected Result:**
- Error message: "Por favor ingrese un motivo de reagendación"
- Form does not submit

**Test 4.4: Reason Too Short**

**Steps:**
1. Open RescheduleInterviewModal
2. Select new valid date/time
3. Enter "Test" (only 4 characters)
4. Click "Reagendar Entrevista"

**Expected Result:**
- Error message: "El motivo debe tener al menos 10 caracteres"
- Form does not submit

---

### Test Case 5: Email Notifications - Cancellation

**Objective:** Verify that cancellation emails are sent correctly to guardians and interviewers.

**Preconditions:**
- SMTP service is configured and running (notification-service)
- Valid email addresses for guardian and interviewer

**Steps:**
1. Cancel an interview following Test Case 1
2. Check email inboxes for guardian and interviewer

**Expected Results:**

**Guardian Email:**
- Subject contains "Entrevista Cancelada"
- Email uses red color scheme (#8B0000, #B22222)
- Displays student name
- Shows original interview details (date, time, type, interviewer)
- Shows cancellation reason
- Includes "Próximos Pasos" section suggesting to contact school
- Footer with school contact information

**Interviewer Email:**
- Subject contains "Entrevista Cancelada"
- Email uses red color scheme
- Displays student name
- Shows original interview details
- Shows cancellation reason
- Includes "Horario Liberado" message
- Footer with school information

**Email Template Verification:**
- HTML renders correctly in email client
- Mobile responsive design works
- All icons (📅, 🕐, 👤, etc.) display correctly
- Links (if any) are functional

---

### Test Case 6: Email Notifications - Rescheduling

**Objective:** Verify that rescheduling emails are sent correctly to guardians and interviewers.

**Preconditions:**
- SMTP service is configured and running (notification-service)
- Valid email addresses for guardian and interviewer

**Steps:**
1. Reschedule an interview following Test Case 3
2. Check email inboxes for guardian and interviewer

**Expected Results:**

**Guardian Email:**
- Subject contains "Entrevista Reagendada"
- Email uses blue color scheme (#0277bd, #01579b)
- Displays student name
- Shows BEFORE/AFTER comparison:
  - Left side: Original date/time
  - Right side: New date/time (highlighted)
- Shows reschedule reason
- Prominent "Nueva Fecha y Hora" highlighted section
- Footer with school contact information

**Interviewer Email:**
- Subject contains "Entrevista Reagendada"
- Email uses blue color scheme
- Displays student name
- Shows BEFORE/AFTER comparison
- Shows reschedule reason
- Includes note about updated calendar
- Footer with school information

**Email Template Verification:**
- HTML renders correctly in email client
- Mobile responsive design works
- Side-by-side comparison displays correctly
- Highlight colors are visible and professional
- All icons display correctly

---

### Test Case 7: Audit Trail Verification

**Objective:** Verify that all interview changes are properly logged in the interview_history table.

**Steps:**
1. Perform several operations:
   - Cancel one interview
   - Reschedule another interview
   - Reschedule the same interview again

**Expected Database State:**

```sql
-- Query to verify history records
SELECT
  ih.id,
  ih.interview_id,
  ih.action,
  ih.previous_date,
  ih.previous_time,
  ih.new_date,
  ih.new_time,
  ih.reason,
  ih.cancellation_reason,
  ih.performed_at,
  u.email as performed_by_user
FROM interview_history ih
LEFT JOIN users u ON ih.performed_by = u.id
WHERE ih.interview_id IN ([TEST_INTERVIEW_IDS])
ORDER BY ih.performed_at DESC;
```

**Expected Results:**
- Each cancellation has a record with:
  - `action = 'CANCELLED'`
  - `previous_date` and `previous_time` filled
  - `cancellation_reason` filled
  - `new_date` and `new_time` are NULL
- Each reschedule has a record with:
  - `action = 'RESCHEDULED'`
  - `previous_date`, `previous_time`, `new_date`, `new_time` all filled
  - `reason` filled
  - Shows transition from old to new date/time
- `performed_at` timestamp is accurate
- `performed_by` references correct user ID
- Records are in chronological order

---

### Test Case 8: UI/UX Verification

**Objective:** Verify that the modals have proper user experience and responsiveness.

**Test 8.1: Modal Opening/Closing**

**Steps:**
1. Click cancel/reschedule button
2. Verify modal opens smoothly
3. Click outside modal (overlay)
4. Verify modal closes
5. Click "X" button (if present)
6. Verify modal closes
7. Click "Cancelar" / "Volver" button
8. Verify modal closes

**Expected Result:**
- Modal opens with smooth transition
- Overlay darkens background
- Modal centers on screen
- Can close via multiple methods
- Form state resets when closed
- No data persists after close

**Test 8.2: Loading States**

**Steps:**
1. Open modal
2. Fill form with valid data
3. Click submit button
4. Observe loading state

**Expected Result:**
- Button shows spinner icon
- Button text changes to "Cancelando..." or "Reagendando..."
- Button is disabled during submission
- Cannot close modal during submission
- Form fields are disabled during submission

**Test 8.3: Responsive Design**

**Steps:**
1. Open modal on desktop (>1024px)
2. Open modal on tablet (768-1024px)
3. Open modal on mobile (<768px)

**Expected Result:**
- Desktop: Modal width 600-800px, centered
- Tablet: Modal adjusts width, maintains readability
- Mobile: Modal takes full width with padding
- All text remains readable
- Buttons stack vertically on mobile
- DayScheduleSelector remains functional on all sizes

**Test 8.4: Error Display**

**Steps:**
1. Trigger various validation errors
2. Observe error message display

**Expected Result:**
- Error messages appear immediately below textarea
- Error messages in red color (#dc2626)
- Error icon (❌) precedes message
- Error messages are concise and helpful
- Multiple errors don't overlap
- Errors clear when user corrects input

---

### Test Case 9: Permission Verification

**Objective:** Verify that only authorized users can cancel/reschedule interviews.

**Test 9.1: ADMIN Role**

**Steps:**
1. Login as ADMIN user
2. Navigate to Interview Management
3. Attempt to cancel an interview
4. Attempt to reschedule an interview

**Expected Result:**
- Both cancel and reschedule buttons are visible
- Can successfully cancel interviews
- Can successfully reschedule interviews

**Test 9.2: COORDINATOR Role**

**Steps:**
1. Login as COORDINATOR user
2. Navigate to Interview Management
3. Attempt to cancel an interview
4. Attempt to reschedule an interview

**Expected Result:**
- Both cancel and reschedule buttons are visible
- Can successfully cancel interviews
- Can successfully reschedule interviews

**Test 9.3: APODERADO Role**

**Steps:**
1. Login as APODERADO (guardian) user
2. Navigate to Interview Management (if accessible)

**Expected Result:**
- Cancel and reschedule buttons are NOT visible
- Or entire page is not accessible (403 Forbidden)

**Test 9.4: Unauthenticated User**

**Steps:**
1. Access Interview Management without logging in

**Expected Result:**
- Redirected to login page
- Cannot access Interview Management

---

### Test Case 10: Edge Cases and Error Handling

**Test 10.1: Interview Already Cancelled**

**Steps:**
1. Cancel an interview
2. Attempt to reschedule the already-cancelled interview

**Expected Result:**
- Reschedule button should not be available for cancelled interviews
- Or backend returns error: "Cannot reschedule a cancelled interview"

**Test 10.2: Concurrent Modification**

**Steps:**
1. User A opens cancel modal for Interview X
2. User B cancels Interview X before User A
3. User A attempts to submit cancellation

**Expected Result:**
- Backend returns error: "Interview already cancelled" or "Interview not found"
- Frontend shows error message to User A
- User A can close modal and refresh list

**Test 10.3: Network Error**

**Steps:**
1. Disable network connection
2. Attempt to cancel an interview

**Expected Result:**
- Error message: "Error al cancelar la entrevista" or network-specific error
- Modal remains open
- User can retry after network is restored

**Test 10.4: Backend Service Down**

**Steps:**
1. Stop evaluation-service
2. Attempt to cancel an interview

**Expected Result:**
- Error message displayed in modal
- Gateway returns 502 Bad Gateway
- User can retry later

---

## Browser Compatibility Testing

Test the feature in the following browsers:

- ✅ **Chrome** (latest version)
- ✅ **Firefox** (latest version)
- ✅ **Safari** (latest version)
- ✅ **Edge** (latest version)
- ✅ **Mobile Chrome** (iOS/Android)
- ✅ **Mobile Safari** (iOS)

**Test Each Browser For:**
- Modal rendering
- Date/time picker functionality
- Form validation
- Button interactions
- Responsive design
- Email rendering (webmail clients)

---

## Performance Testing

**Objective:** Verify that the feature performs well under load.

**Test Scenarios:**

1. **Multiple Cancellations:**
   - Cancel 10 interviews in quick succession
   - Verify no timeouts or crashes
   - Verify database records are consistent

2. **Large Reason Text:**
   - Enter exactly 500 characters in reason field
   - Verify submission works
   - Verify email displays full text correctly

3. **Rapid Modal Open/Close:**
   - Open and close modal repeatedly
   - Verify no memory leaks
   - Verify form resets properly each time

---

## Rollback Testing

**Objective:** Verify that the rollback script works if needed.

**IMPORTANT:** Only run this in a TEST environment, never in production!

**Steps:**
1. Create a backup of the database
2. Apply the rollback script from migration file (lines 363-375)
3. Verify:
   - `interview_history` table is dropped
   - New columns are removed from `interviews` table
   - Trigger is dropped
   - Application still functions (without cancel/reschedule features)

**Rollback Script:**
```sql
BEGIN;
DROP TRIGGER IF EXISTS trg_interview_history ON interviews;
DROP FUNCTION IF EXISTS record_interview_history();
DROP TABLE IF EXISTS interview_history CASCADE;
ALTER TABLE interviews DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE interviews DROP COLUMN IF EXISTS cancelled_by;
ALTER TABLE interviews DROP COLUMN IF EXISTS cancellation_reason;
ALTER TABLE interviews DROP COLUMN IF EXISTS rescheduled_from;
COMMIT;
```

---

## Test Data Setup Script

Use this SQL script to create test data for manual testing:

```sql
-- Insert a test interview for cancellation testing
INSERT INTO interviews (
  application_id,
  interview_type,
  interviewer_id,
  second_interviewer_id,
  scheduled_date,
  scheduled_time,
  status,
  created_at,
  updated_at
) VALUES (
  [EXISTING_APPLICATION_ID],  -- Replace with valid application ID
  'FAMILY',
  [EXISTING_INTERVIEWER_ID],  -- Replace with valid evaluator/user ID
  NULL,
  '2025-11-10',  -- Future date
  '10:00:00',
  'SCHEDULED',
  NOW(),
  NOW()
);

-- Create an available schedule slot for rescheduling
INSERT INTO interviewer_schedules (
  evaluator_id,
  schedule_date,
  start_time,
  end_time,
  is_available,
  created_at
) VALUES (
  [EXISTING_INTERVIEWER_ID],
  '2025-11-15',
  '14:00:00',
  '15:00:00',
  true,
  NOW()
);
```

---

## Bug Report Template

If you find any issues during testing, report them using this template:

```
**Bug ID:** BUG-001
**Severity:** Critical / High / Medium / Low
**Component:** Frontend Modal / Backend API / Email Template / Database
**Test Case:** Test Case X.Y
**Environment:** Local / Railway / Vercel

**Description:**
[Clear description of the issue]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Screenshots/Logs:**
[Attach screenshots or paste relevant logs]

**Database State:**
[SQL query results showing relevant data]

**Workaround:**
[If any workaround exists]
```

---

## Test Sign-Off

After completing all test cases, fill this section:

**Tested By:** _______________
**Date:** _______________
**Environment:** Local / Railway / Vercel

**Test Results Summary:**
- Total Test Cases: 10
- Passed: _____
- Failed: _____
- Skipped: _____

**Critical Bugs Found:** _____
**Blockers:** _____

**Recommendation:**
- [ ] ✅ Ready for Production
- [ ] ⚠️ Needs Minor Fixes
- [ ] ❌ Needs Major Fixes
- [ ] 🚫 Not Ready

**Comments:**
[Additional notes or observations]

---

## Quick Test Checklist (TL;DR)

For a quick smoke test, verify these critical paths:

- [ ] Can open CancelInterviewModal
- [ ] Can cancel interview with valid reason (>10 chars)
- [ ] Validation prevents empty/short reasons
- [ ] Can open RescheduleInterviewModal
- [ ] Can reschedule interview to new date/time with valid reason
- [ ] Validation prevents same date/time or empty reason
- [ ] Interview list refreshes after cancel/reschedule
- [ ] Guardian receives cancellation email
- [ ] Guardian receives rescheduling email
- [ ] Interviewer receives cancellation email
- [ ] Interviewer receives rescheduling email
- [ ] interview_history table logs both actions
- [ ] Schedule slots are liberated/occupied correctly

---

## Contact for Issues

If you encounter any issues during testing:
- Review the logs in Railway dashboard
- Check browser console for frontend errors
- Verify backend services are running
- Check CLAUDE.md for troubleshooting tips

## Next Steps After Testing

1. Review all test results
2. Fix any critical bugs found
3. Re-test failed cases
4. Create pull request to merge feature branch to main
5. Update CLAUDE.md with any lessons learned
6. Deploy to production after approval
