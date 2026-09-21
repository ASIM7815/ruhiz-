import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const { challengeId, dayNumber, caption, media } = body;

    // Validate input
    if (!challengeId || !dayNumber) {
      return NextResponse.json(
        { error: 'Missing challengeId or dayNumber' },
        { status: 400 }
      );
    }

    if (!caption?.trim() && (!media || media.length === 0)) {
      return NextResponse.json(
        { error: 'Post must have caption or media' },
        { status: 400 }
      );
    }

    // Verify user is participating in this challenge
    const { data: participation } = await supabase
      .from('challenge_participants')
      .select('status')
      .eq('challenge_id', challengeId)
      .eq('user_id', profile.id)
      .single();

    if (!participation) {
      return NextResponse.json(
        { error: 'You must join this challenge first' },
        { status: 403 }
      );
    }

    // Create the post
    const { data: post, error: postError } = await supabase
      .from('challenge_posts')
      .insert({
        challenge_id: challengeId,
        user_id: profile.id,
        day_number: dayNumber,
        caption: caption?.trim() || '',
      })
      .select('*')
      .single();

    if (postError) {
      console.error('Error creating post:', postError);
      return NextResponse.json(
        { error: postError.message || 'Failed to create post' },
        { status: 500 }
      );
    }

    // Insert media if provided
    if (media && media.length > 0) {
      const mediaRows = media.map((m: any, i: number) => ({
        post_id: post.id,
        media_type: m.type,
        url: m.url,
        thumbnail_url: m.thumbnailUrl || null,
        width: m.width || null,
        height: m.height || null,
        duration_ms: m.durationMs || null,
        file_size: m.fileSize || null,
        sort_order: m.sortOrder !== undefined ? m.sortOrder : i,
      }));

      const { error: mediaError } = await supabase
        .from('challenge_post_media')
        .insert(mediaRows);

      if (mediaError) {
        console.error('Error inserting media:', mediaError);
        // Post created but media failed - still return success
      }
    }

    return NextResponse.json({ success: true, post });
  } catch (err: any) {
    console.error('Error in POST /api/challenge-posts:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const challengeId = searchParams.get('challengeId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!challengeId) {
      return NextResponse.json(
        { error: 'Missing challengeId' },
        { status: 400 }
      );
    }

    // Get posts with user info and media
    const { data: posts, error } = await supabase.rpc(
      'get_challenge_timeline',
      { p_challenge_id: challengeId }
    );

    if (error) {
      console.error('Error fetching posts:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ posts: posts || [] });
  } catch (err: any) {
    console.error('Error in GET /api/challenge-posts:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
