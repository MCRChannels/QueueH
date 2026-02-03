
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Truck, CheckCircle, Package, Clock, Phone, MapPinned, Pill, DollarSign, MoveRight, Loader2, ClipboardCheck, LayoutGrid, Hash } from 'lucide-react'

export default function Delivery() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)

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
        if (!confirm('Are you sure you want to mark this highly sensitive medical order as shipped?')) return
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: '0.75rem' }}>
                            <Truck size={24} />
                        </div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0 }}>Fulfillment Center</h1>
                    </div>
                    <p className="text-muted">Pharmacists & Medical Logistics Hub</p>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem' }}>
                    <div className="glass-card" style={{ padding: '0.75rem 1.5rem', background: 'white', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}><Package size={20} /></div>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Available</div>
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
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>Queue Cleared</h3>
                    <p className="text-muted">All medical orders have been successfully processed and shipped.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '2rem' }}>
                    {orders.map((order, idx) => {
                        const patient = order.consultation?.patient
                        const doctor = order.consultation?.doctor
                        const meds = order.medicines || []

                        return (
                            <div key={order.id} className="glass-card animate-fade-in" style={{ padding: 0, overflow: 'hidden', animationDelay: `${idx * 0.1}s` }}>
                                {/* Top Branding Strip */}
                                <div style={{ height: '4px', background: 'linear-gradient(90deg, var(--primary), #6366f1)' }}></div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1px', background: 'var(--border-color)' }}>

                                    {/* Section 1: Logistics & Identity */}
                                    <div style={{ background: 'white', padding: '2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                            <span className="badge badge-success" style={{ padding: '0.25rem 0.6rem', fontSize: '0.65rem' }}>PAID & VERIFIED</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--primary)' }}>#{order.id.slice(0, 8)}</span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                            <div style={{ width: '50px', height: '50px', borderRadius: '1rem', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                                                {patient?.first_name?.[0].toUpperCase() || 'P'}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '1.125rem', fontWeight: '800' }}>{patient?.first_name} {patient?.last_name}</div>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                    <Phone size={12} /> {patient?.phone || 'No Phone Registered'}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ background: 'var(--bg-color)', padding: '1.25rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                                                <MapPinned size={14} /> Shipping Destination
                                            </div>
                                            <p style={{ fontSize: '0.875rem', lineHeight: '1.6', color: 'var(--text-main)', margin: 0 }}>
                                                {patient?.house_no} {patient?.village ? `Moo ${patient?.village}` : ''} {patient?.road}<br />
                                                {patient?.sub_district}, {patient?.district}, {patient?.province} {patient?.zipcode}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Section 2: Medical Content */}
                                    <div style={{ background: 'rgba(255,255,255,0.7)', padding: '2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '1.5rem', textTransform: 'uppercase' }}>
                                            <Pill size={14} /> Medical Manifest (Dr. {doctor?.first_name})
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {meds.map((m, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'white', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)' }}>x{m.quantity}</div>
                                                        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{m.name}</div>
                                                    </div>
                                                    <div style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--text-muted)' }}>{m.price}฿</div>
                                                </div>
                                            ))}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0.75rem', marginTop: '0.5rem', fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                                                <span>Logistics/Surcharge</span>
                                                <span>{order.delivery_fee}฿</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3: Financial & Action */}
                                    <div style={{ background: 'white', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>Financial Oversight</div>
                                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                                <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{order.total_cost}฿</div>
                                                <div style={{ background: '#10b981', color: 'white', fontSize: '0.65rem', fontWeight: '900', padding: '2px 8px', borderRadius: '4px', position: 'absolute', top: '-10px', right: '-15px' }}>PAID</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '1rem' }}>
                                                <Clock size={14} /> {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => markAsShipped(order.id)}
                                            className="btn btn-primary"
                                            style={{ width: '100%', height: '54px', borderRadius: '1rem', gap: '0.75rem', fontSize: '1rem', fontWeight: '700' }}>
                                            Dispatch Order <MoveRight size={20} />
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
            `}</style>
        </div>
    )
}

