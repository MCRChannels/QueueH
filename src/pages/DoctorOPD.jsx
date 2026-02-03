import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Clock, Play, CheckCircle, Power, RefreshCw, UserCheck, ChevronRight, Loader2, Hospital, Zap, Trash2, UserPlus, Settings } from 'lucide-react'

export default function DoctorOPD() {
    const [profile, setProfile] = useState(null)
    const [hospital, setHospital] = useState(null)
    const [queues, setQueues] = useState([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [showSecretMenu, setShowSecretMenu] = useState(false)

    useEffect(() => {
        fetchInitialData()
    }, [])

    useEffect(() => {
        if (!profile?.hospital_id) return

        const channel = supabase
            .channel(`force-sync-${profile.hospital_id}`)
            .on('postgres_changes', { event: '*', table: 'queues' }, () => {
                fetchHospitalData(profile.hospital_id)
            })
            .on('postgres_changes', { event: '*', table: 'hospitals' }, (payload) => {
                if (payload.new && payload.new.id === profile.hospital_id) {
                    setHospital(payload.new)
                    fetchHospitalData(profile.hospital_id)
                }
            })
            .subscribe()

        const pollInterval = setInterval(() => {
            fetchHospitalData(profile.hospital_id)
        }, 10000)

        return () => {
            supabase.removeChannel(channel)
            clearInterval(pollInterval)
        }
    }, [profile?.hospital_id])

    const fetchInitialData = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        setProfile(prof)

        if (prof?.hospital_id) {
            fetchHospitalData(prof.hospital_id)
        } else {
            setLoading(false)
        }
    }

    const fetchHospitalData = async (hospId) => {
        const { data: hosp } = await supabase.from('hospitals').select('*').eq('id', hospId).single()
        setHospital(hosp)

        const { data: qData } = await supabase.from('queues')
            .select('*, profiles(first_name, last_name)')
            .eq('hospital_id', hospId)
            .eq('status', 'waiting')
            .order('queue_number', { ascending: true })

        setQueues(qData || [])
        setLoading(false)
    }

    const toggleOpen = async () => {
        if (!hospital) return
        setActionLoading(true)
        const { error } = await supabase.from('hospitals').update({ is_open: !hospital.is_open }).eq('id', hospital.id)
        if (error) alert(error.message)
        else await fetchHospitalData(hospital.id)
        setActionLoading(false)
    }

    const callNext = async () => {
        if (queues.length === 0) return
        setActionLoading(true)
        const next = queues[0]
        try {
            await supabase.from('queues').update({ status: 'completed' }).eq('id', next.id)
            await supabase.from('hospitals').update({ current_queue: next.queue_number }).eq('id', hospital.id)
            await fetchHospitalData(hospital.id)
        } catch (err) {
            console.error(err)
        } finally {
            setActionLoading(false)
        }
    }

    // --- SECRET PRESENTATION LOGIC ---
    const mockAddQueue = async () => {
        setActionLoading(true)
        try {
            // Find a dummy user that isn't THIS doctor
            const { data: users } = await supabase.from('profiles').select('id').neq('id', profile.id).limit(10)
            if (!users || users.length === 0) {
                alert('No dummy users found to mock a booking.')
                return
            }

            const randomUser = users[Math.floor(Math.random() * users.length)]
            const nextQueueNum = (hospital.total_queues || 0) + 1

            const { error } = await supabase.from('queues').insert({
                user_id: randomUser.id,
                hospital_id: hospital.id,
                queue_number: nextQueueNum,
                status: 'waiting'
            })

            if (error) throw error

            // Increment hospital total_queues
            await supabase.from('hospitals').update({ total_queues: nextQueueNum }).eq('id', hospital.id)

            await fetchHospitalData(hospital.id)
        } catch (err) {
            alert('Mock add failed: ' + err.message)
        } finally {
            setActionLoading(false)
            setShowSecretMenu(false)
        }
    }

    const clearAllQueues = async () => {
        if (!confirm('DEMO MODE: Clear all waiting patients and reset hospital counters?')) return
        setActionLoading(true)
        try {
            // 1. Cancel all waiting queues for this hospital
            await supabase.from('queues').update({ status: 'cancelled' }).eq('hospital_id', hospital.id).eq('status', 'waiting')

            // 2. Reset hospital counters
            await supabase.from('hospitals').update({ current_queue: 0, total_queues: 0 }).eq('id', hospital.id)

            await fetchHospitalData(hospital.id)
        } catch (err) {
            alert('Clear failed: ' + err.message)
        } finally {
            setActionLoading(false)
            setShowSecretMenu(false)
        }
    }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <Loader2 className="spinner" size={40} color="var(--primary)" />
        </div>
    )

    if (!profile?.hospital_id) {
        return (
            <div className="container section-spacing" style={{ textAlign: 'center' }}>
                <div className="glass-card animate-fade-in" style={{ maxWidth: '500px', margin: '0 auto' }}>
                    <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '1.5rem', borderRadius: '1.5rem', display: 'inline-flex', marginBottom: '1.5rem' }}>
                        <Hospital size={40} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>No Hospital Assigned</h2>
                    <p className="text-muted">Please contact an administrator to assign you to a specific hospital OPD room.</p>
                </div>
            </div>
        )
    }

    return (
        <div style={{ background: 'var(--bg-color)', minHeight: '100vh', paddingBottom: '5rem' }}>
            <div className="glass" style={{ borderBottom: '1px solid var(--border-color)', background: 'white', padding: '1.5rem 0' }}>
                <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>{hospital?.name}</h1>
                            <div className={`badge ${hospital?.is_open ? 'badge-success' : 'badge-danger'}`}>
                                {hospital?.is_open ? 'Room Active' : 'Room Offline'}
                            </div>
                        </div>
                        <p className="text-muted" style={{ marginTop: '0.25rem' }}>{profile.first_name} {profile.last_name} • Attending Doctor</p>
                    </div>
                    <button
                        onClick={toggleOpen}
                        disabled={actionLoading}
                        className={`btn ${hospital?.is_open ? 'btn-danger' : 'btn-success'}`}
                        style={{
                            background: hospital?.is_open ? undefined : '#10b981',
                            color: hospital?.is_open ? undefined : 'white',
                            borderColor: hospital?.is_open ? undefined : '#10b981'
                        }}>
                        {actionLoading ? <Loader2 className="spinner" size={18} /> : (
                            <>
                                <Power size={18} />
                                {hospital?.is_open ? 'End Shift' : 'Start Shift'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="container section-spacing">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>

                    {/* Left Column: Controls & Stats */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="glass-card animate-fade-in" style={{ textAlign: 'center', padding: '2.5rem' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Currently Serving</div>
                            <div style={{ fontSize: '5rem', fontWeight: '800', color: 'var(--primary)', lineHeight: '1', marginBottom: '1rem' }}>
                                #{hospital?.current_queue || 0}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                <div className="badge badge-success">
                                    <UserCheck size={14} style={{ marginRight: '0.4rem' }} /> In Progress
                                </div>
                            </div>
                        </div>

                        <div className="glass-card animate-fade-in" style={{ textAlign: 'center', padding: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <Users size={20} color="var(--text-muted)" />
                                <span className="text-muted" style={{ fontWeight: '600' }}>Waiting List</span>
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{queues.length}</div>
                            <p style={{ fontSize: '0.875rem' }} className="text-muted">Patients in queue</p>
                        </div>

                        <button
                            onClick={callNext}
                            disabled={queues.length === 0 || actionLoading}
                            className="btn btn-primary animate-fade-in"
                            style={{
                                padding: '1.5rem',
                                fontSize: '1.25rem',
                                width: '100%',
                                height: 'auto',
                                borderRadius: '1.25rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem'
                            }}>
                            {actionLoading ? <Loader2 className="spinner" size={24} /> : (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Play size={24} fill="white" />
                                        <span>Call Next Patient</span>
                                    </div>
                                    <span style={{ fontSize: '0.875rem', opacity: 0.8, fontWeight: '400' }}>
                                        {queues.length > 0 ? `Next: #${queues[0].queue_number}` : 'No more patients'}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Right Column: List */}
                    <div className="glass-card animate-fade-in" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>Queue Details</h3>
                            <button
                                onClick={() => fetchHospitalData(hospital.id)}
                                className="btn-outline"
                                style={{ padding: '0.4rem', borderRadius: '0.6rem', border: '1px solid var(--border-color)' }}>
                                <RefreshCw size={18} />
                            </button>
                        </div>

                        <div style={{ padding: '1rem', maxHeight: '600px', overflowY: 'auto' }}>
                            {queues.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-muted)' }}>
                                    <div style={{ opacity: 0.1, marginBottom: '1.5rem' }}>
                                        <Users size={80} />
                                    </div>
                                    <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Queue is Clear</h4>
                                    <p>Relax, all patients have been served!</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {queues.map((q, idx) => (
                                        <div
                                            key={q.id}
                                            className="animate-fade-in"
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '1.25rem 1.5rem',
                                                background: idx === 0 ? 'var(--primary-light)' : 'white',
                                                border: idx === 0 ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                                borderRadius: '1.25rem',
                                                animationDelay: `${idx * 0.05}s`
                                            }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{
                                                    width: '44px',
                                                    height: '44px',
                                                    background: idx === 0 ? 'var(--primary)' : 'var(--bg-color)',
                                                    color: idx === 0 ? 'white' : 'var(--text-muted)',
                                                    borderRadius: '0.75rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: '700',
                                                    fontSize: '1.1rem'
                                                }}>
                                                    #{q.queue_number}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>
                                                        {q.profiles?.first_name} {q.profiles?.last_name}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                        <Clock size={12} />
                                                        Joined at {new Date(q.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </div>
                                            </div>
                                            {idx === 0 && (
                                                <div className="badge badge-success" style={{ padding: '0.4rem 0.75rem' }}>
                                                    First in line
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* SECRET PRESENTATION MENU */}
            <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
                {showSecretMenu && (
                    <div className="glass-card animate-fade-in" style={{ padding: '1rem', width: '240px', background: 'rgba(15,23,42,0.95)', color: 'white', border: 'none' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '800', opacity: 0.5, marginBottom: '1rem', textTransform: 'uppercase' }}>Demo Tools (Admin Only)</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <button onClick={mockAddQueue} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', textAlign: 'left' }}>
                                <UserPlus size={18} color="#60a5fa" /> Mock Add Patient
                            </button>
                            <button onClick={clearAllQueues} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', textAlign: 'left' }}>
                                <Trash2 size={18} color="#ef4444" /> Reset Stats to 0
                            </button>
                        </div>
                    </div>
                )}
                <button
                    onClick={() => setShowSecretMenu(!showSecretMenu)}
                    style={{
                        width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary)', color: 'white',
                        border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', transform: showSecretMenu ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}>
                    <Zap size={24} fill={showSecretMenu ? 'white' : 'transparent'} />
                </button>
            </div>

            <style>{`
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}
