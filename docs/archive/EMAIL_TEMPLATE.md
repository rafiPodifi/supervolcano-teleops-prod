# Email Template for Robot API Demo

## Subject Line

```
SuperVolcano API Access for Tomorrow's Demo
```

## Email Body

```
Hi [Name],

Looking forward to our demo tomorrow! Here's everything you need to test our API:

**API Key:**
<YOUR_ROBOT_API_KEY>

**Quick Test (30 seconds):**

```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/jobs" \
  -H "X-Robot-API-Key: <YOUR_ROBOT_API_KEY>"
```

**Full Documentation:**
[Attach ROBOT_API.md or link to it]

**Postman Collection:**
[Attach SuperVolcano_Robot_API.postman_collection.json]

**What You'll Get:**
- List of jobs/tasks at each location
- Instructional video URLs for each task
- Location metadata
- Real-time task updates

**Sample Response:**
The API returns jobs with associated video instructions. Videos are direct MP4 URLs that can be streamed or downloaded.

**Example Workflow:**
1. Get all locations → Identify current location
2. Get jobs for location → See available tasks
3. Get videos for job → Download instructional videos
4. Execute task with video guidance

**Files Included:**
- `ROBOT_API.md` - Complete API documentation
- `API_KEY.txt` - Your API key
- `examples/` - Code examples in Python, JavaScript, and Bash
- `SuperVolcano_Robot_API.postman_collection.json` - Postman collection
- `TROUBLESHOOTING.md` - Common issues and solutions

Let me know if you need anything before tomorrow!

Best,
Chris
```

## Alternative: Short Version

```
Hi [Name],

Here's your API access for tomorrow's demo:

**API Key:** <YOUR_ROBOT_API_KEY>
**Base URL:** https://supervolcano-teleops.vercel.app/api/robot

**Quick Test:**
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/health" \
  -H "X-Robot-API-Key: <YOUR_ROBOT_API_KEY>"

**Full docs attached.** See you tomorrow!

Best,
Chris
```

