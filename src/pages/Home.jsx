import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Clock, Users, Calendar, Hospital, AlertCircle, TrendingUp, ChevronRight, Loader2, User } from 'lucide-react'

export default function Home() {
    const navigate = useNavigate()
    const [hospitals, setHospitals] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedHospital, setSelectedHospital] = useState(null)
    const [bookingLoading, setBookingLoading] = useState(false)
    const [session, setSession] = useState(null)
    const [credibilityScore, setCredibilityScore] = useState(100)
    const [activeQueueId, setActiveQueueId] = useState(null)
    const [activeHospitalId, setActiveHospitalId] = useState(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            if (session) fetchProfile(session.user.id)
        })

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
            if (session) {
                fetchProfile(session.user.id)
                checkActiveBooking(session.user.id)
            }
        })

        fetchHospitals()

        const channel = supabase
            .channel('hospitals-realtime')
            .on('postgres_changes', { event: '*', table: 'hospitals' }, (payload) => {
                fetchHospitals()
            })
            .on('postgres_changes', { event: '*', table: 'queues' }, (payload) => {
                if (session) checkActiveBooking(session.user.id)
                fetchHospitals()
            })
            .subscribe()

        return () => {
            authListener.subscription.unsubscribe()
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchProfile = async (userId) => {
        const { data } = await supabase.from('profiles').select('credibility_score').eq('id', userId).single()
        if (data) setCredibilityScore(data.credibility_score)
    }

    const checkActiveBooking = async (userId) => {
        const { data, error } = await supabase.from('queues')
            .select('id, hospital_id')
            .eq('user_id', userId)
            .eq('status', 'waiting')
            .maybeSingle()

        if (data) {
            setActiveQueueId(data.id)
            setActiveHospitalId(data.hospital_id)
        } else {
            setActiveQueueId(null)
            setActiveHospitalId(null)
        }
    }

    const fetchHospitals = async () => {
        try {
            const { data, error } = await supabase.from('hospitals').select('*').eq('is_open', true)
            if (error) setHospitals([])
            else setHospitals(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleBookClick = (hospital) => {
        if (!session) { navigate('/login'); return; }
        if (credibilityScore < 50) { return; }
        if (activeQueueId) {
            alert('Security Alert: You already have an active booking. Please complete or cancel your current appointment before booking a new one.')
            return
        }
        setSelectedHospital(hospital)
    }

    const confirmBooking = async () => {
        setBookingLoading(true)
        try {
            const { user } = session
            const nextQueue = selectedHospital.total_queues + 1

            // 1. Insert into queues
            const { error: qError } = await supabase.from('queues').insert({
                user_id: user.id,
                hospital_id: selectedHospital.id,
                queue_number: nextQueue,
                status: 'waiting'
            })

            if (qError) throw qError

            // 2. Increment total_queues in hospitals table
            const { error: hError } = await supabase.from('hospitals')
                .update({ total_queues: nextQueue })
                .eq('id', selectedHospital.id)

            if (hError) throw hError

            const waitTime = calculateWaitTime(selectedHospital.avg_waiting_time, selectedHospital.total_queues)
            alert(`Booking Confirmed!\nYour Queue: #${nextQueue}\nEstimated Wait: ${waitTime} mins`)

            setSelectedHospital(null)
            checkActiveBooking(user.id)
            fetchHospitals() // Refresh local state
        } catch (err) {
            console.error('Booking Error:', err)
            alert('Error booking queue: ' + err.message)
        } finally {
            setBookingLoading(false)
        }
    }

    const calculateWaitTime = (avg, total) => {
        const gravity = 1.2 // Reduced gravity slightly for better balance
        const base = Math.max(avg, 10)
        // Logic: if queue is empty, still takes base time. Each person adds ~3-5 mins.
        return Math.round((base + (total * 8)) * gravity)
    }

    return (
        <div style={{ background: 'var(--bg-color)', minHeight: '100vh', paddingBottom: '5rem' }}>
            {/* Hero Section */}
            <div style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, #818cf8 100%)',
                color: 'white',
                padding: '4rem 0',
                marginBottom: '3rem',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute',
                    top: '-10%',
                    right: '-5%',
                    width: '300px',
                    height: '300px',
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '50%',
                    filter: 'blur(60px)'
                }} />
                <div className="container">
                    <div className="animate-fade-in" style={{ maxWidth: '600px' }}>
                        <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '1rem', letterSpacing: '-0.02em', lineHeight: '1.1' }}>
                            Quality Healthcare, <br />Without the Wait.
                        </h1>
                        <p style={{ fontSize: '1.25rem', opacity: 0.9, marginBottom: '2rem' }}>
                            Book your queue at leading hospitals instantly and track your status in real-time.
                        </p>
                        {session && credibilityScore < 50 && (
                            <div className="glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderRadius: '1rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(255,255,255,0.2)' }}>
                                <AlertCircle size={20} />
                                <span style={{ fontWeight: '600' }}>Credibility Score Alert: {credibilityScore}% (Booking Disabled)</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Available Hospitals</h2>
                        <p className="text-muted">Select a hospital to join the queue</p>
                    </div>
                    <div className="badge badge-success" style={{ padding: '0.5rem 1rem' }}>
                        ● Live Updates
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}>
                        <Loader2 className="spinner" size={40} color="var(--primary)" />
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
                        {hospitals.map(hospital => (
                            <div key={hospital.id} className="glass-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                    <div style={{
                                        background: 'var(--primary-light)',
                                        color: 'var(--primary)',
                                        padding: '0.75rem',
                                        borderRadius: '1rem'
                                    }}>
                                        <Hospital size={24} />
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--success)', fontWeight: '700', fontSize: '1.25rem' }}>
                                            <TrendingUp size={16} />
                                            ~{calculateWaitTime(hospital.avg_waiting_time, hospital.total_queues)}m
                                        </div>
                                        <span className="text-muted">Est. Wait</span>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '1.35rem', fontWeight: '700', marginBottom: '1.25rem' }}>{hospital.name}</h3>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                                    <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: '1rem', textAlign: 'center' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total Queues</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{hospital.total_queues}</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: '1rem', textAlign: 'center' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Currently In</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>#{hospital.current_queue}</div>
                                    </div>
                                </div>

                                <button
                                    className={`btn ${credibilityScore < 50 || (activeQueueId && activeHospitalId !== hospital.id) ? 'btn-outline' : 'btn-primary'}`}
                                    style={{
                                        width: '100%',
                                        marginTop: 'auto',
                                        padding: '1rem',
                                        background: activeHospitalId === hospital.id ? '#10b981' : undefined,
                                        borderColor: activeHospitalId === hospital.id ? '#10b981' : undefined,
                                        color: activeHospitalId === hospital.id ? 'white' : undefined,
                                        opacity: activeQueueId && activeHospitalId !== hospital.id ? 0.5 : 1
                                    }}
                                    onClick={() => handleBookClick(hospital)}
                                    disabled={(credibilityScore < 50 && session) || (activeQueueId && activeHospitalId !== hospital.id)}
                                >
                                    {activeHospitalId === hospital.id ? (
                                        <>
                                            <User size={18} /> You Are In Queue
                                        </>
                                    ) : (credibilityScore < 50 && session) ? (
                                        'Access Restricted'
                                    ) : activeQueueId ? (
                                        'Multi-Booking Restricted'
                                    ) : (
                                        <>Book Appointment <ChevronRight size={18} /></>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Premium Booking Modal */}
            {selectedHospital && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem'
                }}>
                    <div className="glass-card animate-fade-in" style={{
                        width: '100%', maxWidth: '480px', padding: '3rem',
                        background: 'white', borderRadius: '2.5rem',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                            <div style={{
                                width: '80px', height: '80px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                borderRadius: '2rem',
                                margin: '0 auto 1.5rem'
                            }}>
                                <Calendar size={40} />
                            </div>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                                Confirm Appointment
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Review your clinical dispatch details</p>
                        </div>

                        <div style={{
                            background: 'var(--bg-color)',
                            borderRadius: '1.75rem',
                            border: '1px solid var(--border-color)',
                            marginBottom: '2.5rem',
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem' }}>Medical Facility</span>
                                <span style={{ fontWeight: '800', textAlign: 'right', fontSize: '1rem', color: 'var(--text-main)' }}>{selectedHospital.name}</span>
                            </div>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.4)' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem' }}>Priority ID</span>
                                <span style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '1.25rem' }}>#{selectedHospital.total_queues + 1}</span>
                            </div>
                            <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem' }}>Est. Wait Window</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)', fontWeight: '800', fontSize: '1.125rem' }}>
                                    <Clock size={18} /> ~{calculateWaitTime(selectedHospital.avg_waiting_time, selectedHospital.total_queues)}m
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1.25rem' }}>
                            <button className="btn-outline" style={{ flex: 1, padding: '1rem', borderRadius: '1.25rem', fontWeight: '700' }} onClick={() => setSelectedHospital(null)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" style={{ flex: 1.5, padding: '1rem', borderRadius: '1.25rem', background: 'var(--primary)', height: '60px', fontSize: '1.1rem', fontWeight: '800', boxShadow: '0 10px 15px -3px rgba(59,130,246,0.3)' }} onClick={confirmBooking} disabled={bookingLoading}>
                                {bookingLoading ? <Loader2 className="spinner" size={24} /> : 'Confirm Booking'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
