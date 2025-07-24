// object_parsing.js
// JavaScript version of the Interactive class using Three.js for 3D object manipulation
// This class handles zoom, rotate, update, show, and reset for a 3D object

import * as THREE from 'https://unpkg.com/three@0.128.0/build/three.module.js';
import { OBJLoader } from 'https://unpkg.com/three@0.128.0/examples/jsm/loaders/OBJLoader.js';

export class Interactive {
  constructor(objPath, scene, onLoad) {
    this.scene = scene;
    this.currentScale = 1.0;
    this.originalCenter = new THREE.Vector3(0, 0, 0);
    this.mesh = null;
    this.ORIGINAL_OBJECT = null;
    this.loader = new OBJLoader();
    this.loader.load(objPath, (object) => {
      // Assume the OBJ is a single mesh
      this.mesh = object.children[0];
      this.mesh.geometry.computeBoundingBox();
      this.originalCenter = this.mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
      this.ORIGINAL_OBJECT = this.mesh.clone();
      this.scene.add(this.mesh);
      if (onLoad) onLoad(this.mesh);
    });
  }

  zoom(pinchSpeed) {
    const maxSpeed = 3.0;
    const minSpeed = -3.0;
    pinchSpeed = Math.max(Math.min(pinchSpeed, maxSpeed), minSpeed);
    const zoomFactor = 1 + pinchSpeed * 0.05;
    const proposedScale = this.currentScale * zoomFactor;
    const minScale = 1.0;
    const maxScale = 5.0;
    const clampedScale = Math.max(Math.min(proposedScale, maxScale), minScale);
    const scaleChange = clampedScale / this.currentScale;
    if (this.mesh) {
      this.mesh.scale.multiplyScalar(scaleChange);
    }
    this.currentScale = clampedScale;
  }

  rotate(rotationAxis, angleRad) {
    if (!this.mesh) return;
    const axis = new THREE.Vector3(...rotationAxis);
    if (axis.length() === 0) return;
    axis.normalize();
    // Rotate around the object's center
    const center = this.originalCenter.clone();
    this.mesh.position.sub(center);
    this.mesh.applyMatrix4(new THREE.Matrix4().makeRotationAxis(axis, angleRad));
    this.mesh.position.add(center);
    this.mesh.geometry.computeVertexNormals();
  }

  update({ zoomFactor = 1.0, rotationAngle = 0.0, rotationAxis = [0, 0, 0] }) {
    if (zoomFactor !== 1.0) {
      this.zoom(zoomFactor);
    }
    if (rotationAngle !== 0.0 || rotationAxis.some(v => v !== 0)) {
      this.rotate(rotationAxis, rotationAngle);
    }
  }

  show() {
    // In Three.js, the mesh is already in the scene and rendered by the animation loop
    // This method can be used to trigger a render if needed
  }

  reset() {
    if (!this.mesh || !this.ORIGINAL_OBJECT) return;
    // Remove current mesh
    this.scene.remove(this.mesh);
    // Clone the original object
    this.mesh = this.ORIGINAL_OBJECT.clone();
    this.currentScale = 1.0;
    this.scene.add(this.mesh);
  }
} 