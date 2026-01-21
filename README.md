# 3Define: Hand-Gesture Controlled 3D Object Viewer

**3Define** is a computer vision project that allows users to manipulate 3D-scanned objects in real-time using natural hand gestures. By leveraging **OpenCV** and **MediaPipe** for hand tracking, the system maps physical movements—like pinching to zoom or twisting to rotate—directly to a digital 3D environment.

![Project Status](https://img.shields.io/badge/Status-Prototype-green) ![Python](https://img.shields.io/badge/Python-3.8+-blue) ![MediaPipe](https://img.shields.io/badge/MediaPipe-Hand_Tracking-orange)

## 📖 Overview

The goal of this project was to create a "minority report" style interface where users can interact with 3D geometry without a mouse or keyboard. The core logic uses vector math to calculate distances and angles between hand landmarks, translating them into transformation matrices for 3D meshes.

The project exists in two forms:
1.  **Python Prototype:** Uses `Open3D` and `Trimesh` for rendering and `OpenCV` for capture.
2.  **Web Deployment:** A ported version (see `index.html`) using Three.js for browser-based interaction.

## ✨ Features

* **Real-Time Hand Tracking:** Utilizes MediaPipe to track 21 distinct hand landmarks.
* **Gesture Recognition Engine:** Custom logic to detect specific hand states (fist, pinch, rotation).
* **3D Object Manipulation:**
    * **Zooming:** Pinch detection determines scale speed.
    * **Rotation:** Wrist/Hand orientation determines rotation axis and angle.
* **Interactive Modes:**
    * Pre-loaded models (Xbox Controller, Mouse).
    * Custom `.obj` file upload support.

## 🖐️ How to Control (The Gestures)

The system relies on a state machine controlled by your hand's geometry.

| Action | Gesture | Code Logic |
| :--- | :--- | :--- |
| **Activate/Reset** | **Closed Fist** | Detected when all fingertips are close to the palm (`all_x < 0.2`, `pinch_dist < 0.7`). This "zeros" the system to accept a new command. |
| **Zoom In/Out** | **Pinch** | After activation, open the hand slightly. Bringing the thumb and index finger closer (`< 0.10`) zooms in; moving them apart (`> 0.14`) zooms out. |
| **Rotate** | **U-Shape Twist** | Form a "U" shape (thumb and index up). The system tracks the vector between the thumb and middle finger. Twisting your wrist changes the angle of this vector relative to its start position. |
| **Stop** | **Hold Still** | If motion drops below a specific threshold (`MOTION_STOP_THRESHOLD`), the action pauses. |

## 📂 File Structure

### Python Core (Prototype)
* **`gestures.py`**: The main entry point. Initializes the `Interactive` object (the 3D model) and the `RunGestures` engine, then starts the loop.
* **`run_gestures.py`**: The brain of the operation.
    * Initializes MediaPipe Hands.
    * Calculates Euclidean distances and vector angles between landmarks.
    * Maintains a history deque for smoothing movements.
    * Updates the 3D visualization based on calculated states.
* **`object_parsing.py`**: Handles the 3D geometry.
    * Loads `.obj` files using `trimesh`.
    * Converts them to `Open3D` meshes for visualization.
    * Applies transformation matrices (Scaling and Rotation).
* **`capture_video.py`**: A simple utility script to test if OpenCV can access the webcam correctly before running the full app.

### Web Interface
* **`index.html`**: The frontend interface. It includes the landing page, instructions, and the container for the Three.js canvas (which replaces the Open3D window in the web version).

## 🚀 Getting Started (Python Version)

### Prerequisites
* Python 3.8+
* Webcam

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/yourusername/hand-tracker.git](https://github.com/yourusername/hand-tracker.git)
    cd hand-tracker
    ```

2.  **Install Dependencies**
    ```bash
    pip install opencv-python mediapipe numpy trimesh open3d
    ```

3.  **Run the Application**
    Ensure you have an `.obj` file in an `objects/` directory (e.g., `objects/XBOX.obj`), or adjust the path in `gestures.py`.
    ```bash
    python gestures.py
    ```

## 🧠 Technical Details

### Gesture Smoothing
Raw data from a webcam is often jittery. This project uses `collections.deque` to create a rolling buffer of gesture data (zoom history and rotation history). This allows the system to calculate the **speed** of the gesture rather than just the absolute position, resulting in smoother 3D transformations.

### Vector Math
Rotation is calculated by tracking the `curr_vec` (vector between Middle Finger Tip and Thumb Tip).
```python
# Simplified logic from run_gestures.py
angle = math.acos(dot_product / (norm1 * norm2))
