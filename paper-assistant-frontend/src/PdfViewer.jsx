import { useState, useEffect, useRef } from 'react'
import { PdfLoader, PdfHighlighter } from 'react-pdf-highlighter'
import 'react-pdf-highlighter/dist/style.css'

function PdfViewer({ paperId, token, tool }) {
  const [highlights, setHighlights] = useState([])
  const [highlightsLoaded, setHighlightsLoaded] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const scrollToRef = useRef(null)
  const toolRef = useRef(tool)

  useEffect(() => { toolRef.current = tool }, [tool])

  const pdfUrl = `/api/papers/${paperId}/file?token=${encodeURIComponent(token)}`

  useEffect(() => {
    fetch(`/api/papers/${paperId}/highlights`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) return []
        return res.json()
      })
      .then((data) => {
        setHighlights(data)
        setHighlightsLoaded(true)
      })
  }, [paperId, token])

  useEffect(() => {
    if (!highlightsLoaded || highlights.length === 0) return
    const timer = setTimeout(() => {
      if (scrollToRef.current) {
        scrollToRef.current(highlights[0])
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [highlightsLoaded])

  function saveHighlights(updatedHighlights) {
    setHighlights(updatedHighlights)
    fetch(`/api/papers/${paperId}/highlights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updatedHighlights),
    })
  }

  function startEditing(highlight) {
    setEditingId(highlight.id)
    setCommentDraft(highlight.comment || '')
  }

  function saveComment() {
    const updated = highlights.map((h) =>
      h.id === editingId ? { ...h, comment: commentDraft } : h
    )
    saveHighlights(updated)
    setEditingId(null)
  }

  function handleHighlightClick(highlight) {
    if (toolRef.current === 'eraser') {
      saveHighlights(highlights.filter((h) => h.id !== highlight.id))
      return
    }
    startEditing(highlight)
  }

  return (
    <div style={{ height: '750px', position: 'relative', border: '1px solid #ccc' }}>
      {!highlightsLoaded && <p>Loading highlights...</p>}
      {highlightsLoaded && (
        <PdfLoader url={pdfUrl} beforeLoad={<p>Loading PDF...</p>}>
          {(pdfDocument) => (
            <PdfHighlighter
              pdfDocument={pdfDocument}
              highlights={highlights}
              onScrollChange={() => {}}
              scrollRef={(scrollTo) => {
                scrollToRef.current = scrollTo
              }}
              enableAreaSelection={() => false}
              onSelectionFinished={(position, content, hideTipAndSelection) => {
                if (toolRef.current !== 'highlighter') return null
                let draftComment = ''
                return (
                  <div style={{ background: 'white', padding: '8px', border: '1px solid #ccc' }}>
                    <textarea
                      placeholder="Optional comment..."
                      onChange={(e) => { draftComment = e.target.value }}
                    />
                    <br />
                    <button
                      onClick={() => {
                        const newHighlight = {
                          id: String(Date.now()),
                          position,
                          content,
                          comment: draftComment,
                        }
                        saveHighlights([...highlights, newHighlight])
                        hideTipAndSelection()
                      }}
                    >
                      Add highlight
                    </button>
                  </div>
                )
              }}
              highlightTransform={(highlight) => (
                <div key={highlight.id}>
                  <div
                    onClick={() => handleHighlightClick(highlight)}
                    style={{
                      position: 'absolute',
                      background: 'yellow',
                      opacity: 0.4,
                      cursor: 'pointer',
                      ...highlight.position.boundingRect,
                    }}
                  />
                  {editingId === highlight.id && (
                    <div
                      style={{
                        position: 'absolute',
                        top: highlight.position.boundingRect.top + highlight.position.boundingRect.height + 4,
                        left: highlight.position.boundingRect.left,
                        background: 'white',
                        border: '1px solid #ccc',
                        padding: '8px',
                        zIndex: 10,
                      }}
                    >
                      <textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Add a comment..."
                      />
                      <br />
                      <button onClick={saveComment}>Save</button>
                      <button onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  )}
                  {highlight.comment && (
                    <div
                      style={{
                        position: 'absolute',
                        top: highlight.position.boundingRect.top,
                        left: highlight.position.boundingRect.left + highlight.position.boundingRect.width + 4,
                        fontSize: '12px',
                        color: '#555',
                      }}
                    >
                      💬
                    </div>
                  )}
                </div>
              )}
            />
          )}
        </PdfLoader>
      )}
    </div>
  )
}

export default PdfViewer