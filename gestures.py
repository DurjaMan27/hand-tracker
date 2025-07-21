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

logging.basicConfig(
  level = logging.INFO,
  format='%(message)s',
  handlers=[
    logging.FileHandler("logs/run_log.log"),
    logging.StreamHandler()
  ]
)

cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, value=600)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, value=500)

mp_drawing = mp.solutions.drawing_utils
mp_hands = mp.solutions.hands
hand = mp_hands.Hands()

def distance2D(p1, p2):
  return math.hypot(p1.x - p2.x, p1.y - p2.y)

def get_angle_between_vectors(v1, v2):
  dot = sum(a * b for a, b in zip(v1, v2))
  norm1 = math.sqrt(sum(a**2 for a in v1))
  norm2 = math.sqrt(sum(b**2 for b in v2))
  return math.acos(dot / (norm1 * norm2 + 1e-6))

def find_finger_positions(hand_landmarks):
  x_values = []
  y_values = []

  ref_dist = distance2D(hand_landmarks.landmark[0], hand_landmarks.landmark[9])
  if ref_dist == 0:
    return False, 0, 0

  appendages = [3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20]
  for index in appendages:
    landmark = hand_landmarks.landmark[index]
    x_values.append(landmark.x)
    y_values.append(landmark.y)

  stdev_x_norm = np.std(x_values) / ref_dist
  stdev_y_norm = np.std(y_values) / ref_dist

  wrist_to_middle = distance2D(hand_landmarks.landmark[0], hand_landmarks.landmark[12])
  vert_norm = wrist_to_middle / ref_dist

  return stdev_x_norm, stdev_y_norm, vert_norm

def thumb_distance_to_others(hand_landmarks):
  x_values = []
  y_values = []

  ref_dist = distance2D(hand_landmarks.landmark[0], hand_landmarks.landmark[9])
  if ref_dist == 0:
    return False, 0, 0

  the_others = [6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20]
  for index in the_others:
    landmark = hand_landmarks.landmark[index]
    x_values.append(landmark.x)
    y_values.append(landmark.y)

  std_x = np.std(x_values) / ref_dist
  std_y = np.std(y_values) / ref_dist

  mean_x = statistics.mean(x_values)
  mean_y = statistics.mean(y_values)
  thumb_dist = distance2D(hand_landmarks.landmark[4], SimpleNamespace(x=mean_x, y=mean_y))

  return std_x, std_y, thumb_dist / ref_dist

def pinch_distances(hand_landmarks):
  x_values = []
  y_values = []

  ref_dist = distance2D(hand_landmarks.landmark[0], hand_landmarks.landmark[9])
  if ref_dist == 0:
    return False, 0, 0

  other_fingers = [10, 11, 12, 14, 15, 16, 18, 19, 20]
  for index in other_fingers:
    landmark = hand_landmarks.landmark[index]
    x_values.append(landmark.x)
    y_values.append(landmark.y)

  std_x = np.std(x_values) / ref_dist
  std_y = np.std(y_values) / ref_dist

  distance = distance2D(hand_landmarks.landmark[4], hand_landmarks.landmark[8])

  return distance, std_x, std_y

orientation_history = deque(maxlen=100)
zoom_history = deque(maxlen=50)
rotation_history = deque(maxlen=50)

last_active_time = None
last_closed_fist = None
initial_vec = None
closed_fist = False
zooming = 0
rotating = 0

ROTATION_START_THRESHOLD = 0.5
MOTION_STOP_THRESHOLD = 0.05
GRACE_PERIOD = 0.5

