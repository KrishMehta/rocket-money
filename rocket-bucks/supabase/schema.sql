-- Database schema for Rocket Bucks
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plaid Items table (stores Plaid access tokens)
CREATE TABLE IF NOT EXISTS public.plaid_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id TEXT UNIQUE NOT NULL, -- Plaid item_id
  access_token TEXT NOT NULL, -- Encrypted in production
  institution_id TEXT,
  institution_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

-- Accounts table (stores bank accounts from Plaid)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plaid_item_id UUID NOT NULL REFERENCES public.plaid_items(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL, -- Plaid account_id
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- depository, credit, investment, loan
  subtype TEXT, -- checking, savings, credit card, etc.
  mask TEXT, -- Last 4 digits
  balance_current NUMERIC(12, 2) DEFAULT 0,
  balance_available NUMERIC(12, 2),
  currency_code TEXT DEFAULT 'USD',
  institution_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plaid_item_id, account_id)
);

-- Transaction Categories table (user-defined and Plaid categories)
CREATE TABLE IF NOT EXISTS public.transaction_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- NULL for system categories
  name TEXT NOT NULL,
  icon TEXT, -- Emoji or icon identifier
  color TEXT, -- Hex color code
  parent_category_id UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  is_system BOOLEAN DEFAULT FALSE, -- System categories from Plaid
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Recurring Transactions table (tracks subscription patterns, bills, etc.)
CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  -- Transaction details
  name TEXT NOT NULL, -- Merchant/subscription name
  merchant_name TEXT,
  expected_amount NUMERIC(12, 2), -- Expected amount (can vary)
  average_amount NUMERIC(12, 2), -- Calculated average from past transactions
  -- Recurrence pattern
  frequency TEXT NOT NULL, -- 'daily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'yearly', 'irregular'
  day_of_month INTEGER, -- For monthly: day of month (1-31)
  day_of_week INTEGER, -- For weekly: day of week (0-6, Sunday=0)
  week_of_month INTEGER, -- For monthly: which week (1-4, or NULL for day_of_month)
  -- Dates
  start_date DATE NOT NULL, -- When this recurring transaction started
  next_due_date DATE, -- Next expected transaction date
  last_transaction_date DATE, -- Date of most recent transaction
  end_date DATE, -- When this recurring transaction ended (NULL if active)
  -- Metadata
  transaction_type TEXT DEFAULT 'expense', -- expense, income
  is_active BOOLEAN DEFAULT TRUE,
  is_subscription BOOLEAN DEFAULT FALSE, -- Subscription vs bill
  notes TEXT,
  -- Tracking
  total_occurrences INTEGER DEFAULT 0, -- How many times this has occurred
  missed_count INTEGER DEFAULT 0, -- How many expected transactions were missed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name, account_id) -- Prevent duplicates
);

-- Transactions table (stores transactions from Plaid)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  transaction_id TEXT UNIQUE NOT NULL, -- Plaid transaction_id
  amount NUMERIC(12, 2) NOT NULL,
  date DATE NOT NULL, -- Transaction date (when it posted/cleared)
  name TEXT NOT NULL,
  -- Plaid categorization
  plaid_category TEXT[], -- Original Plaid category array
  plaid_primary_category TEXT, -- First category from Plaid
  plaid_detailed_category TEXT, -- Full category path from Plaid
  -- User-defined categorization
  category_id UUID REFERENCES public.transaction_categories(id) ON DELETE SET NULL,
  user_category_name TEXT, -- User's custom category name (denormalized for performance)
  -- Merchant and location
  merchant_name TEXT,
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  location_address TEXT,
  location_lat NUMERIC(10, 8),
  location_lon NUMERIC(11, 8),
  -- Transaction metadata
  transaction_type TEXT DEFAULT 'expense', -- expense, income, transfer
  payment_channel TEXT, -- online, in_store, atm, other
  check_number TEXT,
  -- Flags and status
  pending BOOLEAN DEFAULT FALSE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_transaction_id UUID REFERENCES public.recurring_transactions(id) ON DELETE SET NULL, -- Link to recurring transaction pattern
  excluded_from_budget BOOLEAN DEFAULT FALSE,
  is_transfer BOOLEAN DEFAULT FALSE,
  transfer_to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  -- User annotations
  notes TEXT,
  tags TEXT[], -- Array of tags for flexible filtering
  -- Date tracking (comprehensive)
  authorized_date DATE, -- When transaction was authorized (may be before date)
  posted_date DATE, -- When transaction posted to account (same as date usually)
  expected_date DATE, -- Expected date for recurring transactions
  due_date DATE, -- Due date for bills/subscriptions
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, transaction_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON public.plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_plaid_item_id ON public.accounts(plaid_item_id);

