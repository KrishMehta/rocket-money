import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from '../../lib/supabase.js';

const MAX_CHAT_HISTORY = 8;

// Helper constants
const liabilityAccountTypes = new Set(['credit', 'loan', 'mortgage', 'liability', 'other liability']);

// Helper functions
function normalizeAmount(value: any): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: any, options: { decimals?: number; includeSign?: boolean } = {}): string {
  const { decimals = 0, includeSign = false } = options;
  const amount = normalizeAmount(value);
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const prefix = amount < 0 ? '-' : includeSign && amount > 0 ? '+' : '';
  return `${prefix}$${formatted}`;
}

async function buildFinancialContext(supabase: any, userId: string) {
  const now = new Date();
  const context: any = {
    totals: {
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      liquidCash: 0,
      invested: 0,
    },
    spending: {
      totalSpending30: 0,
      prevSpending30: 0,
      spendingChange: 0,
      averageDaily: 0,
      totalIncome30: 0,
      netCashFlow30: 0,
      topCategories: [],
      largePurchases: [],
    },
    recurring: {
      subscriptionCount: 0,
      monthlyRecurring: 0,
      upcomingCharges: [],
      largestCharges: [],
    },
    accounts: {
      topAccounts: [],
    },
    insights: [],
    generatedAt: now.toISOString(),
  };

  try {
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [accountsResult, recurringResult, transactionsResult] = await Promise.all([
      supabase
        .from('accounts')
        .select('name, institution_name, type, subtype, balance_current, balance_available')
        .eq('user_id', userId),
      supabase
        .from('recurring_transactions')
        .select('name, merchant_name, expected_amount, frequency, next_due_date, transaction_type, is_subscription')
        .eq('user_id', userId)
        .order('expected_amount', { ascending: false })
        .limit(20),
      supabase
        .from('transactions')
        .select('amount, date, name, merchant_name, plaid_primary_category, user_category_name, transaction_type, is_transfer')
        .eq('user_id', userId)
        .gte('date', sixtyDaysAgo.toISOString().split('T')[0])
        .lte('date', now.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .limit(600),
    ]);

    if (accountsResult.error) {
      console.error('AI context: failed to load accounts', accountsResult.error);
    }
    if (recurringResult.error) {
      console.error('AI context: failed to load recurring transactions', recurringResult.error);
    }
    if (transactionsResult.error) {
      console.error('AI context: failed to load transactions', transactionsResult.error);
    }

    const accounts = accountsResult.data || [];
    const recurring = recurringResult.data || [];
    const transactions = transactionsResult.data || [];

    accounts.forEach((account: any) => {
      const accountType = (account.type || '').toLowerCase();
      const currentBalance = normalizeAmount(
        account.balance_current ?? account.balance_available ?? 0
      );
      const availableBalance = normalizeAmount(
        account.balance_available ?? account.balance_current ?? 0
      );

      if (liabilityAccountTypes.has(accountType)) {
        context.totals.totalLiabilities += Math.abs(currentBalance);
      } else {
        context.totals.totalAssets += currentBalance;
        if (accountType === 'depository') {
          context.totals.liquidCash += availableBalance;
        }
        if (accountType === 'investment') {
          context.totals.invested += currentBalance;
        }
      }
    });
    context.totals.netWorth = context.totals.totalAssets - context.totals.totalLiabilities;

    context.accounts.topAccounts = accounts
      .map((account: any) => ({
        name: account.name,
        institution: account.institution_name,
        type: account.type,
        balance: normalizeAmount(account.balance_current ?? account.balance_available ?? 0),
      }))
      .sort((a: any, b: any) => b.balance - a.balance)
      .slice(0, 5);

    // Helper function to get category name (same logic as Spending page)
    const getCategoryName = (tx: any) => {
      return tx.user_category_name ||
             tx.plaid_primary_category ||
             'Uncategorized';
    };

    // Filter expenses: exclude transfers and income-categorized transactions
    const expenses = transactions.filter((tx: any) => {
      const categoryName = getCategoryName(tx);
      const txName = (tx.name || '').toLowerCase();
      const merchantName = (tx.merchant_name || '').toLowerCase();
      const fullName = `${txName} ${merchantName}`;
      
      // Check if this looks like a credit card payment or transfer
      const isCreditCardPayment = 
        /payment.*(american express|amex|chase|discover|capital one|citibank|card)/i.test(fullName) ||
        /(american express|amex|chase|discover|capital one|citibank).*payment/i.test(fullName) ||
        /ach.*(payment|transfer)/i.test(fullName) ||
        /payment.*thank you/i.test(fullName) ||
        /online transfer/i.test(fullName) ||
        /zelle|venmo|paypal|cash app/i.test(fullName);
      
      return tx.transaction_type === 'expense' && 
             normalizeAmount(tx.amount) > 0 && 
             tx.date &&
             !tx.is_transfer &&
             !isCreditCardPayment &&
             categoryName !== 'Income' && 
             categoryName !== 'Transfer';
    });

    // Filter income: only count transactions categorized as "Income"
    const incomes = transactions.filter((tx: any) => {
      const categoryName = getCategoryName(tx);
      return categoryName === 'Income' && tx.date;
    });

    const expensesLast30 = expenses.filter((tx: any) => {
      const txDate = tx.date ? new Date(tx.date) : null;
      return txDate && txDate >= thirtyDaysAgo;
    });
    const expensesPrev30 = expenses.filter((tx: any) => {
      const txDate = tx.date ? new Date(tx.date) : null;
      return txDate && txDate < thirtyDaysAgo && txDate >= sixtyDaysAgo;
    });
    const incomesLast30 = incomes.filter((tx: any) => {
      const txDate = tx.date ? new Date(tx.date) : null;
      return txDate && txDate >= thirtyDaysAgo;
    });

    context.spending.totalSpending30 = expensesLast30.reduce(
      (sum: number, tx: any) => sum + normalizeAmount(tx.amount),
      0
    );
    context.spending.prevSpending30 = expensesPrev30.reduce(
      (sum: number, tx: any) => sum + normalizeAmount(tx.amount),
      0
    );
    context.spending.spendingChange =
      context.spending.totalSpending30 - context.spending.prevSpending30;
    context.spending.averageDaily =
      context.spending.totalSpending30 > 0 ? context.spending.totalSpending30 / 30 : 0;
    context.spending.totalIncome30 = incomesLast30.reduce(
      (sum: number, tx: any) => sum + Math.abs(normalizeAmount(tx.amount)),
      0
    );
    context.spending.netCashFlow30 =
      context.spending.totalIncome30 - context.spending.totalSpending30;

    const categoryMap: Record<string, number> = {};
    expensesLast30.forEach((tx: any) => {
      const category = getCategoryName(tx) || 'Other';
      const amount = normalizeAmount(tx.amount);
      categoryMap[category] = (categoryMap[category] || 0) + amount;
    });
    context.spending.topCategories = Object.entries(categoryMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percent:
          context.spending.totalSpending30 > 0
            ? Math.round((amount / context.spending.totalSpending30) * 100)
            : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4);

    context.spending.largePurchases = expensesLast30
      .slice()
      .sort((a: any, b: any) => normalizeAmount(b.amount) - normalizeAmount(a.amount))
      .slice(0, 3)
      .map((tx: any) => ({
        name: tx.merchant_name || tx.name || 'Transaction',
        amount: normalizeAmount(tx.amount),
        date: tx.date,
        category: tx.plaid_primary_category || 'General',
      }));

    const expenseRecurring = recurring.filter(
      (item: any) => item.transaction_type === 'expense'
    );
    context.recurring.subscriptionCount = expenseRecurring.length;
    context.recurring.monthlyRecurring = expenseRecurring.reduce(
      (sum: number, item: any) => sum + normalizeAmount(item.expected_amount),
      0
    );
    context.recurring.upcomingCharges = expenseRecurring
      .filter((item: any) => item.next_due_date)
      .slice()
      .sort((a: any, b: any) => {
        const timeA = a.next_due_date ? new Date(a.next_due_date).getTime() : Number.POSITIVE_INFINITY;
        const timeB = b.next_due_date ? new Date(b.next_due_date).getTime() : Number.POSITIVE_INFINITY;
        return timeA - timeB;
      })
      .slice(0, 5)
      .map((item: any) => ({
        name: item.name,
        amount: normalizeAmount(item.expected_amount),
        frequency: item.frequency || 'monthly',
        next_due_date: item.next_due_date,
      }));
    context.recurring.largestCharges = expenseRecurring
      .slice()
      .sort((a: any, b: any) => normalizeAmount(b.expected_amount) - normalizeAmount(a.expected_amount))
      .slice(0, 5)
      .map((item: any) => ({
        name: item.name,
        amount: normalizeAmount(item.expected_amount),
        frequency: item.frequency || 'monthly',
        is_subscription: !!item.is_subscription,
      }));

    const insights = [];
    if (
      context.spending.prevSpending30 > 0 &&
      Math.abs(context.spending.spendingChange) > context.spending.prevSpending30 * 0.1
    ) {
      const changePercent =
        (context.spending.spendingChange / context.spending.prevSpending30) * 100;
      insights.push(
        `Spending is ${changePercent > 0 ? 'up' : 'down'} ${Math.abs(changePercent).toFixed(
          1
        )}% vs the prior 30 days.`
      );
    }
    if (context.recurring.subscriptionCount > 0 && context.spending.totalSpending30 > 0) {
      const recurringPercent =
        (context.recurring.monthlyRecurring / context.spending.totalSpending30) * 100;
      insights.push(
        `Recurring charges represent ${recurringPercent.toFixed(
          1
        )}% of monthly spend.`
      );
    }
    context.insights = insights;
  } catch (error) {
    console.error('AI context: unexpected error building snapshot', error);
  }

  context.generatedAt = new Date().toISOString();
  return context;
}

function summarizeContextForPrompt(context: any): string {
  if (!context) {
    return 'No financial data is available yet.';
  }

  const lines = [
    `Net worth ${formatCurrency(context.totals.netWorth)} = assets ${formatCurrency(
      context.totals.totalAssets
    )} minus liabilities ${formatCurrency(context.totals.totalLiabilities)}.`,
    `Liquid cash ${formatCurrency(context.totals.liquidCash)} | Invested assets ${formatCurrency(
      context.totals.invested
    )}.`,
    `30-day spending ${formatCurrency(context.spending.totalSpending30)} (${formatCurrency(
      context.spending.spendingChange,
      { includeSign: true }
    )} vs prior 30 days). Avg daily spend ${formatCurrency(context.spending.averageDaily, {
      decimals: 2,
    })}.`,
    `30-day income ${formatCurrency(context.spending.totalIncome30)} | Net cash flow ${formatCurrency(
      context.spending.netCashFlow30,
      { includeSign: true }
    )}.`,
  ];

  if (context.spending.topCategories.length) {
    const categoryText = context.spending.topCategories
      .map(
        (cat: any) => `${cat.name}: ${formatCurrency(cat.amount)} (${cat.percent || 0}% of spend)`
      )
      .join('; ');
    lines.push(`Top categories last 30 days: ${categoryText}.`);
  } else {
    lines.push('Top categories last 30 days: no categorized spending recorded.');
  }

  if (context.spending.largePurchases.length) {
    const purchasesText = context.spending.largePurchases
      .map((tx: any) => `${tx.name} ${formatCurrency(tx.amount)} on ${tx.date}`)
      .join('; ');
    lines.push(`Largest recent purchases: ${purchasesText}.`);
  }

  if (context.recurring.subscriptionCount > 0) {
    lines.push(
      `Recurring/subscription expenses: ${context.recurring.subscriptionCount} active, about ${formatCurrency(
        context.recurring.monthlyRecurring
      )} per month.`
    );
  }

  if (context.recurring.upcomingCharges.length) {
    const upcomingText = context.recurring.upcomingCharges
      .map(
        (charge: any) =>
          `${charge.name} ${formatCurrency(charge.amount)} due ${
            charge.next_due_date || 'soon'
          }`
      )
      .join('; ');
    lines.push(`Upcoming bills: ${upcomingText}.`);
  }

  if (context.accounts.topAccounts.length) {
    const accountsText = context.accounts.topAccounts
      .map(
        (account: any) =>
          `${account.name || account.institution || 'Account'} (${account.type || 'account'}): ${formatCurrency(
            account.balance
          )}`
      )
      .join('; ');
    lines.push(`Key accounts: ${accountsText}.`);
  }

  if (context.insights && context.insights.length) {
    lines.push(`Insights: ${context.insights.join(' | ')}`);
  }

  return lines.join('\n');
}

function extractMessageText(completion: any): string {
  if (!completion?.choices?.length) {
    return '';
  }

  const content = completion.choices[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('')
      .trim();
  }

  if (content && typeof content.text === 'string') {
    return content.text;
  }

  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const openRouterApiKey = process.env.OPENROUTER_API_KEY || '';
    const openRouterModel = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
    const openRouterReferer =
      process.env.OPENROUTER_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://rocket-money-azure.vercel.app');

    if (!openRouterApiKey) {
      return res.status(503).json({ error: 'AI advisor is not configured.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { message, conversation } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseClient(token);

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const trimmedMessage = message.trim().slice(0, 2000);

    console.log(`AI chat: generating advice for user ${user.id}`);

    const financialContext = await buildFinancialContext(supabase, user.id);
    const contextSummary = summarizeContextForPrompt(financialContext);

    const normalizedHistory = Array.isArray(conversation)
      ? conversation
          .filter(
            (entry: any) =>
              entry &&
              typeof entry.content === 'string' &&
              (entry.role === 'user' ||
                entry.role === 'assistant' ||
                entry.role === 'ai')
          )
          .slice(-MAX_CHAT_HISTORY)
          .map((entry: any) => ({
            role: entry.role === 'user' ? 'user' : 'assistant',
            content: entry.content.slice(0, 2000),
          }))
      : [];

    const systemPrompt =
      'You are Rocket Bucks AI, a fiduciary-quality financial coach. Provide concise and actionable guidance covering budgets, savings, debt payoff, investing, and bill negotiation. Use Markdown formatting with short headings, numbered steps, and bullet lists when helpful. Reference exact numbers from the financial snapshot or chat history and acknowledge when information is unavailable. Encourage healthy financial habits and note that users should double-check details before acting.';

    const payload = {
      model: openRouterModel,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'system',
          content: `Financial snapshot:\n${contextSummary}\nOnly rely on these values unless the user provides newer numbers.`,
        },
        ...normalizedHistory,
        { role: 'user', content: trimmedMessage },
      ],
      temperature: 0.35,
      max_tokens: 600,
      top_p: 0.9,
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': openRouterReferer,
        'X-Title': 'Rocket Bucks AI',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', errorText);
      return res.status(502).json({ error: 'AI advisor is temporarily unavailable.' });
    }

    const completion = await response.json();
    const aiMessage = extractMessageText(completion).trim();

    if (!aiMessage) {
      console.error('OpenRouter returned an empty message payload:', completion);
      return res.status(502).json({ error: 'AI advisor returned an empty response.' });
    }

    res.json({
      message: aiMessage,
      model: openRouterModel,
      context: {
        netWorth: financialContext.totals.netWorth,
        totalAssets: financialContext.totals.totalAssets,
        totalLiabilities: financialContext.totals.totalLiabilities,
        monthlySpending: financialContext.spending.totalSpending30,
        monthlyIncome: financialContext.spending.totalIncome30,
        spendingChange: financialContext.spending.spendingChange,
        recurringTotal: financialContext.recurring.monthlyRecurring,
        generatedAt: financialContext.generatedAt,
      },
      context_summary: contextSummary,
    });
  } catch (error: any) {
    console.error('Error generating AI advice:', error);
    res.status(500).json({ error: 'Failed to generate AI advice' });
  }
}

