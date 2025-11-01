// Copyright (c) 2025 naruya
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import {
  GreetingInteraction,
  DancePartyInteraction,
  ChickenDanceInteraction,
  ListeningInteraction,
  PointingInteraction,
  WarriorPoseInteraction,
  DizzySpinInteraction,
  FlyingDreamInteraction,
  ShrugInteraction,
  CombatTrainingInteraction,
  HappyMeetingInteraction,
  BreathingExerciseInteraction,
  WalkTogetherInteraction,
  MorningGreetingInteraction,
  EveningGoodbyeInteraction,
  NearHouseMeetingInteraction,
  FarDistanceWaveInteraction,
  CircleDanceInteraction,
  MutualPointingInteraction,
  NightSkyGazingInteraction,
  FlyingShowInteraction,
  ListeningCircleInteraction,
  WarriorCombatInteraction,
  RelaxBreakInteraction,
  MixedDancePartyInteraction
} from './interaction.js';

export class InteractionManager {
  constructor(gvrms, walkers, context) {
    this.gvrms = gvrms;
    this.walkers = walkers;
    this.context = context; // { timeOfDay, centerHouse, camera, showSpeechBubble }

    this.activeInteraction = null; // Single interaction
    this.lastInteractionHour = -1;

    // All available interaction types
    this.interactionTypes = [
      GreetingInteraction,
      DancePartyInteraction,
      ChickenDanceInteraction,
      ListeningInteraction,
      PointingInteraction,
      WarriorPoseInteraction,
      DizzySpinInteraction,
      FlyingDreamInteraction,
      ShrugInteraction,
      CombatTrainingInteraction,
      HappyMeetingInteraction,
      BreathingExerciseInteraction,
      WalkTogetherInteraction,
      MorningGreetingInteraction,
      EveningGoodbyeInteraction,
      NearHouseMeetingInteraction,
      FarDistanceWaveInteraction,
      CircleDanceInteraction,
      MutualPointingInteraction,
      NightSkyGazingInteraction,
      FlyingShowInteraction,
      ListeningCircleInteraction,
      WarriorCombatInteraction,
      RelaxBreakInteraction,
      MixedDancePartyInteraction
    ];
  }

  // Update context (called every frame)
  updateContext(timeOfDay) {
    this.context.timeOfDay = timeOfDay;
  }

  // Select two random avatars
  selectTwoRandomAvatars() {
    if (this.gvrms.length < 2) return null;

    const index1 = Math.floor(Math.random() * this.gvrms.length);
    let index2 = Math.floor(Math.random() * this.gvrms.length);

    // Ensure different avatars
    while (index2 === index1) {
      index2 = Math.floor(Math.random() * this.gvrms.length);
    }

    return {
      index1,
      index2,
      gvrm1: this.gvrms[index1],
      gvrm2: this.gvrms[index2],
      walker1: this.walkers[index1],
      walker2: this.walkers[index2]
    };
  }

  // Calculate distance between two avatars
  getDistance(gvrm1, gvrm2) {
    if (!gvrm1 || !gvrm2 || !gvrm1.isReady || !gvrm2.isReady) return Infinity;
    const pos1 = gvrm1.character.currentVrm.scene.position;
    const pos2 = gvrm2.character.currentVrm.scene.position;
    return pos1.distanceTo(pos2);
  }

  // Calculate distance from house (at x=0, z=-10)
  getDistanceFromHouse(gvrm) {
    if (!gvrm || !gvrm.isReady) return Infinity;
    const pos = gvrm.character.currentVrm.scene.position;
    const dx = pos.x - 0;
    const dz = pos.z - (-10);
    return Math.sqrt(dx * dx + dz * dz);
  }

