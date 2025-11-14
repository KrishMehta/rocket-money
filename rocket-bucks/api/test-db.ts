import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Test database connection by querying users table
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: error.message 
      });
    }

    res.json({ 
      success: true, 
      message: 'Database connection successful',
      supabaseUrl: supabaseUrl ? 'Configured' : 'Missing'
    });
  } catch (error: any) {
    res.status(500).json({ 
      error: 'Test failed',
      details: error.message 
    });
  }
}

