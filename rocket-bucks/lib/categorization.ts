/**
 * Automatic transaction categorization utility
 * Maps merchant names and transaction descriptions to categories
 */

export interface CategoryMapping {
  keywords: string[];
  category: string;
  exactMatch?: string[];
}

// Category mappings based on common merchant names and keywords
const categoryMappings: CategoryMapping[] = [
  // Food & Dining
  {
    keywords: ['uber eats', 'doordash', 'grubhub', 'postmates', 'seamless', 'delivery', 'restaurant', 'dining', 'food'],
    exactMatch: ['uber eats', 'doordash', 'grubhub', 'postmates'],
    category: 'Food and Drink'
  },
  {
    keywords: ['mcdonalds', 'burger king', 'taco bell', 'chipotle', 'subway', 'panera', 'wendys', 'chick-fil-a', 'five guys', 'shake shack', 'in-n-out', 'raising cane', 'popeyes', 'kfc', 'pizza', 'starbucks', 'dunkin', 'cafe', 'coffee'],
    category: 'Restaurants'
  },
  {
    keywords: ['whole foods', 'trader joe', 'safeway', 'kroger', 'publix', 'albertsons', 'heb', 'wegmans', 'aldi', 'lidl', 'costco', 'sam\'s club', 'walmart', 'target', 'grocery', 'supermarket', 'market'],
    category: 'Groceries'
  },

  // Transportation
  {
    keywords: ['uber', 'lyft', 'taxi', 'cab', 'ride', 'transit', 'metro', 'bus', 'train', 'subway'],
    exactMatch: ['uber', 'lyft'],
    category: 'Transportation'
  },
  {
    keywords: ['shell', 'chevron', 'exxon', 'mobil', 'bp', '76', 'arco', 'texaco', 'valero', 'circle k', 'speedway', 'gas', 'fuel', 'petrol'],
    category: 'Gas Stations'
  },
  {
    keywords: ['parking', 'toll', 'parkwhiz', 'spothero'],
    category: 'Transportation'
  },

  // Shopping
  {
    keywords: ['amazon', 'ebay', 'etsy', 'target', 'walmart', 'best buy', 'apple store', 'nike', 'adidas', 'zara', 'h&m', 'gap', 'old navy', 'nordstrom', 'macy', 'kohls', 'tj maxx', 'marshalls'],
    category: 'Shopping'
  },
  {
    keywords: ['home depot', 'lowes', 'ikea', 'bed bath', 'wayfair', 'furniture'],
    category: 'Home'
  },

  // Entertainment & Recreation
  {
    keywords: ['netflix', 'hulu', 'disney+', 'hbo', 'amazon prime video', 'paramount+', 'peacock', 'apple tv', 'spotify', 'apple music', 'youtube', 'twitch', 'streaming'],
    category: 'Entertainment'
  },
  {
    keywords: ['amc', 'regal', 'cinemark', 'movie', 'cinema', 'theater', 'theatre'],
    category: 'Entertainment'
  },
  {
    keywords: ['gym', 'fitness', 'planet fitness', 'la fitness', '24 hour fitness', 'equinox', 'crunch', 'yoga', 'pilates', 'peloton'],
    category: 'Health & Wellness'
  },
  {
    keywords: ['steam', 'playstation', 'xbox', 'nintendo', 'gaming', 'game'],
    category: 'Entertainment'
  },

  // Travel
  {
    keywords: ['airbnb', 'hotel', 'motel', 'marriott', 'hilton', 'hyatt', 'ihg', 'holiday inn', 'best western', 'expedia', 'booking.com', 'hotels.com'],
    category: 'Hotels'
  },
  {
    keywords: ['airline', 'airways', 'united', 'american airlines', 'delta', 'southwest', 'jetblue', 'spirit', 'frontier', 'alaska air', 'flight'],
    category: 'Travel'
  },

  // Healthcare
  {
    keywords: ['cvs', 'walgreens', 'rite aid', 'pharmacy', 'drug', 'prescription'],
    category: 'Pharmacy'
  },
  {
    keywords: ['hospital', 'clinic', 'medical', 'doctor', 'dentist', 'dental', 'physician', 'healthcare', 'health'],
    category: 'Healthcare'
  },

  // Bills & Utilities
  {
    keywords: ['at&t', 'verizon', 't-mobile', 'sprint', 'comcast', 'xfinity', 'spectrum', 'cox', 'directv', 'dish', 'internet', 'cable', 'phone', 'mobile', 'wireless'],
    category: 'Bills & Utilities'
  },
  {
    keywords: ['electric', 'electricity', 'gas', 'water', 'power', 'energy', 'utility', 'utilities'],
    category: 'Utilities'
  },

  // Services & Professional
  {
    keywords: ['insurance', 'geico', 'progressive', 'state farm', 'allstate'],
    category: 'Insurance'
  },
  {
    keywords: ['lawyer', 'attorney', 'legal', 'tax', 'accountant', 'cpa'],
    category: 'Services'
  },

  // Technology & Software
  {
    keywords: ['adobe', 'microsoft', 'apple', 'google', 'openai', 'chatgpt', 'github', 'aws', 'azure', 'digitalocean', 'heroku', 'vercel', 'netlify', 'cursor', 'software', 'saas', 'subscription'],
    category: 'Service'
  },

  // Education
  {
    keywords: ['tuition', 'school', 'college', 'university', 'coursera', 'udemy', 'edx', 'masterclass', 'textbook', 'education'],
    category: 'Education'
  },

  // Personal Care
  {
    keywords: ['salon', 'barber', 'haircut', 'spa', 'massage', 'nail', 'beauty'],
    category: 'Personal Care'
  },

  // Gifts & Donations
  {
    keywords: ['charity', 'donation', 'donate', 'giving', 'patreon', 'gofundme', 'kickstarter'],
    category: 'Gifts & Donations'
  },

  // Banking & Transfers
  {
    keywords: ['zelle', 'venmo', 'paypal', 'cash app', 'transfer', 'payment', 'wire', 'ach'],
    category: 'Transfer'
  },
  {
    keywords: ['interest charge', 'late fee', 'overdraft', 'atm fee', 'bank fee', 'service charge', 'annual fee'],
    category: 'Bank Fees'
  },
  {
    keywords: ['interest payment', 'dividend', 'capital gain', 'stock', 'investment', 'trading', 'robinhood', 'etrade', 'fidelity', 'schwab', 'vanguard'],
    category: 'Investments'
  },

  // Income
  {
    keywords: ['paycheck', 'salary', 'wage', 'direct deposit', 'payment received', 'refund', 'reimbursement', 'credit'],
    category: 'Income'
  },
];

