import { dbService } from '../db.service';
import { RAGProviderFactory } from '../rag/providers/providerFactory';
import { conceptGraphService } from './conceptGraphService';
import { learnerModelService } from './learnerModelService';
import { answerEvaluatorService } from './answerEvaluatorService';
import {
  MicroAssessmentQuestion,
  MicroAssessmentEvaluation,
  DifficultyLevel,
  LearningEventRecord,
  DiagnosticQuestion,
  DiagnosticSession,
  DiagnosticSummary,
  DiagnosticAnswerSubmission,
  DiagnosticQuestionType,
  PreferredExplanationStyle,
  PreferredPace,
  SupportLevel,
} from './types';

export class MicroAssessmentService {
  /**
   * Generates a targeted micro-assessment check question grounded in course concepts.
   */
  public async generateQuestion(
    classId: string,
    studentId: string,
    topicId?: string
  ): Promise<MicroAssessmentQuestion> {
    const upperClassId = classId.toUpperCase();
    const profile = learnerModelService.getOrInitializeProfile(upperClassId, studentId);
    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const liveState = dbService.getClassroomLearningState(upperClassId);

    const firstTopicId = Object.values(graph.concepts)[0]?.id || 'first_generation';
    const liveTopicId = liveState?.currentLiveTopic && graph.concepts[liveState.currentLiveTopic]
      ? liveState.currentLiveTopic
      : (profile.currentTopic && graph.concepts[profile.currentTopic] ? profile.currentTopic : firstTopicId);

    const liveConcept = graph.concepts[liveTopicId];
    const maxAllowedOrder = liveConcept?.order ?? 999;

    let targetTopicId = topicId || liveTopicId;
    let concept = graph.concepts[targetTopicId] || conceptGraphService.matchTopicFromQuery(targetTopicId, upperClassId);

    // Server-side enforcement: Clamp any future topic request to active learning frontier
    if (concept && concept.order > maxAllowedOrder) {
      targetTopicId = liveTopicId;
      concept = liveConcept;
    }

    const difficulty: DifficultyLevel = profile.difficultyLevel;

    const questionBank: Record<string, MicroAssessmentQuestion[]> = {
      // ─── Computer Science: First Generation & Vacuum Tubes (10 Questions) ────
      first_generation: [
        {
          id: `q_fg_1`,
          topicId: 'first_generation',
          topicName: 'First Generation Computers & Vacuum Tubes',
          difficulty: 'FOUNDATION',
          type: 'CONCEPTUAL',
          questionText: 'Which primary electronic component was used for circuitry in first-generation computers (1940-1956)?',
          options: ['Vacuum Tubes', 'Transistors', 'Integrated Circuits', 'Microprocessors'],
          expectedKeyPoints: ['vacuum tubes', 'thermionic valves'],
        },
        {
          id: `q_fg_2`,
          topicId: 'first_generation',
          topicName: 'First Generation Computers & Vacuum Tubes',
          difficulty: 'FOUNDATION',
          type: 'CONCEPTUAL',
          questionText: 'What was the main memory storage technology used in first-generation computers like ENIAC and UNIVAC?',
          options: ['Magnetic Drums', 'Flash Memory', 'Optical Discs', 'DDR RAM'],
          expectedKeyPoints: ['magnetic drums', 'magnetic drum'],
        },
        {
          id: `q_fg_3`,
          topicId: 'first_generation',
          topicName: 'First Generation Computers & Vacuum Tubes',
          difficulty: 'EASY',
          type: 'CONCEPTUAL',
          questionText: 'Which programming language tier was predominantly used to program first-generation computers?',
          options: ['Machine Language (Binary 0s and 1s)', 'Assembly Language', 'High-Level C/Java', 'Python'],
          expectedKeyPoints: ['machine language', 'binary', '0s and 1s'],
        },
        {
          id: `q_fg_4`,
          topicId: 'first_generation',
          topicName: 'First Generation Computers & Vacuum Tubes',
          difficulty: 'EASY',
          type: 'CONCEPTUAL',
          questionText: 'What was one of the biggest physical operational drawbacks of first-generation vacuum tube computers?',
          options: ['Massive heat generation and frequent tube burnout', 'Too small to be serviced', 'Required solar panels', 'Zero power consumption'],
          expectedKeyPoints: ['massive heat', 'tube burnout', 'high power consumption', 'huge size'],
        },
        {
          id: `q_fg_5`,
          topicId: 'first_generation',
          topicName: 'First Generation Computers & Vacuum Tubes',
          difficulty: 'MEDIUM',
          type: 'APPLICATION',
          questionText: 'Why did first-generation computers require continuous air conditioning in dedicated room-sized installations?',
          options: ['To dissipate the immense heat produced by thousands of glowing vacuum tube filaments', 'To keep the magnetic tapes frozen', 'To prevent rust on keyboards', 'To improve internet signals'],
          expectedKeyPoints: ['dissipate heat', 'filament heat', 'prevent overheating'],
        },
        {
          id: `q_fg_6`,
          topicId: 'first_generation',
          topicName: 'First Generation Computers & Vacuum Tubes',
          difficulty: 'MEDIUM',
          type: 'COMPARISON',
          questionText: 'How did data input/output operate in first-generation systems like UNIVAC I?',
          options: ['Punched cards and paper tape', 'USB drives and touchscreens', 'Bluetooth keyboards', 'Voice recognition'],
          expectedKeyPoints: ['punched cards', 'paper tape', 'magnetic tape'],
        },
        {
          id: `q_fg_7`,
          topicId: 'first_generation',
          topicName: 'First Generation Computers & Vacuum Tubes',
          difficulty: 'HARD',
          type: 'REASONING',
          questionText: 'What fundamental physical property of thermionic vacuum tubes caused high failure rates and maintenance overhead?',
          options: ['Hot tungsten filaments degraded over time and vacuum seals could leak', 'They had too many transistors', 'They operated at absolute zero', 'They relied on mechanical gears'],
          expectedKeyPoints: ['filament degradation', 'heated filament', 'vacuum leak', 'burnout'],
        },
        {
          id: `q_fg_8`,
          topicId: 'first_generation',
          topicName: 'First Generation Computers & Vacuum Tubes',
          difficulty: 'HARD',
          type: 'APPLICATION',
          questionText: 'When diagnosing a computational halt in a first-generation vacuum tube array, why did technicians have to check filaments sequentially or use neon fault lamps?',
          options: ['Vacuum tube filament burnout broke the circuit loop, stopping all downstream current until the faulted tube was isolated', 'Tubes communicated via bluetooth packets', 'Filaments dissolved in water', 'The compiler generated syntax warnings'],
          expectedKeyPoints: ['broke circuit loop', 'filament burnout', 'isolated faulted tube', 'series filament'],
        },
        {
          id: `q_fg_9`,
          topicId: 'first_generation',
          topicName: 'First Generation Computers & Vacuum Tubes',
          difficulty: 'ADVANCED',
          type: 'TRANSFER',
          questionText: 'Why was arithmetic calculation in first-generation computers fundamentally slower than subsequent solid-state designs?',
          options: ['Electrons in vacuum tubes required thermal emission and physical transit times, limited by heating and switching lag', 'Software was too complex', 'They used wireless fiber optics', 'They had too much memory'],
          expectedKeyPoints: ['thermal emission', 'switching lag', 'transit time', 'filament warm-up'],
        },
        {
          id: `q_fg_10`,
          topicId: 'first_generation',
          topicName: 'First Generation Computers & Vacuum Tubes',
          difficulty: 'ADVANCED',
          type: 'APPLICATION',
          questionText: 'What breakthrough directly motivated the transition from first-generation to second-generation computer architecture?',
          options: ['The invention of the point-contact and junction transistor at Bell Labs', 'The discovery of the internet', 'The invention of the mouse', 'The invention of laser printers'],
          expectedKeyPoints: ['transistor', 'bell labs', 'solid state', 'shockley bardeen brattain'],
        },
      ],

      // ─── Computer Science: Vacuum Tube Technology (10 Questions) ─────────────
      vacuum_tubes: [
        {
          id: `q_vt_1`,
          topicId: 'vacuum_tubes',
          topicName: 'Vacuum Tube Technology & Limitations',
          difficulty: 'FOUNDATION',
          type: 'CONCEPTUAL',
          questionText: 'What is a vacuum tube (thermionic valve)?',
          options: ['A sealed glass tube controlling electric current flow between electrodes in a vacuum', 'A plastic pipe for cooling water', 'A silicon microchip', 'A magnetic storage disc'],
          expectedKeyPoints: ['sealed glass tube', 'controlling current', 'vacuum', 'electrodes'],
        },
        {
          id: `q_vt_2`,
          topicId: 'vacuum_tubes',
          topicName: 'Vacuum Tube Technology & Limitations',
          difficulty: 'FOUNDATION',
          type: 'CONCEPTUAL',
          questionText: 'Which physical principle allows electrons to be emitted from a heated cathode inside a vacuum tube?',
          options: ['Thermionic Emission', 'Photoelectric Effect', 'Nuclear Fission', 'Superconductivity'],
          expectedKeyPoints: ['thermionic emission', 'heated cathode'],
        },
        {
          id: `q_vt_3`,
          topicId: 'vacuum_tubes',
          topicName: 'Vacuum Tube Technology & Limitations',
          difficulty: 'EASY',
          type: 'CONCEPTUAL',
          questionText: 'Why must the air be completely evacuated from inside a vacuum tube?',
          options: ['To prevent oxygen from burning the red-hot filament and allow free electron movement', 'To make the tube lighter', 'To reduce the cost of glass', 'To create a magnetic shield'],
          expectedKeyPoints: ['prevent burning', 'oxygen oxidation', 'free electron path'],
        },
        {
          id: `q_vt_4`,
          topicId: 'vacuum_tubes',
          topicName: 'Vacuum Tube Technology & Limitations',
          difficulty: 'EASY',
          type: 'CONCEPTUAL',
          questionText: 'What happens when the filament inside a vacuum tube burns out?',
          options: ['The circuit breaks and the computer stops working until the tube is replaced', 'The computer automatically speeds up', 'The tube repairs itself with heat', 'The memory increases'],
          expectedKeyPoints: ['circuit breaks', 'tube replacement', 'system halt', 'failure'],
        },
        {
          id: `q_vt_5`,
          topicId: 'vacuum_tubes',
          topicName: 'Vacuum Tube Technology & Limitations',
          difficulty: 'MEDIUM',
          type: 'COMPARISON',
          questionText: 'How does a triode vacuum tube use a grid electrode to control electrical current?',
          options: ['A small voltage applied to the grid regulates the larger flow of electrons between cathode and anode', 'The grid blocks all light', 'The grid rotates like a fan', 'The grid stores magnetic charges'],
          expectedKeyPoints: ['grid voltage', 'regulates electron flow', 'amplification', 'switching'],
        },
        {
          id: `q_vt_6`,
          topicId: 'vacuum_tubes',
          topicName: 'Vacuum Tube Technology & Limitations',
          difficulty: 'MEDIUM',
          type: 'APPLICATION',
          questionText: 'In early computers with 18,000 vacuum tubes, what was the average Mean Time Between Failures (MTBF)?',
          options: ['A few hours to a couple days before a tube failed', '10 years continuous without failure', '100 years', 'Infinite'],
          expectedKeyPoints: ['few hours', 'frequent failure', 'daily breakdown'],
        },
        {
          id: `q_vt_7`,
          topicId: 'vacuum_tubes',
          topicName: 'Vacuum Tube Technology & Limitations',
          difficulty: 'HARD',
          type: 'REASONING',
          questionText: 'Why do vacuum tubes have high energy inefficiency compared to solid-state semiconductor devices?',
          options: ['A large portion of energy is wasted as heat just to keep the cathode filament incandescently hot', 'Electrons move too fast', 'Glass absorbs all electrical voltage', 'They require liquid nitrogen'],
          expectedKeyPoints: ['wasted heat', 'filament power', 'high power dissipation'],
        },
        {
          id: `q_vt_8`,
          topicId: 'vacuum_tubes',
          topicName: 'Vacuum Tube Technology & Limitations',
          difficulty: 'HARD',
          type: 'COMPARISON',
          questionText: 'Contrast the switching speed of a vacuum tube with a solid-state transistor.',
          options: ['Vacuum tubes switch in milliseconds/microseconds, whereas transistors switch in nanoseconds/picoseconds', 'Vacuum tubes are 1000x faster than modern transistors', 'Both switch at the exact same speed', 'Transistors cannot switch digital states'],
          expectedKeyPoints: ['milliseconds vs nanoseconds', 'transistors much faster', 'switching speed'],
        },
        {
          id: `q_vt_9`,
          topicId: 'vacuum_tubes',
          topicName: 'Vacuum Tube Technology & Limitations',
          difficulty: 'ADVANCED',
          type: 'APPLICATION',
          questionText: 'In which niche modern applications are vacuum tubes still occasionally preferred over transistors today?',
          options: ['High-end audiophile tube amplifiers and high-power RF radar transmitters', 'Smartphones and smartwatches', 'USB thumb drives', 'Laptop CPUs'],
          expectedKeyPoints: ['audio amplifiers', 'high-power rf transmitters', 'radar', 'musical warmth'],
        },
        {
          id: `q_vt_10`,
          topicId: 'vacuum_tubes',
          topicName: 'Vacuum Tube Technology & Limitations',
          difficulty: 'ADVANCED',
          type: 'TRANSFER',
          questionText: 'How did the physical fragility of glass vacuum tubes restrict computing from being portable or deployed in mobile/aerospace vehicles?',
          options: ['Mechanical vibrations and thermal shocks easily shattered glass envelopes and broke delicate filaments', 'Glass was too heavy for airplanes', 'Tubes only worked when facing North', 'Glass blocked radio waves'],
          expectedKeyPoints: ['vibration fragility', 'mechanical shock', 'shattering glass', 'filament snapping'],
        },
      ],

      // ─── Computer Science: Second Generation & Transistors (10 Questions) ────
      second_generation: [
        {
          id: `q_sg_1`,
          topicId: 'second_generation',
          topicName: 'Second Generation Computers & Transistors',
          difficulty: 'FOUNDATION',
          type: 'CONCEPTUAL',
          questionText: 'What electronic component replaced vacuum tubes in second generation computers (1956-1963)?',
          options: ['Transistors', 'Microprocessors', 'Vacuum Tubes', 'Integrated Circuits'],
          expectedKeyPoints: ['transistors', 'solid state', 'semiconductor'],
        },
        {
          id: `q_sg_2`,
          topicId: 'second_generation',
          topicName: 'Second Generation Computers & Transistors',
          difficulty: 'FOUNDATION',
          type: 'CONCEPTUAL',
          questionText: 'Which primary memory technology was introduced during the second computer generation?',
          options: ['Magnetic Core Memory', 'Punched Cards', 'Flash NVRAM', 'Dynamic RAM'],
          expectedKeyPoints: ['magnetic core', 'magnetic core memory'],
        },
        {
          id: `q_sg_3`,
          topicId: 'second_generation',
          topicName: 'Second Generation Computers & Transistors',
          difficulty: 'EASY',
          type: 'CONCEPTUAL',
          questionText: 'Which programming languages emerged and became popular during the second generation?',
          options: ['Assembly Language, FORTRAN, and COBOL', 'Python and JavaScript', 'Pure Binary 0s and 1s only', 'Rust and Kotlin'],
          expectedKeyPoints: ['fortran', 'cobol', 'assembly language'],
        },
        {
          id: `q_sg_4`,
          topicId: 'second_generation',
          topicName: 'Second Generation Computers & Transistors',
          difficulty: 'EASY',
          type: 'CONCEPTUAL',
          questionText: 'Name two major advantages of transistors over vacuum tubes in second-generation systems.',
          options: ['Far smaller physical size, significantly lower power consumption and heat', 'Made of glass and required room cooling', 'Required manual crank power', 'Could only compute addition'],
          expectedKeyPoints: ['smaller size', 'lower power', 'less heat', 'higher reliability', 'faster'],
        },
        {
          id: `q_sg_5`,
          topicId: 'second_generation',
          topicName: 'Second Generation Computers & Transistors',
          difficulty: 'MEDIUM',
          type: 'COMPARISON',
          questionText: 'Compare first and second generation computers in terms of physical footprint and reliability.',
          options: ['Second generation computers were much smaller, more reliable, and experienced vastly fewer hardware breakdowns', 'First generation computers were smaller and faster', 'Both had the exact same size and failure rate', 'Second generation computers were less reliable'],
          expectedKeyPoints: ['much smaller', 'higher reliability', 'fewer breakdowns', 'less maintenance'],
        },
        {
          id: `q_sg_6`,
          topicId: 'second_generation',
          topicName: 'Second Generation Computers & Transistors',
          difficulty: 'MEDIUM',
          type: 'APPLICATION',
          questionText: 'When upgrading a batch processing center from 1st to 2nd generation hardware, why did Mean Time Between Failures (MTBF) jump from hours to weeks?',
          options: ['Transistors have no mechanical filaments to burn out and operate at much lower temperatures', 'Second generation computers were only powered on 5 minutes a day', 'Transistors were made of flexible rubber', 'The machines only processed decimal numbers'],
          expectedKeyPoints: ['no mechanical filaments', 'lower temperatures', 'no filament burnout', 'solid state reliability'],
        },
        {
          id: `q_sg_7`,
          topicId: 'second_generation',
          topicName: 'Second Generation Computers & Transistors',
          difficulty: 'HARD',
          type: 'REASONING',
          questionText: 'Why did the solid-state semiconductor nature of transistors eliminate the warmup time required by vacuum tubes?',
          options: ['Transistors conduct current through solid semiconductor lattices without needing a glowing filament to reach high thermal emission temperatures', 'Transistors store boiling water', 'Transistors use chemical batteries', 'Transistors are optical lasers'],
          expectedKeyPoints: ['no filament heating', 'solid state lattice', 'instantaneous conduction', 'semiconductor'],
        },
        {
          id: `q_sg_8`,
          topicId: 'second_generation',
          topicName: 'Second Generation Computers & Transistors',
          difficulty: 'HARD',
          type: 'APPLICATION',
          questionText: 'How did the introduction of FORTRAN and COBOL during the second generation transform software development?',
          options: ['Allowed programmers to write human-readable algebraic code instead of raw binary machine code', 'Eliminated the need for compilers', 'Removed mathematics from programming', 'Forced users to code on punch tape only'],
          expectedKeyPoints: ['human readable code', 'high level programming', 'compiler translation', 'portability'],
        },
        {
          id: `q_sg_9`,
          topicId: 'second_generation',
          topicName: 'Second Generation Computers & Transistors',
          difficulty: 'ADVANCED',
          type: 'APPLICATION',
          questionText: 'Explain how discrete transistor manufacturing eventually hit the "Tyranny of Numbers" problem that motivated Integrated Circuits.',
          options: ['Wiring millions of individual discrete transistors together with manual solder joints became too complex and error-prone', 'Transistors cost too much gold', 'Computers ran out of binary numbers', 'Transistors grew too large'],
          expectedKeyPoints: ['tyranny of numbers', 'wiring complexity', 'manual soldering joints', 'interconnection bottleneck'],
        },
        {
          id: `q_sg_10`,
          topicId: 'second_generation',
          topicName: 'Second Generation Computers & Transistors',
          difficulty: 'ADVANCED',
          type: 'TRANSFER',
          questionText: 'How did magnetic core memory provide non-volatile storage advantages in second generation computers?',
          options: ['Tiny ferrite magnetic rings retained their magnetic orientation (0 or 1) even when electrical power was turned off', 'It used spinning CDs', 'It dissolved in water', 'It required constant battery recharging'],
          expectedKeyPoints: ['ferrite rings', 'retained magnetic orientation', 'non-volatile', 'core memory'],
        },
      ],

      // ─── Physics: Newton's Laws & Mechanics (10 Questions) ───────────────────
      newton_laws: [
        {
          id: `q_nl_1`,
          topicId: 'newton_laws',
          topicName: "Newton's Laws & Mechanics",
          difficulty: 'FOUNDATION',
          type: 'CONCEPTUAL',
          questionText: "What is the net external force acting on an object moving in a straight line at constant speed?",
          options: ['0 N (Zero Net Force)', 'Equal to object weight', 'Increasing force', 'Proportional to velocity'],
          expectedKeyPoints: ['0 n', 'zero net force', 'balanced forces', 'zero'],
        },
        {
          id: `q_nl_2`,
          topicId: 'newton_laws',
          topicName: "Newton's Laws & Mechanics",
          difficulty: 'FOUNDATION',
          type: 'CONCEPTUAL',
          questionText: "Which law is also widely known as the Law of Inertia?",
          options: ["Newton's First Law", "Newton's Second Law", "Newton's Third Law", "Law of Universal Gravitation"],
          expectedKeyPoints: ["newton's first law", 'first law', 'inertia'],
        },
        {
          id: `q_nl_3`,
          topicId: 'newton_laws',
          topicName: "Newton's Laws & Mechanics",
          difficulty: 'EASY',
          type: 'CONCEPTUAL',
          questionText: "What is the mathematical equation expressing Newton's Second Law of Motion?",
          options: ['F = m * a', 'F = m / a', 'F = a / m', 'F = m + a'],
          expectedKeyPoints: ['f = ma', 'force equals mass times acceleration', 'f=ma'],
        },
        {
          id: `q_nl_4`,
          topicId: 'newton_laws',
          topicName: "Newton's Laws & Mechanics",
          difficulty: 'EASY',
          type: 'APPLICATION',
          questionText: 'A 5 kg block experiences a net horizontal force of 20 N. What is its acceleration?',
          options: ['4 m/s²', '100 m/s²', '0.25 m/s²', '15 m/s²'],
          expectedKeyPoints: ['4', '4 m/s^2', '4 m/s2', '4m/s'],
        },
        {
          id: `q_nl_5`,
          topicId: 'newton_laws',
          topicName: "Newton's Laws & Mechanics",
          difficulty: 'MEDIUM',
          type: 'COMPARISON',
          questionText: 'According to Newton\'s Third Law, if a book pushes down on a table with 10 N, the table pushes up on the book with:',
          options: ['Exactly 10 N in the upward direction', '0 N', '20 N', '5 N'],
          expectedKeyPoints: ['10 n', 'equal and opposite', '10 newtons upward'],
        },
        {
          id: `q_nl_6`,
          topicId: 'newton_laws',
          topicName: "Newton's Laws & Mechanics",
          difficulty: 'MEDIUM',
          type: 'APPLICATION',
          questionText: 'Why does a passenger lurch forward when a moving bus suddenly slams on its brakes?',
          options: ['Due to inertia, the passenger body tends to maintain its forward state of motion', 'Friction pushes the passenger forward', 'Gravity increases suddenly', 'Air pressure in the bus collapses'],
          expectedKeyPoints: ['inertia', 'maintain forward motion', 'first law'],
        },
        {
          id: `q_nl_7`,
          topicId: 'newton_laws',
          topicName: "Newton's Laws & Mechanics",
          difficulty: 'HARD',
          type: 'REASONING',
          questionText: 'If the net force on an object is doubled while its mass is halved, what happens to its acceleration?',
          options: ['Acceleration quadruples (increases by 4x)', 'Acceleration doubles', 'Acceleration stays constant', 'Acceleration is halved'],
          expectedKeyPoints: ['quadruples', '4x', 'increases by factor of 4', '4 times'],
        },
        {
          id: `q_nl_8`,
          topicId: 'newton_laws',
          topicName: "Newton's Laws & Mechanics",
          difficulty: 'HARD',
          type: 'APPLICATION',
          questionText: 'A rocket accelerates forward in deep space vacuum because:',
          options: ['Exhaust gases expelled backward exert an equal and opposite forward reaction force on the rocket', 'The rocket pushes against space air', 'Gravity pulls it forward', 'Solar wind pushes the nose cone'],
          expectedKeyPoints: ['action reaction', 'exhaust gas reaction', 'third law', 'momentum conservation'],
        },
        {
          id: `q_nl_9`,
          topicId: 'newton_laws',
          topicName: "Newton's Laws & Mechanics",
          difficulty: 'ADVANCED',
          type: 'APPLICATION',
          questionText: 'What is the apparent weight of a 60 kg person in an elevator accelerating downward at 2 m/s²? (g = 9.8 m/s²)',
          options: ['468 N', '588 N', '708 N', '120 N'],
          expectedKeyPoints: ['468 n', '468', 'm(g - a)', '468n'],
        },
        {
          id: `q_nl_10`,
          topicId: 'newton_laws',
          topicName: "Newton's Laws & Mechanics",
          difficulty: 'ADVANCED',
          type: 'TRANSFER',
          questionText: 'Why do action and reaction force pairs never cancel each other out to produce zero acceleration?',
          options: ['Action and reaction forces act on two completely different objects, never on the same single body', 'They occur at different times', 'Action is always stronger than reaction', 'Reaction forces disappear in motion'],
          expectedKeyPoints: ['act on different objects', 'different bodies', 'two different objects'],
        },
      ],
    };

    // Determine target question bank
    let bank = questionBank[targetTopicId];
    if (!bank) {
      if (targetTopicId.includes('vacuum') || targetTopicId.includes('tube')) {
        bank = questionBank.vacuum_tubes;
      } else if (targetTopicId.includes('first') || targetTopicId.includes('1st')) {
        bank = questionBank.first_generation;
      } else if (targetTopicId.includes('phy') || targetTopicId.includes('force') || targetTopicId.includes('newton')) {
        bank = questionBank.newton_laws;
      } else {
        bank = questionBank.second_generation;
      }
    }

    // Filter by difficulty if available, else choose appropriate question
    const matched = bank.filter(q => q.difficulty === difficulty);
    const candidateList = matched.length > 0 ? matched : bank;
    const selected = candidateList[Math.floor(Math.random() * candidateList.length)];

    const chunks = dbService.getMaterialChunksForClass(upperClassId);
    let sourceChunkId: string | undefined;
    let sourceMaterialId: string | undefined;

    if (chunks && chunks.length > 0) {
      const matchingChunk = chunks.find(c => 
        c.content.toLowerCase().includes(targetTopicId.replace(/_/g, ' ')) ||
        (concept?.name && c.content.toLowerCase().includes(concept.name.toLowerCase())) ||
        selected.expectedKeyPoints.some(kp => c.content.toLowerCase().includes(kp.toLowerCase()))
      ) || chunks[0];
      if (matchingChunk) {
        sourceChunkId = matchingChunk.id;
        sourceMaterialId = matchingChunk.materialId;
      }
    }

    return {
      ...selected,
      id: `q_${targetTopicId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      topicName: concept?.name || selected.topicName,
      sourceChunkId,
      sourceMaterialId,
    };
  }

  /**
   * Generates a progressive 5-question diagnostic calibration suite grounded in classroom subject matter.
   */
  public generateDiagnosticSuite(
    classId: string,
    studentId: string
  ): DiagnosticSession {
    const upperClassId = classId.toUpperCase();
    const existing = dbService.getActiveDiagnosticSession(upperClassId, studentId);
    if (existing) {
      return existing;
    }

    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const concepts = Object.values(graph.concepts);
    const isPhysics = upperClassId.includes('PHY') || concepts.some(c => c.name.toLowerCase().includes('force') || c.name.toLowerCase().includes('newton'));

    let questions: DiagnosticQuestion[] = [];

    if (isPhysics) {
      questions = [
        {
          id: `diag_q1_${Date.now()}`,
          index: 1,
          questionType: 'FOUNDATION',
          topicId: 'newton_laws',
          topicName: "Newton's Laws & Mechanics",
          difficulty: 'FOUNDATION',
          questionText: 'What is the net external force acting on an object that is moving in a straight line at a constant speed?',
          options: ['Zero Net Force', 'Equal to object weight', 'Increasing Force', 'Proportional to velocity'],
          expectedKeyPoints: ['zero', 'no net force', 'balanced forces', '0 N'],
          hints: ['Think about Newton\'s First Law of motion for unaccelerated objects.'],
        },
        {
          id: `diag_q2_${Date.now()}`,
          index: 2,
          questionType: 'CONCEPT',
          topicId: 'second_law',
          topicName: "Newton's Second Law (F = ma)",
          difficulty: 'EASY',
          questionText: 'State the mathematical relationship between net force, mass, and acceleration according to Newton\'s Second Law.',
          options: ['F = m * a', 'F = m / a', 'F = a / m', 'F = m + a'],
          expectedKeyPoints: ['f = ma', 'force equals mass times acceleration', 'f=ma', 'mass * acceleration'],
          hints: ['Force is directly proportional to both mass and acceleration.'],
        },
        {
          id: `diag_q3_${Date.now()}`,
          index: 3,
          questionType: 'APPLICATION',
          topicId: 'force_calculation',
          topicName: 'Force & Acceleration Calculations',
          difficulty: 'MEDIUM',
          questionText: 'A 10 kg object experiences a constant net horizontal force of 20 N. What is the acceleration of the object in m/s²?',
          options: ['2 m/s²', '200 m/s²', '0.5 m/s²', '10 m/s²'],
          expectedKeyPoints: ['2', '2 m/s^2', '2 m/s2', '2m/s'],
          hints: ['Use the formula a = F / m.'],
        },
        {
          id: `diag_q4_${Date.now()}`,
          index: 4,
          questionType: 'REASONING',
          topicId: 'inertia_mass',
          topicName: 'Inertia, Mass & Dynamics',
          difficulty: 'HARD',
          questionText: 'Why does an object with greater mass experience a smaller acceleration when subjected to the exact same net force as a lighter object?',
          options: ['Greater mass possesses greater inertia (resistance to change in velocity)', 'Mass eliminates friction', 'Heavier mass has less gravitational attraction', 'Force disappears in heavier masses'],
          expectedKeyPoints: ['inertia', 'resistance to acceleration', 'mass is inertia', 'inversely proportional'],
          hints: ['Consider how mass quantifies an object\'s inertia.'],
        },
        {
          id: `diag_q5_${Date.now()}`,
          index: 5,
          questionType: 'TRANSFER',
          topicId: 'third_law',
          topicName: "Action-Reaction & Momentum",
          difficulty: 'HARD',
          questionText: 'Explain a real-world engineering or physical scenario illustrating Newton\'s Third Law (action-reaction) during propulsion or locomotion.',
          expectedKeyPoints: ['rocket', 'propulsion', 'recoil', 'swimmer pushing water', 'action reaction', 'exhaust gases'],
          hints: ['Think of rocket engine thrust or how a swimmer pushes against water.'],
        },
      ];
    } else {
      // Computer Science / Default Syllabus
      const c1 = concepts[0]?.name || 'First Generation Vacuum Tubes';
      const c2 = concepts[1]?.name || 'Second Generation Transistors';
      const c3 = concepts[2]?.name || 'Integrated Circuits (ICs)';
      const c4 = concepts[3]?.name || 'Microprocessors & VLSI';

      questions = [
        {
          id: `diag_q1_${Date.now()}`,
          index: 1,
          questionType: 'FOUNDATION',
          topicId: concepts[0]?.id || 'first_generation',
          topicName: c1,
          difficulty: 'FOUNDATION',
          questionText: 'What was the primary electronic hardware switching component utilized in first-generation computers?',
          options: ['Vacuum Tubes', 'Transistors', 'Microprocessors', 'Magnetic Disks'],
          expectedKeyPoints: ['vacuum tubes', 'thermionic valves', 'vacuum tube'],
          hints: ['It was a glass tube device that produced significant heat and required high power.'],
        },
        {
          id: `diag_q2_${Date.now()}`,
          index: 2,
          questionType: 'CONCEPT',
          topicId: concepts[1]?.id || 'second_generation',
          topicName: c2,
          difficulty: 'EASY',
          questionText: 'Why did solid-state semiconductor transistors replace vacuum tubes in second-generation computing?',
          options: ['Transistors were smaller, faster, dissipated far less heat, and required less power', 'Transistors were made of glass bulbs', 'Transistors only processed analog signals', 'Vacuum tubes had zero failure rates'],
          expectedKeyPoints: ['smaller', 'less heat', 'less power', 'reliable', 'faster', 'solid state'],
          hints: ['Consider heat generation, physical size, reliability, and power consumption.'],
        },
        {
          id: `diag_q3_${Date.now()}`,
          index: 3,
          questionType: 'APPLICATION',
          topicId: concepts[2]?.id || 'third_generation',
          topicName: c3,
          difficulty: 'MEDIUM',
          questionText: 'In computer architecture, what key breakthrough allowed thousands of discrete transistors to be fabricated onto a single miniature semiconductor silicon chip?',
          options: ['Integrated Circuit (IC) technology', 'Magnetic Core Memory', 'Punched Card Encoding', 'High Voltage Power Supplies'],
          expectedKeyPoints: ['integrated circuit', 'ic', 'silicon chip', 'semiconductor integration'],
          hints: ['This 3rd-generation milestone integrated multiple circuit components onto one silicon substrate.'],
        },
        {
          id: `diag_q4_${Date.now()}`,
          index: 4,
          questionType: 'REASONING',
          topicId: concepts[3]?.id || 'fourth_generation',
          topicName: c4,
          difficulty: 'HARD',
          questionText: 'Explain how Very Large Scale Integration (VLSI) microprocessors enabled the transition from central room-sized mainframes to personal computing (PCs).',
          options: ['Entire CPU components integrated onto a single microchip, drastically lowering cost and physical size', 'By increasing physical room requirements', 'By replacing digital circuits with vacuum chambers', 'By eliminating programming languages'],
          expectedKeyPoints: ['single chip cpu', 'miniaturization', 'drastic cost reduction', 'personal computers', 'vlsi'],
          hints: ['VLSI combined the ALU, registers, and control unit onto a single microprocessor chip.'],
        },
        {
          id: `diag_q5_${Date.now()}`,
          index: 5,
          questionType: 'TRANSFER',
          topicId: 'fifth_generation',
          topicName: 'Fifth Generation & AI Systems',
          difficulty: 'HARD',
          questionText: 'How does modern AI and parallel supercomputing architecture build upon the evolution of previous hardware generations?',
          expectedKeyPoints: ['parallel processing', 'neural chips', 'gpu/tpu', 'ulsi', 'ultra high density', 'ai acceleration'],
          hints: ['Think of specialized parallel tensor cores, AI processors, and massive chip density.'],
        },
      ];
    }

    const chunks = dbService.getMaterialChunksForClass(upperClassId);
    
    // Annotate questions with internal source chunk provenance if available
    for (const q of questions) {
      if (chunks && chunks.length > 0) {
        const matchingChunk = chunks.find(c => 
          c.content.toLowerCase().includes(q.topicId.replace(/_/g, ' ')) ||
          c.content.toLowerCase().includes(q.topicName.toLowerCase()) ||
          q.expectedKeyPoints.some(kp => c.content.toLowerCase().includes(kp.toLowerCase()))
        ) || chunks[0];
        if (matchingChunk) {
          q.sourceChunkId = matchingChunk.id;
          q.sourceMaterialId = matchingChunk.materialId;
        }
      }
    }

    const session: DiagnosticSession = {
      sessionId: `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      studentId,
      classId: upperClassId,
      status: 'CALIBRATING',
      questions,
      answers: {},
      startedAt: new Date().toISOString(),
    };

    dbService.saveDiagnosticSession(session);
    return session;
  }

