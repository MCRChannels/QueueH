import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, Link } from 'react-router-dom'
import { Stethoscope, Lock, Mail, User as UserIcon, Loader2 } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { translations } from '../lib/translations'

export default function Login() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true) // Start with loading to check session
    const { language } = useLanguage()
    const t = translations[language]
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)

    React.useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                navigate('/')
            } else {
                setLoading(false)
            }
        })
    }, [navigate])

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            let emailToUse = identifier

            if (!identifier.includes('@')) {
                const { data, error: profileError } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('username', identifier)
                    .single()

                if (profileError || !data) {
                    throw new Error(language === 'en' ? 'Username not found or invalid credentials' : 'ไม่พบชื่อผู้ใช้ หรือข้อมูลประจำตัวไม่ถูกต้อง')
                }
                emailToUse = data.email
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: emailToUse,
                password,
            })

            if (error) throw error

            navigate('/')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: 'var(--bg-color)'
        }}>
            <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{
                        display: 'inline-flex',
                        background: 'var(--primary)',
                        color: 'white',
                        padding: '1rem',
                        borderRadius: '1.25rem',
                        marginBottom: '1rem',
                        boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)'
                    }}>
                        <Stethoscope size={32} />
                    </div>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.025em' }}>{t.auth.loginTitle}</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>{t.auth.loginSubtitle}</p>
                </div>

                {error && (
                    <div style={{
                        background: '#fef2f2',
                        color: '#ef4444',
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        border: '1px solid #fee2e2',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'grid', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)' }}>{t.auth.identifier}</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                <Mail size={18} />
                            </div>
                            <input
                                type="text"
                                className="input"
                                style={{ paddingLeft: '2.75rem' }}
                                required
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder="user1 or email@example.com"
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-main)' }}>{t.auth.password}</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                                <Lock size={18} />
                            </div>
                            <input
                                type="password"
                                className="input"
                                style={{ paddingLeft: '2.75rem' }}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem' }} disabled={loading}>
                        {loading ? <Loader2 className="spinner" size={18} /> : t.auth.signIn}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.auth.noAccount} </span>
                    <Link to="/register" style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '0.875rem', textDecoration: 'none' }}>
                        {t.auth.registerNow}
                    </Link>
                </div>
            </div>

            <style>{`
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
