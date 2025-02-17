import cv2
import mediapipe as mp
from google.protobuf.json_format import MessageToDict

mpHands = mp.solutions.hands
hands = mpHands.Hands(
    static_image_mode=False,        # used to specify whether the inputted images are still or a stream
    model_complexity=1,             # complexity of the hand landmark model
    min_detection_confidence=0.75,  # minimum confidence value for it to be labeled successful
    min_tracking_confidence=0.75,   # minimum confidence value for detection to be labeled successful
    max_num_hands=2)                # maximum number of hands to detect


# Start capturing video from webcam
cap = cv2.VideoCapture(0)

while True:
    success, img = cap.read()

    # Flip the image and convert BGR image to RGB image
    img = cv2.flip(img, 1)
    imgRGB = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Process the RGB image
    results = hands.process(imgRGB)

    # If hands are present in image(frame)
    if results.multi_hand_landmarks:
        if len(results.multi_handedness) == 2:          # if two hands are present
            cv2.putText(img, 'Both Hands', (250, 50),
                        cv2.FONT_HERSHEY_COMPLEX, 0.9,
                        (0, 255, 0), 2)
        else:
            for i in results.multi_handedness:
                # Return whether it is Right or Left Hand
                label = MessageToDict(i)['classification'][0]['label']
                if label == 'Left':
                    cv2.putText(img, label+' Hand', (20, 50),
                                cv2.FONT_HERSHEY_COMPLEX, 0.9,
                                (0, 255, 0), 2)
                if label == 'Right':
                    cv2.putText(img, label+' Hand', (460, 50),
                                cv2.FONT_HERSHEY_COMPLEX,
                                0.9, (0, 255, 0), 2)

    cv2.imshow('Image', img)
    if cv2.waitKey(1) & 0xff == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
