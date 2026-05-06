# Robot API Demo Script

## Before Demo (30 min before)

1. **Sync database:**
```bash
curl -X POST https://supervolcano-teleops.vercel.app/api/admin/sync
```

2. **Test API responds:**
```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/health" \
  -H "X-Robot-API-Key: <YOUR_ROBOT_API_KEY>"
```

3. **Verify video URLs work** (open in browser)

4. **Have documentation ready:**
   - ROBOT_API.md open in browser
   - Postman collection ready to import
   - Example scripts ready to run

---

## During Demo

### Introduction (2 min)

"Our API provides robots with location-specific task instructions including video demonstrations. Let me show you how it works."

**Key points:**
- RESTful API with simple authentication
- Real-time data from our platform
- Video instructions for each task
- Easy integration with any language

---

### Demo Flow (10 min)

#### 1. Show documentation (1 min)

Share screen with ROBOT_API.md open

**Highlight:**
- Clean, simple API design
- Comprehensive documentation
- Code examples in multiple languages

---

#### 2. Test connection (1 min)

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/health" \
  -H "X-Robot-API-Key: <YOUR_ROBOT_API_KEY>"
```

**Show response:**
- Status: healthy
- Available endpoints
- API version

---

#### 3. Get locations (2 min)

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/locations" \
  -H "X-Robot-API-Key: <YOUR_ROBOT_API_KEY>"
```

**Explain:**
- List of all service locations
- Each location has address, city, state, zip
- Job count per location
- Robot can use this to identify current location

---

#### 4. Get jobs at location (2 min)

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/locations/bd577ffe-d733-4002-abb8-9ea047c0f326/jobs" \
  -H "X-Robot-API-Key: <YOUR_ROBOT_API_KEY>"
```

**Explain:**
- Jobs are high-level tasks (e.g., "Clean Kitchen")
- Each job has:
  - Title and description
  - Category and priority
  - Estimated duration
  - Video count
- Robot can filter by priority or category

---

#### 5. Get instructional videos (2 min)

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/jobs/JOB_ID/videos" \
  -H "X-Robot-API-Key: <YOUR_ROBOT_API_KEY>"
```

**Explain:**
- Videos are direct MP4 URLs
- Can be streamed or downloaded
- Each video has:
  - Duration
  - File size
  - Upload timestamp
  - Associated task

**Action:** Copy video URL and open in browser to play

---

#### 6. Show web admin (2 min)

**Navigate to:** Admin portal → Locations → [Select location] → Tasks

**Show:**
- How videos are uploaded
- How tasks are created
- How jobs are organized
- Real-time updates

**Explain:**
- Videos uploaded via mobile app or web portal
- Tasks automatically synced to SQL database
- Robots get real-time updates

---

### Q&A (5 min)

**Common questions:**

**Q: "How often is data updated?"**
A: Real-time via Firestore, synced to SQL hourly. Robots get updates within minutes.

**Q: "Can we filter by priority?"**
A: Yes, use query parameters: `?priority=high`

**Q: "What's the video format?"**
A: MP4, H.264, typically 1-5MB per video. Optimized for streaming.

**Q: "Rate limits?"**
A: None for demo, 100 requests/minute in production. Can be increased.

**Q: "How do we add new locations?"**
A: Through web admin portal. Locations sync automatically to API.

**Q: "Can robots upload feedback?"**
A: Yes, we have a feedback endpoint (`/api/robot/v1/feedback`) for execution results.

**Q: "Offline support?"**
A: Robots can pre-fetch all jobs and videos for offline operation.

**Q: "Video storage?"**
A: Videos stored in Firebase Storage, publicly accessible via signed URLs.

---

## Closing (2 min)

**Next steps:**
1. Share API key and documentation
2. Provide Postman collection
3. Schedule follow-up integration call
4. Answer any remaining questions

**Deliverables:**
- ✅ API key
- ✅ Full documentation (ROBOT_API.md)
- ✅ Postman collection
- ✅ Code examples (Python, JavaScript, Bash)
- ✅ Troubleshooting guide

---

## Backup Plan

If API is down or slow:

1. **Show documentation** - Explain endpoints and structure
2. **Show Postman collection** - Demonstrate request format
3. **Show code examples** - Walk through integration code
4. **Show web admin** - Demonstrate how data is created
5. **Schedule follow-up** - Test API when it's stable

---

## Success Metrics

**Demo is successful if:**
- ✅ Client understands API structure
- ✅ Client can make test requests
- ✅ Client sees video playback
- ✅ Client understands integration process
- ✅ Client has all materials needed

---

## Post-Demo Follow-up

**Send within 24 hours:**
1. Email with API key and documentation
2. Postman collection file
3. Link to troubleshooting guide
4. Schedule integration support call

**Track:**
- API usage (monitor logs)
- Questions/issues
- Integration progress
- Feedback for improvements

