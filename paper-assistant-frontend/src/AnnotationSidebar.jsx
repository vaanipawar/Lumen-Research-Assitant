import { useState, useEffect } from 'react'

function AnnotationSidebar({ paperId, token, refreshKey }) {
  const [pins, setPins] = useState([])
  const [highlights, setHighlights] = useState([])

  useEffect(() => {
    fetch(`/api/papers/${paperId}/annotations`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPins(data.filter((a) => a.type === 'pin')))

    fetch(`/api/papers/${paperId}/highlights`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setHighlights(data))
  }, [paperId, token, refreshKey])

  return (
    <div>
      <h3>Annotations overview</h3>
      {pins.map((pin) => (
        <div key={pin.id} style={{ borderLeft: `4px solid ${pin.color}`, padding: '4px 8px', marginBottom: '4px' }}>
          <strong>Pin (page {pin.page})</strong>
          <p>{pin.text}</p>
        </div>
      ))}
      {highlights.map((h) => (
        <div key={h.id} style={{ borderLeft: '4px solid #ffeb3b', padding: '4px 8px', marginBottom: '4px' }}>
          <strong>Highlight</strong>
          <p>{h.content?.text?.slice(0, 100)}</p>
          {h.comment && <p><em>{h.comment}</em></p>}
        </div>
      ))}
    </div>
  )
}

export default AnnotationSidebar