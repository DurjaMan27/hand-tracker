import cv2
import mediapipe as mp
import numpy as np
import math, statistics
import time
import os
import logging
from collections import deque
from types import SimpleNamespace
from datetime import datetime, timedelta

class RunGestures():

  def __init__(self, log_filepath: str, interactive_obj):

    logging.basicConfig(
      level = logging.INFO,
      format='%(message)s',
      handlers=[
        logging.FileHandler(log_filepath, mode='w'),
        logging.StreamHandler()
      ]
    )

    self.interactive = interactive_obj

    self.orientation_history = deque(maxlen=100)
    self.zoom_history = deque(maxlen=50)
    self.rotation_history = deque(maxlen=50)

    self.last_active_time = None
    self.initial_vec = None
    self.closed_fist = False
    self.zooming = 0
    self.rotating = 0

    self.MOTION_STOP_THRESHOLD = 0.065
    self.GRACE_PERIOD = 1.0


  def run_program(self):
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, value=600)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, value=500)

    mp_drawing = mp.solutions.drawing_utils
    mp_hands = mp.solutions.hands
    hand = mp_hands.Hands()

    while True:
      success, frame = cap.read()
      if success:
        RGB_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = hand.process(RGB_frame)

        if result.multi_hand_landmarks:
          for hand_landmarks in result.multi_hand_landmarks:
            frame_time = time.time()
            mp_drawing.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

            self.orientation_history.append(hand_landmarks)
            all_x, all_y, _ = self.find_finger_positions(hand_landmarks)
            four_x, four_y, thumb_dist = self.thumb_distance_to_others(hand_landmarks)
            pinch_dist, three_x, three_y = self.pinch_distances(hand_landmarks)

            thumb_tip = hand_landmarks.landmark[4]
            middle_tip = hand_landmarks.landmark[12]
            curr_vec = (middle_tip.x - thumb_tip.x, middle_tip.y - thumb_tip.y)

            now = datetime.now()

            if all_x < 0.2 and all_y < 0.2 and pinch_dist < 0.7 and thumb_dist < 0.35:
              self.zoom_history.clear()
              self.rotation_history.clear()

              cv2.putText(frame, 'closed fist', (460, 50),
                              cv2.FONT_HERSHEY_COMPLEX,
                              0.9, (0, 255, 0), 2)
              if not self.closed_fist:
                logging.info("Closed fist detected, ready to hear commands")

              self.closed_fist = True

            elif self.zooming == 0 and self.rotating == 0 and self.closed_fist and thumb_dist > 0.5 and three_x < 0.08 and three_y < 0.25 and four_y > 0.31:
              self.zoom_history.clear()
              self.closed_fist = False

              self.zoom_history.append((frame_time, pinch_dist))
              self.last_active_time = frame_time

              self.zooming = 1 if pinch_dist < 0.10 else 2 if pinch_dist > 0.14 else 0
              if self.zooming == 0:
                logging.info("ZOOMING CANCELLED - CLOSE HAND AGAIN")
              elif self.zooming == 1:
                logging.info("Zooming in motion detected")
              elif self.zooming == 2:
                logging.info("Zooming out motion detected")

            elif self.zooming == 0 and self.rotating == 0 and self.closed_fist and thumb_dist > 0.7 and four_x < 0.1 and four_y < 0.27:
              self.rotation_history.clear()
              self.closed_fist = False

              if self.initial_vec is None:
                self.initial_vec = curr_vec

              angle = self.get_angle_between_vectors(curr_vec, self.initial_vec)
              self.rotation_history.append((frame_time, angle))
              self.last_active_time = frame_time

              self.rotating = 1
              logging.info("Rotation motion detected")

            elif self.zooming != 0:
              self.zoom_history.append((frame_time, pinch_dist))

              if self.zooming == 1:
                cv2.putText(frame, 'zooming in', (400, 50),
                              cv2.FONT_HERSHEY_COMPLEX,
                              0.9, (0, 255, 0), 2)
              elif self.zooming == 2:
                cv2.putText(frame, 'zooming out', (400, 50),
                              cv2.FONT_HERSHEY_COMPLEX,
                              0.9, (0, 255, 0), 2)

              if len(self.zoom_history) >= 5:
                t1, d1 = self.zoom_history[-5]
                t2, d2 = self.zoom_history[-1]
                delta_dist = d2 - d1
                delta_time = t2 - t1 if t2 != t1 else 1e-6

                speed = abs(delta_dist / delta_time)

                if speed > self.MOTION_STOP_THRESHOLD:
                  self.last_active_time = frame_time
                elif frame_time - self.last_active_time > self.GRACE_PERIOD:
                  self.zooming = 0
                  logging.info("Zooming motion stopped")
                  time.sleep(0.5)

            elif self.rotating != 0:
              angle = self.get_angle_between_vectors(curr_vec, self.initial_vec)
              self.rotation_history.append((frame_time, angle))

              cv2.putText(frame, 'rotating', (400, 50),
                            cv2.FONT_HERSHEY_COMPLEX,
                            0.9, (0, 255, 0), 2)

              if len(self.rotation_history) >= 5:
                t1, a1 = self.rotation_history[-5]
                t2, a2 = self.rotation_history[-1]
                delta_angle = a2 - a1
                delta_time = t2 - t1 if t2 != t1 else 1e-6

                angular_speed = abs(delta_angle / delta_time)

                print(f"Angular Speed: {angular_speed:.4f} rad/s")
                print(f"Current Rotation Angle: {math.degrees(angle):.2f} degrees")

                if angular_speed > self.MOTION_STOP_THRESHOLD:
                  self.last_active_time = frame_time
                elif frame_time - self.last_active_time > self.GRACE_PERIOD:
                  self.rotating = 0
                  self.initial_vec = None
                  logging.info("Rotation movement stopped")
                  time.sleep(0.5)

        cv2.imshow("capture image", frame)
        if cv2.waitKey(1) == ord('q'):
          break

    cap.release()
    cv2.destroyAllWindows()

  # ---- HELPER FUNCTIONS -----

  def distance2D(self, p1, p2):
    return math.hypot(p1.x - p2.x, p1.y - p2.y)

  def get_angle_between_vectors(self, v1, v2):
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a**2 for a in v1))
    norm2 = math.sqrt(sum(b**2 for b in v2))
    return math.acos(dot / (norm1 * norm2 + 1e-6))

  def find_finger_positions(self, hand_landmarks):
    x_values = []
    y_values = []

    ref_dist = self.distance2D(hand_landmarks.landmark[0], hand_landmarks.landmark[9])
    if ref_dist == 0:
      return False, 0, 0

    appendages = [3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20]
    for index in appendages:
      landmark = hand_landmarks.landmark[index]
      x_values.append(landmark.x)
      y_values.append(landmark.y)

    stdev_x_norm = np.std(x_values) / ref_dist
    stdev_y_norm = np.std(y_values) / ref_dist

    wrist_to_middle = self.distance2D(hand_landmarks.landmark[0], hand_landmarks.landmark[12])
    vert_norm = wrist_to_middle / ref_dist

    return stdev_x_norm, stdev_y_norm, vert_norm

  def thumb_distance_to_others(self, hand_landmarks):
    x_values = []
    y_values = []

    ref_dist = self.distance2D(hand_landmarks.landmark[0], hand_landmarks.landmark[9])
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
    thumb_dist = self.distance2D(hand_landmarks.landmark[4], SimpleNamespace(x=mean_x, y=mean_y))

    return std_x, std_y, thumb_dist / ref_dist

  def pinch_distances(self, hand_landmarks):
    x_values = []
    y_values = []

    ref_dist = self.distance2D(hand_landmarks.landmark[0], hand_landmarks.landmark[9])
    if ref_dist == 0:
      return False, 0, 0

    other_fingers = [10, 11, 12, 14, 15, 16, 18, 19, 20]
    for index in other_fingers:
      landmark = hand_landmarks.landmark[index]
      x_values.append(landmark.x)
      y_values.append(landmark.y)

    std_x = np.std(x_values) / ref_dist
    std_y = np.std(y_values) / ref_dist

    distance = self.distance2D(hand_landmarks.landmark[4], hand_landmarks.landmark[8])

    return distance, std_x, std_y