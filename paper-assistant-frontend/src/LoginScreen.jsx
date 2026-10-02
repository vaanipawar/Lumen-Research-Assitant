import { useState } from 'react'

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit() {
    setError(null)
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup'

    try {
      const response = await fetch(`${endpoint}?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || `${mode} failed`)
      }

      const data = await response.json()
      onLogin(data)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="empty-state">
      <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
      <p>{mode === 'login' ? 'Log in to continue to Lumen' : 'Sign up to get started with Lumen'}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '320px', margin: '0 auto' }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button className="sidebar-new-btn" onClick={handleSubmit}>
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
        <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </button>
        {error && <p style={{ color: 'var(--danger)' }}>Error: {error}</p>}
      </div>
    </div>
  )
}
export default LoginScreen
