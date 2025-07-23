import { RunGestures } from '../gestures.js';
import { Interactive } from '../object.js';
import { LogManager } from '../logmanager.js';

// Get required DOM elements
const videoElement = document.getElementById('video-container');
const threeElement = document.getElementById('three-container');
const logElement = document.getElementById('log-container');

// Utility function to extract model type from path
function getModelTypeFromPath() {
  const path = window.location.pathname;
  // Adjust this logic depending on your actual URL structure
  const parts = path.split('/');
  return parts[parts.length - 1] || 'default';
}

async function setupInteractive(scene, renderer, camera) {
  const modelType = getModelTypeFromPath();
  const objPath = `/models/${modelType}/model.obj`;

  try {
    const meshData = await loadObjMeshDataFromPath(objPath);
    const interactive = new Interactive(meshData, scene, renderer, camera);
    return interactive;
  } catch (err) {
    console.error(`Error loading OBJ for ${modelType}:`, err);
    alert("Failed to load 3D model.");
  }
}

async function loadObjMeshDataFromPath(objPath) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.OBJLoader();
    loader.load(
      objPath,
      obj => {
        resolve(obj.children[0]); // assuming the mesh is the first child
      },
      undefined,
      error => reject(error)
    );
  });
}

function initThree() {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(75, threeElement.clientWidth / threeElement.clientHeight, 0.1, 1000);
  camera.position.z = 5;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(threeElement.clientWidth, threeElement.clientHeight);
  threeElement.appendChild(renderer.domElement);

  return { scene, renderer, camera };
}

// Main entry point
(async () => {
  const path = window.location.pathname.replace('localhost:5500/', '');

  const { scene, renderer, camera } = initThree();

  let interactive = null;

  if (path.includes('xbox') || path.includes('mouse') || path.includes('uploaded')) {
    interactive = await setupInteractive(scene, renderer, camera);
  } else {
    console.warn('Interactive not initialized due to path condition.');
  }

  const app = new RunGestures({
    videoElement,
    threeElement,
    logElement,
    path,
    interactive // pass interactive instance (can be null)
  });

  app.start();
})();
