import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'image';
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (type === 'video') {
      const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: 'Invalid file type. Only MP4, MOV, WebM videos are allowed.' },
          { status: 400 }
        );
      }
      
      // Validate file size (max 50MB for videos)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 50MB for videos.' },
          { status: 400 }
        );
      }
    } else {
      // Images
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: 'Invalid file type. Only images are allowed.' },
          { status: 400 }
        );
      }

      // Validate file size (max 10MB for images)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 10MB for images.' },
          { status: 400 }
        );
      }
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const extension = file.name.split('.').pop();
    const folder = type === 'video' ? 'videos' : 'images';
    const filename = `${folder}/${user.id}/${timestamp}-${randomString}.${extension}`;

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filename,
      Body: buffer,
      ContentType: file.type,
    });

    await r2Client.send(command);

    // Return the R2 key (we'll generate presigned URLs when fetching)
    return NextResponse.json({
      success: true,
      url: filename, // Store the R2 key, not the full URL
      filename: filename,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// Set max file size for route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '60mb',
    },
  },
};
