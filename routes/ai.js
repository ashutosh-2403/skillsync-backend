// server/routes/ai.js
import express from 'express';
import { CohereClient } from 'cohere-ai';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY
});

// POST /api/ai/chat
router.post('/chat', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { message, userProfile } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        error: 'Message is required',
        response: 'Please provide a message to get started with your career assistance.'
      });
    }

    if (message.length > 500) {
      return res.status(400).json({
        error: 'Message too long',
        response: 'Please keep your message under 500 characters for better processing.'
      });
    }

    console.log(`🤖 AI Chat request from user: ${req.user._id}`);
    console.log(`📝 Message: ${message.substring(0, 100)}...`);

    // Set request timeout
    const requestTimeout = setTimeout(() => {
      console.log('⏰ AI request timeout reached');
      if (!res.headersSent) {
        return res.status(408).json({ 
          error: 'Request timeout',
          response: 'I need more time to process your request. Please try asking a shorter question or try again in a moment.'
        });
      }
    }, 55000); // 55 second timeout

    try {
      // Get user data from database with timeout
      const user = await Promise.race([
        User.findById(req.user._id),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 5000)
        )
      ]);

      if (!user) {
        clearTimeout(requestTimeout);
        return res.status(404).json({ 
          error: 'User not found',
          response: 'I couldn\'t find your profile. Please make sure you\'re logged in and try again.'
        });
      }

      // Create optimized user context
      const userContext = createOptimizedUserContext(user, userProfile);
      console.log(`📊 User context created (${userContext.length} chars)`);
      
      // Generate AI response with fallback
      let aiResponse;
      try {
        aiResponse = await generateAIResponse(message, userContext);
        console.log(`✅ AI response generated in ${Date.now() - startTime}ms`);
      } catch (aiError) {
        console.error('🔄 AI generation failed, using fallback:', aiError.message);
        aiResponse = generateIntelligentFallback(message, user);
      }
      
      clearTimeout(requestTimeout);
      
      if (!res.headersSent) {
        res.json({ 
          response: aiResponse,
          processingTime: Date.now() - startTime
        });
      }
      
    } catch (dbError) {
      clearTimeout(requestTimeout);
      console.error('💾 Database error:', dbError);
      
      if (!res.headersSent) {
        const fallbackResponse = generateBasicFallback(message);
        res.json({ 
          response: fallbackResponse,
          error: 'Database temporarily unavailable'
        });
      }
    }
    
  } catch (error) {
    console.error('❌ AI Chat Error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate response',
        response: 'I apologize, but I encountered an error. Please try asking your question again, or try a simpler question.'
      });
    }
  }
});

// Optimized user context creation
const createOptimizedUserContext = (user, userProfile) => {
  // Limit context size to prevent token overflow
  const maxSkills = 8;
  const maxExperience = 3;
  const maxSkillGaps = 5;
  const maxRoadmapItems = 3;

  const topSkills = user.skills?.slice(0, maxSkills) || [];
  const recentExperience = user.experience?.slice(0, maxExperience) || [];
  const prioritySkillGaps = user.skillGaps?.slice(0, maxSkillGaps) || [];
  const currentRoadmap = user.learningRoadmap?.slice(0, maxRoadmapItems) || [];

  return `User: ${user.firstName} ${user.lastName}
Role: ${user.currentRole || 'Professional'}

Top Skills (${topSkills.length}):
${topSkills.map(skill => `• ${skill.name} (${skill.level}%, ${skill.category})`).join('\n')}

Recent Experience:
${recentExperience.map(exp => `• ${exp.position} at ${exp.company} (${exp.duration})`).join('\n')}

Target Roles: ${user.targetRoles?.slice(0, 3).join(', ') || 'Not specified'}

Priority Skill Gaps:
${prioritySkillGaps.map(gap => `• ${gap.skill} (${gap.importance} priority)`).join('\n')}

Learning Focus:
${currentRoadmap.map(step => `• ${step.title} (${step.timeframe})`).join('\n')}`;
};

