import assert from 'assert';
import { 
  normalizeSkill, 
  matchSkill, 
  classifyRequirement, 
  calculateSkillScore, 
  calculateExperienceScore, 
  calculateProjectScore, 
  calculateAchievementScore, 
  calculateEducationScore, 
  calculateStructureScore, 
  calculateParseabilityScore, 
  calculateCriticalRequirements, 
  calculateFinalScore,
  computeAtsScores 
} from './services/atsService.js';

// Central color console logging helpers
const logSection = (title) => console.log(`\n=== \x1b[1m\x1b[36m${title}\x1b[0m ===`);
const logPass = (name) => console.log(`\x1b[32m✔ PASS:\x1b[0m ${name}`);
const logFail = (name, err) => console.log(`\x1b[31m✘ FAIL:\x1b[0m ${name} - ${err.message}`);

logSection('RUNNING ATS SCORING ENGINE REGRESSION TESTS');

// =============================================================================
// SECTION 1: False-Positive Regression Checks
// =============================================================================
try {
  // 1. Java != JavaScript
  assert.strictEqual(matchSkill('Java', 'JavaScript'), 4);
  assert.strictEqual(matchSkill('JavaScript', 'Java'), 4);
  logPass('Java !== JavaScript');

  // 2. R != random words containing "r"
  assert.strictEqual(matchSkill('Docker', 'R'), 4);
  assert.strictEqual(matchSkill('Rails', 'R'), 4);
  assert.strictEqual(matchSkill('R', 'Docker'), 4);
  logPass('R !== random words containing "r"');

  // 3. React != React Native (Ecosystem Level 3 is okay, but not exact/alias)
  assert.strictEqual(matchSkill('React', 'React Native'), 4); // Candidate has React, JD requires React Native (No Match)
  assert.strictEqual(matchSkill('React Native', 'React'), 3); // Candidate has React Native, JD requires React (Level 3 Ecosystem Match)
  logPass('React !== React Native (Directional Ecosystem Match Only)');

  // 4. Node.js != NodeMCU
  assert.strictEqual(matchSkill('NodeMCU', 'Node.js'), 4);
  assert.strictEqual(matchSkill('Node.js', 'NodeMCU'), 4);
  logPass('Node.js !== NodeMCU');

  // 5. C != CSS
  assert.strictEqual(matchSkill('C', 'CSS'), 4);
  assert.strictEqual(matchSkill('CSS', 'C'), 4);
  logPass('C !== CSS');

  // 6. SQL != NoSQL
  assert.strictEqual(matchSkill('SQL', 'NoSQL'), 4);
  assert.strictEqual(matchSkill('NoSQL', 'SQL'), 4);
  logPass('SQL !== NoSQL');

  // 7. AWS != AWS Lambda (Ecosystem Level 3 match)
  assert.strictEqual(matchSkill('AWS Lambda', 'AWS'), 3); // Candidate has AWS Lambda, JD requires AWS (Level 3 Match)
  assert.strictEqual(matchSkill('AWS', 'AWS Lambda'), 4); // Candidate has AWS, JD requires AWS Lambda (No Match)
  logPass('AWS !== AWS Lambda (Directional Ecosystem Match Only)');

} catch (err) {
  logFail('False-Positive Regression Checks', err);
  process.exit(1);
}