-- Transaction indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_date_range ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions(user_id, user_category_name);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON public.transactions(user_id, merchant_name);
CREATE INDEX IF NOT EXISTS idx_transactions_pending ON public.transactions(user_id, pending) WHERE pending = true;
CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON public.transactions(user_id, is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(user_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_tags ON public.transactions USING GIN(tags); -- GIN index for array searches
CREATE INDEX IF NOT EXISTS idx_transactions_name_search ON public.transactions USING GIN(to_tsvector('english', name)); -- Full-text search

-- Category indexes
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.transaction_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.transaction_categories(parent_category_id);

-- Recurring transaction indexes
CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON public.recurring_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_account_id ON public.recurring_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON public.recurring_transactions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_recurring_next_due ON public.recurring_transactions(user_id, next_due_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_recurring_category ON public.recurring_transactions(user_id, category_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own plaid items" ON public.plaid_items
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own categories" ON public.transaction_categories
  FOR SELECT USING (
    auth.uid() = user_id OR 
    (user_id IS NULL AND is_system = true) -- System categories visible to all
  );

CREATE POLICY "Users can manage own categories" ON public.transaction_categories
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own recurring transactions" ON public.recurring_transactions
  FOR ALL USING (auth.uid() = user_id);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update transaction updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on transactions
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-update updated_at on recurring_transactions
DROP TRIGGER IF EXISTS update_recurring_updated_at ON public.recurring_transactions;
CREATE TRIGGER update_recurring_updated_at
  BEFORE UPDATE ON public.recurring_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update recurring transaction stats when a transaction is linked
CREATE OR REPLACE FUNCTION public.update_recurring_transaction_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.recurring_transaction_id IS NOT NULL THEN
    UPDATE public.recurring_transactions
    SET 
      last_transaction_date = NEW.date,
      total_occurrences = total_occurrences + 1,
      average_amount = (
        SELECT AVG(amount)
        FROM public.transactions
        WHERE recurring_transaction_id = NEW.recurring_transaction_id
          AND transaction_type = NEW.transaction_type
      ),
      next_due_date = CASE
        WHEN frequency = 'daily' THEN NEW.date + INTERVAL '1 day'
        WHEN frequency = 'weekly' THEN NEW.date + INTERVAL '1 week'
        WHEN frequency = 'biweekly' THEN NEW.date + INTERVAL '2 weeks'
        WHEN frequency = 'monthly' THEN NEW.date + INTERVAL '1 month'
        WHEN frequency = 'bimonthly' THEN NEW.date + INTERVAL '2 months'
        WHEN frequency = 'quarterly' THEN NEW.date + INTERVAL '3 months'
        WHEN frequency = 'yearly' THEN NEW.date + INTERVAL '1 year'
        ELSE next_due_date -- Keep existing for irregular
      END
    WHERE id = NEW.recurring_transaction_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update recurring transaction when transaction is created/updated
DROP TRIGGER IF EXISTS on_transaction_recurring_update ON public.transactions;
CREATE TRIGGER on_transaction_recurring_update
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  WHEN (NEW.recurring_transaction_id IS NOT NULL)
  EXECUTE FUNCTION public.update_recurring_transaction_stats();

-- Insert default system categories (common Plaid categories)
INSERT INTO public.transaction_categories (name, icon, color, is_system, user_id)
VALUES
  ('Food and Drink', '🍽️', '#3b82f6', true, NULL),
  ('Shops', '🛍️', '#ef4444', true, NULL),
  ('Recreation', '🎮', '#8b5cf6', true, NULL),
  ('Service', '🔧', '#06b6d4', true, NULL),
  ('Transportation', '🚗', '#10b981', true, NULL),
  ('Travel', '✈️', '#f59e0b', true, NULL),
  ('Bank Fees', '🏦', '#6b7280', true, NULL),
  ('Entertainment', '🎬', '#ec4899', true, NULL),
  ('Gas Stations', '⛽', '#f97316', true, NULL),
  ('Groceries', '🛒', '#22c55e', true, NULL),
  ('Healthcare', '🏥', '#06b6d4', true, NULL),
  ('Hotels', '🏨', '#3b82f6', true, NULL),
  ('Pharmacy', '💊', '#8b5cf6', true, NULL),
  ('Restaurants', '🍴', '#f59e0b', true, NULL),
  ('Supermarkets', '🏪', '#22c55e', true, NULL),
  ('Utilities', '📋', '#6366f1', true, NULL),
  ('Education', '📚', '#f97316', true, NULL),
  ('Uncategorized', '❓', '#6b7280', true, NULL)
ON CONFLICT DO NOTHING;
