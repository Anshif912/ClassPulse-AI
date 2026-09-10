import { dbService } from '../db.service';
import { conceptGraphService } from './conceptGraphService';
import { learnerModelService } from './learnerModelService';
import { MinimumLearningBridge, PrerequisiteGap } from './types';

export class BridgeGeneratorService {
  /**
   * Generates the Minimum Personalized Learning Bridge for a student relative to the live teacher topic.
   */
  public generateBridge(classId: string, studentId: string): MinimumLearningBridge {
    const upperClassId = classId.toUpperCase();
    const profile = learnerModelService.getOrInitializeProfile(upperClassId, studentId);
    const graph = conceptGraphService.getOrBuildConceptGraph(upperClassId);
    const liveState = dbService.getClassroomLearningState(upperClassId);

    // 1. Determine Live Teacher Topic & Student Frontier
    const firstConcept = Object.values(graph.concepts)[0];
    const secondConcept = Object.values(graph.concepts)[1] || firstConcept;
    const defaultLiveId = secondConcept?.id || firstConcept?.id || 'newton_second_law';
    const defaultFrontierId = firstConcept?.id || 'intro_motion_force';

    const liveTopicId = liveState?.currentLiveTopic && graph.concepts[liveState.currentLiveTopic]
      ? liveState.currentLiveTopic
      : defaultLiveId;
    const liveTopicConcept = graph.concepts[liveTopicId] || secondConcept || firstConcept;
    
    const personalFrontierId = profile.personalLearningFrontier && graph.concepts[profile.personalLearningFrontier]
      ? profile.personalLearningFrontier
      : (profile.currentTopic && graph.concepts[profile.currentTopic] ? profile.currentTopic : defaultFrontierId);
    const personalFrontierConcept = graph.concepts[personalFrontierId] || firstConcept;

    // 2. Identify Prerequisites for Live Topic
    const gaps: PrerequisiteGap[] = [];
    let isQuickCatchup = true;

    for (const prereqId of liveTopicConcept.prerequisiteIds) {
      const prereqConcept = graph.concepts[prereqId];
      if (prereqConcept) {
        const pMastery = learnerModelService.getOrInitializeTopicMastery(
          upperClassId,
          studentId,
          prereqId,
          prereqConcept.name
        );

        if (pMastery.masteryScore < 0.65) {
          isQuickCatchup = false;
          gaps.push({
            prerequisiteTopicId: prereqId,
            prerequisiteTopicName: prereqConcept.name,
            currentMastery: pMastery.masteryScore,
            requiredMastery: 0.70,
            gapSeverity: pMastery.masteryScore < 0.40 ? 'SEVERE' : 'MODERATE',
          });
        }
      }
    }

    // 3. Assemble Minimum Learning Bridge Summary
    let bridgeSummary = '';
    let estimatedDurationSec = 25;

    if (isQuickCatchup || gaps.length === 0) {
      estimatedDurationSec = 20;
      bridgeSummary = `You are caught up on the prerequisites for ${liveTopicConcept.name}! Quick transition: In the earlier part of class, we established ${personalFrontierConcept.name}. Now the teacher is focusing on ${liveTopicConcept.name}.`;
    } else {
      estimatedDurationSec = gaps.length * 30 + 15;
      const gapNames = gaps.map((g) => g.prerequisiteTopicName).join(' and ');
      const gapSummaries = gaps
        .map((g) => graph.concepts[g.prerequisiteTopicId]?.summary)
        .filter(Boolean)
        .join(' ');
      bridgeSummary = `To follow the live discussion on ${liveTopicConcept.name}, here is the essential bridge: Before this, the class discussed ${gapNames}. Key takeaway: ${gapSummaries || `${gapNames} provides the essential foundational concepts needed for ${liveTopicConcept.name}.`}`;
    }

    return {
      studentId,
      classId: upperClassId,
      liveTopicId: liveTopicConcept.id,
      liveTopicName: liveTopicConcept.name,
      personalFrontierTopicId: personalFrontierConcept.id,
      personalFrontierTopicName: personalFrontierConcept.name,
      missedClassDurationMinutes: isQuickCatchup ? 0 : 20,
      learningDebt: gaps.map((g) => g.prerequisiteTopicName),
      learningDebtGaps: gaps,
      bridgeSummary,
      estimatedDurationSec,
      isQuickCatchup,
    };
  }
}

export const bridgeGeneratorService = new BridgeGeneratorService();