// =============================================================================
// SECTION 2: 20 Benchmark Scenarios
// =============================================================================
const tests = [
  {
    id: 1,
    name: 'Excellent resume / excellent JD match',
    resume: {
      headline: 'Senior Full Stack Developer',
      skills: { languages: ['JavaScript', 'TypeScript'], frameworks: ['React', 'NodeJS'], databases: ['PostgreSQL'] },
      experience: [
        { jobTitle: 'Senior Software Engineer', employer: 'Google', estimatedYears: 6, responsibilities: ['Built React web app', 'Optimized NodeJS backend using PostgreSQL database.'] }
      ],
      projects: [
        { title: 'ChatApp', description: 'Real-time chat using React and NodeJS', technologies: ['React', 'NodeJS', 'PostgreSQL'], outcomes: ['Served 500+ active users'] }
      ],
      structureInfo: { hasExperienceSection: true, hasSkillsSection: true, hasEducationSection: true, hasProjectsSection: true, hasClearDates: true, hasClearJobTitles: true },
      parseabilityInfo: { hasSelectableText: true, hasReadableStructure: true, hasTables: false, hasColumns: false, hasBrokenText: false }
    },
    jd: {
      jobTitle: 'Senior Full Stack Developer',
      seniority: 'Senior',
      requirements: {
        required: { skills: ['React', 'Node.js', 'PostgreSQL'] },
        preferred: { skills: ['TypeScript'] }
      },
      experienceYearsRequired: 5
    },
    rawText: 'Senior Full Stack Developer. Skills: JavaScript, TypeScript, React, NodeJS, PostgreSQL. Experience: Senior Software Engineer at Google (6 years). Built React web app and optimized NodeJS backend using PostgreSQL database. Projects: ChatApp using React and NodeJS, served 500+ active users.',
    asserts: (res) => {
      assert.ok(res.overallScore >= 80, `Expected Excellent/Strong score, got ${res.overallScore}`);
      assert.strictEqual(res.rating, 'Excellent Match');
    }
  },
  {
    id: 2,
    name: 'Excellent resume / poor JD match',
    resume: {
      headline: 'Senior Frontend Developer',
      skills: { languages: ['JavaScript', 'HTML', 'CSS'], frameworks: ['React'] },
      experience: [{ jobTitle: 'Frontend Developer', employer: 'Meta', estimatedYears: 5, responsibilities: ['Built user interfaces with React and CSS'] }],
      projects: [{ title: 'Portfolio Website', description: 'Created portfolio with HTML/CSS', technologies: ['HTML', 'CSS'] }],
      structureInfo: { hasExperienceSection: true, hasSkillsSection: true, hasEducationSection: true, hasProjectsSection: true, hasClearDates: true, hasClearJobTitles: true },
      parseabilityInfo: { hasSelectableText: true, hasReadableStructure: true, hasTables: false, hasColumns: false }
    },
    jd: {
      jobTitle: 'Senior Machine Learning Engineer',
      seniority: 'Senior',
      requirements: {
        required: { skills: ['Python', 'TensorFlow', 'PyTorch'] }
      },
      experienceYearsRequired: 5
    },
    rawText: 'Senior Frontend Developer. Skills: JavaScript, HTML, CSS, React. Experience: Frontend Developer at Meta. Built user interfaces with React and CSS.',
    asserts: (res) => {
      assert.ok(res.overallScore < 50, `Expected low score for ML role, got ${res.overallScore}`);
      assert.strictEqual(res.rating, 'Poor Match');
    }
  },
  {
    id: 3,
    name: 'Fresher resume / entry-level JD',
    resume: {
      headline: 'Computer Science Graduate',
      skills: { languages: ['Python', 'SQL'] },
      experience: [{ jobTitle: 'Software Intern', employer: 'StartUp', estimatedYears: 1, responsibilities: ['Learned Python development'] }],
      projects: [{ title: 'Database Project', description: 'Designed relational SQL database', technologies: ['Python', 'SQL'], outcomes: ['Created functional prototype'] }],
      structureInfo: { hasExperienceSection: true, hasSkillsSection: true, hasEducationSection: true, hasProjectsSection: true, hasClearDates: true, hasClearJobTitles: true },
      parseabilityInfo: { hasSelectableText: true, hasReadableStructure: true }
    },
    jd: {
      jobTitle: 'Junior Developer',
      seniority: 'Entry-level',
      requirements: {
        required: { skills: ['Python', 'SQL'] }
      },
      experienceYearsRequired: 1
    },
    rawText: 'Computer Science Graduate. Skills: Python, SQL. Experience: Software Intern at StartUp (1 year). Learned Python development. Projects: Database Project, designed relational SQL database.',
    asserts: (res) => {
      assert.ok(res.overallScore >= 70, `Expected entry-level candidate to fit Junior JD, got ${res.overallScore}`);
    }
  },
  {
    id: 4,
    name: 'Fresher resume / senior JD',
    resume: {
      headline: 'CS Student',
      skills: { languages: ['Python'] },
      experience: [],
      projects: [{ title: 'Calculator', description: 'Simple python script', technologies: ['Python'] }],
      structureInfo: { hasExperienceSection: false, hasSkillsSection: true, hasEducationSection: true, hasProjectsSection: true },
      parseabilityInfo: { hasSelectableText: true }
    },
    jd: {
      jobTitle: 'Senior Backend Architect',
      seniority: 'Senior',
      requirements: {
        required: { skills: ['Python', 'Django', 'AWS'] }
      },
      experienceYearsRequired: 8
    },
    rawText: 'CS Student. Skills: Python. Projects: Calculator simple python script.',
    asserts: (res) => {
      console.log('Scenario 4 Breakdown:', res.breakdown, 'experience:', res.experience, 'skills:', res.skills);
      assert.ok(res.overallScore < 40, `Expected student to fail senior JD requirements, got ${res.overallScore}`);
      assert.strictEqual(res.rating, 'Poor Match');
    }
  },
  {
    id: 5,
    name: 'Strong resume missing one required skill',
    resume: {
      headline: 'Backend Developer',
      skills: { languages: ['JavaScript'], frameworks: ['NodeJS'] },
      experience: [{ jobTitle: 'Developer', employer: 'IBM', estimatedYears: 4, responsibilities: ['Wrote Node backend services'] }],
      projects: [{ title: 'API', description: 'Created node api', technologies: ['NodeJS'] }],
      structureInfo: { hasExperienceSection: true, hasSkillsSection: true, hasEducationSection: true, hasProjectsSection: true, hasClearDates: true, hasClearJobTitles: true }
    },
    jd: {
      jobTitle: 'Backend Dev',
      seniority: 'Mid-Level',
      requirements: {
        required: { skills: ['Node.js', 'Docker'] }
      },
      experienceYearsRequired: 3
    },
    rawText: 'Backend Developer. Skills: JavaScript, NodeJS. Experience: Developer at IBM (4 years). Wrote Node backend services.',
    asserts: (res) => {
      assert.ok(res.skills.missingRequired.includes('Docker'));
      assert.ok(res.overallScore < 85, `Missing a required skill should prevent Excellent score, got ${res.overallScore}`);
    }
  },
  {
    id: 6,
    name: 'Strong resume missing multiple preferred skills',
    resume: {
      headline: 'Full Stack Engineer',
      skills: { languages: ['JavaScript', 'Python'], frameworks: ['React'] },
      experience: [{ jobTitle: 'Full Stack Engineer', employer: 'Amazon', estimatedYears: 4, responsibilities: ['Coded frontend in React and backend scripts in Python'] }],
      projects: [{ title: 'App', description: 'Created full stack application', technologies: ['React', 'Python'] }],
      structureInfo: { hasExperienceSection: true, hasSkillsSection: true, hasEducationSection: true, hasProjectsSection: true }
    },
    jd: {
      jobTitle: 'Full Stack Engineer',
      seniority: 'Mid-Level',
      requirements: {
        required: { skills: ['React', 'Python'] },
        preferred: { skills: ['Docker', 'Kubernetes', 'CI/CD'] }
      },
      experienceYearsRequired: 3
    },
    rawText: 'Full Stack Engineer. Skills: JavaScript, Python, React. Experience: Full Stack Engineer at Amazon (4 years). Coded frontend in React.',
    asserts: (res) => {
      // Preferred skills are missing, but required skills are fully met. Score should still be strong/moderate.
      assert.ok(res.overallScore >= 60, `Missing preferred skills should not completely destroy score, got ${res.overallScore}`);
      assert.strictEqual(res.skills.missingPreferred.length, 3);
    }
  },
  {
    id: 7,
    name: 'Resume with synonyms',
    resume: {
      headline: 'JS Engineer',
      skills: { languages: ['JS'], frameworks: ['ReactJS'] },
      experience: [{ jobTitle: 'JS dev', employer: 'StartUp', estimatedYears: 3, responsibilities: ['Built UI using JS and ReactJS.'] }],
      projects: [{ title: 'App', description: 'Built ReactJS dashboard', technologies: ['ReactJS'] }],
      structureInfo: { hasExperienceSection: true, hasSkillsSection: true }
    },
    jd: {
      jobTitle: 'Frontend Engineer',
      seniority: 'Mid-Level',
      requirements: {
        required: { skills: ['JavaScript', 'React'] }
      },
      experienceYearsRequired: 2
    },
    rawText: 'JS Engineer. Skills: JS, ReactJS. Experience: JS dev at StartUp. Built UI using JS and ReactJS.',
    asserts: (res) => {
      console.log('Scenario 7 Breakdown:', res.breakdown);
      assert.strictEqual(res.skills.missingRequired.length, 0, 'Synonyms should successfully match required skills.');
      assert.ok(res.overallScore >= 75, `Expected strong score with synonyms matching, got ${res.overallScore}`);
    }
  },
  {
    id: 8,
    name: 'Resume with semantic/ecosystem matches',
    resume: {
      headline: 'Node Developer',
      skills: { frameworks: ['Express'] },
      experience: [{ jobTitle: 'Developer', employer: 'NodeShop', estimatedYears: 3, responsibilities: ['Wrote Express APIs.'] }],
      projects: [{ title: 'App', description: 'Created Express service', technologies: ['Express'] }],
      structureInfo: { hasExperienceSection: true, hasSkillsSection: true }
    },
    jd: {
      jobTitle: 'Backend Developer',
      seniority: 'Mid-Level',
      requirements: {
        required: { skills: ['Node.js'] }
      },
      experienceYearsRequired: 2
    },
    rawText: 'Node Developer. Skills: Express. Experience: Developer at NodeShop. Wrote Express APIs.',
    asserts: (res) => {
      // Node.js is required. Express is in Node.js ecosystem, so it is a Level 3 match.
      assert.strictEqual(res.skills.matchedRequired.length, 1);
      assert.ok(res.overallScore >= 60, `Ecosystem match should give a moderate score, got ${res.overallScore}`);
    }
  },
  {
    id: 9,
    name: 'Resume with no quantified achievements',
    resume: {
      headline: 'Backend Developer',
      skills: { languages: ['Python'] },
      experience: [{ jobTitle: 'Developer', employer: 'Acme', estimatedYears: 3, responsibilities: ['Responsible for python coding and writing backend databases.'] }],
      projects: [],
      structureInfo: { hasExperienceSection: true, hasSkillsSection: true }
    },
    jd: {
      jobTitle: 'Developer',
      seniority: 'Mid-Level',
      requirements: { required: { skills: ['Python'] } }
    },
    rawText: 'Backend Developer. Skills: Python. Experience: Developer at Acme. Responsible for python coding and writing backend databases.',
    asserts: (res) => {
      assert.ok(res.breakdown.projectsAchievements < 60, `Achievements should be low score without numbers/actions, got ${res.breakdown.projectsAchievements}`);
    }
  },
  {
    id: 10,
    name: 'Resume with many quantified achievements',
    resume: {
      headline: 'Backend Developer',
      skills: { languages: ['Python'] },
      experience: [{ jobTitle: 'Developer', employer: 'Acme', estimatedYears: 3, responsibilities: ['Optimized python script database reducing page load time by 35% and saving 10 hours a week.', 'Led 5 developers serving 1000+ daily active users.'] }],
      projects: [{ title: 'Database Optimization API', description: 'Optimized python script databases and REST APIs.', technologies: ['Python'], outcomes: ['Improved load times by 35%'] }],
      structureInfo: { hasExperienceSection: true, hasSkillsSection: true }
    },
    jd: {
      jobTitle: 'Developer',
      seniority: 'Mid-Level',
      requirements: { required: { skills: ['Python'] } }
    },
    rawText: 'Backend Developer. Skills: Python. Experience: Developer at Acme. Optimized python script database reducing page load time by 35% and saving 10 hours a week. Led 5 developers serving 1000+ daily active users.',
    asserts: (res) => {
      assert.ok(res.breakdown.projectsAchievements > 75, `Achievements should be high score with quantified metrics, got ${res.breakdown.projectsAchievements}`);
    }
  },
  {
    id: 11,
    name: 'Resume with unusual formatting',
    resume: {
      skills: { languages: ['Python'] },
      parseabilityInfo: { hasSelectableText: true, hasReadableStructure: false, hasBrokenText: true }
    },
    jd: {
      jobTitle: 'Developer',
      requirements: { required: { skills: ['Python'] } }
    },
    rawText: 'Dev... Py th on...',
    asserts: (res) => {
      assert.ok(res.breakdown.formattingParseability < 70, `Formatting score should be penalized for broken text, got ${res.breakdown.formattingParseability}`);
    }
  },
  {
    id: 12,
    name: 'Resume with tables',
    resume: {
      skills: { languages: ['Python'] },
      parseabilityInfo: { hasSelectableText: true, hasTables: true }
    },
    jd: {
      jobTitle: 'Developer',
      requirements: { required: { skills: ['Python'] } }
    },
    rawText: 'Skills: Python in table',
    asserts: (res) => {
      assert.ok(res.breakdown.formattingParseability < 100);
    }
  },
  {
    id: 13,
    name: 'Resume with two columns',
    resume: {
      skills: { languages: ['Python'] },
      parseabilityInfo: { hasSelectableText: true, hasColumns: true }
    },
    jd: {
      jobTitle: 'Developer',
      requirements: { required: { skills: ['Python'] } }
    },
    rawText: 'Two column layout. Skills: Python',
    asserts: (res) => {
      assert.ok(res.breakdown.formattingParseability < 100);
    }
  },
  {
    id: 14,
    name: 'Resume containing Java vs JavaScript',
    resume: {
      skills: { languages: ['Java'] },
      experience: [{ jobTitle: 'Developer', employer: 'Oracle', estimatedYears: 3, responsibilities: ['Wrote Java services.'] }]
    },
    jd: {
      jobTitle: 'JavaScript Dev',
      requirements: { required: { skills: ['JavaScript'] } }
    },
    rawText: 'Java Developer. Skills: Java. Experience: Developer at Oracle. Wrote Java services.',
    asserts: (res) => {
      assert.ok(res.skills.missingRequired.includes('JavaScript'));
      assert.strictEqual(res.skills.matchedRequired.length, 0);
    }
  },
  {
    id: 15,
    name: 'Resume containing React vs React Native',
    resume: {
      skills: { frameworks: ['React Native'] },
      experience: [{ jobTitle: 'Developer', employer: 'Meta', estimatedYears: 3, responsibilities: ['Wrote React Native code.'] }]
    },
    jd: {
      jobTitle: 'React Developer',
      requirements: { required: { skills: ['React'] } }
    },
    rawText: 'React Native Developer. Skills: React Native. Experience: Developer at Meta. Wrote React Native code.',
    asserts: (res) => {
      // React vs React Native should be Level 3 ecosystem match, not Level 1 or 2.
      assert.strictEqual(res.skills.matchedRequired.length, 1);
      assert.ok(res.skills.semanticMatches.includes('React'), 'React should be classed as ecosystem/semantic match.');
    }
  },
  {
    id: 16,
    name: 'Resume with duplicate skills',
    resume: {
      skills: { frameworks: ['React', 'React.js', 'ReactJS'] },
      experience: [{ jobTitle: 'Developer', employer: 'Meta', estimatedYears: 3, responsibilities: ['React.js and ReactJS.'] }]
    },
    jd: {
      jobTitle: 'React Developer',
      requirements: { required: { skills: ['React'] } }
    },
    rawText: 'React Developer. Skills: React, React.js, ReactJS. Experience: React.js and ReactJS.',
    asserts: (res) => {
      // React, React.js and ReactJS are synonyms. They should map to 1 unique match of React, not count multiple times.
      assert.strictEqual(res.skills.matchedRequired.length, 1);
    }
  },
  {
    id: 17,
    name: 'Resume with unrelated skills',
    resume: {
      skills: { frameworks: ['React'], others: ['Photoshop', 'Video Editing', 'Spanish'] },
      experience: [{ jobTitle: 'Designer', employer: 'Agency', estimatedYears: 3, responsibilities: ['Edited videos and used Photoshop.'] }]
    },
    jd: {
      jobTitle: 'React Developer',
      requirements: { required: { skills: ['React'] } }
    },
    rawText: 'Designer. Skills: React, Photoshop, Video Editing, Spanish.',
    asserts: (res) => {
      // Unrelated skills should not inflate the score.
      assert.strictEqual(res.skills.matchedRequired.length, 1);
      const classifiedUnrelated = classifyRequirement('Photoshop', res);
      assert.strictEqual(classifiedUnrelated, 'irrelevant');
    }
  },
  {
    id: 18,
    name: 'JD with required and preferred requirements',
    resume: {
      skills: { languages: ['Python'], frameworks: ['Django'] }
    },
    jd: {
      jobTitle: 'Python Developer',
      requirements: {
        required: { skills: ['Python'] },
        preferred: { skills: ['Django'] }
      }
    },
    rawText: 'Skills: Python, Django.',
    asserts: (res) => {
      assert.ok(res.skills.matchedRequired.includes('Python'));
      assert.ok(res.skills.matchedPreferred.includes('Django'));
    }
  },
  {
    id: 19,
    name: 'JD with minimum years of experience',
    resume: {
      experience: [{ jobTitle: 'Developer', estimatedYears: 2 }]
    },
    jd: {
      jobTitle: 'Developer',
      experienceYearsRequired: 5,
      requirements: { required: { skills: [] } }
    },
    rawText: 'Developer. Experience: 2 years.',
    asserts: (res) => {
      assert.ok(res.breakdown.experienceRelevance < 50, 'Candidate should be penalized for missing required years.');
    }
  },
  {
    id: 20,
    name: 'JD with required certification',
    resume: {
      certifications: ['AWS Certified Solutions Architect']
    },
    jd: {
      jobTitle: 'Cloud Engineer',
      criticalRequirements: ['AWS Certified Solutions Architect'],
      requirements: { required: { skills: [] } }
    },
    rawText: 'Cloud Engineer. Certifications: AWS Certified Solutions Architect.',
    asserts: (res) => {
      assert.strictEqual(res.criticalRequirements.met.length, 1);
      assert.strictEqual(res.criticalRequirements.missing.length, 0);
    }
  }
];

