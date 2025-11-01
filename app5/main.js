// Copyright (c) 2025 naruya
// Licensed under the MIT License. See LICENSE file in the project root for full license information.


import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { GVRM, GVRMUtils } from 'gvrm';
import { FPSCounter } from './utils/fps.js';
import { createSky, createHouses, createCenterHouse, updateSky } from './scene.js';
import { Walker } from './walker.js';

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

// Character 1 first-person view camera
const character1Camera = new THREE.PerspectiveCamera(75.0, 1.0, 0.1, 100.0);
const character1CameraOffset = new THREE.Vector3(0, 1.5, -0.3); // Eye-level position, slightly forward

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

// Create trees
function createTree(x, z) {
  const tree = new THREE.Group();

  // Trunk
  const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.25, 2, 8);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 1;
  tree.add(trunk);

  // Foliage (leaves)
  const foliageGeometry = new THREE.SphereGeometry(1.2, 8, 8);
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Forest green
  const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
  foliage.position.y = 2.5;
  tree.add(foliage);

  tree.position.set(x, 0, z);
  scene.add(tree);
  return tree;
}

// Create flowers
function createFlower(x, z) {
  const flower = new THREE.Group();

  // Stem
  const stemGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Green
  const stem = new THREE.Mesh(stemGeometry, stemMaterial);
  stem.position.y = 0.4;
  flower.add(stem);

  // Flower head (petals)
  const petalGeometry = new THREE.SphereGeometry(0.3, 8, 8);
  const petalMaterial = new THREE.MeshStandardMaterial({ color: 0xFF69B4 }); // Hot pink
  const petals = new THREE.Mesh(petalGeometry, petalMaterial);
  petals.position.y = 0.8;
  petals.scale.set(1, 0.5, 1); // Flatten a bit
  flower.add(petals);

  // Center of flower
  const centerGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const centerMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFF00 }); // Yellow
  const center = new THREE.Mesh(centerGeometry, centerMaterial);
  center.position.y = 0.9;
  flower.add(center);

  flower.position.set(x, 0, z);
  scene.add(flower);
  return flower;
}

// Place trees and flowers in the scene
const trees = [
  createTree(-8, -5),
  createTree(7, -8),
  createTree(-6, 8),
  createTree(9, 6)
];

const flowers = [
  createFlower(-4, -3),
  createFlower(5, -4),
  createFlower(-5, 5),
  createFlower(8, 3)
];

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
  '../assets/sample6.gvrm',
  '../assets/sample7.gvrm',
  '../assets/sample8.gvrm',
  '../assets/sample9.gvrm'
];

// Character name mapping (sample filename -> display name)
const characterNames = {
  'sample1.gvrm': 'しゅりくん',
  'sample2.gvrm': 'すわさん',
  'sample3.gvrm': '鈴木さん',
  'sample4.gvrm': 'まつゆー',
  'sample5.gvrm': '清水さん',
  'sample6.gvrm': 'ふぉとんさん',
  'sample7.gvrm': '大先生',
  'sample8.gvrm': 'YouTuber',
  'sample9.gvrm': 'なまちゃん'
};

// Limit avatar count to not exceed gvrmFiles length
const requestedN = parseInt(params.get('n')) || 6;
let N = Math.min(requestedN, gvrmFiles.length); // Max 9 avatars

// Track current animation state for each model
const modelAnimations = [];

const gvrms = [];
const walkers = [];
let loadCount = 0;
let totalLoadCount = N;
window.gvrms = gvrms;

let allModelsReady = false;

const loadDisplay = document.getElementById('loaddisplay');

// Speech bubble system
const speechBubbles = [];
let lastTwoHourBlock = Math.floor(8 / 2); // Start at 8:00 AM (same as virtualTime), track 2-hour blocks
let gagsData = null;
let lastRandomSpeechTime = 0; // Track last random speech time to prevent multiple speeches

// Object detection system for Character 1
const detectableObjects = [];
const detectionCooldowns = new Map(); // Track when we last detected each object
const DETECTION_COOLDOWN = 5000; // 5 seconds cooldown per object
let detectionComments = null; // Comments for detected objects

// Function to register detectable objects
function registerDetectableObject(name, object3D) {
  detectableObjects.push({ name, object: object3D });
}

