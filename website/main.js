// main.js
// This file runs in the browser and implements the hand tracking loop using MediaPipe Hands.
// It connects to the UI in app.html and uses RunGestures for gesture logic.

// MediaPipe libraries are now loaded globally via <script> tags in index.html
// Use Hands, Camera, drawConnectors, drawLandmarks, HAND_CONNECTIONS as globals
import { Interactive } from './object_parsing.js';

// Three.js setup
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

let runGestures = null;
let interactive = null;

function createAppLayout() {
  // Remove old app sections if they exist
  const oldApp = document.getElementById('app-root');
  if (oldApp) oldApp.remove();

  // Create root container
  const appRoot = document.createElement('div');
  appRoot.id = 'app-root';
  appRoot.style.display = 'flex';
  appRoot.style.width = '100vw';
  appRoot.style.height = '100vh';
  appRoot.style.position = 'fixed';
  appRoot.style.top = '0';
  appRoot.style.left = '0';
  appRoot.style.zIndex = '1000';

  // Left section (white, 40%)
  const left = document.createElement('div');
  left.style.width = '40%';
  left.style.background = '#fff';
  left.style.display = 'flex';
  left.style.flexDirection = 'column';
  left.style.justifyContent = 'space-between';
  left.style.height = '100%';
  left.style.boxShadow = '2px 0 10px rgba(0,0,0,0.08)';
  left.style.position = 'relative';

  // Navbar
  const navbar = document.createElement('div');
  navbar.style.height = '60px';
  navbar.style.display = 'flex';
  navbar.style.alignItems = 'center';
  navbar.style.justifyContent = 'flex-start';
  navbar.style.padding = '0 24px';
  navbar.style.borderBottom = '1px solid #eee';
  navbar.style.background = '#fff';
  // EXIT button
  const exitBtn = document.createElement('button');
  exitBtn.textContent = 'EXIT';
  exitBtn.style.background = '#222';
  exitBtn.style.color = '#fff';
  exitBtn.style.border = 'none';
  exitBtn.style.borderRadius = '6px';
  exitBtn.style.padding = '10px 24px';
  exitBtn.style.fontWeight = 'bold';
  exitBtn.style.cursor = 'pointer';
  exitBtn.onclick = () => { window.location.href = '/'; };
  navbar.appendChild(exitBtn);
  left.appendChild(navbar);

  // Camera preview (centered)
  const camWrapper = document.createElement('div');
  camWrapper.style.flex = '1';
  camWrapper.style.display = 'flex';
  camWrapper.style.alignItems = 'center';
  camWrapper.style.justifyContent = 'center';
  camWrapper.style.position = 'relative';
  // Camera container
  const videoContainer = document.createElement('div');
  videoContainer.id = 'video-container';
  videoContainer.style.position = 'relative';
  videoContainer.style.width = '500px'; // Reduced width
  videoContainer.style.height = '375px'; // Reduced height
  videoContainer.style.background = '#222';
  videoContainer.style.borderRadius = '12px';
  videoContainer.style.overflow = 'hidden';
  camWrapper.appendChild(videoContainer);
  left.appendChild(camWrapper);

  // Log section (bottom)
  const logSection = document.createElement('div');
  logSection.style.height = '140px'; // Reduced height
  logSection.style.background = '#f8f8f8';
  logSection.style.borderTop = '1px solid #eee';
  logSection.style.padding = '12px 18px 18px 18px'; // Reduced padding
  logSection.style.marginBottom = '10px'; // Reduced margin
  logSection.style.overflowY = 'auto';
  logSection.style.fontSize = '1.02rem';
  logSection.style.color = '#333';
  logSection.style.fontFamily = 'monospace';
  logSection.id = 'gesture-log';
  left.appendChild(logSection);

  // Right section (black, 60%)
  const right = document.createElement('div');
  right.style.width = '60%';
  right.style.background = '#111';
  right.style.height = '100%';
  right.style.display = 'flex';
  right.style.alignItems = 'center';
  right.style.justifyContent = 'center';
  right.style.position = 'relative';
  // 3D container
  const threeContainer = document.createElement('div');
  threeContainer.id = 'three-container';
  threeContainer.style.width = '90%';
  threeContainer.style.height = '90%';
  threeContainer.style.background = 'transparent';
  right.appendChild(threeContainer);

  // Add to root
  appRoot.appendChild(left);
  appRoot.appendChild(right);
  document.body.appendChild(appRoot);

  // Return references for use in initialization
  return { videoContainer, threeContainer, logSection };
}