  // Select appropriate interaction based on context
  selectInteraction(avatars) {
    const { gvrm1, gvrm2, index1, index2 } = avatars;
    const timeOfDay = this.context.timeOfDay;
    const distance = this.getDistance(gvrm1, gvrm2);
    const distanceFromHouse1 = this.getDistanceFromHouse(gvrm1);
    const distanceFromHouse2 = this.getDistanceFromHouse(gvrm2);

    // Create weighted list based on context
    const weights = [];

    this.interactionTypes.forEach((InteractionClass) => {
      let weight = 1.0; // Base weight

      // Time-based weights
      if (InteractionClass === MorningGreetingInteraction) {
        weight = (timeOfDay >= 6 && timeOfDay < 12) ? 3.0 : 0.5;
      } else if (InteractionClass === EveningGoodbyeInteraction) {
        weight = (timeOfDay >= 18 || timeOfDay < 6) ? 3.0 : 0.5;
      } else if (InteractionClass === NightSkyGazingInteraction) {
        weight = ((timeOfDay >= 18 && timeOfDay <= 24) || (timeOfDay >= 0 && timeOfDay < 6)) ? 3.0 : 0.3;
      }

      // Distance-based weights
      if (InteractionClass === FarDistanceWaveInteraction) {
        weight = distance > 7 ? 3.0 : 0.3;
      } else if (InteractionClass === WalkTogetherInteraction) {
        weight = distance < 3 ? 2.0 : 0.5;
      }

      // House proximity-based weights
      if (InteractionClass === NearHouseMeetingInteraction) {
        const nearHouse = distanceFromHouse1 < 5 || distanceFromHouse2 < 5;
        weight = nearHouse ? 3.0 : 0.3;
      }

      // Activity-based weights (some are more common)
      if (InteractionClass === GreetingInteraction || InteractionClass === HappyMeetingInteraction) {
        weight *= 1.5; // Greetings are common
      } else if (InteractionClass === DancePartyInteraction || InteractionClass === ChickenDanceInteraction) {
        weight *= 0.8; // Dances are less common
      }

      weights.push({ InteractionClass, weight });
    });

    // Weighted random selection
    const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of weights) {
      random -= item.weight;
      if (random <= 0) {
        // Create interaction with context including avatar indices
        const interactionContext = {
          ...this.context,
          index1,
          index2
        };
        return new item.InteractionClass(
          gvrm1,
          gvrm2,
          avatars.walker1,
          avatars.walker2,
          interactionContext
        );
      }
    }

    // Fallback to greeting
    const interactionContext = {
      ...this.context,
      index1,
      index2
    };
    return new GreetingInteraction(gvrm1, gvrm2, avatars.walker1, avatars.walker2, interactionContext);
  }

  // Check if should start new interaction (once every 4 hours)
  shouldStartInteraction(currentHour) {
    // Already have an active interaction
    if (this.activeInteraction && this.activeInteraction.isActive) {
      return false;
    }

    // Check if 4 hours have passed since last interaction
    if (this.lastInteractionHour !== -1) {
      const hoursPassed = currentHour - this.lastInteractionHour;
      if (hoursPassed < 4 && hoursPassed >= 0) {
        return false;
      }
      // Handle day wrap-around (24 -> 0)
      if (currentHour < this.lastInteractionHour && (24 - this.lastInteractionHour + currentHour) < 4) {
        return false;
      }
    }

    // Need at least 2 avatars
    if (this.gvrms.length < 2) {
      return false;
    }

    return true;
  }

  // Start new interaction
  async startNewInteraction(currentHour) {
    if (!this.shouldStartInteraction(currentHour)) {
      return;
    }

    this.lastInteractionHour = currentHour;

    // Select two random avatars
    const avatars = this.selectTwoRandomAvatars();
    if (!avatars) return;

    // Check if both avatars are ready
    if (!avatars.gvrm1.isReady || !avatars.gvrm2.isReady) {
      return;
    }

    // Select appropriate interaction
    const interaction = this.selectInteraction(avatars);

    // Start interaction
    this.activeInteraction = interaction;
    await interaction.start();

    console.log(`Started interaction: ${interaction.constructor.name} between avatars ${avatars.index1} and ${avatars.index2}`);

    // Update interaction display
    if (this.context.updateInteractionDisplay) {
      this.context.updateInteractionDisplay(
        interaction.constructor.name,
        avatars.index1,
        avatars.index2,
        interaction.duration,
        interaction.duration
      );
    }
  }

  // Update active interaction
  update(virtualTime) {
    const currentHour = Math.floor(virtualTime);

    // Update context
    this.updateContext(virtualTime);

    // Try to start new interaction if appropriate
    this.startNewInteraction(currentHour);

    // Update active interaction
    if (this.activeInteraction && this.activeInteraction.isActive) {
      this.activeInteraction.update();

      // Update interaction display with remaining time
      if (this.context.updateInteractionDisplay) {
        const remaining = this.activeInteraction.duration - this.activeInteraction.frameCount;
        const index1 = this.activeInteraction.context.index1;
        const index2 = this.activeInteraction.context.index2;

        this.context.updateInteractionDisplay(
          this.activeInteraction.constructor.name,
          index1,
          index2,
          remaining,
          this.activeInteraction.duration
        );
      }

      // Check if interaction ended
      if (!this.activeInteraction.isActive) {
        console.log(`Ended interaction: ${this.activeInteraction.constructor.name}`);

        // Hide interaction display
        if (this.context.hideInteractionDisplay) {
          this.context.hideInteractionDisplay();
        }

        this.activeInteraction = null;
      }
    }
  }

  // Get current interaction status (for debugging)
  getStatus() {
    if (this.activeInteraction && this.activeInteraction.isActive) {
      return {
        active: true,
        type: this.activeInteraction.constructor.name,
        duration: this.activeInteraction.frameCount,
        remaining: this.activeInteraction.duration - this.activeInteraction.frameCount
      };
    }
    return { active: false };
  }
}