// Function to check if object is in character's view using position and direction
function isObjectInCharacterView(character, object3D, maxDistance = 15, minDotProduct = 0.5) {
  // Get character's position and forward direction
  const characterPos = character.position.clone();
  const characterForward = new THREE.Vector3(0, 0, -1); // Default forward is -Z
  characterForward.applyQuaternion(character.quaternion);

  // Get object position
  const objectPos = object3D.position.clone();

  // Calculate vector from character to object
  const toObject = objectPos.clone().sub(characterPos);
  const distance = toObject.length();

  // Check if within max distance
  if (distance > maxDistance) {
    return false;
  }

  // Normalize the vector
  toObject.normalize();

  // Check if object is in front of character (dot product > threshold)
  // dot product of 1 = directly ahead, 0.5 ≈ 60 degree cone
  const dotProduct = characterForward.dot(toObject);

  return dotProduct > minDotProduct;
}

// Function to check visible objects and make Character 1 comment
function checkVisibleObjects() {
  if (!gvrms[0] || !gvrms[0].isReady || !gvrms[0].character || !gvrms[0].character.currentVrm) return;
  if (!detectionComments) return; // Wait for comments to load

  const character1 = gvrms[0].character.currentVrm.scene;
  const now = Date.now();

  for (const detectable of detectableObjects) {
    const { name, object } = detectable;

    // Skip if object doesn't exist
    if (!object) continue;

    // Check cooldown
    const lastDetection = detectionCooldowns.get(name);
    if (lastDetection && (now - lastDetection) < DETECTION_COOLDOWN) {
      continue;
    }

    // Check if object is in character's view (using position and direction)
    if (isObjectInCharacterView(character1, object)) {
      // Object is in view! Make Character 1 comment with additional comment
      const comment = detectionComments[name] || '';
      const fullComment = comment ? `あ、${name}だ。${comment}` : `あ、${name}だ`;
      showSpeechBubble(0, fullComment);
      detectionCooldowns.set(name, now);

      // Add to timeline
      addTimelineEvent(virtualTime, `しゅりくん: ${fullComment}`);
    }
  }
}

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

// Load detection comments from JSON file
fetch('./detection_comments.json')
  .then(response => response.json())
  .then(data => {
    detectionComments = data;
    console.log('Detection comments loaded successfully');
  })
  .catch(error => {
    console.error('Failed to load detection comments:', error);
    detectionComments = {}; // Fallback to empty object
  });

function createSpeechBubble(index) {
  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  bubble.textContent = 'やっほー';
  document.getElementById('speech-bubbles-container').appendChild(bubble);
  speechBubbles[index] = bubble;
  return bubble;
}

