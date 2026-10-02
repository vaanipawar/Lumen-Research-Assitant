import { useState, useEffect, useRef } from 'react'

function AnnotationLayer({ paperId, token, tool, color }) {
  const [annotations, setAnnotations] = useState([])
  const [openPinId, setOpenPinId] = useState(null)
  const [drawingShape, setDrawingShape] = useState(null)
  const toolRef = useRef(tool)
  const colorRef = useRef(color)
  const stateRef = useRef({ annotations, paperId, token })
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const pageRectRef = useRef(null)
  const penPointsRef = useRef([])

  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { stateRef.current = { annotations, paperId, token } }, [annotations, paperId, token])

  useEffect(() => {
    fetch(`/api/papers/${paperId}/annotations`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAnnotations(data))
  }, [paperId, token])

  function persistAnnotations(updated) {
    setAnnotations(updated)
    fetch(`/api/papers/${paperId}/annotations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updated),
    })
  }

  function toPercent(clientX, clientY, rect) {
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    }
  }

  useEffect(() => {
    const SHAPE_TOOLS = ['rectangle', 'circle', 'line', 'pen']

    function handleMouseDown(event) {
      const currentTool = toolRef.current

      if (currentTool === 'pin') {
        const pageElement = event.target.closest('.page')
        if (!pageElement) return
        const rect = pageElement.getBoundingClientRect()
        const { x, y } = toPercent(event.clientX, event.clientY, rect)

        const newAnnotation = {
          id: String(Date.now()),
          type: 'pin',
          page: pageElement.dataset.pageNumber,
          x, y,
          text: '',
          color: colorRef.current,
          drawing: null,
        }
        const { annotations: current } = stateRef.current
        persistAnnotations([...current, newAnnotation])
        setOpenPinId(newAnnotation.id)
        return
      }

      if (!SHAPE_TOOLS.includes(currentTool)) return

      const pageElement = event.target.closest('.page')
      if (!pageElement) return
      const rect = pageElement.getBoundingClientRect()
      pageRectRef.current = rect
      const start = toPercent(event.clientX, event.clientY, rect)

      if (currentTool === 'pen') {
        penPointsRef.current = [start]
        setDrawingShape({ type: 'pen', points: [start], color: colorRef.current })
      } else {
        setDrawingShape({ type: currentTool, start, end: start, color: colorRef.current })
      }
      drawingRef.current = true
    }

    function handleMouseMove(event) {
      if (!drawingRef.current || !pageRectRef.current) return
      const point = toPercent(event.clientX, event.clientY, pageRectRef.current)

      if (toolRef.current === 'pen') {
        penPointsRef.current = [...penPointsRef.current, point]
        setDrawingShape({ type: 'pen', points: penPointsRef.current, color: colorRef.current })
      } else {
        setDrawingShape((prev) => (prev ? { ...prev, end: point } : prev))
      }
    }

    function handleMouseUp() {
      if (!drawingRef.current) return
      drawingRef.current = false

      setDrawingShape((current) => {
        if (current) {
          const newShape = {
            id: String(Date.now()),
            type: 'shape',
            shapeType: current.type,
            color: current.color,
            ...(current.type === 'pen'
              ? { points: current.points }
              : { start: current.start, end: current.end }),
          }
          const { annotations: currentAnnotations } = stateRef.current
          persistAnnotations([...currentAnnotations, newShape])
        }
        return null
      })
      penPointsRef.current = []
    }

    document.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  function startDraw(e) {
    drawingRef.current = true
    draw(e)
  }

  function stopDraw() {
    drawingRef.current = false
  }

  function draw(e) {
    if (!drawingRef.current || !canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext('2d')
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    ctx.fillStyle = '#333'
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fill()
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }

  function saveDrawing(pinId) {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL()
    const updated = annotations.map((a) => (a.id === pinId ? { ...a, drawing: dataUrl } : a))
    persistAnnotations(updated)
  }

  function deletePin(pinId) {
    persistAnnotations(annotations.filter((a) => a.id !== pinId))
    setOpenPinId(null)
  }

  function renderShape(shape, key) {
    if (shape.shapeType === 'rectangle') {
      const left = Math.min(shape.start.x, shape.end.x)
      const top = Math.min(shape.start.y, shape.end.y)
      const width = Math.abs(shape.end.x - shape.start.x)
      const height = Math.abs(shape.end.y - shape.start.y)
      return (
        <div
          key={key}
          style={{
            position: 'absolute',
            left: `${left}%`,
            top: `${top}%`,
            width: `${width}%`,
            height: `${height}%`,
            border: `2px solid ${shape.color}`,
          }}
        />
      )
    }
    if (shape.shapeType === 'circle') {
      const left = Math.min(shape.start.x, shape.end.x)
      const top = Math.min(shape.start.y, shape.end.y)
      const width = Math.abs(shape.end.x - shape.start.x)
      const height = Math.abs(shape.end.y - shape.start.y)
      return (
        <div
          key={key}
          style={{
            position: 'absolute',
            left: `${left}%`,
            top: `${top}%`,
            width: `${width}%`,
            height: `${height}%`,
            border: `2px solid ${shape.color}`,
            borderRadius: '50%',
          }}
        />
      )
    }
    if (shape.shapeType === 'line') {
      return (
        <svg key={key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          <line
            x1={`${shape.start.x}%`}
            y1={`${shape.start.y}%`}
            x2={`${shape.end.x}%`}
            y2={`${shape.end.y}%`}
            stroke={shape.color}
            strokeWidth={2}
          />
        </svg>
      )
    }
    if (shape.shapeType === 'pen') {
      const pointsStr = shape.points.map((p) => `${p.x},${p.y}`).join(' ')
      return (
        <svg key={key} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          <polyline points={pointsStr} fill="none" stroke={shape.color} strokeWidth={0.4} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )
    }
    return null
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
      {annotations.filter((a) => a.type === 'shape').map((shape) => renderShape(shape, shape.id))}
      {drawingShape && renderShape({ ...drawingShape, shapeType: drawingShape.type }, 'preview')}

      {annotations
        .filter((a) => a.type === 'pin')
        .map((pin) => (
          <div key={pin.id} style={{ position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`, pointerEvents: 'auto' }}>
            <div
              onClick={(e) => {
                e.stopPropagation()
                setOpenPinId(openPinId === pin.id ? null : pin.id)
              }}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: pin.color,
                cursor: 'pointer',
                border: '2px solid white',
              }}
            />
            {openPinId === pin.id && (
              <div style={{ background: 'white', border: '1px solid #ccc', padding: '8px', width: '260px', zIndex: 20 }}>
                <textarea
                  value={pin.text}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const updated = annotations.map((a) =>
                      a.id === pin.id ? { ...a, text: e.target.value } : a
                    )
                    setAnnotations(updated)
                  }}
                  placeholder="Write your note..."
                />
                <br />
                <button
                  onClick={() => {
                    persistAnnotations(annotations)
                    setOpenPinId(null)
                  }}
                >
                  Save
                </button>
                {pin.drawing && <img src={pin.drawing} alt="drawing" style={{ width: '100%', border: '1px solid #eee' }} />}
                <p style={{ fontSize: '12px' }}>Sketch:</p>
                <canvas
                  ref={canvasRef}
                  width={240}
                  height={120}
                  style={{ border: '1px solid #ccc', touchAction: 'none' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                />
                <div>
                  <button onClick={clearCanvas}>Clear</button>
                  <button onClick={() => saveDrawing(pin.id)}>Save sketch</button>
                  <button onClick={() => deletePin(pin.id)}>Delete pin</button>
                </div>
              </div>
            )}
          </div>
        ))}
    </div>
  )
}

export default AnnotationLayer