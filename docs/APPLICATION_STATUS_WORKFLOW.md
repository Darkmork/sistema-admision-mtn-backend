# Application Status Workflow Documentation

## Overview

This document defines the complete application status workflow for the Colegio Monte Tabor y Nazaret admission system. It clarifies when and how application statuses should transition throughout the admission process.

**Last Updated**: 2025-11-10

---

## Valid Application Statuses

According to the database CHECK constraint (`applications.status`), the following statuses are valid:

1. **PENDING** - Postulación pendiente
2. **UNDER_REVIEW** - En revisión
3. **DOCUMENTS_REQUESTED** - Documentos solicitados
4. **INTERVIEW_SCHEDULED** - Entrevista programada
5. **EXAM_SCHEDULED** - Examen programado
6. **APPROVED** - Aprobada
7. **REJECTED** - Rechazada
8. **WAITLIST** - En lista de espera

---

## Current Implementation Status

**As of November 2025:**
- ✅ Database constraint supports all 8 statuses
- ⚠️ **Only PENDING status is currently being used in production**
- ⚠️ **No automatic status transitions are implemented**
- ✅ AdminDashboard displays: Total, Pendientes, En Revisión, Aprobadas, Rechazadas
- ❌ Removed "Examen Programado" from general dashboard (doesn't fit workflow)

---

## Recommended Status Workflow

### 1. PENDING → UNDER_REVIEW

**Trigger**: When a coordinator/admin starts reviewing the application

**Criteria**:
- Application has been submitted
- Student information is complete
- Coordinator begins document review

**Automatic Transition**: ❌ Not implemented
**Manual Transition**: ✅ Admin/Coordinator changes status in dashboard

**Recommendation**: Implement automatic transition when:
- First document is approved OR
- Coordinator opens StudentDetailModal for the first time

---

### 2. UNDER_REVIEW → DOCUMENTS_REQUESTED

**Trigger**: When documents need corrections or are rejected

**Criteria**:
- One or more documents have been rejected (`approval_status = 'REJECTED'`)
- Notification email sent to guardian requesting new documents

**Automatic Transition**: ❌ Not implemented
**Manual Transition**: ✅ Admin/Coordinator changes status

**Recommendation**: Implement automatic transition when:
- Any document is marked as `REJECTED` with a `rejection_reason`
- Document review notification email is sent with rejected documents

---

### 3. UNDER_REVIEW → INTERVIEW_SCHEDULED

**Trigger**: When an interview is scheduled for the student

**Criteria**:
- All required documents are approved (`documentosCompletos = true`)
- At least one interview has been scheduled (`interviews.status = 'SCHEDULED'`)

**Automatic Transition**: ❌ Not implemented
**Manual Transition**: ✅ Admin/Coordinator changes status

**Recommendation**: Implement automatic transition when:
- First interview is scheduled via InterviewScheduling component
- Query: `INSERT INTO interviews ... WHERE application_id = $1` completes successfully

---

### 4. INTERVIEW_SCHEDULED → EXAM_SCHEDULED

**Trigger**: When academic exam is scheduled (if applicable)

**Criteria**:
- Family interview completed (`evaluations.evaluation_type = 'FAMILY_INTERVIEW' AND status = 'COMPLETED'`)
- Academic exams scheduled (Language, Math, English)

**Automatic Transition**: ❌ Not implemented
**Manual Transition**: ✅ Admin/Coordinator changes status

**Current Status**: ⚠️ **EXAM_SCHEDULED may not be needed in current workflow**
- Interviews are prioritized over exams
- Most evaluations are interview-based, not exam-based
- Consider if this status is necessary or should be merged with INTERVIEW_SCHEDULED

---

### 5. INTERVIEW_SCHEDULED/EXAM_SCHEDULED → APPROVED

**Trigger**: When all evaluations are completed and student is accepted

**Criteria**:
- All required evaluations completed (`evaluations.status = 'COMPLETED'`)
- Overall evaluation score meets admission threshold
- Coordinator makes final acceptance decision

**Automatic Transition**: ❌ Not implemented
**Manual Transition**: ✅ Admin/Coordinator changes status

**Recommendation**: Implement automatic transition when:
- All evaluations for the application have `status = 'COMPLETED'`
- Average score >= admission threshold (configurable, e.g., 70/100)
- Coordinator confirms approval in dashboard

---

### 6. INTERVIEW_SCHEDULED/EXAM_SCHEDULED → REJECTED

**Trigger**: When student does not meet admission criteria

**Criteria**:
- Evaluations completed with low scores
- Specific evaluation types failed (e.g., psychological interview)
- Coordinator makes final rejection decision

**Automatic Transition**: ❌ Not implemented
**Manual Transition**: ✅ Admin/Coordinator changes status

**Recommendation**: Keep as manual transition only
- Rejection should always require coordinator confirmation
- Never auto-reject based on scores alone

---

### 7. INTERVIEW_SCHEDULED/EXAM_SCHEDULED → WAITLIST

**Trigger**: When student qualifies but no spots available

**Criteria**:
- Evaluations completed with passing scores
- Capacity limit reached for the grade level
- Student placed on waiting list

**Automatic Transition**: ❌ Not implemented
**Manual Transition**: ✅ Admin/Coordinator changes status

**Recommendation**: Keep as manual transition only
- Waitlist placement requires strategic decision
- Consider grade capacity and student ranking

---

## Status Transition Diagram

```
┌─────────────┐
│   PENDING   │ (Initial state when application is created)
└──────┬──────┘
       │
       │ (Coordinator starts review)
       ▼
┌─────────────────┐
│  UNDER_REVIEW   │ (Reviewing documents and information)
└────┬────────────┘
     │
     ├─────────────────────────────────────┐
     │                                     │
     │ (Documents rejected)                │ (Documents approved + interview scheduled)
     ▼                                     ▼
┌──────────────────────┐          ┌──────────────────────┐
│ DOCUMENTS_REQUESTED  │          │ INTERVIEW_SCHEDULED  │
└──────────────────────┘          └──────┬───────────────┘
                                         │
                                         │ (All evaluations completed)
                                         ▼
                                  ┌──────────────┐
                                  │   Decision   │
                                  └──────┬───────┘
                                         │
                ┌────────────────────────┼────────────────────┐
                │                        │                    │
                ▼                        ▼                    ▼
         ┌───────────┐            ┌───────────┐       ┌──────────┐
         │ APPROVED  │            │ REJECTED  │       │ WAITLIST │
         └───────────┘            └───────────┘       └──────────┘
```

---

## Dashboard Display Strategy

### General AdminDashboard Cards (Current)

Shows high-level overview:
- **Total Postulaciones**: All applications
- **Pendientes**: `status = 'PENDING'`
- **En Revisión**: `status = 'UNDER_REVIEW'`
- **Aprobadas**: `status = 'APPROVED'`
- **Rechazadas**: `status = 'REJECTED'`

**Note**: Removed "Examen Programado" - doesn't fit general workflow view

### Detailed Status Filters

When clicking a card, show filtered list with additional statuses:
- Documents Requested
- Interview Scheduled
- Exam Scheduled (if kept)
- Waitlist

---

## Implementation Recommendations

### Phase 1: Manual Status Management (Current)

**Status**: ✅ Implemented
- Coordinators manually change statuses in StudentDetailModal
- Dashboard shows status-based filtering
- No automatic transitions

### Phase 2: Semi-Automatic Transitions (Recommended Next Step)

Implement automatic status suggestions with coordinator confirmation:

```typescript
// Example: When all documents approved
if (documentosCompletos && currentStatus === 'UNDER_REVIEW') {
  showStatusTransitionDialog({
    currentStatus: 'UNDER_REVIEW',
    suggestedStatus: 'INTERVIEW_SCHEDULED',
    reason: 'Todos los documentos han sido aprobados',
    action: 'AUTO_SUGGEST',
    requireConfirmation: true
  });
}
```

### Phase 3: Fully Automatic Transitions (Future)

Implement automatic status updates based on workflow milestones:

```javascript
// Backend: application-service/src/services/ApplicationService.js

async updateApplicationStatusByMilestones(applicationId) {
  // Check documents
  const docsComplete = await this.areAllDocumentsApproved(applicationId);

  // Check interviews
  const interviewsScheduled = await this.areInterviewsScheduled(applicationId);
  const interviewsCompleted = await this.areInterviewsCompleted(applicationId);

  // Check evaluations
  const evaluationsCompleted = await this.areEvaluationsCompleted(applicationId);
  const averageScore = await this.calculateAverageScore(applicationId);

  // Determine new status
  let newStatus = 'PENDING';

  if (evaluationsCompleted && averageScore >= ADMISSION_THRESHOLD) {
    newStatus = 'APPROVED';
  } else if (evaluationsCompleted) {
    // Score below threshold, coordinator decision needed
    newStatus = 'UNDER_REVIEW'; // Keep for manual decision
  } else if (interviewsScheduled) {
    newStatus = 'INTERVIEW_SCHEDULED';
  } else if (docsComplete) {
    newStatus = 'UNDER_REVIEW';
  }

  // Update status
  await this.updateStatus(applicationId, newStatus);

  return newStatus;
}
```

---

## Database Queries for Status Management

### Check if all documents are approved
```sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN approval_status = 'APPROVED' THEN 1 END) as approved,
  (COUNT(*) = COUNT(CASE WHEN approval_status = 'APPROVED' THEN 1 END)) as all_approved
FROM documents
WHERE application_id = $1;
```

### Check if interviews are scheduled
```sql
SELECT COUNT(*) as scheduled_count
FROM interviews
WHERE application_id = $1
  AND status = 'SCHEDULED'
  AND scheduled_date >= CURRENT_DATE;
```

### Check if all evaluations are completed
```sql
SELECT
  COUNT(*) as total_evals,
  COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_evals,
  AVG(score) as average_score
FROM evaluations
WHERE application_id = $1;
```

### Update application status
```sql
UPDATE applications
SET status = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;
```

---

## Status Change Notifications

When status changes, consider sending notifications to:

1. **Guardian/Apoderado**: Inform about application progress
2. **Coordinators**: Dashboard notification of status changes
3. **Interviewers**: When interviews are scheduled

**Example Email Templates**:
- Status → UNDER_REVIEW: "Su postulación está siendo revisada"
- Status → INTERVIEW_SCHEDULED: "Entrevista programada"
- Status → APPROVED: "¡Felicitaciones! Postulación aprobada"
- Status → REJECTED: "Resultado de postulación"
- Status → WAITLIST: "Postulación en lista de espera"

---

## Configuration

### Admission Threshold Score

Define in application-service environment variables:

```bash
# Minimum average score for automatic approval consideration
ADMISSION_THRESHOLD=70

# Enable automatic status transitions
AUTO_STATUS_TRANSITIONS=false  # Set to true when Phase 3 implemented
```

---

## Testing Status Transitions

### Manual Testing Checklist

- [ ] Create new application (should be PENDING)
- [ ] Approve all documents (should suggest UNDER_REVIEW or INTERVIEW_SCHEDULED)
- [ ] Reject a document (should suggest DOCUMENTS_REQUESTED)
- [ ] Schedule interview (should suggest INTERVIEW_SCHEDULED)
- [ ] Complete all evaluations with passing score (should suggest APPROVED)
- [ ] Complete all evaluations with failing score (should keep UNDER_REVIEW for manual decision)
- [ ] Change status to WAITLIST manually
- [ ] Change status to REJECTED manually

### Automated Testing

```javascript
// Example test: Status transition when documents approved
describe('Application Status Workflow', () => {
  it('should transition to UNDER_REVIEW when documents are approved', async () => {
    const application = await createTestApplication({ status: 'PENDING' });

    // Upload and approve all required documents
    await uploadAndApproveAllDocuments(application.id);

    // Check status was updated
    const updated = await getApplication(application.id);
    expect(updated.status).toBe('UNDER_REVIEW');
  });
});
```

---

## Frequently Asked Questions

### Q: Why is "EXAM_SCHEDULED" not in the general dashboard?

**A**: The general dashboard focuses on high-level application flow: Pending → Review → Approved/Rejected. Exam scheduling is a granular step that fits better in detailed views or specific evaluation dashboards.

### Q: How do I transition from PENDING to UNDER_REVIEW?

**A**: Currently manual. Coordinator clicks on the application in the dashboard and changes the status in StudentDetailModal. Future implementation will auto-suggest this transition when documents are first reviewed.

### Q: What's the difference between INTERVIEW_SCHEDULED and EXAM_SCHEDULED?

**A**:
- **INTERVIEW_SCHEDULED**: Personal interviews (family, cycle director, psychologist)
- **EXAM_SCHEDULED**: Written academic exams (language, math, English)

**Note**: Current workflow prioritizes interviews. Consider if EXAM_SCHEDULED is necessary or should be merged.

### Q: Can statuses transition backwards (e.g., APPROVED → UNDER_REVIEW)?

**A**: Yes, but only manually by coordinators. This allows flexibility for special cases (e.g., new information emerges after approval).

---

## Related Documentation

- **CLAUDE.md**: Full microservices architecture documentation
- **Database Schema**: `/docs/DATABASE_SCHEMA.md`
- **VERIFICACION_CORREOS_DOCUMENTOS.md**: Document notification system

---

## Changelog

**2025-11-10**:
- Initial documentation created
- Removed "Examen Programado" from AdminDashboard general view
- Added "Rechazadas" card to general dashboard
- Documented current implementation status: only PENDING is actively used
- Defined recommended automatic transition logic for future implementation
