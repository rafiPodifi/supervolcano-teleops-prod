import { auth, storage } from '../config/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import * as FileSystem from 'expo-file-system/legacy';
import { normalizeLocalFileUri } from '@/utils/local-file-uri';
import { UploadStageEvent } from './upload-debug.types';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number;
}

const FIREBASE_STORAGE_HOST = 'firebasestorage.googleapis.com';
const FIREBASE_STORAGE_VERSION = 'mobile-native-upload/1.0';

function getStorageBucket(): string {
  const bucket = storage?.app?.options?.storageBucket;
  if (!bucket) {
    throw new Error('Firebase Storage bucket is not configured');
  }
  return bucket;
}

function buildResumableUploadStartUrl(bucket: string, storagePath: string): string {
  const encodedBucket = encodeURIComponent(bucket);
  const encodedPath = encodeURIComponent(storagePath);
  return `https://${FIREBASE_STORAGE_HOST}/v0/b/${encodedBucket}/o?name=${encodedPath}`;
}

async function getFirebaseStorageAuthHeader(): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('No authenticated user available for Firebase Storage upload');
  }
  return `Firebase ${token}`;
}

async function startResumableUploadSession(
  bucket: string,
  storagePath: string,
  fileSize: number,
  contentType: string
): Promise<string> {
  const authorization = await getFirebaseStorageAuthHeader();
  const startUrl = buildResumableUploadStartUrl(bucket, storagePath);

  const response = await fetch(startUrl, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(fileSize),
      'X-Goog-Upload-Header-Content-Type': contentType,
      'X-Firebase-Storage-Version': FIREBASE_STORAGE_VERSION,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      name: storagePath,
      contentType,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Failed to start Firebase resumable upload (${response.status}): ${responseText}`);
  }

  const uploadUrl = response.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) {
    throw new Error('Firebase resumable upload session did not return X-Goog-Upload-URL');
  }

  return uploadUrl;
}

async function uploadFileWithNativeTask(
  uploadUrl: string,
  fileUri: string,
  fileSize: number,
  contentType: string,
  onProgress: (progress: UploadProgress) => void
): Promise<void> {
  const authorization = await getFirebaseStorageAuthHeader();
  const uploadTask = FileSystem.createUploadTask(
    uploadUrl,
    fileUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: authorization,
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-Offset': '0',
        'Content-Type': contentType,
      },
    },
    (progressEvent) => {
      const totalBytes = progressEvent.totalBytesExpectedToSend || fileSize;
      const bytesTransferred = progressEvent.totalBytesSent;
      onProgress({
        bytesTransferred,
        totalBytes,
        progress: totalBytes > 0 ? Math.min(100, Math.round((bytesTransferred / totalBytes) * 100)) : 0,
      });
    }
  );

  const result = await uploadTask.uploadAsync();
  if (!result) {
    throw new Error('Native upload task was cancelled before completion');
  }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Firebase upload failed (${result.status}): ${result.body}`);
  }
}

function emitStage(
  onStage: ((event: UploadStageEvent) => void) | undefined,
  stage: UploadStageEvent['stage'],
  message: string,
  details?: string
) {
  onStage?.({ stage, message, details });
}

/**
 * Get video duration and file size
 */
export async function getVideoMetadata(videoUri: string): Promise<{ durationSeconds: number; fileSize: number }> {
  try {
    console.log('📹 Getting video metadata for:', videoUri);
    
    // Get file size - try FileSystem first, fallback to blob
    let fileSize = 0;
    try {
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (fileInfo.exists && fileInfo.size) {
        fileSize = fileInfo.size;
      }
    } catch (error) {
      // If FileSystem fails, we'll get size from blob later
      console.log('⚠️ Could not get file size from FileSystem');
    }
    console.log('📹 File size:', fileSize, 'bytes');
    
    // Get video duration - expo-av doesn't have a simple API for this
    // We'll use a workaround with a temporary Video component or skip it
    // For now, we'll skip duration detection and set to 0
    // TODO: Implement proper duration detection if needed
    let durationSeconds = 0;
    console.log('📹 Video duration: Not detected (will be 0)');
    
    return { durationSeconds, fileSize };
  } catch (error) {
    console.error('❌ Failed to get video metadata:', error);
    return { durationSeconds: 0, fileSize: 0 };
  }
}

/**
 * Upload video directly to Firebase Storage
 * Does NOT save to camera roll
 */
