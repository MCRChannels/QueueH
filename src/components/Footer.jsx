import React from 'react'
import { Link } from 'react-router-dom'
import { Stethoscope, Facebook, Twitter, Instagram, Mail, Phone, MapPin } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

export default function Footer() {
    const { language } = useLanguage()

    const content = {
        en: {
            brandDescription: 'Revolutionizing healthcare accessibility with real-time queue management and virtual consultations.',
            quickLinks: 'Quick Links',
            hospitals: 'Hospitals',
            consult: 'Consult Doctor',
            profile: 'Patient Profile',
            delivery: 'Medicine Delivery',
            contactUs: 'Contact Us',
            address: '123 Health Ave, Bangkok, Thailand',
            copyright: '© 2026 QueueH Healthcare. All rights reserved.'
        },
        th: {
            brandDescription: 'ปฏิวัติการเข้าถึงบริการสาธารณสุขด้วยระบบจัดการคิวแบบเรียลไทม์และการปรึกษาแพทย์ออนไลน์',
            quickLinks: 'ลิงก์ด่วน',
            hospitals: 'โรงพยาบาล',
            consult: 'ปรึกษาหมอ',
            profile: 'โปรไฟล์ผู้ป่วย',
            delivery: 'ส่งยาถึงบ้าน',
            contactUs: 'ติดต่อเรา',
            address: '123 ถ.สุขภาพ, กรุงเทพฯ, ประเทศไทย',
            copyright: '© 2026 QueueH Healthcare. สงวนลิขสิทธิ์ทั้งหมด'
        }
    }

    const t = content[language]

    return (
        <footer style={{ background: '#0f172a', color: 'white', padding: '4rem 0 2rem', marginTop: 'auto' }}>
            <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '3rem' }}>
                {/* Brand Column */}
                <div>
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: 'white', textDecoration: 'none' }}>
                        <div style={{ background: 'var(--primary)', color: 'white', padding: '0.4rem', borderRadius: '0.6rem', display: 'flex' }}>
                            <Stethoscope size={24} />
                        </div>
                        <span style={{ fontSize: '1.5rem', fontWeight: '800' }}>QueueH</span>
                    </Link>
                    <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                        {t.brandDescription}
                    </p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                        <a href="#" style={{ color: 'rgba(255,255,255,0.4)', transition: 'color 0.2s' }}><Facebook size={20} /></a>
                        <a href="#" style={{ color: 'rgba(255,255,255,0.4)', transition: 'color 0.2s' }}><Twitter size={20} /></a>
                        <a href="#" style={{ color: 'rgba(255,255,255,0.4)', transition: 'color 0.2s' }}><Instagram size={20} /></a>
                    </div>
                </div>

                {/* Quick Links Column */}
                <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.5rem' }}>{t.quickLinks}</h4>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <li><Link to="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.95rem' }}>{t.hospitals}</Link></li>
                        <li><Link to="/consult" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.95rem' }}>{t.consult}</Link></li>
                        <li><Link to="/profile" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.95rem' }}>{t.profile}</Link></li>
                        <li><Link to="/delivery" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.95rem' }}>{t.delivery}</Link></li>
                    </ul>
                </div>

                {/* Contact Column */}
                <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.5rem' }}>{t.contactUs}</h4>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <li style={{ display: 'flex', gap: '0.75rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
                            <MapPin size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            {t.address}
                        </li>
                        <li style={{ display: 'flex', gap: '0.75rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
                            <Phone size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            +66 2 123 4567
                        </li>
                        <li style={{ display: 'flex', gap: '0.75rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
                            <Mail size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            support@queueh.com
                        </li>
                    </ul>
                </div>
            </div>

            <div className="container" style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                    {t.copyright}
                </p>
            </div>
        </footer>
    )
}