  /**
   * Saves partial progress for a single diagnostic question.
   */
  public saveQuestionAnswer(
    sessionId: string,
    submission: DiagnosticAnswerSubmission
  ): DiagnosticSession | undefined {
    const session = dbService.getDiagnosticSession(sessionId);
    if (!session) return undefined;

    const question = session.questions.find((q) => q.id === submission.questionId);
    if (!question) return session;

    const lower = (submission.answer || '').toLowerCase();
    const matched = question.expectedKeyPoints.filter((kp) => lower.includes(kp.toLowerCase()));
    const ratio = question.expectedKeyPoints.length > 0 ? matched.length / question.expectedKeyPoints.length : 0;
    
    // Check multiple choice match if options exist
    let isCorrect = ratio >= 0.4 || matched.length > 0;
    if (question.options && question.options.length > 0) {
      const correctOpt = question.options[0].toLowerCase();
      if (lower.includes(correctOpt) || lower === '0' || lower === question.options[0].toLowerCase()) {
        isCorrect = true;
      }
    }

    const score = isCorrect ? (ratio >= 0.7 ? 1.0 : 0.8) : 0.25;

    session.answers[submission.questionId] = {
      answer: submission.answer,
      isCorrect,
      score,
      timeToAnswerMs: submission.timeToAnswerMs,
      hintsUsed: submission.hintsUsed,
      submittedAt: new Date().toISOString(),
    };

    dbService.saveDiagnosticSession(session);
    return session;
  }