while True:
  success, frame = cap.read()
  if success:
    RGB_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = hand.process(RGB_frame)

    if result.multi_hand_landmarks:
      for hand_landmarks in result.multi_hand_landmarks:

        frame_time = time.time()
        mp_drawing.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

        orientation_history.append(hand_landmarks)
        all_x, all_y, _ = find_finger_positions(hand_landmarks)
        four_x, four_y, thumb_dist = thumb_distance_to_others(hand_landmarks)
        pinch_dist, three_x, three_y = pinch_distances(hand_landmarks)

        thumb_tip = hand_landmarks.landmark[4]
        middle_tip = hand_landmarks.landmark[12]
        curr_vec = (middle_tip.x - thumb_tip.x, middle_tip.y - thumb_tip.y)

        now = datetime.now()
        # if last_closed_fist and  now - last_closed_fist < timedelta(seconds = 1):
        #   cv2.putText(frame, 'closed fist', (460, 50),
        #                   cv2.FONT_HERSHEY_COMPLEX,
        #                   0.9, (0, 255, 0), 2)
        #   break

        if all_x < 0.2 and all_y < 0.2 and pinch_dist < 0.7 and thumb_dist < 0.35:
          zoom_history.clear()
          rotation_history.clear()

          last_closed_fist = now
          closed_fist = True

          cv2.putText(frame, 'closed fist', (460, 50),
                          cv2.FONT_HERSHEY_COMPLEX,
                          0.9, (0, 255, 0), 2)
          logging.info("Closed hand detected, ready to hear commands")

        elif zooming == 0 and rotating == 0 and closed_fist and thumb_dist > 0.5 and three_x < 0.08 and three_y < 0.25 and four_y > 0.31:
          zoom_history.clear()
          last_closed_fist = None
          closed_fist = False

          zoom_history.append((frame_time, pinch_dist))
          last_active_time = frame_time

          zooming = 1 if pinch_dist < 0.10 else 2 if pinch_dist > 0.14 else 0
          if zooming == 0:
            logging.info("ZOOMING CANCELLED - CLOSE HAND AGAIN")
          elif zooming == 1:
            logging.info("Zooming in motion detected")
          elif zooming == 2:
            logging.info("Zooming out motion detected")

        elif zooming == 0 and rotating == 0 and closed_fist and thumb_dist > 0.7 and four_x < 0.1 and four_y < 0.27:
          rotation_history.clear()
          last_closed_fist = None
          closed_fist = False

          if initial_vec is None:
            initial_vec = curr_vec

          angle = get_angle_between_vectors(curr_vec, initial_vec)
          rotation_history.append((frame_time, angle))
          last_active_time = frame_time

          rotating = 1
          logging.info("Rotation motion detected")

        elif zooming != 0:
          zoom_history.append((frame_time, pinch_dist))

          if zooming == 1:
            cv2.putText(frame, 'zooming in', (400, 50),
                          cv2.FONT_HERSHEY_COMPLEX,
                          0.9, (0, 255, 0), 2)
          elif zooming == 2:
            cv2.putText(frame, 'zooming out', (400, 50),
                          cv2.FONT_HERSHEY_COMPLEX,
                          0.9, (0, 255, 0), 2)

          if len(zoom_history) >= 5:
            t1, d1 = zoom_history[-5]
            t2, d2 = zoom_history[-1]
            delta_dist = d2 - d1
            delta_time = t2 - t1 if t2 != t1 else 1e-6

            speed = abs(delta_dist / delta_time)

            if speed > MOTION_STOP_THRESHOLD:
              last_active_time = frame_time
            elif frame_time - last_active_time > GRACE_PERIOD:
              zooming = 0
              logging.info("Zooming motion stopped")
              time.sleep(0.5)

        elif rotating != 0:
          angle = get_angle_between_vectors(curr_vec, initial_vec)
          rotation_history.append((frame_time, angle))

          cv2.putText(frame, 'rotating', (400, 50),
                        cv2.FONT_HERSHEY_COMPLEX,
                        0.9, (0, 255, 0), 2)

          if len(rotation_history) >= 5:
            t1, a1 = rotation_history[-5]
            t2, a2 = rotation_history[-1]
            delta_angle = a2 - a1
            delta_time = t2 - t1 if t2 != t1 else 1e-6

            angular_speed = abs(delta_angle / delta_time)

            print(f"Angular Speed: {angular_speed:.4f} rad/s")
            print(f"Current Rotation Angle: {math.degrees(angle):.2f} degrees")

            if angular_speed > MOTION_STOP_THRESHOLD:
              last_active_time = frame_time
            elif frame_time - last_active_time > GRACE_PERIOD:
              rotating = 0
              initial_vec = None
              logging.info("Rotation movement stopped")
              time.sleep(0.5)

    cv2.imshow("capture image", frame)
    if cv2.waitKey(1) == ord('q'):
      break

cap.release()
cv2.destroyAllWindows()