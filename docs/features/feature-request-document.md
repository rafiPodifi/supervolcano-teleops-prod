Features Requests

- Automatic Upload: Automatically upload videos after recording. Rafi is investigating the downstream process, DB schema, and API contracts needed to support this.
- Geo-tagging: Use GPS to geo tag the videos. Rafi noted this requires updating the code in downstream processes.
- Camera View: Hide the native camera view or have it open to external and display a message to connect the camera if it is not detected. DONE
- Video Segmentation: Implement recording of fixed-length segments, ideally 2-minute files, on the phone instead of a single continuous long video file. This is intended to make uploads and processing more manageable.
- Audio Recording: Disable audio recording immediately. DONE
- Cache the locations so they are available even if there is not active internet at the location.
- Would be great to be able to open and see pending upload queue
- Time stamp in the Creation column in the Media Library instead of a date

Bug Reports

- The app got stuck on the capture screen after ending a recording.
- App shows a pending upload even after all videos have been uploaded. Eventually resolved itself.
- I have noticed twice that an upload failed. I believe it was because the phone went to sleep(?)
