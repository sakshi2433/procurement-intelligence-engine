import { useState, useRef, useEffect } from 'react';
import { Send, Clock, Database, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { api, fmt } from '../lib/api';
import { PageHeader, Btn, Spinner } from '../components/ui';

const EXAMPLE_QUERIES = [
  "What is the total outstanding balance with our top 5 vendors?",
  "Which vendors have invoices overdue by more than 30 days?",
  "Show me all contracts expiring in the next 30 days",
  "Which purchase orders are in confirmed status for IT Hardware?",
  "What are the payment terms for our logistics vendors?",
  "List all vendors in the Consulting category",
];

function SourceChip({ source }) {
  const typeColors = {
    vendor: 'var(--blue)',
    purchase_order: 'var(--amber)',
    invoice: 'var(--green)',
    contract: 'var(--sand)',
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px',
      background: 'var(--ink-4)', border: '1px solid var(--border-2)',
      borderRadius: 4, fontSize: 11,
      fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: typeColors[source.type] || 'var(--text-4)', flexShrink: 0 }} />
      {source.label}
    </span>
  );
}

function Message({ msg }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = msg.role === 'user';

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 12,
      alignItems: 'flex-start',
      marginBottom: 20,
      animation: 'fadeIn 0.3s ease both',
    }}>
      {/* Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: 6, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser ? 'var(--ink-4)' : 'var(--amber)',
        fontSize: 12,
      }}>
        {isUser ? '👤' : <Zap size={14} color="var(--ink)" />}
      </div>

      <div style={{ maxWidth: '75%', minWidth: 0 }}>
        {/* Bubble */}
        <div style={{
          background: isUser ? 'var(--ink-3)' : 'var(--ink-2)',
          border: `1px solid ${isUser ? 'var(--border)' : 'var(--border-2)'}`,
          borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
          padding: '12px 16px',
          fontSize: 13,
          lineHeight: 1.65,
          color: 'var(--text-1)',
          whiteSpace: 'pre-wrap',
        }}>
          {msg.content}
        </div>

        {/* Meta row */}
        {!isUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {msg.latency_ms && (
              <span style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={10} /> {msg.latency_ms}ms
              </span>
            )}
            {msg.model && (
              <span style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>
                {msg.provider}/{msg.model}
              </span>
            )}
            {msg.sources?.length > 0 && (
              <button
                onClick={() => setShowSources(s => !s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: 'none', border: 'none',
                  fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                }}
              >
                <Database size={10} />
                {msg.sources.length} source{msg.sources.length !== 1 ? 's' : ''}
                {showSources ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            )}
          </div>
        )}

        {/* Sources */}
        {showSources && msg.sources?.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {msg.sources.map((s, i) => <SourceChip key={i} source={s} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export function NLQuery() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: 'Ask me anything about your procurement data — vendors, purchase orders, invoices, contracts, or spend patterns. I\'ll retrieve the relevant records and synthesise an answer.',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = async (question = input) => {
    if (!question.trim() || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const result = await api.rag.query(question, 6, filterType || null);
      setMessages(m => [...m, {
        role: 'assistant',
        content: result.answer,
        sources: result.sources,
        latency_ms: result.latency_ms,
        provider: result.provider,
        model: result.model,
      }]);
    } catch (e) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `Error: ${e.message}. Check that the backend is running and the LLM API key is configured.`,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title="NL Query Engine"
        subtitle={`RAG-powered natural language search over your procurement data`}
      />

      {/* Example queries */}
      {messages.length <= 1 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Example queries
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EXAMPLE_QUERIES.map((q, i) => (
              <button
                key={i}
                onClick={() => submit(q)}
                style={{
                  padding: '6px 12px',
                  background: 'var(--ink-3)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  fontSize: 12,
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.target.style.borderColor = 'var(--amber)'; e.target.style.color = 'var(--text-1)'; }}
                onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-2)'; }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingRight: 4,
        marginBottom: 16,
      }}>
        {messages.map((m, i) => <Message key={i} msg={m} />)}
        {loading && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={14} color="var(--ink)" />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: 'var(--amber)',
                  animation: 'pulse-amber 1.2s infinite',
                  animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{ padding: '5px 10px', fontSize: 12, borderRadius: 4, flex: '0 0 auto' }}
          >
            <option value="">All data types</option>
            <option value="vendor">Vendors only</option>
            <option value="purchase_order">Purchase orders only</option>
            <option value="invoice">Invoices only</option>
            <option value="contract">Contracts only</option>
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-4)', display: 'flex', alignItems: 'center' }}>
            Filter retrieval scope
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about vendors, invoices, purchase orders, contracts..."
            rows={2}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 6,
              resize: 'none',
              lineHeight: 1.5,
              fontSize: 13,
            }}
          />
          <Btn
            onClick={() => submit()}
            disabled={!input.trim() || loading}
            variant="primary"
            style={{ alignSelf: 'flex-end', padding: '10px 16px' }}
          >
            {loading ? <Spinner size={14} /> : <Send size={14} />}
          </Btn>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
          Enter to send · Shift+Enter for newline
        </div>
      </div>
    </div>
  );
}
