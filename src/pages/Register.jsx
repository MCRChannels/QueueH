import React, { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, Link } from 'react-router-dom'
import { Stethoscope, User, Mail, Lock, Phone, MapPin, Home, ArrowRight, Loader2 } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { translations } from '../lib/translations'
import thaiAddresses from '../data/thai_addresses.json'

export default function Register() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const { language } = useLanguage()
    const t = translations[language]
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        houseNo: '',
        village: '',
        alley: '',
        road: '',
        subDistrict: '',
        district: '',
        province: '',
        zipcode: ''
    })
    const [error, setError] = useState(null)

    // -- Address Logic --
    const provinces = useMemo(() => {
        return [...new Set(thaiAddresses.map(i => i.province))].sort()
    }, [])

    const districts = useMemo(() => {
        if (!formData.province) return []
        return [...new Set(
            thaiAddresses
                .filter(i => i.province === formData.province)
                .map(i => i.district)
        )].sort()
    }, [formData.province])

    const subDistricts = useMemo(() => {
        if (!formData.province || !formData.district) return []
        return [...new Set(
            thaiAddresses
                .filter(i => i.province === formData.province && i.district === formData.district)
                .map(i => i.subDistrict)
        )].sort()
    }, [formData.province, formData.district])


    const handleChange = (e) => {
        const { name, value } = e.target
        if (name === 'province') {
            setFormData(prev => ({ ...prev, [name]: value, district: '', subDistrict: '', zipcode: '' }))
        } else if (name === 'district') {
            setFormData(prev => ({ ...prev, [name]: value, subDistrict: '', zipcode: '' }))
        } else if (name === 'subDistrict') {
            const match = thaiAddresses.find(i => i.province === formData.province && i.district === formData.district && i.subDistrict === value)
            setFormData(prev => ({ ...prev, [name]: value, zipcode: match ? match.zipcode : '' }))
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data: existingUser } = await supabase.from('profiles').select('id').eq('username', formData.username).maybeSingle()
            if (existingUser) throw new Error(t.auth.userExists)

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
            })

            if (authError) throw authError

            if (authData.user) {
                const { error: profileError } = await supabase.from('profiles').insert({
                    id: authData.user.id,
                    username: formData.username,
                    email: formData.email,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    role: 'patient',
                    phone: formData.phone,
                    house_no: formData.houseNo,
                    village: formData.village,
                    road: formData.road,
                    sub_district: formData.subDistrict,
                    district: formData.district,
                    province: formData.province,
                    zipcode: formData.zipcode,
                    credibility_score: 100
                })
                if (profileError) throw profileError
                alert(t.auth.successReg)
                navigate('/login')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-color)', padding: '3rem 1.5rem' }}>
            <div className="container" style={{ maxWidth: '750px' }}>
                <div className="glass-card animate-fade-in" style={{ padding: '3rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                        <div style={{
                            display: 'inline-flex',
                            background: 'var(--primary)',
                            color: 'white',
                            padding: '1rem',
                            borderRadius: '1.25rem',
                            marginBottom: '1.5rem',
                            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)'
                        }}>
                            <Stethoscope size={32} />
                        </div>
                        <h2 style={{ fontSize: '2.25rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.025em' }}>{t.auth.registerTitle}</h2>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>{t.auth.registerSubtitle}</p>
                    </div>

                    {error && (
                        <div className="badge-danger" style={{
                            width: '100%',
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            marginBottom: '2rem',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '2.5rem' }}>

                        {/* Section: Account */}
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                                    <User size={20} />
                                </div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{t.auth.accountInfo}</h3>
                            </div>
                            <div className="grid-form">
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.username}</label>
                                    <input type="text" name="username" className="input" required onChange={handleChange} value={formData.username} placeholder="johndoe" />
                                </div>
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.email}</label>
                                    <input type="email" name="email" className="input" required onChange={handleChange} value={formData.email} placeholder="john@example.com" />
                                </div>
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.password}</label>
                                    <input type="password" name="password" className="input" required onChange={handleChange} value={formData.password} placeholder="••••••••" />
                                </div>
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.phone}</label>
                                    <input type="tel" name="phone" className="input" required onChange={handleChange} value={formData.phone} placeholder="08xxxxxxxx" />
                                </div>
                            </div>
                        </section>

                        {/* Section: Personal */}
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                                    <Stethoscope size={20} />
                                </div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{t.auth.personalDetails}</h3>
                            </div>
                            <div className="grid-form">
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.firstName}</label>
                                    <input type="text" name="firstName" className="input" required onChange={handleChange} value={formData.firstName} placeholder="John" />
                                </div>
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.lastName}</label>
                                    <input type="text" name="lastName" className="input" required onChange={handleChange} value={formData.lastName} placeholder="Doe" />
                                </div>
                            </div>
                        </section>

                        {/* Section: Address */}
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                                    <MapPin size={20} />
                                </div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{t.auth.addressDetails}</h3>
                            </div>
                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                <div className="grid-form">
                                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.houseNo}</label>
                                        <input type="text" name="houseNo" className="input" onChange={handleChange} value={formData.houseNo} placeholder="123/45" />
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.village}</label>
                                        <input type="text" name="village" className="input" onChange={handleChange} value={formData.village} placeholder="Village Name" />
                                    </div>
                                </div>

                                <div className="grid-form">
                                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.alley}</label>
                                        <input type="text" name="alley" className="input" onChange={handleChange} value={formData.alley} />
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.road}</label>
                                        <input type="text" name="road" className="input" onChange={handleChange} value={formData.road} />
                                    </div>
                                </div>

                                <div className="grid-form">
                                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.province}</label>
                                        <select name="province" className="input" onChange={handleChange} value={formData.province} required>
                                            <option value="">{t.auth.selectProvince}</option>
                                            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.district}</label>
                                        <select name="district" className="input" onChange={handleChange} value={formData.district} disabled={!formData.province} required>
                                            <option value="">{t.auth.selectDistrict}</option>
                                            {districts.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid-form">
                                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.subDistrict}</label>
                                        <select name="subDistrict" className="input" onChange={handleChange} value={formData.subDistrict} disabled={!formData.district} required>
                                            <option value="">{t.auth.selectSubDistrict}</option>
                                            {subDistricts.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                                        <label style={{ fontSize: '0.875rem', fontWeight: '600' }}>{t.auth.zipcode}</label>
                                        <input type="text" name="zipcode" className="input" onChange={handleChange} value={formData.zipcode} required readOnly style={{ background: '#f1f5f9' }} />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', marginTop: '1rem' }} disabled={loading}>
                            {loading ? <Loader2 className="spinner" size={20} /> : (
                                <>
                                    {t.auth.registerAction} <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.auth.haveAccount} </span>
                        <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '0.875rem', textDecoration: 'none' }}>
                            {t.auth.signInInstead}
                        </Link>
                    </div>
                </div>
            </div>

            <style>{`
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @media (max-width: 640px) {
                    .glass-card { padding: 1.5rem !important; }
                }
            `}</style>
        </div>
    )
}
