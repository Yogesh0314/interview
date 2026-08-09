/**
 * Production-Quality Deterministic ATS Scoring Engine.
 * Implements Level 1-4 matching, keyword stuffing mitigation, target-role relevance,
 * dynamic experience weighting, and evidence-based score breakdown.
 * Now supports both Mode A (Job Match Mode) and Mode B (Resume-Only Mode).
 */

// Centralized Configurable Configuration
export const CONFIG = {
  WEIGHTS: {
    skillMatch: 0.40,
    experienceRelevance: 0.20,
    projectsAchievements: 0.15,
    structureCompleteness: 0.15,
    formattingParseability: 0.10
  },
  RESUME_ONLY_WEIGHTS: {
    parseability: 0.20,
    structure: 0.20,
    skills: 0.15,
    experience: 0.15,
    projects: 0.10,
    achievements: 0.10,
    education: 0.05,
    contact: 0.05
  },
  SKILL_WEIGHTS: {
    required: 0.75,
    preferred: 0.25
  },
  SECTION_CONFIDENCE: {
    experience: 0.95,
    projects: 0.95,
    education: 0.75,
    skills_list: 0.40,
    summary: 0.50
  },
  THRESHOLDS: {
    Excellent: 85,
    Strong: 70,
    Moderate: 55,
    Weak: 40
  },
  RESUME_ONLY_THRESHOLDS: {
    'Excellent ATS readiness': 90,
    'Strong ATS readiness': 80,
    'Good ATS readiness': 70,
    'Needs improvement': 60
  },
  EXP_YEARS_EXPECTED: {
    Intern: { min: 0, max: 1 },
    'Entry-level': { min: 0, max: 2 },
    Junior: { min: 1, max: 3 },
    'Mid-Level': { min: 2, max: 5 },
    Senior: { min: 5, max: 12 },
    Lead: { min: 7, max: 20 },
    Manager: { min: 8, max: 25 }
  }
};

// Canonical Synonyms / Alias mapping (Level 2 match)
export const CANONICAL_ALIASES = {
  'react': ['reactjs', 'react.js', 'react js', 'react framework'],
  'nodejs': ['node.js', 'nodejs', 'node js', 'node'],
  'postgresql': ['postgres', 'postgresql', 'postgres sql'],
  'javascript': ['js', 'javascript', 'ecmascript'],
  'typescript': ['ts', 'typescript'],
  'mongodb': ['mongodb', 'mongo'],
  'aws': ['aws', 'amazon web services', 'amazon cloud'],
  'gcp': ['gcp', 'google cloud', 'google cloud platform'],
  'kubernetes': ['k8s', 'kubernetes'],
  'docker': ['docker', 'docker container'],
  'jwt': ['jwt', 'json web token', 'json web tokens'],
  'rest_api': ['rest api', 'rest apis', 'restful api', 'restful apis', 'rest'],
  'ci_cd': ['ci/cd', 'cicd', 'ci-cd', 'continuous integration', 'github actions', 'jenkins'],
  'c_sharp': ['c#', 'csharp', 'c-sharp'],
  'cpp': ['c++', 'cpp', 'c plus plus'],
  'python': ['python', 'py'],
  'golang': ['go', 'golang'],
  'css': ['css', 'css3'],
  'html': ['html', 'html5'],
  'machine_learning': ['machine learning', 'ml', 'neural networks', 'deep learning'],
  'natural_language_processing': ['natural language processing', 'nlp'],
  'computer_vision': ['computer vision', 'cv'],
  'sql': ['sql', 'structured query language']
};

// Controlled Ecosystem / Taxonomy mapping (Level 3 match)
export const ECOSYSTEM_TAXONOMY = {
  'nodejs': ['express', 'nestjs', 'fastify', 'koa', 'socket.io', 'pm2'],
  'react': ['next.js', 'nextjs', 'react native', 'redux', 'gatsby', 'remix', 'svelte', 'vue'],
  'python': ['django', 'flask', 'fastapi', 'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy', 'keras', 'nlp', 'opencv', 'spacy', 'nltk'],
  'java': ['spring', 'spring boot', 'hibernate', 'maven', 'gradle', 'junit'],
  'c_sharp': ['.net', 'dotnet', 'asp.net', 'entity framework', 'wpf', 'wcf'],
  'ruby': ['rails', 'ruby on rails', 'sinatra', 'rspec'],
  'php': ['laravel', 'symfony', 'codeigniter', 'wordpress', 'drupal'],
  'aws': ['s3', 'ec2', 'lambda', 'rds', 'dynamodb', 'ecs', 'eks', 'iam', 'cloudfront', 'apigateway', 'cognito', 'aws lambda'],
  'gcp': ['bigquery', 'cloud run', 'gcs', 'gke', 'cloud functions', 'app engine'],
  'azure': ['azure functions', 'blob storage', 'cosmos db', 'aks']
};

const SENIORITY_RANKS = {
  'Intern': 1,
  'Entry-level': 2,
  'Junior': 3,
  'Mid-Level': 4,
  'Senior': 5,
  'Lead': 6,
  'Manager': 7
};

const ACTION_VERBS = new Set([
  'designed', 'built', 'optimized', 'reduced', 'grew', 'led', 'managed',
  'implemented', 'created', 'deployed', 'migrated', 'architected', 'developed',
  'automated', 'scaled', 'coordinated', 'mentored', 'analyzed', 'programmed'
]);

// ── Text utilities ───────────────────────────────────────────────────────────
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeSkill(skillText) {
  if (!skillText) return '';
  let normalized = skillText.toLowerCase().trim();
  normalized = normalized.replace(/\b(v?\d+(\.\d+)*)\b/g, '').trim();
  normalized = normalized.replace(/\s+/g, ' ');
  return normalized;
}

export function getCanonicalSkill(normalizedSkill) {
  for (const [canonical, aliases] of Object.entries(CANONICAL_ALIASES)) {
    if (canonical === normalizedSkill || aliases.includes(normalizedSkill)) {
      return canonical;
    }
  }
  return normalizedSkill;
}

