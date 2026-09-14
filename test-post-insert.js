#!/usr/bin/env node
/**
 * Direct test of post insertion via Supabase client
 * This bypasses the frontend and tests the database directly
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPostInsert() {
  console.log('🔍 Starting Post Insert Test...\n');

  // Step 1: Check authentication
  console.log('Step 1: Checking authentication...');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('❌ Not authenticated. Please login first.');
    console.error('Error:', authError?.message);
    console.log('\n💡 You need to login in the browser first, then this script will use that session.');
    process.exit(1);
  }
  
  console.log('✅ Authenticated as:', user.email);
  console.log('   Auth UID:', user.id);

  // Step 2: Get profile
  console.log('\nStep 2: Looking up profile...');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('❌ Error fetching profile:', profileError.message);
    process.exit(1);
  }

  if (!profile) {
    console.error('❌ No profile found for authenticated user');
    console.error('   This should not happen - profile should be created automatically');
    process.exit(1);
  }

  console.log('✅ Profile found:');
  console.log('   Profile ID:', profile.id);
  console.log('   Username:', profile.username);
  console.log('   Linked to user_id:', profile.user_id);

  // Step 3: Test INSERT
  console.log('\nStep 3: Testing POST INSERT...');
  
  const testPost = {
    user_id: profile.id,
    type: 'moment',
    content: 'Test text moment 💚 with emoji and special chars: @#$%\nMultiline text\nThird line',
    image_url: null,
    video_url: null,
    topics: ['Mental Health', 'Life']
  };

  console.log('   Payload:', JSON.stringify(testPost, null, 2));

  const { data, error } = await supabase
    .from('posts')
    .insert(testPost)
    .select('*')
    .single();

  if (error) {
    console.error('\n❌❌❌ INSERT FAILED!');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    console.error('Error Details:', error.details);
    console.error('Error Hint:', error.hint);
    console.error('\nFull Error Object:', JSON.stringify(error, null, 2));
    
    console.log('\n🔍 Common Causes:');
    console.log('  1. RLS Policy Rejection: The policy checks user_id = current_profile_id()');
    console.log('  2. Foreign Key Violation: profile.id does not exist in profiles table');
    console.log('  3. Check Constraint: invalid type or status value');
    console.log('  4. Missing Grant: authenticated role lacks INSERT permission');
    
    process.exit(1);
  }

  console.log('\n✅✅✅ INSERT SUCCEEDED!');
  console.log('New Post ID:', data.id);
  console.log('Created At:', data.created_at);
  console.log('\nFull Post Data:', JSON.stringify(data, null, 2));

  // Step 4: Verify it appears in SELECT
  console.log('\nStep 4: Verifying post is readable...');
  const { data: readPost, error: readError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', data.id)
    .single();

  if (readError) {
    console.error('❌ Cannot read post after insert (RLS SELECT policy issue?)');
    console.error('Error:', readError.message);
  } else {
    console.log('✅ Post is readable');
  }

  // Step 5: Clean up
  console.log('\nStep 5: Cleaning up test post...');
  const { error: deleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', data.id);

  if (deleteError) {
    console.error('⚠️  Could not delete test post:', deleteError.message);
    console.log('   Test post ID:', data.id, '- please delete manually');
  } else {
    console.log('✅ Test post deleted');
  }

  console.log('\n========================================');
  console.log('✅ POST INSERT TEST COMPLETE');
  console.log('========================================');
  console.log('\nThe database is working correctly for post insertion!');
  console.log('If the frontend is failing, the issue is in the frontend code.');
}

testPostInsert().catch(err => {
  console.error('\n💥 Unexpected Error:', err);
  process.exit(1);
});
