// Converted from run_gestures.py to JavaScript for Node.js/Express
// Note: Computer vision and hand tracking logic (OpenCV, MediaPipe) are not directly available in Node.js.
// Use browser-based libraries or WebAssembly for actual implementation.

const fs = require('fs');
const path = require('path');
const express = require('express');
const { performance } = require('perf_hooks');
const { Interactive } = require('./object_parsing'); // Placeholder: implement or import equivalent

class RunGestures {
  constructor(logFilePath, interactiveObj) {
    this.logFilePath = logFilePath;
    this.interactive = interactiveObj;
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
    // Setup logging
    this.logger = fs.createWriteStream(logFilePath, { flags: 'w' });
  }

  log(message) {
    const msg = `${message}\n`;
    this.logger.write(msg);
    console.log(message);
  }

  updateVisualization(actionType, zoomSpeed = 0.0, rotationAxis = 0.0, angleRad = 0.0) {
    if (actionType === 'zoom') {
      this.interactive.zoom(zoomSpeed);
    } else if (actionType === 'rotate') {
      this.interactive.rotate(rotationAxis, angleRad);
    }
  }

  // Placeholder: This function would be implemented in the browser using TensorFlow.js, MediaPipe, or similar
  runProgram() {
    // In a web app, this would be handled by client-side code using the webcam and hand tracking
    // See main.js for the actual implementation
    this.log('runProgram called - see main.js for browser implementation');
  }

  // ---- HELPER FUNCTIONS -----

  distance2D(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  getAngleBetweenVectors(v1, v2) {
    const dot = v1[0]*v2[0] + v1[1]*v2[1];
    const norm1 = Math.sqrt(v1[0]**2 + v1[1]**2);
    const norm2 = Math.sqrt(v2[0]**2 + v2[1]**2);
    return Math.acos(dot / (norm1 * norm2 + 1e-6));
  }

  findFingerPositions(handLandmarks) {
    const xValues = [];
    const yValues = [];
    const refDist = this.distance2D(handLandmarks[0], handLandmarks[9]);
    if (refDist === 0) return [false, 0, 0];
    const appendages = [3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20];
    for (const index of appendages) {
      const landmark = handLandmarks[index];
      xValues.push(landmark.x);
      yValues.push(landmark.y);
    }
    const stdevXNorm = std(xValues) / refDist;
    const stdevYNorm = std(yValues) / refDist;
    const wristToMiddle = this.distance2D(handLandmarks[0], handLandmarks[12]);
    const vertNorm = wristToMiddle / refDist;
    return [stdevXNorm, stdevYNorm, vertNorm];
  }

  thumbDistanceToOthers(handLandmarks) {
    const xValues = [];
    const yValues = [];
    const refDist = this.distance2D(handLandmarks[0], handLandmarks[9]);
    if (refDist === 0) return [false, 0, 0];
    const theOthers = [6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20];
    for (const index of theOthers) {
      const landmark = handLandmarks[index];
      xValues.push(landmark.x);
      yValues.push(landmark.y);
    }
    const stdX = std(xValues) / refDist;
    const stdY = std(yValues) / refDist;
    const meanX = mean(xValues);
    const meanY = mean(yValues);
    const thumbDist = this.distance2D(handLandmarks[4], { x: meanX, y: meanY });
    return [stdX, stdY, thumbDist / refDist];
  }

  pinchDistances(handLandmarks) {
    const xValues = [];
    const yValues = [];
    const refDist = this.distance2D(handLandmarks[0], handLandmarks[9]);
    if (refDist === 0) return [false, 0, 0];
    const otherFingers = [10, 11, 12, 14, 15, 16, 18, 19, 20];
    for (const index of otherFingers) {
      const landmark = handLandmarks[index];
      xValues.push(landmark.x);
      yValues.push(landmark.y);
    }
    const stdX = std(xValues) / refDist;
    const stdY = std(yValues) / refDist;
    const distance = this.distance2D(handLandmarks[4], handLandmarks[8]);
    return [distance, stdX, stdY];
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

// Export the class for use in other modules
module.exports = { RunGestures }; 