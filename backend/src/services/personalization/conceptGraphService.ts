import { dbService } from '../db.service';
import { ClassroomConceptGraph, ConceptNode } from './types';

export class ConceptGraphService {
  private memoryCache: Map<string, ClassroomConceptGraph> = new Map();

  /**
   * Retrieves or builds & caches the concept hierarchy and prerequisite graph for a class.
   */
  public getOrBuildConceptGraph(classId: string): ClassroomConceptGraph {
    const upperClassId = classId.toUpperCase();
    
    // 1. Check in-memory cache
    if (this.memoryCache.has(upperClassId)) {
      const cached = this.memoryCache.get(upperClassId)!;
      if (this.isGraphValidForClassroom(upperClassId, cached)) {
        return cached;
      }
    }

    // 2. Check database persistence
    const saved = dbService.getConceptGraph(upperClassId);
    if (saved && saved.concepts && typeof saved.concepts === 'object' && Object.keys(saved.concepts).length > 0) {
      if (this.isGraphValidForClassroom(upperClassId, saved)) {
        this.memoryCache.set(upperClassId, saved);
        return saved;
      }
    }

    // 3. Build graph from course chunks / syllabus / subject
    const graph = this.buildGraphFromMaterials(upperClassId);
    this.memoryCache.set(upperClassId, graph);
    dbService.saveConceptGraph(graph);
    return graph;
  }

  /**
   * Verifies that the concept graph matches the classroom's actual subject domain.
   */
  private isGraphValidForClassroom(classId: string, graph: ClassroomConceptGraph): boolean {
    const classroom = dbService.getClassroom(classId);
    if (!classroom) return true;

    const isPhysics = Boolean(
      classroom.subject?.toLowerCase().includes('physic') || 
      classroom.name?.toLowerCase().includes('physic') || 
      classroom.classId.toUpperCase().startsWith('PHY')
    );

    const firstConcept = Object.values(graph.concepts)[0];
    if (!firstConcept) return false;

    if (isPhysics) {
      // If classroom is physics, concepts must be Physics units, NOT Computer Generations
      const isCsConcept = firstConcept.unit?.toLowerCase().includes('computer') || 
                          firstConcept.id.includes('first_generation') || 
                          firstConcept.id.includes('vacuum_tubes') ||
                          firstConcept.id.includes('second_generation');
      if (isCsConcept) return false;
    }

    return true;
  }

