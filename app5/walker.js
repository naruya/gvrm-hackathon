// Copyright (c) 2025 naruya
// Licensed under the MIT License. See LICENSE file in the project root for full license information.


import * as THREE from 'three';

export class Walker {
  constructor(gvrm, index) {
    this.gvrm = gvrm;
    this.index = index;

    this.speed = 0.03; // Fixed speed

    this.isWalking = false;
    this.currentAnimation = 'idle';
    this.walkingAction = null;
    this.idleAction = null;

    this.walkTimer = 0;
    this.walkDuration = 120 + Math.random() * 180; // Walk for 2-5 seconds
    this.stopDuration = 60 + Math.random() * 120; // Stop for 1-3 seconds
    this.shouldWalk = Math.random() > 0.5; // 50% chance to start walking

    // Boundary (movement area for avatars) - 1.5x larger
    this.boundary = 11.25;

    // Set random target position
    this.setNewTarget();

    // Set random initial rotation
    const initialRotation = (Math.random() - 0.5) * Math.PI * 2; // -π to π
    this.targetRotation = 0;
    this.currentRotation = initialRotation;

    this.arrivalThreshold = 0.15; // Distance threshold for reaching target
    this.justChangedTarget = false; // Flag to prevent rapid target changes

    this.animationsLoaded = false;

    // Special animations (based on actual FBX files in /assets)
    this.specialAnimations = [
      { name: 'Acknowledging', path: '../assets/Acknowledging.fbx', action: null },
      { name: 'Around', path: '../assets/Around.fbx', action: null },
      { name: 'Breathing', path: '../assets/Breathing.fbx', action: null },
      { name: 'Chicken Dance', path: '../assets/Chicken Dance.fbx', action: null },
      { name: 'Dizzy Idle', path: '../assets/Dizzy Idle.fbx', action: null },
      { name: 'Flying', path: '../assets/Flying.fbx', action: null },
      { name: 'Gangnam Style', path: '../assets/Gangnam Style.fbx', action: null },
      { name: 'Happy Idle', path: '../assets/Happy Idle.fbx', action: null },
      { name: 'Jab Cross', path: '../assets/Jab Cross.fbx', action: null },
      { name: 'Listening', path: '../assets/Listening.fbx', action: null },
      { name: 'Pointing', path: '../assets/Pointing.fbx', action: null },
      { name: 'Shrugging', path: '../assets/Shrugging.fbx', action: null },
      { name: 'Warrior', path: '../assets/Warrior.fbx', action: null }
    ];
    this.currentSpecialAnimation = null; // Track current special animation name
    this.isPlayingSpecial = false; // Track if playing special animation
  }

  // Set new target position
  setNewTarget() {
    // Generate random position within boundary (safe range)
    const maxRange = this.boundary * 0.85; // 85% of boundary to stay safely inside
    this.targetX = (Math.random() - 0.5) * 2 * maxRange;
    this.targetZ = (Math.random() - 0.5) * 2 * maxRange;
  }

  async initAnimations() {
    if (!this.gvrm || !this.gvrm.isReady) {
      console.log('GVRM not ready for walker', this.index);
      return;
    }

    try {
      // Load Walking animation
      await this.gvrm.changeFBX('../assets/Walking.fbx');
      this.walkingAction = this.gvrm.character.action;

      // Load Idle animation
      await this.gvrm.changeFBX('../assets/Idle.fbx');
      this.idleAction = this.gvrm.character.action;

      // Start with Idle animation
      this.idleAction.play();
      this.currentAnimation = 'idle';

      this.animationsLoaded = true;
      console.log(`Walker ${this.index}: Animations loaded`);
    } catch (error) {
      console.error(`Failed to load animations for walker ${this.index}:`, error);
    }
  }