// Only initialize the 3D scene and object loading when we're on the app page
function initializeApp() {
  // Remove old app-root if present
  if (document.getElementById('app-root')) document.getElementById('app-root').remove();
  // Create new layout
  const { videoContainer, threeContainer, logSection } = createAppLayout();

  // Three.js setup
  const scene = new THREE.Scene();
  const camera3D = new THREE.PerspectiveCamera(75, threeContainer.offsetWidth / threeContainer.offsetHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(threeContainer.offsetWidth, threeContainer.offsetHeight);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  threeContainer.appendChild(renderer.domElement);
  camera3D.position.set(0, 0, 3);

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 7.5);
  scene.add(dirLight);

  // Responsive resize
  window.addEventListener('resize', () => {
    const width = threeContainer.offsetWidth;
    const height = threeContainer.offsetHeight;
    renderer.setSize(width, height);
    camera3D.aspect = width / height;
    camera3D.updateProjectionMatrix();
  });

  // Determine which object to load based on the URL query parameters
  function getObjectNameFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const object = params.get('object');
    if (object === 'xbox') return 'XBOX.obj';
    if (object === 'mouse') return 'mouse.obj';
    return null;
  }

  // Load 3D object
  const params = new URLSearchParams(window.location.search);
  const object = params.get('object');
  if (object === 'uploaded') {
    const objText = sessionStorage.getItem('uploadedOBJ');
    if (!objText) {
      alert('No uploaded OBJ file found. Please upload a file from the home page.');
      window.location.href = '/';
      return;
    } else {
      const loader = new OBJLoader();
      const object = loader.parse(objText);
      while (scene.children.length > 0) scene.remove(scene.children[0]);
      scene.add(object);
      // Center and scale the object
      object.traverse(function(child) {
        if (child.isMesh) {
          child.geometry.computeBoundingBox();
          const box = child.geometry.boundingBox;
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 1.5 / maxDim;
          child.scale.set(scale, scale, scale);
          const center = box.getCenter(new THREE.Vector3());
          child.position.sub(center);
        }
      });
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
    const objectFile = getObjectNameFromQuery();
    if (!objectFile) {
      console.error('Invalid object parameter');
      return;
    }
    const objPath = `/objects/${objectFile}`;
    interactive = new Interactive(objPath, scene, (mesh) => {
      // Center and scale the mesh
      if (mesh && mesh.geometry) {
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox;
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.5 / maxDim;
        mesh.scale.set(scale, scale, scale);
        const center = box.getCenter(new THREE.Vector3());
        mesh.position.sub(center);
      }
      animate();
    });
  }

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera3D);
  }

  // Hand tracking setup
  initializeHandTracking(videoContainer, logSection);
}

// Update initializeHandTracking to accept videoContainer and logSection
function initializeHandTracking(videoContainer, logSection) {
  // HTML elements
  const videoElement = document.createElement('video');
  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.playsInline = true;
  videoElement.style.position = 'absolute';
  videoElement.style.top = '0';
  videoElement.style.left = '0';
  videoElement.style.width = '100%';
  videoElement.style.height = '100%';
  videoElement.style.objectFit = 'cover';

  const canvasElement = document.createElement('canvas');
  canvasElement.width = 400;
  canvasElement.height = 300;
  canvasElement.style.position = 'absolute';
  canvasElement.style.top = '0';
  canvasElement.style.left = '0';
  canvasElement.style.width = '100%';
  canvasElement.style.height = '100%';
  canvasElement.style.pointerEvents = 'none';

  videoContainer.style.position = 'relative';
  videoContainer.style.overflow = 'hidden';
  videoContainer.appendChild(videoElement);
  videoContainer.appendChild(canvasElement);
  const canvasCtx = canvasElement.getContext('2d');

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

  runGestures = new RunGestures(logSection);
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
}

// Update RunGestures to accept logSection
class RunGestures {
  constructor(logContainer) {
    this.orientationHistory = [];
    this.zoomHistory = [];
    this.rotationHistory = [];
    this.lastActiveTime = null;
    this.initialVec = null;
    this.closedFist = false;
    this.zooming = 0;
    this.rotating = 0;
    this.MOTION_STOP_THRESHOLD = 0.065;
    this.ANGULAR_STOP_THRESHOLD = 0.2;
    this.GRACE_PERIOD = 0.8;
    this.logContainer = logContainer || document.getElementById('gesture-log');
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
        this.initialVec = [
          middle_tip.x - thumb_tip.x,
          middle_tip.y - thumb_tip.y,
          middle_tip.z - thumb_tip.z
        ];
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
        const v1_3d = [
          middle_tip.x - thumb_tip.x,
          middle_tip.y - thumb_tip.y,
          middle_tip.z - thumb_tip.z
        ];
        const v2_3d = this.initialVec || v1_3d;
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
        if (interactive) interactive.rotate(axis, incremental_angle * 0.8); // 3D object is updated live in the animate loop
        this.addLog(`Rotating: axis=[${axis.map(x => x.toFixed(2)).join(', ')}], angle=${incremental_angle.toFixed(3)}`);
        if (Math.abs(angular_speed) > this.ANGULAR_STOP_THRESHOLD) {
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

// Only run app layout if on app page
const params = new URLSearchParams(window.location.search);
const object = params.get('object');
if (object === 'xbox' || object === 'mouse' || object === 'uploaded') {
  initializeApp();
} 