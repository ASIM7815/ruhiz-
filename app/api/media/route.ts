import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET_NAME } from '@/lib/r2/client';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
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

    // Get the R2 key from query params
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'No key provided' },
        { status: 400 }
      );
    }

    // Generate presigned URL (valid for 1 hour)
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

    return NextResponse.json({
      success: true,
      url: signedUrl,
    });

  } catch (error) {
    console.error('Media URL generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate media URL' },
      { status: 500 }
    );
  }
}
