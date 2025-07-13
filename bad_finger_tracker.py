import cv2
from cvzone.HandTrackingModule import HandDetector

detector = HandDetector(maxHands = 1, detectionCon = 0.8)
cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()

    # Find the hand with the help of the detector
    hand, frame = detector.findHands(frame, flipType = True, draw = False)

    if hand:
        finger_up = detector.fingersUp(hand[0])

        # Change text based on different-different conditions
        if finger_up == [0, 1, 0, 0, 0]:
            cv2.putText(frame, '1', (460, 50),
                            cv2.FONT_HERSHEY_COMPLEX,
                            0.9, (0, 255, 0), 2)
        if finger_up == [0, 1, 1, 0, 0]:
            cv2.putText(frame, '2', (460, 50),
                            cv2.FONT_HERSHEY_COMPLEX,
                            0.9, (0, 255, 0), 2)
        if finger_up == [0, 1, 1, 1, 0]:
            cv2.putText(frame, '3', (460, 50),
                            cv2.FONT_HERSHEY_COMPLEX,
                            0.9, (0, 255, 0), 2)
        if finger_up == [0, 1, 1, 1, 1]:
            cv2.putText(frame, '4', (460, 50),
                            cv2.FONT_HERSHEY_COMPLEX,
                            0.9, (0, 255, 0), 2)
        if finger_up == [1, 1, 1, 1, 1]:
            cv2.putText(frame, '5', (460, 50),
                            cv2.FONT_HERSHEY_COMPLEX,
                            0.9, (0, 255, 0), 2)

    # Display the resulting frame
    cv2.imshow("Video", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# When everything done, release
# the capture and destroy the windows
cap.release()
cv2.destroyAllWindows()