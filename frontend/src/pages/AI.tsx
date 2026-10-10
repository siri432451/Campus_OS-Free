import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { TUTOR_MODES, getModeConfig } from '../lib/tutorModes'
import { showToast } from '../components/Toast'
import { Skeleton } from '../components/Skeleton'

interface Message { role: 'USER' | 'ASSISTANT'; content: string; createdAt?: string }
interface Conversation {
  id: string; mode: string; title: string
  updatedAt: string
  messages?: Array<{ content: string; role: string; createdAt: string }>
}

// ── Mode picker grid ──────────────────────────────────────────
function TutorModePicker({ onSelect }: { onSelect: (mode: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-5">
      <h2 className="font-black text-xl mb-1" style={{ color: '#1B4332' }}>Choose a Tutor</h2>
      <p className="text-sm mb-5" style={{ color: '#8A9BB0' }}>
        Select a subject to start a focused study session
      </p>
      <div className="grid grid-cols-2 gap-3">
        {TUTOR_MODES.map(m => (
          <button key={m.value} onClick={() => onSelect(m.value)}
            className="bg-white rounded-2xl p-4 text-left border-0 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div className="text-3xl mb-2">{m.icon}</div>
            <div className="font-bold text-sm leading-tight mb-1" style={{ color: '#1B4332' }}>{m.label}</div>
            <div className="text-[11px] leading-snug" style={{ color: '#8A9BB0' }}>{m.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'USER'
  return (
    <div className={`flex mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mr-2 mt-0.5"
          style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
          🤖
        </div>
      )}
      <div className={`max-w-[88%] sm:max-w-[78%] lg:max-w-[600px] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'rounded-tr-sm text-white'
          : 'rounded-tl-sm bg-white border border-gray-100'
      }`}
        style={isUser ? { background: 'linear-gradient(135deg,#2D6A4F,#122400)', color: '#fff' } : { color: '#1B4332' }}>
        {isUser ? (
          <span className="whitespace-pre-wrap">{msg.content}</span>
        ) : (
          <div className="prose prose-sm max-w-none" style={{ color: '#1B4332' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Typing indicator ──────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex mb-3 justify-start">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>🤖</div>
      <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full typing-dot"
            style={{ background: '#122400', animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

// ── Conversation list item ────────────────────────────────────
function ConvItem({ conv, active, onClick, onDelete }: {
  conv: Conversation; active: boolean
  onClick: () => void; onDelete: () => void
}) {
  const cfg = getModeConfig(conv.mode)
  const lastMsg = conv.messages?.[0]
  return (
    <div onClick={onClick}
      className={`group px-4 py-3 rounded-xl cursor-pointer flex items-start gap-3 transition-colors ${active ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
      <span className="text-xl flex-shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate" style={{ color: active ? '#122400' : '#1B4332' }}>
          {conv.title}
        </div>
        {lastMsg && (
          <div className="text-xs truncate mt-0.5" style={{ color: '#8A9BB0' }}>
            {lastMsg.content.slice(0, 50)}
          </div>
        )}
      </div>
      <button onClick={e => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 border-0 bg-transparent cursor-pointer text-lg p-0 leading-none flex-shrink-0">
        ×
      </button>
    </div>
  )
}

// ── Main AI page ──────────────────────────────────────────────
export default function AI() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMode, setCurrentMode] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [replying, setReplying] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showConvList, setShowConvList] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load conversation list
  useEffect(() => {
    api.get<Conversation[]>('/api/ai/conversations')
      .then(r => setConversations(r.data))
      .catch(() => {})
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, replying])

  const loadConversation = async (id: string) => {
    try {
      const r = await api.get<Conversation & { messages: Message[] }>(`/api/ai/conversations/${id}`)
      setActiveConvId(id)
      setCurrentMode(r.data.mode)
      setMessages(r.data.messages)
      setShowConvList(false)
    } catch { showToast('Failed to load conversation', 'error') }
  }

  const startNewConversation = async (mode: string) => {
    try {
      const r = await api.post<Conversation>('/api/ai/conversations', { mode })
      const newConv = r.data
      setConversations(prev => [newConv, ...prev])
      setActiveConvId(newConv.id)
      setCurrentMode(mode)
      setMessages([])
      setShowPicker(false)
    } catch { showToast('Failed to start conversation', 'error') }
  }

  const deleteConversation = async (id: string) => {
    try {
      await api.delete(`/api/ai/conversations/${id}`)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (activeConvId === id) {
        setActiveConvId(null); setCurrentMode(null); setMessages([])
      }
      showToast('Conversation deleted', 'success')
    } catch { showToast('Failed to delete', 'error') }
    finally { setDeleteConfirm(null) }
  }

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || replying || !activeConvId || !currentMode) return

    const userMsg: Message = { role: 'USER', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setReplying(true)

    try {
      const apiMessages = newMessages.map(m => ({
        role: m.role === 'USER' ? 'user' : 'assistant',
        content: m.content,
      }))
      const r = await api.post<{ reply: string }>('/api/ai/chat', {
        mode: currentMode,
        messages: apiMessages,
        conversationId: activeConvId,
      })
      const assistantMsg: Message = { role: 'ASSISTANT', content: r.data.reply }
      setMessages(prev => [...prev, assistantMsg])

      // Update conversation list title/preview
      setConversations(prev => prev.map(c =>
        c.id === activeConvId
          ? { ...c, updatedAt: new Date().toISOString(), messages: [{ content: r.data.reply, role: 'ASSISTANT', createdAt: new Date().toISOString() }] }
          : c
      ))
    } catch { showToast('AI unavailable — please try again', 'error') }
    finally { setReplying(false) }
  }, [input, replying, activeConvId, currentMode, messages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const modeCfg = currentMode ? getModeConfig(currentMode) : null

  // ── Chat panel ──────────────────────────────────────────────
  const ChatPanel = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <button onClick={() => navigate('/dashboard')}
          className="text-gray-400 hover:text-gray-600 border-0 bg-transparent cursor-pointer text-xl p-0 leading-none lg:hidden">
          ←
        </button>
        <button onClick={() => setShowConvList(p => !p)}
          className="text-gray-400 hover:text-gray-600 border-0 bg-transparent cursor-pointer text-xl p-0 leading-none hidden lg:hidden">
          ☰
        </button>

        {modeCfg ? (
          <button onClick={() => setShowPicker(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border-0 cursor-pointer transition-colors hover:opacity-80"
            style={{ background: '#E3EFE7', color: '#122400' }}>
            <span>{modeCfg.icon}</span>
            <span className="hidden sm:inline">{modeCfg.label}</span>
            <span className="text-xs">▾</span>
          </button>
        ) : (
          <span className="font-black text-sm" style={{ color: '#1B4332' }}>AI Chat</span>
        )}

        <div className="ml-auto flex gap-2">
          <button onClick={() => { setShowPicker(true); setActiveConvId(null); setCurrentMode(null); setMessages([]) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-0 cursor-pointer"
            style={{ background: '#E3EFE7', color: '#122400' }}>
            + New
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && modeCfg && (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">{modeCfg.icon}</div>
            <p className="font-bold text-base mb-1" style={{ color: '#1B4332' }}>{modeCfg.label}</p>
            <p className="text-sm" style={{ color: '#8A9BB0' }}>
              Ask a question to begin your study session
            </p>
          </div>
        )}
        {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
        {replying && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {activeConvId && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 flex-shrink-0"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask a nursing question…"
              rows={1}
              className="flex-1 resize-none rounded-2xl px-4 py-3 text-sm outline-none"
              style={{
                border: '1.5px solid #E8EDF2', background: '#F5F7FA',
                color: '#1B4332', fontFamily: 'inherit', lineHeight: '1.5',
                overflow: 'hidden', minHeight: 44,
              }}
              onFocus={e => (e.target.style.borderColor = '#122400')}
              onBlur={e => (e.target.style.borderColor = '#E8EDF2')}
            />
            <button onClick={sendMessage} disabled={!input.trim() || replying}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white border-0 cursor-pointer flex-shrink-0 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#2D6A4F,#122400)' }}>
              ➤
            </button>
          </div>
        </div>
      )}
    </div>
  )

  // ── Mobile layout ───────────────────────────────────────────
  const MobileContent = (
    <div className="h-full flex flex-col bg-white">
      {!activeConvId || showPicker
        ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <button onClick={() => navigate('/dashboard')}
                className="text-gray-400 border-0 bg-transparent cursor-pointer text-xl p-0">←</button>
              <span className="font-black text-base" style={{ color: '#1B4332' }}>AI Tutors</span>
              {activeConvId && (
                <button onClick={() => { setShowPicker(false) }}
                  className="ml-auto text-sm font-medium border-0 bg-transparent cursor-pointer"
                  style={{ color: '#122400' }}>Cancel</button>
              )}
            </div>
            <TutorModePicker onSelect={startNewConversation} />
          </div>
        )
        : ChatPanel
      }
    </div>
  )

  // ── Desktop layout ──────────────────────────────────────────
  const DesktopContent = (
    <div className="flex h-screen" style={{ background: '#F5F7FA' }}>
      {/* Conversation list */}
      <div className="w-72 bg-white border-r border-gray-100 flex flex-col flex-shrink-0"
        style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.04)' }}>
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-base" style={{ color: '#1B4332' }}>AI Tutors</h2>
            <button onClick={() => { setActiveConvId(null); setCurrentMode(null); setMessages([]); setShowPicker(false) }}
              className="text-xs font-bold px-3 py-1.5 rounded-full border-0 cursor-pointer"
              style={{ background: '#E3EFE7', color: '#122400' }}>
              + New Chat
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 && (
            <p className="text-center text-sm py-8 px-4" style={{ color: '#8A9BB0' }}>
              No conversations yet. Start a new chat!
            </p>
          )}
          {conversations.map(c => (
            <ConvItem key={c.id} conv={c} active={c.id === activeConvId}
              onClick={() => loadConversation(c.id)}
              onDelete={() => setDeleteConfirm(c.id)} />
          ))}
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeConvId ? (
          <div className="flex-1 flex flex-col overflow-y-auto p-6 xl:p-8">
            <h2 className="font-black text-2xl mb-1" style={{ color: '#1B4332' }}>Choose a Tutor</h2>
            <p className="text-sm mb-6" style={{ color: '#8A9BB0' }}>
              Select a subject area to start a focused AI study session
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 w-full max-w-5xl mx-auto">
              {TUTOR_MODES.map(m => (
                <button key={m.value} onClick={() => startNewConversation(m.value)}
                  className="bg-white rounded-2xl p-5 text-left border-0 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95"
                  style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                  <div className="text-3xl mb-3">{m.icon}</div>
                  <div className="font-bold text-sm mb-1" style={{ color: '#1B4332' }}>{m.label}</div>
                  <div className="text-xs leading-snug" style={{ color: '#8A9BB0' }}>{m.description}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">{ChatPanel}</div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div className="lg:hidden h-full">{MobileContent}</div>
      <div className="hidden lg:flex h-full">{DesktopContent}</div>

      {/* Mode picker modal (when switching) */}
      {showPicker && activeConvId && (
        <div className="fixed inset-0 z-[200] flex items-end lg:items-center justify-center p-4"
          onClick={() => setShowPicker(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-white rounded-3xl overflow-hidden max-h-[80vh] overflow-y-auto"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <h3 className="font-black text-base" style={{ color: '#1B4332' }}>Switch Tutor Mode</h3>
              <button onClick={() => setShowPicker(false)}
                className="text-gray-400 hover:text-gray-600 border-0 bg-transparent cursor-pointer text-xl">×</button>
            </div>
            <div className="px-5 pb-5 grid grid-cols-2 gap-3">
              {TUTOR_MODES.map(m => (
                <button key={m.value} onClick={() => startNewConversation(m.value)}
                  className="bg-gray-50 rounded-2xl p-4 text-left border-0 cursor-pointer hover:bg-purple-50 transition-colors">
                  <div className="text-2xl mb-1">{m.icon}</div>
                  <div className="font-bold text-sm" style={{ color: '#1B4332' }}>{m.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm"
            style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <p className="font-black text-lg mb-2" style={{ color: '#1B4332' }}>Delete Conversation?</p>
            <p className="text-sm mb-5" style={{ color: '#8A9BB0' }}>This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border-0 cursor-pointer"
                style={{ background: '#F5F7FA', color: '#8A9BB0' }}>Cancel</button>
              <button onClick={() => deleteConversation(deleteConfirm)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white border-0 cursor-pointer"
                style={{ background: '#E74C3C' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
