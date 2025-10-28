#!/bin/bash

echo "🚀 Rocket Bucks - Plaid Setup"
echo "=============================="
echo ""

if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 1
    fi
fi

echo "📝 Please enter your Plaid credentials:"
echo ""

read -p "Plaid Client ID: " CLIENT_ID
read -p "Plaid Sandbox Secret: " SECRET

cat > .env << END
# Plaid API Credentials
PLAID_CLIENT_ID=$CLIENT_ID
PLAID_SECRET=$SECRET

# Server Port
PORT=3001
END

echo ""
echo "✅ .env file created successfully!"
echo ""
echo "Next steps:"
echo "1. Open two terminal windows"
echo "2. In terminal 1, run: npm run server"
echo "3. In terminal 2, run: npm run dev"
echo "4. Visit http://localhost:5173 and click 'Connect Now'"
echo ""
echo "Test credentials:"
echo "  Username: user_good"
echo "  Password: pass_good"
echo ""