  update() {
    if (!this.gvrm || !this.gvrm.isReady || !this.animationsLoaded) {
      return;
    }

    // Skip normal behavior when playing special animation
    if (this.isPlayingSpecial) {
      return;
    }

    const character = this.gvrm.character.currentVrm.scene;

    // Toggle between walking and stopping
    this.walkTimer++;
    if (this.shouldWalk) {
      if (this.walkTimer >= this.walkDuration) {
        this.shouldWalk = false;
        this.walkTimer = 0;
        this.stopDuration = 60 + Math.random() * 120;
        this.switchToIdle();
      }
    } else {
      if (this.walkTimer >= this.stopDuration) {
        this.shouldWalk = true;
        this.walkTimer = 0;
        this.walkDuration = 120 + Math.random() * 180;
        this.switchToWalking();
      }
    }

    // Calculate distance and direction to target
    if (this.shouldWalk) {
      const dx = this.targetX - character.position.x;
      const dz = this.targetZ - character.position.z;
      const distanceToTarget = Math.sqrt(dx * dx + dz * dz);

      // Calculate direction to target (accounting for rotation0)
      const rot0 = character.rotation0.clone();
      const worldRotation = Math.atan2(dx, dz);
      this.targetRotation = worldRotation - rot0.y;

      // Set new target when reached
      if (distanceToTarget < this.arrivalThreshold) {
        this.setNewTarget();

        // 33% chance to play a special animation
        if (Math.random() < 0.33) {
          this.playRandomSpecialAnimation();
        }
      }
    }

    // Smoothly rotate
    let rotDiff = this.targetRotation - this.currentRotation;
    // Normalize angle difference to -π to π range
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;

    this.currentRotation += rotDiff * 0.1;

    // Normalize currentRotation to -π to π range
    while (this.currentRotation > Math.PI) this.currentRotation -= Math.PI * 2;
    while (this.currentRotation < -Math.PI) this.currentRotation += Math.PI * 2;

    // Check if rotation is almost complete (threshold: ~5.7 degrees)
    const rotationThreshold = 0.1; // Radians
    const isRotationComplete = Math.abs(rotDiff) < rotationThreshold;

    // Update character orientation (always)
    const currentQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.currentRotation
    );
    character.quaternion.copy(currentQuat);

    // Walk movement (move only after rotation is complete)
    if (this.shouldWalk && this.isWalking && isRotationComplete) {
      // Get forward vector (apply rotation0 compensation)
      const rot0 = character.rotation0.clone();
      const forwardVector = new THREE.Vector3(0, 0, 1);

      // Apply rotation0 compensation
      const compensatedQuaternion = new THREE.Quaternion().multiplyQuaternions(
        currentQuat,
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -rot0.y)
      );

      forwardVector.applyQuaternion(compensatedQuaternion);

      // Calculate new position
      const newX = character.position.x + this.speed * forwardVector.x;
      const newZ = character.position.z + this.speed * forwardVector.z;

