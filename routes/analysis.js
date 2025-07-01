// server/routes/analysis.js
import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import dotenv from 'dotenv';
import { CohereClient } from 'cohere-ai';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';

dotenv.config();
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY
});

// Smart resume analysis - extracts key information first
const analyzeResumeContent = (resumeText) => {
  const text = resumeText.toLowerCase();
  
  // Extract actual information from resume
  const analysis = {
    name: extractName(resumeText),
    email: extractEmail(resumeText),
    phone: extractPhone(resumeText),
    experience: extractExperience(resumeText),
    education: extractEducation(resumeText),
    skills: extractSkillsFromText(resumeText),
    industries: extractIndustries(resumeText),
    roles: extractRoles(resumeText)
  };
  
  console.log('📊 Resume Analysis:', analysis);
  return analysis;
};

const extractName = (text) => {
  const lines = text.split('\n');
  // Usually name is in first few lines
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (line.length > 2 && line.length < 50 && 
        !line.includes('@') && !line.includes('+') && 
        !line.toLowerCase().includes('resume')) {
      return line;
    }
  }
  return 'Professional';
};

const extractEmail = (text) => {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return emailMatch ? emailMatch[0] : null;
};

const extractPhone = (text) => {
  const phoneMatch = text.match(/[\+]?[1-9]?[\d\s\-\(\)]{10,}/);
  return phoneMatch ? phoneMatch[0] : null;
};

const extractExperience = (text) => {
  const experiences = [];
  const lines = text.split('\n');
  
  let currentExp = null;
  let inExperienceSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();
    
    // Detect experience section
    if (lowerLine.includes('experience') || lowerLine.includes('work history') || 
        lowerLine.includes('employment')) {
      inExperienceSection = true;
      continue;
    }
    
    // Stop at next major section
    if (inExperienceSection && (lowerLine.includes('education') || 
        lowerLine.includes('skills') || lowerLine.includes('projects'))) {
      inExperienceSection = false;
    }
    
    if (inExperienceSection && line.length > 10) {
      // Look for company names, positions, dates
      const datePattern = /\d{4}|\d{1,2}\/\d{4}|present|current/i;
      
      if (datePattern.test(line)) {
        if (currentExp) {
          experiences.push(currentExp);
        }
        currentExp = {
          company: extractCompanyFromLine(line),
          position: extractPositionFromLine(lines, i),
          duration: extractDurationFromLine(line),
          description: extractDescriptionFromLines(lines, i)
        };
      }
    }
  }
  
  if (currentExp) experiences.push(currentExp);
  return experiences;
};

const extractEducation = (text) => {
  const education = [];
  const lines = text.split('\n');
  
  const educationKeywords = ['education', 'qualification', 'degree', 'university', 'college', 'school'];
  const degreeKeywords = ['mba', 'btech', 'bcom', 'bca', 'mca', 'phd', 'masters', 'bachelor'];
  
  let inEducationSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();
    
    if (educationKeywords.some(keyword => lowerLine.includes(keyword))) {
      inEducationSection = true;
      continue;
    }
    
    if (inEducationSection && (lowerLine.includes('experience') || 
        lowerLine.includes('skills') || lowerLine.includes('projects'))) {
      inEducationSection = false;
    }
    
    if (inEducationSection || degreeKeywords.some(keyword => lowerLine.includes(keyword))) {
      if (line.length > 5) {
        education.push(line);
      }
    }
  }
  
  return education;
};

const extractSkillsFromText = (text) => {
  const skills = [];
  const lines = text.split('\n');
  
  let inSkillsSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('skills') || lowerLine.includes('technical') || 
        lowerLine.includes('competencies')) {
      inSkillsSection = true;
      continue;
    }
    
    if (inSkillsSection && (lowerLine.includes('experience') || 
        lowerLine.includes('education') || lowerLine.includes('projects'))) {
      inSkillsSection = false;
    }
    
    if (inSkillsSection && line.length > 2) {
      // Split by common delimiters
      const skillsInLine = line.split(/[,•·\-\|]/);
      skillsInLine.forEach(skill => {
        const cleanSkill = skill.trim();
        if (cleanSkill.length > 2 && cleanSkill.length < 30) {
          skills.push(cleanSkill);
        }
      });
    }
  }
  
  return skills;
};

