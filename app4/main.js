// Copyright (c) 2025 naruya
// Licensed under the MIT License. See LICENSE file in the project root for full license information.


import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { GVRM, GVRMUtils } from 'gvrm';
import { FPSCounter } from './utils/fps.js';
import { createSky, createHouses, createCenterHouse, updateSky } from './scene.js';

// UI
const container = document.getElementById('threejs-container');
let width = window.innerWidth;
let height = window.innerHeight;

// params
const params = new URL(window.location.href).searchParams;

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
container.appendChild(renderer.domElement);
renderer.setSize(width, height);

// camera
const camera = new THREE.PerspectiveCamera(65.0, width / height, 0.01, 2000.0);
camera.position.set(2.0, 6.0, 12.0);
camera.aspect = width / height;
camera.updateProjectionMatrix();

const controls = new OrbitControls(camera, renderer.domElement);
controls.screenSpacePanning = true;
controls.target.set(0.0, 0.8, 0.0);
controls.minDistance = 0.1;
controls.maxDistance = 50;
controls.enableDamping = true;
controls.enableZoom = false;
controls.enablePan = false;
controls.update();

const controls2 = new TrackballControls(camera, renderer.domElement);
controls2.noRotate = true;
controls2.target.set(0.0, 0.4, 0.0);
controls2.noPan = false;
controls2.noZoom = false;
controls2.zoomSpeed = 0.25;
controls2.useDummyMouseWheel = true;
controls2.update();

// scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Ambient light (constant illumination)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Directional light
const light = new THREE.DirectionalLight(0xffffff, Math.PI);
light.position.set(10.0, 10.0, 10.0);
scene.add(light);

// Scene management
let currentScene = 2; // Default is Scene 2 (dark)
let gridHelper = new THREE.GridHelper(300, 60, 0x808080, 0x808080); // Dark scene grid
scene.add(gridHelper);
const axesHelper = new THREE.AxesHelper(0.5);
scene.add(axesHelper);
let sky = createSky(scene);
createHouses(scene);

// Add center house
const centerHouse = createCenterHouse(scene);

// Time system (accelerated time, 24 hours in 1 real minute)
let virtualTime = 8; // Start at 8:00 AM (in hours, 0-24)
const timeSpeed = 24 / 60; // 60 real seconds = 24 virtual hours, so 1 second = 0.4 hours = 24 minutes

const fbxFiles = [
  '../assets/Breathing.fbx',
  '../assets/Capoeira.fbx',
  '../assets/Listening.fbx',
  '../assets/Shrugging.fbx',
  '../assets/Texting.fbx',
  '../assets/Warrior.fbx',
  '../assets/Around.fbx'
];

const gvrmFiles = [
  '../assets/sample1.gvrm',
  '../assets/sample2.gvrm',
  '../assets/sample3.gvrm',
  '../assets/sample4.gvrm',
  '../assets/sample5.gvrm',
  // '../assets/sample6.gvrm',
  // '../assets/sample7.gvrm',
  '../assets/sample8.gvrm'
  // '../assets/sample9.gvrm'
];

// Limit avatar count to not exceed gvrmFiles length
const requestedN = parseInt(params.get('n')) || 6;
let N = Math.min(requestedN, 6); // Max 6 avatars

// Track current animation state for each model
const modelAnimations = [];

const gvrms = [];
let loadCount = 0;
let totalLoadCount = N;
window.gvrms = gvrms;

let allModelsReady = false;

const loadDisplay = document.getElementById('loaddisplay');

// Performance system
const characterStates = []; // States: 'watching', 'walking_to_center', 'performing', 'falling'
const characterFallVelocities = []; // Fall velocity for each character (for free fall)
let currentPerformerIndex = 0;
let performanceTimer = 0;
const WALK_SPEED = 0.05;
const GRAVITY = 0.02; // Gravity acceleration
const SPEECH_DURATION = 5000; // 5 seconds

// Speech bubble system
const speechBubbles = [];
let gagsData = null;
let usedGags = []; // Track which gags have been used

// Load gags from JSON file
fetch('./gags.json')
  .then(response => response.json())
  .then(data => {
    gagsData = data;
    console.log('Gags loaded successfully');
  })
  .catch(error => {
    console.error('Failed to load gags:', error);
    gagsData = []; // Fallback to empty array
  });

function createSpeechBubble(index) {
  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  bubble.textContent = 'やっほー';
  document.getElementById('speech-bubbles-container').appendChild(bubble);
  speechBubbles[index] = bubble;
  return bubble;
}

