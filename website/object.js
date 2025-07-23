class Interactive {
  constructor(meshData, scene, renderer, camera) {
    // Three.js dependencies - passed from parent application
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;

    // Create Three.js mesh from provided data
    this.createMeshFromData(meshData);

    // Store original state
    this.originalCenter = this.mesh.position.clone();
    this.originalVertices = this.mesh.geometry.vertices ?
      this.mesh.geometry.vertices.map(v => v.clone()) :
      this.cloneBufferGeometryVertices();
    this.originalFaces = this.cloneGeometryFaces();
    this.currentScale = 1.0;

    // Add mesh to scene
    this.scene.add(this.mesh);
  }

  // Create Three.js mesh from loaded mesh data
  createMeshFromData(meshData) {
    let geometry, material;

    if (meshData.vertices && meshData.faces) {
      // Create geometry from vertices and faces
      geometry = new THREE.Geometry();

      // Add vertices
      meshData.vertices.forEach(vertex => {
        geometry.vertices.push(new THREE.Vector3(vertex[0], vertex[1], vertex[2]));
      });

      // Add faces
      meshData.faces.forEach(face => {
        if (face.length === 3) {
          geometry.faces.push(new THREE.Face3(face[0], face[1], face[2]));
        } else if (face.length === 4) {
          // Convert quad to two triangles
          geometry.faces.push(new THREE.Face3(face[0], face[1], face[2]));
          geometry.faces.push(new THREE.Face3(face[0], face[2], face[3]));
        }
      });

      geometry.computeVertexNormals();
      geometry.computeBoundingBox();

    } else if (meshData.geometry) {
      // Use pre-created Three.js geometry
      geometry = meshData.geometry;
    } else {
      throw new Error("Invalid mesh data format");
    }

    // Create material
    if (meshData.colors && meshData.colors.length > 0) {
      // Use vertex colors if available
      material = new THREE.MeshLambertMaterial({
        vertexColors: THREE.VertexColors,
        side: THREE.DoubleSide
      });

      // Apply vertex colors
      if (geometry.vertices) {
        geometry.colors = meshData.colors.map(color =>
          new THREE.Color(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        );
      }
    } else {
      // Default material
      material = new THREE.MeshLambertMaterial({ 
        color: 0x888888,
        side: THREE.DoubleSide
      });
    }

    this.mesh = new THREE.Mesh(geometry, material);

    // Calculate and store center
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox;
    this.originalCenter = boundingBox.getCenter(new THREE.Vector3());
    this.mesh.position.copy(this.originalCenter);
  }

  // Clone vertices for BufferGeometry (Three.js r125+)
  cloneBufferGeometryVertices() {
    if (this.mesh.geometry.isBufferGeometry) {
      const vertices = [];
      const positionAttribute = this.mesh.geometry.getAttribute('position');
      for (let i = 0; i < positionAttribute.count; i++) {
        vertices.push(new THREE.Vector3(
          positionAttribute.getX(i),
          positionAttribute.getY(i),
          positionAttribute.getZ(i)
        ));
      }
      return vertices;
    }
    return [];
  }

  // Clone geometry faces
  cloneGeometryFaces() {
    if (this.mesh.geometry.faces) {
      return this.mesh.geometry.faces.map(face => ({
        a: face.a,
        b: face.b,
        c: face.c,
        normal: face.normal.clone(),
        vertexNormals: face.vertexNormals.map(n => n.clone())
      }));
    }
    return [];
  }

  // Zoom functionality
  zoom(pinchSpeed) {
    const maxSpeed = 3.0;
    const minSpeed = -3.0;
    pinchSpeed = Math.max(Math.min(pinchSpeed, maxSpeed), minSpeed);

    const zoomFactor = 1 + pinchSpeed * 0.05;
    const proposedScale = this.currentScale * zoomFactor;

    const minScale = 0.1;
    const maxScale = 5.0;

    const clampedScale = Math.max(Math.min(proposedScale, maxScale), minScale);
    const finalZoomFactor = clampedScale / this.currentScale;

    // Apply scaling
    this.mesh.scale.multiplyScalar(finalZoomFactor);
    this.currentScale = clampedScale;
    // Trigger render
    this.render();
  }

  rotate(rotationAxis, angleRad) {
    // Normalize rotation axis
    const axis = new THREE.Vector3(rotationAxis[0], rotationAxis[1], rotationAxis[2]);
    axis.normalize();

    // Create rotation matrix
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationAxis(axis, angleRad);

    // Apply rotation around the original center
    this.mesh.position.sub(this.originalCenter);
    this.mesh.applyMatrix4(rotationMatrix);
    this.mesh.position.add(this.originalCenter);

    // Trigger render
    this.render();
  }

  // Update method combining zoom and rotation
  update(zoomFactor = 1.0, rotationAngle = 0.0, rotationAxis = [0, 0, 0]) {
    if (zoomFactor !== 1.0) {
      this.zoom(zoomFactor);
    }
    if (rotationAngle !== 0.0 || !this.isZeroVector(rotationAxis)) {
      this.rotate(rotationAxis, rotationAngle);
    }
  }

  // Helper to check if vector is zero
  isZeroVector(vec) {
    return vec[0] === 0 && vec[1] === 0 && vec[2] === 0;
  }

  // Reset to original state
  reset() {

    this.scene.remove(this.mesh);
    const geometry = new THREE.Geometry();

    this.originalVertices.forEach(vertex => {
      geometry.vertices.push(vertex.clone());
    });

    this.originalFaces.forEach(face => {
      const newFace = new THREE.Face3(face.a, face.b, face.c);
      newFace.normal = face.normal.clone();
      newFace.vertexNormals = face.vertexNormals.map(n => n.clone());
      geometry.faces.push(newFace);
    });

    geometry.computeVertexNormals();

    const material = this.mesh.material.clone();
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.originalCenter);
    this.currentScale = 1.0;
    this.scene.add(this.mesh);
    this.render();
  }


  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }


  getMesh() {
    return this.mesh;
  }

  getBoundingBox() {
    this.mesh.geometry.computeBoundingBox();
    return this.mesh.geometry.boundingBox;
  }
}


