
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Consult from './pages/Consult'
import Profile from './pages/Profile'
import Delivery from './pages/Delivery'
import AdminDashboard from './pages/AdminDashboard'
import DoctorOPD from './pages/DoctorOPD'
import MyQueue from './pages/MyQueue'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import { supabase } from './lib/supabase'

function App() {
  const [session, setSession] = React.useState(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)' }}>
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--primary-light)', borderTop: '3px solid var(--primary)', borderRadius: '50%', margin: '0 auto 1rem' }}></div>
        <p style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Initializing Secure Session...</p>
      </div>
      <style>{`
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )

  return (
    <BrowserRouter>
      <div>
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
          <Route path="/register" element={session ? <Navigate to="/" /> : <Register />} />

          <Route path="*" element={
            <>
              <Navbar session={session} />
              <div style={{ padding: '2rem 0' }}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/my-queue" element={session ? <MyQueue /> : <Navigate to="/login" />} />
                  <Route path="/consult" element={session ? <Consult /> : <Navigate to="/login" />} />
                  <Route path="/delivery" element={session ? <Delivery /> : <Navigate to="/login" />} />
                  <Route path="/admin" element={session ? <AdminDashboard /> : <Navigate to="/login" />} />
                  <Route path="/opd" element={session ? <DoctorOPD /> : <Navigate to="/login" />} />
                  <Route path="/profile" element={session ? <Profile /> : <Navigate to="/login" />} />
                </Routes>
              </div>
              <Footer />
            </>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
