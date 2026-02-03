import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Stethoscope, User, Calendar, LogOut, Truck, Shield, Building, Menu, X, Globe } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { translations } from '../lib/translations'

export default function Navbar({ session }) {
    const navigate = useNavigate()
    const location = useLocation()
    const [role, setRole] = useState(null)
    const { language, toggleLanguage } = useLanguage()
    const t = translations[language].navbar
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const fetchRole = async () => {
            if (session) {
                const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
                if (data) setRole(data.role)
            } else {
                setRole(null)
            }
        }

        fetchRole()

        const handleScroll = () => {
            setScrolled(window.scrollY > 20)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen)

    const navLinks = [
        { to: '/', label: t.hospitals, icon: <Calendar size={20} /> },
        { to: '/consult', label: t.consult, icon: <Stethoscope size={20} /> },
        { to: '/profile', label: t.profile, icon: <User size={20} /> },
    ]

    const roleLinks = []
    if (role === 'pharmacist') roleLinks.push({ to: '/delivery', label: t.delivery, icon: <Truck size={20} />, color: '#10b981' })
    if (role === 'admin') roleLinks.push({ to: '/admin', label: t.admin, icon: <Shield size={20} />, color: 'var(--primary)' })
    if (role === 'doctor_opd') roleLinks.push({ to: '/opd', label: t.opd, icon: <Building size={20} />, color: 'var(--primary)' })

    const allLinks = [...navLinks, ...roleLinks]

    return (
        <nav
            className={`glass ${scrolled ? 'scrolled' : ''}`}
            style={{
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                padding: scrolled ? '0.75rem 0' : '1.25rem 0',
                transition: 'all 0.3s ease',
                backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)'
            }}
        >
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link
                    to="/"
                    style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        letterSpacing: '-0.02em'
                    }}
                >
                    <div style={{ background: 'var(--primary)', color: 'white', padding: '0.4rem', borderRadius: '0.6rem', display: 'flex' }}>
                        <Stethoscope size={24} />
                    </div>
                    QueueH
                </Link>

                {/* Desktop Menu */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} className="desktop-menu">
                    {allLinks.map(link => (
                        <Link
                            key={link.to}
                            to={link.to}
                            className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.6rem 1rem',
                                borderRadius: '0.75rem',
                                fontSize: '0.95rem',
                                fontWeight: '500',
                                color: location.pathname === link.to ? 'var(--primary)' : 'var(--text-main)',
                                background: location.pathname === link.to ? 'var(--primary-light)' : 'transparent',
                            }}
                        >
                            {link.icon}
                            {link.label}
                        </Link>
                    ))}
                    {/* Language Toggle */}
                    <button
                        onClick={toggleLanguage}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.6rem 1rem',
                            background: 'white',
                            border: '1px solid var(--border-color)',
                            borderRadius: '0.75rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            color: 'var(--text-main)',
                            marginLeft: '0.5rem'
                        }}
                    >
                        <Globe size={16} />
                        {language === 'en' ? 'TH | EN' : 'EN | TH'}
                    </button>

                    {session ? (
                        <button
                            onClick={handleLogout}
                            className="btn btn-outline"
                            style={{ marginLeft: '1rem', padding: '0.6rem 1.25rem' }}
                        >
                            <LogOut size={18} /> {t.logout}
                        </button>
                    ) : (
                        <Link
                            to="/login"
                            className="btn btn-primary"
                            style={{ marginLeft: '1rem', padding: '0.6rem 1.25rem', textDecoration: 'none' }}
                        >
                            {t.login}
                        </Link>
                    )}
                </div>

                {/* Mobile Hamburger Toggle */}
                <button
                    onClick={toggleMenu}
                    className="mobile-toggle"
                    style={{
                        display: 'none',
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                        padding: '0.5rem',
                        borderRadius: '0.5rem'
                    }}
                >
                    {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div
                    className="mobile-menu glass"
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        marginTop: '0.5rem',
                        margin: '0.5rem 1rem',
                        borderRadius: '1rem',
                        background: 'white', /* Force solid background for readability */
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                        border: '1px solid var(--border-color)',
                    }}
                >
                    {allLinks.map(link => (
                        <Link
                            key={link.to}
                            to={link.to}
                            onClick={() => setIsMenuOpen(false)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.8rem',
                                padding: '1rem',
                                borderRadius: '0.75rem',
                                fontSize: '1rem',
                                fontWeight: '500',
                                background: location.pathname === link.to ? 'var(--primary-light)' : 'transparent',
                                color: location.pathname === link.to ? 'var(--primary)' : 'var(--text-main)'
                            }}
                        >
                            {link.icon}
                            {link.label}
                        </Link>
                    ))}
                    {/* Mobile Language Toggle */}
                    <button
                        onClick={toggleLanguage}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.8rem',
                            padding: '1rem',
                            background: 'white',
                            border: '1px solid var(--border-color)',
                            borderRadius: '0.75rem',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: '700',
                            color: 'var(--text-main)',
                            width: '100%',
                            marginTop: '0.5rem'
                        }}
                    >
                        <Globe size={20} />
                        {language === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
                    </button>

                    {session ? (
                        <button
                            onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                            className="btn btn-danger"
                            style={{ marginTop: '1rem', justifyContent: 'center', width: '100%' }}
                        >
                            <LogOut size={18} /> {t.logout}
                        </button>
                    ) : (
                        <Link
                            to="/login"
                            onClick={() => setIsMenuOpen(false)}
                            className="btn btn-primary"
                            style={{ marginTop: '1rem', justifyContent: 'center', width: '100%', textDecoration: 'none' }}
                        >
                            {t.login}
                        </Link>
                    )}
                </div>
            )}

            <style>{`
                .nav-link {
                    transition: all 0.2s ease;
                }
                .nav-link:hover {
                    background: var(--primary-light) !important;
                    color: var(--primary) !important;
                }
                @media (max-width: 992px) {
                    .desktop-menu { display: none !important; }
                    .mobile-toggle { display: flex !important; }
                }
            `}</style>
        </nav>
    )
}
