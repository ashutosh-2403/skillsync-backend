// server/models/User.js

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const skillSchema = new mongoose.Schema({
  name: { type: String, required: true },
  level: { type: Number, min: 0, max: 100 },
  category: { type: String, required: true },
  verified: { type: Boolean, default: false }
});

const experienceSchema = new mongoose.Schema({
  company: String,
  position: String,
  duration: String,
  description: String,
  startDate: Date,
  endDate: Date,
  current: { type: Boolean, default: false }
});

const educationSchema = new mongoose.Schema({
  institution: String,
  degree: String,
  field: String,
  startDate: Date,
  endDate: Date,
  gpa: String,
  current: { type: Boolean, default: false }
});

const userSchema = new mongoose.Schema({
  // Authentication
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },

  // Profile Information
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  profilePicture: String,
  phone: String,
  location: String,

  // Professional Information
  currentRole: String,
  yearsOfExperience: Number,
  bio: String,
  linkedinUrl: String,
  githubUrl: String,
  portfolioUrl: String,

  // Skills and Career
  skills: [skillSchema],
  targetRoles: [String],
  experience: [experienceSchema],
  education: [educationSchema],

  // AI Analysis Results
  skillGaps: [{
    skill: String,
    importance: { type: String, enum: ['Low', 'Medium', 'High'] },
    timeToLearn: String,
    resources: [String]
  }],

  careerMatches: [{
    role: String,
    matchPercentage: Number,
    requirements: [String],
    missingSkills: [String]
  }],

  learningRoadmap: [{
    phase: String,
    title: String,
    skills: [String],
    resources: [String],
    timeframe: String,
    status: {
      type: String,
      enum: ['upcoming', 'current', 'completed', 'pending'],
      default: 'upcoming'
    }
  }],

  // Resume Data
  resumeText: String,
  resumeFileName: String,
  resumeUploadDate: Date,

  // Settings
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    publicProfile: { type: Boolean, default: false },
    shareAnalytics: { type: Boolean, default: true }
  },

  // Metadata
  lastAnalysisDate: Date,
  profileCompleteness: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ 'skills.name': 1 });
userSchema.index({ targetRoles: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Calculate profile completeness
userSchema.methods.calculateCompleteness = function () {
  let score = 0;
  const fields = [
    'firstName', 'lastName', 'email', 'currentRole', 'bio',
    'location', 'linkedinUrl', 'skills', 'experience', 'education'
  ];

  fields.forEach(field => {
    if (['skills', 'experience', 'education'].includes(field)) {
      if (this[field] && this[field].length > 0) score += 10;
    } else if (this[field]) {
      score += 10;
    }
  });

  this.profileCompleteness = score;
  return score;
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

export default mongoose.model('User', userSchema);