const extractIndustries = (text) => {
  const industries = [];
  const industryKeywords = {
    'Technology': ['software', 'technology', 'tech', 'programming', 'development', 'coding'],
    'Healthcare': ['healthcare', 'medical', 'pharmaceutical', 'pharma', 'clinical'],
    'Finance': ['finance', 'banking', 'investment', 'financial', 'accounting'],
    'Infrastructure': ['infrastructure', 'construction', 'real estate', 'civil'],
    'Energy': ['energy', 'oil', 'gas', 'petroleum', 'renewable'],
    'Manufacturing': ['manufacturing', 'production', 'industrial', 'factory'],
    'Education': ['education', 'teaching', 'academic', 'university', 'school'],
    'Consulting': ['consulting', 'advisory', 'strategy', 'management consulting']
  };
  
  const lowerText = text.toLowerCase();
  
  Object.entries(industryKeywords).forEach(([industry, keywords]) => {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      industries.push(industry);
    }
  });
  
  return industries;
};

const extractRoles = (text) => {
  const roles = [];
  const roleKeywords = [
    'manager', 'director', 'analyst', 'engineer', 'developer', 'consultant',
    'specialist', 'coordinator', 'supervisor', 'lead', 'senior', 'junior',
    'associate', 'executive', 'officer', 'administrator'
  ];
  
  const lowerText = text.toLowerCase();
  
  roleKeywords.forEach(role => {
    if (lowerText.includes(role)) {
      roles.push(role);
    }
  });
  
  return [...new Set(roles)];
};

// Helper functions for experience extraction
const extractCompanyFromLine = (line) => {
  // Simple heuristic - take first part before comma or dash
  const parts = line.split(/[,\-–]/);
  return parts[0].trim();
};

const extractPositionFromLine = (lines, index) => {
  // Look at current and next lines for position
  for (let i = Math.max(0, index - 1); i <= Math.min(lines.length - 1, index + 1); i++) {
    const line = lines[i].trim();
    if (line.length > 5 && line.length < 100 && 
        !line.match(/\d{4}/) && !line.includes('@')) {
      return line;
    }
  }
  return 'Professional';
};

const extractDurationFromLine = (line) => {
  const dateMatch = line.match(/\d{4}[\s\-–to]*\d{4}|\d{4}[\s\-–to]*present|\d{4}[\s\-–to]*current/i);
  return dateMatch ? dateMatch[0] : 'Recent';
};

const extractDescriptionFromLines = (lines, startIndex) => {
  let description = '';
  for (let i = startIndex + 1; i < Math.min(lines.length, startIndex + 5); i++) {
    const line = lines[i].trim();
    if (line.length > 20 && !line.match(/\d{4}/) && !line.includes('@')) {
      description += line + ' ';
      if (description.length > 200) break;
    }
  }
  return description.trim() || 'Professional experience in the field';
};

// Create completely dynamic profile based on resume analysis
const createDynamicProfile = (resumeAnalysis, resumeText) => {
  console.log('🎯 Creating dynamic profile from resume analysis...');
  
  const profile = {
    currentRole: determineCurrentRole(resumeAnalysis),
    skills: generateSkillsFromAnalysis(resumeAnalysis),
    experience: generateExperienceFromAnalysis(resumeAnalysis),
    targetRoles: generateTargetRoles(resumeAnalysis),
    skillGaps: generateSkillGaps(resumeAnalysis),
    careerMatches: generateCareerMatches(resumeAnalysis),
    learningRoadmap: generateLearningRoadmap(resumeAnalysis)
  };
  
  console.log('✅ Dynamic profile created:', {
    currentRole: profile.currentRole,
    skillsCount: profile.skills.length,
    experienceCount: profile.experience.length,
    targetRolesCount: profile.targetRoles.length
  });
  
  return profile;
};

const determineCurrentRole = (analysis) => {
  if (analysis.experience.length > 0) {
    return analysis.experience[0].position || 'Professional';
  }
  
  // Determine from industries and roles
  if (analysis.industries.includes('Technology')) {
    return analysis.roles.includes('developer') ? 'Software Developer' : 'Technology Professional';
  }
  if (analysis.industries.includes('Healthcare')) {
    return 'Healthcare Professional';
  }
  if (analysis.industries.includes('Finance')) {
    return 'Finance Professional';
  }
  if (analysis.industries.includes('Infrastructure')) {
    return 'Infrastructure Professional';
  }
  
  return analysis.name || 'Professional';
};