function getNextGag() {
  if (!gagsData || gagsData.length === 0) {
    return 'やっほー'; // Default fallback
  }

  // Reset if all gags have been used
  if (usedGags.length >= gagsData.length) {
    usedGags = [];
  }

  // Get available gags
  const availableGags = gagsData.filter((gag, index) => !usedGags.includes(index));

  // Select random gag from available ones
  const randomIndex = Math.floor(Math.random() * availableGags.length);
  const selectedGag = availableGags[randomIndex];

  // Mark as used
  const originalIndex = gagsData.indexOf(selectedGag);
  usedGags.push(originalIndex);

  return selectedGag;
}

function showSpeechBubble(index, comment) {
  if (!gvrms[index] || !gvrms[index].isReady) return;

  const bubble = speechBubbles[index];
  const character = gvrms[index].character.currentVrm.scene;

  // Set the comment text
  bubble.textContent = comment;

  // Convert 3D position to 2D screen position
  const pos3D = character.position.clone();
  pos3D.y += 3; // Position above character's head
  pos3D.project(camera);

  const x = (pos3D.x * 0.5 + 0.5) * width;
  const y = (-(pos3D.y * 0.5) + 0.5) * height;

  bubble.style.left = `${x}px`;
  bubble.style.top = `${y}px`;
  bubble.style.transform = 'translate(-50%, -100%)';
  bubble.classList.add('show');

  // Hide after 5 seconds
  setTimeout(() => {
    bubble.classList.remove('show');
  }, 5000);
}

// Make showSpeechBubble accessible globally for interactions
window.showSpeechBubble = showSpeechBubble;