// Enhanced AI response generation
const generateAIResponse = async (userMessage, userContext) => {
  // Optimized prompt for faster processing
  const prompt = `You are an AI Career Assistant. Provide personalized, actionable career advice.

${userContext}

Question: ${userMessage}

Guidelines:
- Be specific and reference their actual skills/experience
- Provide 2-3 concrete action steps
- Keep response under 300 words
- Be encouraging and professional
- If data is limited, acknowledge it and provide general guidance

Response:`;

  try {
    const response = await Promise.race([
      cohere.generate({
        model: 'command',
        prompt,
        maxTokens: 400,
        temperature: 0.6,
        truncate: 'END',
        stopSequences: ['\n\nUser:', '\n\nQuestion:']
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Cohere API timeout')), 45000)
      )
    ]);

    const aiText = response.generations[0].text.trim();
    
    // Validate response quality
    if (aiText.length < 20) {
      throw new Error('Response too short');
    }
    
    return aiText;
    
  } catch (error) {
    console.error('🔄 Cohere API Error:', error.message);
    throw error;
  }
};

// Intelligent fallback based on user data
const generateIntelligentFallback = (message, user) => {
  const messageLower = message.toLowerCase();
  const currentRole = user.currentRole || 'Professional';
  const skillsCount = user.skills?.length || 0;
  const hasExperience = user.experience?.length > 0;
  const hasSkillGaps = user.skillGaps?.length > 0;

  // Career guidance
  if (messageLower.includes('career') || messageLower.includes('path') || messageLower.includes('role')) {
    if (user.targetRoles?.length > 0) {
      return `Based on your profile as a ${currentRole}, I see you're targeting roles like ${user.targetRoles.slice(0, 2).join(' and ')}. Here are some steps to advance:

1. **Strengthen Core Skills**: Focus on developing the ${skillsCount > 0 ? 'skills you already have' : 'fundamental skills for your field'}
2. **Network Strategically**: Connect with professionals in your target roles
3. **Gain Relevant Experience**: Look for projects or responsibilities that align with your goals

${hasSkillGaps ? 'I notice some skill gaps in your profile - addressing these could significantly boost your career prospects.' : 'Your skill set looks solid for your current trajectory.'}

What specific aspect of your career transition would you like to explore further?`;
    } else {
      return `As a ${currentRole}, you have several career advancement opportunities. To provide more specific guidance, I'd need to know:

1. What type of roles interest you most?
2. Are you looking to advance in your current field or transition to something new?
3. What are your key strengths and interests?

${skillsCount > 0 ? `With ${skillsCount} skills in your profile, you have a good foundation to build upon.` : 'Consider uploading your resume to get more personalized career recommendations.'}`;
    }
  }

  // Skills and learning
  if (messageLower.includes('skill') || messageLower.includes('learn') || messageLower.includes('develop')) {
    if (hasSkillGaps) {
      const topGaps = user.skillGaps.slice(0, 3);
      return `Based on your profile analysis, here are the most important skills to develop:

${topGaps.map((gap, i) => `${i + 1}. **${gap.skill}** (${gap.importance} priority) - Estimated learning time: ${gap.timeToLearn}`).join('\n')}

**Recommended approach:**
- Start with the highest priority skills first
- Dedicate 1-2 hours daily to focused learning
- Practice with real projects when possible
- Consider online courses, certifications, or mentorship

${skillsCount > 0 ? `You already have ${skillsCount} skills listed, so you're building on a solid foundation.` : ''}

Which of these skills would you like specific learning resources for?`;
    } else {
      return `As a ${currentRole}, staying current with industry trends is crucial. Here's my general advice:

1. **Assess Current Market Demands**: Research job postings in your field to identify trending skills
2. **Focus on Complementary Skills**: Build skills that enhance your existing expertise
3. **Consider Emerging Technologies**: Look into AI, automation, or digital tools relevant to your industry

${skillsCount > 0 ? `Your current skill set includes ${skillsCount} areas - consider deepening expertise in your strongest areas while adding complementary skills.` : 'Upload your resume for a personalized skill gap analysis and learning recommendations.'}`;
    }
  }

  // Interview preparation
  if (messageLower.includes('interview') || messageLower.includes('prepare')) {
    return `Here's how to prepare for interviews in your field as a ${currentRole}:

**Technical Preparation:**
${skillsCount > 0 ? `- Review your ${skillsCount} listed skills and prepare specific examples of how you've used them` : '- Prepare examples demonstrating your key competencies'}
- Practice explaining complex concepts in simple terms
- Prepare for both technical and behavioral questions

**Experience-Based Questions:**
${hasExperience ? '- Use the STAR method (Situation, Task, Action, Result) to structure your experience stories' : '- Focus on projects, coursework, or volunteer experiences that demonstrate your capabilities'}
- Prepare 3-5 specific examples of challenges you've overcome
- Quantify your achievements where possible

**Research & Questions:**
- Research the company's recent projects and challenges
- Prepare thoughtful questions about the role and team
- Understand how your background aligns with their needs

What type of role are you interviewing for? I can provide more specific guidance.`;
  }

  // Resume advice
  if (messageLower.includes('resume') || messageLower.includes('cv')) {
    return `Here's how to optimize your resume as a ${currentRole}:

**Skills Section:**
${skillsCount > 0 ? `- You have ${skillsCount} skills listed - ensure they're relevant to your target roles` : '- Add a comprehensive skills section with both technical and soft skills'}
- Use specific proficiency levels or years of experience
- Group skills by category for better readability

**Experience Section:**
${hasExperience ? '- Quantify your achievements with specific metrics and results' : '- Include relevant projects, internships, or volunteer work'}
- Use action verbs to start each bullet point
- Focus on impact and outcomes, not just responsibilities

**Optimization Tips:**
- Tailor your resume for each application
- Use keywords from the job description
- Keep it concise but comprehensive (1-2 pages)
- Ensure consistent formatting and no typos

${user.targetRoles?.length > 0 ? `Since you're targeting ${user.targetRoles[0]} roles, make sure your resume highlights relevant experience and skills for that field.` : ''}

What specific aspect of your resume would you like to improve?`;
  }

  // General response
  return `Hi! I'm here to help with your career development as a ${currentRole}. I can assist with:

🎯 **Career Planning** - Exploring advancement opportunities and role transitions
📚 **Skill Development** - Identifying learning priorities and creating study plans  
💼 **Interview Prep** - Practice questions and presentation strategies
📄 **Resume Optimization** - Improving your professional presentation

${skillsCount > 0 ? `I can see you have ${skillsCount} skills in your profile, which gives me a good foundation to provide personalized advice.` : 'For more personalized guidance, consider uploading your resume to get detailed analysis and recommendations.'}

${hasSkillGaps ? 'I notice some skill gaps in your profile that we could work on addressing.' : ''}

What specific area would you like to focus on today?`;
};

// Basic fallback for system errors
const generateBasicFallback = (message) => {
  const messageLower = message.toLowerCase();
  
  if (messageLower.includes('skill')) {
    return "I'd be happy to help with skill development! While I'm experiencing some technical issues accessing your full profile, I can provide general guidance on identifying and developing key skills for your career goals. What specific skills or areas are you interested in?";
  }
  
  if (messageLower.includes('career')) {
    return "Career planning is one of my specialties! Although I'm having trouble accessing your detailed profile right now, I can help you think through career paths, advancement strategies, and goal setting. What aspect of your career would you like to explore?";
  }
  
  if (messageLower.includes('interview')) {
    return "Interview preparation is crucial for career success! I can help you practice common questions, develop your storytelling technique, and build confidence. What type of role or industry are you preparing for?";
  }
  
  return "I'm here to help with your career development! While I'm experiencing some technical issues, I can still assist with career planning, skill development, interview preparation, and professional growth strategies. What would you like to focus on?";
};

export default router;
