#!/usr/bin/env python3
"""
SuperVolcano Robot API - Python Example
Usage: python example.py
"""

import requests
import json

API_BASE_URL = "https://supervolcano-teleops.vercel.app/api/robot"
API_KEY = "<YOUR_ROBOT_API_KEY>"

headers = {
    "X-Robot-API-Key": API_KEY
}

def test_connection():
    """Test API connection"""
    print("1. Testing connection...")
    response = requests.get(f"{API_BASE_URL}/health", headers=headers)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {json.dumps(response.json(), indent=2)}")
    print()

def get_locations():
    """Get all locations"""
    print("2. Getting all locations...")
    response = requests.get(f"{API_BASE_URL}/locations", headers=headers)
    data = response.json()
    print(f"   Found {data['total']} locations")
    if data['locations']:
        print(f"   First location: {data['locations'][0]['name']}")
    print()

def get_jobs():
    """Get all jobs"""
    print("3. Getting all jobs...")
    response = requests.get(f"{API_BASE_URL}/jobs?limit=5", headers=headers)
    data = response.json()
    print(f"   Found {data['total']} total jobs")
    print(f"   Showing {len(data['jobs'])} jobs")
    if data['jobs']:
        print(f"   First job: {data['jobs'][0]['title']}")
    print()
    return data['jobs']

def get_job_videos(job_id):
    """Get videos for a specific job"""
    print(f"4. Getting videos for job {job_id}...")
    response = requests.get(f"{API_BASE_URL}/jobs/{job_id}/videos", headers=headers)
    data = response.json()
    print(f"   Found {data['total']} videos")
    if data['videos']:
        print(f"   First video URL: {data['videos'][0]['storage_url'][:80]}...")
    print()
    return data['videos']

def download_video(video_url, filename="instruction.mp4"):
    """Download a video file"""
    print(f"5. Downloading video to {filename}...")
    response = requests.get(video_url, stream=True)
    if response.status_code == 200:
        with open(filename, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"   ✓ Video downloaded successfully")
    else:
        print(f"   ✗ Failed to download: {response.status_code}")
    print()

if __name__ == "__main__":
    print("═══════════════════════════════════════")
    print("SuperVolcano Robot API - Python Example")
    print("═══════════════════════════════════════")
    print()
    
    try:
        test_connection()
        get_locations()
        jobs = get_jobs()
        
        if jobs:
            job_id = jobs[0]['id']
            videos = get_job_videos(job_id)
            
            if videos:
                video_url = videos[0]['storage_url']
                download_video(video_url)
        
        print("═══════════════════════════════════════")
        print("Example Complete!")
        print("═══════════════════════════════════════")
    except Exception as e:
        print(f"Error: {e}")

