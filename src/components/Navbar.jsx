import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Stethoscope, User, Calendar, LogOut, Truck, Shield, Building, Menu, X, Globe, Clock } from 'lucide-react'
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
        const handleResize = () => {
            if (window.innerWidth > 992) setIsMenuOpen(false)
        }
        window.addEventListener('scroll', handleScroll)
        window.addEventListener('resize', handleResize)
        return () => {
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('resize', handleResize)
        }
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen)

    const allLinks = [
        { to: '/', label: t.hospitals, icon: <Calendar size={20} /> }
    ]

    if (role === 'patient' || role === 'doctor_online') {
        allLinks.push({ to: '/consult', label: t.consult, icon: <Stethoscope size={20} /> })
    }

    if (role === 'patient') {
        allLinks.push({ to: '/my-queue', label: 'MyQ', icon: <Clock size={20} /> })
    }

    if (role === 'pharmacist') allLinks.push({ to: '/delivery', label: t.delivery, icon: <Truck size={20} />, color: '#10b981' })
    if (role === 'admin') allLinks.push({ to: '/admin', label: t.admin, icon: <Shield size={20} />, color: 'var(--primary)' })
    if (role === 'doctor_opd') allLinks.push({ to: '/opd', label: t.opd, icon: <Building size={20} />, color: 'var(--primary)' })

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
                        fontWeight: '800',
                        color: 'var(--text-main)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        letterSpacing: '-0.04em'
                    }}
                >
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="40" height="40" rx="12" fill="var(--primary)" />
                            <path d="M20 10C16.134 10 13 13.134 13 17V21C13 22.1046 13.8954 23 15 23H17C18.1046 23 19 22.1046 19 21V19H21V21C21 22.1046 21.8954 23 23 23H25C26.1046 23 27 22.1046 27 21V17C27 13.134 23.866 10 20 10Z" fill="white" />
                            <path d="M20 23V30C20 31.1046 19.1046 32 18 32C16.8954 32 16 31.1046 16 30" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx="20" cy="16" r="2" fill="white" />
                        </svg>
                        <div style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            width: '12px',
                            height: '12px',
                            background: '#10b981',
                            border: '2px solid white',
                            borderRadius: '50%'
                        }}></div>
                    </div>
                    <span>Queue<span style={{ color: 'var(--primary)' }}>H</span></span>
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
                    {/* Profile Link - now grouped with settings */}
                    <Link
                        to="/profile"
                        className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.6rem 1rem',
                            borderRadius: '0.75rem',
                            fontSize: '0.95rem',
                            fontWeight: '500',
                            color: location.pathname === '/profile' ? 'var(--primary)' : 'var(--text-main)',
                            background: location.pathname === '/profile' ? 'var(--primary-light)' : 'transparent',
                        }}
                    >
                        <User size={20} />
                        {t.profile}
                    </Link>

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
                        // display: 'flex',  <-- Moved to CSS class
                        // flexDirection: 'column', <-- Moved to CSS class
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
                    {/* Add Profile to mobile menu explicitly as well */}
                    <Link
                        to="/profile"
                        onClick={() => setIsMenuOpen(false)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.8rem',
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            fontSize: '1rem',
                            fontWeight: '500',
                            background: location.pathname === '/profile' ? 'var(--primary-light)' : 'transparent',
                            color: location.pathname === '/profile' ? 'var(--primary)' : 'var(--text-main)'
                        }}
                    >
                        <User size={20} />
                        {t.profile}
                    </Link>
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
