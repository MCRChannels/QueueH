
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
import Navbar from './components/Navbar'

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

  if (loading) return null // Or a global spinner

  return (
    <BrowserRouter>
      <div>
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
          <Route path="/register" element={session ? <Navigate to="/" /> : <Register />} />

          {/* Protected Routes Wrapper */}
          <Route path="*" element={
            session ? (
              <>
                <Navbar />
                <div style={{ padding: '2rem 0' }}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/consult" element={<Consult />} />
                    <Route path="/delivery" element={<Delivery />} />
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/opd" element={<DoctorOPD />} />
                    <Route path="/profile" element={<Profile />} />
                  </Routes>
                </div>
              </>
            ) : <Navigate to="/login" />
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
