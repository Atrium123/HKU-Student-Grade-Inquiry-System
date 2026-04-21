const gpaScale = require('../config/gpaScale');
const AppError = require('./appError');

function normalizeScore(value) {
  return Math.round(value * 100) / 100;
}

function calculateTotalScore({ components = [], totalScore }) {
  const hasComponents = Array.isArray(components) && components.length > 0;
  const hasTotalScore = typeof totalScore === 'number';

  if (!hasComponents && !hasTotalScore) {
    throw new AppError(400, 'GRADE_SCORE_REQUIRED', 'Either components or totalScore is required');
  }

  if (!hasComponents) {
    if (totalScore < 0 || totalScore > 100) {
      throw new AppError(400, 'GRADE_SCORE_INVALID', 'totalScore must be between 0 and 100');
    }

    return normalizeScore(totalScore);
  }

  const weightSum = components.reduce((sum, component) => sum + component.weight, 0);

  if (Math.abs(weightSum - 100) > 0.01) {
    throw new AppError(400, 'GRADE_WEIGHT_INVALID', 'The component weights must add up to 100');
  }

  const computed = components.reduce(
    (sum, component) => sum + (component.score * component.weight) / 100,
    0
  );

  const normalizedComputed = normalizeScore(computed);

  if (hasTotalScore && Math.abs(totalScore - normalizedComputed) > 0.3) {
    throw new AppError(
      400,
      'GRADE_TOTAL_MISMATCH',
      `Provided totalScore does not match component total (${normalizedComputed})`
    );
  }

  return normalizedComputed;
}

function calculateGradePoint(totalScore) {
  const matched = gpaScale.find((entry) => totalScore >= entry.minScore);
  return matched || gpaScale[gpaScale.length - 1];
}

function buildGradeResult({ components = [], totalScore }) {
  const normalizedTotal = calculateTotalScore({ components, totalScore });
  const gradePoint = calculateGradePoint(normalizedTotal);

  return {
    totalScore: normalizedTotal,
    letterGrade: gradePoint.letterGrade,
    gpa: gradePoint.gpa
  };
}

module.exports = {
  buildGradeResult,
  calculateGradePoint,
  calculateTotalScore
};