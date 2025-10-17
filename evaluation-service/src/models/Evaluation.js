class Evaluation {
  constructor(data) {
    this.id = data.id;
    this.applicationId = data.applicationId || data.application_id;
    this.evaluatorId = data.evaluatorId || data.evaluator_id;
    this.evaluationType = data.evaluationType || data.evaluation_type;
    this.score = data.score;
    this.maxScore = data.maxScore || data.max_score;
    this.strengths = data.strengths;
    this.areasForImprovement = data.areasForImprovement || data.areas_for_improvement;
    this.observations = data.observations;
    this.recommendations = data.recommendations;
    this.status = data.status || 'PENDING';
    this.evaluatedAt = data.evaluatedAt || data.evaluated_at;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      applicationId: this.applicationId,
      evaluatorId: this.evaluatorId,
      evaluationType: this.evaluationType,
      score: this.score,
      maxScore: this.maxScore,
      strengths: this.strengths,
      areasForImprovement: this.areasForImprovement,
      observations: this.observations,
      recommendations: this.recommendations,
      status: this.status,
      evaluatedAt: this.evaluatedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toDatabase() {
    return {
      application_id: this.applicationId,
      evaluator_id: this.evaluatorId,
      evaluation_type: this.evaluationType,
      score: this.score,
      max_score: this.maxScore,
      strengths: this.strengths,
      areas_for_improvement: this.areasForImprovement,
      observations: this.observations,
      recommendations: this.recommendations,
      status: this.status,
      evaluated_at: this.evaluatedAt
    };
  }

  static fromDatabaseRow(row) {
    if (!row) return null;
    return new Evaluation(row);
  }

  static fromDatabaseRows(rows) {
    if (!rows || !Array.isArray(rows)) return [];
    return rows.map(row => Evaluation.fromDatabaseRow(row));
  }
}

module.exports = Evaluation;
