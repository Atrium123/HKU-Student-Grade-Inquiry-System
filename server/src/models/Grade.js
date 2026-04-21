const mongoose = require('mongoose');

const gradeComponentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    }
  },
  { _id: false }
);

const gradeSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true
    },
    semester: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    components: [gradeComponentSchema],
    totalScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    letterGrade: {
      type: String,
      required: true
    },
    gpa: {
      type: Number,
      required: true,
      min: 0,
      max: 4.3
    },
    enteredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

gradeSchema.index({ studentId: 1, courseId: 1, semester: 1 }, { unique: true });

module.exports = mongoose.model('Grade', gradeSchema);