// =============================================================================
// SECTION 3: Mode-Routing and Resume-Only Test Scenarios
// =============================================================================

const modeRoutingTests = [
  {
    name: 'Resume + null JD -> resume_only mode',
    resume: { headline: 'Dev', skills: {}, experience: [] },
    jd: null,
    asserts: (res) => {
      assert.strictEqual(res.mode, 'resume_only');
      assert.strictEqual(res.hasJobDescription, false);
    }
  },
  {
    name: 'Resume + empty JD -> resume_only mode',
    resume: { headline: 'Dev', skills: {}, experience: [] },
    jd: { jobTitle: '', requirements: { required: { skills: [] } } },
    asserts: (res) => {
      assert.strictEqual(res.mode, 'resume_only');
    }
  },
  {
    name: 'Resume + whitespace JD -> resume_only mode',
    resume: { headline: 'Dev', skills: {}, experience: [] },
    jd: { jobTitle: '   ', requirements: { required: { skills: [] } } },
    asserts: (res) => {
      assert.strictEqual(res.mode, 'resume_only');
    }
  },
  {
    name: 'Resume + valid JD -> job_match mode',
    resume: { headline: 'Dev', skills: {}, experience: [] },
    jd: { jobTitle: 'Backend Dev', requirements: { required: { skills: ['Node.js'] } } },
    asserts: (res) => {
      assert.strictEqual(res.mode, 'job_match');
      assert.strictEqual(res.hasJobDescription, true);
    }
  }
];

