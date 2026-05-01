# SuperVolcano Robot API Documentation

Base URL: `https://supervolcano-teleops.vercel.app/api/robot`

## Important: Database Architecture

**This API uses PostgreSQL (NOT Firestore).**

- **Robot API endpoints** (`/api/robot/v1/*`) → PostgreSQL (read-only replica)
- **Admin/Organization endpoints** (`/api/admin/*`, `/api/locations/*`) → Firestore (source of truth)

PostgreSQL is kept in sync with Firestore via a one-way sync service. This allows robots to query structured data without impacting Firestore rate limits.

---

## Authentication

All requests require an API key in the header:

```http
X-Robot-API-Key: your_api_key_here
```

## Rate Limits

- 100 requests per minute per API key
- No rate limits for demo (temporary)

---

## Endpoints

### 1. Health Check

Check API status.

**Endpoint:** `GET /api/robot/health`

**Headers:**

```http
X-Robot-API-Key: your_api_key_here
```

**Example Request:**

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/health" \
  -H "X-Robot-API-Key: your_api_key_here"
```

**Response:**

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-11-24T12:00:00Z",
  "version": "1.0.0",
  "endpoints": {
    "jobs": "/api/robot/jobs",
    "locations": "/api/robot/locations",
    "videos": "/api/robot/jobs/{id}/videos"
  }
}
```

---

### 2. Get All Jobs

Retrieve all available jobs across all locations.

**Endpoint:** `GET /api/robot/jobs`

**Headers:**

```http
X-Robot-API-Key: your_api_key_here
```

**Query Parameters:**

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| limit | integer | Max number of jobs to return | 100 |
| offset | integer | Number of jobs to skip | 0 |
| category | string | Filter by category | - |
| priority | string | Filter by priority (low/medium/high) | - |

**Example Request:**

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/jobs?limit=10" \
  -H "X-Robot-API-Key: your_api_key_here"
