import { useState, useEffect } from 'react'

const COLORS = ['#ff5252', '#448aff', '#4caf50', '#ffb300']
const URL_PATTERN = /(https?:\/\/[^\s]+)/g

function linkify(text) {
  const parts = text.split(URL_PATTERN)
  return parts.map((part, i) =>
    URL_PATTERN.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer">{part}</a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function NotesPanel({ paperId, token, tool, setTool, color, setColor }) {
  const [notes, setNotes] = useState([])
  const [highlights, setHighlights] = useState([])
  const [pins, setPins] = useState([])
  const [draft, setDraft] = useState('')
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editDraft, setEditDraft] = useState('')

  useEffect(() => {
    fetch(`/api/papers/${paperId}/notes`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then(setNotes)

    fetch(`/api/papers/${paperId}/highlights`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then(setHighlights)

    fetch(`/api/papers/${paperId}/annotations`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPins(data.filter((a) => a.type === 'pin')))
  }, [paperId, token])

  function saveNotes(updatedNotes) {
    setNotes(updatedNotes)
    fetch(`/api/papers/${paperId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(updatedNotes),
    })
  }

  function handleAdd() {
    if (!draft.trim()) return
    saveNotes([...notes, { id: String(Date.now()), text: draft }])
    setDraft('')
  }

  function handleDeleteNote(id) {
    saveNotes(notes.filter((n) => n.id !== id))
  }

  function startEditNote(note) {
    setEditingNoteId(note.id)
    setEditDraft(note.text)
  }

  function saveEditedNote() {
    saveNotes(notes.map((n) => (n.id === editingNoteId ? { ...n, text: editDraft } : n)))
    setEditingNoteId(null)
  }

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-group">
          <button className={`tool-btn ${tool === 'cursor' ? 'selected' : ''}`} onClick={() => setTool('cursor')} title="Cursor">➤</button>
          <button className={`tool-btn ${tool === 'highlighter' ? 'selected' : ''}`} onClick={() => setTool('highlighter')} title="Highlighter">🖊️</button>
          <button className={`tool-btn ${tool === 'eraser' ? 'selected' : ''}`} onClick={() => setTool('eraser')} title="Eraser">🧹</button>
        </div>
        <div className="toolbar-group">
          <button className={`tool-btn ${tool === 'pin' ? 'selected' : ''}`} onClick={() => setTool('pin')} title="Pin">📍</button>
          <button className={`tool-btn ${tool === 'rectangle' ? 'selected' : ''}`} onClick={() => setTool('rectangle')} title="Rectangle">▭</button>
          <button className={`tool-btn ${tool === 'circle' ? 'selected' : ''}`} onClick={() => setTool('circle')} title="Circle">◯</button>
          <button className={`tool-btn ${tool === 'line' ? 'selected' : ''}`} onClick={() => setTool('line')} title="Line">╱</button>
          <button className={`tool-btn ${tool === 'pen' ? 'selected' : ''}`} onClick={() => setTool('pen')} title="Pen">✏️</button>
        </div>
        <div className="toolbar-group">
          {COLORS.map((c) => (
            <div
              key={c}
              className={`color-swatch ${color === c ? 'selected' : ''}`}
              onClick={() => setColor(c)}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {notes.map((note) => (
        <div className="card annotation-card" key={`note-${note.id}`}>
          {editingNoteId === note.id ? (
            <>
              <textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} />
              <div className="annotation-card-actions">
                <button onClick={saveEditedNote}>Save</button>
                <button onClick={() => setEditingNoteId(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="annotation-card-header">📝 Note</div>
              <div className="annotation-card-body">{linkify(note.text)}</div>
              <div className="annotation-card-actions">
                <button onClick={() => startEditNote(note)}>Edit</button>
                <button onClick={() => handleDeleteNote(note.id)}>Delete</button>
              </div>
            </>
          )}
        </div>
      ))}

      {highlights.map((h) => (
        <div className="card annotation-card" key={`hl-${h.id}`} style={{ borderLeft: '4px solid #ffeb3b' }}>
          <div className="annotation-card-header">🖊️ Highlight</div>
          <div className="annotation-card-body">{h.content?.text?.slice(0, 150)}</div>
          {h.comment && <div className="annotation-card-body"><em>{linkify(h.comment)}</em></div>}
        </div>
      ))}

      {pins.map((pin) => (
        <div className="card annotation-card" key={`pin-${pin.id}`} style={{ borderLeft: `4px solid ${pin.color}` }}>
          <div className="annotation-card-header">📍 Pin — page {pin.page}</div>
          <div className="annotation-card-body">{linkify(pin.text)}</div>
          {pin.drawing && <img src={pin.drawing} alt="sketch" style={{ width: '100%', borderRadius: '6px' }} />}
        </div>
      ))}

      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a note..." />
      <button onClick={handleAdd}>Add note</button>
    </div>
  )
}

export default NotesPanel