const resumeOnlyScenarios = [
  {
    id: 'R1',
    name: 'Excellent resume with no JD',
    resume: {
      headline: 'Senior Full Stack Engineer',
      skills: { languages: ['TypeScript', 'Python'], databases: ['PostgreSQL'] },
      experience: [{ jobTitle: 'Software Engineer', employer: 'Google', estimatedYears: 5, responsibilities: ['Designed scalable TypeScript services'], achievements: ['Reduced latency by 40%'] }],
      projects: [{ title: 'REST API', description: 'Built backend with PostgreSQL and TypeScript', technologies: ['TypeScript', 'PostgreSQL'] }],
      structureInfo: { hasExperienceSection: true, hasSkillsSection: true, hasEducationSection: true, hasProjectsSection: true, hasClearDates: true, hasClearJobTitles: true },
      parseabilityInfo: { hasSelectableText: true, hasReadableStructure: true, hasBrokenText: false }
    },
    rawText: 'Senior Full Stack Engineer. Skills: TypeScript, Python, PostgreSQL. Experience: Software Engineer at Google. Designed scalable TypeScript services. Reduced latency by 40%.',
    asserts: (res) => {
      assert.strictEqual(res.mode, 'resume_only');
      assert.ok(res.overallScore >= 80, `Expected high score, got ${res.overallScore}`);
      assert.strictEqual(res.rating, 'Strong ATS readiness');
    }
  },
  {
    id: 'R2',
    name: 'Poor resume with no JD',
    resume: {
      headline: '',
      skills: {},
      experience: [],
      projects: [],
      structureInfo: { hasExperienceSection: false, hasSkillsSection: false, hasEducationSection: false }
    },
    rawText: 'Just some text here.',
    asserts: (res) => {
      assert.strictEqual(res.mode, 'resume_only');
      assert.ok(res.overallScore <= 10, `Expected capped empty score <= 10, got ${res.overallScore}`);
      assert.strictEqual(res.breakdown.parseability, 100, 'Component parseability score must remain unchanged (100)');
      assert.strictEqual(res.breakdown.structure, 30, 'Component structure score must remain unchanged (30)');
    }
  },
  {
    id: 'R3',
    name: 'Fresher resume with no JD',
    resume: {
      headline: 'CS Student',
      skills: { languages: ['Python'] },
      experience: [],
      projects: [{ title: 'Calculator App', description: 'Simple project', technologies: ['Python'] }],
      structureInfo: { hasExperienceSection: false, hasSkillsSection: true, hasEducationSection: true, hasProjectsSection: true }
    },
    rawText: 'CS Student. Skills: Python. Projects: Calculator App.',
    asserts: (res) => {
      assert.strictEqual(res.mode, 'resume_only');
      assert.ok(res.overallScore >= 60, `Freshers should score reasonably, got ${res.overallScore}`);
      assert.ok(res.breakdown.structure >= 70, 'Fresher structure should be context-aware');
    }
  },
  {
    id: 'R4',
    name: 'Experienced resume with no JD',
    resume: {
      headline: 'Senior Developer',
      skills: { languages: ['Java'] },
      experience: [{ jobTitle: 'Developer', employer: 'IBM', estimatedYears: 6, responsibilities: ['Wrote Java code'] }],
      structureInfo: { hasExperienceSection: true, hasSkillsSection: true, hasEducationSection: true }
    },
    rawText: 'Senior Developer. Skills: Java. Experience at IBM.',
    asserts: (res) => {
      assert.strictEqual(res.mode, 'resume_only');
      assert.ok(res.overallScore >= 70, `Expected good score, got ${res.overallScore}`);
    }
  },
  {
    id: 'R5',
    name: 'Resume with strong projects but no professional experience',
    resume: {
      headline: 'Graduate Student',
      skills: { languages: ['JavaScript', 'Rust'] },
      experience: [],
      projects: [{ title: 'Database engine', description: 'Built distributed storage engine in Rust', technologies: ['Rust'] }],
      structureInfo: { hasExperienceSection: false, hasSkillsSection: true, hasEducationSection: true, hasProjectsSection: true }
    },
    rawText: 'Graduate Student. Skills: JavaScript, Rust. Projects: Database engine.',
    asserts: (res) => {
      assert.ok(res.overallScore >= 65);
      assert.ok(res.breakdown.projects >= 70);
    }
  },
  {
    id: 'R6',
    name: 'Resume with no quantified achievements',
    resume: {
      headline: 'Dev',
      skills: { languages: ['Python'] },
      experience: [{ jobTitle: 'Dev', responsibilities: ['Developed Python code.'] }]
    },
    rawText: 'Dev. Developed Python code.',
    asserts: (res) => {
      assert.strictEqual(res.breakdown.achievements, 60);
    }
  },
  {
    id: 'R7',
    name: 'Resume with many quantified achievements',
    resume: {
      headline: 'Dev',
      skills: { languages: ['Python'] },
      experience: [{ jobTitle: 'Dev', responsibilities: ['Wrote Python code'], achievements: ['Optimized backend by 45%', 'Reduced CPU usage by 20%'] }]
    },
    rawText: 'Dev. Wrote Python. Optimized backend by 45%. Reduced CPU usage by 20%.',
    asserts: (res) => {
      assert.strictEqual(res.breakdown.achievements, 100);
    }
  },
  {
    id: 'R8',
    name: 'Resume with missing sections',
    resume: {
      structureInfo: { hasExperienceSection: false, hasSkillsSection: false }
    },
    rawText: 'No structure here.',
    asserts: (res) => {
      assert.ok(res.overallScore <= 10, `Expected capped empty score <= 10, got ${res.overallScore}`);
      assert.strictEqual(res.breakdown.structure, 30, 'Component structure score must remain unchanged (30)');
    }
  },
  {
    id: 'R9',
    name: 'Resume with unusual formatting but successful extraction',
    resume: {
      parseabilityInfo: { hasSelectableText: true, hasReadableStructure: true, hasBrokenText: false, hasTables: true }
    },
    rawText: 'Clean text extracted from tables.',
    asserts: (res) => {
      assert.ok(res.breakdown.parseability >= 90);
    }
  },
  {
    id: 'R10',
    name: 'Two-column resume with successful extraction',
    resume: {
      parseabilityInfo: { hasSelectableText: true, hasReadableStructure: true, hasBrokenText: false, hasColumns: true }
    },
    rawText: 'Clean text from two columns.',
    asserts: (res) => {
      assert.ok(res.breakdown.parseability >= 90);
    }
  },
  {
    id: 'R11',
    name: 'Two-column resume with corrupted extraction',
    resume: {
      parseabilityInfo: { hasSelectableText: true, hasReadableStructure: false, hasBrokenText: true, hasColumns: true }
    },
    rawText: 'Broken text extraction.',
    asserts: (res) => {
      assert.ok(res.breakdown.parseability < 70);
    }
  },
  {
    id: 'R12',
    name: 'Resume with keyword stuffing',
    resume: {
      skills: { languages: ['Python', 'Java', 'C++', 'Rust', 'Ruby', 'JS', 'TS', 'Go', 'PHP', 'HTML', 'CSS', 'SQL', 'NoSQL', 'Swift', 'Kotlin', 'Scala'] },
      experience: [],
      projects: []
    },
    rawText: 'Skills: Python, Java, C++, Rust, Ruby, JS, TS, Go, PHP, HTML, CSS, SQL, NoSQL, Swift, Kotlin, Scala.',
    asserts: (res) => {
      assert.ok(res.breakdown.skills < 40, 'Should penalize keyword stuffing');
    }
  },
  {
    id: 'R13',
    name: 'Resume with duplicate skills',
    resume: {
      skills: { languages: ['React', 'ReactJS', 'React.js'] },
      experience: []
    },
    rawText: 'Skills: React, ReactJS, React.js.',
    asserts: (res) => {
      // Duplicates should be merged
      assert.ok(res.breakdown.skills >= 30);
    }
  },
  {
    id: 'R14',
    name: 'Resume with weak project descriptions',
    resume: {
      projects: [{ title: 'Calculator', description: 'Simple practice calculator app' }]
    },
    rawText: 'Calculator project.',
    asserts: (res) => {
      assert.ok(res.breakdown.projects < 30);
    }
  },
  {
    id: 'R15',
    name: 'Resume with strong project evidence',
    resume: {
      projects: [{ title: 'Calculator Service', description: 'Distributed calculator microservice built using Node.js, Redis, Docker, and Kubernetes', technologies: ['Node.js', 'Redis', 'Docker', 'Kubernetes'] }]
    },
    rawText: 'Calculator microservice with Redis, Docker, Kubernetes.',
    asserts: (res) => {
      assert.ok(res.breakdown.projects >= 70);
    }
  },
  {
    id: 'R16',
    name: 'Resume with incomplete contact information',
    resume: {
      name: '',
      phone: ''
    },
    rawText: 'No name or email.',
    asserts: (res) => {
      assert.ok(res.breakdown.contact < 50);
    }
  },
  {
    id: 'R17',
    name: 'Resume with education but no experience',
    resume: {
      headline: 'Intern',
      experience: [],
      education: [{ degree: 'BS CS' }]
    },
    rawText: 'BS CS graduate.',
    asserts: (res) => {
      assert.ok(res.breakdown.experience >= 80, 'Freshers not heavily penalized for missing experience');
    }
  },
  {
    id: 'R18',
    name: 'Resume with experience but minimal education details',
    resume: {
      experience: [{ jobTitle: 'Developer' }],
      education: []
    },
    rawText: 'Experienced developer.',
    asserts: (res) => {
      assert.strictEqual(res.breakdown.education, 40);
    }
  },
  {
    id: 'R19',
    name: 'Genuinely empty resume - empty guard triggers',
    resume: {
      skills: {},
      experience: [],
      projects: [],
      education: [],
      certifications: [],
      structureInfo: { hasExperienceSection: false, hasSkillsSection: false, hasEducationSection: false }
    },
    rawText: 'Just some text.',
    asserts: (res) => {
      assert.ok(res.overallScore <= 10, `Empty resume should be capped <= 10, got ${res.overallScore}`);
      assert.strictEqual(res.breakdown.parseability, 100);
      assert.strictEqual(res.breakdown.structure, 30);
      assert.strictEqual(res.breakdown.skills, 30);
      assert.strictEqual(res.breakdown.experience, 30);
      assert.strictEqual(res.breakdown.projects, 40);
      assert.strictEqual(res.breakdown.achievements, 40);
      assert.strictEqual(res.breakdown.education, 40);
      assert.strictEqual(res.breakdown.contact, 30);
    }
  },
  {
    id: 'R20',
    name: 'Legitimate fresher - education + skills + projects, no experience',
    resume: {
      skills: { languages: ['Python'] },
      experience: [],
      projects: [{ title: 'Calc', description: 'Simple python script' }],
      education: [{ degree: 'BS CS' }]
    },
    rawText: 'BS CS graduate. Skills: Python. Projects: Calc.',
    asserts: (res) => {
      assert.ok(res.overallScore > 10, `Fresher should not be capped <= 10, got ${res.overallScore}`);
      assert.strictEqual(res.overallScore, 68);
    }
  },
  {
    id: 'R21',
    name: 'Experience but no projects - no empty guard',
    resume: {
      skills: { languages: ['Java'] },
      experience: [{ jobTitle: 'Developer', employer: 'IBM', estimatedYears: 6, responsibilities: ['Wrote Java code'] }],
      projects: [],
      education: []
    },
    rawText: 'Senior Developer. Skills: Java. Experience at IBM.',
    asserts: (res) => {
      assert.ok(res.overallScore > 10, `Experience only should not be capped, got ${res.overallScore}`);
      assert.strictEqual(res.overallScore, 69);
    }
  },
  {
    id: 'R22',
    name: 'Skills only - no empty guard',
    resume: {
      skills: { languages: ['Python', 'SQL'] },
      experience: [],
      projects: [],
      education: [],
      certifications: []
    },
    rawText: 'Python and SQL.',
    asserts: (res) => {
      assert.ok(res.overallScore > 10, `Skills only should not be capped, got ${res.overallScore}`);
    }
  },
  {
    id: 'R23',
    name: 'Education only - no empty guard',
    resume: {
      skills: {},
      experience: [],
      projects: [],
      education: [{ degree: 'BS CS', institution: 'MIT' }],
      certifications: []
    },
    rawText: 'Graduated BS CS from MIT.',
    asserts: (res) => {
      assert.ok(res.overallScore > 10, `Education only should not be capped, got ${res.overallScore}`);
    }
  },
  {
    id: 'R24',
    name: 'Normal complete resume - no empty guard',
    resume: {
      headline: 'Senior Full Stack Engineer',
      skills: { languages: ['TypeScript', 'Python'], databases: ['PostgreSQL'] },
      experience: [{ jobTitle: 'Software Engineer', employer: 'Google', estimatedYears: 5, responsibilities: ['Designed scalable TypeScript services'], achievements: ['Reduced latency by 40%'] }],
      projects: [{ title: 'REST API', description: 'Built backend with PostgreSQL and TypeScript', technologies: ['TypeScript', 'PostgreSQL'] }],
      structureInfo: { hasExperienceSection: true, hasSkillsSection: true, hasEducationSection: true, hasProjectsSection: true, hasClearDates: true, hasClearJobTitles: true },
      parseabilityInfo: { hasSelectableText: true, hasReadableStructure: true, hasBrokenText: false }
    },
    rawText: 'Senior Full Stack Engineer. Skills: TypeScript, Python, PostgreSQL. Experience: Software Engineer at Google. Designed scalable TypeScript services. Reduced latency by 40%.',
    asserts: (res) => {
      assert.strictEqual(res.overallScore, 86, `Normal complete resume score must remain unchanged at 86, got ${res.overallScore}`);
    }
  }
];

