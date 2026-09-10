// ─── Adaptive Learner Model & Personalization Types ─────────────────────────

export type SupportLevel =
  | 'COMFORTABLE'
  | 'NEEDS_REINFORCEMENT'
  | 'GUIDED_PRACTICE'
  | 'READY_FOR_CHALLENGE'
  | 'STRONG_MASTERY';

export type ComprehensionSpeed = 'FAST' | 'NORMAL' | 'DELIBERATE';
export type PracticeRequirement = 'LOW' | 'MEDIUM' | 'HIGH';
export type PrerequisiteDependency = 'LOW' | 'MEDIUM' | 'HIGH';
export type TransferAbility = 'LOW' | 'MEDIUM' | 'HIGH';
export type ConfidenceAccuracyGap = 'BALANCED' | 'UNDERCONFIDENT' | 'OVERCONFIDENT';

export type PreferredExplanationStyle =
  | 'DIRECT'
  | 'ANALOGY_EXAMPLE'
  | 'STEP_BY_STEP'
  | 'QUESTION_LED'
  | 'VISUAL_STRUCTURED';

export type PreferredPace = 'ACCELERATED' | 'COMFORTABLE' | 'GENTLE';
export type DifficultyLevel = 'FOUNDATION' | 'EASY' | 'MEDIUM' | 'HARD' | 'ADVANCED';

export type TutoringAction =
  | 'CONCISE_EXPLANATION'
  | 'GUIDED_EXPLANATION'
  | 'PREREQUISITE_BRIDGE'
  | 'STEP_BY_STEP_PRACTICE'
  | 'CHALLENGE_EXTENSION'
  | 'REINFORCEMENT_REVIEW';

export type LearningEventCategory =
  | 'ASSESSMENT'
  | 'DOUBT'
  | 'EXPLANATION'
  | 'HINT'
  | 'PRACTICE'
  | 'MASTERY_CHECK'
  | 'REVISION'
  | 'MISSED_CLASS'
  | 'TOPIC_TRANSITION'
  | 'STUDY_SESSION';

// ─── Phase 4 Composable Pedagogical Primitives & Strategies ──────────────────
export type PedagogicalPrimitive =
  | 'EXPLAIN'
  | 'SIMPLIFY'
  | 'SCAFFOLD'
  | 'EXAMPLE'
  | 'PRACTICE'
  | 'RECALL'
  | 'REPAIR'
  | 'COMPARE'
  | 'CHALLENGE'
  | 'SUMMARIZE';

export type TeachingStrategy =
  | 'DIRECT'
  | 'ANALOGY'
  | 'REAL_WORLD_EXAMPLE'
  | 'STEP_BY_STEP'
  | 'WORKED_EXAMPLE'
  | 'SOCRATIC'
  | 'QUESTION_LED'
  | 'VISUAL_STRUCTURED'
  | 'COMPARISON'
  | 'MISCONCEPTION_REPAIR'
  | 'FEYNMAN_SIMPLIFIED'
  | 'RETRIEVAL_PRACTICE'
  | 'CHALLENGE'
  | 'EXAM_COACH'
  | 'SUMMARY_RECALL';

export type TeachingDepthLevel =
  | 'LEVEL_1_CORE_SENTENCE'
  | 'LEVEL_2_SHORT_EXAMPLE'
  | 'LEVEL_3_STEP_BY_STEP'
  | 'LEVEL_4_WORKED_APPLICATION'
  | 'LEVEL_5_TRANSFER_CHALLENGE';

export type StudyMode =
  | 'CLASS'
  | 'CATCH_UP'
  | 'STUDY'
  | 'PRACTICE'
  | 'REVISION'
  | 'EXAM'
  | 'CHALLENGE';

export type NextBestActionType =
  | 'JOIN_LIVE_CLASS'
  | 'CATCH_UP'
  | 'LEARN_PREREQUISITE'
  | 'CONTINUE_LEARNING'
  | 'PRACTICE'
  | 'REINFORCE'
  | 'REVISE'
  | 'TAKE_QUICK_CHECK'
  | 'TRY_CHALLENGE'
  | 'START_STUDY_SESSION'
  | 'CALIBRATE_DIAGNOSTIC';

export interface NextBestAction {
  action: NextBestActionType;
  topicId: string;
  topicName: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedMinutes: number;
  rationale: string;
  primitives: PedagogicalPrimitive[];
}

export type StudyGoalType =
  | 'EXAM_PREP'
  | 'DEEP_MASTERY'
  | 'COURSE_COMPLETION'
  | 'CUSTOM';

