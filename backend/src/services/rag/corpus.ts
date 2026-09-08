export interface TopicDocument {
  id: string;
  subject: 'Mathematics' | 'Physics' | 'Chemistry' | 'Biology' | 'Computer Science';
  chapter: string;
  topic: string;
  keywords: string[];
  summary: string;
  keyConcepts: string[];
  detailedExplanation: string;
  examples: string[];
  frequentlyAskedDoubts: Array<{
    question: string;
    answer: string;
  }>;
}

export const EDUCATIONAL_CORPUS: TopicDocument[] = [
  // --- MATHEMATICS ---
  {
    id: 'math-linear-equations',
    subject: 'Mathematics',
    chapter: 'Algebra',
    topic: 'Linear Equations in One Variable',
    keywords: [
      'linear equation', 'solve for x', 'variable', 'coefficient', 'constant',
      'isolate x', 'both sides', 'subtract', 'add', 'divide', 'multiply', '2x+5=0',
      '2x+3=11', '3x+6=15', 'x+7=12', '4x=16', '2x-3=7', '5x-10=20', 'transposition', 'algebra'
    ],
    summary: 'A linear equation in one variable is an equation of the form ax + b = c, where a != 0. To solve it, we isolate the variable by applying inverse operations equally to both sides.',
    keyConcepts: [
      'Additive Inverse / Transposition: Moving terms across the equals sign changes their sign (+ becomes -, - becomes +).',
      'Multiplicative Inverse: Dividing or multiplying both sides by the variable coefficient to isolate x.',
      'Equation Balance Principle: Whatever operation is performed on the left-hand side must be performed identically on the right-hand side.'
    ],
    detailedExplanation: 'To solve a linear equation like ax + b = c:\nStep 1: Subtract or add the constant term b from both sides so that terms containing x are alone on one side (ax = c - b).\nStep 2: Divide both sides by the coefficient a (x = (c - b) / a).\nStep 3: Simplify the resulting fraction or decimal to find the exact value of x.',
    examples: [
      '2x + 5 = 0 -> 2x = -5 -> x = -2.5',
      '2x + 3 = 11 -> 2x = 8 -> x = 4',
      '3x + 6 = 15 -> 3x = 9 -> x = 3',
      'x + 7 = 12 -> x = 12 - 7 -> x = 5',
      '4x = 16 -> x = 16 / 4 -> x = 4',
      '2x - 3 = 7 -> 2x = 10 -> x = 5',
      '5x - 10 = 20 -> 5x = 30 -> x = 6'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'Why do we divide by 2 or the coefficient in linear equations?',
        answer: 'Because the coefficient is multiplied by x (e.g., 2x means 2 * x). The inverse operation of multiplication is division. Dividing both sides by 2 isolates x with a coefficient of 1 (1x = x).'
      },
      {
        question: 'Why do we change the sign when moving a number across the equals sign?',
        answer: 'Transposition is a shortcut for adding or subtracting the same number from both sides. When you subtract 5 from both sides of 2x + 5 = 0, the left becomes 2x + 5 - 5 = 2x, and the right becomes 0 - 5 = -5.'
      }
    ]
  },
  {
    id: 'math-quadratic-equations',
    subject: 'Mathematics',
    chapter: 'Algebra',
    topic: 'Quadratic Equations',
    keywords: ['quadratic', 'ax2+bx+c', 'parabola', 'discriminant', 'roots', 'factoring', 'quadratic formula', 'degree 2'],
    summary: 'A quadratic equation is a second-order polynomial equation in a single variable x with the standard form ax^2 + bx + c = 0, where a != 0.',
    keyConcepts: [
      'Standard Form: ax^2 + bx + c = 0',
      'Quadratic Formula: x = (-b +- sqrt(b^2 - 4ac)) / (2a)',
      'Discriminant (D = b^2 - 4ac): If D > 0, two real roots; if D = 0, one real repeated root; if D < 0, two complex roots.'
    ],
    detailedExplanation: 'Quadratic equations can be solved using factoring, completing the square, or using the universal quadratic formula. The roots represent the x-intercepts of the parabola y = ax^2 + bx + c.',
    examples: [
      'x^2 - 5x + 6 = 0 -> (x-2)(x-3) = 0 -> x = 2 or x = 3',
      'x^2 - 4 = 0 -> (x+2)(x-2) = 0 -> x = 2 or x = -2'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'What happens when the discriminant is zero?',
        answer: 'When the discriminant (b^2 - 4ac) is zero, the quadratic equation has exactly one distinct real root (a repeated root), and the vertex of the parabola touches the x-axis.'
      }
    ]
  },
  {
    id: 'math-calculus-derivatives',
    subject: 'Mathematics',
    chapter: 'Calculus',
    topic: 'Differential Calculus and Derivatives',
    keywords: ['derivative', 'calculus', 'differentiation', 'rate of change', 'power rule', 'slope of tangent', 'd/dx', 'limits'],
    summary: 'The derivative represents the instantaneous rate of change of a function with respect to its variable, geometrically corresponding to the slope of the tangent line to the curve.',
    keyConcepts: [
      'Power Rule: d/dx [x^n] = n * x^(n-1)',
      'Product Rule: d/dx [u * v] = u\'v + uv\'',
      'Quotient Rule: d/dx [u / v] = (u\'v - uv\') / v^2',
      'Chain Rule: d/dx [f(g(x))] = f\'(g(x)) * g\'(x)'
    ],
    detailedExplanation: 'Derivatives are foundational in understanding physics, engineering, and economics by describing velocities, accelerations, optimization maxima/minima, and marginal changes.',
    examples: [
      'd/dx [x^3] = 3x^2',
      'd/dx [5x^2 + 2x - 7] = 10x + 2',
      'd/dx [sin(x)] = cos(x)'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'What is the physical meaning of a derivative?',
        answer: 'Physically, a derivative represents instantaneous rate of change. For example, the derivative of position with respect to time is instantaneous velocity, and the derivative of velocity is acceleration.'
      }
    ]
  },

  // --- PHYSICS ---
  {
    id: 'physics-newtons-laws',
    subject: 'Physics',
    chapter: 'Classical Mechanics',
    topic: "Newton's Laws of Motion",
    keywords: [
      "newton's first law", "newton's second law", "newton's third law", "inertia", "f=ma",
      "action reaction", "force", "mass", "acceleration", "momentum", "friction"
    ],
    summary: "Newton's three laws of motion describe the relationship between the motion of an object and the forces acting upon it.",
    keyConcepts: [
      "First Law (Law of Inertia): An object at rest stays at rest and an object in uniform motion stays in uniform motion unless acted upon by a net external force.",
      "Second Law (Force Law): The net force acting on an object is directly proportional to its rate of change of momentum, simplified as F = ma (Force = mass * acceleration).",
      "Third Law (Action-Reaction): For every action force, there is an equal and opposite reaction force acting on different interacting bodies."
    ],
    detailedExplanation: "Newton's Laws form the foundation of classical mechanics. The first law defines inertial reference frames; the second provides a quantitative method to compute acceleration given net force; the third highlights that forces always occur in mutual interaction pairs.",
    examples: [
      'A passenger jolting forward when a bus suddenly brakes illustrates the First Law (inertia of motion).',
      'Pushing a 5 kg box with a 20 N net force produces an acceleration of a = F/m = 20/5 = 4 m/s^2 (Second Law).',
      'A rocket propelling exhaust gases downward experiences an equal thrust force upward (Third Law).'
    ],
    frequentlyAskedDoubts: [
      {
        question: "Why don't action and reaction forces cancel each other out?",
        answer: "Action and reaction forces never cancel each other because they act on two entirely different objects. For instance, when you jump, you push down on the Earth (force on Earth), and the Earth pushes up on you (force on you)."
      },
      {
        question: "Can you explain Newton's first law?",
        answer: "Newton's First Law states that an object will remain at rest or continue moving at a constant velocity in a straight line unless an external net force acts on it. This property is known as inertia."
      }
    ]
  },
  {
    id: 'physics-work-energy',
    subject: 'Physics',
    chapter: 'Mechanics',
    topic: 'Work, Energy, and Power',
    keywords: ['work', 'kinetic energy', 'potential energy', 'power', 'conservation of energy', 'joule', 'watt', '1/2mv^2', 'mgh'],
    summary: 'Work is energy transferred by a force acting over a displacement. The total mechanical energy (kinetic + potential) in an isolated conservative system remains constant.',
    keyConcepts: [
      'Work Done: W = F * d * cos(theta), measured in Joules (J).',
      'Kinetic Energy (KE): KE = 1/2 * m * v^2.',
      'Gravitational Potential Energy (PE): PE = m * g * h.',
      'Work-Energy Theorem: Net work done on an object equals the change in its kinetic energy (W_net = Delta KE).'
    ],
    detailedExplanation: 'Energy cannot be created or destroyed, only transformed between forms. When an object falls, potential energy converts into kinetic energy while mechanical energy is conserved in the absence of air drag.',
    examples: [
      'A 2 kg ball moving at 3 m/s has KE = 1/2 * 2 * (3^2) = 9 Joules.',
      'Lifting a 10 kg box to a height of 5 m requires W = mgh = 10 * 9.8 * 5 = 490 Joules.'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'Is work done when carrying a heavy load and walking horizontally?',
        answer: 'In physics, if the lifting force is vertical and displacement is horizontal, theta = 90 degrees, so cos(90) = 0. Therefore, mechanical work done by the vertical lifting force on the load is 0 Joules.'
      }
    ]
  },
  {
    id: 'physics-thermodynamics',
    subject: 'Physics',
    chapter: 'Thermal Physics',
    topic: 'Laws of Thermodynamics',
    keywords: ['thermodynamics', 'heat', 'temperature', 'entropy', 'first law', 'second law', 'internal energy', 'carnot cycle'],
    summary: 'Thermodynamics governs heat, work, temperature, and energy transformations across systems.',
    keyConcepts: [
      'Zeroth Law: Defines thermal equilibrium and temperature.',
      'First Law: Conservation of energy: Delta U = Q - W (change in internal energy = heat added minus work done).',
      'Second Law: Total entropy of an isolated system always increases over time; heat flows spontaneously from hot to cold.'
    ],
    detailedExplanation: 'The laws of thermodynamics limit the efficiency of real-world engines and define the arrow of time through the irreversible increase of entropy.',
    examples: [
      'A refrigerator requires electrical work input to transfer heat from a cold interior to a warmer room.',
      'Expanding steam in a cylinder does work on a piston by converting thermal energy into mechanical work.'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'Can an engine ever achieve 100% thermal efficiency?',
        answer: 'No, according to the Second Law of Thermodynamics (Carnot theorem), no heat engine operating between two temperatures can ever achieve 100% efficiency because some heat must always be rejected to a cold sink.'
      }
    ]
  },

  // --- CHEMISTRY ---
  {
    id: 'chem-periodic-table',
    subject: 'Chemistry',
    chapter: 'Inorganic Chemistry',
    topic: 'Periodic Table & Periodic Trends',
    keywords: ['periodic table', 'electronegativity', 'ionization energy', 'atomic radius', 'valence electrons', 'metals', 'nonmetals', 'groups', 'periods'],
    summary: 'The periodic table arranges chemical elements by atomic number, organizing recurring trends in atomic size, ionization energy, and chemical reactivity.',
    keyConcepts: [
      'Atomic Radius: Decreases from left to right across a period; increases from top to bottom down a group.',
      'Ionization Energy: Energy needed to remove an electron. Increases across a period, decreases down a group.',
      'Electronegativity: Ability of an atom to attract shared electrons in a bond. Fluorine is the most electronegative element.'
    ],
    detailedExplanation: 'Periodic trends arise from effective nuclear charge and electron shielding. Across a period, increasing nuclear charge pulls electrons closer, shrinking atomic radius and raising ionization energy.',
    examples: [
      'Sodium (Na) easily loses 1 valence electron to form Na+, whereas Chlorine (Cl) readily gains 1 electron to form Cl-.',
      'Noble gases (Group 18) have full valence shells (octet) and are chemically inert.'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'Why does atomic radius decrease across a period?',
        answer: 'Across a period from left to right, protons are added to the nucleus while electrons are added to the same energy level. The greater nuclear charge pulls the electron cloud closer to the nucleus, reducing atomic radius.'
      }
    ]
  },
  {
    id: 'chem-chemical-bonding',
    subject: 'Chemistry',
    chapter: 'General Chemistry',
    topic: 'Chemical Bonding (Ionic, Covalent, Metallic)',
    keywords: ['chemical bond', 'ionic bond', 'covalent bond', 'metallic bond', 'octet rule', 'lewis structure', 'polar', 'nonpolar'],
    summary: 'Chemical bonds are attractive forces holding atoms or ions together to achieve stable valence electron configurations.',
    keyConcepts: [
      'Ionic Bonding: Complete transfer of valence electrons from a metal to a non-metal, creating oppositely charged ions (e.g., NaCl).',
      'Covalent Bonding: Sharing of electron pairs between non-metal atoms (e.g., H2O, CO2, CH4).',
      'Metallic Bonding: Sea of delocalized electrons shared among positive metal cation cores, explaining electrical conductivity and malleability.'
    ],
    detailedExplanation: 'Atoms bond to lower their potential energy and attain full outer shells (octet rule). Differences in electronegativity determine whether a bond is nonpolar covalent (<= 0.4), polar covalent (0.5 - 1.7), or ionic (> 1.7).',
    examples: [
      'NaCl (table salt) is an ionic crystal lattice held by strong electrostatic attractions.',
      'H2O is a polar covalent molecule where oxygen draws electron density more strongly than hydrogen.'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'What is the main difference between ionic and covalent bonds?',
        answer: 'Ionic bonds form through the complete transfer of electrons between atoms with large electronegativity differences (metal + nonmetal), while covalent bonds form through mutual sharing of electron pairs between nonmetals.'
      }
    ]
  },
  {
    id: 'chem-acids-bases',
    subject: 'Chemistry',
    chapter: 'Physical Chemistry',
    topic: 'Acids, Bases, and pH Scale',
    keywords: ['acid', 'base', 'ph scale', 'neutralization', 'hydrogen ion', 'hydroxide', 'bronsted-lowry', 'buffer', 'h+', 'oh-'],
    summary: 'Acids donate protons (H+) in aqueous solutions, while bases accept protons or release hydroxide ions (OH-). The pH scale measures hydrogen ion concentration from 0 to 14.',
    keyConcepts: [
      'pH Definition: pH = -log10[H+]. Neutral water has pH = 7.0 at 25°C.',
      'Acidic vs Basic: pH < 7 is acidic; pH > 7 is basic/alkaline.',
      'Neutralization: Acid + Base -> Salt + Water (e.g., HCl + NaOH -> NaCl + H2O).'
    ],
    detailedExplanation: 'Strong acids (like HCl, HNO3, H2SO4) dissociate completely in water, while weak acids (like acetic acid CH3COOH) only partially ionize in equilibrium.',
    examples: [
      'Stomach acid (HCl) has a pH of ~1.5 to 2.0 to digest proteins.',
      'Bleach and ammonia are household bases with pH > 11.'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'What happens when you mix an acid and a base?',
        answer: 'They undergo a neutralization reaction where H+ ions from the acid react with OH- ions from the base to produce neutral water (H2O) and an ionic salt.'
      }
    ]
  },

  // --- BIOLOGY ---
  {
    id: 'bio-photosynthesis',
    subject: 'Biology',
    chapter: 'Plant Physiology',
    topic: 'Photosynthesis & Cellular Respiration',
    keywords: [
      'photosynthesis', 'chloroplast', 'chlorophyll', 'calvin cycle', 'light reaction',
      'glucose', 'carbon dioxide', 'oxygen', 'atp', '6co2+6h2o', 'plants'
    ],
    summary: 'Photosynthesis is the biochemical process by which photoautotrophic organisms (plants, algae) convert light energy into chemical energy stored in glucose molecules.',
    keyConcepts: [
      'Overall Chemical Equation: 6CO2 + 6H2O + Light Energy -> C6H12O6 + 6O2',
      'Light-Dependent Reactions: Occur in the thylakoid membranes of chloroplasts; produce ATP, NADPH, and release oxygen by splitting water.',
      'Light-Independent Reactions (Calvin Cycle): Occur in the stroma; use ATP and NADPH to fix CO2 into glucose sugars.'
    ],
    detailedExplanation: 'Photosynthesis powers almost all life on Earth by converting solar energy into biological biomass and supplying breathable atmospheric oxygen. Chlorophyll pigments primarily absorb blue and red wavelengths while reflecting green light.',
    examples: [
      'Plant leaves appear green because chlorophyll pigments absorb red and blue photons while reflecting green wavelengths.',
      'Guard cells regulate stomata on leaf surfaces to balance CO2 intake with water vapor loss via transpiration.'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'What is photosynthesis?',
        answer: 'Photosynthesis is the process by which green plants and certain other organisms use sunlight to synthesize nutrients from carbon dioxide and water. Its balanced equation is 6CO2 + 6H2O + Light -> C6H12O6 + 6O2, generating glucose for energy and releasing oxygen as a byproduct.'
      },
      {
        question: 'Do plants perform photosynthesis at night?',
        answer: 'The light-dependent reactions require active sunlight and stop at night. However, plants continue cellular respiration 24/7, consuming small amounts of oxygen to break down stored glucose for ATP.'
      }
    ]
  },
  {
    id: 'bio-cell-biology',
    subject: 'Biology',
    chapter: 'Cellular Biology',
    topic: 'Cell Structure and Organelles',
    keywords: ['cell', 'mitochondria', 'nucleus', 'ribosome', 'membrane', 'cytoplasm', 'plant cell', 'animal cell', 'organelle', 'atp'],
    summary: 'The cell is the basic structural and functional unit of all known living organisms. Organelles within eukaryotic cells compartmentalize biochemical functions.',
    keyConcepts: [
      'Nucleus: Houses genetic material (DNA) and coordinates gene expression and replication.',
      'Mitochondria: Powerhouse of the cell, generating ATP via cellular respiration and the Krebs cycle.',
      'Chloroplasts & Cell Wall: Found uniquely in plant cells (along with large central vacuoles) providing structure and photosynthetic capacity.'
    ],
    detailedExplanation: 'Eukaryotic cells possess membrane-bound organelles allowing specialized microenvironments, whereas prokaryotic cells (bacteria) lack a true nucleus and membrane-bound organelles.',
    examples: [
      'Muscle cells contain high concentrations of mitochondria to produce sufficient ATP for contraction.',
      'Plant cells have rigid cellulose walls that prevent cell lysis in hypotonic environments.'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'Why are mitochondria called the powerhouse of the cell?',
        answer: 'Mitochondria are called the powerhouse of the cell because they perform aerobic cellular respiration, converting glucose and oxygen into Adenosine Triphosphate (ATP), the primary energy currency of biochemical processes.'
      }
    ]
  },
  {
    id: 'bio-dna-genetics',
    subject: 'Biology',
    chapter: 'Genetics',
    topic: 'DNA Structure, Replication, and Protein Synthesis',
    keywords: ['dna', 'rna', 'gene', 'genetics', 'double helix', 'nucleotide', 'transcription', 'translation', 'chromosome', 'mutation'],
    summary: 'DNA (Deoxyribonucleic Acid) carries hereditary genetic blueprints in a double-helix structure made of adenine, thymine, cytosine, and guanine base pairs.',
    keyConcepts: [
      'Complementary Base Pairing: Adenine (A) pairs with Thymine (T) via 2 hydrogen bonds; Guanine (G) pairs with Cytosine (C) via 3 hydrogen bonds.',
      'Central Dogma of Molecular Biology: DNA -> (Transcription) -> mRNA -> (Translation) -> Protein.',
      'Codon System: Triplets of mRNA nucleotides specify individual amino acids assembled into polypeptide protein chains by ribosomes.'
    ],
    detailedExplanation: 'Watson and Crick described the antiparallel double-helix structure. Semi-conservative replication ensures faithful transmission of genetic information across cell generations.',
    examples: [
      'If a DNA template strand has sequence 5\'-ATCG-3\', its complementary strand is 3\'-TAGC-5\'.',
      'Sickle cell anemia is caused by a single point mutation in the beta-globin gene substituting valine for glutamic acid.'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'What is the difference between DNA and RNA?',
        answer: 'DNA contains deoxyribose sugar, is double-stranded, and uses Thymine (A-T), whereas RNA contains ribose sugar, is usually single-stranded, and uses Uracil instead of Thymine (A-U).'
      }
    ]
  },

  // --- COMPUTER SCIENCE ---
  {
    id: 'cs-data-structures',
    subject: 'Computer Science',
    chapter: 'Data Structures & Algorithms',
    topic: 'Fundamental Data Structures (Stack, Queue, Array, Linked List) and Big-O Complexity',
    keywords: ['data structures', 'array', 'linked list', 'stack', 'queue', 'lifo', 'fifo', 'binary search tree', 'hash table', 'big o', 'complexity', 'time complexity'],
    summary: 'Data structures organize and store data for efficient access and modification. A Stack follows LIFO (Last In First Out), while a Queue follows FIFO (First In First Out). Big-O notation measures algorithmic time and space scalability.',
    keyConcepts: [
      'Array vs Linked List: Arrays provide O(1) random access by index but O(n) arbitrary insertions; linked lists offer O(1) pointer-based insertion once located.',
      'Stack & Queue: Stack operates LIFO (Last In First Out); Queue operates FIFO (First In First Out).',
      'Hash Table: Provides average O(1) lookup, insertion, and deletion using hash functions with collision handling.'
    ],
    detailedExplanation: 'Choosing the optimal data structure is critical for software engineering performance. Fast lookups benefit from hash maps and balanced trees (O(log n)), while sequential streaming fits queues and ring buffers.',
    examples: [
      'Browser back-forward history is implemented using two Stacks.',
      'A printer queue or web server request pool uses a FIFO Queue.'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'What is Big-O notation?',
        answer: 'Big-O notation describes the upper bound of the growth rate of an algorithm\'s running time or memory usage as the input size n increases, representing worst-case performance.'
      },
      {
        question: 'What is a stack in data structures?',
        answer: 'A stack is a linear data structure that follows the Last-In, First-Out (LIFO) principle. Elements can only be added (pushed) or removed (popped) from the top of the stack, similar to a stack of plates.'
      }
    ]
  },

  // --- GENERAL SCIENCE & PHYSICS FUNDAMENTALS ---
  {
    id: 'sci-general-science',
    subject: 'Physics',
    chapter: 'General Science',
    topic: 'Nature of Science & Scientific Method',
    keywords: ['science', 'what is science', 'scientific method', 'observation', 'experiment', 'hypothesis', 'empirical', 'theory'],
    summary: 'Science is the systematic study of the structure and behavior of the physical and natural world through observation, experimentation, and testing of theories against evidence.',
    keyConcepts: [
      'Empirical Observation: Gathering evidence through verifiable sensory experience or instruments.',
      'Scientific Method: Question -> Hypothesis -> Experimentation -> Analysis -> Conclusion.',
      'Falsifiability: Scientific claims must be testable and capable of being proven false by empirical data.'
    ],
    detailedExplanation: 'Science divides into major branches: Physical Sciences (Physics, Chemistry, Astronomy), Life Sciences (Biology, Zoology, Botany), and Earth Sciences (Geology, Meteorology). It relies on continuous refinement of hypotheses into predictive laws and theories.',
    examples: [
      'Formulating a hypothesis that plants grow faster under blue light, testing with controlled experiments, and measuring stem length.',
      'Discovering penicillin through systematic observation of bacterial culture contamination.'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'What is science?',
        answer: 'Science is the systematic study of the natural world through observation, experimentation, and evidence.'
      }
    ]
  },
  {
    id: 'physics-gravity',
    subject: 'Physics',
    chapter: 'Gravitation',
    topic: 'Gravity and Universal Gravitation',
    keywords: ['gravity', 'what is gravity', 'gravitation', 'gravitational force', '9.8', 'free fall', 'weight', 'mass', 'newton universal gravitation'],
    summary: 'Gravity is the universal fundamental force of attraction that acts between all objects with mass. On Earth, it accelerates falling objects at approximately 9.8 m/s^2.',
    keyConcepts: [
      'Universal Law of Gravitation: F = G * (m1 * m2) / r^2, where G is the gravitational constant.',
      'Weight vs Mass: Mass is the amount of matter (kg), while weight is the gravitational force acting on that mass (W = mg, in Newtons).',
      'Acceleration due to Gravity: Near Earth\'s surface, g ≈ 9.8 m/s^2 regardless of the object\'s mass (ignoring air resistance).'
    ],
    detailedExplanation: 'In classical physics, Newton described gravity as an invisible pulling force proportional to mass and inversely proportional to the square of distance. In modern physics, Einstein\'s General Relativity explains gravity as the curvature of spacetime caused by mass and energy.',
    examples: [
      'An apple falling to the ground because Earth\'s mass pulls it downward with acceleration g = 9.8 m/s^2.',
      'The Moon orbiting Earth because Earth\'s gravity provides the necessary centripetal force.'
    ],
    frequentlyAskedDoubts: [
      {
        question: 'What is gravity?',
        answer: 'Gravity is the fundamental force of attraction between objects with mass. On Earth, gravity accelerates objects downward at approximately 9.8 m/s².'
      },
      {
        question: 'Do heavy objects fall faster than light objects?',
        answer: 'In a vacuum (without air resistance), all objects accelerate at the exact same rate (9.8 m/s²) and hit the ground simultaneously, regardless of their mass.'
      }
    ]
  }
];