export function isEcosystemMatch(canonResume, canonJd) {
  const normResume = canonResume.toLowerCase();
  const normJd = canonJd.toLowerCase();
  
  // Resume skill is a child of JD skill in the ecosystem taxonomy
  if (ECOSYSTEM_TAXONOMY[normJd] && ECOSYSTEM_TAXONOMY[normJd].includes(normResume)) {
    return true;
  }
  return false;
}

export function countQuantifiedBullets(text) {
  if (!text) return 0;
  const patterns = [
    /\d+\s*%/g,
    /\$\d+/g,
    /\d+x\b/gi,
    /\d+\+?\s*(?:[a-zA-Z-]+\s+){0,3}(users|customers|clients|requests|transactions|projects|team members|engineers|developers|hours|days|weeks|months|years|percent|kbps|mbps|gbps)\b/gi
  ];
  let count = 0;
  for (const p of patterns) {
    const m = text.match(p);
    if (m) count += m.length;
  }
  return count;
}

export function countActionVerbs(text) {
  if (!text) return 0;
  const words = text.toLowerCase().split(/\W+/);
  let count = 0;
  for (const w of words) {
    if (ACTION_VERBS.has(w)) count++;
  }
  return count;
}

export function isTextMentioningSkill(skill, rawText) {
  if (!skill || !rawText) return false;
  const normText = rawText.toLowerCase();
  const normSkill = skill.toLowerCase();
  
  const searchTerms = [normSkill];
  for (const [canonical, aliases] of Object.entries(CANONICAL_ALIASES)) {
    if (canonical === normSkill || aliases.includes(normSkill)) {
      searchTerms.push(canonical, ...aliases);
    }
  }
  
  for (const term of searchTerms) {
    if (term.length === 1) {
      const re = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
      if (re.test(normText)) return true;
    } else {
      const escaped = escapeRegex(term);
      const re = new RegExp(`\\b${escaped}\\b`, 'i');
      if (re.test(normText)) return true;
      if (/[+#.]/.test(term)) {
        if (normText.includes(term)) return true;
      }
    }
  }
  return false;
}

export function detectCandidateSeniority(resumeData) {
  const text = `${resumeData.headline || ''} ${resumeData.summary || ''} ${(resumeData.experience || []).map(j => j.jobTitle).join(' ')}`.toLowerCase();
  
  if (text.includes('manager') || text.includes('director') || text.includes('head of')) return 'Manager';
  if (text.includes('lead') || text.includes('architect') || text.includes('principal')) return 'Lead';
  if (text.includes('senior') || text.includes('sr.')) return 'Senior';
  if (text.includes('intern') || text.includes('student') || text.includes('graduate') || text.includes('fresher')) return 'Intern';
  if (text.includes('junior') || text.includes('jr.')) return 'Junior';
  return 'Mid-Level';
}

export function gatherResumeSkillsWithEvidence(parsedResume, rawResumeText) {
  const skillsWithEvidence = [];
  const allParsedSkills = [];
  
  if (parsedResume.skills) {
    Object.entries(parsedResume.skills).forEach(([category, list]) => {
      if (Array.isArray(list)) {
        list.forEach(skill => {
          allParsedSkills.push({ skill, category });
        });
      }
    });
  }
  
  if (Array.isArray(parsedResume.certifications)) {
    parsedResume.certifications.forEach(cert => {
      allParsedSkills.push({ skill: cert, category: 'certifications' });
    });
  }
  
  for (const item of allParsedSkills) {
    const skill = item.skill;
    if (!isTextMentioningSkill(skill, rawResumeText)) {
      continue;
    }
    
    let section = 'skills_list';
    let confidence = CONFIG.SECTION_CONFIDENCE.skills_list;
    let snippet = `Listed in skills section under ${item.category}`;
    
    if (parsedResume.experience && Array.isArray(parsedResume.experience)) {
      for (const exp of parsedResume.experience) {
        const textToSearch = [...(exp.responsibilities || []), ...(exp.achievements || [])].join(' ');
        if (isTextMentioningSkill(skill, textToSearch)) {
          section = 'experience';
          confidence = CONFIG.SECTION_CONFIDENCE.experience;
          const match = textToSearch.match(new RegExp(`[^.]{0,60}${escapeRegex(skill)}[^.]{0,60}`, 'i'));
          snippet = match ? `...${match[0].trim()}...` : `Mentioned in role at ${exp.employer}`;
          break;
        }
      }
    }
    
    if (section === 'skills_list' && parsedResume.projects && Array.isArray(parsedResume.projects)) {
      for (const proj of parsedResume.projects) {
        const textToSearch = `${proj.title} ${proj.description} ${(proj.technologies || []).join(' ')} ${proj.outcomes?.join(' ')}`;
        if (isTextMentioningSkill(skill, textToSearch)) {
          section = 'projects';
          confidence = CONFIG.SECTION_CONFIDENCE.projects;
          const match = textToSearch.match(new RegExp(`[^.]{0,60}${escapeRegex(skill)}[^.]{0,60}`, 'i'));
          snippet = match ? `...${match[0].trim()}...` : `Used in project: ${proj.title}`;
          break;
        }
      }
    }
    
    skillsWithEvidence.push({
      name: skill,
      normalized: getCanonicalSkill(normalizeSkill(skill)),
      section,
      confidence,
      evidence: snippet
    });
  }
  
  return skillsWithEvidence;
}

export function isJobRelevantToJdSkills(job, jdRequiredSkills) {
  const text = `${job.jobTitle} ${(job.responsibilities || []).join(' ')} ${(job.achievements || []).join(' ')}`.toLowerCase();
  
  return jdRequiredSkills.some(jdSkill => {
    if (isTextMentioningSkill(jdSkill, text)) return true;
    
    const canonJdSkill = getCanonicalSkill(normalizeSkill(jdSkill));
    const children = ECOSYSTEM_TAXONOMY[canonJdSkill] || [];
    for (const child of children) {
      if (isTextMentioningSkill(child, text)) return true;
    }
    
    for (const [parent, kids] of Object.entries(ECOSYSTEM_TAXONOMY)) {
      if (kids.includes(canonJdSkill)) {
        if (isTextMentioningSkill(parent, text)) return true;
      }
    }
    return false;
  });
}

// ── Scoring Functions ────────────────────────────────────────────────────────

export function matchSkill(resumeSkillName, jdSkillName) {
  const normResume = normalizeSkill(resumeSkillName);
  const normJd = normalizeSkill(jdSkillName);
  
  if (!normResume || !normJd) return 4;
  
  const canonResume = getCanonicalSkill(normResume);
  const canonJd = getCanonicalSkill(normJd);
  
  if (normResume === normJd) {
    return 1;
  }
  if (canonResume === canonJd) {
    return 2;
  }
  if (isEcosystemMatch(canonResume, canonJd)) {
    return 3;
  }
  return 4;
}

export function classifyRequirement(skillName, parsedJd) {
  if (!parsedJd || !parsedJd.requirements) {
    return 'contextual';
  }
  
  const canonSkill = getCanonicalSkill(normalizeSkill(skillName));
  const reqSkills = (parsedJd.requirements.required?.skills || []).map(s => getCanonicalSkill(normalizeSkill(s)));
  const prefSkills = (parsedJd.requirements.preferred?.skills || []).map(s => getCanonicalSkill(normalizeSkill(s)));
  
  if (reqSkills.includes(canonSkill)) {
    return 'required';
  }
  if (prefSkills.includes(canonSkill)) {
    return 'preferred';
  }
  
  for (const s of [...reqSkills, ...prefSkills]) {
    if (isEcosystemMatch(canonSkill, s)) {
      return 'contextual';
    }
  }
  
  return 'irrelevant';
}

export function calculateSkillScore(matchedRequired, missingRequired, matchedPreferred, missingPreferred) {
  const totalRequired = matchedRequired.length + missingRequired.length;
  const totalPreferred = matchedPreferred.length + missingPreferred.length;
  
  let requiredScore = 100;
  if (totalRequired > 0) {
    const matchedRequiredWeight = matchedRequired.reduce((sum, item) => sum + (item.level === 3 ? 0.5 : 1.0) * item.confidence, 0);
    requiredScore = (matchedRequiredWeight / totalRequired) * 100;
  }
  
  if (totalPreferred === 0) {
    return Math.min(100, Math.max(0, requiredScore));
  }
  
  const matchedPreferredWeight = matchedPreferred.reduce((sum, item) => sum + (item.level === 3 ? 0.5 : 1.0) * item.confidence, 0);
  const preferredScore = (matchedPreferredWeight / totalPreferred) * 100;
  
  const skillScore = requiredScore * CONFIG.SKILL_WEIGHTS.required + preferredScore * CONFIG.SKILL_WEIGHTS.preferred;
  return Math.min(100, Math.max(0, skillScore));
}

export function calculateExperienceScore(experience, jdRequirements, jdSeniority, projectsCount, candidateSeniority) {
  const expected = CONFIG.EXP_YEARS_EXPECTED[jdSeniority] || CONFIG.EXP_YEARS_EXPECTED['Mid-Level'];
  const requiredYears = jdRequirements?.experienceYearsRequired !== undefined && jdRequirements?.experienceYearsRequired !== null
    ? jdRequirements.experienceYearsRequired
    : expected.min;
  
  let candidateYears = 0;
  let hasInternships = false;
  
  if (experience && Array.isArray(experience)) {
    experience.forEach(job => {
      candidateYears += job.estimatedYears || 0;
      const title = (job.jobTitle || '').toLowerCase();
      if (title.includes('intern')) {
        hasInternships = true;
      }
    });
  }
  
  // A. Role/Tech stack relevance multiplier
  let relevanceMultiplier = 1.0;
  const jdRequiredSkills = jdRequirements?.requirements?.required?.skills || [];
  if (jdRequiredSkills.length > 0 && experience && experience.length > 0) {
    let relevantJobs = 0;
    experience.forEach(job => {
      if (isJobRelevantToJdSkills(job, jdRequiredSkills)) relevantJobs++;
    });
    relevanceMultiplier = 0.3 + 0.7 * (relevantJobs / experience.length);
  }
  
  let score = 20; // default for 0 years
  
  // B. Seniority check & calculations
  if (jdSeniority === 'Intern' || jdSeniority === 'Entry-level') {
    let freshScore = 60;
    if (candidateYears > 0) freshScore += 15;
    if (hasInternships) freshScore += 15;
    freshScore += Math.min(10, projectsCount * 5);
    score = Math.round(freshScore * relevanceMultiplier);
  } else {
    if (candidateYears > 0) {
      let baseScore = 50;
      if (candidateYears >= requiredYears) {
        baseScore += 40;
        baseScore += Math.min(10, (candidateYears - requiredYears) * 3);
      } else {
        const gap = requiredYears - candidateYears;
        baseScore -= gap * 15;
      }
      score = Math.round(baseScore * relevanceMultiplier);
    }
  }
  
  // C. Seniority rank mismatch penalty (applied to all, including candidateYears === 0)
  const jdRank = SENIORITY_RANKS[jdSeniority] || 4;
  const candRank = SENIORITY_RANKS[candidateSeniority] || 4;
  if (jdRank - candRank > 1) {
    const penalty = (jdRank - candRank) * 15;
    score = Math.max(10, score - penalty);
  }
  
  return Math.min(100, Math.max(10, score));
}

export function calculateProjectScore(projects, jdRequirements) {
  if (!projects || projects.length === 0) {
    return 30;
  }
  
  const jdRequiredSkills = (jdRequirements?.requirements?.required?.skills || []).map(s => getCanonicalSkill(normalizeSkill(s)));
  let totalScore = 0;
  
  const toyKeywords = ['calculator', 'simple', 'toy', 'tutorial', 'homework', 'practice', 'exercise'];
  
  for (const project of projects) {
    const desc = (project.description || '').toLowerCase();
    const title = (project.title || '').toLowerCase();
    
    const isToy = desc.length < 30 || toyKeywords.some(w => desc.includes(w) || title.includes(w));
    const hasAdvancedTech = desc.includes('redis') || desc.includes('kubernetes') || desc.includes('docker') || desc.includes('distributed') || desc.includes('kafka') || desc.includes('microservices') || desc.includes('scalable');
    
    let projectScore = (isToy && !hasAdvancedTech) ? 10 : 40;
    
    const projectTech = (project.technologies || []).map(t => getCanonicalSkill(normalizeSkill(t)));
    let matchedTechCount = 0;
    projectTech.forEach(tech => {
      if (jdRequiredSkills.includes(tech)) {
        matchedTechCount += 1.0;
      } else {
        const ecoMatch = jdRequiredSkills.some(jdSkill => isEcosystemMatch(tech, jdSkill));
        if (ecoMatch) matchedTechCount += 0.5;
      }
    });
    
    if (jdRequiredSkills.length > 0) {
      projectScore += Math.min(30, (matchedTechCount / jdRequiredSkills.length) * 30);
    } else {
      projectScore += 15;
    }
    
    if (project.measurableImpact || (project.outcomes && project.outcomes.length > 0)) {
      projectScore += 15;
    }
    
    if (desc.includes('api') || desc.includes('database') || desc.includes('system') || desc.includes('deploy') || desc.includes('design')) {
      projectScore += 15;
    }
    
    totalScore += Math.min(100, projectScore);
  }
  
  return Math.round(totalScore / projects.length);
}

export function calculateAchievementScore(experience) {
  if (!experience || experience.length === 0) return 40;
  
  let totalScore = 0;
  let jobCount = 0;
  
  for (const job of experience) {
    const text = [...(job.responsibilities || []), ...(job.achievements || [])].join(' ');
    if (!text.trim()) continue;
    
    jobCount++;
    let jobAchievementScore = 50;
    
    const quantifiedCount = countQuantifiedBullets(text);
    const actionVerbsCount = countActionVerbs(text);
    
    if (quantifiedCount >= 2) {
      jobAchievementScore = 100;
    } else if (quantifiedCount === 1) {
      jobAchievementScore = 80;
    } else if (actionVerbsCount >= 3) {
      jobAchievementScore = 70;
    } else if (actionVerbsCount >= 1) {
      jobAchievementScore = 60;
    } else {
      jobAchievementScore = 40;
    }
    
    totalScore += jobAchievementScore;
  }
  
  return jobCount > 0 ? Math.round(totalScore / jobCount) : 50;
}

export function calculateEducationScore(education, jdRequirements) {
  const reqEdu = jdRequirements?.requirements?.required?.education || [];
  if (reqEdu.length === 0) {
    return 100;
  }
  
  if (!education || education.length === 0) {
    return 50;
  }
  
  let bestMatch = 50;
  for (const edu of education) {
    const deg = (edu.degree || '').toLowerCase();
    
    for (const req of reqEdu) {
      const normReq = req.toLowerCase();
      if (normReq.includes('bachelor') || normReq.includes('b.s') || normReq.includes('btech') || normReq.includes('degree')) {
        if (deg.includes('bachelor') || deg.includes('b.s') || deg.includes('btech') || deg.includes('b.e') || deg.includes('bs') || deg.includes('master') || deg.includes('m.s') || deg.includes('phd')) {
          bestMatch = 100;
        }
      } else if (normReq.includes('master') || normReq.includes('m.s') || normReq.includes('mtech')) {
        if (deg.includes('master') || deg.includes('m.s') || deg.includes('mtech') || deg.includes('ms') || deg.includes('phd')) {
          bestMatch = 100;
        } else if (deg.includes('bachelor') || deg.includes('b.s') || deg.includes('btech') || deg.includes('b.e')) {
          bestMatch = 75;
        }
      }
    }
  }
  return bestMatch;
}

export function calculateStructureScore(structureInfo) {
  if (!structureInfo) return 50;
  
  let score = 30; // base score of 30
  if (structureInfo.hasExperienceSection) score += 15;
  if (structureInfo.hasSkillsSection) score += 15;
  if (structureInfo.hasEducationSection) score += 10;
  if (structureInfo.hasProjectsSection) score += 10;
  if (structureInfo.hasClearDates) score += 10;
  if (structureInfo.hasClearJobTitles) score += 10;
  
  return Math.min(100, score);
}

export function calculateParseabilityScore(parseabilityInfo) {
  if (!parseabilityInfo) return 100;
  
  let score = 100;
  if (!parseabilityInfo.hasSelectableText) score -= 40;
  if (!parseabilityInfo.hasReadableStructure) score -= 15;
  if (parseabilityInfo.hasTables) score -= 5;
  if (parseabilityInfo.hasColumns) score -= 5;
  if (parseabilityInfo.hasBrokenText) score -= 25;
  
  return Math.max(30, score);
}

export function calculateCriticalRequirements(resumeData, jdCriticalReqs, resumeSkillsWithEvidence) {
  const met = [];
  const missing = [];
  
  if (!jdCriticalReqs || jdCriticalReqs.length === 0) {
    return { met, missing };
  }
  
  const resumeSkills = resumeSkillsWithEvidence.map(s => s.normalized);
  const certs = (resumeData.certifications || []).map(c => c.toLowerCase());
  const eduDegrees = (resumeData.education || []).map(e => (e.degree || '').toLowerCase());
  
  for (const req of jdCriticalReqs) {
    const normReq = req.toLowerCase();
    const canonReq = getCanonicalSkill(normalizeSkill(req));
    let isMet = false;
    
    if (resumeSkills.includes(canonReq)) {
      isMet = true;
    } else if (certs.some(c => c.includes(normReq) || normReq.includes(c))) {
      isMet = true;
    } else if (normReq.includes('degree') || normReq.includes('bachelor') || normReq.includes('master')) {
      if (eduDegrees.some(d => d.includes('bachelor') || d.includes('master') || d.includes('bs') || d.includes('ms') || d.includes('degree'))) {
        isMet = true;
      }
    }
    
    if (isMet) {
      met.push(req);
    } else {
      missing.push(req);
    }
  }
  
  return { met, missing };
}

export function calculateFinalScore(components) {
  const score =
      components.skillMatch * CONFIG.WEIGHTS.skillMatch
    + components.experienceRelevance * CONFIG.WEIGHTS.experienceRelevance
    + components.projectsAchievements * CONFIG.WEIGHTS.projectsAchievements
    + components.structureCompleteness * CONFIG.WEIGHTS.structureCompleteness
    + components.formattingParseability * CONFIG.WEIGHTS.formattingParseability;
  
  return Math.round(score);
}

export function getMatchRating(overallScore) {
  if (overallScore >= CONFIG.THRESHOLDS.Excellent) return 'Excellent Match';
  if (overallScore >= CONFIG.THRESHOLDS.Strong) return 'Strong Match';
  if (overallScore >= CONFIG.THRESHOLDS.Moderate) return 'Moderate Match';
  if (overallScore >= CONFIG.THRESHOLDS.Weak) return 'Weak Match';
  return 'Poor Match';
}

function computeDifficultyReadiness(overallScore, difficulty) {
  let readiness = overallScore;
  if (difficulty === 'Hard') {
    readiness = Math.max(0, readiness - 15);
  } else if (difficulty === 'Easy') {
    readiness = Math.min(100, readiness + 10);
  }
  return Math.round(readiness);
}

function computeInterviewReadiness(overallScore) {
  if (overallScore >= CONFIG.THRESHOLDS.Strong) return 'High';
  if (overallScore >= CONFIG.THRESHOLDS.Moderate) return 'Moderate';
  return 'Low';
}

// =============================================================================
// MODE B — RESUME-ONLY DETERMINISTIC ATS READINESS ENGINE
// =============================================================================

export function calculateResumeOnlyStructureScore(structureInfo, isFresher) {
  if (!structureInfo) return 50;
  let score = 30; // base score
  if (structureInfo.hasSkillsSection) score += 15;
  if (structureInfo.hasEducationSection) score += 15;
  
  if (isFresher) {
    if (structureInfo.hasProjectsSection) score += 20;
    if (structureInfo.hasExperienceSection) score += 10;
    if (structureInfo.hasClearDates) score += 10;
  } else {
    if (structureInfo.hasExperienceSection) score += 20;
    if (structureInfo.hasProjectsSection) score += 10;
    if (structureInfo.hasClearDates) score += 10;
  }
  
  return Math.min(100, score);
}

export function calculateResumeOnlySkillsScore(skillsWithEvidence, parsedResume) {
  const totalSkills = [];
  if (parsedResume.skills) {
    Object.values(parsedResume.skills).forEach(list => {
      if (Array.isArray(list)) list.forEach(s => totalSkills.push(s));
    });
  }
  
  if (totalSkills.length === 0) return 30;
  
  const uniqueSkills = [...new Set(totalSkills.map(s => getCanonicalSkill(normalizeSkill(s))))];
  const verifiedSkills = skillsWithEvidence.filter(s => s.section === 'experience' || s.section === 'projects');
  const uniqueVerified = [...new Set(verifiedSkills.map(s => s.normalized))];
  
  let score = 50; // base for listing skills
  
  if (uniqueSkills.length > 0) {
    const credibilityRatio = uniqueVerified.length / uniqueSkills.length;
    score += credibilityRatio * 50;
  }
  
  // Keyword stuffing check: >15 skills listed but <3 verified
  if (uniqueSkills.length > 15 && uniqueVerified.length < 3) {
    score -= 25;
  }
  
  return Math.min(100, Math.max(30, Math.round(score)));
}

export function calculateResumeOnlyExperienceScore(experience, isFresher) {
  if (!experience || experience.length === 0) {
    return isFresher ? 80 : 30; // freshers not heavily penalized
  }
  
  let totalScore = 0;
  experience.forEach(job => {
    let jobScore = 50; // base
    if (job.estimatedYears && job.estimatedYears >= 1) jobScore += 15;
    
    const title = (job.jobTitle || '').toLowerCase();
    if (title.includes('engineer') || title.includes('developer') || title.includes('manager') || title.includes('analyst') || title.includes('specialist') || title.includes('intern')) {
      jobScore += 15;
    }
    
    const text = [...(job.responsibilities || []), ...(job.achievements || [])].join(' ');
    const actionCount = countActionVerbs(text);
    if (actionCount >= 2) jobScore += 20;
    else if (actionCount >= 1) jobScore += 10;
    
    totalScore += Math.min(100, jobScore);
  });
  
  return Math.round(totalScore / experience.length);
}

export function calculateResumeOnlyProjectScore(projects) {
  if (!projects || projects.length === 0) {
    return 40;
  }
  
  let totalScore = 0;
  const toyKeywords = ['calculator', 'simple', 'toy', 'tutorial', 'homework', 'practice', 'exercise'];
  
  for (const project of projects) {
    const desc = (project.description || '').toLowerCase();
    const title = (project.title || '').toLowerCase();
    
    const isToy = desc.length < 30 || toyKeywords.some(w => desc.includes(w) || title.includes(w));
    const hasAdvancedTech = desc.includes('redis') || desc.includes('kubernetes') || desc.includes('docker') || desc.includes('distributed') || desc.includes('kafka') || desc.includes('microservices') || desc.includes('scalable');
    
    let projectScore = (isToy && !hasAdvancedTech) ? 15 : 60;
    
    if (project.technologies && project.technologies.length > 2) {
      projectScore += 15;
    }
    if (project.measurableImpact || (project.outcomes && project.outcomes.length > 0)) {
      projectScore += 15;
    }
    
    const fullText = (title + ' ' + desc).toLowerCase();
    if (fullText.includes('database') || fullText.includes('auth') || fullText.includes('deploy') || fullText.includes('api') || fullText.includes('engine') || fullText.includes('system') || fullText.includes('microservice') || fullText.includes('redis') || fullText.includes('kubernetes') || fullText.includes('docker')) {
      projectScore += 10;
    }
    
    totalScore += Math.min(100, projectScore);
  }
  
  return Math.round(totalScore / projects.length);
}

export function calculateResumeOnlyEducationScore(education, certifications) {
  if ((!education || education.length === 0) && (!certifications || certifications.length === 0)) {
    return 40;
  }
  
  let score = 50; // base
  if (education && education.length > 0) {
    score += 30;
    const hasDetails = education.some(edu => edu.institution || edu.fieldOfStudy);
    if (hasDetails) score += 10;
  }
  if (certifications && certifications.length > 0) {
    score += 10;
  }
  return Math.min(100, score);
}

export function calculateResumeOnlyContactScore(resumeData) {
  let score = 30; // base
  if (resumeData.name) score += 20;
  
  const rawText = JSON.stringify(resumeData).toLowerCase();
  if (rawText.includes('@')) score += 15;
  if (rawText.includes('phone') || /\b\d{10}\b/.test(rawText) || resumeData.phone) score += 15;
  if (rawText.includes('linkedin')) score += 10;
  if (rawText.includes('github') || rawText.includes('portfolio')) score += 10;
  
  return Math.min(100, score);
}

export function getResumeOnlyMatchRating(score) {
  for (const [band, threshold] of Object.entries(CONFIG.RESUME_ONLY_THRESHOLDS)) {
    if (score >= threshold) return band;
  }
  return 'Significant ATS/readability/content issues';
}

export function computeResumeOnlyScores(resumeData, rawResumeText) {
  const candidateSeniority = detectCandidateSeniority(resumeData);
  const isFresher = candidateSeniority === 'Intern' || (resumeData.experience?.length === 0 && ((resumeData.projects?.length || 0) > 0 || (resumeData.education?.length || 0) > 0));
  
  // Calculate component scores (0 - 100)
  const parseabilityScore = calculateParseabilityScore(resumeData.parseabilityInfo);
  const structureScore = calculateResumeOnlyStructureScore(resumeData.structureInfo, isFresher);
  
  const resumeSkillsWithEvidence = gatherResumeSkillsWithEvidence(resumeData, rawResumeText);
  const skillsScore = calculateResumeOnlySkillsScore(resumeSkillsWithEvidence, resumeData);
  
  const experienceScore = calculateResumeOnlyExperienceScore(resumeData.experience, isFresher);
  const projectScore = calculateResumeOnlyProjectScore(resumeData.projects);
  const achievementsScore = calculateAchievementScore(resumeData.experience);
  const educationScore = calculateResumeOnlyEducationScore(resumeData.education, resumeData.certifications);
  const contactScore = calculateResumeOnlyContactScore(resumeData);
  
  // Final weighted sum
  const finalScore = Math.round(
      parseabilityScore * CONFIG.RESUME_ONLY_WEIGHTS.parseability
    + structureScore * CONFIG.RESUME_ONLY_WEIGHTS.structure
    + skillsScore * CONFIG.RESUME_ONLY_WEIGHTS.skills
    + experienceScore * CONFIG.RESUME_ONLY_WEIGHTS.experience
    + projectScore * CONFIG.RESUME_ONLY_WEIGHTS.projects
    + achievementsScore * CONFIG.RESUME_ONLY_WEIGHTS.achievements
    + educationScore * CONFIG.RESUME_ONLY_WEIGHTS.education
    + contactScore * CONFIG.RESUME_ONLY_WEIGHTS.contact
  );
  
  const rating = getResumeOnlyMatchRating(finalScore);
  const formattedEvidence = resumeSkillsWithEvidence.map(s => ({
    skill: s.name,
    evidence: s.evidence,
    section: s.section,
    confidence: s.confidence
  }));
  
  const uniqueSkills = [...new Set((resumeData.skills ? Object.values(resumeData.skills).flat() : []).map(s => getCanonicalSkill(normalizeSkill(s))))];
  const verifiedSkills = resumeSkillsWithEvidence.filter(s => s.section === 'experience' || s.section === 'projects');
  const uniqueVerified = [...new Set(verifiedSkills.map(s => s.normalized))];
  
  const sectionsPresent = [];
  if (resumeData.structureInfo?.hasExperienceSection) sectionsPresent.push('experience');
  if (resumeData.structureInfo?.hasSkillsSection) sectionsPresent.push('skills');
  if (resumeData.structureInfo?.hasEducationSection) sectionsPresent.push('education');
  if (resumeData.structureInfo?.hasProjectsSection) sectionsPresent.push('projects');

  const audit = {
    parseability: {
      selectableText: !!resumeData.parseabilityInfo?.hasSelectableText,
      readableStructure: !!resumeData.parseabilityInfo?.hasReadableStructure,
      tablesDetected: !!resumeData.parseabilityInfo?.hasTables,
      columnsDetected: !!resumeData.parseabilityInfo?.hasColumns,
      brokenTextDetected: !!resumeData.parseabilityInfo?.hasBrokenText
    },
    structure: {
      sectionsPresent,
      isFresherMode: isFresher
    },
    skills: {
      totalSkillsListed: uniqueSkills.length,
      evidenceBackedSkills: uniqueVerified.length,
      credibilityRatio: uniqueSkills.length > 0 ? Number((uniqueVerified.length / uniqueSkills.length).toFixed(2)) : 0.0,
      keywordStuffingDetected: uniqueSkills.length > 15 && uniqueVerified.length < 3
    },
    experience: {
      totalJobs: resumeData.experience?.length || 0,
      totalDurationYears: resumeData.experience?.reduce((sum, j) => sum + (j.estimatedYears || 0), 0) || 0,
      isFresher
    },
    projects: {
      evaluated: resumeData.projects?.length || 0,
      toyProjects: resumeData.projects?.filter(p => {
        const desc = (p.description || '').toLowerCase();
        const title = (p.title || '').toLowerCase();
        const toyKeywords = ['calculator', 'simple', 'toy', 'tutorial', 'homework', 'practice', 'exercise'];
        return desc.length < 30 || toyKeywords.some(w => desc.includes(w) || title.includes(w));
      }).length || 0
    },
    achievements: {
      totalJobsChecked: resumeData.experience?.length || 0,
      quantifiedBulletCount: resumeData.experience?.reduce((sum, j) => sum + countQuantifiedBullets([...(j.responsibilities || []), ...(j.achievements || [])].join(' ')), 0) || 0,
      actionVerbCount: resumeData.experience?.reduce((sum, j) => sum + countActionVerbs([...(j.responsibilities || []), ...(j.achievements || [])].join(' ')), 0) || 0
    },
    contact: {
      hasName: !!resumeData.name,
      hasEmail: JSON.stringify(resumeData).toLowerCase().includes('@'),
      hasPhone: JSON.stringify(resumeData).toLowerCase().includes('phone') || /\b\d{10}\b/.test(JSON.stringify(resumeData)) || !!resumeData.phone,
      hasLinkedIn: JSON.stringify(resumeData).toLowerCase().includes('linkedin'),
      hasGitHub: JSON.stringify(resumeData).toLowerCase().includes('github') || JSON.stringify(resumeData).toLowerCase().includes('portfolio')
    }
  };

  return {
    mode: 'resume_only',
    score: finalScore,
    overallScore: finalScore,
    atsScore: finalScore,
    scoreType: 'Resume ATS Readiness',
    hasJobDescription: false,
    rating,
    audit,
    
    breakdown: {
      parseability: parseabilityScore,
      structure: structureScore,
      skills: skillsScore,
      experience: experienceScore,
      projects: projectScore,
      achievements: achievementsScore,
      education: educationScore,
      contact: contactScore
    },
    
    // Scale section scores to 0-10 for frontend UI SectionBar progress rendering
    sectionScores: {
      parseability: Math.round(parseabilityScore / 10),
      structure: Math.round(structureScore / 10),
      skills: Math.round(skillsScore / 10),
      experience: Math.round(experienceScore / 10),
      projects: Math.round(projectScore / 10),
      achievements: Math.round(achievementsScore / 10),
      education: Math.round(educationScore / 10),
      contact: Math.round(contactScore / 10)
    },
    
    evidence: formattedEvidence
  };
}

// ── Main Controller Adaptor ──────────────────────────────────────────────────

export function computeAtsScores(resumeData, jdData, rawResumeText, difficulty = 'Medium') {
  // Mode Selection logic based on Job Description presence
  const hasJd = jdData && jdData.requirements && 
                jdData.requirements.required && 
                (jdData.requirements.required.skills?.length > 0 || 
                 jdData.requirements.required.responsibilities?.length > 0 || 
                 (jdData.jobTitle && jdData.jobTitle.trim() && jdData.jobTitle.trim() !== 'Standard'));
  
  if (!hasJd) {
    return computeResumeOnlyScores(resumeData, rawResumeText);
  }
  
  // Existing Mode A scoring logic
  const candidateSeniority = detectCandidateSeniority(resumeData);
  const structureScore = calculateStructureScore(resumeData.structureInfo);
  const parseabilityScore = calculateParseabilityScore(resumeData.parseabilityInfo);
  
  const resumeSkillsWithEvidence = gatherResumeSkillsWithEvidence(resumeData, rawResumeText);
  
  const jdRequiredSkills = jdData.requirements?.required?.skills || [];
  const jdPreferredSkills = jdData.requirements?.preferred?.skills || [];
  
  const matchedRequired = [];
  const missingRequired = [];
  const matchedPreferred = [];
  const missingPreferred = [];
  
  const explanations = [];
  
  jdRequiredSkills.forEach(jdSkill => {
    let bestLevel = 4;
    let matchingResumeSkill = null;
    
    for (const resSkill of resumeSkillsWithEvidence) {
      const level = matchSkill(resSkill.name, jdSkill);
      if (level < bestLevel) {
        bestLevel = level;
        matchingResumeSkill = resSkill;
      }
    }
    
    if (bestLevel < 4 && matchingResumeSkill) {
      const confidence = matchingResumeSkill.confidence;
      matchedRequired.push({
        name: jdSkill,
        level: bestLevel,
        confidence,
        evidence: matchingResumeSkill.evidence,
        section: matchingResumeSkill.section
      });
      explanations.push({
        factor: 'skillMatch',
        skill: jdSkill,
        result: 'matched_required',
        impact: bestLevel === 3 ? 5 : 10,
        evidence: matchingResumeSkill.evidence
      });
    } else {
      missingRequired.push(jdSkill);
      explanations.push({
        factor: 'skillMatch',
        skill: jdSkill,
        result: 'missing_required',
        impact: -10,
        evidence: null
      });
    }
  });
  
  jdPreferredSkills.forEach(jdSkill => {
    let bestLevel = 4;
    let matchingResumeSkill = null;
    
    for (const resSkill of resumeSkillsWithEvidence) {
      const level = matchSkill(resSkill.name, jdSkill);
      if (level < bestLevel) {
        bestLevel = level;
        matchingResumeSkill = resSkill;
      }
    }
    
    if (bestLevel < 4 && matchingResumeSkill) {
      matchedPreferred.push({
        name: jdSkill,
        level: bestLevel,
        confidence: matchingResumeSkill.confidence,
        evidence: matchingResumeSkill.evidence,
        section: matchingResumeSkill.section
      });
      explanations.push({
        factor: 'skillMatch',
        skill: jdSkill,
        result: 'matched_preferred',
        impact: bestLevel === 3 ? 2 : 4,
        evidence: matchingResumeSkill.evidence
      });
    } else {
      missingPreferred.push(jdSkill);
      explanations.push({
        factor: 'skillMatch',
        skill: jdSkill,
        result: 'missing_preferred',
        impact: -3,
        evidence: null
      });
    }
  });
  
  // Calculate component scores
  const skillScore = calculateSkillScore(matchedRequired, missingRequired, matchedPreferred, missingPreferred);
  
  const projectsCount = resumeData.projects?.length || 0;
  const experienceScore = calculateExperienceScore(resumeData.experience, jdData, jdData.seniority, projectsCount, candidateSeniority);
  
  const projectScore = calculateProjectScore(resumeData.projects, jdData);
  const achievementScore = calculateAchievementScore(resumeData.experience);
  
  const projectsAchievementsScore = Math.min(100, Math.round(projectScore * 0.60 + achievementScore * 0.40));
  
  const educationScore = calculateEducationScore(resumeData.education, jdData);
  
  const structureCompletenessScore = Math.min(100, Math.round(structureScore * 0.70 + educationScore * 0.30));
  
  const formattingParseabilityScore = parseabilityScore;
  
  const overallScore = calculateFinalScore({
    skillMatch: skillScore,
    experienceRelevance: experienceScore,
    projectsAchievements: projectsAchievementsScore,
    structureCompleteness: structureCompletenessScore,
    formattingParseability: formattingParseabilityScore
  });
  
  const rating = getMatchRating(overallScore);
  const difficultyReadiness = computeDifficultyReadiness(overallScore, difficulty);
  const interviewReadiness = computeInterviewReadiness(overallScore);
  
  const critical = calculateCriticalRequirements(resumeData, jdData.criticalRequirements || [], resumeSkillsWithEvidence);
  
  const evidenceBlock = resumeSkillsWithEvidence.map(s => ({
    skill: s.name,
    evidence: s.evidence,
    section: s.section,
    confidence: s.confidence
  }));
  
  const uniqueSkills = [...new Set((resumeData.skills ? Object.values(resumeData.skills).flat() : []).map(s => getCanonicalSkill(normalizeSkill(s))))];
  const verifiedSkills = resumeSkillsWithEvidence.filter(s => s.section === 'experience' || s.section === 'projects');
  const uniqueVerified = [...new Set(verifiedSkills.map(s => s.normalized))];
  
  const expected = CONFIG.EXP_YEARS_EXPECTED[jdData.seniority] || CONFIG.EXP_YEARS_EXPECTED['Mid-Level'];
  const requiredYears = jdData.experienceYearsRequired !== undefined && jdData.experienceYearsRequired !== null
    ? jdData.experienceYearsRequired
    : expected.min;
  const candidateYears = resumeData.experience?.reduce((sum, j) => sum + (j.estimatedYears || 0), 0) || 0;
  
  const jdRank = SENIORITY_RANKS[jdData.seniority] || 4;
  const candRank = SENIORITY_RANKS[candidateSeniority] || 4;
  const rankGap = jdRank - candRank;
  
  let relevanceMultiplier = 1.0;
  if (jdRequiredSkills.length > 0 && resumeData.experience && resumeData.experience.length > 0) {
    let relevantJobs = 0;
    resumeData.experience.forEach(job => {
      if (isJobRelevantToJdSkills(job, jdRequiredSkills)) relevantJobs++;
    });
    relevanceMultiplier = 0.3 + 0.7 * (relevantJobs / resumeData.experience.length);
  }

  const audit = {
    skills: {
      requiredMatched: matchedRequired.length,
      requiredTotal: jdRequiredSkills.length,
      preferredMatched: matchedPreferred.length,
      preferredTotal: jdPreferredSkills.length,
      unsupportedListedSkills: uniqueSkills.length - uniqueVerified.length,
      evidenceBackedSkills: uniqueVerified.length
    },
    experience: {
      candidateYears,
      requiredYears,
      relevanceMultiplier: Number(relevanceMultiplier.toFixed(2)),
      seniorityMismatchPenalty: rankGap > 1 ? rankGap * 15 : 0
    },
    projects: {
      evaluated: resumeData.projects?.length || 0,
      toyProjects: resumeData.projects?.filter(p => {
        const desc = (p.description || '').toLowerCase();
        const title = (p.title || '').toLowerCase();
        const toyKeywords = ['calculator', 'simple', 'toy', 'tutorial', 'homework', 'practice', 'exercise'];
        return desc.length < 30 || toyKeywords.some(w => desc.includes(w) || title.includes(w));
      }).length || 0
    },
    achievements: {
      totalJobsChecked: resumeData.experience?.length || 0,
      quantifiedBulletCount: resumeData.experience?.reduce((sum, j) => sum + countQuantifiedBullets([...(j.responsibilities || []), ...(j.achievements || [])].join(' ')), 0) || 0,
      actionVerbCount: resumeData.experience?.reduce((sum, j) => sum + countActionVerbs([...(j.responsibilities || []), ...(j.achievements || [])].join(' ')), 0) || 0
    }
  };

  return {
    mode: 'job_match',
    score: overallScore,
    overallScore,
    atsScore: overallScore,
    scoreType: 'Job Match Score',
    hasJobDescription: true,
    rating,
    jobTitle: jdData.jobTitle || '',
    candidateLevel: resumeData.headline || '',
    difficultyReadiness,
    interviewReadiness,
    audit,
    
    breakdown: {
      skillMatch: Math.round(skillScore),
      experienceRelevance: Math.round(experienceScore),
      projectsAchievements: Math.round(projectsAchievementsScore),
      structureCompleteness: Math.round(structureCompletenessScore),
      formattingParseability: Math.round(formattingParseabilityScore)
    },
    
    sectionScores: {
      summary: resumeData.structureInfo?.hasExperienceSection ? 9 : 4,
      skills: resumeData.structureInfo?.hasSkillsSection ? 9 : 4,
      experience: Math.round(experienceScore / 10),
      education: Math.round(educationScore / 10),
      projects: Math.round(projectScore / 10),
      formatting: Math.round(parseabilityScore / 10)
    },
    
    requirements: {
      required: jdRequiredSkills,
      preferred: jdPreferredSkills,
      optional: jdData.requirements?.optional?.skills || []
    },
    
    skills: {
      matchedRequired: matchedRequired.map(s => s.name),
      missingRequired,
      matchedPreferred: matchedPreferred.map(s => s.name),
      missingPreferred,
      semanticMatches: matchedRequired.filter(s => s.level === 3).map(s => s.name)
    },
    
    experience: {
      requiredYears: jdData.experienceYearsRequired || null,
      estimatedRelevantYears: resumeData.experience?.reduce((sum, j) => sum + (j.estimatedYears || 0), 0) || null,
      relevanceScore: Math.round(experienceScore)
    },
    
    projects: resumeData.projects || [],
    
    criticalRequirements: {
      met: critical.met,
      missing: critical.missing
    },
    
    explanations,
    evidence: evidenceBlock
  };
}