```

**Response:**

```json
{
  "success": true,
  "jobs": [
    {
      "id": "abc-123",
      "title": "Clean Counter",
      "description": "Clean the counter with surface cleaner",
      "category": "cleaning",
      "priority": "medium",
      "estimated_duration_minutes": 15,
      "location_id": "loc-456",
      "location_name": "Isaac's House",
      "location_address": "123 Main St, Santa Monica CA 90404",
      "city": "Santa Monica",
      "state": "CA",
      "zip": "90404",
      "has_video": true,
      "video_count": 2,
      "task_count": 3,
      "created_at": "2025-11-24T12:00:00Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

---

### 3. Get All Locations

Retrieve all service locations.

**Endpoint:** `GET /api/robot/locations`

**Example Request:**

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/locations" \
  -H "X-Robot-API-Key: your_api_key_here"
```

**Response:**

```json
{
  "success": true,
  "locations": [
    {
      "id": "loc-456",
      "name": "Isaac's House",
      "address": "123 Main St, Santa Monica CA 90404",
      "city": "Santa Monica",
      "state": "CA",
      "zip": "90404",
      "job_count": 3
    }
  ],
  "total": 7
}
```

---

### 4. Get Jobs by Location

Retrieve all jobs for a specific location.

**Endpoint:** `GET /api/robot/locations/{location_id}/jobs`

**Example Request:**

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/locations/bd577ffe-d733-4002-abb8-9ea047c0f326/jobs" \
  -H "X-Robot-API-Key: your_api_key_here"
```

**Response:**

```json
{
  "success": true,
  "location_id": "bd577ffe-d733-4002-abb8-9ea047c0f326",
  "location_name": "Isaac's House",
  "location_address": "123 Main St, Santa Monica CA 90404",
  "jobs": [
    {
      "id": "abc-123",
      "title": "Clean Counter",
      "description": "Clean the counter with surface cleaner",
      "category": "cleaning",
      "priority": "medium",
      "estimated_duration_minutes": 15,
      "has_video": true,
      "video_count": 2,
      "task_count": 3,
      "created_at": "2025-11-24T12:00:00Z"
    }
  ],
  "total": 3
}
```

---

### 5. Get Job Videos

Retrieve instructional videos for a specific job.

**Endpoint:** `GET /api/robot/jobs/{job_id}/videos`

**Example Request:**

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/jobs/abc-123/videos" \
  -H "X-Robot-API-Key: your_api_key_here"
```

**Response:**

```json
{
  "success": true,
  "job_id": "abc-123",
  "job_title": "Clean Counter",
  "videos": [
    {
      "id": "video-1",
      "storage_url": "https://firebasestorage.googleapis.com/.../video.mp4",
      "thumbnail_url": "https://...",
      "duration_seconds": 45,
      "file_size_bytes": 1048576,
      "uploaded_at": "2025-11-24T10:00:00Z",
      "uploaded_by": "admin",
      "task_id": "task-123",
      "task_title": "Wipe counter surface",
      "media_role": "instruction",
      "time_offset_seconds": 0
    }
  ],
  "total": 2
}
```

**Video URLs:**

- Direct MP4 files
- Publicly accessible (read-only)
- Can be streamed or downloaded
- Average size: 1-5 MB per video

---

## Error Responses

**401 Unauthorized:**

```json
{
  "success": false,
  "error": "Invalid or missing API key"
}
```

**404 Not Found:**

```json
{
  "success": false,
  "error": "Resource not found"
}
```

**500 Internal Server Error:**

```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Detailed error message"
}
```

---

## Use Cases

### Use Case 1: Robot Arrives at Location

1. Get location ID (from robot's config or GPS)
2. Fetch jobs for that location
3. Display available tasks to teleoperator
4. Fetch videos for selected job
5. Play instructional videos for teleoperator

```bash
# Step 1: Get jobs at location
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/locations/bd577ffe-d733-4002-abb8-9ea047c0f326/jobs" \
  -H "X-Robot-API-Key: your_api_key"

# Step 2: Get videos for specific job
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/jobs/abc-123/videos" \
  -H "X-Robot-API-Key: your_api_key"
```

### Use Case 2: Pre-fetch All Tasks

Download all jobs and videos ahead of time for offline operation:

```bash
# Get all jobs
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/jobs" \
  -H "X-Robot-API-Key: your_api_key" > jobs.json

# For each job, download videos
# (iterate through jobs and fetch videos)
```

---

## Integration Examples

### Python Example

```python
import requests

API_BASE_URL = "https://supervolcano-teleops.vercel.app/api/robot"
API_KEY = "your_api_key_here"

headers = {
    "X-Robot-API-Key": API_KEY
}

# Get all jobs
response = requests.get(f"{API_BASE_URL}/jobs", headers=headers)
jobs = response.json()

print(f"Found {jobs['total']} jobs")

# Get videos for first job
if jobs['jobs']:
    job_id = jobs['jobs'][0]['id']
    videos_response = requests.get(
        f"{API_BASE_URL}/jobs/{job_id}/videos",
        headers=headers
    )
    videos = videos_response.json()
    
    print(f"Job has {videos['total']} videos")
    
    # Download first video
    if videos['videos']:
        video_url = videos['videos'][0]['storage_url']
        video_data = requests.get(video_url)
        
        with open('instruction.mp4', 'wb') as f:
            f.write(video_data.content)
        
        print("Video downloaded!")
```

### JavaScript/Node.js Example

```javascript
const API_BASE_URL = 'https://supervolcano-teleops.vercel.app/api/robot';
const API_KEY = 'your_api_key_here';

async function getJobs() {
  const response = await fetch(`${API_BASE_URL}/jobs`, {
    headers: {
      'X-Robot-API-Key': API_KEY
    }
  });
  
  const data = await response.json();
  console.log(`Found ${data.total} jobs`);
  return data.jobs;
}

async function getVideos(jobId) {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/videos`, {
    headers: {
      'X-Robot-API-Key': API_KEY
    }
  });
  
  const data = await response.json();
  return data.videos;
}

// Usage
const jobs = await getJobs();
const videos = await getVideos(jobs[0].id);
console.log('Video URL:', videos[0].storage_url);
```

### cURL Example (Complete Workflow)

```bash
#!/bin/bash

API_KEY="your_api_key_here"
BASE_URL="https://supervolcano-teleops.vercel.app/api/robot"

echo "1. Testing connection..."
curl -X GET "$BASE_URL/health" \
  -H "X-Robot-API-Key: $API_KEY"

echo -e "\n\n2. Getting all locations..."
curl -X GET "$BASE_URL/locations" \
  -H "X-Robot-API-Key: $API_KEY"

echo -e "\n\n3. Getting jobs at Isaac's House..."
curl -X GET "$BASE_URL/locations/bd577ffe-d733-4002-abb8-9ea047c0f326/jobs" \
  -H "X-Robot-API-Key: $API_KEY"

echo -e "\n\n4. Getting all jobs..."
curl -X GET "$BASE_URL/jobs?limit=5" \
  -H "X-Robot-API-Key: $API_KEY"
```

---

## Quick Start (5 Minutes)

1. **Test connection:**

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/health" \
  -H "X-Robot-API-Key: <YOUR_ROBOT_API_KEY>"
```

2. **Get sample jobs:**

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/jobs?limit=3" \
  -H "X-Robot-API-Key: <YOUR_ROBOT_API_KEY>"
```

3. **Copy a job ID from response and get its videos:**

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/jobs/YOUR_JOB_ID/videos" \
  -H "X-Robot-API-Key: <YOUR_ROBOT_API_KEY>"
```

4. **Open a video URL in browser to verify it plays**

---

## Support

For questions or issues during demo:

- Email: support@supervolcano.com
- Documentation: See ROBOT_API.md

## Notes

- All times are in UTC
- Video URLs do not expire
- API responses are cached for 60 seconds
- Maximum video size: 50MB
- Video format: MP4, H.264