const generateSkillsFromAnalysis = (analysis) => {
  const skills = [];
  
  // Add skills from extracted skills
  analysis.skills.forEach(skill => {
    skills.push({
      name: skill,
      level: Math.floor(Math.random() * 30) + 60, // 60-90 range
      category: categorizeSkill(skill, analysis.industries)
    });
  });
  
  // Add industry-specific skills
  analysis.industries.forEach(industry => {
    const industrySkills = getIndustrySpecificSkills(industry);
    industrySkills.forEach(skill => {
      if (!skills.some(s => s.name.toLowerCase() === skill.name.toLowerCase())) {
        skills.push(skill);
      }
    });
  });
  
  // Add role-specific skills
  analysis.roles.forEach(role => {
    const roleSkills = getRoleSpecificSkills(role);
    roleSkills.forEach(skill => {
      if (!skills.some(s => s.name.toLowerCase() === skill.name.toLowerCase())) {
        skills.push(skill);
      }
    });
  });
  
  return skills.slice(0, 12); // Limit to 12 skills
};

const categorizeSkill = (skill, industries) => {
  const skillLower = skill.toLowerCase();
  
  if (skillLower.includes('manage') || skillLower.includes('lead') || skillLower.includes('plan')) {
    return 'Management';
  }
  if (skillLower.includes('program') || skillLower.includes('code') || skillLower.includes('software')) {
    return 'Technical';
  }
  if (skillLower.includes('analy') || skillLower.includes('data') || skillLower.includes('research')) {
    return 'Analytics';
  }
  if (skillLower.includes('commun') || skillLower.includes('present') || skillLower.includes('write')) {
    return 'Communication';
  }
  if (skillLower.includes('finance') || skillLower.includes('budget') || skillLower.includes('account')) {
    return 'Finance';
  }
  
  // Categorize based on industries
  if (industries.includes('Technology')) return 'Technical';
  if (industries.includes('Healthcare')) return 'Healthcare';
  if (industries.includes('Finance')) return 'Finance';
  if (industries.includes('Infrastructure')) return 'Engineering';
  
  return 'Professional';
};

const getIndustrySpecificSkills = (industry) => {
  const industrySkills = {
    'Technology': [
      { name: 'Software Development', level: 80, category: 'Technical' },
      { name: 'System Design', level: 75, category: 'Technical' },
      { name: 'Agile Methodology', level: 70, category: 'Process' }
    ],
    'Healthcare': [
      { name: 'Healthcare Regulations', level: 85, category: 'Compliance' },
      { name: 'Patient Care', level: 80, category: 'Healthcare' },
      { name: 'Medical Documentation', level: 75, category: 'Documentation' }
    ],
    'Finance': [
      { name: 'Financial Analysis', level: 85, category: 'Finance' },
      { name: 'Risk Management', level: 80, category: 'Finance' },
      { name: 'Regulatory Compliance', level: 75, category: 'Compliance' }
    ],
    'Infrastructure': [
      { name: 'Project Management', level: 85, category: 'Management' },
      { name: 'Infrastructure Planning', level: 80, category: 'Engineering' },
      { name: 'Quality Assurance', level: 75, category: 'Quality' }
    ],
    'Energy': [
      { name: 'Energy Management', level: 85, category: 'Technical' },
      { name: 'Safety Protocols', level: 90, category: 'Safety' },
      { name: 'Environmental Compliance', level: 80, category: 'Compliance' }
    ]
  };
  
  return industrySkills[industry] || [];
};

const getRoleSpecificSkills = (role) => {
  const roleSkills = {
    'manager': [
      { name: 'Team Leadership', level: 85, category: 'Leadership' },
      { name: 'Strategic Planning', level: 80, category: 'Strategy' }
    ],
    'analyst': [
      { name: 'Data Analysis', level: 85, category: 'Analytics' },
      { name: 'Report Writing', level: 80, category: 'Communication' }
    ],
    'engineer': [
      { name: 'Technical Design', level: 85, category: 'Technical' },
      { name: 'Problem Solving', level: 80, category: 'Analytical' }
    ],
    'consultant': [
      { name: 'Client Management', level: 85, category: 'Client Relations' },
      { name: 'Business Strategy', level: 80, category: 'Strategy' }
    ]
  };
  
  return roleSkills[role] || [];
};

