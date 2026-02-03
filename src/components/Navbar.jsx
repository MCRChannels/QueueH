import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Stethoscope, User, Calendar, LogOut, Truck, Shield, Building, Menu, X } from 'lucide-react'

export default function Navbar() {
    const navigate = useNavigate()
    const location = useLocation()
    const [role, setRole] = useState(null)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session) {
                const { data } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
                if (data) setRole(data.role)
            }
        })

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
        { to: '/', label: 'Hospitals', icon: <Calendar size={20} /> },
        { to: '/consult', label: 'Consult', icon: <Stethoscope size={20} /> },
        { to: '/profile', label: 'Profile', icon: <User size={20} /> },
    ]

    const roleLinks = []
    if (role === 'pharmacist') roleLinks.push({ to: '/delivery', label: 'Pharmacy', icon: <Truck size={20} />, color: '#10b981' })
    if (role === 'admin') roleLinks.push({ to: '/admin', label: 'Admin', icon: <Shield size={20} />, color: 'var(--primary)' })
    if (role === 'doctor_opd') roleLinks.push({ to: '/opd', label: 'My OPD', icon: <Building size={20} />, color: 'var(--primary)' })

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
                    <button
                        onClick={handleLogout}
                        className="btn btn-outline"
                        style={{ marginLeft: '1rem', padding: '0.6rem 1.25rem' }}
                    >
                        <LogOut size={18} /> Logout
                    </button>
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
                        borderRadius: '1rem'
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
                    <button
                        onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                        className="btn btn-danger"
                        style={{ marginTop: '1rem', justifyContent: 'center', width: '100%' }}
                    >
                        <LogOut size={18} /> Logout
                    </button>
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
