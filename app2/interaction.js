// Copyright (c) 2025 naruya
// Licensed under the MIT License. See LICENSE file in the project root for full license information.

import * as THREE from 'three';

// Base Interaction class
export class Interaction {
  constructor(gvrm1, gvrm2, walker1, walker2, context) {
    this.gvrm1 = gvrm1;
    this.gvrm2 = gvrm2;
    this.walker1 = walker1;
    this.walker2 = walker2;
    this.context = context; // { timeOfDay, centerHouse, camera }

    this.isActive = false;
    this.startTime = 0;
    // Virtual 3 hours duration
    // App runs 24 hours in 1 real minute (60 seconds)
    // So 3 virtual hours = (3/24) * 60 = 7.5 real seconds = 450 frames at 60fps
    this.duration = 7.5 * 60; // 7.5 seconds at 60fps = 3 virtual hours
    this.frameCount = 0;

    // Target distance for interaction (can be overridden in subclasses)
    this.interactionDistance = 0.8;

    this.originalWalkerStates = {
      walker1: { isWalking: false },
      walker2: { isWalking: false }
    };
  }

  // Called when interaction starts
  async start() {
    this.isActive = true;
    this.startTime = performance.now();
    this.frameCount = 0;

    // Save original walker states
    this.originalWalkerStates.walker1.isWalking = this.walker1.isWalking;
    this.originalWalkerStates.walker2.isWalking = this.walker2.isWalking;

    // Move avatars close to each other before starting interaction
    await this.moveAvatarsTogether();

    // Now pause walkers during interaction animation (prevent walker from updating)
    this.walker1.isWalking = false;
    this.walker2.isWalking = false;
    this.walker1.shouldWalk = false;
    this.walker2.shouldWalk = false;
    this.walker1.inInteraction = true;
    this.walker2.inInteraction = true;

    await this.onStart();
  }

  // Move avatars towards each other until they reach interaction distance
  async moveAvatarsTogether() {
    // Always make avatars walk towards each other, even if they're already close
    const pos1 = this.gvrm1.character.currentVrm.scene.position;
    const pos2 = this.gvrm2.character.currentVrm.scene.position;

    const currentDistance = this.getDistance();

    // If already very close, move them apart slightly first so they walk towards each other
    let midpoint, target1, target2;

    if (currentDistance < this.interactionDistance * 2) {
      // Too close - make them walk at least 3 units to meet
      const direction = new THREE.Vector3().subVectors(pos2, pos1).normalize();
      const walkDistance = 3; // Minimum distance to walk

      midpoint = new THREE.Vector3(
        (pos1.x + pos2.x) / 2,
        0,
        (pos1.z + pos2.z) / 2
      );

      target1 = new THREE.Vector3().copy(midpoint).sub(direction.clone().multiplyScalar(this.interactionDistance / 2));
      target2 = new THREE.Vector3().copy(midpoint).add(direction.clone().multiplyScalar(this.interactionDistance / 2));
    } else {
      // Far apart - meet at midpoint
      midpoint = new THREE.Vector3(
        (pos1.x + pos2.x) / 2,
        0,
        (pos1.z + pos2.z) / 2
      );

      // Calculate target positions for each avatar (distance from midpoint)
      const direction = new THREE.Vector3().subVectors(pos2, pos1).normalize();
      const halfDistance = this.interactionDistance / 2;

      target1 = new THREE.Vector3().copy(midpoint).sub(direction.clone().multiplyScalar(halfDistance));
      target2 = new THREE.Vector3().copy(midpoint).add(direction.clone().multiplyScalar(halfDistance));
    }

    // Use Walker to move avatars to temporary targets
    return new Promise((resolve) => {
      let walker1Arrived = false;
      let walker2Arrived = false;

      const checkBothArrived = () => {
        if (walker1Arrived && walker2Arrived) {
          console.log('Both avatars arrived for interaction');

          // Wait a bit to ensure they're fully stopped
          setTimeout(() => {
            // Both arrived, face each other
            const currentPos1 = this.gvrm1.character.currentVrm.scene.position;
            const currentPos2 = this.gvrm2.character.currentVrm.scene.position;
            const finalDistance = currentPos1.distanceTo(currentPos2);

            console.log(`Final distance before interaction: ${finalDistance.toFixed(2)}m`);

            const dir = new THREE.Vector3().subVectors(currentPos2, currentPos1).normalize();

            this.gvrm1.character.currentVrm.scene.rotation.y = Math.atan2(dir.x, dir.z);
            this.gvrm2.character.currentVrm.scene.rotation.y = Math.atan2(-dir.x, -dir.z);

            resolve();
          }, 100); // Wait 100ms to ensure walkers have fully stopped
        }
      };

      console.log(`Moving avatars together. Current distance: ${this.getDistance().toFixed(2)}m`);

      // Set temporary targets for both walkers (with stricter threshold)
      this.walker1.setTemporaryTarget(target1.x, target1.z, () => {
        console.log('Walker1 arrived at target');
        walker1Arrived = true;
        checkBothArrived();
      });

      this.walker2.setTemporaryTarget(target2.x, target2.z, () => {
        console.log('Walker2 arrived at target');
        walker2Arrived = true;
        checkBothArrived();
      });
    });
  }

