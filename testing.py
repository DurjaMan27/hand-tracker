from object_parsing import Interactive
import math

obj = Interactive('objects/XBOX.obj')

# Rotate 45 degrees around the line y = x in the X-Y plane
obj.rotate(rotation_axis=[1, 1, 0], angle_rad=(math.pi / 4))

obj.show()

# Rotate around a custom axis through a specific point
# obj.rotate(axis_direction=[1, 1, 1], angle_degrees=90, point_on_axis=[0.1, 0.1, 0.1])
