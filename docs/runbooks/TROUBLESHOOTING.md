# Robot API Troubleshooting Guide

## Common Issues

### 1. "Invalid or missing API key" (401)

**Problem:** API key is incorrect or missing.

**Solution:**
- Verify the API key is correct: `<YOUR_ROBOT_API_KEY>`
- Check the header name is exactly: `X-Robot-API-Key`
- Ensure there are no extra spaces or newlines in the key

**Test:**
```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/health" \
  -H "X-Robot-API-Key: <YOUR_ROBOT_API_KEY>"
```

---

### 2. "Location not found" (404)

**Problem:** Location ID doesn't exist in the database.

**Solution:**
- First, get all locations to see available IDs:
```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/locations" \
  -H "X-Robot-API-Key: YOUR_KEY"
```
- Use a valid location ID from the response

---

### 3. "Job not found" (404)

**Problem:** Job ID doesn't exist.

**Solution:**
- Get all jobs first to see available job IDs:
```bash
curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/jobs" \
  -H "X-Robot-API-Key: YOUR_KEY"
```
- Use a valid job ID from the response

---

### 4. Empty results (no jobs/locations)

**Problem:** Database hasn't been synced yet.

**Solution:**
- Sync the database (admin only):
```bash
curl -X POST "https://supervolcano-teleops.vercel.app/api/admin/sync"
```
- Wait 30 seconds, then retry your query

---

### 5. Video URLs not loading

**Problem:** Video URL is invalid or file was deleted.

**Solution:**
- Check if the video URL is accessible:
```bash
curl -I "VIDEO_URL_HERE"
```
- Should return `200 OK`
- If `404`, the video may have been deleted from Firebase Storage
- Contact support to re-upload the video

---

### 6. Slow response times

**Problem:** Database query is slow or API is under load.

**Solution:**
- Use pagination (limit/offset) to reduce response size
- Cache responses on your end (API responses are valid for 60 seconds)
- Retry with exponential backoff if you get 500 errors

---

### 7. CORS errors (browser)

**Problem:** Making requests from browser and getting CORS errors.

**Solution:**
- Robot API is designed for server-to-server communication
- Use a backend proxy or make requests from your server
- For testing, use Postman or curl instead of browser

---

### 8. Rate limit exceeded

**Problem:** Too many requests in a short time.

**Solution:**
- Current limit: 100 requests per minute
- Implement request throttling in your code
- Cache responses to reduce API calls
- Contact support to increase limits if needed

---

## Debugging Tips

### 1. Test with curl first

Always test with curl before integrating into your code:

```bash
curl -v -X GET "https://supervolcano-teleops.vercel.app/api/robot/health" \
  -H "X-Robot-API-Key: YOUR_KEY"
```

The `-v` flag shows full request/response details.

### 2. Check response status

Always check the HTTP status code:
- `200` = Success
- `401` = Authentication error
- `404` = Resource not found
- `500` = Server error

### 3. Inspect response body

Even on errors, the response body contains useful information:

```json
{
  "success": false,
  "error": "Detailed error message here"
}
```

### 4. Use Postman

Import the Postman collection to test all endpoints easily.

---

## Still Having Issues?

1. **Check API status:**
   ```bash
   curl -X GET "https://supervolcano-teleops.vercel.app/api/robot/health" \
     -H "X-Robot-API-Key: YOUR_KEY"
   ```

2. **Verify your API key:**
   - Double-check the key matches exactly
   - No extra spaces or characters

3. **Check network connectivity:**
   - Ensure you can reach the API URL
   - Check firewall/proxy settings

4. **Contact support:**
   - Email: support@supervolcano.com
   - Include:
     - Your API key (first 8 chars only)
     - Error message
     - Request URL
     - Response status code

---

## Quick Health Check

Run this to verify everything is working:

```bash
#!/bin/bash
API_KEY="<YOUR_ROBOT_API_KEY>"
BASE_URL="https://supervolcano-teleops.vercel.app/api/robot"

echo "Testing health endpoint..."
curl -X GET "$BASE_URL/health" -H "X-Robot-API-Key: $API_KEY"

echo -e "\n\nTesting locations endpoint..."
curl -X GET "$BASE_URL/locations" -H "X-Robot-API-Key: $API_KEY"

echo -e "\n\nTesting jobs endpoint..."
curl -X GET "$BASE_URL/jobs?limit=1" -H "X-Robot-API-Key: $API_KEY"
```

If all three return `200 OK`, your API access is working correctly!