export interface StudyGoal {
  id: string;
  studentId: string;
  classId: string;
  title: string;
  goalType: StudyGoalType;
  targetDate?: string;
  targetMastery: number; // 0.0 to 1.0 (e.g. 0.85)
  targetTopicIds?: string[];
  status: 'ACTIVE' | 'ACHIEVED' | 'PAUSED';
  createdAt: string;
  updatedAt: string;
}

export interface StudyPlanSequenceStep {
  topicId: string;
  topicName: string;
  status: 'MASTERED' | 'IN_PROGRESS' | 'UPCOMING';
  currentMastery: number;
  targetMastery: number;
  estimatedMinutes: number;
  recommendedPrimitives: PedagogicalPrimitive[];
}

export interface StudyPlan {
  id: string;
  goalId: string;
  classId: string;
  studentId: string;
  startingPoint: string;
  priorityGaps: PrerequisiteGap[];
  recommendedSequence: StudyPlanSequenceStep[];
  nextAction: NextBestAction;
  estimatedSessionDuration: number;
  successCriteria: string;
  updatedAt: string;
}

export type StudySessionPhase =
  | 'RECALL'
  | 'PREREQUISITE_REPAIR'
  | 'EXPLANATION'
  | 'GUIDED_PRACTICE'
  | 'CHALLENGE'
  | 'MASTERY_CHECK'
  | 'NEXT_ACTION';

export interface StudySessionState {
  sessionId: string;
  studentId: string;
  classId: string;
  topicId: string;
  topicName: string;
  goalId?: string;
  mode: StudyMode;
  plannedPhases: StudySessionPhase[];
  currentPhaseIndex: number;
  currentPhase: StudySessionPhase;
  completedPhases: StudySessionPhase[];
  phaseArtifacts: Record<string, any>;
  score: number;
  startedAt: string;
  completedAt?: string;
}

export interface MisconceptionRecord {
  id: string;
  studentId: string;
  classId: string;
  topicId: string;
  topicName: string;
  misconceptionKey: string;
  description: string;
  errorFrequency: number;
  isCandidate: boolean;
  isStable: boolean;
  resolved: boolean;
  lastObservedAt: string;
}

export interface RetentionItem {
  topicId: string;
  topicName: string;
  lastLearnedAt: string;
  retentionScore: number; // 0.0 to 1.0
  dueForReview: boolean;
  intervalDays: number;
}

export interface StudentLearningState {
  studentId: string;
  classId: string;
  profileStatus: ProfileStatus;
  currentLiveTopic: string;
  personalFrontier: string;
  overallMastery: number;
  
  // Dimensional masteries (Cognitive Tiers)
  foundationMastery?: number;
  conceptMastery?: number;
  applicationMastery?: number;
  reasoningMastery?: number;
  transferMastery?: number;

  topicMasteries: Record<string, TopicMasteryRecord>;
  learningDebt: string[];
  retentionDue: RetentionItem[];
  activeMisconceptions: MisconceptionRecord[];
  learningGoal?: StudyGoal;
  strategyEffectiveness: Record<string, StrategyEffectiveness>;
  recentEvidenceCount: number;
  supportLevel: SupportLevel;
  nextBestAction: NextBestAction;
  whyThisActionRationale: string;
  lastUpdated: string;
}

// ─── Strategy Effectiveness Tracking ──────────────────────────────────────────
export interface StrategyEffectiveness {
  attempts: number;
  successes: number;
  avgConfidence: number; // 0.0 to 1.0
  score: number;         // success rate weighted by attempts
}

export type ProfileStatus = 'UNINITIALIZED' | 'CALIBRATING' | 'ACTIVE';

export type DiagnosticQuestionType =
  | 'FOUNDATION'
  | 'CONCEPT'
  | 'APPLICATION'
  | 'REASONING'
  | 'TRANSFER';

export interface DiagnosticQuestion {
  id: string;
  index: number;
  questionType: DiagnosticQuestionType;
  topicId: string;
  topicName: string;
  difficulty: DifficultyLevel;
  questionText: string;
  options?: string[];
  expectedKeyPoints: string[];
  hints?: string[];
  sourceChunkId?: string;
  sourceMaterialId?: string;
}

export interface DiagnosticAnswerSubmission {
  questionId: string;
  answer: string;
  timeToAnswerMs?: number;
  hintsUsed?: number;
  attemptsCount?: number;
}

