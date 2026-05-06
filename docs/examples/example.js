/**
 * SuperVolcano Robot API - JavaScript/Node.js Example
 * Usage: node example.js
 */

const API_BASE_URL = 'https://supervolcano-teleops.vercel.app/api/robot';
const API_KEY = '<YOUR_ROBOT_API_KEY>';

const headers = {
  'X-Robot-API-Key': API_KEY
};

async function testConnection() {
  console.log('1. Testing connection...');
  const response = await fetch(`${API_BASE_URL}/health`, { headers });
  const data = await response.json();
  console.log(`   Status: ${response.status}`);
  console.log(`   Response:`, JSON.stringify(data, null, 2));
  console.log();
}

async function getLocations() {
  console.log('2. Getting all locations...');
  const response = await fetch(`${API_BASE_URL}/locations`, { headers });
  const data = await response.json();
  console.log(`   Found ${data.total} locations`);
  if (data.locations && data.locations.length > 0) {
    console.log(`   First location: ${data.locations[0].name}`);
  }
  console.log();
}

async function getJobs() {
  console.log('3. Getting all jobs...');
  const response = await fetch(`${API_BASE_URL}/jobs?limit=5`, { headers });
  const data = await response.json();
  console.log(`   Found ${data.total} total jobs`);
  console.log(`   Showing ${data.jobs.length} jobs`);
  if (data.jobs && data.jobs.length > 0) {
    console.log(`   First job: ${data.jobs[0].title}`);
  }
  console.log();
  return data.jobs;
}

async function getJobVideos(jobId) {
  console.log(`4. Getting videos for job ${jobId}...`);
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/videos`, { headers });
  const data = await response.json();
  console.log(`   Found ${data.total} videos`);
  if (data.videos && data.videos.length > 0) {
    console.log(`   First video URL: ${data.videos[0].storage_url.substring(0, 80)}...`);
  }
  console.log();
  return data.videos;
}

async function downloadVideo(videoUrl, filename = 'instruction.mp4') {
  console.log(`5. Downloading video to ${filename}...`);
  try {
    const response = await fetch(videoUrl);
    if (response.ok) {
      const fs = require('fs');
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filename, Buffer.from(buffer));
      console.log('   ✓ Video downloaded successfully');
    } else {
      console.log(`   ✗ Failed to download: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
  }
  console.log();
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('SuperVolcano Robot API - JavaScript Example');
  console.log('═══════════════════════════════════════');
  console.log();
  
  try {
    await testConnection();
    await getLocations();
    const jobs = await getJobs();
    
    if (jobs && jobs.length > 0) {
      const jobId = jobs[0].id;
      const videos = await getJobVideos(jobId);
      
      if (videos && videos.length > 0) {
        const videoUrl = videos[0].storage_url;
        // Uncomment to download:
        // await downloadVideo(videoUrl);
      }
    }
    
    console.log('═══════════════════════════════════════');
    console.log('Example Complete!');
    console.log('═══════════════════════════════════════');
  } catch (error) {
    console.error('Error:', error);
  }
}

main();