const generateExperienceFromAnalysis = (analysis) => {
  if (analysis.experience.length > 0) {
    return analysis.experience;
  }
  
  // Generate based on industries
  return analysis.industries.map(industry => ({
    company: `${industry} Organization`,
    position: `${industry} Professional`,
    duration: 'Recent Experience',
    description: `Professional experience in ${industry.toLowerCase()} sector`
  }));
};

const generateTargetRoles = (analysis) => {
  const targetRoles = [];
  
  // Based on current experience and industries
  analysis.industries.forEach(industry => {
    switch (industry) {
      case 'Technology':
        targetRoles.push('Senior Software Engineer', 'Tech Lead', 'Engineering Manager');
        break;
      case 'Healthcare':
        targetRoles.push('Healthcare Manager', 'Clinical Director', 'Healthcare Consultant');
        break;
      case 'Finance':
        targetRoles.push('Financial Manager', 'Investment Analyst', 'Finance Director');
        break;
      case 'Infrastructure':
        targetRoles.push('Project Manager', 'Infrastructure Director', 'Construction Manager');
        break;
      case 'Energy':
        targetRoles.push('Energy Manager', 'Operations Director', 'Sustainability Manager');
        break;
      default:
        targetRoles.push('Senior Manager', 'Director', 'Consultant');
    }
  });
  
  return [...new Set(targetRoles)].slice(0, 5);
};

const generateSkillGaps = (analysis) => {
  const skillGaps = [];
  
  analysis.industries.forEach(industry => {
    switch (industry) {
      case 'Technology':
        skillGaps.push(
          { skill: 'Cloud Computing', importance: 'High', timeToLearn: '3-4 months', resources: ['AWS Certification', 'Cloud Courses'] },
          { skill: 'DevOps', importance: 'Medium', timeToLearn: '2-3 months', resources: ['DevOps Training', 'CI/CD Courses'] }
        );
        break;
      case 'Healthcare':
        skillGaps.push(
          { skill: 'Digital Health', importance: 'High', timeToLearn: '4-6 months', resources: ['Digital Health Courses'] },
          { skill: 'Healthcare Analytics', importance: 'Medium', timeToLearn: '3-4 months', resources: ['Analytics Training'] }
        );
        break;
      case 'Finance':
        skillGaps.push(
          { skill: 'FinTech', importance: 'High', timeToLearn: '3-4 months', resources: ['FinTech Courses'] },
          { skill: 'Blockchain', importance: 'Medium', timeToLearn: '2-3 months', resources: ['Blockchain Training'] }
        );
        break;
      case 'Infrastructure':
        skillGaps.push(
          { skill: 'Smart Infrastructure', importance: 'High', timeToLearn: '4-5 months', resources: ['IoT Courses', 'Smart City Training'] },
          { skill: 'Sustainable Development', importance: 'Medium', timeToLearn: '2-3 months', resources: ['Green Building Certification'] }
        );
        break;
      case 'Energy':
        skillGaps.push(
          { skill: 'Renewable Energy', importance: 'High', timeToLearn: '4-6 months', resources: ['Renewable Energy Courses'] },
          { skill: 'Carbon Management', importance: 'High', timeToLearn: '3-4 months', resources: ['Sustainability Certification'] }
        );
        break;
    }
  });
  
  return skillGaps.slice(0, 6);
};

const generateCareerMatches = (analysis) => {
  const careerMatches = [];
  
  analysis.industries.forEach(industry => {
    const roles = generateTargetRoles({ industries: [industry] });
    roles.forEach(role => {
      careerMatches.push({
        role,
        matchPercentage: Math.floor(Math.random() * 20) + 75, // 75-95 range
        requirements: getRequirementsForRole(role, industry),
        missingSkills: getMissingSkillsForRole(role, industry)
      });
    });
  });
  
  return careerMatches.slice(0, 3);
};