export interface DiagnosticSession {
  sessionId: string;
  studentId: string;
  classId: string;
  status: 'CALIBRATING' | 'COMPLETED';
  questions: DiagnosticQuestion[];
  answers: Record<string, {
    answer: string;
    isCorrect?: boolean;
    score?: number;
    timeToAnswerMs?: number;
    hintsUsed?: number;
    submittedAt?: string;
  }>;
  startedAt: string;
  completedAt?: string;
}

export interface DiagnosticSummary {
  foundationScore: number;
  conceptScore: number;
  applicationScore: number;
  reasoningScore: number;
  transferScore: number;
  overallScore: number;
  calculatedSupportLevel: SupportLevel;
  calculatedPace: PreferredPace;
  calculatedStrategy: PreferredExplanationStyle;
  evaluatedAt: string;
}

// ─── Student Learner Profile ──────────────────────────────────────────────────
export interface PriorAcademicPerformance {
  priorSubjectScore?: number; // 0 to 100
  quizAverage?: number;       // 0 to 100
  initialPriorScore: number;  // 0.0 to 1.0 normalized prior
  confidenceLevel: number;    // 0.0 to 1.0
}

export interface StudentLearnerProfile {
  id: string;                 // lrn_<classId>_<studentId>
  studentId: string;
  classId: string;
  profileStatus: ProfileStatus;
  activeDiagnosticSessionId?: string;
  diagnosticCompletedAt?: string;
  diagnosticSummary?: DiagnosticSummary;
  priorAcademicPerformance: PriorAcademicPerformance;
  overallMastery: number;     // 0.0 to 1.0
  currentTopic: string;
  personalLearningFrontier: string;
  
  // Dimensional masteries (Cognitive Tiers)
  foundationMastery?: number;  // 0.0 to 1.0
  conceptMastery?: number;     // 0.0 to 1.0
  applicationMastery?: number; // 0.0 to 1.0
  reasoningMastery?: number;   // 0.0 to 1.0
  transferMastery?: number;    // 0.0 to 1.0

  // Observable learning characteristics (weighted evidence)
  comprehensionSpeed: ComprehensionSpeed;
  retentionScore: number;     // 0.0 to 1.0
  practiceRequirement: PracticeRequirement;
  prerequisiteDependency: PrerequisiteDependency;
  transferAbility: TransferAbility;
  confidenceAccuracyGap: ConfidenceAccuracyGap;
  
  // Actionable & evidence-based strategies
  preferredExplanationStyle: PreferredExplanationStyle;
  strategyEffectiveness: Record<PreferredExplanationStyle, StrategyEffectiveness>;
  preferredPace: PreferredPace;
  difficultyLevel: DifficultyLevel;
  supportLevel: SupportLevel;
  
  evidenceCount: number;      // total interaction signals observed
  lastUpdated: string;
}

// ─── Topic-Level Mastery ──────────────────────────────────────────────────────
export interface TopicMasteryRecord {
  id: string;                 // 	m___
  studentId: string;
  classId: string;
  topicId: string;
  topicName: string;
  parentUnit?: string;
  masteryScore: number;       // 0.0 to 1.0
  evidenceCount: number;
  lastAssessedAt: string;
  misconceptions: string[];
  retentionChecks: Array<{
    timestamp: string;
    score: number;            // 0.0 to 1.0
    intervalMinutes: number;
  }>;
}

// ─── Learning Events ──────────────────────────────────────────────────────────
export interface LearningEventMetrics {
  isCorrect?: boolean;
  timeToAnswerMs?: number;
  attemptsCount?: number;
  hintsUsed?: number;
  strategyUsed?: PreferredExplanationStyle;
  difficulty?: DifficultyLevel;
  confidenceScore?: number;
  score?: number;             // 0.0 to 1.0
  conceptUnderstanding?: number;
  reasoningQuality?: number;
  application?: number;
  transfer?: number;
}

export interface LearningEventRecord {
  id: string;
  studentId: string;
  classId: string;
  topicId: string;
  category: LearningEventCategory;
  metrics: LearningEventMetrics;
  contextSummary?: string;
  timestamp: string;
}

// ─── Concept Graph & Classroom Timeline ───────────────────────────────────────
export interface ConceptNode {
  id: string;                 // e.g. 'transistors'
  name: string;               // 'Second Generation Transistors'
  unit: string;               // 'Computer Generations'
  order: number;              // sequence in syllabus
  prerequisiteIds: string[];  // e.g. ['vacuum_tubes', 'first_gen']
  summary: string;
  keyTerms: string[];
}

