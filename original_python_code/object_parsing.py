import os
import numpy as np
import trimesh
import open3d as o3d
import copy

class Interactive():

  def __init__(self, obj_path):
    self.trimesh_obj = trimesh.load(obj_path, force = 'mesh')

    self.mesh = o3d.geometry.TriangleMesh(
      vertices = o3d.utility.Vector3dVector(self.trimesh_obj.vertices),
      triangles = o3d.utility.Vector3iVector(self.trimesh_obj.faces)
    )
    self.mesh.compute_vertex_normals()

    if hasattr(self.trimesh_obj.visual, 'vertex_colors') and self.trimesh_obj.visual.vertex_colors is not None:
      colors = self.trimesh_obj.visual.vertex_colors[:, :3] / 255.0
      self.mesh.vertex_colors = o3d.utility.Vector3dVector(colors)

    self.original_center = self.mesh.get_center()
    self.ORIGINAL_OBJECT = copy.deepcopy(self.mesh)
    self.current_scale = 1.0

  def zoom(self, pinch_speed):
    max_speed = 3.0
    min_speed = -3.0
    pinch_speed = max(min(pinch_speed, max_speed), min_speed)

    zoom_factor = 1 + pinch_speed * 0.05
    proposed_scale = self.current_scale * zoom_factor

    min_scale = 1.0
    max_scale = 5.0

    clamped_scale = max(min(proposed_scale, max_scale), min_scale)
    zoom_factor = clamped_scale / self.current_scale

    self.mesh.scale(zoom_factor, center=self.original_center)
    self.current_scale = clamped_scale


  def rotate(self, rotation_axis: list, angle_rad: float):
    axis = np.array(rotation_axis, dtype=float)
    axis /= np.linalg.norm(axis)

    rotation_matrix = trimesh.transformations.rotation_matrix(
      angle_rad, axis, point=self.original_center
    )

    vertices = np.asarray(self.mesh.vertices)
    num_vertices = vertices.shape[0]
    vertices_homogeneous = np.hstack((vertices, np.ones((num_vertices, 1))))
    transformed_vertices = (rotation_matrix @ vertices_homogeneous.T).T[:, :3]

    self.mesh.vertices = o3d.utility.Vector3dVector(transformed_vertices)
    self.mesh.compute_vertex_normals()

  def update(self, zoom_factor = 1.0, rotation_angle = 0.0, rotation_axis = [0, 0, 0]):
    if zoom_factor != 1.0:
      self.zoom(zoom_factor)
    if rotation_angle != 0.0 or rotation_axis != [0, 0, 0]:
      self.rotate(rotation_axis, rotation_angle)

  def show(self):
    o3d.visualization.draw_geometries([self.mesh])

  def reset(self):
    self.mesh = o3d.geometry.TriangleMesh(
      vertices=o3d.utility.Vector3dVector(self.ORIGINAL_OBJECT.vertices),
      triangles=o3d.utility.Vector3iVector(self.ORIGINAL_OBJECT.faces)
    )
    self.mesh.compute_vertex_normals()