
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Truck, CheckCircle, Package, Clock, Phone, MapPinned, Pill, DollarSign, MoveRight, Loader2, ClipboardCheck, LayoutGrid, Hash } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { translations } from '../lib/translations'

export default function Delivery() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const { language } = useLanguage()
    const t = translations[language]

    useEffect(() => {
        fetchOrders()
        const channel = supabase.channel('delivery_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions' }, fetchOrders)
            .subscribe()
        return () => supabase.removeChannel(channel)
    }, [])

    const fetchOrders = async () => {
        try {
            const { data: confirmedData } = await supabase.from('prescriptions')
                .select(`
                    *,
                    consultation:consultations (
                        doctor:profiles!doctor_id(*),
                        patient:profiles!patient_id(*)
                    )
                `)
                .eq('status', 'confirmed_payment')
                .order('created_at', { ascending: false })

            setOrders(confirmedData || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const markAsShipped = async (id) => {
        if (!confirm(language === 'en' ? 'Are you sure you want to mark this highly sensitive medical order as shipped?' : 'คุณแน่ใจหรือไม่ว่าต้องการระบุว่ารายการยานี้จัดส่งแล้ว?')) return
        const { error } = await supabase.from('prescriptions').update({ status: 'shipped' }).eq('id', id)
        if (error) {
            alert(error.message)
        } else {
            fetchOrders()
        }
    }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <Loader2 className="spinner" size={40} color="var(--primary)" />
        </div>
    )

    return (
        <div className="container" style={{ padding: '3rem 1rem 8rem' }}>

            {/* Professional Header & Stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '3rem' }}>
                <div style={{ flex: '1 1 auto', minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: '0.75rem' }}>
                            <Truck size={24} />
                        </div>
                        <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: '800', margin: 0, lineHeight: 1.2 }}>{t.delivery.title}</h1>
                    </div>
                    <p className="text-muted" style={{ margin: 0 }}>{language === 'en' ? 'Pharmacists & Medical Logistics Hub' : 'ศูนย์จัดการยาและโลจิสติกส์การแพทย์'}</p>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0 }}>
                    <div className="glass-card" style={{ padding: '0.75rem 1.25rem', background: 'white', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}><Package size={20} /></div>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', lineHeight: 1.1 }}>{language === 'en' ? 'Available' : 'คิวงาน'}</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>{orders.length}</div>
                        </div>
                    </div>
                </div>
            </div>

            {orders.length === 0 ? (
                <div className="glass-card animate-fade-in" style={{ textAlign: 'center', padding: '6rem 2rem', background: 'rgba(255,255,255,0.5)' }}>
                    <div style={{ width: '80px', height: '80px', background: 'var(--bg-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <ClipboardCheck size={40} style={{ opacity: 0.1 }} />
                    </div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>{language === 'en' ? 'Queue Cleared' : 'เคลียร์คิวแล้ว'}</h3>
                    <p className="text-muted">{language === 'en' ? 'All medical orders have been successfully processed and shipped.' : 'รายการยาทั้งหมดถูกดำเนินการและจัดส่งเรียบร้อยแล้ว'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '2rem' }}>
                    {orders.map((order, idx) => {
                        const patient = order.consultation?.patient
                        const doctor = order.consultation?.doctor
                        const meds = order.medicines || []

                        return (
                            <div key={order.id} className="glass-card animate-fade-in" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'white', animationDelay: `${idx * 0.1}s` }}>
                                {/* Top Branding Strip */}
                                <div style={{ height: '4px', background: 'linear-gradient(90deg, var(--primary), #6366f1)' }}></div>

                                <div className="delivery-grid">

                                    {/* Section 1: Logistics & Identity */}
                                    <div className="delivery-section" style={{ borderRight: '1px solid var(--bg-color)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <div style={{
                                                    background: 'rgba(16, 185, 129, 0.1)',
                                                    color: '#10b981',
                                                    padding: '0.35rem 0.75rem',
                                                    borderRadius: '2rem',
                                                    fontSize: '0.7rem',
                                                    fontWeight: '800',
                                                    letterSpacing: '0.02em',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem'
                                                }}>
                                                    <div style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }}></div>
                                                    {language === 'en' ? 'PAID' : 'ชำระเงินแล้ว'}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--bg-color)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem' }}>
                                                #{order.id.slice(0, 8)}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
                                            <div style={{
                                                width: '60px', height: '60px', borderRadius: '1.25rem',
                                                background: 'linear-gradient(135deg, var(--bg-color) 0%, #e2e8f0 100%)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)',
                                                border: '2px solid white',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                            }}>
                                                {patient?.first_name?.[0].toUpperCase() || 'P'}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.01em' }}>{patient?.first_name} {patient?.last_name}</div>
                                                <a href={`tel:${patient?.phone}`} style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                                                    <Phone size={14} /> {patient?.phone || (language === 'en' ? 'No Phone' : 'ไม่พบเบอร์')}
                                                </a>
                                            </div>
                                        </div>

                                        <div style={{ background: 'var(--bg-color)', padding: '1.5rem', borderRadius: '1.25rem', border: '1px solid rgba(0,0,0,0.02)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <MapPinned size={16} /> {language === 'en' ? 'Shipping Destination' : 'ที่อยู่จัดส่ง'}
                                            </div>
                                            <p style={{ fontSize: '0.9rem', lineHeight: '1.7', color: 'var(--text-main)', margin: 0, fontWeight: '500' }}>
                                                {patient?.house_no} {patient?.village ? (language === 'en' ? `Moo ${patient?.village}` : `หมู่ ${patient?.village}`) : ''} {patient?.road}<br />
                                                <span style={{ fontWeight: '700' }}>{patient?.sub_district}, {patient?.district}, {patient?.province} {patient?.zipcode}</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Section 2: Medical Content */}
                                    <div className="delivery-section" style={{ background: 'rgba(248, 250, 252, 0.5)', borderRight: '1px solid var(--bg-color)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                <Pill size={16} /> {language === 'en' ? 'Medical Manifest' : 'รายการยา'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)' }}>
                                                Dr. {doctor?.first_name}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {meds.map((m, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'white', borderRadius: '1rem', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', border: '1px solid var(--border-color)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--primary)', background: 'var(--primary-light)', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.6rem' }}>
                                                            {m.quantity}
                                                        </div>
                                                        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)' }}>{m.name}</div>
                                                    </div>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-muted)' }}>{m.price}฿</div>
                                                </div>
                                            ))}
                                            <div style={{
                                                display: 'flex', justifyContent: 'space-between',
                                                padding: '1rem', marginTop: '0.5rem',
                                                fontSize: '0.85rem', fontWeight: '700',
                                                color: 'var(--text-muted)', borderTop: '2px dashed var(--border-color)'
                                            }}>
                                                <span>{language === 'en' ? 'Shipping Fee' : 'ค่าจัดส่ง'}</span>
                                                <span style={{ color: 'var(--text-main)' }}>{order.delivery_fee}฿</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3: Financial & Action */}
                                    <div className="delivery-section" style={{ background: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Amount Due</div>
                                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                                <div style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                                                    {order.total_cost}<span style={{ fontSize: '1.5rem', marginLeft: '2px' }}>฿</span>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '1.5rem', fontWeight: '600' }}>
                                                <Clock size={16} /> {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => markAsShipped(order.id)}
                                            className="btn btn-primary"
                                            style={{
                                                width: '100%', height: '60px', borderRadius: '1.25rem',
                                                gap: '0.75rem', fontSize: '1.1rem', fontWeight: '800',
                                                boxShadow: '0 10px 20px -5px rgba(59, 130, 246, 0.4)',
                                                marginTop: '2rem'
                                            }}>
                                            {language === 'en' ? 'Direct Dispatch' : 'ส่งยา'} <MoveRight size={22} />
                                        </button>
                                    </div>

                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <style>{`
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .delivery-grid {
                    display: grid;
                    grid-template-columns: 1.5fr 1fr 1fr;
                    background: var(--border-color);
                    gap: 1px;
                }

                .delivery-section {
                    padding: clamp(1.25rem, 5vw, 2rem);
                }

                @media (max-width: 1024px) {
                    .delivery-grid {
                        grid-template-columns: 1fr 1fr;
                    }
                }

                @media (max-width: 768px) {
                    .delivery-grid {
                        grid-template-columns: 1fr;
                    }
                    .delivery-grid > div {
                        border-right: none !important;
                        border-bottom: 1px solid var(--border-color);
                    }
                }
            `}</style>
        </div>
    )
}