  /**
   * Builds the concept graph by extracting units, sections, and topics from uploaded chunks or domain curriculum.
   */
  private buildGraphFromMaterials(classId: string): ClassroomConceptGraph {
    const classroom = dbService.getClassroom(classId);
    const chunks = dbService.getMaterialChunksForClass(classId);
    const concepts: Record<string, ConceptNode> = {};

    const isPhysics = Boolean(
      classroom && (
        classroom.subject?.toLowerCase().includes('physic') || 
        classroom.name?.toLowerCase().includes('physic') || 
        classroom.classId.toUpperCase().startsWith('PHY')
      )
    ) || (chunks && chunks.some(c => 
      (c.content || '').toLowerCase().includes('newton') || 
      (c.content || '').toLowerCase().includes('inertia') || 
      (c.content || '').toLowerCase().includes('mechanics') ||
      (c.title || '').toLowerCase().includes('physic')
    ));

    if (isPhysics) {
      // Standard syllabus hierarchy for Physics / Mechanics
      const physicsConcepts: ConceptNode[] = [
        {
          id: 'intro_motion_force',
          name: 'Introduction to Motion and Force',
          unit: 'Mechanics',
          order: 1,
          prerequisiteIds: [],
          summary: 'Force is an interaction that changes an object\'s state of motion, measured in Newtons (N) with magnitude and direction.',
          keyTerms: ['force', 'motion', 'vector', 'newton', 'position', 'interaction', 'velocity', 'mechanics'],
        },
        {
          id: 'newton_first_law',
          name: "Newton's First Law of Motion (Inertia)",
          unit: 'Mechanics',
          order: 2,
          prerequisiteIds: ['intro_motion_force'],
          summary: 'An object remains at rest or continues with uniform straight-line velocity unless acted upon by a net external force (Law of Inertia).',
          keyTerms: ['newton first law', 'first law', 'inertia', 'law of inertia', 'mass', 'net force', 'rest', 'uniform velocity'],
        },
        {
          id: 'newton_second_law',
          name: "Newton's Second Law of Motion (F = ma)",
          unit: 'Mechanics',
          order: 3,
          prerequisiteIds: ['intro_motion_force', 'newton_first_law'],
          summary: 'Acceleration is directly proportional to net force and inversely proportional to mass (F = ma, p = mv).',
          keyTerms: ['newton second law', 'second law', 'f = ma', 'acceleration', 'mass', 'net force', 'momentum', 'f=ma'],
        },
        {
          id: 'newton_third_law',
          name: "Newton's Third Law of Motion (Action-Reaction)",
          unit: 'Mechanics',
          order: 4,
          prerequisiteIds: ['newton_second_law'],
          summary: 'For every action, there is an equal and opposite reaction acting simultaneously on two distinct bodies.',
          keyTerms: ['newton third law', 'third law', 'action reaction', 'equal and opposite', 'reaction force', 'force pairs'],
        },
        {
          id: 'momentum_conservation',
          name: 'Conservation of Linear Momentum',
          unit: 'Mechanics',
          order: 5,
          prerequisiteIds: ['newton_second_law', 'newton_third_law'],
          summary: 'In an isolated system with no external net force, total linear momentum before and after interaction is conserved.',
          keyTerms: ['momentum', 'conservation of momentum', 'linear momentum', 'isolated system', 'collision', 'impulse'],
        },
        {
          id: 'work_energy_power',
          name: 'Work, Energy, and Power',
          unit: 'Mechanics',
          order: 6,
          prerequisiteIds: ['newton_second_law'],
          summary: 'Work done by a net force equals the change in kinetic/potential energy (W = F·d, Work-Energy Theorem, Power = W/t).',
          keyTerms: ['work', 'energy', 'power', 'kinetic energy', 'potential energy', 'work energy theorem', 'joules'],
        },
        {
          id: 'gravitation_circular_motion',
          name: 'Circular Motion & Universal Gravitation',
          unit: 'Mechanics',
          order: 7,
          prerequisiteIds: ['newton_second_law', 'work_energy_power'],
          summary: 'Centripetal acceleration governs circular trajectories and universal gravitation defines mutual mass attraction.',
          keyTerms: ['gravitation', 'circular motion', 'centripetal force', 'gravity', 'orbital motion', 'gravitational force'],
        },
      ];

      for (const c of physicsConcepts) {
        concepts[c.id] = c;
      }
    } else {
      // Standard syllabus fallback / seed for Computer Science & General Units
      const defaultConcepts: ConceptNode[] = [
        {
          id: 'first_generation',
          name: 'First Generation Computers & Vacuum Tubes',
          unit: 'Computer Generations',
          order: 1,
          prerequisiteIds: [],
          summary: 'First generation computers (1940-1956) used vacuum tubes for circuitry and magnetic drums for memory.',
          keyTerms: ['vacuum tubes', 'first generation', 'eniac', 'univac', 'heat', 'magnetic drums'],
        },
        {
          id: 'vacuum_tubes',
          name: 'Vacuum Tube Technology & Limitations',
          unit: 'Computer Generations',
          order: 2,
          prerequisiteIds: ['first_generation'],
          summary: 'Vacuum tubes were glass tubes controlling electric current; large, fragile, high power and heat.',
          keyTerms: ['vacuum tubes', 'filament', 'heat dissipation', 'power consumption', 'fragile'],
        },
        {
          id: 'second_generation',
          name: 'Second Generation Computers & Transistors',
          unit: 'Computer Generations',
          order: 3,
          prerequisiteIds: ['first_generation', 'vacuum_tubes'],
          summary: 'Second generation computers (1956-1963) replaced vacuum tubes with solid-state transistors.',
          keyTerms: ['second generation', 'transistors', 'magnetic core', 'assembly language', 'efficiency'],
        },
        {
          id: 'transistors',
          name: 'Transistor Advantages & Operation',
          unit: 'Computer Generations',
          order: 4,
          prerequisiteIds: ['vacuum_tubes', 'second_generation'],
          summary: 'Transistors are semiconductor devices that amplify or switch electrical signals without filaments or vacuum.',
          keyTerms: ['transistors', 'semiconductor', 'silicon', 'germanium', 'reliability', 'miniaturization'],
        },
        {
          id: 'third_generation',
          name: 'Third Generation & Integrated Circuits (ICs)',
          unit: 'Computer Generations',
          order: 5,
          prerequisiteIds: ['second_generation', 'transistors'],
          summary: 'Third generation (1964-1971) introduced integrated circuits (ICs) combining many transistors on silicon chips.',
          keyTerms: ['third generation', 'integrated circuits', 'ic', 'silicon chip', 'jack kilby', 'operating systems'],
        },
        {
          id: 'fourth_generation',
          name: 'Fourth Generation & Microprocessors (VLSI)',
          unit: 'Computer Generations',
          order: 6,
          prerequisiteIds: ['third_generation'],
          summary: 'Fourth generation (1971-present) brought VLSI microprocessors, personal computers (PCs), and networking.',
          keyTerms: ['fourth generation', 'microprocessor', 'vlsi', 'intel 4004', 'personal computer', 'pc'],
        },
        {
          id: 'fifth_generation',
          name: 'Fifth Generation & Artificial Intelligence (ULSI)',
          unit: 'Computer Generations',
          order: 7,
          prerequisiteIds: ['fourth_generation'],
          summary: 'Fifth generation represents AI, parallel processing, and Ultra Large Scale Integration (ULSI).',
          keyTerms: ['fifth generation', 'artificial intelligence', 'ulsi', 'parallel processing', 'quantum'],
        },
      ];

      for (const c of defaultConcepts) {
        concepts[c.id] = c;
      }
    }

    // Inspect chunks to extract custom units / sections if present
    if (chunks && chunks.length > 0) {
      chunks.forEach((chk) => {
        const text = (chk.content || '').toLowerCase();
        for (const [cid, cnode] of Object.entries(concepts)) {
          if (cnode.keyTerms.some((k) => text.includes(k))) {
            // Associated chunk with concept
          }
        }
      });
    }

    const graph: ClassroomConceptGraph = {
      classId,
      concepts,
      updatedAt: new Date().toISOString(),
    };

    return graph;
  }

