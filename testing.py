import cv2
import mediapipe as mp
import numpy as np
import math, statistics
from collections import deque
import time
from types import SimpleNamespace
from datetime import datetime, timedelta

cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, value=600)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, value=500)

mp_drawing = mp.solutions.drawing_utils
mp_hands = mp.solutions.hands
hand = mp_hands.Hands()

last_time = datetime.now()

def distance2D(p1, p2):
  return math.hypot(p1.x - p2.x, p1.y - p2.y)

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


while True:
  success, frame = cap.read()
  if success:
    RGB_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = hand.process(RGB_frame)

    if result.multi_hand_landmarks:
      for hand_landmarks in result.multi_hand_landmarks:
        mp_drawing.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

        # x, y, vert = find_finger_positions(hand_landmarks)
        # print(f"Stdev x+y distance: {x:.6f}, {y:.6f}")
        # thumb_x, thumb_y, total_dist = thumb_distance_to_others(hand_landmarks)
        # print(f"Avg 2-4 x+y dist: {thumb_x:.6f}, {thumb_y:.6f}")
        # print(f"thumb to fingers dist: {total_dist:.6f}")
        # distance, pinch_x, pinch_y = pinch_distances(hand_landmarks)
        # print(f"Distance between pinch: {distance:.6f}")
        # print(f"Stdev x+y PINCH: {pinch_x:.6f}, {pinch_y:.6f}")

        all_x, all_y, _ = find_finger_positions(hand_landmarks)
        four_x, four_y, thumb_dist = thumb_distance_to_others(hand_landmarks)
        pinch_dist, three_x, three_y = pinch_distances(hand_landmarks)

        print("DETERMINATION")
        if all_x < 0.2 and all_y < 0.2 and pinch_dist < 0.7 and thumb_dist < 0.35:
          print("closed fist")
        elif thumb_dist > 0.5 and three_x < 0.08 and three_y < 0.25 and four_y > 0.31:
          if pinch_dist < 0.10:
            print("zooming in")
          elif pinch_dist > 0.14:
            print("zooming out")
        elif thumb_dist > 0.7 and four_x < 0.1 and four_y < 0.27:
          print("rotating")

        time.sleep(1.0)

    cv2.imshow("capture image", frame)
    if cv2.waitKey(1) == ord('q'):
      break

cap.release()
cv2.destroyAllWindows()