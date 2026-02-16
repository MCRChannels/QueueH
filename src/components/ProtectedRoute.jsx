
import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ShieldAlert, Loader2 } from 'lucide-react'

/**
 * ProtectedRoute - Role-based access control wrapper
 * 
 * @param {React.ReactNode} children - The page component to render
 * @param {string[]} allowedRoles - Array of roles permitted to access this route
 * @param {object} session - Current auth session
 */
export default function ProtectedRoute({ children, allowedRoles, session }) {
    const [role, setRole] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchRole = async () => {
            if (!session) {
                setLoading(false)
                return
            }
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single()

                if (data) setRole(data.role)
            } catch (err) {
                console.error('ProtectedRoute: Error fetching role', err)
            } finally {
                setLoading(false)
            }
        }

        fetchRole()
    }, [session])

    // Not logged in → redirect to login
    if (!session) {
        return <Navigate to="/login" replace />
    }

    // Still loading role → show spinner
    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh'
            }}>
                <Loader2
                    className="spinner"
                    size={40}
                    color="var(--primary)"
                    style={{ animation: 'spin 1s linear infinite' }}
                />
                <style>{`
                    .spinner { animation: spin 1s linear infinite; }
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </div>
        )
    }

    // Role not in allowed list → show access denied
    if (!allowedRoles.includes(role)) {
        return (
            <div className="container section-spacing" style={{ textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="glass-card animate-fade-in" style={{ maxWidth: '500px', padding: '3rem', margin: '0 auto' }}>
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        padding: '1.5rem',
                        borderRadius: '1.5rem',
                        display: 'inline-flex',
                        marginBottom: '1.5rem'
                    }}>
                        <ShieldAlert size={48} />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                        ไม่มีสิทธิ์เข้าถึง
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '0.5rem' }}>
                        Access Denied
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: '1.6' }}>
                        คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้ หากคุณคิดว่าเกิดข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบ
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <a
                            href="/"
                            className="btn btn-primary"
                            style={{
                                textDecoration: 'none',
                                padding: '0.75rem 2rem',
                                borderRadius: '1rem',
                                fontWeight: '700'
                            }}
                        >
                            กลับหน้าหลัก
                        </a>
                    </div>
                    <div style={{
                        marginTop: '2rem',
                        padding: '1rem',
                        background: 'var(--bg-color)',
                        borderRadius: '1rem',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)'
                    }}>
                        <strong>บทบาทปัจจุบัน:</strong> {role || 'ไม่มี'} &nbsp;|&nbsp;
                        <strong>สิทธิ์ที่ต้องการ:</strong> {allowedRoles.join(', ')}
                    </div>
                </div>
            </div>
        )
    }

    // ✅ Authorized → render the page
    return children
}
