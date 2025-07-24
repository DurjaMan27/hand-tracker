// main.js
// This file runs in the browser and implements the hand tracking loop using MediaPipe Hands.
// It connects to the UI in app.html and uses RunGestures for gesture logic.

import { Hands } from 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
import { Camera } from 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
// Import drawing utils if needed
import { drawConnectors, drawLandmarks, HAND_CONNECTIONS } from 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
import { Interactive } from './object_parsing.js';

// Three.js setup
import * as THREE from 'https://unpkg.com/three@0.128.0/build/three.module.js';
import { OBJLoader } from 'https://unpkg.com/three@0.128.0/examples/jsm/loaders/OBJLoader.js';

const threeContainer = document.getElementById('three-container');
const scene = new THREE.Scene();
const camera3D = new THREE.PerspectiveCamera(75, threeContainer.offsetWidth / threeContainer.offsetHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(threeContainer.offsetWidth, threeContainer.offsetHeight);
threeContainer.appendChild(renderer.domElement);
camera3D.position.z = 5;

// Determine which object to load based on the URL
function getObjectNameFromPath() {
  const path = window.location.pathname.toLowerCase();
  if (path === '/xbox') return 'XBOX.obj';
  if (path === '/mouse') return 'mouse.obj';
  return null;
}

const path = window.location.pathname.toLowerCase();
let interactive = null;

if (path === '/uploaded') {
  // Load OBJ from sessionStorage
  const objText = sessionStorage.getItem('uploadedOBJ');
  if (!objText) {
    alert('No uploaded OBJ file found. Please upload a file from the home page.');
    window.location.href = '/home';
  } else {
    // Parse and add the uploaded OBJ to the scene
    const loader = new OBJLoader();
    const object = loader.parse(objText);
    // Remove any previous objects from the scene
    while (scene.children.length > 0) scene.remove(scene.children[0]);
    scene.add(object);
    // Optionally, wrap in Interactive if you want to use the same interface
    interactive = {
      zoom: (factor) => object.scale.multiplyScalar(1 + factor * 0.05),
      rotate: (axis, angle) => {
        const axisVec = new THREE.Vector3(...axis);
        axisVec.normalize();
        object.rotateOnAxis(axisVec, angle);
      }
    };
    animate();
  }
} else {
  const objectFile = getObjectNameFromPath();
  if (!objectFile) {
    // Should not happen, as server redirects, but just in case
    throw new Error('Invalid object route');
  }
  const objPath = `./objects/${objectFile}`;
  interactive = new Interactive(objPath, scene, (mesh) => {
    animate();
  });
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera3D);
}

class RunGestures {
  constructor() {
    this.orientationHistory = [];
    this.zoomHistory = [];
    this.rotationHistory = [];
    this.lastActiveTime = null;
    this.initialVec = null;
    this.closedFist = false;
    this.zooming = 0;
    this.rotating = 0;
    this.MOTION_STOP_THRESHOLD = 0.065;
    this.GRACE_PERIOD = 1.0;
    this.logContainer = document.getElementById('gesture-log');
  }

