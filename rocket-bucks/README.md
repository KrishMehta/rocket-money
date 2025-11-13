# 🚀 Rocket Bucks

A modern personal finance management app with real-time bank account integration powered by Plaid.

## ✨ Features

- 💰 **Real Bank Integration**: Connect actual financial institutions via Plaid
- 📊 **Transaction Tracking**: Automatically import and categorize transactions
- 💳 **Multiple Accounts**: Link checking, savings, credit cards, and investment accounts
- 📈 **Net Worth Tracking**: View all your accounts in one place
- 🤖 **AI Insights**: Get intelligent financial insights
- 🎯 **Spending Analysis**: Track and analyze your spending patterns
- 🔄 **Recurring Transactions**: Identify subscription and recurring payments

## 🏦 Production Environment

**This app is configured for Plaid's production environment** - users can connect their real bank accounts and see actual financial data from 11,000+ supported institutions.

## 🚀 Quick Start

See **[PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)** for detailed setup instructions.

### Prerequisites

- Node.js 18+ installed
- Plaid production API credentials
- Approved for Plaid production access

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create `.env` file with your Plaid production credentials:

```env
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_production_secret
PORT=3001
```

3. Start the application:

```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend  
npm run dev
```

4. Navigate to [http://localhost:5173](http://localhost:5173)

## 📚 Documentation

- **[PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)** - Complete production setup guide
- **[README_PLAID.md](./README_PLAID.md)** - Plaid integration details
- **[PLAID_SETUP.md](./PLAID_SETUP.md)** - Quick setup reference

## 🔐 Security

- Bank-level encryption (256-bit SSL)
- Read-only access to accounts
- Credentials never stored
- Environment variables protected via .gitignore

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + Node.js
- **Integration**: Plaid API (Production)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