export interface ClassroomConceptGraph {
  classId: string;
  concepts: Record<string, ConceptNode>;
  updatedAt: string;
}

export interface ClassroomTimelineTopic {
  topicId: string;
  topicName: string;
  startedAt: string;
  completedAt?: string;
  prerequisiteIds: string[];
}

export interface ClassroomLearningState {
  classId: string;
  currentLiveTopic: string;
  timeline: ClassroomTimelineTopic[];
  updatedAt: string;
}

// ─── Tutor Decision & Minimum Learning Bridge ─────────────────────────────────
export interface PrerequisiteGap {
  prerequisiteTopicId: string;
  prerequisiteTopicName: string;
  currentMastery: number;     // e.g. 0.35
  requiredMastery: number;    // e.g. 0.70
  gapSeverity: 'MILD' | 'MODERATE' | 'SEVERE';
}

export interface TutorDecision {
  action: TutoringAction;
  topicId: string;
  topicName: string;
  depth: 'SHORT' | 'MEDIUM' | 'LAYERED';
  pace: 'FAST' | 'COMFORTABLE' | 'SLOW';
  strategy: PreferredExplanationStyle;
  difficulty: DifficultyLevel;
  needsPractice: boolean;
  rationale: string;
  prerequisiteBridgeRequired?: {
    gaps: PrerequisiteGap[];
    estimatedBridgeTimeSec: number;
  };
}

export interface MinimumLearningBridge {
  studentId: string;
  classId: string;
  liveTopicId: string;
  liveTopicName: string;
  personalFrontierTopicId: string;
  personalFrontierTopicName: string;
  missedClassDurationMinutes: number; // e.g. 20 minutes
  learningDebt: string[];             // list of unmastered prerequisite concept names
  learningDebtGaps: PrerequisiteGap[];
  bridgeSummary: string;
  estimatedDurationSec: number;
  isQuickCatchup: boolean;            // true if student already has strong prerequisites (20-30s catchup)
}

// ─── Micro-Assessment ─────────────────────────────────────────────────────────
export interface MicroAssessmentQuestion {
  id: string;
  topicId: string;
  topicName: string;
  difficulty: DifficultyLevel;
  questionText: string;
  options?: string[];         // optional multiple choice
  expectedKeyPoints: string[];
  type: 'CONCEPTUAL' | 'COMPARISON' | 'APPLICATION' | 'REASONING' | 'TRANSFER';
  sourceChunkId?: string;
  sourceMaterialId?: string;
}

export interface MicroAssessmentEvaluation {
  isCorrect: boolean;
  score: number;              // 0.0 to 1.0
  feedback: string;
  identifiedMisconceptions: string[];
  suggestedFollowUp?: string;
}

// ─── Teacher Aggregate Intelligence ───────────────────────────────────────────
export interface TeacherClassroomIntelligence {
  classId: string;
  className: string;
  currentLiveTopic: string;
  totalStudents: number;
  averageMasteryPercent: number;
  distribution: {
    comfortable: number;
    needsReinforcement: number;
    guidedPractice: number;
    readyForChallenge: number;
    strongMastery: number;
  };
  difficultConcepts: Array<{
    topicId: string;
    topicName: string;
    averageMastery: number;
    studentsNeedingHelpCount: number;
  }>;
  commonMisconceptions: Array<{
    topicId: string;
    topicName: string;
    misconception: string;
    frequencyCount: number;
  }>;
  activeAIInterventionsCount: number;
  lateJoinCatchupCount: number;
}

// ─── Phase 5: Personal Learning Profile Setup (Pre-Course Calibration) ─────────
export type PersonalProfileStatus = 'UNSET' | 'UNCALIBRATING' | 'CALIBRATING' | 'CALIBRATED' | 'RECALIBRATING' | 'UNCALIBRATED';
export type ReadingPaceLevel = 'FAST' | 'MODERATE' | 'DELIBERATE' | 'AVERAGE' | 'SLOW';
export type PerformanceLevel = 'STRONG' | 'MODERATE' | 'DEVELOPING' | 'PROFICIENT' | 'FOUNDATIONAL' | 'INTERMEDIATE';
export type EstimatedStudyPace = 'ACCELERATED' | 'COMFORTABLE' | 'GUIDED' | 'MODERATE' | 'INTENSIVE' | 'EXPEDITED';
export type ProfileConfidenceLevel = 'BUILDING' | 'MODERATE' | 'HIGH' | 'CALIBRATED_BASELINE' | 'DYNAMIC_REFINED';
export type PreferredInitialTeachingStyle = PreferredExplanationStyle | 'CONCEPT_FIRST' | 'ANALOGY_HEAVY' | 'EXAMPLE_FIRST' | 'PRACTICE_FIRST';
export type AssistanceLevelRequirement = 'STANDARD' | 'EXTENSIVE_SUPPORT' | 'INDEPENDENT_CHALLENGE';

