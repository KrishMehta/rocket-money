import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { api } from '../utils/api';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  status?: 'error';
}

interface FinancialSnapshot {
  netWorth?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  monthlySpending?: number;
  monthlyIncome?: number;
  spendingChange?: number;
  recurringTotal?: number;
  generatedAt?: string;
}

type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'unordered-list'; items: string[] }
  | { type: 'heading'; text: string };

const MAX_HISTORY_MESSAGES = 8;

const createMessageId = () => Date.now() + Math.floor(Math.random() * 1000);

const formatCurrencyValue = (value?: number) => {
  const numericValue =
    typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const fractionDigits = Math.abs(numericValue) >= 1000 ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(numericValue);
};

const formatSignedCurrency = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value) || value === 0) {
    return formatCurrencyValue(0);
  }
  const formatted = formatCurrencyValue(Math.abs(value));
  return value > 0 ? `+${formatted}` : `-${formatted}`;
};

const normalizeAssistantText = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/(?<!\n)(\d+\.\s)/g, '\n$1')
    .replace(/(?<!\n)([-•]\s)/g, '\n$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const buildContentBlocks = (text: string): ContentBlock[] => {
  const normalized = normalizeAssistantText(text);
  if (!normalized) {
    return [];
  }

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: ContentBlock[] = [];
  let currentListType: 'ordered-list' | 'unordered-list' | null = null;
  let currentItems: string[] = [];

  const flushList = () => {
    if (currentListType && currentItems.length) {
      blocks.push({ type: currentListType, items: currentItems });
      currentListType = null;
      currentItems = [];
    }
  };

  lines.forEach((line) => {
    const headingMatch = line.match(/^#{1,6}\s*(.*)$/);
    const orderedMatch = line.match(/^(\d+)\.\s*(.*)$/);
    const unorderedMatch = line.match(/^[-•]\s*(.*)$/);

    if (headingMatch) {
      flushList();
      blocks.push({
        type: 'heading',
        text: headingMatch[1]?.trim() || '',
      });
      return;
    }

    if (orderedMatch) {
      if (currentListType !== 'ordered-list') {
        flushList();
        currentListType = 'ordered-list';
      }
      currentItems.push((orderedMatch[2] || orderedMatch[1]).trim());
      return;
    }

    if (unorderedMatch) {
      if (currentListType !== 'unordered-list') {
        flushList();
        currentListType = 'unordered-list';
      }
      currentItems.push(unorderedMatch[1]?.trim() || '');
      return;
    }

    flushList();
    blocks.push({
      type: 'paragraph',
      text: line,
    });
  });

  flushList();
  return blocks.length ? blocks : [{ type: 'paragraph', text: normalized }];
};

const renderAssistantContent = (text: string) => {
  const blocks = buildContentBlocks(text);

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <p key={`heading-${index}`} className="text-sm font-semibold text-gray-900">
              {block.text}
            </p>
          );
        }

        if (block.type === 'ordered-list') {
          return (
            <ol
              key={`ol-${index}`}
              className="list-decimal pl-5 space-y-1 text-sm text-gray-900 leading-relaxed"
            >
              {block.items.map((item, itemIndex) => (
                <li key={`ol-${index}-${itemIndex}`}>{item}</li>
              ))}
            </ol>
          );
        }

        if (block.type === 'unordered-list') {
          return (
            <ul
              key={`ul-${index}`}
              className="list-disc pl-5 space-y-1 text-sm text-gray-900 leading-relaxed"
            >
              {block.items.map((item, itemIndex) => (
                <li key={`ul-${index}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`paragraph-${index}`} className="text-sm leading-relaxed text-gray-900">
            {block.text}
          </p>
        );
      })}
    </div>
  );
};

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
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (overrideMessage?: string) => {
    if (isTyping) return;

    const outgoing = (overrideMessage ?? inputMessage).trim();
    if (!outgoing) return;

    const userMessage: Message = {
      id: createMessageId(),
      text: outgoing,
      sender: 'user',
      timestamp: new Date(),
    };

    let updatedMessages: Message[] = [];
    setMessages((prev) => {
      updatedMessages = [...prev, userMessage];
      return updatedMessages;
    });
    setInputMessage('');
    setIsTyping(true);

    const baseMessages = updatedMessages.length ? updatedMessages : [...messages, userMessage];
    const conversationHistory = baseMessages
      .filter((msg) => msg.sender === 'user' || msg.sender === 'ai')
      .slice(-MAX_HISTORY_MESSAGES)
      .map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text,
      })) as { role: 'user' | 'assistant'; content: string }[];

    try {
      const response = await api.askFinancialAdvisor({
        message: outgoing,
        conversation: conversationHistory,
      });

      if (response.context) {
        setSnapshot(response.context);
      }

      const replyText =
        response.message?.trim() ||
        "I'm reviewing your finances. Try asking another question in a moment.";

      const aiMessage: Message = {
        id: createMessageId(),
        text: replyText,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const fallbackMessage: Message = {
        id: createMessageId(),
        text:
          error instanceof Error && error.message
            ? error.message
            : "I'm having trouble reaching our advisor right now. Please try again shortly.",
        sender: 'ai',
        timestamp: new Date(),
        status: 'error',
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    { icon: '📊', text: 'Analyze my spending', action: 'Tell me about my spending patterns' },
    { icon: '💡', text: 'Savings tips', action: 'Give me tips to save more money' },
    { icon: '📈', text: 'Investment advice', action: 'Should I invest my savings?' },
    { icon: '💸', text: 'Lower my bills', action: 'How can I lower my bills?' },
  ];

  const handleQuickAction = (action: string) => {
    if (isTyping) return;
    handleSendMessage(action);
  };

  const spendingChangeClass =
    snapshot && typeof snapshot.spendingChange === 'number'
      ? snapshot.spendingChange > 0
        ? 'text-red-600'
        : snapshot.spendingChange < 0
          ? 'text-green-600'
          : 'text-gray-500'
      : 'text-gray-500';

  const snapshotUpdatedAt = snapshot?.generatedAt
    ? new Date(snapshot.generatedAt).toLocaleString()
    : null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Financial Advisor</h1>
          <p className="text-gray-600">Get personalized financial advice powered by AI</p>

          {snapshot && (
            <>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-xs uppercase text-gray-500 tracking-wide">Net worth</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrencyValue(snapshot.netWorth)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-xs uppercase text-gray-500 tracking-wide">30-day spend</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrencyValue(snapshot.monthlySpending)}
                  </p>
                  <p className={`text-xs mt-1 ${spendingChangeClass}`}>
                    {typeof snapshot.spendingChange === 'number'
                      ? `${formatSignedCurrency(snapshot.spendingChange)} vs last month`
                      : 'Tracking activity...'}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-xs uppercase text-gray-500 tracking-wide">30-day income</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrencyValue(snapshot.monthlyIncome)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  <p className="text-xs uppercase text-gray-500 tracking-wide">Recurring charges</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrencyValue(snapshot.recurringTotal)}
                  </p>
                </div>
              </div>
              {snapshotUpdatedAt && (
                <p className="text-xs text-gray-500 mt-2">Data refreshed {snapshotUpdatedAt}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
            {messages.map((message) => {
              const isErrorMessage = message.status === 'error';
              return (
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
                          RB
                        </div>
                        <span className="text-xs font-semibold text-gray-900">Rocket Bucks AI</span>
                      </div>
                    )}
                    {message.sender === 'ai' && !isErrorMessage ? (
                      renderAssistantContent(message.text)
                    ) : (
                      <p
                        className={`text-sm leading-relaxed ${
                          message.sender === 'user'
                            ? 'text-white'
                            : isErrorMessage
                              ? 'text-red-700'
                              : 'text-gray-900'
                        } ${isErrorMessage ? 'italic' : ''}`}
                      >
                        {message.text}
                      </p>
                    )}
                    <p className={`text-xs mt-2 ${message.sender === 'user' ? 'text-red-200' : 'text-gray-500'}`}>
                      {message.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-2xl rounded-2xl px-6 py-4 bg-white shadow-sm border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      RB
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
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isTyping}
                className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Tip: Ask about spending, savings, investments, or bill negotiations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
