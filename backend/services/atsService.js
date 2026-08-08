/**
 * Deterministic ATS scoring engine.
 * Numeric scores are computed from resume/JD analysis — not guessed by AI.
 */

// ── Skill & keyword dictionaries ─────────────────────────────────────────────
const TECH_SKILLS = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'golang', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala',
  'react', 'react.js', 'next.js', 'nextjs', 'vue', 'vue.js', 'angular', 'svelte', 'html', 'css', 'tailwind', 'sass', 'webpack', 'vite',
  'node.js', 'nodejs', 'express', 'nestjs', 'django', 'flask', 'fastapi', 'spring', 'spring boot', '.net', 'laravel',
  'sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'dynamodb', 'firebase', 'supabase', 'sqlite', 'oracle',
  'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins', 'ci/cd', 'github actions',
  'git', 'linux', 'bash', 'shell', 'rest', 'restful', 'graphql', 'grpc', 'microservices', 'api',
  'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'scikit-learn', 'pandas', 'numpy', 'nlp', 'computer vision',
  'data analysis', 'data science', 'tableau', 'power bi', 'excel', 'spark', 'hadoop', 'kafka', 'airflow', 'dbt', 'etl',
  'agile', 'scrum', 'jira', 'figma', 'sketch', 'ux', 'ui', 'seo', 'sem', 'google analytics',
  'salesforce', 'hubspot', 'crm', 'b2b', 'b2c', 'saas',
  'leadership', 'management', 'communication', 'problem solving', 'teamwork',
  'system design', 'architecture', 'devops', 'security', 'oauth', 'jwt', 'authentication',
  'testing', 'jest', 'cypress', 'selenium', 'tdd', 'unit testing',
  'blockchain', 'solidity', 'web3',
];

const ROLE_KEYWORDS = {
  'Software Engineer': ['programming', 'software', 'algorithms', 'data structures', 'git', 'agile', 'testing', 'debugging'],
  'Frontend Developer': ['react', 'javascript', 'typescript', 'html', 'css', 'responsive', 'ui', 'webpack', 'accessibility'],
  'Backend Developer': ['api', 'database', 'sql', 'node.js', 'python', 'java', 'microservices', 'rest', 'authentication'],
  'Full Stack Developer': ['react', 'node.js', 'javascript', 'sql', 'mongodb', 'api', 'full stack', 'rest', 'git'],
  'DevOps Engineer': ['docker', 'kubernetes', 'ci/cd', 'aws', 'terraform', 'linux', 'jenkins', 'monitoring', 'ansible'],
  'Machine Learning Engineer': ['python', 'machine learning', 'tensorflow', 'pytorch', 'nlp', 'deep learning', 'pandas', 'model'],
  'Data Scientist': ['python', 'sql', 'machine learning', 'statistics', 'pandas', 'data analysis', 'visualization', 'modeling'],
  'Product Manager': ['roadmap', 'stakeholder', 'agile', 'user research', 'metrics', 'prioritization', 'strategy', 'launch'],
  'Product Designer': ['figma', 'ux', 'ui', 'wireframe', 'prototype', 'user research', 'design system', 'accessibility'],
  'Marketing Manager': ['campaign', 'seo', 'content', 'analytics', 'brand', 'social media', 'conversion', 'strategy'],
  'Sales Executive': ['sales', 'pipeline', 'crm', 'negotiation', 'quota', 'b2b', 'prospecting', 'closing'],
  'Financial Analyst': ['financial', 'excel', 'modeling', 'forecasting', 'budget', 'analysis', 'reporting', 'accounting'],
  'HR Professional': ['recruitment', 'onboarding', 'hr', 'employee', 'compliance', 'talent', 'performance', 'policy'],
  'Operations Manager': ['operations', 'process', 'efficiency', 'supply chain', 'kpi', 'management', 'optimization'],
  'Consultant': ['client', 'strategy', 'analysis', 'presentation', 'stakeholder', 'recommendations', 'problem solving'],
};

const EXP_YEARS_EXPECTED = {
  Intern: { min: 0, max: 1 },
  Junior: { min: 0, max: 2 },
  'Mid-Level': { min: 2, max: 5 },
  Senior: { min: 5, max: 12 },
  Lead: { min: 7, max: 20 },
};

const DIFFICULTY_THRESHOLDS = {
  Easy: 45,
  Medium: 60,
  Hard: 75,
  Adaptive: 55,
};

