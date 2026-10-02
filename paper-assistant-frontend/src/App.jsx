import { useState, useEffect } from 'react'
import UploadScreen from './UploadScreen.jsx'
import ChatPanel from './ChatPanel.jsx'
import PdfViewer from './PdfViewer.jsx'
import LoginScreen from './LoginScreen.jsx'
import NotesPanel from './NotesPanel.jsx'
import AnnotationLayer from './AnnotationLayer.jsx'

function App() {
  const [auth, setAuth] = useState(null)
  const [paper, setPaper] = useState(null)
  const [recentPapers, setRecentPapers] = useState([])
  const [activeTab, setActiveTab] = useState('chat')
  const [tool, setTool] = useState('cursor')
  const [color, setColor] = useState('#ff5252')

  useEffect(() => {
    const savedAuth = localStorage.getItem('auth')
    if (savedAuth) setAuth(JSON.parse(savedAuth))
  }, [])

  useEffect(() => {
    if (!auth) return
    fetch('/api/papers', { headers: { Authorization: `Bearer ${auth.token}` } })
      .then((res) => res.json())
      .then((data) => setRecentPapers(data))
  }, [auth, paper])

  function handleLogin(data) {
    localStorage.setItem('auth', JSON.stringify(data))
    setAuth(data)
  }

  function handleLogout() {
    localStorage.removeItem('auth')
    setAuth(null)
    setPaper(null)
  }

  function handleUpload(data) {
    setPaper(data)
  }

  function handleSelectRecent(recentPaper) {
    setPaper(recentPaper)
  }

  function handleNewPaper() {
    setPaper(null)
  }

  if (!auth) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="sidebar-logo">Lumen</div>
        <button className="sidebar-new-btn" onClick={handleNewPaper}>+ New paper</button>

        <div className="sidebar-section-title">Recent papers</div>
        <div className="sidebar-list">
          {recentPapers.map((p) => (
            <button
              key={p.paper_id}
              className={`sidebar-item ${paper?.paper_id === p.paper_id ? 'active' : ''}`}
              onClick={() => handleSelectRecent(p)}
            >
              {p.title}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <span>{auth.username}</span>
          <button onClick={handleLogout}>Log out</button>
        </div>
      </div>

      <div className="main-content">
        {!paper && (
          <div className="empty-state">
            <h2>Upload a research paper</h2>
            <p>Chat with it, highlight sections, and take notes as you read.</p>
            <UploadScreen onUpload={handleUpload} token={auth.token} />
          </div>
        )}

        {paper && (
          <div className="workspace">
            <div className="pdf-pane">
              <PdfViewer paperId={paper.paper_id} token={auth.token} tool={tool} />
              <AnnotationLayer paperId={paper.paper_id} token={auth.token} tool={tool} color={color} />
            </div>
            <div className="side-pane">
              <div className="tabs">
                <button
                  className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chat')}
                >
                  Chat
                </button>
                <button
                  className={`tab-button ${activeTab === 'notes' ? 'active' : ''}`}
                  onClick={() => setActiveTab('notes')}
                >
                  Notes
                </button>
              </div>
              <div className="tab-content">
                {activeTab === 'chat' && <ChatPanel paperId={paper.paper_id} token={auth.token} />}
                {activeTab === 'notes' && (
                  <NotesPanel
                    paperId={paper.paper_id}
                    token={auth.token}
                    tool={tool}
                    setTool={setTool}
                    color={color}
                    setColor={setColor}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App