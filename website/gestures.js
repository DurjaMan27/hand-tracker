class RunGestures {
  constructor(interactive_obj) {
    this.interactive = interactive_obj;

    // Initialize MediaPipe Hands
    this.hands = null;
    this.camera = null;
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;

    // History tracking (using arrays instead of deque)
    this.orientationHistory = [];
    this.zoomHistory = [];
    this.rotationHistory = [];
    this.maxOrientationHistory = 100;
    this.maxZoomHistory = 50;
    this.maxRotationHistory = 50;
    this.logger = new LogManager('gesture-log')

    // State variables
    this.lastActiveTime = null;
    this.initialVec = null;
    this.closedFist = false;
    this.zooming = 0;
    this.rotating = 0;

    // Constants
    this.MOTION_STOP_THRESHOLD = 0.065;
    this.GRACE_PERIOD = 1.0;

    this.initializeMediaPipe();
  }

  // Initialize MediaPipe Hands
  async initializeMediaPipe() {
    // Load MediaPipe Hands
    this.hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    this.hands.onResults(this.onResults.bind(this));
  }

  // Setup camera and canvas
  async setupCamera(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.canvasCtx = canvasElement.getContext('2d');

    // Setup camera
    this.camera = new Camera(videoElement, {
      onFrame: async () => {
        await this.hands.send({ image: videoElement });
      },
      width: 600,
      height: 500
    });
    await this.camera.start();
  }

  // MediaPipe results callback
  onResults(results) {
    const frameTime = performance.now() / 1000; // Convert to seconds

    // Clear canvas
    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

    // Draw the video frame
    this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const handLandmarks = results.multiHandLandmarks[0];

      // Draw hand landmarks
      this.drawConnectors(this.canvasCtx, handLandmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
      this.drawLandmarks(this.canvasCtx, handLandmarks, { color: '#FF0000', lineWidth: 2 });

      // Add to orientation history
      this.addToHistory(this.orientationHistory, handLandmarks, this.maxOrientationHistory);

      // Calculate gesture metrics
      const { allX, allY } = this.findFingerPositions(handLandmarks);
      const { fourX, fourY, thumbDist } = this.thumbDistanceToOthers(handLandmarks);
      const { pinchDist, threeX, threeY } = this.pinchDistances(handLandmarks);

      // Get thumb-middle finger vector
      const thumbTip = handLandmarks[4];
      const middleTip = handLandmarks[12];
      const currVec = [middleTip.x - thumbTip.x, middleTip.y - thumbTip.y];

      // Gesture detection logic
      if (allX < 0.2 && allY < 0.2 && pinchDist < 0.7 && thumbDist < 0.35) {
        // Closed fist detected
        this.zoomHistory = [];
        this.rotationHistory = [];

        this.drawText('closed fist', 460, 50, '#00FF00');

        if (!this.closedFist) {
          this.logger.addLog("Closed fist detected, ready to hear commands");
        }
        this.closedFist = true;

      } else if (this.zooming === 0 && this.rotating === 0 && this.closedFist &&
                  thumbDist > 0.5 && threeX < 0.08 && threeY < 0.25 && fourY > 0.31) {
        // Zoom gesture detected
        this.zoomHistory = [];
        this.closedFist = false;

        this.addToHistory(this.zoomHistory, [frameTime, pinchDist], this.maxZoomHistory);
        this.lastActiveTime = frameTime;

        this.zooming = pinchDist < 0.10 ? 1 : (pinchDist > 0.14 ? 2 : 0);

        if (this.zooming === 0) {
          this.logger.addLog("ZOOMING CANCELLED - CLOSE FIST TO TRY AGAIN");
        } else if (this.zooming === 1) {
          this.logger.addLog("Zooming in motion detected");
        } else if (this.zooming === 2) {

          this.logger.addLog("Zooming out motion detected");
        }

      } else if (this.zooming === 0 && this.rotating === 0 && this.closedFist &&
                  thumbDist > 0.7 && fourX < 0.1 && fourY < 0.27) {
        // Rotation gesture detected
        this.rotationHistory = [];
        this.closedFist = false;

        if (this.initialVec === null) {
          this.initialVec = currVec;
        }

        const angle = this.getAngleBetweenVectors(currVec, this.initialVec);
        this.addToHistory(this.rotationHistory, [frameTime, angle], this.maxRotationHistory);
        this.lastActiveTime = frameTime;

        this.rotating = 1;
        this.logger.addLog("Rotation motion detected");

      } else if (this.zooming !== 0) {
        // Continue zooming
        this.addToHistory(this.zoomHistory, [frameTime, pinchDist], this.maxZoomHistory);

        if (this.zooming === 1) {
          this.drawText('zooming in', 400, 50, '#00FF00');
        } else if (this.zooming === 2) {
          this.drawText('zooming out', 400, 50, '#00FF00');
        }

        if (this.zoomHistory.length >= 5) {
          const [t1, d1] = this.zoomHistory[this.zoomHistory.length - 5];
          const [t2, d2] = this.zoomHistory[this.zoomHistory.length - 1];
          const deltaDist = d2 - d1;
          const deltaTime = t2 !== t1 ? t2 - t1 : 1e-6;

          const speed = deltaDist / deltaTime;
          this.updateVisualization("zoom", speed);

          if (Math.abs(speed) > this.MOTION_STOP_THRESHOLD) {
            this.lastActiveTime = frameTime;
          } else if (frameTime - this.lastActiveTime > this.GRACE_PERIOD) {
            this.zooming = 0;
            this.logger.addLog("Zooming motion stopped");
          }
        }

      } else if (this.rotating !== 0) {
        // Continue rotating
        const angle = this.getAngleBetweenVectors(currVec, this.initialVec);
        this.addToHistory(this.rotationHistory, [frameTime, angle], this.maxRotationHistory);

        this.drawText('rotating', 400, 50, '#00FF00');

        if (this.rotationHistory.length >= 5) {
          const [t1, a1] = this.rotationHistory[this.rotationHistory.length - 5];
          const [t2, a2] = this.rotationHistory[this.rotationHistory.length - 1];
          const deltaAngle = a2 - a1;
          const deltaTime = t2 !== t1 ? t2 - t1 : 1e-6;

          const angularSpeed = deltaAngle / deltaTime;
          const incrementalAngle = angularSpeed * (t2 - t1);

          // Calculate rotation axis
          const v1_3d = [currVec[0], currVec[1], 0];
          const v2_3d = [this.initialVec[0], this.initialVec[1], 0];
          let axis = this.crossProduct(v1_3d, v2_3d);
          const axisNorm = this.vectorMagnitude(axis);

          if (axisNorm < 1e-6) {
            axis = [0, 0, 1];
          } else {
            axis = axis.map(component => component / axisNorm);
          }

          this.updateVisualization("rotate", 0, axis, incrementalAngle);

          if (Math.abs(angularSpeed) > this.MOTION_STOP_THRESHOLD) {
            this.lastActiveTime = frameTime;
          } else if (frameTime - this.lastActiveTime > this.GRACE_PERIOD) {
            this.rotating = 0;
            this.initialVec = null;
            this.logger.addLog("Rotation movement stopped");
          }
        }
      }
    }

    this.canvasCtx.restore();
  }

  // Helper method to add items to history arrays with max length
  addToHistory(historyArray, item, maxLength) {
    historyArray.push(item);
    if (historyArray.length > maxLength) {
      historyArray.shift();
    }
  }

  // ---- HELPER FUNCTIONS -----

  // Calculate 2D distance between two points
  distance2D(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  // Calculate standard deviation of an array
  standardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  // Calculate mean of an array
  mean(values) {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  // Find finger positions (matching Python implementation)
  findFingerPositions(handLandmarks) {
    const xValues = [];
    const yValues = [];

    const refDist = this.distance2D(handLandmarks[0], handLandmarks[9]);
    if (refDist === 0) {
      return { allX: false, allY: 0, vertNorm: 0 };
    }

    const appendages = [3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20];
    for (const index of appendages) {
      const landmark = handLandmarks[index];
      xValues.push(landmark.x);
      yValues.push(landmark.y);
    }

    const stdevXNorm = this.standardDeviation(xValues) / refDist;
    const stdevYNorm = this.standardDeviation(yValues) / refDist;

    const wristToMiddle = this.distance2D(handLandmarks[0], handLandmarks[12]);
    const vertNorm = wristToMiddle / refDist;

    return {
      allX: stdevXNorm,
      allY: stdevYNorm,
      vertNorm: vertNorm
    };
  }

  // Calculate thumb distance to other fingers (matching Python implementation)
  thumbDistanceToOthers(handLandmarks) {
    const xValues = [];
    const yValues = [];

    const refDist = this.distance2D(handLandmarks[0], handLandmarks[9]);
    if (refDist === 0) {
      return { fourX: false, fourY: 0, thumbDist: 0 };
    }

    const theOthers = [6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20];
    for (const index of theOthers) {
      const landmark = handLandmarks[index];
      xValues.push(landmark.x);
      yValues.push(landmark.y);
    }

    const stdX = this.standardDeviation(xValues) / refDist;
    const stdY = this.standardDeviation(yValues) / refDist;

    const meanX = this.mean(xValues);
    const meanY = this.mean(yValues);
    const thumbDist = this.distance2D(handLandmarks[4], { x: meanX, y: meanY });

    return {
      fourX: stdX,
      fourY: stdY,
      thumbDist: thumbDist / refDist
    };
  }

  // Calculate pinch distances (matching Python implementation)
  pinchDistances(handLandmarks) {
    const xValues = [];
    const yValues = [];

    const refDist = this.distance2D(handLandmarks[0], handLandmarks[9]);
    if (refDist === 0) {
      return { pinchDist: false, threeX: 0, threeY: 0 };
    }

    const otherFingers = [10, 11, 12, 14, 15, 16, 18, 19, 20];
    for (const index of otherFingers) {
      const landmark = handLandmarks[index];
      xValues.push(landmark.x);
      yValues.push(landmark.y);
    }

    const stdX = this.standardDeviation(xValues) / refDist;
    const stdY = this.standardDeviation(yValues) / refDist;

    const distance = this.distance2D(handLandmarks[4], handLandmarks[8]);

    return {
      pinchDist: distance,
      threeX: stdX,
      threeY: stdY
    };
  }

  // Calculate angle between two vectors
  getAngleBetweenVectors(vec1, vec2) {
    const dot = vec1[0] * vec2[0] + vec1[1] * vec2[1];
    const mag1 = Math.sqrt(vec1[0] * vec1[0] + vec1[1] * vec1[1]);
    const mag2 = Math.sqrt(vec2[0] * vec2[0] + vec2[1] * vec2[1]);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cosAngle = dot / (mag1 * mag2);
    return Math.acos(Math.max(-1, Math.min(1, cosAngle)));
  }

  // Cross product for 3D vectors
  crossProduct(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  // Vector magnitude
  vectorMagnitude(vec) {
    return Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
  }

  // Update visualization (calls your interactive object)
  updateVisualization(actionType, zoomSpeed = 0.0, rotationAxis = null, angleRad = 0.0) {
    if (actionType === "zoom") {
      this.interactive.zoom(zoomSpeed);
    } else if (actionType === "rotate") {
      this.interactive.rotate(rotationAxis, angleRad);
    }
  }

  // Draw text on canvas
  drawText(text, x, y, color = '#00FF00') {
    this.canvasCtx.font = '20px Arial';
    this.canvasCtx.fillStyle = color;
    this.canvasCtx.fillText(text, x, y);
  }

  // Draw landmarks helper
  drawLandmarks(ctx, landmarks, style) {
    if (landmarks) {
      for (const landmark of landmarks) {
        ctx.beginPath();
        ctx.arc(
          landmark.x * this.canvasElement.width,
          landmark.y * this.canvasElement.height,
          style.lineWidth,
          0,
          2 * Math.PI
        );
        ctx.fillStyle = style.color;
        ctx.fill();
      }
    }
  }

  // Draw connections helper
  drawConnectors(ctx, landmarks, connections, style) {
    if (landmarks) {
      for (const connection of connections) {
        const start = landmarks[connection[0]];
        const end = landmarks[connection[1]];

        ctx.beginPath();
        ctx.moveTo(
          start.x * this.canvasElement.width,
          start.y * this.canvasElement.height
        );
        ctx.lineTo(
          end.x * this.canvasElement.width,
          end.y * this.canvasElement.height
        );
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.lineWidth;
        ctx.stroke();
      }
    }
  }

  // Start the gesture tracking
  async startTracking(videoElement, canvasElement) {
    await this.setupCamera(videoElement, canvasElement);
    console.log("Gesture tracking started");
  }

  // Stop tracking and cleanup
  stop() {
    if (this.camera) {
      this.camera.stop();
    }
    console.log("Gesture tracking stopped");
  }
}