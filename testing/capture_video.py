import cv2

# open the default camera
cam = cv2.VideoCapture(0)

# Get the default frame width and height
frame_width = int(cam.get(cv2.CAP_PROP_FRAME_WIDTH))
frame_height = int(cam.get(cv2.CAP_PROP_FRAME_HEIGHT))

# define the code and create the VideoWriter object
fourcc = cv2.VideoWriter_fourcc('m', 'p', '4', 'v')
out = cv2.VideoWriter('/Users/varunrao/GitHubCode/hand-tracker/testing/output.mp4', fourcc, 20.0, (int(cam.get(3)),int(cam.get(4))))

while True:
  ret, frame, = cam.read()

  # Write the frame to the output file
  out.write(frame)

  # Display the captured frame
  cv2.imshow('Camera', frame)

  # press 'q' to exit the loop
  if cv2.waitKey(1) == ord('q'):
    break

cam.release()
out.release()
cv2.destroyAllWindows()