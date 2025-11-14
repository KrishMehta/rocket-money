import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from '../lib/supabase';
import { encrypt } from '../lib/encryption';

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
      'PLAID-SECRET': process.env.PLAID_SECRET || '',
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseClient(token);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { public_token } = req.body;

    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Get item info and accounts
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const institutionId = itemResponse.data.item.institution_id;
    let institutionName = 'Unknown Bank';

    if (institutionId) {
      try {
        const institutionResponse = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: ['US'],
        });
        institutionName = institutionResponse.data.institution.name;
      } catch (err) {
        console.error('Error fetching institution:', err);
      }
    }

    // Encrypt access token before storing
    const encryptionKey = process.env.ENCRYPTION_KEY || '';
    const encryptedAccessToken = encryptionKey
      ? encrypt(accessToken, encryptionKey)
      : accessToken; // Fallback to plaintext if key not set (development only)

    // Store Plaid item in database
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .insert({
        user_id: user.id,
        item_id: itemId,
        access_token: encryptedAccessToken, // Encrypted for security
        institution_id: institutionId,
        institution_name: institutionName,
      })
      .select()
      .single();

    if (itemError) {
      console.error('Error saving plaid item:', itemError);
      // Continue anyway, but log the error
    }

    // Store accounts in database
    if (plaidItem && accountsResponse.data.accounts.length > 0) {
      const accountsToInsert = accountsResponse.data.accounts.map((account: any) => ({
        user_id: user.id,
        plaid_item_id: plaidItem.id,
        account_id: account.account_id,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
        balance_current: account.balances.current || 0,
        balance_available: account.balances.available,
        currency_code: account.balances.iso_currency_code || 'USD',
        institution_name: institutionName,
      }));

      const { error: accountsError } = await supabase
        .from('accounts')
        .upsert(accountsToInsert, {
          onConflict: 'plaid_item_id,account_id',
        });

      if (accountsError) {
        console.error('Error saving accounts:', accountsError);
      }
    }

    // Don't return access_token to client - it's stored encrypted in database
    res.json({
      item_id: itemId,
      accounts: accountsResponse.data.accounts,
      institution_name: institutionName,
    });
  } catch (error: any) {
    console.error('Error exchanging public token:', error);
    // Don't expose internal error details
    res.status(500).json({ 
      error: 'Failed to exchange token'
    });
  }
}

