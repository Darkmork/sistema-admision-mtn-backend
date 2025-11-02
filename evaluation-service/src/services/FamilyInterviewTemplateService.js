const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Service to manage family interview templates based on student grade level
 * Uses the complete JSON structure from ENTREVISTA_FAMILIAS_2026_COMPLETO.json
 */
class FamilyInterviewTemplateService {
  constructor() {
    this.templatePath = path.join(__dirname, '../..', 'ENTREVISTA_FAMILIAS_2026_COMPLETO.json');
    this.template = null;
    this.loadTemplate();
  }

  loadTemplate() {
    try {
      const templateData = fs.readFileSync(this.templatePath, 'utf8');
      this.template = JSON.parse(templateData);
      logger.info('Family interview template loaded successfully');
    } catch (error) {
      logger.error('Error loading family interview template:', error);
      throw new Error('Failed to load interview template');
    }
  }

  /**
   * Determine which grade range a specific grade belongs to
   * @param {string} grade - Grade like "PRE_KINDER", "1_BASICO", "5_BASICO", "IV_MEDIO", etc.
   * @returns {string} - Grade range key like "PREKINDER_2BASICO", "3BASICO_4BASICO", etc.
   */
  getGradeRange(grade) {
    if (!grade) {
      throw new Error('Grade is required');
    }

    const gradeRanges = this.template.gradeRanges;

    // Find which range contains this grade
    for (const [rangeKey, rangeData] of Object.entries(gradeRanges)) {
      if (rangeData.grades.includes(grade)) {
        return rangeKey;
      }
    }

    // If grade doesn't match any known range, default to the largest range
    logger.warn(`Grade ${grade} not found in any range, defaulting to 5BASICO_3MEDIO`);
    return '5BASICO_3MEDIO';
  }

  /**
   * Get the appropriate interview template for a given grade
   * Filters questions based on "applicableTo" field
   * @param {string} grade - Student's applied grade
   * @returns {object} - Filtered template with only applicable questions
   */
  getTemplateForGrade(grade) {
    const gradeRange = this.getGradeRange(grade);
    const template = JSON.parse(JSON.stringify(this.template)); // Deep clone

    // Filter sections to include only applicable questions
    const filteredSections = {};

    for (const [sectionKey, sectionData] of Object.entries(template.sections)) {
      const filteredQuestions = {};

      for (const [questionKey, questionData] of Object.entries(sectionData.questions)) {
        // Include question if it applies to ALL_LEVELS or matches the grade range
        if (questionData.applicableTo === 'ALL_LEVELS' || questionData.applicableTo === gradeRange) {
          filteredQuestions[questionKey] = questionData;
        }
      }

      // Only include section if it has questions
      if (Object.keys(filteredQuestions).length > 0) {
        filteredSections[sectionKey] = {
          ...sectionData,
          questions: filteredQuestions
        };
      }
    }

    return {
      metadata: template.metadata,
      sections: filteredSections,
      observations: template.observations,
      gradeRange: gradeRange,
      gradeApplied: grade
    };
  }

  /**
   * Calculate total score from interview responses
   * @param {object} interviewData - Responses in format {section1: {q1: {score: X}}, ...}
   * @returns {number} - Total score
   */
  calculateScore(interviewData) {
    let totalScore = 0;

    // Sum scores from all sections
    for (const [sectionKey, sectionResponses] of Object.entries(interviewData)) {
      if (sectionKey === 'observations') continue; // Observations counted separately

      for (const [questionKey, response] of Object.entries(sectionResponses)) {
        if (response && typeof response.score === 'number') {
          totalScore += response.score;
        }
      }
    }

    // Add observations score if present
    if (interviewData.observations) {
      const obsData = interviewData.observations;

      // Checklist items (1 point each)
      if (obsData.checklist) {
        for (const item of Object.values(obsData.checklist)) {
          if (item === true || item === 1) {
            totalScore += 1;
          }
        }
      }

      // Overall opinion (up to 4 points)
      if (obsData.overallOpinion && typeof obsData.overallOpinion.score === 'number') {
        totalScore += obsData.overallOpinion.score;
      }
    }

    return totalScore;
  }

  /**
   * Validate interview responses against template
   * @param {string} grade - Student's grade
   * @param {object} responses - Interview responses
   * @returns {object} - {valid: boolean, errors: []}
   */
  validateResponses(grade, responses) {
    const template = this.getTemplateForGrade(grade);
    const errors = [];

    // Check that all required sections have responses
    for (const [sectionKey, sectionData] of Object.entries(template.sections)) {
      if (!responses[sectionKey]) {
        errors.push(`Section ${sectionKey} is missing`);
        continue;
      }

      // Check that all questions in the section have responses
      for (const [questionKey, questionData] of Object.entries(sectionData.questions)) {
        if (!responses[sectionKey][questionKey]) {
          errors.push(`Question ${questionKey} in section ${sectionKey} is missing`);
        } else {
          const response = responses[sectionKey][questionKey];

          // Validate score is within valid range
          if (typeof response.score !== 'number') {
            errors.push(`Question ${questionKey} in section ${sectionKey} has invalid score`);
          } else {
            const validScores = Object.keys(questionData.rubric).map(Number);
            if (!validScores.includes(response.score)) {
              errors.push(`Question ${questionKey} in section ${sectionKey} has score ${response.score} but valid scores are: ${validScores.join(', ')}`);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new FamilyInterviewTemplateService();
