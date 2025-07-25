import cv2
import mediapipe as mp
import numpy as np
import math, statistics
from collections import deque
from types import SimpleNamespace
import time
from datetime import datetime, timedelta
import os
import logging
from original_python_code.run_gestures import RunGestures
from original_python_code.object_parsing import Interactive

object = Interactive("objects/XBOX.obj")
gestures = RunGestures("logs/run_log.log", object)
gestures.run_program()
