import React, { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { Clock, MapPin, User, Calendar, Loader2, CheckCircle, AlertCircle, Trash2, ArrowRight, Bell, BellRing, Volume2, ChevronRight } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { translations } from '../lib/translations'

export default function MyQueue() {
    const [loading, setLoading] = useState(true)
    const [activeQueue, setActiveQueue] = useState(null)
    const [hospital, setHospital] = useState(null)
    const [session, setSession] = useState(null)
    const { language } = useLanguage()
    const t = translations[language]

    // Notification State
    const lastNotifiedAt = useRef(null) // Track which threshold was last notified

    const [notiPermission, setNotiPermission] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    )
    const [pulseAnimation, setPulseAnimation] = useState(false)

    // ─── NOTIFICATION HELPERS ───

    // Play a pleasant notification chime
    const playChime = useCallback((type = 'normal') => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)()

            if (type === 'urgent') {
                // Urgent: Two-tone ascending chime (ding-DONG)
                const osc1 = ctx.createOscillator()
                const osc2 = ctx.createOscillator()
                const gain1 = ctx.createGain()
                const gain2 = ctx.createGain()

                osc1.connect(gain1); gain1.connect(ctx.destination)
                osc2.connect(gain2); gain2.connect(ctx.destination)

                osc1.type = 'sine'; osc1.frequency.value = 659.25 // E5
                gain1.gain.setValueAtTime(0.15, ctx.currentTime)
                gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
                osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.25)

                osc2.type = 'sine'; osc2.frequency.value = 880 // A5
                gain2.gain.setValueAtTime(0, ctx.currentTime + 0.15)
                gain2.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.2)
                gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6)
                osc2.start(ctx.currentTime + 0.15); osc2.stop(ctx.currentTime + 0.6)
            } else if (type === 'critical') {
                // Critical: Triple ascending chime for "YOU'RE NEXT" 
                const notes = [783.99, 987.77, 1318.51] // G5, B5, E6
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator()
                    const gain = ctx.createGain()
                    osc.connect(gain); gain.connect(ctx.destination)
                    osc.type = 'sine'
                    osc.frequency.value = freq
                    const startTime = ctx.currentTime + i * 0.15
                    gain.gain.setValueAtTime(0.18, startTime)
                    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35)
                    osc.start(startTime); osc.stop(startTime + 0.35)
                })
            } else {
                // Normal: Single gentle ping
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.connect(gain); gain.connect(ctx.destination)
                osc.type = 'sine'
                osc.frequency.setValueAtTime(523.25, ctx.currentTime)
                osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.1)
                gain.gain.setValueAtTime(0.12, ctx.currentTime)
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
                osc.start(); osc.stop(ctx.currentTime + 0.3)
            }
        } catch (e) {
            console.warn('Chime failed:', e)
        }
    }, [])



    // Send notification — System Push only if hidden + Sound/Vibrate always
    const sendQueueAlert = useCallback((title, body, type = 'normal') => {
        // 1. Play sound
        playChime(type)

        // 2. Vibrate (mobile)
        if (navigator.vibrate) {
            if (type === 'critical') {
                navigator.vibrate([300, 100, 300, 100, 300])
            } else if (type === 'urgent') {
                navigator.vibrate([200, 100, 200])
            } else {
                navigator.vibrate([150])
            }
        }

        // 3. Pulse animation for critical
        if (type === 'critical' || type === 'urgent') {
            setPulseAnimation(true)
            setTimeout(() => setPulseAnimation(false), 3000)
        }

        // 4. System Notification (only if allowed)
        // Note: We prioritize push for background, but some users might want it in foreground too.
        // For now, let's allow it if permission granted, as we removed the in-app banner.
        if ('Notification' in window && Notification.permission === 'granted') {
            // Optional: check document.visibilityState to avoid double-alerting if user is staring at screen
            if (document.visibilityState === 'hidden') {
                try {
                    new Notification(title, {
                        body: body,
                        icon: '/vite.svg',
                        badge: '/vite.svg',
                        tag: 'queue-alert',
                        renotify: true,
                        vibrate: type === 'critical' ? [300, 100, 300] : [200],
                        requireInteraction: type === 'critical'
                    })
                } catch (e) { console.warn('Push notification error:', e) }
            }
        }
    }, [playChime])

    // Request notification permission
    const requestNotiPermission = async () => {
        if (!('Notification' in window)) return
        const perm = await Notification.requestPermission()
        setNotiPermission(perm)
    }

    // ─── QUEUE NOTIFICATION LOGIC ───
    const checkAndNotify = useCallback((queue, hosp) => {
        if (!queue || !hosp) return

        const peopleAhead = Math.max(0, queue.queue_number - (hosp.current_queue || 0))
        const threshold = getNotificationThreshold(peopleAhead)

        // Only notify once per threshold level
        if (threshold && threshold !== lastNotifiedAt.current) {
            lastNotifiedAt.current = threshold

            if (threshold === 'YOUR_TURN') {
                sendQueueAlert(
                    language === 'en' ? '🚨 It\'s Your Turn!' : '🚨 ถึงคิวของคุณแล้ว!',
                    language === 'en'
                        ? `Queue #${queue.queue_number} — Please proceed to ${hosp.name} immediately!`
                        : `คิว #${queue.queue_number} — กรุณาเข้าพบแพทย์ที่ ${hosp.name} ได้ทันที!`,
                    'critical'
                )
            } else if (threshold === 'NEXT') {
                sendQueueAlert(
                    language === 'en' ? '⚡ You Are Next!' : '⚡ คุณคือคิวถัดไป!',
                    language === 'en'
                        ? `Only 1 person ahead of you. Get ready at ${hosp.name}!`
                        : `เหลืออีก 1 คิวข้างหน้า เตรียมตัวรอที่ ${hosp.name} ได้เลย!`,
                    'critical'
                )
            } else if (threshold === 'ALMOST') {
                sendQueueAlert(
                    language === 'en' ? '⏰ Almost Your Turn!' : '⏰ ใกล้ถึงคิวแล้ว!',
                    language === 'en'
                        ? `${peopleAhead} people ahead. Please start heading to ${hosp.name}.`
                        : `เหลืออีก ${peopleAhead} คิว เตรียมตัวเดินทางไปที่ ${hosp.name} ได้แล้ว`,
                    'urgent'
                )
            } else if (threshold === 'SOON') {
                sendQueueAlert(
                    language === 'en' ? '🔔 Queue Update' : '🔔 แจ้งเตือนคิว',
                    language === 'en'
                        ? `${peopleAhead} people ahead of you at ${hosp.name}. Estimated wait: ~${Math.ceil(peopleAhead * (hosp.avg_waiting_time || 15) / 5) * 5} mins.`
                        : `เหลืออีก ${peopleAhead} คิวที่ ${hosp.name} เวลารอประมาณ ~${Math.ceil(peopleAhead * (hosp.avg_waiting_time || 15) / 5) * 5} นาที`,
                    'normal'
                )
            }
        }
    }, [language, sendQueueAlert])

    const getNotificationThreshold = (peopleAhead) => {
        if (peopleAhead <= 0) return 'YOUR_TURN'
        if (peopleAhead === 1) return 'NEXT'
        if (peopleAhead <= 3) return 'ALMOST'
        if (peopleAhead <= 5) return 'SOON'
        return null
    }

    // ─── DATA FETCHING ───

    useEffect(() => {
        fetchMyQueue()

        // Request notification permission early
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(perm => setNotiPermission(perm))
        }

        // Realtime updates
        const channel = supabase
            .channel('my-queue-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => {
                fetchMyQueue()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hospitals' }, () => {
                fetchMyQueue()
            })
            .subscribe()

        return () => supabase.removeChannel(channel)
    }, [])

    const fetchMyQueue = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        if (!session) {
            setLoading(false)
            return
        }

        // Fetch active queue
        const { data: queue } = await supabase.from('queues')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('status', 'waiting')
            .maybeSingle()

        if (queue) {
            setActiveQueue(queue)
            // Fetch hospital details
            const { data: hosp } = await supabase.from('hospitals').select('*').eq('id', queue.hospital_id).single()
            setHospital(hosp)

            // Check & send notification
            checkAndNotify(queue, hosp)
        } else {
            setActiveQueue(null)
            setHospital(null)
        }
        setLoading(false)
    }

    const cancelBooking = async () => {
        if (!confirm(language === 'en' ? 'Are you sure you want to cancel? You will lose 10 credibility points.' : 'คุณแน่ใจว่าต้องการยกเลิกหรือไม่? คุณจะถูกหักคะแนนความน่าเชื่อถือ 10 คะแนน')) return

        try {
            await supabase.from('queues').update({ status: 'cancelled', cancel_reason: 'User Cancelled via MyQ' }).eq('id', activeQueue.id)

            // Deduct credibility score
            if (session) {
                const { data: profileData } = await supabase.from('profiles').select('credibility_score').eq('id', session.user.id).single()
                if (profileData) {
                    const newScore = Math.max(0, (profileData.credibility_score || 100) - 10)
                    await supabase.from('profiles').update({ credibility_score: newScore }).eq('id', session.user.id)
                }
            }

            alert(language === 'en' ? 'Booking Cancelled. -10 Credibility points deducted.' : 'ยกเลิกการจองสำเร็จ ถูกหักคะแนนความน่าเชื่อถือ 10 คะแนน')
            fetchMyQueue()
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <Loader2 className="spinner" size={40} color="var(--primary)" />
        </div>
    )

    if (!session) return (
        <div className="container section-spacing" style={{ textAlign: 'center' }}>
            <div className="glass-card animate-fade-in" style={{ padding: '3rem' }}>
                <Link to="/login" className="btn btn-primary">{language === 'en' ? 'Login to view Queue' : 'เข้าสู่ระบบเพื่อดูคิว'}</Link>
            </div>
        </div>
    )

    if (!activeQueue || !hospital) return (
        <div className="container section-spacing" style={{ textAlign: 'center', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-card animate-fade-in" style={{ padding: '3rem', maxWidth: '500px', width: '100%' }}>
                <div style={{ background: 'var(--bg-color)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--text-muted)' }}>
                    <Calendar size={40} />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem' }}>{language === 'en' ? 'No Active Queue' : 'ไม่มีคิวที่กำลังรอ'}</h2>
                <p className="text-muted" style={{ marginBottom: '2rem' }}>{language === 'en' ? 'You currently do not have any appointment bookings.' : 'คุณยังไม่ได้จองคิวใดๆ ไว้ในขณะนี้'}</p>
                <Link to="/" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    {language === 'en' ? 'Book an Appointment' : 'จองคิวทันที'} <ArrowRight size={20} />
                </Link>
            </div>
        </div>
    )

    const peopleAhead = Math.max(0, activeQueue.queue_number - (hospital.current_queue || 0))
    const rawTime = peopleAhead * (hospital.avg_waiting_time || 15)
    const estWait = peopleAhead > 0 ? Math.ceil(rawTime / 5) * 5 : 0

    // Dynamic status
    const isYourTurn = peopleAhead <= 0
    const isNext = peopleAhead === 1
    const isAlmost = peopleAhead <= 3
    const statusColor = isYourTurn ? '#10b981' : isNext ? '#f59e0b' : isAlmost ? '#6366f1' : 'var(--primary)'
    const statusBg = isYourTurn ? 'rgba(16, 185, 129, 0.08)' : isNext ? 'rgba(245, 158, 11, 0.08)' : isAlmost ? 'rgba(99, 102, 241, 0.06)' : 'var(--bg-color)'

    return (
        <div className="container section-spacing" style={{ maxWidth: '600px' }}>



            {/* ─── NOTIFICATION PERMISSION CARD ─── */}
            {notiPermission !== 'granted' && 'Notification' in window && (
                <div
                    className="glass-card animate-fade-in"
                    style={{
                        padding: '1.25rem 1.5rem',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
                        border: '1px solid rgba(99, 102, 241, 0.15)',
                        cursor: 'pointer'
                    }}
                    onClick={requestNotiPermission}
                >
                    <div style={{
                        width: '44px', height: '44px', borderRadius: '0.75rem',
                        background: 'var(--primary)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <Bell size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.15rem' }}>
                            {language === 'en' ? 'Enable Notifications' : 'เปิดการแจ้งเตือน'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {language === 'en' ? 'Get alerted when your queue is approaching' : 'รับแจ้งเตือนเมื่อใกล้ถึงคิวของคุณ'}
                        </div>
                    </div>
                    <ChevronRight size={16} color="var(--primary)" />
                </div>
            )}

            {/* ─── MAIN TICKET CARD ─── */}
            <div className={`glass-card animate-fade-in ${pulseAnimation ? 'queue-pulse' : ''}`} style={{
                padding: '0', overflow: 'hidden', position: 'relative',
                border: isYourTurn || isNext ? `2px solid ${statusColor}` : undefined,
                boxShadow: isYourTurn ? `0 0 40px rgba(16, 185, 129, 0.15)` : isNext ? `0 0 30px rgba(245, 158, 11, 0.1)` : undefined
            }}>
                {/* Header Strip */}
                <div style={{
                    background: isYourTurn
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : isNext
                            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                            : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    padding: '1.5rem',
                    color: 'white',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Animated background dots */}
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                    <div style={{ position: 'relative', zIndex: 1 }}>
                        {isYourTurn ? (
                            <>
                                <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.8, marginBottom: '0.25rem' }}>
                                    {language === 'en' ? 'ATTENTION' : 'แจ้งเตือน'}
                                </div>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>
                                    {language === 'en' ? '🚨 IT\'S YOUR TURN!' : '🚨 ถึงคิวของคุณแล้ว!'}
                                </h1>
                            </>
                        ) : isNext ? (
                            <>
                                <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.8, marginBottom: '0.25rem' }}>
                                    {language === 'en' ? 'GET READY' : 'เตรียมตัว'}
                                </div>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>
                                    {language === 'en' ? '⚡ You Are Next!' : '⚡ คุณคือคิวถัดไป!'}
                                </h1>
                            </>
                        ) : (
                            <h1 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, opacity: 0.9 }}>
                                {language === 'en' ? 'YOUR QUEUE TICKET' : 'บัตรคิวของคุณ'}
                            </h1>
                        )}
                    </div>
                </div>

                <div style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.5rem' }}>{hospital.name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                        <MapPin size={16} /> {hospital.name}
                    </div>

                    {/* BIG QUEUE NUMBER */}
                    <div style={{
                        background: statusBg,
                        padding: '2rem',
                        borderRadius: '2rem',
                        marginBottom: '2rem',
                        border: `2px dashed ${statusColor}30`,
                        position: 'relative',
                        transition: 'all 0.5s ease'
                    }}>
                        <div style={{
                            textTransform: 'uppercase', fontSize: '0.875rem', fontWeight: '700',
                            color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.5rem'
                        }}>
                            {language === 'en' ? 'Queue Number' : 'หมายเลขคิว'}
                        </div>
                        <div style={{
                            fontSize: 'clamp(3rem, 15vw, 5rem)', fontWeight: '900', lineHeight: 1,
                            color: statusColor,
                            transition: 'color 0.5s ease'
                        }}>
                            #{activeQueue.queue_number}
                        </div>
                        {isYourTurn && (
                            <div className="badge badge-success animate-fade-in"
                                style={{
                                    position: 'absolute', top: '-12px', right: '-10px',
                                    transform: 'rotate(10deg)', padding: '0.4rem 0.75rem',
                                    fontSize: '0.75rem', fontWeight: '800',
                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                }}>
                                {language === 'en' ? '🎉 NOW!' : '🎉 ตอนนี้!'}
                            </div>
                        )}
                        {isNext && !isYourTurn && (
                            <div className="animate-fade-in"
                                style={{
                                    position: 'absolute', top: '-12px', right: '-10px',
                                    transform: 'rotate(10deg)', padding: '0.4rem 0.75rem',
                                    fontSize: '0.75rem', fontWeight: '800',
                                    background: '#f59e0b', color: 'white',
                                    borderRadius: '0.5rem',
                                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                                }}>
                                {language === 'en' ? '⚡ NEXT' : '⚡ ถัดไป!'}
                            </div>
                        )}
                    </div>

                    {/* Status Message for urgent states */}
                    {(isYourTurn || isNext) && (
                        <div className="animate-fade-in" style={{
                            background: isYourTurn
                                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.05))'
                                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(217, 119, 6, 0.05))',
                            border: `1px solid ${statusColor}20`,
                            padding: '1.25rem',
                            borderRadius: '1.25rem',
                            marginBottom: '2rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '0.75rem',
                                background: `${statusColor}15`, color: statusColor,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {isYourTurn ? <CheckCircle size={22} /> : <AlertCircle size={22} />}
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: '700', color: statusColor, fontSize: '0.95rem' }}>
                                    {isYourTurn
                                        ? (language === 'en' ? 'Please proceed now!' : 'กรุณาเข้าพบแพทย์ได้ทันที!')
                                        : (language === 'en' ? 'Get ready! You\'re almost up.' : 'เตรียมตัว! ใกล้ถึงคิวแล้ว')
                                    }
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                    {isYourTurn
                                        ? (language === 'en' ? 'Head to the counter immediately' : 'เดินไปที่เคาน์เตอร์ได้เลย')
                                        : (language === 'en' ? 'Stay near the waiting area' : 'กรุณาอยู่ใกล้ห้องรอ')
                                    }
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2.5rem' }}>
                        <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '1rem', borderRadius: '1rem' }}>
                            <div style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}><User size={24} /></div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-main)' }}>{peopleAhead}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{language === 'en' ? 'People Ahead' : 'คิวรอข้างหน้า'}</div>
                        </div>
                        <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '1rem' }}>
                            <div style={{ color: 'var(--success)', marginBottom: '0.5rem' }}><Clock size={24} /></div>
                            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-main)' }}>~{estWait}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{language === 'en' ? 'Mins Wait' : 'นาทีรอประมาณ'}</div>
                        </div>
                    </div>

                    {/* Notification Status Indicator */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        padding: '0.75rem 1rem', borderRadius: '1rem',
                        background: notiPermission === 'granted' ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.06)',
                        fontSize: '0.8rem', fontWeight: '600', marginBottom: '2rem',
                        color: notiPermission === 'granted' ? 'var(--success)' : '#d97706'
                    }}>
                        {notiPermission === 'granted' ? (
                            <>
                                <Volume2 size={14} />
                                {language === 'en' ? 'Notifications Active — We\'ll alert you when your turn approaches' : 'การแจ้งเตือนเปิดอยู่ — เราจะแจ้งเตือนเมื่อใกล้ถึงคิว'}
                            </>
                        ) : (
                            <>
                                <Bell size={14} />
                                <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={requestNotiPermission}>
                                    {language === 'en' ? 'Tap to enable queue alerts' : 'แตะเพื่อเปิดการแจ้งเตือนคิว'}
                                </span>
                            </>
                        )}
                    </div>

                    {/* QR Code for Staff */}
                    <div style={{ marginBottom: '2.5rem' }}>
                        <div style={{ background: 'white', padding: '1rem', display: 'inline-block', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=QUEUE:${activeQueue.id}`}
                                alt="Queue QR Code"
                                style={{ width: '150px', height: '150px' }}
                            />
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                            {language === 'en' ? 'Show this QR code to hospital staff' : 'แสดง QR Code นี้ให้เจ้าหน้าที่สแกน'}
                        </p>
                    </div>

                    {/* Actions */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                        <button
                            onClick={cancelBooking}
                            className="btn"
                            style={{
                                background: 'transparent',
                                color: '#ef4444',
                                border: '1px solid #ef4444',
                                width: '100%',
                                justifyContent: 'center'
                            }}
                        >
                            <Trash2 size={18} /> {language === 'en' ? 'Cancel Booking' : 'ยกเลิกการจอง'}
                        </button>
                        <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.75rem', opacity: 0.8 }}>
                            {language === 'en' ? 'Warning: Cancellation fee applies' : 'คำเตือน: หากยกเลิกอาจถูกหักคะแนนความน่าเชื่อถือ'}
                        </p>
                    </div>

                </div>
            </div>
            <style>{`
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes queuePulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                    50% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0.15); }
                }
                .queue-pulse {
                    animation: queuePulse 1.5s ease-in-out 3;
                }
            `}</style>
        </div>
    )
}
