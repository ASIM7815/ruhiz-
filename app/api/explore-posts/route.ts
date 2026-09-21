import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get recent posts with media for Explore
    const { data: posts, error } = await supabase.rpc(
      'get_explore_posts',
      { p_limit: limit }
    );

    if (error) {
      console.error('Error fetching explore posts:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ posts: posts || [] });
  } catch (err: any) {
    console.error('Error in GET /api/explore-posts:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