export async function uploadVideoToFirebase(
  videoUri: string,
  locationId: string,
  jobId: string,
  onProgress: (progress: UploadProgress) => void,
  onStage?: (event: UploadStageEvent) => void
): Promise<{ storageUrl: string; durationSeconds: number; fileSize: number }> {
  const normalizedVideoUri = normalizeLocalFileUri(videoUri);
  console.log('═══════════════════════════════════════');
  console.log('📹 UPLOAD START');
  console.log('═══════════════════════════════════════');
  console.log('Video URI:', normalizedVideoUri);
  console.log('Location ID:', locationId);
  console.log('Job ID:', jobId);
  
  try {
    // Step 1: Validate file and collect local metadata
    console.log('\n📦 Step 1: Validating local video file...');
    console.log('Reading from URI:', normalizedVideoUri);
    emitStage(onStage, 'preparing_file', 'Validating queued file', normalizedVideoUri);

    const fileInfo = await FileSystem.getInfoAsync(normalizedVideoUri);
    if (!fileInfo.exists) {
      throw new Error(`Recording file not found at ${normalizedVideoUri}`);
    }
    console.log('Source file exists:', fileInfo.exists);
    console.log('Source file size:', fileInfo.size ?? 0, 'bytes');
    const fileSize = fileInfo.size ?? 0;
    if (fileSize <= 0) {
      throw new Error('Video file is empty (0 bytes)');
    }
    let durationSeconds = 0;
    const contentType = 'video/mp4';
    
    // Step 2: Create storage destination
    console.log('\n☁️ Step 2: Creating storage destination...');
    const timestamp = Date.now();
    const fileName = `${timestamp}-video.mp4`;
    const storagePath = `media/${locationId}/${jobId}/${fileName}`;
    const bucket = getStorageBucket();
    console.log('Storage path:', storagePath);
    console.log('Storage bucket:', bucket);
    
    // Verify storage is initialized
    if (!storage) {
      throw new Error('Firebase Storage is not initialized');
    }
    console.log('Storage instance:', storage ? 'EXISTS' : 'MISSING');
    console.log('Storage app:', storage.app.name);
    
    const storageRef = ref(storage, storagePath);
    console.log('Storage ref created');
    console.log('Storage ref fullPath:', storageRef.fullPath);
    console.log('Storage ref bucket:', storageRef.bucket);
    
    // Step 3: Start resumable upload session
    console.log('\n🚀 Step 3: Starting Firebase resumable upload session...');
    emitStage(onStage, 'start_resumable', 'Starting Firebase resumable upload session', storagePath);
    onProgress({
      bytesTransferred: 0,
      totalBytes: fileSize,
      progress: 0,
    });

    const uploadUrl = await startResumableUploadSession(bucket, storagePath, fileSize, contentType);
    console.log('✅ Resumable upload session created');
    emitStage(onStage, 'upload_binary', 'Firebase resumable session created');

    // Step 4: Upload file with native file-system transport
    console.log('\n⬆️ Step 4: Uploading binary file with native upload task...');
    emitStage(onStage, 'upload_binary', 'Uploading binary file to Firebase');
    await uploadFileWithNativeTask(uploadUrl, normalizedVideoUri, fileSize, contentType, onProgress);
    console.log('✅ Upload to Storage complete');

    onProgress({
      bytesTransferred: fileSize,
      totalBytes: fileSize,
      progress: 100,
    });

    // Step 5: Get download URL
    console.log('\n🔗 Step 5: Getting download URL...');
    emitStage(onStage, 'get_download_url', 'Fetching Firebase download URL');
    const downloadURL = await getDownloadURL(storageRef);
    console.log('✅ Download URL obtained');
    console.log('URL (first 100 chars):', downloadURL.substring(0, 100) + '...');
    emitStage(onStage, 'get_download_url', 'Firebase download URL resolved');

    console.log('═══════════════════════════════════════');
    console.log('✅ UPLOAD COMPLETE SUCCESS');
    console.log('═══════════════════════════════════════');
    console.log('Storage URL:', downloadURL);
    console.log('File size:', fileSize, 'bytes');
    console.log('Duration:', durationSeconds, 'seconds');

    return {
      storageUrl: downloadURL,
      durationSeconds,
      fileSize,
    };
  } catch (error: any) {
    console.error('═══════════════════════════════════════');
    console.error('❌ UPLOAD FAILED');
    console.error('═══════════════════════════════════════');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    emitStage(onStage, 'failed', error?.message || 'Upload failed');
    throw error;
  }
}

/**
 * Delete temporary video file
 */
export async function deleteLocalVideo(videoUri: string) {
  try {
    await FileSystem.deleteAsync(videoUri, { idempotent: true });
    console.log('Deleted local video:', videoUri);
  } catch (error) {
    // Silently fail - file might already be deleted or not accessible
    console.log('Note: Could not delete local video (may already be deleted)');
  }
}