const getRequirementsForRole = (role, industry) => {
  const baseRequirements = ['Professional Experience', 'Industry Knowledge', 'Communication Skills'];
  const industryRequirements = {
    'Technology': ['Technical Skills', 'Software Development', 'Agile Methodology'],
    'Healthcare': ['Healthcare Regulations', 'Patient Care', 'Medical Knowledge'],
    'Finance': ['Financial Analysis', 'Risk Management', 'Regulatory Knowledge'],
    'Infrastructure': ['Project Management', 'Engineering Knowledge', 'Quality Assurance'],
    'Energy': ['Energy Systems', 'Safety Protocols', 'Environmental Compliance']
  };
  
  return [...baseRequirements, ...(industryRequirements[industry] || [])];
};

const getMissingSkillsForRole = (role, industry) => {
  const industryMissingSkills = {
    'Technology': ['Cloud Computing', 'DevOps', 'Microservices'],
    'Healthcare': ['Digital Health', 'Healthcare Analytics', 'Telemedicine'],
    'Finance': ['FinTech', 'Blockchain', 'Algorithmic Trading'],
    'Infrastructure': ['Smart Infrastructure', 'BIM Software', 'Sustainable Design'],
    'Energy': ['Renewable Energy', 'Smart Grid', 'Carbon Management']
  };
  
  return industryMissingSkills[industry] || ['Digital Skills', 'Advanced Analytics'];
};

const generateLearningRoadmap = (analysis) => {
  const roadmap = [];
  
  analysis.industries.forEach((industry, index) => {
    const phase = index === 0 ? 'Foundation' : index === 1 ? 'Intermediate' : 'Advanced';
    const skills = getIndustrySpecificSkills(industry).map(s => s.name);
    
    roadmap.push({
      phase,
      title: `${industry} Skills Development`,
      skills: skills.slice(0, 3),
      resources: [`${industry} Training Programs`, 'Industry Certifications', 'Online Courses'],
      timeframe: `${3 + index} months`,
      status: index === 0 ? 'current' : 'upcoming'
    });
  });
  
  return roadmap.slice(0, 4);
};

// POST /api/analysis/upload-resume
router.post('/upload-resume', authenticateToken, upload.single('resume'), async (req, res) => {
  try {
    const fileBuffer = req.file?.buffer;
    if (!fileBuffer) return res.status(400).json({ message: 'No file uploaded' });

    const pdfData = await pdfParse(fileBuffer);
    const resumeText = pdfData.text;
    
    console.log('📄 Resume uploaded, length:', resumeText.length);
    console.log('📄 Resume preview:', resumeText.substring(0, 200));

    // Step 1: Analyze resume content
    const resumeAnalysis = analyzeResumeContent(resumeText);
    
    // Step 2: Create dynamic profile based on analysis
    const profile = createDynamicProfile(resumeAnalysis, resumeText);
    
    // Step 3: Save to database
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.resumeText = resumeText;
    user.resumeFileName = req.file.originalname;
    user.resumeUploadDate = new Date();
    user.currentRole = profile.currentRole;
    user.skills = profile.skills;
    user.experience = profile.experience;
    user.targetRoles = profile.targetRoles;
    user.skillGaps = profile.skillGaps;
    user.careerMatches = profile.careerMatches;
    user.learningRoadmap = profile.learningRoadmap;
    user.lastAnalysisDate = new Date();
    
    user.calculateCompleteness();
    await user.save();

    console.log('✅ Dynamic profile saved successfully');
    console.log('📊 Profile summary:', {
      currentRole: user.currentRole,
      skillsCount: user.skills.length,
      experienceCount: user.experience.length,
      targetRolesCount: user.targetRoles.length,
      skillGapsCount: user.skillGaps.length,
      careerMatchesCount: user.careerMatches.length,
      roadmapCount: user.learningRoadmap.length
    });

    res.status(200).json({
      message: 'Resume analyzed successfully',
      profile: {
        name: resumeAnalysis.name,
        currentRole: user.currentRole,
        skills: user.skills,
        experience: user.experience,
        targetRoles: user.targetRoles,
        skillGaps: user.skillGaps,
        roadmap: user.learningRoadmap,
        careerMatches: user.careerMatches
      }
    });

  } catch (error) {
    console.error('❌ Analysis Error:', error);
    res.status(500).json({
      message: 'Error processing resume',
      error: error.message
    });
  }
});

// GET /api/analysis/history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      careerMatches: user.careerMatches || [],
      skillGaps: user.skillGaps || [],
      learningRoadmap: user.learningRoadmap || [],
    });
  } catch (error) {
    console.error('❌ History fetch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