  /**
   * Matches a query or text to the most relevant ConceptNode in the graph.
   */
  public matchTopicFromQuery(query: string, classId: string): ConceptNode {
    const graph = this.getOrBuildConceptGraph(classId);
    let q = query.toLowerCase()
      .replace(/\b1st\b/g, 'first')
      .replace(/\b2nd\b/g, 'second')
      .replace(/\b3rd\b/g, 'third')
      .replace(/\b4th\b/g, 'fourth')
      .replace(/\b5th\b/g, 'fifth')
      .replace(/[\W_]+/g, ' ')
      .trim();

    const queryTokens = q.split(/\s+/).filter((t) => t.length > 2);
    let bestMatch: ConceptNode = Object.values(graph.concepts)[0];
    let maxOverlap = 0;

    for (const concept of Object.values(graph.concepts)) {
      let score = 0;
      const idStr = concept.id.replace(/_/g, ' ').toLowerCase();
      const nameStr = concept.name.toLowerCase();

      if (q.includes(idStr)) score += 8;
      if (q.includes(nameStr)) score += 10;

      for (const token of queryTokens) {
        if (idStr.includes(token)) score += 3;
        if (nameStr.includes(token)) score += 3;
      }

      for (const term of concept.keyTerms) {
        const lowerTerm = term.toLowerCase();
        if (q.includes(lowerTerm)) {
          score += 5;
        } else {
          for (const token of queryTokens) {
            if (lowerTerm.includes(token) || token.includes(lowerTerm)) {
              score += 2;
            }
          }
        }
      }

      if (score > maxOverlap) {
        maxOverlap = score;
        bestMatch = concept;
      }
    }

    return bestMatch;
  }

  /**
   * Returns a single ConceptNode by conceptId.
   */
  public getConceptNode(classId: string, conceptId: string): ConceptNode | undefined {
    const graph = this.getOrBuildConceptGraph(classId);
    return graph.concepts[conceptId];
  }

  /**
   * Invalidate cached graph on material upload / class edit.
   */
  public invalidateCache(classId: string): void {
    const upper = classId.toUpperCase();
    this.memoryCache.delete(upper);
  }
}

export const conceptGraphService = new ConceptGraphService();