  // Called every frame while active
  update() {
    if (!this.isActive) return;

    this.frameCount++;

    // Check if interaction should end
    if (this.frameCount >= this.duration) {
      this.end();
      return;
    }

    this.onUpdate();
  }

  // Called when interaction ends
  end() {
    this.isActive = false;

    // Restore walker states
    this.walker1.isWalking = this.originalWalkerStates.walker1.isWalking;
    this.walker2.isWalking = this.originalWalkerStates.walker2.isWalking;
    this.walker1.inInteraction = false;
    this.walker2.inInteraction = false;

    this.onEnd();
  }

  // Override these in subclasses
  async onStart() {}
  onUpdate() {}
  onEnd() {}

  // Helper: Get distance between two characters
  getDistance() {
    const pos1 = this.gvrm1.character.currentVrm.scene.position;
    const pos2 = this.gvrm2.character.currentVrm.scene.position;
    return pos1.distanceTo(pos2);
  }

  // Helper: Move character to target position
  moveCharacterTowards(gvrm, targetPos, speed = 0.05) {
    if (!targetPos || !gvrm || !gvrm.character || !gvrm.character.currentVrm) {
      return; // Safety check
    }

    const currentPos = gvrm.character.currentVrm.scene.position;
    const direction = new THREE.Vector3().subVectors(targetPos, currentPos);
    const distance = direction.length();

    if (distance > 0.1) {
      direction.normalize();
      currentPos.add(direction.multiplyScalar(speed));

      // Rotate to face target
      const angle = Math.atan2(direction.x, direction.z);
      gvrm.character.currentVrm.scene.rotation.y = angle;
    }
  }

  // Helper: Change animation
  async changeAnimation(gvrm, animationPath) {
    if (gvrm && gvrm.isReady && !gvrm.character.isLoading()) {
      await gvrm.changeFBX(animationPath);
    }
  }

  // Helper: Show speech bubble
  showSpeech(index, text) {
    // This will be called from InteractionManager
    if (this.context.showSpeechBubble) {
      this.context.showSpeechBubble(index, text);
    }
  }
}

// 1. Greeting - Two characters acknowledge each other
export class GreetingInteraction extends Interaction {
  async onStart() {
    // Face each other
    const pos1 = this.gvrm1.character.currentVrm.scene.position;
    const pos2 = this.gvrm2.character.currentVrm.scene.position;

    const angle1 = Math.atan2(pos2.x - pos1.x, pos2.z - pos1.z);
    const angle2 = Math.atan2(pos1.x - pos2.x, pos1.z - pos2.z);

    this.gvrm1.character.currentVrm.scene.rotation.y = angle1;
    this.gvrm2.character.currentVrm.scene.rotation.y = angle2;

    // Play acknowledging animation
    await this.changeAnimation(this.gvrm1, '../assets/Acknowledging.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Acknowledging.fbx');

    // Show greetings
    this.showSpeech(this.context.index1, 'こんにちは！');
    setTimeout(() => this.showSpeech(this.context.index2, 'やっほー！'), 1000);
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 2. Dance Party - Two characters dance together
export class DancePartyInteraction extends Interaction {
  async onStart() {
    const greetings = ['踊ろう！', 'レッツダンス！', '一緒に♪'];
    this.showSpeech(this.context.index1, greetings[Math.floor(Math.random() * greetings.length)]);

    // Both do Gangnam Style dance
    await this.changeAnimation(this.gvrm1, '../assets/Gangnam Style.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Gangnam Style.fbx');
  }

  async onEnd() {
    this.showSpeech(this.context.index1, '楽しかった！');
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 3. Chicken Dance - Silly dance together
export class ChickenDanceInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, 'チキンダンス！');
    await this.changeAnimation(this.gvrm1, '../assets/Chicken Dance.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Chicken Dance.fbx');
  }

  async onEnd() {
    this.showSpeech(this.context.index2, 'わーい');
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 4. Listening Session - One talks, one listens
export class ListeningInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, 'あのね...');
    await this.changeAnimation(this.gvrm1, '../assets/Happy Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Listening.fbx');

    setTimeout(() => this.showSpeech(this.context.index2, 'うんうん'), 2000);
  }

