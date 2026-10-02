import { useState } from 'react'

function UploadScreen({ onUpload, token }) {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  function handleFileChange(event) {
    setFile(event.target.files[0])
  }

  async function handleUpload() {
    if (!file) return

    setStatus('uploading')
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/api/papers/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || `Upload failed (${response.status})`)
      }

      const data = await response.json()
      setStatus('done')
      onUpload(data)
    } catch (err) {
      console.error('Upload error:', err)
      setStatus('error')
      setError(err.message)
    }
  }

  return (
    <div>
      <input type="file" accept="application/pdf" onChange={handleFileChange} />
      <button onClick={handleUpload} disabled={!file || status === 'uploading'}>
        {status === 'uploading' ? 'Uploading...' : 'Upload'}
      </button>
      {status === 'uploading' && <p>Uploading and parsing your paper…</p>}
      {status === 'error' && <p>Error: {error}</p>}
      {status === 'done' && <p>Paper uploaded successfully!</p>}
    </div>
  )
}

export default UploadScreen