function getRandomGag() {
  if (!gagsData || gagsData.length === 0) {
    return 'やっほー'; // Default fallback
  }

  // Select random gag from the list
  const randomIndex = Math.floor(Math.random() * gagsData.length);
  return gagsData[randomIndex];
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

  // Hide after 9 seconds
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

function updateSpeechBubbles() {
  const currentTwoHourBlock = Math.floor(virtualTime / 2);
  const now = Date.now();

  // Check if 2-hour block has changed AND enough time has passed since last speech
  if (currentTwoHourBlock !== lastTwoHourBlock && gvrms.length > 1 && (now - lastRandomSpeechTime) > 1000) {
    // Update block immediately to prevent multiple speeches
    lastTwoHourBlock = currentTwoHourBlock;

    // Get list of characters not currently speaking (excluding Character 1, index 0)
    const availableIndices = [];
    for (let i = 1; i < gvrms.length; i++) { // Start from 1 to exclude Character 1
      // Check if this character's speech bubble is not currently visible
      if (!speechBubbles[i] || !speechBubbles[i].classList.contains('show')) {
        availableIndices.push(i);
      }
    }

    // Only speak if there's at least one available character
    if (availableIndices.length > 0) {
      // Pick only ONE random character to speak
      const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];

      // Get random gag
      const gag = getRandomGag();

      showSpeechBubble(randomIndex, gag);
      lastRandomSpeechTime = now; // Record speech time
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

// Function to shuffle and assign animations without duplicates
function shuffleAnimations() {
  const indices = [...Array(fbxFiles.length).keys()];

  // Shuffle indices using Fisher-Yates algorithm
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices;
}

// Generate random position avoiding center house
function generateRandomPosition(boundary, houseRadius) {
  let validPosition = false;
  let attempts = 0;
  const maxAttempts = 50;
  let x, z;

  while (!validPosition && attempts < maxAttempts) {
    x = (Math.random() - 0.5) * boundary * 2;
    z = (Math.random() - 0.5) * boundary * 2;

    // Check if position is outside house exclusion zone
    const distanceFromCenter = Math.sqrt(x * x + z * z);

    if (distanceFromCenter > houseRadius) {
      validPosition = true;
    }

    attempts++;
  }

  // Fallback: place at boundary edge if no valid position found
  if (!validPosition) {
    const angle = Math.random() * Math.PI * 2;
    const radius = boundary * 0.8;
    x = Math.cos(angle) * radius;
    z = Math.sin(angle) * radius;
  }

  return { x, z };
}

async function loadAllModels() {
  const boundary = 11.25; // 1.5x larger boundary (same as walker)
  const houseRadius = 3.5; // Exclusion zone around center house

  // Register center house as detectable
  registerDetectableObject('家', centerHouse);

  // Register trees as detectable objects
  trees.forEach((tree) => {
    registerDetectableObject('木', tree);
  });

  // Register flowers as detectable objects
  flowers.forEach((flower) => {
    registerDetectableObject('花', flower);
  });

  for (let i = 0; i < N; i++) {
    const fileName = gvrmFiles[i].split('/').pop();
    const promise = GVRM.load(gvrmFiles[i], scene, camera, renderer, fileName);

    promise.then((gvrm) => {
      // Generate random initial position (avoiding center house)
      const pos = generateRandomPosition(boundary, houseRadius);
      const randomX = pos.x;
      const randomZ = pos.z;
      const randomY = 0;

      // Generate random initial rotation
      const randomRotationY = (Math.random() - 0.5) * Math.PI * 2; // -π to π

      gvrm.character.currentVrm.scene.position.set(randomX, randomY, randomZ);
      gvrm.character.currentVrm.scene.rotation.y = randomRotationY;

      const characterIndex = gvrms.length;
      gvrms.push(gvrm);
      // Set initial animation to Idle
      modelAnimations.push(0);

      // Create speech bubble for this character
      createSpeechBubble(gvrms.length - 1);

      // Register as detectable object (except Character 1 at index 0)
      if (characterIndex > 0) {
        // Use mapped character name if available, otherwise use generic name
        const characterName = characterNames[fileName] || `キャラクター${characterIndex + 1}`;
        registerDetectableObject(characterName, gvrm.character.currentVrm.scene);
      }

      // Create Walker
      const walker = new Walker(gvrm, i);
      walkers.push(walker);

      // Load Idle.fbx then initialize Walker
      gvrm.changeFBX('../assets/Idle.fbx').then(() => {
        loadCount++;
        updateLoadingDisplay();

        // Initialize Walker animations
        walker.initAnimations();

        if (loadCount === totalLoadCount) {
          allModelsReady = true;
          // Initialize InteractionManager once all models are ready
          // Interaction manager removed
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

// Object detection frame counter (check every N frames for performance)
let detectionFrameCounter = 0;
const DETECTION_CHECK_INTERVAL = 10; // Check every 10 frames (~6 times per second at 60fps)

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

  // Update speech bubbles
  updateSpeechBubbles();

  // Check for visible objects (Character 1's view) every N frames
  detectionFrameCounter++;
  if (detectionFrameCounter >= DETECTION_CHECK_INTERVAL) {
    checkVisibleObjects();
    detectionFrameCounter = 0;
  }

  for (let i = 0; i < gvrms.length; i++) {
    const gvrm = gvrms[i];
    if (gvrm && gvrm.isReady) {
      // Update Walker
      if (walkers[i]) {
        walkers[i].update();
      }

      // Update entire GVRM (includes character.update() and updateByBones())
      gvrm.update();
    }
  }

  updateRenderOrder();
  controls.update();
  controls2.update();

  // Render main view
  renderer.setViewport(0, 0, width, height);
  renderer.setScissor(0, 0, width, height);
  renderer.setScissorTest(true);
  renderer.render(scene, camera);

  // Update and render character 1's first-person view
  if (gvrms.length > 0 && gvrms[0] && gvrms[0].isReady && gvrms[0].character && gvrms[0].character.currentVrm) {
    const character = gvrms[0].character.currentVrm.scene;

    // Position camera at character's eye level
    character1Camera.position.copy(character.position).add(
      character1CameraOffset.clone().applyQuaternion(character.quaternion)
    );

    // Match character's rotation
    character1Camera.quaternion.copy(character.quaternion);

    // Render to bottom right viewport
    const viewWidth = 320;
    const viewHeight = 240;
    const viewX = width - viewWidth - 20; // 20px from right edge
    const viewY = 20; // 20px from bottom

    character1Camera.aspect = viewWidth / viewHeight;
    character1Camera.updateProjectionMatrix();

    renderer.setViewport(viewX, viewY, viewWidth, viewHeight);
    renderer.setScissor(viewX, viewY, viewWidth, viewHeight);
    renderer.render(scene, character1Camera);
  }

  renderer.setScissorTest(false);

  fpsc.update();
  requestAnimationFrame(animate);
}

animate();
