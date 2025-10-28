import { useState, useRef, useEffect } from 'react';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const AIChat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! I'm your personal financial advisor. I can help you with budgeting, analyzing your spending patterns, providing savings tips, and answering any questions about your finances. How can I assist you today?",
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateAIResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('spending') || lowerMessage.includes('spend')) {
      return "Based on your recent transactions, you've spent $8,761 this month, which is $33,033 less than last month! Your top spending categories are Education (48%), Dining & Drinks (17%), and Bills & Utilities (12%). Would you like some tips on reducing spending in any of these areas?";
    } else if (lowerMessage.includes('save') || lowerMessage.includes('saving')) {
      return "Great question! Here are some personalized savings tips: 1) You're spending $1,640/month on dining - consider meal prepping to cut this by 30%. 2) I noticed you have multiple subscriptions totaling $1,567/year. Review them and cancel unused ones. 3) Your savings account ($20,000) could earn more in a high-yield savings account. Would you like help with any of these?";
    } else if (lowerMessage.includes('budget')) {
      return "Let's create a budget! Based on your income and spending patterns, I recommend the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings. Your current spending on Education ($3,399) and Bills ($1,070) seem to be your main needs. Shall we break this down further?";
    } else if (lowerMessage.includes('debt') || lowerMessage.includes('credit card')) {
      return "I see you have $610 in credit card debt. At typical interest rates, this could cost you $100+ per year in interest. I recommend: 1) Pay more than the minimum payment, 2) Consider the avalanche method (highest interest first), 3) Avoid new charges while paying down. Would you like a specific payoff plan?";
    } else if (lowerMessage.includes('net worth')) {
      return "Your net worth is currently $19,936 - that's fantastic! It's increased by $19,936 over the last 6 months. Your assets ($20,546) are primarily in savings (97%). To grow your wealth faster, consider diversifying into investments. Would you like investment recommendations?";
    } else if (lowerMessage.includes('investment') || lowerMessage.includes('invest')) {
      return "Investing can significantly grow your wealth! With $20,000 in savings, consider: 1) Keep 3-6 months expenses in savings ($5,000-10,000), 2) Invest the rest in a diversified portfolio (index funds, ETFs), 3) Start with low-cost platforms like Vanguard or Fidelity. At 7% average returns, $10,000 could grow to $19,672 in 10 years. Want to learn more?";
    } else if (lowerMessage.includes('subscription')) {
      return "Looking at your subscriptions: You're spending $1,567/yearly on 5 subscriptions including OpenAI ($20/mo), Cursor ($20/mo), Paramount+ ($12.99/mo), Apple App Store ($2.99/mo), and a Credit Card Fee ($895/year). The credit card fee is quite high - consider if the rewards justify it. I can help negotiate or cancel any of these!";
    } else if (lowerMessage.includes('bill') || lowerMessage.includes('lower')) {
      return "I can help lower your bills! Your AT&T bill is $164.44/month. I'm currently negotiating this for you (check the 'My requests' section). On average, we save customers 20-30% on utility bills. Would you like me to review your other recurring bills for savings opportunities?";
    } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return "Hello! Great to see you! I'm here to help you achieve your financial goals. Would you like to discuss your spending, savings strategies, debt payoff plans, or investment opportunities?";
    } else if (lowerMessage.includes('thank')) {
      return "You're very welcome! I'm here anytime you need financial guidance. Remember, small changes in spending can lead to big savings over time. Is there anything else you'd like to discuss?";
    } else {
      return "I'm here to help with your finances! I can provide insights on your spending ($8,761 this month), help optimize your budget, suggest ways to grow your savings ($20,000), analyze your subscriptions ($1,567/year), or discuss your net worth ($19,936). What would you like to explore?";
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI thinking time
    setTimeout(() => {
      const aiResponse: Message = {
        id: messages.length + 2,
        text: generateAIResponse(inputMessage),
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    { icon: '📊', text: 'Analyze my spending', action: 'Tell me about my spending patterns' },
    { icon: '💰', text: 'Savings tips', action: 'Give me tips to save more money' },
    { icon: '📈', text: 'Investment advice', action: 'Should I invest my savings?' },
    { icon: '💳', text: 'Lower my bills', action: 'How can I lower my bills?' },
  ];

  const handleQuickAction = (action: string) => {
    setInputMessage(action);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Financial Advisor</h1>
          <p className="text-gray-600">Get personalized financial advice powered by AI</p>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl rounded-2xl px-6 py-4 ${
                    message.sender === 'user'
                      ? 'bg-red-600 text-white'
                      : 'bg-white shadow-sm border border-gray-200'
                  }`}
                >
                  {message.sender === 'ai' && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        🤖
                      </div>
                      <span className="text-xs font-semibold text-gray-900">
                        Rocket Bucks AI
                      </span>
                    </div>
                  )}
                  <p className={`text-sm leading-relaxed ${message.sender === 'user' ? 'text-white' : 'text-gray-900'}`}>
                    {message.text}
                  </p>
                  <p className={`text-xs mt-2 ${message.sender === 'user' ? 'text-red-200' : 'text-gray-500'}`}>
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-2xl rounded-2xl px-6 py-4 bg-white shadow-sm border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      🤖
                    </div>
                    <span className="text-xs font-semibold text-gray-900">Rocket Bucks AI</span>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length <= 1 && (
            <div className="px-8 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickAction(action.action)}
                    className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-red-300 hover:shadow-md transition-all"
                  >
                    <span className="text-2xl">{action.icon}</span>
                    <span className="text-xs font-medium text-gray-700 text-center">
                      {action.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-gray-200 bg-white px-8 py-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your finances..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                disabled={isTyping}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isTyping}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              💡 Tip: Ask about spending, savings, investments, or bill negotiations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;

