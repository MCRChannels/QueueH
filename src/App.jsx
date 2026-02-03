
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
  return (
    <BrowserRouter>
      {/* We can conditionally render Navbar if we want to hide it on Login/Register */}
      {/* For now, let's keep it simple and maybe hide it based on route or just show it */}
      <div>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={
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
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