// Execute Scenario Tests
logSection('RUNNING 20 BENCHMARK SCENARIO TESTS');

let testsFailed = 0;
for (const test of tests) {
  try {
    const result = computeAtsScores(test.resume, test.jd, test.rawText);
    assert.ok(result.overallScore >= 0 && result.overallScore <= 100, `Score out of bounds: ${result.overallScore}`);
    if (test.asserts) {
      test.asserts(result);
    }
    logPass(`Scenario ${test.id}: ${test.name} (Score: ${result.overallScore})`);
  } catch (err) {
    testsFailed++;
    logFail(`Scenario ${test.id}: ${test.name}`, err);
  }
}

// Execute Mode Routing Tests
logSection('RUNNING DUAL-MODE ROUTING TESTS');
for (const test of modeRoutingTests) {
  try {
    const result = computeAtsScores(test.resume, test.jd, 'Raw Text');
    if (test.asserts) {
      test.asserts(result);
    }
    logPass(`Routing Check: ${test.name}`);
  } catch (err) {
    testsFailed++;
    logFail(`Routing Check: ${test.name}`, err);
  }
}

// Execute Resume-Only Scenarios
logSection('RUNNING 18 RESUME-ONLY SCENARIO TESTS');
for (const test of resumeOnlyScenarios) {
  try {
    const result = computeAtsScores(test.resume, null, test.rawText);
    assert.ok(result.overallScore >= 0 && result.overallScore <= 100, `Score out of bounds: ${result.overallScore}`);
    if (test.asserts) {
      test.asserts(result);
    }
    logPass(`Scenario ${test.id}: ${test.name} (Score: ${result.overallScore})`);
  } catch (err) {
    testsFailed++;
    logFail(`Scenario ${test.id}: ${test.name}`, err);
  }
}

