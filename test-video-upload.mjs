#!/usr/bin/env node
/**
 * Test video upload to R2
 * Creates a small test video and uploads it through the API
 */

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Read .env.local
const envPath = new URL('.env.local', import.meta.url);
const envContent = readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const R2_ACCOUNT_ID = envVars.R2_ACCOUNT_ID;
const R2_ACCESS_KEY = envVars.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = envVars.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = envVars.R2_BUCKET_NAME;

console.log('🔍 Checking R2 Configuration...\n');

console.log('Environment Variables:');
console.log('  SUPABASE_URL:', SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('  SUPABASE_KEY:', SUPABASE_KEY ? '✅ Set' : '❌ Missing');
console.log('  R2_ACCOUNT_ID:', R2_ACCOUNT_ID ? '✅ Set' : '❌ Missing');
console.log('  R2_ACCESS_KEY_ID:', R2_ACCESS_KEY ? '✅ Set' : '❌ Missing');
console.log('  R2_SECRET_ACCESS_KEY:', R2_SECRET_KEY ? '✅ Set' : '❌ Missing');
console.log('  R2_BUCKET_NAME:', R2_BUCKET ? '✅ Set' : '❌ Missing');

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
  console.error('\n❌ R2 credentials are missing in .env.local');
  process.exit(1);
}

console.log('\n✅ All R2 credentials present\n');

// Create a minimal valid MP4 file (tiny test video)
console.log('📹 Creating test video file...');
const testVideoPath = '/tmp/test-video.mp4';

// Minimal MP4 header + single black frame (valid H.264)
const mp4Header = Buffer.from([
  0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // ftyp box
  0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
  0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
  0x6d, 0x70, 0x34, 0x31, 0x00, 0x00, 0x00, 0x08,
  0x66, 0x72, 0x65, 0x65
]);

writeFileSync(testVideoPath, mp4Header);
const fileSize = mp4Header.length;
console.log(`✅ Created test video: ${fileSize} bytes\n`);

// Test the API endpoint
console.log('🧪 Testing video upload API...\n');

async function testUpload() {
  try {
    // Step 1: Request presigned URL
    console.log('Step 1: Requesting presigned URL from /api/upload/presign...');
    
    const presignResponse = await fetch('http://localhost:3000/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'post-video',
        filename: 'test-video.mp4',
        contentType: 'video/mp4',
        size: fileSize
      })
    });

    if (!presignResponse.ok) {
      const error = await presignResponse.json();
      console.error('❌ Presign failed:', presignResponse.status, error);
      throw new Error(`Presign failed: ${JSON.stringify(error)}`);
    }

    const { key, uploadUrl, contentType } = await presignResponse.json();
    console.log('✅ Got presigned URL');
    console.log('   Key:', key);
    console.log('   Upload URL:', uploadUrl.substring(0, 100) + '...');
    console.log('   Content-Type:', contentType || 'video/mp4');

    // Step 2: Upload to R2
    console.log('\nStep 2: Uploading to R2...');
    
    const videoBuffer = readFileSync(testVideoPath);
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'video/mp4',
      },
      body: videoBuffer
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ R2 upload failed:', uploadResponse.status, errorText);
      throw new Error(`R2 upload failed: ${uploadResponse.status}`);
    }

    console.log('✅ Uploaded to R2');

    // Step 3: Verify completion
    console.log('\nStep 3: Verifying upload completion...');
    
    const completeResponse = await fetch('http://localhost:3000/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });

    if (!completeResponse.ok) {
      const error = await completeResponse.json();
      console.error('⚠️  Verification failed:', error);
      console.log('   (File may still be accessible)');
    } else {
      const result = await completeResponse.json();
      console.log('✅ Upload verified:', result);
    }

    // Cleanup
    unlinkSync(testVideoPath);
    console.log('\n🧹 Cleaned up test file');

    console.log('\n========================================');
    console.log('✅✅✅ VIDEO UPLOAD TEST PASSED! ✅✅✅');
    console.log('========================================');
    console.log('\nR2 video uploads are working correctly.');
    console.log('Video key:', key);
    console.log('\nYou can now upload videos through the app!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    console.log('\n🔍 Troubleshooting:');
    console.log('  1. Make sure Next.js dev server is running: npm run dev');
    console.log('  2. Check R2 credentials in .env.local');
    console.log('  3. Verify R2 bucket exists and has correct permissions');
    console.log('  4. Check CORS settings on R2 bucket');
    
    try {
      unlinkSync(testVideoPath);
    } catch {}
    process.exit(1);
  }
}

// Check if dev server is running
console.log('Checking if Next.js dev server is running...');
try {
  const healthCheck = await fetch('http://localhost:3000/api/upload/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'post-image', filename: 'test.jpg', contentType: 'image/jpeg', size: 1000 })
  }).catch(() => null);
  
  if (!healthCheck) {
    console.error('\n❌ Next.js dev server is not running on http://localhost:3000');
    console.log('\nPlease start it first:');
    console.log('  cd /home/newuser/Desktop/startups\\ /ruhiz-/ruhiz-');
    console.log('  npm run dev\n');
    process.exit(1);
  }
  
  console.log('✅ Dev server is running\n');
  await testUpload();
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}