export interface ProfileCalibrationTask {
  id?: string;
  taskId?: string;
  stepIndex?: number;
  taskType?: string;
  type?: string;
  title: string;
  instruction?: string;
  instructions?: string;
  content?: string;
  passageText?: string;
  passageWordCount?: number;
  questionText?: string;
  options?: any[];
  expectedKeyPoints?: string[];
  estimatedSeconds?: number;
  preferenceOptions?: Array<{
    id: PreferredExplanationStyle;
    label: string;
    description: string;
  }>;
}

export interface ProfileCalibrationAnswerSubmission {
  stepIndex?: number;
  taskId?: string;
  taskType?: string;
  readingDurationMs?: number;
  responseLatencyMs?: number;
  timeSpentSeconds?: number;
  selectedOption?: string;
  selectedOptionId?: string;
  answerText?: string;
  selectedPreference?: PreferredExplanationStyle;
}

export interface ProfileCalibrationSession {
  sessionId: string;
  studentId: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  startedAt: string;
  completedAt?: string;
  currentStepIndex?: number;
  currentTaskIndex?: number;
  tasks: ProfileCalibrationTask[];
  submissions: any;
}

export interface StudyTimeModel {
  baselineWpm?: number;
  baseReadingSpeedWpm?: number;
  comprehensionFactor?: number;
  recallFactor?: number;
  recentStudySessionsCount?: number;
  adjustmentFactor?: number;
  complexityAdjustmentFactor?: number;
  conceptDensityMultiplier?: number;
  historicalActualVsPredictedRatio?: number;
  evidenceCount?: number;
  calibrationSessionCount?: number;
  behavioralEvidenceCount?: number;
  studyDurationObservationCount?: number;
  lastCalibratedAt?: string;
}

export interface TransparencyRationales {
  readingPace?: string;
  readingPaceRationale?: string;
  comprehension?: string;
  recall?: string;
  application?: string;
  estimatedPace?: string;
  studyPaceRationale?: string;
  studyTime?: string;
  confidence?: string;
  assistanceLevelRationale?: string;
  preferredStyleRationale?: string;
}

export interface CalibrationHistoryEntry {
  sessionId?: string;
  calibratedAt: string;
  readingSpeedWpm: number;
  readingPaceLevel?: any;
  comprehensionScore: number;
  recallScore: number;
  applicationScore: number;
  assistanceLevel?: any;
  preferredStyle?: any;
  estimatedPace?: any;
  estimatedStudyPace?: any;
  source?: string;
}

export interface PersonalLearningProfile {
  id?: string;
  studentId: string;
  status: any;
  calibratedAt?: string | null;
  readingSpeedWpm?: number | null;
  readingPace?: any;
  readingPaceLevel?: any;
  comprehensionScore?: number | null;
  comprehensionLevel?: any;
  recallScore?: number | null;
  recallLevel?: any;
  applicationScore?: number | null;
  applicationLevel?: any;
  responseLatencyAvgMs?: number;
  supportNeed?: any;
  assistanceLevel?: any;
  estimatedStudyPace: any;
  preferredInitialStyle: any;
  whatHelpsMost?: string[];
  studyTimeModel: StudyTimeModel;
  evidenceCount?: number;
  studyDurationObservationCount?: number;
  behavioralEvidenceCount?: number;
  calibrationSessionCount?: number;
  profileConfidence: any;
  transparencyRationales?: TransparencyRationales;
  rationales?: any;
  calibrationHistory: CalibrationHistoryEntry[];
  activeCalibrationSessionId?: string;
  lastCalibratedAt?: string;
  updatedAt: string;
}

export interface EstimatedStudyTimeResult {
  pageCount?: number;
  wordCount?: number;
  estimatedMinutesMin?: number;
  estimatedMinutesMax?: number;
  estimatedMinutes?: number;
  estimatedText?: string;
  confidence: any;
  rationale: string;
  breakdown?: any;
  complexityBreakdown?: any;
}