      // Boundary check (with safety margin)
      const safetyMargin = 0.5;
      if (Math.abs(newX) < this.boundary - safetyMargin && Math.abs(newZ) < this.boundary - safetyMargin) {
        character.position.x = newX;
        character.position.z = newZ;
      } else {
        // Clamp position and set new target when boundary is reached
        character.position.x = Math.max(-this.boundary + safetyMargin, Math.min(this.boundary - safetyMargin, newX));
        character.position.z = Math.max(-this.boundary + safetyMargin, Math.min(this.boundary - safetyMargin, newZ));

        // Set new target (using flag to prevent frequent changes)
        if (!this.justChangedTarget) {
          this.setNewTarget();
          this.justChangedTarget = true;
          setTimeout(() => { this.justChangedTarget = false; }, 1000); // Suppress new target for 1 second
        }
      }
    }
  }

  async switchToWalking() {
    if (!this.walkingAction || !this.idleAction) return;

    if (this.currentAnimation === 'walking') return;

    const fadeTime = 0.3;
    this.walkingAction.reset();
    this.walkingAction.play();
    this.walkingAction.crossFadeFrom(this.idleAction, fadeTime, true);

    this.currentAnimation = 'walking';
    this.isWalking = true;

    // Update GVRM action property
    if (this.gvrm.character.action !== this.walkingAction) {
      this.gvrm.character.previousAction = this.gvrm.character.action;
      this.gvrm.character.action = this.walkingAction;
    }
  }

  async switchToIdle() {
    if (!this.idleAction) return;

    if (this.currentAnimation === 'idle') return;

    // If coming from special animation, reload idle animation
    if (this.isPlayingSpecial) {
      try {
        await this.gvrm.changeFBX('../assets/Idle.fbx');
        this.idleAction = this.gvrm.character.action;
        this.idleAction.play();
        this.currentAnimation = 'idle';
        this.isWalking = false;
        this.isPlayingSpecial = false;
        this.currentSpecialAnimation = null;

        // Reload walking animation as well
        await this.gvrm.changeFBX('../assets/Walking.fbx');
        this.walkingAction = this.gvrm.character.action;

        // Return to idle
        await this.gvrm.changeFBX('../assets/Idle.fbx');
        this.idleAction = this.gvrm.character.action;
        this.idleAction.play();

        console.log(`Walker ${this.index}: Returned to idle from special animation`);
        return;
      } catch (error) {
        console.error(`Walker ${this.index}: Failed to reload idle animation:`, error);
        return;
      }
    }

    // Normal switch from walking to idle
    if (!this.walkingAction) return;

    const fadeTime = 0.3;
    this.idleAction.enabled = true;
    this.idleAction.setEffectiveWeight(1.0);
    this.idleAction.reset();
    this.idleAction.play();
    this.idleAction.crossFadeFrom(this.walkingAction, fadeTime, true);

    this.currentAnimation = 'idle';
    this.isWalking = false;
    this.isPlayingSpecial = false;
    this.currentSpecialAnimation = null;

    // Update GVRM action property
    if (this.gvrm.character.action !== this.idleAction) {
      this.gvrm.character.previousAction = this.gvrm.character.action;
      this.gvrm.character.action = this.idleAction;
    }
  }

  async playRandomSpecialAnimation() {
    if (!this.gvrm || !this.gvrm.isReady) return;

    // Check if GVRM is currently loading
    if (this.gvrm.character && this.gvrm.character.isLoading && this.gvrm.character.isLoading()) {
      console.log(`Walker ${this.index}: Cannot play animation, GVRM is loading`);
      return;
    }

    // Choose random special animation
    const randomIndex = Math.floor(Math.random() * this.specialAnimations.length);
    const selectedAnimation = this.specialAnimations[randomIndex];

    try {
      // Stop current animations (idle and walking)
      if (this.idleAction) {
        this.idleAction.stop();
      }
      if (this.walkingAction) {
        this.walkingAction.stop();
      }

      // Load and play special animation
      await this.gvrm.changeFBX(selectedAnimation.path);

      // Verify that loading completed successfully
      if (!this.gvrm.character || !this.gvrm.character.action) {
        console.error(`Walker ${this.index}: Failed to load animation, no action available`);
        this.switchToIdle();
        return;
      }

      const specialAction = this.gvrm.character.action;

      // Set to play once (not loop)
      specialAction.setLoop(THREE.LoopOnce);
      specialAction.clampWhenFinished = true;
      specialAction.reset();
      specialAction.play();

      // Update state
      this.currentAnimation = 'special';
      this.isWalking = false;
      this.isPlayingSpecial = true;
      this.currentSpecialAnimation = selectedAnimation.name;

      // Stop walking while playing animation
      this.shouldWalk = false;
      this.walkTimer = 0;

      console.log(`Walker ${this.index}: Playing special animation ${selectedAnimation.name}`);

      // Listen for animation finish and return to idle
      const mixer = this.gvrm.character.mixer;

      if (mixer) {
        const onFinished = (e) => {
          if (e.action === specialAction) {
            mixer.removeEventListener('finished', onFinished);

            // Return to idle after special animation finishes
            this.switchToIdle();

            // Resume random walking behavior
            this.stopDuration = 60 + Math.random() * 120;
          }
        };

        mixer.addEventListener('finished', onFinished);
      } else {
        // Fallback: Use timeout to return to idle (estimate animation duration)
        const animationDuration = specialAction.getClip().duration * 1000; // Convert to milliseconds
        setTimeout(() => {
          this.switchToIdle();
          this.stopDuration = 60 + Math.random() * 120;
        }, animationDuration);
      }
    } catch (error) {
      console.error(`Failed to play special animation:`, error);

      // Fallback to idle on error
      if (this.idleAction) {
        this.switchToIdle();
      }
    }
  }
}