  /**
   * Evaluates the completed diagnostic suite, calculates scores and creates the ACTIVE profile.
   */
  public evaluateDiagnosticSuite(
    classId: string,
    studentId: string,
    sessionId: string,
    submissions: DiagnosticAnswerSubmission[]
  ): { summary: DiagnosticSummary; session: DiagnosticSession } {
    const upperClassId = classId.toUpperCase();
    let session = dbService.getDiagnosticSession(sessionId);
    if (!session) {
      session = this.generateDiagnosticSuite(upperClassId, studentId);
    }

    for (const sub of submissions) {
      this.saveQuestionAnswer(session.sessionId, sub);
    }

    // Refresh updated session from db
    session = dbService.getDiagnosticSession(session.sessionId)!;

    let foundationScore = 0.5;
    let conceptScore = 0.5;
    let applicationScore = 0.5;
    let reasoningScore = 0.5;
    let transferScore = 0.5;

    let totalScore = 0;
    let count = 0;

    for (const q of session.questions) {
      const ans = session.answers[q.id];
      const qScore = ans ? (ans.score ?? (ans.isCorrect ? 1.0 : 0.25)) : 0.25;
      totalScore += qScore;
      count++;

      if (q.questionType === 'FOUNDATION') foundationScore = qScore;
      else if (q.questionType === 'CONCEPT') conceptScore = qScore;
      else if (q.questionType === 'APPLICATION') applicationScore = qScore;
      else if (q.questionType === 'REASONING') reasoningScore = qScore;
      else if (q.questionType === 'TRANSFER') transferScore = qScore;
    }

    const overallScore = count > 0 ? Math.round((totalScore / count) * 100) / 100 : 0.5;

    let supportLevel: SupportLevel = 'COMFORTABLE';
    let pace: PreferredPace = 'COMFORTABLE';
    let strategy: PreferredExplanationStyle = 'VISUAL_STRUCTURED';

    if (overallScore >= 0.80) {
      supportLevel = 'READY_FOR_CHALLENGE';
      pace = 'ACCELERATED';
      strategy = 'DIRECT';
    } else if (overallScore < 0.55 || foundationScore < 0.5) {
      supportLevel = 'NEEDS_REINFORCEMENT';
      pace = 'GENTLE';
      strategy = 'ANALOGY_EXAMPLE';
    }

    const summary: DiagnosticSummary = {
      foundationScore,
      conceptScore,
      applicationScore,
      reasoningScore,
      transferScore,
      overallScore,
      calculatedSupportLevel: supportLevel,
      calculatedPace: pace,
      calculatedStrategy: strategy,
      evaluatedAt: new Date().toISOString(),
    };

    session.status = 'COMPLETED';
    session.completedAt = new Date().toISOString();
    dbService.saveDiagnosticSession(session);

    // Update Learner Model to ACTIVE
    learnerModelService.applyDiagnosticResults(upperClassId, studentId, session, summary);

    return { summary, session };
  }

