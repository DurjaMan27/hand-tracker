from object_parsing import Interactive
import math

obj = Interactive('objects/XBOX.obj')

# Rotate 45 degrees around the line y = x in the X-Y plane
obj.rotate(rotation_axis=[1, 1, 0], angle_rad=(math.pi / 4))

obj.show()
