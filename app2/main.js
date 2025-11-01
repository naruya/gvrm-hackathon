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

// Function to update button styles
function updateButtonStyles() {
  const homeButton = document.getElementById('home-button');
  const sceneButton = document.getElementById('sceneButton');
  const increaseButton = document.getElementById('increaseButton');
  const decreaseButton = document.getElementById('decreaseButton');

  if (currentScene === 1) {
    // Bright scene: Black
    homeButton.style.color = 'rgba(0, 0, 0, 0.7)';
    homeButton.style.borderColor = 'rgba(0, 0, 0, 0.5)';
    homeButton.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
    sceneButton.style.color = 'rgba(0, 0, 0, 0.7)';
    sceneButton.style.borderColor = 'rgba(0, 0, 0, 0.5)';
    sceneButton.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
  } else {
    // Dark scene: White
    homeButton.style.color = 'rgba(255, 255, 255, 0.4)';
    homeButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    homeButton.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    sceneButton.style.color = 'rgba(255, 255, 255, 0.4)';
    sceneButton.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    sceneButton.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
  }
}

// Set initial styles
updateButtonStyles();

const fbxFiles = [
  './assets/Breathing.fbx',
  './assets/Capoeira.fbx',
  './assets/Listening.fbx',
  './assets/Shrugging.fbx',
  './assets/Texting.fbx',
  './assets/Warrior.fbx',
  './assets/Around.fbx'
];

const gvrmFiles = [
  './assets/sample1.gvrm',
  './assets/sample2.gvrm',
  './assets/sample3.gvrm',
  './assets/sample4.gvrm',
  './assets/sample5.gvrm',
  // './assets/sample6.gvrm',
  // './assets/sample7.gvrm',
  './assets/sample8.gvrm'
  // './assets/sample9.gvrm'
];

// Limit avatar count to not exceed gvrmFiles length
const requestedN = parseInt(params.get('n')) || 3;
let N = Math.min(requestedN, 6); // Max 6 avatars

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
let lastHour = 8; // Start at 8:00 AM (same as virtualTime)
let commentsData = null;

// Load comments from JSON file
fetch('./comments.json')
  .then(response => response.json())
  .then(data => {
    commentsData = data;
    console.log('Comments loaded successfully');
  })
  .catch(error => {
    console.error('Failed to load comments:', error);
    commentsData = {}; // Fallback to empty object
  });

function createSpeechBubble(index) {
  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  bubble.textContent = 'やっほー';
  document.getElementById('speech-bubbles-container').appendChild(bubble);
  speechBubbles[index] = bubble;
  return bubble;
}

function getRandomComment(hour) {
  if (!commentsData) {
    return 'やっほー'; // Default fallback
  }

  const hourKey = String(hour);
  const comments = commentsData[hourKey];

  if (!comments || comments.length === 0) {
    return 'やっほー'; // Fallback
  }

  // Select random comment from the hour's comments
  const randomIndex = Math.floor(Math.random() * comments.length);
  return comments[randomIndex];
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

  // Hide after 3 seconds
  setTimeout(() => {
    bubble.classList.remove('show');
  }, 3000);
}

function updateSpeechBubbles() {
  const currentHour = Math.floor(virtualTime);

  // Check if hour has changed
  if (currentHour !== lastHour && gvrms.length > 0) {
    // Random character speaks
    const randomIndex = Math.floor(Math.random() * gvrms.length);

    // Get random comment for current hour
    const comment = getRandomComment(currentHour);

    showSpeechBubble(randomIndex, comment);
    lastHour = currentHour;
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

      gvrms.push(gvrm);
      // Set initial animation to Idle
      modelAnimations.push(0);

      // Create speech bubble for this character
      createSpeechBubble(gvrms.length - 1);

      // Create Walker
      const walker = new Walker(gvrm, i);
      walkers.push(walker);

      // Load Idle.fbx then initialize Walker
      gvrm.changeFBX('./assets/Idle.fbx').then(() => {
        loadCount++;
        updateLoadingDisplay();

        // Initialize Walker animations
        walker.initAnimations();

        if (loadCount === totalLoadCount) {
          allModelsReady = true;
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

// Avatar count control
const avatarCountDisplay = document.getElementById('avatarCount');
const increaseButton = document.getElementById('increaseButton');
const decreaseButton = document.getElementById('decreaseButton');

function updateAvatarCountDisplay() {
  avatarCountDisplay.textContent = N;
  decreaseButton.disabled = N <= 1;
  increaseButton.disabled = N >= 6;
}

increaseButton.addEventListener('click', async () => {
  if (N < 6 && N < gvrmFiles.length) {
    const newIndex = N;
    N++;
    totalLoadCount = N;
    updateAvatarCountDisplay();

    // Load new avatar
    const fileName = gvrmFiles[newIndex].split('/').pop();
    const gvrm = await GVRM.load(gvrmFiles[newIndex], scene, camera, renderer, fileName);

    // Set random position and rotation (avoiding center house)
    const boundary = 11.25;
    const houseRadius = 3.5;
    const pos = generateRandomPosition(boundary, houseRadius);
    const randomX = pos.x;
    const randomZ = pos.z;
    const randomRotationY = (Math.random() - 0.5) * Math.PI * 2;

    gvrm.character.currentVrm.scene.position.set(randomX, 0, randomZ);
    gvrm.character.currentVrm.scene.rotation.y = randomRotationY;

    gvrms.push(gvrm);
    modelAnimations.push(0);

    // Create speech bubble for this character
    createSpeechBubble(gvrms.length - 1);

    // Create Walker
    const walker = new Walker(gvrm, gvrms.length - 1);
    walkers.push(walker);

    // Load Idle.fbx then initialize Walker
    await gvrm.changeFBX('./assets/Idle.fbx');
    walker.initAnimations();
    loadCount++;
    updateLoadingDisplay();

    if (loadCount >= totalLoadCount) {
      allModelsReady = true;
    }
  }
});

decreaseButton.addEventListener('click', async () => {
  if (N > 1 && gvrms.length > 0) {
    N--;
    totalLoadCount = N;
    loadCount = Math.min(loadCount, N);
    updateAvatarCountDisplay();
    updateLoadingDisplay();

    // Remove last avatar
    const gvrm = gvrms.pop();
    walkers.pop();
    modelAnimations.pop();

    // Remove speech bubble
    const bubble = speechBubbles.pop();
    if (bubble && bubble.parentNode) {
      bubble.parentNode.removeChild(bubble);
    }

    if (gvrm) {
      await GVRM.remove(gvrm, scene);
    }
  }
});

updateAvatarCountDisplay();

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

// Home button handler
document.getElementById('home-button').addEventListener('click', function() {
  window.location.href = '../../index.html';
});

// Scene switch button handler
document.getElementById('sceneButton').addEventListener('click', () => {
  // Toggle scene
  currentScene = currentScene === 1 ? 2 : 1;

  // Remove and recreate grid helper
  scene.remove(gridHelper);
  if (currentScene === 1) {
    gridHelper = new THREE.GridHelper(1000, 200, 0xdfdfdf, 0xdfefdf);
  } else {
    gridHelper = new THREE.GridHelper(300, 60, 0x808080, 0x808080);
  }
  scene.add(gridHelper);

  // Remove and recreate sky
  scene.remove(sky);
  sky = createSky(scene);

  // Update button styles
  updateButtonStyles();
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
  renderer.render(scene, camera);
  fpsc.update();
  requestAnimationFrame(animate);
}

animate();