  /**
   * Evaluates student answer, scores correctness, identifies misconceptions, and triggers learner model update.
   */
  public async evaluateAnswer(
    classId: string,
    studentId: string,
    question: MicroAssessmentQuestion,
    studentAnswer: string,
    timeToAnswerMs?: number
  ): Promise<MicroAssessmentEvaluation> {
    const upperClassId = classId.toUpperCase();
    
    // Evaluate via AnswerEvaluationService
    const evalResult = await answerEvaluatorService.evaluate({
      classId: upperClassId,
      studentId,
      question: question.questionText,
      questionType: (question.options && question.options.length > 0 ? 'MCQ' : question.type === 'APPLICATION' ? 'APPLICATION' : question.type === 'REASONING' ? 'REASONING' : question.type === 'TRANSFER' ? 'TRANSFER' : 'SHORT_ANSWER') as any,
      expectedAnswer: question.expectedKeyPoints,
      options: question.options,
      studentAnswer,
      currentTopic: question.topicId,
      topicName: question.topicName,
      timeToAnswerMs,
    });

    const isCorrect = evalResult.correctness >= 0.70;
    const score = evalResult.correctness;

    // Trigger persistent LearningEvent
    const event: LearningEventRecord = {
      id: `le_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentId,
      classId: upperClassId,
      topicId: question.topicId,
      category: 'MASTERY_CHECK',
      metrics: {
        isCorrect,
        score,
        conceptUnderstanding: evalResult.conceptUnderstanding,
        reasoningQuality: evalResult.reasoningQuality,
        application: evalResult.application,
        transfer: evalResult.transfer,
        timeToAnswerMs: timeToAnswerMs || 15000,
        difficulty: question.difficulty,
        attemptsCount: 1,
        hintsUsed: 0,
      },
      contextSummary: `Micro-assessment on ${question.topicName}: "${studentAnswer}" — ${evalResult.evidenceSummary}`,
      timestamp: new Date().toISOString(),
    };

    learnerModelService.processLearningEvent(event);

    if (evalResult.misconceptionDetected && evalResult.misconception) {
      dbService.recordMisconceptionOccurrence(
        upperClassId,
        studentId,
        question.topicId,
        question.topicName,
        'micro_assessment_misconception',
        evalResult.misconception
      );
    } else if (isCorrect) {
      dbService.resolveMisconception(upperClassId, studentId, question.topicId);
    }

    return {
      isCorrect,
      score,
      feedback: evalResult.feedback,
      identifiedMisconceptions: evalResult.misconception ? [evalResult.misconception] : [],
      suggestedFollowUp: isCorrect
        ? 'Great mastery demonstrated! Ready to continue live classroom flow.'
        : `Recommended action: ${evalResult.recommendedPedagogicalAction}. Review key relationships in ${question.topicName}.`,
    };
  }
}

export const microAssessmentService = new MicroAssessmentService();