/**
 * Automatically categorize a transaction based on its name and merchant
 */
export function autoCategorizeTransaction(
  transactionName: string,
  merchantName?: string | null
): string {
  const searchText = `${transactionName} ${merchantName || ''}`.toLowerCase();

  // First, try exact matches
  for (const mapping of categoryMappings) {
    if (mapping.exactMatch) {
      for (const exact of mapping.exactMatch) {
        if (searchText.includes(exact.toLowerCase())) {
          return mapping.category;
        }
      }
    }
  }

  // Then, try keyword matches
  for (const mapping of categoryMappings) {
    for (const keyword of mapping.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return mapping.category;
      }
    }
  }

  // Default to Uncategorized
  return 'Uncategorized';
}

/**
 * Get category for display (includes icon mapping)
 */
export function getCategoryDisplay(categoryName: string): { name: string; icon: string } {
  const categoryIcons: { [key: string]: string } = {
    'Food and Drink': '🍽️',
    'Restaurants': '🍴',
    'Groceries': '🛒',
    'Transportation': '🚗',
    'Gas Stations': '⛽',
    'Shopping': '🛍️',
    'Home': '🏠',
    'Entertainment': '🎬',
    'Hotels': '🏨',
    'Travel': '✈️',
    'Pharmacy': '💊',
    'Healthcare': '🏥',
    'Bills & Utilities': '📋',
    'Utilities': '💡',
    'Insurance': '🛡️',
    'Services': '🔧',
    'Service': '🔧',
    'Education': '📚',
    'Personal Care': '💇',
    'Gifts & Donations': '🎁',
    'Transfer': '💸',
    'Bank Fees': '🏦',
    'Investments': '📈',
    'Income': '💰',
    'Shops': '🛍️',
    'Recreation': '🎮',
    'Supermarkets': '🏪',
    'Auto & Transport': '🚗',
    'Dining & Drinks': '🍽️',
    'Health & Wellness': '🏋️',
    'Travel & Vacation': '✈️',
    'Fees': '💳',
    'Uncategorized': '❓',
  };

  return {
    name: categoryName,
    icon: categoryIcons[categoryName] || '❓',
  };
}