// Execute Relative Ranking and Traceability Auditing
logSection('RUNNING ATS RELATIVE RANKING & TRACEABILITY AUDITS');
try {
  // 1. Mode A Matches
  const s1 = computeAtsScores(tests.find(t => t.id === 1).resume, tests.find(t => t.id === 1).jd, tests.find(t => t.id === 1).rawText);
  const s2 = computeAtsScores(tests.find(t => t.id === 2).resume, tests.find(t => t.id === 2).jd, tests.find(t => t.id === 2).rawText);
  const s5 = computeAtsScores(tests.find(t => t.id === 5).resume, tests.find(t => t.id === 5).jd, tests.find(t => t.id === 5).rawText);
  const s9 = computeAtsScores(tests.find(t => t.id === 9).resume, tests.find(t => t.id === 9).jd, tests.find(t => t.id === 9).rawText);
  const s10 = computeAtsScores(tests.find(t => t.id === 10).resume, tests.find(t => t.id === 10).jd, tests.find(t => t.id === 10).rawText);

  assert.ok(s1.overallScore > s2.overallScore, `Excellent Match (${s1.overallScore}) must score higher than Poor Match (${s2.overallScore})`);
  assert.ok(s1.overallScore > s5.overallScore, `Perfect Match (${s1.overallScore}) must score higher than Missing required skill Match (${s5.overallScore})`);
  assert.ok(s10.overallScore > s9.overallScore, `Resume with quantified achievements (${s10.overallScore}) must score higher than resume without quantified achievements (${s9.overallScore})`);

  // 2. Mode B Matches (Resume Only)
  const r1 = computeAtsScores(resumeOnlyScenarios.find(t => t.id === 'R1').resume, null, resumeOnlyScenarios.find(t => t.id === 'R1').rawText);
  const r2 = computeAtsScores(resumeOnlyScenarios.find(t => t.id === 'R2').resume, null, resumeOnlyScenarios.find(t => t.id === 'R2').rawText);
  const r6 = computeAtsScores(resumeOnlyScenarios.find(t => t.id === 'R6').resume, null, resumeOnlyScenarios.find(t => t.id === 'R6').rawText);
  const r7 = computeAtsScores(resumeOnlyScenarios.find(t => t.id === 'R7').resume, null, resumeOnlyScenarios.find(t => t.id === 'R7').rawText);
  const r14 = computeAtsScores(resumeOnlyScenarios.find(t => t.id === 'R14').resume, null, resumeOnlyScenarios.find(t => t.id === 'R14').rawText);
  const r15 = computeAtsScores(resumeOnlyScenarios.find(t => t.id === 'R15').resume, null, resumeOnlyScenarios.find(t => t.id === 'R15').rawText);

  assert.ok(r1.overallScore > r2.overallScore, `Excellent Resume (${r1.overallScore}) must score higher than Poor Resume (${r2.overallScore})`);
  assert.ok(r7.overallScore > r6.overallScore, `Quantified Resume (${r7.overallScore}) must score higher than Non-quantified Resume (${r6.overallScore})`);
  assert.ok(r15.overallScore > r14.overallScore, `Strong Project Resume (${r15.overallScore}) must score higher than Weak Project Resume (${r14.overallScore})`);

  // 3. Traceability Auditing Checks
  assert.ok(r1.audit, 'Audit metadata must be present in Resume-Only response');
  assert.ok(s1.audit, 'Audit metadata must be present in Job Match response');
  assert.strictEqual(s1.audit.skills.requiredMatched, 3, 'Audit should trace 3 matched required skills in s1');
  assert.strictEqual(r7.audit.achievements.quantifiedBulletCount, 2, 'Audit should trace 2 quantified bullets in r7');

  logPass('Relative Ranking and Traceability Audits passed successfully!');
} catch (err) {
  testsFailed++;
  logFail('Relative Ranking & Traceability Audits', err);
}

if (testsFailed === 0) {
  logSection('ALL TESTS PASSED SUCCESSFULLY! Dual-Mode ATS Scoring Engine is 100% stable.');
  process.exit(0);
} else {
  logSection(`${testsFailed} SCENARIOS FAILED!`);
  process.exit(1);
}
