import express from 'express';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get user profile
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ profile: user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile
router.put('/', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    const allowedUpdates = [
      'firstName', 'lastName', 'phone', 'location', 'currentRole',
      'yearsOfExperience', 'bio', 'linkedinUrl', 'githubUrl', 'portfolioUrl',
      'skills', 'targetRoles', 'experience', 'education', 'preferences'
    ];

    // Filter only allowed updates
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      filteredUpdates,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Recalculate profile completeness
    user.calculateCompleteness();
    await user.save();

    res.json({
      message: 'Profile updated successfully',
      profile: user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add skill
router.post('/skills', authenticateToken, async (req, res) => {
  try {
    const { name, level, category } = req.body;

    if (!name || !category) {
      return res.status(400).json({ message: 'Skill name and category are required' });
    }

    const user = await User.findById(req.user._id);
    
    // Check if skill already exists
    const existingSkill = user.skills.find(skill => 
      skill.name.toLowerCase() === name.toLowerCase()
    );

    if (existingSkill) {
      return res.status(400).json({ message: 'Skill already exists' });
    }

    user.skills.push({ name, level: level || 50, category });
    user.calculateCompleteness();
    await user.save();

    res.json({
      message: 'Skill added successfully',
      skills: user.skills
    });
  } catch (error) {
    console.error('Add skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update skill
router.put('/skills/:skillId', authenticateToken, async (req, res) => {
  try {
    const { skillId } = req.params;
    const { name, level, category } = req.body;

    const user = await User.findById(req.user._id);
    const skill = user.skills.id(skillId);

    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }

    if (name) skill.name = name;
    if (level !== undefined) skill.level = level;
    if (category) skill.category = category;

    await user.save();

    res.json({
      message: 'Skill updated successfully',
      skills: user.skills
    });
  } catch (error) {
    console.error('Update skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete skill
router.delete('/skills/:skillId', authenticateToken, async (req, res) => {
  try {
    const { skillId } = req.params;

    const user = await User.findById(req.user._id);
    user.skills.pull(skillId);
    await user.save();

    res.json({
      message: 'Skill deleted successfully',
      skills: user.skills
    });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add experience
router.post('/experience', authenticateToken, async (req, res) => {
  try {
    const experienceData = req.body;
    const user = await User.findById(req.user._id);
    
    user.experience.push(experienceData);
    user.calculateCompleteness();
    await user.save();

    res.json({
      message: 'Experience added successfully',
      experience: user.experience
    });
  } catch (error) {
    console.error('Add experience error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add education
router.post('/education', authenticateToken, async (req, res) => {
  try {
    const educationData = req.body;
    const user = await User.findById(req.user._id);
    
    user.education.push(educationData);
    user.calculateCompleteness();
    await user.save();

    res.json({
      message: 'Education added successfully',
      education: user.education
    });
  } catch (error) {
    console.error('Add education error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;