  addLog(message) {
    if (!this.logContainer) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const timestamp = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> <span class="log-action">${message}</span>`;
    this.logContainer.appendChild(entry);
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  // Helper functions
  distance2D(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  getAngleBetweenVectors(v1, v2) {
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    const norm1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2);
    const norm2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2);
    return Math.acos(dot / (norm1 * norm2 + 1e-6));
  }

  findFingerPositions(landmarks) {
    const xValues = [];
    const yValues = [];
    const refDist = this.distance2D(landmarks[0], landmarks[9]);
    if (refDist === 0) return [false, 0, 0];
    const appendages = [3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20];
    for (const index of appendages) {
      const landmark = landmarks[index];
      xValues.push(landmark.x);
      yValues.push(landmark.y);
    }
    const stdevXNorm = std(xValues) / refDist;
    const stdevYNorm = std(yValues) / refDist;
    const wristToMiddle = this.distance2D(landmarks[0], landmarks[12]);
    const vertNorm = wristToMiddle / refDist;
    return [stdevXNorm, stdevYNorm, vertNorm];
  }

  thumbDistanceToOthers(landmarks) {
    const xValues = [];
    const yValues = [];
    const refDist = this.distance2D(landmarks[0], landmarks[9]);
    if (refDist === 0) return [false, 0, 0];
    const theOthers = [6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20];
    for (const index of theOthers) {
      const landmark = landmarks[index];
      xValues.push(landmark.x);
      yValues.push(landmark.y);
    }
    const stdX = std(xValues) / refDist;
    const stdY = std(yValues) / refDist;
    const meanX = mean(xValues);
    const meanY = mean(yValues);
    const thumbDist = this.distance2D(landmarks[4], { x: meanX, y: meanY });
    return [stdX, stdY, thumbDist / refDist];
  }

  pinchDistances(landmarks) {
    const xValues = [];
    const yValues = [];
    const refDist = this.distance2D(landmarks[0], landmarks[9]);
    if (refDist === 0) return [false, 0, 0];
    const otherFingers = [10, 11, 12, 14, 15, 16, 18, 19, 20];
    for (const index of otherFingers) {
      const landmark = landmarks[index];
      xValues.push(landmark.x);
      yValues.push(landmark.y);
    }
    const stdX = std(xValues) / refDist;
    const stdY = std(yValues) / refDist;
    const distance = this.distance2D(landmarks[4], landmarks[8]);
    return [distance, stdX, stdY];
  }

  processLandmarks(landmarks, frameTime) {
    // Ported gesture logic from Python, all thresholds and logic preserved
    this.orientationHistory.push(landmarks);
    if (this.orientationHistory.length > 100) this.orientationHistory.shift();
    const [all_x, all_y, _] = this.findFingerPositions(landmarks);
    const [four_x, four_y, thumb_dist] = this.thumbDistanceToOthers(landmarks);
    const [pinch_dist, three_x, three_y] = this.pinchDistances(landmarks);
    const thumb_tip = landmarks[4];
    const middle_tip = landmarks[12];
    const curr_vec = [middle_tip.x - thumb_tip.x, middle_tip.y - thumb_tip.y];
    const frame_time = frameTime / 1000.0; // Convert ms to seconds for parity with Python

    // Closed fist detection
    if (all_x < 0.2 && all_y < 0.2 && pinch_dist < 0.7 && thumb_dist < 0.35) {
      this.zoomHistory = [];
      this.rotationHistory = [];
      if (!this.closedFist) {
        this.addLog('Closed fist detected, ready to hear commands');
      }
      this.closedFist = true;
    }
    // Zoom gesture detection
    else if (
      this.zooming === 0 && this.rotating === 0 && this.closedFist &&
      thumb_dist > 0.5 && three_x < 0.08 && three_y < 0.25 && four_y > 0.31
    ) {
      this.zoomHistory = [];
      this.closedFist = false;
      this.zoomHistory.push([frame_time, pinch_dist]);
      this.lastActiveTime = frame_time;
      this.zooming = pinch_dist < 0.10 ? 1 : (pinch_dist > 0.14 ? 2 : 0);
      if (this.zooming === 0) {
        this.addLog('ZOOMING CANCELLED - CLOSE HAND AGAIN');
      } else if (this.zooming === 1) {
        this.addLog('Zooming in motion detected');
      } else if (this.zooming === 2) {
        this.addLog('Zooming out motion detected');
      }
    }
    // Rotation gesture detection
    else if (
      this.zooming === 0 && this.rotating === 0 && this.closedFist &&
      thumb_dist > 0.7 && four_x < 0.1 && four_y < 0.27
    ) {
      this.rotationHistory = [];
      this.closedFist = false;
      if (this.initialVec === null) {
        this.initialVec = curr_vec;
      }
      const angle = this.getAngleBetweenVectors(curr_vec, this.initialVec);
      this.rotationHistory.push([frame_time, angle]);
      this.lastActiveTime = frame_time;
      this.rotating = 1;
      this.addLog('Rotation motion detected');
    }
    // Zooming in/out
    else if (this.zooming !== 0) {
      this.zoomHistory.push([frame_time, pinch_dist]);
      if (this.zoomHistory.length >= 5) {
        const [t1, d1] = this.zoomHistory[this.zoomHistory.length - 5];
        const [t2, d2] = this.zoomHistory[this.zoomHistory.length - 1];
        const delta_dist = d2 - d1;
        const delta_time = t2 - t1 !== 0 ? t2 - t1 : 1e-6;
        const speed = delta_dist / delta_time;
        if (interactive) interactive.zoom(speed); // 3D object is updated live in the animate loop
        if (this.zooming === 1) {
          this.addLog(`Zooming in: speed=${speed.toFixed(3)}`);
        } else if (this.zooming === 2) {
          this.addLog(`Zooming out: speed=${speed.toFixed(3)}`);
        }
        if (Math.abs(speed) > this.MOTION_STOP_THRESHOLD) {
          this.lastActiveTime = frame_time;
        } else if (frame_time - this.lastActiveTime > this.GRACE_PERIOD) {
          this.zooming = 0;
          this.addLog('Zooming motion stopped');
        }
      }
    }
    // Rotating
    else if (this.rotating !== 0) {
      const angle = this.getAngleBetweenVectors(curr_vec, this.initialVec);
      this.rotationHistory.push([frame_time, angle]);
      if (this.rotationHistory.length >= 5) {
        const [t1, a1] = this.rotationHistory[this.rotationHistory.length - 5];
        const [t2, a2] = this.rotationHistory[this.rotationHistory.length - 1];
        const delta_angle = a2 - a1;
        const delta_time = t2 - t1 !== 0 ? t2 - t1 : 1e-6;
        const angular_speed = delta_angle / delta_time;
        const incremental_angle = angular_speed * (t2 - t1);
        // Calculate axis as cross product of curr_vec and initialVec
        const v1_3d = [curr_vec[0], curr_vec[1], 0];
        const v2_3d = [this.initialVec[0], this.initialVec[1], 0];
        let axis = [
          v1_3d[1] * v2_3d[2] - v1_3d[2] * v2_3d[1],
          v1_3d[2] * v2_3d[0] - v1_3d[0] * v2_3d[2],
          v1_3d[0] * v2_3d[1] - v1_3d[1] * v2_3d[0]
        ];
        const axis_norm = Math.sqrt(axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2);
        if (axis_norm < 1e-6) {
          axis = [0, 0, 1];
        } else {
          axis = axis.map(x => x / axis_norm);
        }
        if (interactive) interactive.rotate(axis, incremental_angle); // 3D object is updated live in the animate loop
        this.addLog(`Rotating: axis=[${axis.map(x => x.toFixed(2)).join(', ')}], angle=${incremental_angle.toFixed(3)}`);
        if (Math.abs(angular_speed) > this.MOTION_STOP_THRESHOLD) {
          this.lastActiveTime = frame_time;
        } else if (frame_time - this.lastActiveTime > this.GRACE_PERIOD) {
          this.rotating = 0;
          this.initialVec = null;
          this.addLog('Rotation movement stopped');
        }
      }
    }
  }
}

// Helper functions for statistics
function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

// HTML elements
const videoContainer = document.getElementById('video-container');
const videoElement = document.createElement('video');
const canvasElement = document.createElement('canvas');
const canvasCtx = canvasElement.getContext('2d');
videoContainer.appendChild(videoElement);
videoContainer.appendChild(canvasElement);
canvasElement.width = 400;
canvasElement.height = 300;

// MediaPipe Hands setup
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults(onResults);

function onResults(results) {
  // Draw the video frame
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    for (const landmarks of results.multiHandLandmarks) {
      // Draw landmarks
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
      drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1 });

      // Call gesture logic
      runGestures.processLandmarks(landmarks, performance.now());

      // Example: Draw text overlay
      canvasCtx.font = '20px Arial';
      canvasCtx.fillStyle = 'lime';
      canvasCtx.fillText('Hand Detected', 10, 30);
    }
  }
  canvasCtx.restore();
}

// Camera setup
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 400,
  height: 300
});
camera.start(); 