  async onEnd() {
    this.showSpeech(this.context.index1, 'ありがとう！');
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 5. Pointing Game - One points, other looks
export class PointingInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, 'あれ見て！');
    await this.changeAnimation(this.gvrm1, '../assets/Pointing.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Happy Idle.fbx');

    setTimeout(() => this.showSpeech(this.context.index2, 'わー！'), 1500);
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 6. Warrior Pose Challenge
export class WarriorPoseInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, 'ポーズ対決！');
    await this.changeAnimation(this.gvrm1, '../assets/Warrior.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Warrior.fbx');
  }

  async onEnd() {
    this.showSpeech(this.context.index2, '引き分けだね');
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 7. Dizzy Spin - Both get dizzy
export class DizzySpinInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, 'ぐるぐる〜');
    await this.changeAnimation(this.gvrm1, '../assets/Around.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Around.fbx');

    setTimeout(async () => {
      await this.changeAnimation(this.gvrm1, '../assets/Dizzy Idle.fbx');
      await this.changeAnimation(this.gvrm2, '../assets/Dizzy Idle.fbx');
      this.showSpeech(this.context.index2, 'めまいが...');
    }, 3000);
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 8. Flying Dream - Pretend to fly together
export class FlyingDreamInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, '空を飛ぼう！');
    await this.changeAnimation(this.gvrm1, '../assets/Flying.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Flying.fbx');
  }

  async onEnd() {
    this.showSpeech(this.context.index2, '楽しかった');
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 9. Shrug Together - Both confused
export class ShrugInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, 'わかんない');
    await this.changeAnimation(this.gvrm1, '../assets/Shrugging.fbx');

    setTimeout(async () => {
      this.showSpeech(this.context.index2, '私も...');
      await this.changeAnimation(this.gvrm2, '../assets/Shrugging.fbx');
    }, 1000);
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 10. Combat Training - Practice fighting moves
export class CombatTrainingInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, '練習しよう！');
    await this.changeAnimation(this.gvrm1, '../assets/Jab Cross.fbx');

    setTimeout(async () => {
      await this.changeAnimation(this.gvrm2, '../assets/Jab Cross.fbx');
    }, 500);
  }

  async onEnd() {
    this.showSpeech(this.context.index2, 'いい運動！');
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 11. Happy Meeting - Both are happy to see each other
export class HappyMeetingInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, '久しぶり！');
    this.showSpeech(this.context.index2, '会いたかった！');
    await this.changeAnimation(this.gvrm1, '../assets/Happy Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Happy Idle.fbx');
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 12. Breathing Exercise - Relax together
export class BreathingExerciseInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, 'リラックス');
    await this.changeAnimation(this.gvrm1, '../assets/Breathing.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Breathing.fbx');
  }

  async onEnd() {
    this.showSpeech(this.context.index2, 'すっきり');
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 13. Walk Together - Side by side walking
export class WalkTogetherInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, '散歩しよう');
    await this.changeAnimation(this.gvrm1, '../assets/Walking.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Walking.fbx');

    this.targetPos = new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      0,
      (Math.random() - 0.5) * 10
    );
  }

  onUpdate() {
    if (!this.targetPos) return; // Safety check

    if (this.frameCount < this.duration / 2) {
      this.moveCharacterTowards(this.gvrm1, this.targetPos, 0.02);
      const offset = new THREE.Vector3(1.5, 0, 0);
      const targetPos2 = this.targetPos.clone().add(offset);
      this.moveCharacterTowards(this.gvrm2, targetPos2, 0.02);
    }
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 14. Morning Greeting
export class MorningGreetingInteraction extends Interaction {
  async onStart() {
    const timeOfDay = this.context.timeOfDay;
    if (timeOfDay >= 6 && timeOfDay < 12) {
      this.showSpeech(this.context.index1, 'おはよう！');
      this.showSpeech(this.context.index2, 'おはよー！');
    } else {
      this.showSpeech(this.context.index1, 'やっほー');
      this.showSpeech(this.context.index2, 'こんにちは');
    }

    await this.changeAnimation(this.gvrm1, '../assets/Acknowledging.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Happy Idle.fbx');
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 15. Evening Goodbye
export class EveningGoodbyeInteraction extends Interaction {
  async onStart() {
    const timeOfDay = this.context.timeOfDay;
    if (timeOfDay >= 18 || timeOfDay < 6) {
      this.showSpeech(this.context.index1, 'おやすみ');
      this.showSpeech(this.context.index2, 'またね');
    } else {
      this.showSpeech(this.context.index1, 'じゃあね');
      this.showSpeech(this.context.index2, 'バイバイ');
    }

    await this.changeAnimation(this.gvrm1, '../assets/Acknowledging.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Acknowledging.fbx');
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 16. Near House Meeting
export class NearHouseMeetingInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, '家の前だね');
    this.showSpeech(this.context.index2, 'いい家だね');

    await this.changeAnimation(this.gvrm1, '../assets/Pointing.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Listening.fbx');
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 17. Far Distance Wave
export class FarDistanceWaveInteraction extends Interaction {
  async onStart() {
    const distance = this.getDistance();
    if (distance > 5) {
      this.showSpeech(this.context.index1, 'おーい！');
      await this.changeAnimation(this.gvrm1, '../assets/Acknowledging.fbx');

      setTimeout(() => {
        this.showSpeech(this.context.index2, 'おーい！');
        this.changeAnimation(this.gvrm2, '../assets/Acknowledging.fbx');
      }, 1000);
    }
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 18. Circle Dance
export class CircleDanceInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, '回ろう！');
    await this.changeAnimation(this.gvrm1, '../assets/Around.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Around.fbx');
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 19. Mutual Pointing
export class MutualPointingInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, 'あっちだよ');
    this.showSpeech(this.context.index2, 'こっちだよ');
    await this.changeAnimation(this.gvrm1, '../assets/Pointing.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Pointing.fbx');
  }

  async onEnd() {
    this.showSpeech(this.context.index1, 'わかんない笑');
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 20. Night Sky Gazing
export class NightSkyGazingInteraction extends Interaction {
  async onStart() {
    const timeOfDay = this.context.timeOfDay;
    if ((timeOfDay >= 18 && timeOfDay <= 24) || (timeOfDay >= 0 && timeOfDay < 6)) {
      this.showSpeech(this.context.index1, '星きれい');
      this.showSpeech(this.context.index2, 'ほんとだね');
    } else {
      this.showSpeech(this.context.index1, '空きれい');
      this.showSpeech(this.context.index2, 'うんうん');
    }

    await this.changeAnimation(this.gvrm1, '../assets/Breathing.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Breathing.fbx');
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 21. Flying Show - One performs flying, other watches
export class FlyingShowInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, '飛んでるみたい！');
    await this.changeAnimation(this.gvrm1, '../assets/Flying.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Happy Idle.fbx');

    setTimeout(() => this.showSpeech(this.context.index2, 'すごい！'), 2000);
  }

  async onEnd() {
    this.showSpeech(this.context.index1, 'どう？');
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 22. Listening Circle - Both listen carefully
export class ListeningCircleInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, '静かに聞こう');
    this.showSpeech(this.context.index2, 'うん');
    await this.changeAnimation(this.gvrm1, '../assets/Listening.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Listening.fbx');
  }

  async onEnd() {
    this.showSpeech(this.context.index1, '聞こえた？');
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 23. Warrior vs Combat - Warrior pose vs jab cross
export class WarriorCombatInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, '技披露！');
    await this.changeAnimation(this.gvrm1, '../assets/Warrior.fbx');

    setTimeout(async () => {
      this.showSpeech(this.context.index2, '負けない！');
      await this.changeAnimation(this.gvrm2, '../assets/Jab Cross.fbx');
    }, 1000);
  }

  async onEnd() {
    this.showSpeech(this.context.index1, 'いい勝負！');
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 24. Relax Break - One acknowledges, one relaxes
export class RelaxBreakInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, 'ちょっと休憩');
    await this.changeAnimation(this.gvrm1, '../assets/Acknowledging.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Breathing.fbx');

    setTimeout(() => this.showSpeech(this.context.index2, 'のんびり'), 2000);
  }

  async onEnd() {
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}

// 25. Mixed Dance Party - Different dances together
export class MixedDancePartyInteraction extends Interaction {
  async onStart() {
    this.showSpeech(this.context.index1, 'ダンスバトル！');
    await this.changeAnimation(this.gvrm1, '../assets/Chicken Dance.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Gangnam Style.fbx');
  }

  async onEnd() {
    this.showSpeech(this.context.index2, '楽しい！');
    await this.changeAnimation(this.gvrm1, '../assets/Idle.fbx');
    await this.changeAnimation(this.gvrm2, '../assets/Idle.fbx');
  }
}