const STOP_KEYWORDS = new Set([
  'required', 'must', 'have', 'years', 'year', 'experience', 'the', 'and', 'or', 'with',
  'ability', 'strong', 'including', 'preferred', 'plus', 'minimum', 'qualifications',
  'responsibilities', 'requirements', 'skills', 'knowledge', 'working', 'using', 'apis',
  'required:', 'degree', 'bachelor', 'master', 'related', 'field', 'etc', 'such', 'as',
  'our', 'you', 'will', 'team', 'role', 'position', 'company', 'work', 'environment',
]);

function isValidKeyword(k) {
  const n = normalize(k);
  if (n.length < 2 || n.length > 35) return false;
  if (STOP_KEYWORDS.has(n)) return false;
  if (/^\d+\+?$/.test(n)) return false;
  return true;
}

const JD_REQUIREMENT_PATTERNS = [
  /(?:required|must have|must possess|minimum|qualifications?)[:\s-]+([^\n.]{10,200})/gi,
  /(?:experience with|proficiency in|knowledge of|familiarity with)\s+([^,\n.]{2,40})/gi,
  /(?:skills?)[:\s-]+([^\n.]{10,300})/gi,
];

// ── Text utilities ───────────────────────────────────────────────────────────
function normalize(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function skillInText(skill, text) {
  const pattern = escapeRegex(skill.toLowerCase()).replace(/\\\.\\./g, '\\.').replace(/\\\.js/g, '\\.?js?');
  return new RegExp(`(?:^|[\\s,;/|(])${pattern}(?:[\\s,;/|).]|$)`, 'i').test(text);
}

function extractSkills(text) {
  const normalized = normalize(text);
  const found = new Set();

  for (const skill of TECH_SKILLS) {
    if (skillInText(skill, normalized)) found.add(formatSkillLabel(skill));
  }

  // Acronyms & versioned tools (e.g. ES6, REST API)
  const acronyms = normalized.match(/\b(?:api|rest|sql|nosql|ci\/cd|aws|gcp|ml|ai|nlp|ux|ui|kpi|roi|crm|erp|saas|paas|iaas)\b/gi) || [];
  acronyms.forEach(a => found.add(a.toUpperCase()));

  return [...found];
}

function formatSkillLabel(skill) {
  const map = {
    'node.js': 'Node.js', nodejs: 'Node.js', react: 'React', 'react.js': 'React',
    javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
    postgresql: 'PostgreSQL', postgres: 'PostgreSQL', mongodb: 'MongoDB',
    'ci/cd': 'CI/CD', kubernetes: 'Kubernetes', k8s: 'Kubernetes',
  };
  return map[skill] || skill.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function extractJdTargetKeywords(jobDescription, jobRole) {
  if (!jobDescription?.trim()) {
    const roleKeys = ROLE_KEYWORDS[jobRole] || ROLE_KEYWORDS['Software Engineer'];
    return [...new Set([...roleKeys, ...extractSkills(jobRole)])];
  }

  const keywords = new Set(extractSkills(jobDescription));

  for (const pattern of JD_REQUIREMENT_PATTERNS) {
    let match;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(jobDescription)) !== null) {
      const chunk = match[1];
      extractSkills(chunk).forEach(k => keywords.add(k));
      chunk.split(/[,;|•·]/).forEach(part => {
        const trimmed = part.trim();
        if (isValidKeyword(trimmed)) keywords.add(trimmed);
      });
    }
  }

  // Important capitalized / quoted terms from JD
  const jdWords = jobDescription.match(/\b[A-Z][a-zA-Z+#.]{1,25}\b/g) || [];
  jdWords.slice(0, 30).forEach(w => {
    if (isValidKeyword(w) && !['The', 'And', 'You', 'We', 'Our', 'Will', 'Must'].includes(w)) {
      keywords.add(w);
    }
  });

  return [...keywords].filter(isValidKeyword).slice(0, 40);
}

function keywordMatchScore(resumeSkills, targetKeywords) {
  if (targetKeywords.length === 0) {
    return { score: 55, matched: resumeSkills.slice(0, 10), missing: [] };
  }

  const resumeNorm = resumeSkills.map(s => normalize(s));
  const matched = [];
  const missing = [];

  for (const target of targetKeywords) {
    const tNorm = normalize(target);
    const hit = resumeNorm.some(r =>
      r === tNorm || r.includes(tNorm) || tNorm.includes(r) ||
      (tNorm.length >= 4 && r.length >= 4 && (r.startsWith(tNorm) || tNorm.startsWith(r)))
    );
    if (hit) matched.push(formatSkillLabel(tNorm));
    else missing.push(formatSkillLabel(tNorm));
  }

  const uniqueMatched = [...new Set(matched)];
  const uniqueMissing = [...new Set(missing)].slice(0, 8);
  const score = Math.round((uniqueMatched.length / targetKeywords.length) * 100);

  return {
    score: Math.min(100, Math.max(0, score)),
    matched: uniqueMatched.slice(0, 10),
    missing: uniqueMissing,
  };
}

// ── Section detection & scoring ──────────────────────────────────────────────
function detectSections(text) {
  const lower = text.toLowerCase();
  return {
    hasSummary: /\b(summary|objective|profile|about me|professional summary)\b/.test(lower),
    hasSkills: /\b(skills|technical skills|technologies|competencies|tech stack)\b/.test(lower),
    hasExperience: /\b(experience|employment|work history|professional experience|work experience)\b/.test(lower),
    hasEducation: /\b(education|academic|degree|university|college|b\.?s\.?|m\.?s\.?|bachelor|master)\b/.test(lower),
    hasProjects: /\b(projects|portfolio|personal projects|side projects)\b/.test(lower),
  };
}

function getSection(text, headerPattern) {
  const re = new RegExp(`(${headerPattern})[\\s:]*\\n([\\s\\S]{0,1500})`, 'i');
  const m = text.match(re);
  return m ? m[2] : '';
}

function countQuantifiedBullets(text) {
  const patterns = [
    /\d+\s*%/g,
    /\$\d+/g,
    /\d+\+?\s*(users|customers|clients|requests|transactions|projects|team members|engineers)/gi,
    /(?:increased|decreased|reduced|improved|grew|saved|boosted|lowered|achieved|delivered)[^.]{0,40}\d+/gi,
    /\d+x\b/gi,
  ];
  let count = 0;
  for (const p of patterns) {
    const m = text.match(p);
    if (m) count += m.length;
  }
  return count;
}

function estimateYearsOfExperience(text) {
  const patterns = [
    /(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)/gi,
    /experience[:\s]+(\d+)\+?\s*(?:years?|yrs?)/gi,
  ];
  let maxYears = 0;
  for (const p of patterns) {
    let m;
    while ((m = p.exec(text)) !== null) {
      maxYears = Math.max(maxYears, parseInt(m[1], 10));
    }
  }
  // Count date ranges like 2020 – 2024
  const ranges = text.match(/(20\d{2}|19\d{2})\s*[-–—to]+\s*(20\d{2}|19\d{2}|present|current)/gi) || [];
  if (ranges.length > 0 && maxYears === 0) {
    maxYears = Math.min(ranges.length * 2, 15);
  }
  return maxYears;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function scoreSummary(text, sections) {
  if (!sections.hasSummary) return 3;
  const summary = getSection(text, 'summary|objective|profile|about');
  const len = summary.trim().length;
  if (len < 50) return 4;
  if (len < 120) return 6;
  if (len >= 120 && len <= 600) return 8;
  return 7;
}

function scoreSkillsSection(text, sections, resumeSkills) {
  if (!sections.hasSkills && resumeSkills.length < 3) return 3;
  const count = resumeSkills.length;
  if (count >= 10) return 9;
  if (count >= 6) return 7;
  if (count >= 3) return 6;
  return 4;
}

function scoreExperience(text, sections) {
  if (!sections.hasExperience) return 2;
  const exp = getSection(text, 'experience|employment|work history|professional experience');
  const metrics = countQuantifiedBullets(exp || text);
  const len = (exp || text).length;
  let score = 5;
  if (len > 300) score += 1;
  if (len > 800) score += 1;
  if (metrics >= 2) score += 2;
  if (metrics >= 5) score += 1;
  return clamp(score, 1, 10);
}

function scoreEducation(text, sections) {
  if (!sections.hasEducation) return 4;
  const edu = getSection(text, 'education|academic');
  const hasDegree = /\b(b\.?s\.?|b\.?a\.?|m\.?s\.?|m\.?b\.?a\.?|ph\.?d|bachelor|master|diploma|degree)\b/i.test(edu || text);
  return hasDegree ? 8 : 6;
}

function scoreProjects(text, sections) {
  if (!sections.hasProjects) return 5;
  const proj = getSection(text, 'projects|portfolio');
  const len = (proj || '').length;
  if (len > 200) return 8;
  if (len > 80) return 6;
  return 5;
}

function scoreFormatting(text) {
  let score = 5;
  const wordCount = text.split(/\s+/).length;
  if (wordCount >= 150 && wordCount <= 1200) score += 2;
  else if (wordCount < 80) score -= 2;
  else if (wordCount > 2000) score -= 1;

  const bullets = (text.match(/[•·▪\-–—]\s|\n\s*[-*]\s/g) || []).length;
  if (bullets >= 4) score += 2;
  if (bullets >= 10) score += 1;

  if (/\n{4,}/.test(text)) score -= 1;
  return clamp(score, 1, 10);
}

function scoreExperienceLevelFit(years, experienceLevel) {
  const expected = EXP_YEARS_EXPECTED[experienceLevel] || EXP_YEARS_EXPECTED['Mid-Level'];
  if (years === 0) return 55;
  if (years >= expected.min && years <= expected.max + 2) return 95;
  if (years < expected.min) return clamp(95 - (expected.min - years) * 15, 30, 90);
  return clamp(90 - (years - expected.max - 2) * 8, 40, 90);
}

function avgSectionScore(sectionScores) {
  const vals = Object.values(sectionScores);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function computeInterviewReadiness(atsScore, sectionAvg, keywordScore) {
  const composite = atsScore * 0.5 + (sectionAvg / 10) * 100 * 0.3 + keywordScore * 0.2;
  if (composite >= 72) return 'High';
  if (composite >= 52) return 'Moderate';
  return 'Low';
}

function computeDifficultyReadiness(atsScore, difficulty, sectionAvg, metricsCount) {
  const threshold = DIFFICULTY_THRESHOLDS[difficulty] || 60;
  let readiness = atsScore;

  if (difficulty === 'Hard') {
    readiness -= metricsCount < 2 ? 15 : 0;
    readiness -= sectionAvg < 6 ? 10 : 0;
  } else if (difficulty === 'Easy') {
    readiness += 8;
  }

  const gap = readiness - threshold;
  if (gap >= 20) return clamp(readiness, 0, 100);
  if (gap >= 0) return clamp(readiness - 5, 0, 100);
  return clamp(readiness - 15 + gap, 0, 100);
}

function buildRuleBasedFeedback({ sectionScores, keywordMatch, missingKeywords, metricsCount, sections, jobRole, hasJd }) {
  const strengths = [];
  const weaknesses = [];
  const tips = [];

  if (keywordMatch.matched.length >= 5) {
    strengths.push(`Strong keyword alignment — ${keywordMatch.matched.length} relevant skills match ${hasJd ? 'the job description' : 'the target role'}.`);
  }
  if (sectionScores.experience >= 7) {
    strengths.push('Experience section shows good depth with actionable detail.');
  }
  if (metricsCount >= 3) {
    strengths.push('Resume includes quantified achievements, which ATS systems and recruiters prioritize.');
  }
  if (sectionScores.skills >= 7) {
    strengths.push('Skills section is well-populated with relevant technologies.');
  }

  if (keywordMatch.matched.length < 3) {
    weaknesses.push(`Low keyword overlap with ${hasJd ? 'job description' : jobRole} requirements — ATS may filter this resume early.`);
  }
  if (missingKeywords.length > 0) {
    weaknesses.push(`Missing key terms: ${missingKeywords.slice(0, 4).join(', ')}.`);
  }
  if (!sections.hasSummary) {
    weaknesses.push('No professional summary detected — add a 2–3 line summary at the top.');
  }
  if (metricsCount < 2) {
    weaknesses.push('Few quantified results — add numbers (%, $, users, time saved) to bullet points.');
  }
  if (sectionScores.experience < 6) {
    weaknesses.push('Experience section needs more detail on impact, scope, and outcomes.');
  }

  const weaknessFillers = [
    'Consider tailoring the resume more closely to the target job posting.',
    'Review formatting consistency and ensure each bullet highlights measurable impact.',
    'Add a concise professional summary with role title and top 3 skills.',
  ];
  for (const f of weaknessFillers) {
    if (weaknesses.length >= 3) break;
    if (!weaknesses.includes(f)) weaknesses.push(f);
  }

  const strengthFillers = [
    'Resume contains relevant content that can be optimized further for ATS.',
    'Clear section structure provides a solid foundation for keyword optimization.',
    'Education and skills sections support the target role profile.',
  ];
  for (const f of strengthFillers) {
    if (strengths.length >= 3) break;
    if (!strengths.includes(f)) strengths.push(f);
  }

  if (!sections.hasSkills) tips.push('Add a dedicated Skills or Technologies section with role-specific keywords.');
  if (metricsCount < 2) tips.push('Use bullet points with metrics: "Reduced load time by 40%" or "Managed team of 5 engineers."');
  tips.push('Mirror exact phrases from the job description where honestly applicable — many ATS match literal keywords.');
  if (!sections.hasSummary) tips.push('Include a professional summary (3–4 lines) with role title and top skills.');

  const recommendation = hasJd
    ? `Your resume matches approximately ${keywordMatch.score}% of extracted JD keywords. Focus on adding missing terms (${missingKeywords.slice(0, 3).join(', ') || 'see gaps above'}) naturally in your experience bullets before applying.`
    : `For a ${jobRole} role, prioritize adding ${missingKeywords.slice(0, 3).join(', ') || 'role-specific skills'} and quantified achievements to improve ATS pass rates.`;

  return {
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    formattingTips: tips.slice(0, 3),
    recommendation,
  };
}

// ── Main export ──────────────────────────────────────────────────────────────
export function computeAtsScores(resumeText, jobRole, jobDescription = '', difficulty = 'Medium', experienceLevel = 'Mid-Level') {
  const text = resumeText || '';
  const hasJd = Boolean(jobDescription?.trim());
  const sections = detectSections(text);
  const resumeSkills = extractSkills(text);
  const targetKeywords = extractJdTargetKeywords(jobDescription, jobRole);
  const keywordMatch = keywordMatchScore(resumeSkills, targetKeywords);
  const metricsCount = countQuantifiedBullets(text);
  const years = estimateYearsOfExperience(text);

  const sectionScores = {
    summary: scoreSummary(text, sections),
    skills: scoreSkillsSection(text, sections, resumeSkills),
    experience: scoreExperience(text, sections),
    education: scoreEducation(text, sections),
    projects: scoreProjects(text, sections),
    formatting: scoreFormatting(text),
  };

  const sectionAvg = avgSectionScore(sectionScores);
  const sectionComponent = (sectionAvg / 10) * 100;
  const metricsComponent = clamp(metricsCount * 12, 0, 100);
  const expFitComponent = scoreExperienceLevelFit(years, experienceLevel);
  const formattingComponent = (sectionScores.formatting / 10) * 100;

  // Weighted composite — real formula, not AI guess
  let atsScore;
  if (hasJd) {
    atsScore = Math.round(
      keywordMatch.score * 0.45 +
      sectionComponent * 0.25 +
      metricsComponent * 0.12 +
      expFitComponent * 0.10 +
      formattingComponent * 0.08
    );
  } else {
    atsScore = Math.round(
      keywordMatch.score * 0.38 +
      sectionComponent * 0.28 +
      metricsComponent * 0.14 +
      expFitComponent * 0.12 +
      formattingComponent * 0.08
    );
  }

  atsScore = clamp(atsScore, 0, 100);

  const difficultyReadiness = Math.round(
    computeDifficultyReadiness(atsScore, difficulty, sectionAvg, metricsCount)
  );

  const interviewReadiness = computeInterviewReadiness(atsScore, sectionAvg, keywordMatch.score);

  const feedback = buildRuleBasedFeedback({
    sectionScores,
    keywordMatch,
    missingKeywords: keywordMatch.missing,
    metricsCount,
    sections,
    jobRole,
    hasJd,
  });

  return {
    atsScore,
    difficultyReadiness,
    sectionScores,
    keywordMatches: keywordMatch.matched,
    missingKeywords: keywordMatch.missing,
    interviewReadiness,
    ...feedback,
    scoreBreakdown: {
      keywordMatch: keywordMatch.score,
      sectionQuality: Math.round(sectionComponent),
      quantifiedAchievements: Math.round(metricsComponent),
      experienceLevelFit: Math.round(expFitComponent),
      formatting: Math.round(formattingComponent),
      estimatedYearsExperience: years,
      resumeSkillCount: resumeSkills.length,
      jdKeywordCount: targetKeywords.length,
      matchedKeywordCount: keywordMatch.matched.length,
      computedBy: 'deterministic',
    },
  };
}
