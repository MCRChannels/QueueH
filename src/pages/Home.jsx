import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { Clock, Users, Calendar, Hospital, AlertCircle, TrendingUp, ChevronRight, Loader2, User, UserCheck, XCircle } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { translations } from '../lib/translations'

export default function Home() {
    const navigate = useNavigate()
    const [hospitals, setHospitals] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedHospitalIdForModal, setSelectedHospitalIdForModal] = useState(null) // Changed to ID for realtime updates
    const { language } = useLanguage()
    const t = translations[language]
    const [bookingLoading, setBookingLoading] = useState(false)
    const [session, setSession] = useState(null)
    const [credibilityScore, setCredibilityScore] = useState(100)
    const [activeQueueId, setActiveQueueId] = useState(null)
    const [activeHospitalId, setActiveHospitalId] = useState(null)
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [cancelReason, setCancelReason] = useState('')
    const [otherReason, setOtherReason] = useState('')
    const [cancelling, setCancelling] = useState(false)

    // Derived state for modal (always fresh)
    const selectedHospital = hospitals.find(h => h.id === selectedHospitalIdForModal) || null

    // Notification State
    const lastNotifiedQueueDiff = React.useRef(null)

    // Notification Sound
    const playNotificationSound = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.type = 'sine'
            osc.frequency.setValueAtTime(523.25, ctx.currentTime)
            osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1)
            gain.gain.setValueAtTime(0.1, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
            osc.start()
            osc.stop(ctx.currentTime + 0.3)
        } catch (e) {
            console.error('Audio play failed', e)
        }
    }

    const sendQueueNotification = (title, body) => {
        if (!("Notification" in window)) return

        if (Notification.permission === "granted") {
            try {
                new Notification(title, { body, icon: '/vite.svg' })
                playNotificationSound()
                if (navigator.vibrate) navigator.vibrate([200, 100, 200])
            } catch (e) { console.error(e) }
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    new Notification(title, { body, icon: '/vite.svg' })
                    playNotificationSound()
                }
            })
        }
    }

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

        // Notification Permission Request for active queue users within effect
        if ("Notification" in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }

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

    // -- QUEUE NOTIFICATION LOGIC (OPD) --
    useEffect(() => {
        if (!activeQueueId || !activeHospitalId || hospitals.length === 0) return

        // 1. Find my queue number
        const checkMyStatus = async () => {
            const { data: myQueue } = await supabase.from('queues').select('queue_number').eq('id', activeQueueId).single()
            const hospital = hospitals.find(h => h.id === activeHospitalId)

            if (myQueue && hospital) {
                const currentServing = hospital.current_queue || 0
                const myNumber = myQueue.queue_number
                const diff = myNumber - currentServing // How many people ahead

                // Logic: Notify if queues remaining are specific thresholds
                if (diff > 0 && diff !== lastNotifiedQueueDiff.current) {
                    if (diff === 1) {
                        sendQueueNotification(
                            language === 'en' ? 'You are Next!' : 'ถึงคิวของคุณแล้ว!',
                            language === 'en' ? `Please proceed to ${hospital.name}` : `กรุณาไปที่ ${hospital.name}`
                        )
                    } else if (diff === 3) {
                        sendQueueNotification(
                            language === 'en' ? '3 Queues Remaining' : 'อีก 3 คิวจะถึงตาคุณ',
                            language === 'en' ? `Get ready at ${hospital.name}` : `เตรียมตัวรอเรียกที่ ${hospital.name}`
                        )
                    } else if (diff === 5) {
                        sendQueueNotification(
                            language === 'en' ? '5 Queues Remaining' : 'อีก 5 คิวจะถึงตาคุณ',
                            language === 'en' ? `Prepare yourself.` : `เตรียมตัวให้พร้อม`
                        )
                    }
                    lastNotifiedQueueDiff.current = diff
                }
            }
        }

        checkMyStatus()
    }, [hospitals, activeQueueId, activeHospitalId])

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
            const { data, error } = await supabase.from('hospitals')
                .select('*')
                .order('name', { ascending: true })

            if (error) {
                setHospitals([])
                return
            }

            // Enrich data with active doctor info IF the column exists
            const enriched = await Promise.all(data.map(async (h) => {
                if (h.active_doctor_id) {
                    const { data: doc } = await supabase.from('profiles')
                        .select('first_name, last_name')
                        .eq('id', h.active_doctor_id)
                        .single()
                    return { ...h, active_doctor: doc }
                }
                return h
            }))

            setHospitals(enriched)
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
            alert(language === 'en' ? 'Security Alert: You already have an active booking.' : 'แจ้งเตือนความปลอดภัย: คุณมีการจองที่ยังคงค้างอยู่ กรุณาดำเนินการให้เสร็จสิ้นหรือยกเลิกก่อนจองใหม่')
            return
        }
        setSelectedHospitalIdForModal(hospital.id)
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

            // 2. Optimistic Update (Optional, as realtime will catch it)

            // 3. Reset UI
            setSelectedHospitalIdForModal(null)
            checkActiveBooking(user.id)
            fetchHospitals() // Refresh local state
            navigate('/my-queue')
        } catch (err) {
            console.error('Booking Error:', err)
            alert('Error booking queue: ' + err.message)
        } finally {
            setBookingLoading(false)
        }
    }

    const handleCancelBooking = async () => {
        if (!activeQueueId) return
        setCancelling(true)
        try {
            const finalReason = cancelReason === 'Other' ? `Other: ${otherReason}` : cancelReason
            if (!finalReason) {
                alert('Please select a reason for cancellation')
                setCancelling(false)
                return
            }

            // 1. Update queue status
            const { error: qError } = await supabase.from('queues')
                .update({
                    status: 'cancelled',
                    cancel_reason: finalReason
                })
                .eq('id', activeQueueId)

            if (qError) throw qError

            // 2. Penalty: Deduct 10 points
            const newScore = Math.max(0, credibilityScore - 10)
            const { error: pError } = await supabase.from('profiles')
                .update({ credibility_score: newScore })
                .eq('id', session.user.id)

            if (pError) throw pError

            setCredibilityScore(newScore)
            setActiveQueueId(null)
            setActiveHospitalId(null)
            setShowCancelModal(false)
            setCancelReason('')
            setOtherReason('')

            alert(language === 'en' ? 'Booking Cancelled. -10 Credibility points deducted.' : 'ยกเลิกการจองเรียบร้อยแล้ว ถูกหักคะแนนความน่าเชื่อถือ 10 คะแนน')
            fetchHospitals()
        } catch (err) {
            console.error(err)
            alert('Error cancelling booking')
        } finally {
            setCancelling(false)
        }
    }

    const calculateWaitTime = (avg, total, current) => {
        // Logic: Calculate actual people waiting
        const waitingCount = Math.max(0, total - (current || 0))
        if (waitingCount === 0) return 0 // No wait

        const timePerPerson = avg || 15
        const rawTime = waitingCount * timePerPerson

        // Round to nearest 5 mins for "approximate" feel
        return Math.ceil(rawTime / 5) * 5
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
                        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '800', marginBottom: '1rem', letterSpacing: '-0.02em', lineHeight: '1.1' }}>
                            {t.home.heroTitle}
                        </h1>
                        <p style={{ fontSize: '1.25rem', opacity: 0.9, marginBottom: '2rem' }}>
                            {t.home.heroSubtitle}
                        </p>
                        {session && credibilityScore < 50 && (
                            <div className="glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.25rem', borderRadius: '1rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(255,255,255,0.2)' }}>
                                <AlertCircle size={20} />
                                <span style={{ fontWeight: '600' }}>{language === 'en' ? `Credibility Score Alert: ${credibilityScore}% (Booking Disabled)` : `คะแนนความน่าเชื่อถือ: ${credibilityScore}% (ไม่สามารถจองได้)`}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>{t.home.availableHospitals}</h2>
                        <p className="text-muted">{t.home.selectHospital}</p>
                    </div>
                    <div className="badge badge-success" style={{ padding: '0.5rem 1rem' }}>
                        ● {t.home.liveUpdates}
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem 0' }}>
                        <Loader2 className="spinner" size={40} color="var(--primary)" />
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                        {hospitals.map(hospital => (
                            <div key={hospital.id} className="glass-card animate-fade-in" style={{
                                display: 'flex',
                                flexDirection: 'column',
                                opacity: hospital.is_open ? 1 : 0.75,
                                filter: hospital.is_open ? 'none' : 'grayscale(1)',
                                background: hospital.is_open ? 'white' : 'var(--bg-color)',
                                transition: 'all 0.3s ease'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                    <div style={{
                                        background: hospital.is_open ? 'var(--primary-light)' : 'var(--border-color)',
                                        color: hospital.is_open ? 'var(--primary)' : 'var(--text-muted)',
                                        padding: '0.75rem',
                                        borderRadius: '1rem'
                                    }}>
                                        <Hospital size={24} />
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: hospital.is_open ? 'var(--success)' : 'var(--text-muted)', fontWeight: '700', fontSize: '1.25rem' }}>
                                            <TrendingUp size={16} />
                                            ~{calculateWaitTime(hospital.avg_waiting_time, hospital.total_queues, hospital.current_queue)}m
                                        </div>
                                        <span className="text-muted">{t.home.estWait}</span>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '1.35rem', fontWeight: '700', marginBottom: '0.75rem' }}>{hospital.name}</h3>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginBottom: '1.25rem',
                                    fontSize: '0.875rem',
                                    color: hospital.is_open ? 'var(--text-main)' : 'var(--text-muted)',
                                    fontWeight: '600'
                                }}>
                                    <User size={16} color={hospital.is_open ? 'var(--primary)' : 'var(--text-muted)'} />
                                    {hospital.is_open ? (
                                        <span>{t.home.attendingDoctor}: <span style={{ color: 'var(--primary)' }}>{hospital.active_doctor ? `${hospital.active_doctor.first_name} ${hospital.active_doctor.last_name}` : 'Unknown'}</span></span>
                                    ) : (
                                        <span>{t.home.serviceClosed}</span>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                                    <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: '1rem', textAlign: 'center' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{t.home.totalQueues}</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{hospital.total_queues}</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: '1rem', textAlign: 'center' }}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{t.home.currentlyIn}</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>#{hospital.current_queue}</div>
                                    </div>
                                </div>

                                {activeHospitalId === hospital.id ? (
                                    <div style={{ display: 'grid', gap: '0.75rem', marginTop: 'auto', width: '100%' }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.75rem',
                                            background: '#10b981',
                                            color: 'white',
                                            padding: '1rem',
                                            borderRadius: '1.25rem',
                                            fontWeight: '800',
                                            fontSize: '1rem',
                                            boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.2)'
                                        }}>
                                            <UserCheck size={20} />
                                            Successfully in Queue
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); navigate('/my-queue'); }}
                                            className="btn-outline"
                                            style={{
                                                width: '100%',
                                                padding: '1rem',
                                                borderRadius: '1.25rem',
                                                borderColor: 'var(--primary)',
                                                color: 'var(--primary)',
                                                fontWeight: '700',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                background: 'transparent'
                                            }}
                                        >
                                            <Clock size={18} /> View Digital Ticket
                                        </button>
                                        <p style={{ fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', margin: 0 }}>
                                            {language === 'en' ? 'Manage or cancel your booking in MyQ' : 'จัดการหรือยกเลิกการจองได้ที่เมนู MyQ'}
                                        </p>
                                    </div>
                                ) : (
                                    <button
                                        className={`btn ${!hospital.is_open || credibilityScore < 50 || (activeQueueId && activeHospitalId !== hospital.id) ? 'btn-outline' : 'btn-primary'}`}
                                        style={{
                                            width: '100%',
                                            marginTop: 'auto',
                                            padding: '1.1rem',
                                            opacity: (activeQueueId && activeHospitalId !== hospital.id) || !hospital.is_open ? 0.6 : 1,
                                            borderRadius: '1.25rem',
                                            fontSize: '1rem',
                                            fontWeight: '700'
                                        }}
                                        onClick={() => handleBookClick(hospital)}
                                        disabled={!hospital.is_open || (credibilityScore < 50 && session) || (activeQueueId && activeHospitalId !== hospital.id)}
                                    >
                                        {!hospital.is_open ? (
                                            t.home.closed
                                        ) : (credibilityScore < 50 && session) ? (
                                            t.home.accessRestricted
                                        ) : activeQueueId ? (
                                            t.home.multiBookingRestricted
                                        ) : (
                                            <>{t.home.bookAppointment} <ChevronRight size={18} /></>
                                        )}
                                    </button>
                                )}
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
                                {t.home.confirmAppointment}
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{t.home.reviewDetails}</p>
                        </div>

                        <div style={{
                            background: 'var(--bg-color)',
                            borderRadius: '1.75rem',
                            border: '1px solid var(--border-color)',
                            marginBottom: '2.5rem',
                            overflow: 'hidden'
                        }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem' }}>{t.home.medicalFacility}</span>
                                <span style={{ fontWeight: '800', textAlign: 'right', fontSize: '1rem', color: 'var(--text-main)' }}>{selectedHospital.name}</span>
                            </div>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.4)' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem' }}>{t.home.priorityId}</span>
                                <span style={{ fontWeight: '900', color: 'var(--primary)', fontSize: '1.25rem' }}>#{selectedHospital.total_queues + 1}</span>
                            </div>
                            <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.875rem' }}>{t.home.estWaitWindow}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)', fontWeight: '800', fontSize: '1.125rem' }}>
                                    <Clock size={18} /> ~{calculateWaitTime(selectedHospital.avg_waiting_time, selectedHospital.total_queues, selectedHospital.current_queue)}m
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1.25rem' }}>
                            <button className="btn-outline" style={{ flex: 1, padding: '1rem', borderRadius: '1.25rem', fontWeight: '700' }} onClick={() => setSelectedHospital(null)}>
                                {t.home.keepBooking}
                            </button>
                            <button className="btn btn-primary" style={{ flex: 1.5, padding: '1rem', borderRadius: '1.25rem', background: 'var(--primary)', height: '60px', fontSize: '1.1rem', fontWeight: '800', boxShadow: '0 10px 15px -3px rgba(59,130,246,0.3)' }} onClick={confirmBooking} disabled={bookingLoading}>
                                {bookingLoading ? <Loader2 className="spinner" size={24} /> : t.home.confirmBooking}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Cancellation Modal */}
            {showCancelModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1.5rem'
                }}>
                    <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem', background: 'white' }}>
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{
                                display: 'inline-flex', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
                                padding: '1rem', borderRadius: '1.25rem', marginBottom: '1rem'
                            }}>
                                <AlertCircle size={32} />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{t.home.cancelBookingQuestion}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem' }}>
                                {t.home.penaltyWarning}
                            </p>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-main)' }}>{t.home.reasonForCancellation}</label>
                            {[
                                { key: 'emergency', label: t.home.reasons.emergency },
                                { key: 'anotherHospital', label: t.home.reasons.anotherHospital },
                                { key: 'tooLong', label: t.home.reasons.tooLong },
                                { key: 'mistake', label: t.home.reasons.mistake },
                                { key: 'other', label: t.home.reasons.other }
                            ].map(reason => (
                                <button
                                    key={reason.key}
                                    onClick={() => setCancelReason(reason.key === 'other' ? 'Other' : reason.label)}
                                    style={{
                                        padding: '0.875rem 1.25rem',
                                        borderRadius: '0.875rem',
                                        border: '2px solid',
                                        borderColor: (cancelReason === reason.label || (cancelReason === 'Other' && reason.key === 'other')) ? 'var(--primary)' : 'var(--border-color)',
                                        background: (cancelReason === reason.label || (cancelReason === 'Other' && reason.key === 'other')) ? 'var(--primary-light)' : 'transparent',
                                        color: (cancelReason === reason.label || (cancelReason === 'Other' && reason.key === 'other')) ? 'var(--primary)' : 'var(--text-main)',
                                        textAlign: 'left', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    {reason.label}
                                </button>
                            ))}

                            {cancelReason === 'Other' && (
                                <textarea
                                    className="input"
                                    placeholder={t.home.specifyReason}
                                    style={{ padding: '1rem', minHeight: '100px', resize: 'none' }}
                                    value={otherReason}
                                    onChange={(e) => setOtherReason(e.target.value)}
                                />
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn-outline" style={{ flex: 1, padding: '1rem' }} onClick={() => setShowCancelModal(false)}>
                                {t.home.keepBooking}
                            </button>
                            <button
                                className="btn"
                                style={{ flex: 1, padding: '1rem', background: '#ef4444', color: 'white', fontWeight: '800' }}
                                onClick={handleCancelBooking}
                                disabled={cancelling}
                            >
                                {cancelling ? <Loader2 className="spinner" size={20} /> : t.home.confirmCancel}
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