class MeshLoader {
  constructor() {
    this.objLoader = new THREE.OBJLoader ? new THREE.OBJLoader() : null;
    this.gltfLoader = new THREE.GLTFLoader ? new THREE.GLTFLoader() : null;
    this.plyLoader = new THREE.PLYLoader ? new THREE.PLYLoader() : null;
    this.stlLoader = new THREE.STLLoader ? new THREE.STLLoader() : null;
  }

  async loadMesh(filePath, fileType) {
    return new Promise((resolve, reject) => {
      const extension = fileType || this.getFileExtension(filePath);

      switch (extension.toLowerCase()) {
        case 'obj':
          if (!this.objLoader) {
            reject(new Error('OBJ loader not available'));
            return;
          }
          this.objLoader.load(filePath,
            (object) => resolve(this.processLoadedObject(object)),
            undefined,
            (error) => reject(error)
          );
          break;

        case 'gltf':
        case 'glb':
          if (!this.gltfLoader) {
            reject(new Error('GLTF loader not available'));
            return;
          }
          this.gltfLoader.load(filePath,
            (gltf) => resolve(this.processLoadedObject(gltf.scene)),
            undefined,
            (error) => reject(error)
          );
          break;

        case 'ply':
          if (!this.plyLoader) {
            reject(new Error('PLY loader not available'));
            return;
          }
          this.plyLoader.load(filePath,
            (geometry) => resolve({ geometry: geometry }),
            undefined,
            (error) => reject(error)
          );
          break;

        case 'stl':
          if (!this.stlLoader) {
            reject(new Error('STL loader not available'));
            return;
          }
          this.stlLoader.load(filePath,
            (geometry) => resolve({ geometry: geometry }),
            undefined,
            (error) => reject(error)
          );
          break;

        default:
          reject(new Error(`Unsupported file type: ${extension}`));
      }
    });
  }

  processLoadedObject(object) {
    if (object.geometry) {
      return { geometry: object.geometry };
    }

    let mesh = null;
    object.traverse((child) => {
      if (child.isMesh && !mesh) {
        mesh = child;
      }
    });

    if (mesh) {
      return {
        geometry: mesh.geometry,
        material: mesh.material
      };
    }

    throw new Error('No mesh found in loaded object');
  }

  getFileExtension(filePath) {
    return filePath.split('.').pop();
  }
}

// Example usage:
/*
// Initialize Three.js scene, renderer, camera
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);

// Load and create interactive object
const meshLoader = new MeshLoader();
meshLoader.loadMesh('path/to/your/model.obj', 'obj')
  .then(meshData => {
    const interactive = new Interactive(meshData, scene, renderer, camera);
    
    // Use with gesture tracking
    const gestureTracker = new RunGestures(interactive);
    gestureTracker.startTracking(videoElement, canvasElement);
  })
  .catch(error => console.error('Failed to load mesh:', error));
*/