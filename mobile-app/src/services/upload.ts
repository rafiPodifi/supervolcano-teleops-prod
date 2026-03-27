import { storage } from '../config/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { File as ExpoFile } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { normalizeLocalFileUri } from '@/utils/local-file-uri';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number;
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
  onProgress: (progress: UploadProgress) => void
): Promise<{ storageUrl: string; durationSeconds: number; fileSize: number }> {
  const normalizedVideoUri = normalizeLocalFileUri(videoUri);
  console.log('═══════════════════════════════════════');
  console.log('📹 UPLOAD START');
  console.log('═══════════════════════════════════════');
  console.log('Video URI:', normalizedVideoUri);
  console.log('Location ID:', locationId);
  console.log('Job ID:', jobId);
  
  try {
    // Step 1: Read video file as base64 to avoid RN/Firebase blob mutation issues
    console.log('\n📦 Step 1: Reading video file as base64...');
    console.log('Reading from URI:', normalizedVideoUri);

    const fileInfo = await FileSystem.getInfoAsync(normalizedVideoUri);
    if (!fileInfo.exists) {
      throw new Error(`Recording file not found at ${normalizedVideoUri}`);
    }
    console.log('Source file exists:', fileInfo.exists);
    console.log('Source file size:', fileInfo.size ?? 0, 'bytes');

    const localFile = new ExpoFile(normalizedVideoUri);
    const base64Data = await localFile.base64();
    console.log('✅ File base64 loaded');
    console.log('Base64 length:', base64Data.length, 'chars');

    if (base64Data.length === 0) {
      throw new Error('Video file is empty (0 bytes)');
    }

    const fileSize = fileInfo.size ?? Math.floor((base64Data.length * 3) / 4);
    let durationSeconds = 0;
    
    // Step 2: Create storage reference
    console.log('\n☁️ Step 2: Creating storage reference...');
    const timestamp = Date.now();
    const fileName = `${timestamp}-video.mp4`;
    const storagePath = `media/${locationId}/${jobId}/${fileName}`;
    console.log('Storage path:', storagePath);
    
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
    
    // Step 3: Upload to Firebase Storage
    console.log('\n⬆️ Step 3: Uploading to Firebase Storage...');
    console.log('Starting uploadString...');
    onProgress({
      bytesTransferred: 0,
      totalBytes: fileSize,
      progress: 0,
    });

    await uploadString(storageRef, base64Data, 'base64', {
      contentType: 'video/mp4',
    });
    console.log('✅ Upload to Storage complete!');

    onProgress({
      bytesTransferred: fileSize,
      totalBytes: fileSize,
      progress: 100,
    });

    // Step 4: Get download URL
    console.log('\n🔗 Step 4: Getting download URL...');
    const downloadURL = await getDownloadURL(storageRef);
    console.log('✅ Download URL obtained');
    console.log('URL (first 100 chars):', downloadURL.substring(0, 100) + '...');

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
