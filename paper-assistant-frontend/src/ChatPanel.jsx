import { useState, useEffect } from 'react'

function ChatPanel({ paperId, token }) {
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/papers/${paperId}/chat_history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) return []
        return res.json()
      })
      .then((data) => setMessages(data))
  }, [paperId, token])

  async function handleSend() {
    if (!question.trim()) return

    const userMessage = { role: 'user', text: question }
    const messagesWithUser = [...messages, userMessage]
    setMessages(messagesWithUser)
    setQuestion('')
    setLoading(true)

    try {
      const response = await fetch(`/api/papers/${paperId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question }),
      })
      const data = await response.json()
      const assistantMessage = { role: 'assistant', text: data.answer, sources: data.sources }
      const finalMessages = [...messagesWithUser, assistantMessage]
      setMessages(finalMessages)

      fetch(`/api/papers/${paperId}/chat_history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(finalMessages),
      })
    } catch (err) {
      const errorMessage = { role: 'assistant', text: `Error: ${err.message}` }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div>
        {messages.map((msg, index) => (
          <div key={index} className={`chat-message-row ${msg.role === 'user' ? 'user' : ''}`}>
            <div className={`chat-bubble ${msg.role}`}>{msg.text}</div>
          </div>
        ))}
      </div>      
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask anything..."
      />
      <button onClick={handleSend} disabled={loading}>
        {loading ? 'Thinking...' : 'Send'}
      </button>
    </div>
  )
}

export default ChatPanel