// Interaction display functions
// Timeline functions
function formatTimeHM(virtualTime) {
  const hours = Math.floor(virtualTime);
  const minutes = Math.floor((virtualTime - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function addTimelineEvent(virtualTime, eventText) {
  const timelineEntries = document.getElementById('timeline-entries');
  if (!timelineEntries) return;

  const entry = document.createElement('div');
  entry.className = 'timeline-entry';

  const timeSpan = document.createElement('div');
  timeSpan.className = 'timeline-time';
  timeSpan.textContent = formatTimeHM(virtualTime);

  const eventSpan = document.createElement('div');
  eventSpan.className = 'timeline-event';
  eventSpan.textContent = eventText;

  entry.appendChild(timeSpan);
  entry.appendChild(eventSpan);

  // Add to the top (prepend)
  timelineEntries.insertBefore(entry, timelineEntries.firstChild);

  // Limit to 50 entries
  while (timelineEntries.children.length > 50) {
    timelineEntries.removeChild(timelineEntries.lastChild);
  }
}

// Start next performer
function startNextPerformer() {
  if (currentPerformerIndex >= gvrms.length) {
    // All performed, restart from beginning
    currentPerformerIndex = 0;
  }

  const gvrm = gvrms[currentPerformerIndex];
  if (!gvrm || !gvrm.isReady) return;

  const character = gvrm.character.currentVrm.scene;

  // Set initial position at z=-10
  character.position.set(0, 0, -10);

  // Set state to walking
  characterStates[currentPerformerIndex] = 'walking_to_center';

  // Start walking animation
  gvrm.changeFBX('../assets/Walking.fbx');
}

// Update performance system
function updatePerformanceSystem() {
  for (let i = 0; i < gvrms.length; i++) {
    const gvrm = gvrms[i];
    if (!gvrm || !gvrm.isReady) continue;

    const character = gvrm.character.currentVrm.scene;
    const state = characterStates[i];

    if (state === 'walking_to_center') {
      // Walk towards origin (0, 0, 0)
      const targetZ = 0;
      const dz = targetZ - character.position.z;

      if (Math.abs(dz) > 0.1) {
        // Still walking
        character.position.z += Math.sign(dz) * WALK_SPEED;

        // Face forward (z+ direction) - facing towards the audience
        character.rotation.y = Math.PI;
      } else {
        // Reached center, start performing
        character.position.z = 0;
        characterStates[i] = 'performing';

        // Random performance animation
        const randomAnimIndex = Math.floor(Math.random() * fbxFiles.length);
        gvrm.changeFBX(fbxFiles[randomAnimIndex]);

        // Show speech bubble with gag
        const gag = getNextGag();
        showSpeechBubble(i, gag);

        // Start timer
        performanceTimer = Date.now();
      }
    } else if (state === 'performing') {
      // Check if performance duration has elapsed
      if (Date.now() - performanceTimer >= SPEECH_DURATION) {
        // Start falling
        characterStates[i] = 'falling';
        characterFallVelocities[i] = 0; // Reset fall velocity for free fall
      }
    } else if (state === 'falling') {
      // Free fall with gravity
      characterFallVelocities[i] += GRAVITY; // Add gravity to velocity
      character.position.y -= characterFallVelocities[i]; // Update position

      if (character.position.y <= -100) {
        // Finished falling, move to watching position
        characterStates[i] = 'watching';

        // Position at z=5, evenly spaced on x-axis
        const spacing = 10 / Math.max(N - 1, 1); // Space between -5 and 5
        const xPos = -5 + (i * spacing);
        character.position.set(xPos, 0, 5);

        // Face z- direction (towards origin)
        character.rotation.y = Math.PI;

        // Load idle animation
        gvrm.changeFBX('../assets/Idle.fbx');

        // Start next performer
        currentPerformerIndex++;
        setTimeout(() => startNextPerformer(), 1000); // 1 second delay
      }
    }
  }

  // Update speech bubble positions for all visible bubbles
  for (let i = 0; i < speechBubbles.length; i++) {
    if (speechBubbles[i] && speechBubbles[i].classList.contains('show')) {
      if (gvrms[i] && gvrms[i].isReady) {
        const character = gvrms[i].character.currentVrm.scene;
        const pos3D = character.position.clone();
        pos3D.y += 3;
        pos3D.project(camera);

        const x = (pos3D.x * 0.5 + 0.5) * width;
        const y = (-(pos3D.y * 0.5) + 0.5) * height;

        speechBubbles[i].style.left = `${x}px`;
        speechBubbles[i].style.top = `${y}px`;
      }
    }
  }
}


async function loadAllModels() {
  for (let i = 0; i < N; i++) {
    const fileName = gvrmFiles[i].split('/').pop();
    const promise = GVRM.load(gvrmFiles[i], scene, camera, renderer, fileName);

    promise.then((gvrm) => {
      // Position at z=5 (watching position), evenly spaced on x-axis
      const spacing = 10 / Math.max(N - 1, 1); // Space between -5 and 5
      const xPos = -5 + (i * spacing);
      gvrm.character.currentVrm.scene.position.set(xPos, 0, 5);

      // Face z- direction (towards origin)
      gvrm.character.currentVrm.scene.rotation.y = Math.PI;

      gvrms.push(gvrm);
      modelAnimations.push(0);

      // Create speech bubble for this character
      createSpeechBubble(gvrms.length - 1);

      // Set initial state to watching
      characterStates.push('watching');
      characterFallVelocities.push(0); // Initialize fall velocity

      // Load Idle.fbx
      gvrm.changeFBX('../assets/Idle.fbx').then(() => {
        loadCount++;
        updateLoadingDisplay();

        if (loadCount === totalLoadCount) {
          allModelsReady = true;
          // Start first performance after a short delay
          setTimeout(() => startNextPerformer(), 2000);
        }
      });
    });
    await promise;
  }
}

function updateLoadingDisplay() {
  const percentage = Math.floor((loadCount / totalLoadCount) * 100);
  loadDisplay.textContent = percentage + '%';
}

// Function to set animation for individual model
async function setModelAnimation(gvrm, animationIndex) {
  if (gvrm && gvrm.isReady && !gvrm.character.isLoading()) {
    await gvrm.changeFBX(fbxFiles[animationIndex]);
  }
}

loadAllModels();

const fpsc = new FPSCounter();

let stateAnim = "play";

window.addEventListener('resize', function (event) {
  width = window.innerWidth;
  height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
});

window.addEventListener('keydown', function (event) {
  if (event.code === "Space") {
    if (stateAnim === "play") {
      stateAnim = "pause";
      for (const gvrm of gvrms) {
        if (gvrm && gvrm.character && gvrm.character.action) {
          // Stop animation
          gvrm.character.action.stop();
          // Reset to default pose
          GVRMUtils.resetPose(gvrm.character, gvrm.boneOperations);
        }
      }
    } else {
      stateAnim = "play";
      for (const gvrm of gvrms) {
        if (gvrm && gvrm.character && gvrm.character.action) {
          // Resume animation
          gvrm.character.action.reset();
          gvrm.character.action.play();
        }
      }
    }
  }

  // Enable debug features only when N=1
  if (N === 1 && gvrms.length > 0) {
    const gvrm = gvrms[0];
    if (!gvrm || !gvrm.isReady) return;

    if (event.code === "KeyX") {
      // Toggle VRM mesh visibility
      GVRMUtils.visualizeVRM(gvrm.character, null);
    }
    if (event.code === "KeyZ") {
      // Toggle bone axes visibility
      GVRMUtils.visualizeBoneAxes(gvrm, null);
    }
  }
});

// Drag and drop implementation
container.addEventListener('dragover', (event) => {
  event.preventDefault();
  event.stopPropagation();

  const file = event.dataTransfer.items[0];
  if (file && file.type === '' && event.dataTransfer.items[0].getAsFile()?.name.endsWith('.gvrm')) {
    container.style.backgroundColor = 'rgba(100, 100, 100, 0.2)';
  }
});

container.addEventListener('dragleave', (event) => {
  event.preventDefault();
  event.stopPropagation();
  container.style.backgroundColor = '';
});

container.addEventListener('drop', async (event) => {
  event.preventDefault();
  event.stopPropagation();
  container.style.backgroundColor = '';

  const files = event.dataTransfer.files;
  if (files.length === 0) return;

  const file = files[0];
  if (!file.name.endsWith('.gvrm')) {
    console.error('Not a .gvrm file');
    return;
  }

  // Get center character (index 0)
  const centerGVRM = gvrms[0];
  if (!centerGVRM || !centerGVRM.isReady) {
    console.error('Center character not ready');
    return;
  }

  try {
    // Read file as Blob
    const blob = new Blob([file], { type: file.type });
    const url = URL.createObjectURL(blob);

    // Save current animation index
    const currentAnimIndex = modelAnimations[0];

    // Remove existing GVRM
    await centerGVRM.remove(scene);

    // Load new GVRM
    const newGVRM = await GVRM.load(url, scene, camera, renderer, file.name);

    // Set position (center position)
    newGVRM.character.currentVrm.scene.position.set(0, 0, 1);

    // Update gvrms array
    gvrms[0] = newGVRM;

    // Apply current animation
    await newGVRM.changeFBX(fbxFiles[currentAnimIndex]);

    // Release URL
    URL.revokeObjectURL(url);

    console.log(`Replaced center character with: ${file.name}`);
  } catch (error) {
    console.error('Failed to load dropped GVRM:', error);
  }
});

function updateRenderOrder() {
  if (!allModelsReady || gvrms.length === 0) return;

  const cameraPosition = camera.position.clone();

  const modelDistances = gvrms.map((gvrm, index) => {
    if (!gvrm || !gvrm.isReady || !gvrm.character || !gvrm.character.currentVrm) {
      return { index, distance: Infinity };
    }
    const modelPosition = gvrm.character.currentVrm.scene.position.clone();
    const distance = modelPosition.distanceTo(cameraPosition);
    return { index, distance };
  });

  modelDistances.sort((a, b) => b.distance - a.distance);

  modelDistances.forEach((model, sortedIndex) => {
    const { index } = model;
    const gvrm = gvrms[index];

    if (gvrm && gvrm.isReady && gvrm.gs && gvrm.gs.viewer && gvrm.gs.viewer.viewer && gvrm.gs.viewer.viewer.splatMesh) {
      gvrm.gs.viewer.viewer.splatMesh.renderOrder = sortedIndex;
    }
  });
}

function animate() {
  if (!allModelsReady) {
    requestAnimationFrame(animate);
    return;
  }

  // Update virtual time (1 frame ≈ 0.016s at 60fps, so time advances by ~0.016 * timeSpeed per frame)
  virtualTime += timeSpeed / 60; // timeSpeed is per second, so divide by 60 for per-frame
  if (virtualTime >= 24) {
    virtualTime -= 24; // Wrap around to 0 after 24 hours
  }

  // Update sky based on time
  updateSky(sky, virtualTime);

  // Update analog clock
  const hours = Math.floor(virtualTime) % 12; // 12-hour format (integer part only)
  const minutes = (virtualTime - Math.floor(virtualTime)) * 60;

  const hourHand = document.getElementById('hour-hand');
  const minuteHand = document.getElementById('minute-hand');

  if (hourHand && minuteHand) {
    // Hour hand: 30 degrees per hour + 0.5 degrees per minute
    const hourDegrees = (hours * 30) + (minutes * 0.5);
    // Minute hand: 6 degrees per minute
    const minuteDegrees = minutes * 6;

    hourHand.style.transform = `rotate(${hourDegrees}deg)`;
    minuteHand.style.transform = `rotate(${minuteDegrees}deg)`;
  }

  // Update performance system
  updatePerformanceSystem();

  for (let i = 0; i < gvrms.length; i++) {
    const gvrm = gvrms[i];
    if (gvrm && gvrm.isReady) {
      // Update entire GVRM (includes character.update() and updateByBones())
      gvrm.update();
    }
  }

  updateRenderOrder();
  controls.update();
  controls2.update();
  renderer.render(scene, camera);
  fpsc.update();
  requestAnimationFrame(animate);
}

animate();
