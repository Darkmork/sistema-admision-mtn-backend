# Family Interview Form - Implementation Status

## Date: 2025-11-01

## What Has Been Completed

### 1. Database Schema ✅
- Added `interview_data` JSONB column to `evaluations` table
- This column will store the complete interview responses in structured format

```sql
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS interview_data JSONB DEFAULT '{}'::jsonb;
```

### 2. Template Data Source ✅
- Complete JSON template created: `/Users/jorgegangale/Desktop/MIcroservicios/evaluation-service/ENTREVISTA_FAMILIAS_2026_COMPLETO.json`
- Contains all questions from "Entrevista Familias 2026.docx" with exact text
- Structured with grade-based conditional logic
- Includes all 4 sections + observations section

### 3. Backend Service ✅
- Created `FamilyInterviewTemplateService.js` in `/evaluation-service/src/services/`
- Features:
  - `getTemplateForGrade(grade)` - Returns filtered template based on student's grade
  - `getGradeRange(grade)` - Maps grades to question ranges (PREKINDER_2BASICO, 3BASICO_4BASICO, etc.)
  - `calculateScore(interviewData)` - Calculates total score from responses
  - `validateResponses(grade, responses)` - Validates responses match template

## What Still Needs To Be Done

### 1. Backend API Endpoint
**File**: `/evaluation-service/src/routes/evaluationRoutes.js`

Add before line 294 (before `router.get('/:id')`):

```javascript
// GET /api/evaluations/family-interview-template/:grade
router.get('/family-interview-template/:grade', authenticate, async (req, res) => {
  try {
    const familyInterviewService = require('../services/FamilyInterviewTemplateService');
    const { grade } = req.params;

    const template = familyInterviewService.getTemplateForGrade(grade);

    return res.json({
      success: true,
      data: template
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error loading family interview template',
      details: error.message
    });
  }
});

// GET /api/evaluations/:evaluationId/family-interview-data
router.get('/:evaluationId/family-interview-data', authenticate, async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const {dbPool } = require('../config/database');

    const result = await dbPool.query(
      'SELECT interview_data FROM evaluations WHERE id = $1',
      [evaluationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found'
      });
    }

    return res.json({
      success: true,
      data: result.rows[0].interview_data || {}
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error retrieving interview data',
      details: error.message
    });
  }
});

// PUT /api/evaluations/:evaluationId/family-interview-data
router.put('/:evaluationId/family-interview-data', authenticate, validateCsrf, requireRole('ADMIN', 'COORDINATOR', 'PSYCHOLOGIST'), async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const { interviewData } = req.body;
    const { dbPool } = require('../config/database');
    const familyInterviewService = require('../services/FamilyInterviewTemplateService');

    // Calculate score from responses
    const totalScore = familyInterviewService.calculateScore(interviewData);

    const result = await dbPool.query(
      `UPDATE evaluations
       SET interview_data = $1,
           score = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(interviewData), totalScore, evaluationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found'
      });
    }

    return res.json({
      success: true,
      message: 'Interview data saved successfully',
      data: {
        evaluationId: evaluationId,
        totalScore: totalScore,
        interview_data: result.rows[0].interview_data
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Error saving interview data',
      details: error.message
    });
  }
});
```

### 2. Frontend Implementation

#### 2.1 Create Service Function
**File**: Create/update frontend service file

```typescript
// services/familyInterviewService.ts
import httpClient from './http';

export const familyInterviewService = {
  // Get template for specific grade
  async getTemplateForGrade(grade: string) {
    const response = await httpClient.get(`/api/evaluations/family-interview-template/${grade}`);
    return response.data;
  },

  // Get saved interview data
  async getInterviewData(evaluationId: number) {
    const response = await httpClient.get(`/api/evaluations/${evaluationId}/family-interview-data`);
    return response.data;
  },

  // Save interview responses
  async saveInterviewData(evaluationId: number, interviewData: any) {
    const response = await httpClient.put(`/api/evaluations/${evaluationId}/family-interview-data`, {
      interviewData
    });
    return response.data;
  }
};
```

#### 2.2 Update Frontend Component
**File**: The component that currently displays the family interview form

The component should:
1. Fetch the student's `grade_applied` from the application data
2. Call `familyInterviewService.getTemplateForGrade(gradeApplied)` to get the appropriate questions
3. Render only the questions that apply to that grade level
4. Save responses to the `interview_data` field via the PUT endpoint

Example pseudocode:
```typescript
// In the component
useEffect(() => {
  // 1. Get student's grade from application
  const studentGrade = application.student.gradeApplied; // e.g., "5_BASICO"

  // 2. Fetch template for that grade
  familyInterviewService.getTemplateForGrade(studentGrade)
    .then(template => {
      setInterviewTemplate(template);
      // template.sections contains only applicable questions
    });

  // 3. Load existing responses if evaluation exists
  if (evaluationId) {
    familyInterviewService.getInterviewData(evaluationId)
      .then(data => {
        setInterviewResponses(data.data);
      });
  }
}, [evaluationId, application]);

// When user submits
const handleSubmit = async () => {
  await familyInterviewService.saveInterviewData(evaluationId, interviewResponses);
  // Show success message
};
```

### 3. Gateway Route Configuration
**File**: `/gateway-service/src/routes/evaluationRoutes.js` (if using Express gateway)

The route `/api/evaluations/family-interview-template/:grade` should already be proxied through the gateway since it's under `/api/evaluations`.

If using NGINX, no changes needed (already proxies `/api/evaluations` to evaluation-service).

### 4. Testing Checklist

- [ ] Test template endpoint with different grades:
  - GET `/api/evaluations/family-interview-template/PRE_KINDER`
  - GET `/api/evaluations/family-interview-template/5_BASICO`
  - GET `/api/evaluations/family-interview-template/IV_MEDIO`
- [ ] Verify questions are filtered correctly (only applicable ones shown)
- [ ] Test saving interview responses:
  - PUT `/api/evaluations/:id/family-interview-data` with sample data
- [ ] Verify score calculation is correct (max 51 points)
- [ ] Test in frontend:
  - Questions display correctly for each grade level
  - Text matches exactly the Word document
  - Save/load functionality works
  - Score displays correctly

## Grade Mappings (Reference)

| Grade Range | Grades Included |
|-------------|-----------------|
| PREKINDER_2BASICO | PRE_KINDER, KINDER, 1_BASICO, 2_BASICO |
| 3BASICO_4BASICO | 3_BASICO, 4_BASICO |
| 5BASICO_3MEDIO | 5_BASICO, 6_BASICO, 7_BASICO, 8_BASICO, I_MEDIO, II_MEDIO, III_MEDIO |
| 4MEDIO | IV_MEDIO |

## Score Breakdown

- **Section 1**: 10 points max (4 questions)
- **Section 2**: 10 points max (4 questions)
- **Section 3**: 10 points max (4 questions)
- **Section 4**: 10 points max (4 questions)
- **Observations Checklist**: 7 points max (7 items, 1 point each)
- **Overall Opinion**: 4 points max
- **TOTAL**: 51 points max

## Notes

- All text in the JSON template is exactly as it appears in the Word document
- Questions with `applicableTo: "ALL_LEVELS"` show for all grades
- Questions with specific ranges (e.g., `"PREKINDER_2BASICO"`) only show for those grades
- The `interview_data` JSONB column can store the complete structured responses
- Backend validates responses and calculates score automatically
