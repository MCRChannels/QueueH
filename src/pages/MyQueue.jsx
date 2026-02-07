import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { Clock, MapPin, User, Calendar, Loader2, CheckCircle, AlertCircle, Trash2, ArrowRight } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { translations } from '../lib/translations'

export default function MyQueue() {
    const [loading, setLoading] = useState(true)
    const [activeQueue, setActiveQueue] = useState(null)
    const [hospital, setHospital] = useState(null)
    const [session, setSession] = useState(null)
    const { language } = useLanguage()
    const t = translations[language]

    // Notification Logic (copied from Home/Consult for consistency)
    const lastNotifiedQueueDiff = useRef(null)

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
        fetchMyQueue()

        // Realtime updates
        const channel = supabase
            .channel('my-queue-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, (payload) => {
                fetchMyQueue()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'hospitals' }, (payload) => {
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

            // Calculate diff for notification
            if (hosp) {
                const diff = queue.queue_number - (hosp.current_queue || 0)
                if (diff > 0 && diff !== lastNotifiedQueueDiff.current) {
                    if (diff <= 5 && diff % 2 !== 0) { // Notify at 5, 3, 1
                        sendQueueNotification(
                            language === 'en' ? 'Queue Update' : 'อัปเดตสถานะคิว',
                            language === 'en' ? `${diff} people ahead of you.` : `เหลืออีก ${diff} คิวจะถึงตาคุณ`
                        )
                    }
                    lastNotifiedQueueDiff.current = diff
                }
            }
        } else {
            setActiveQueue(null)
            setHospital(null)
        }
        setLoading(false)
    }

    const cancelBooking = async () => {
        if (!confirm(language === 'en' ? 'Are you sure you want to cancel?' : 'คุณแน่ใจว่าต้องการยกเลิกการจองหรือไม่?')) return

        try {
            await supabase.from('queues').update({ status: 'cancelled', cancel_reason: 'User Cancelled via MyQ' }).eq('id', activeQueue.id)
            // Penalty logic could be added here similar to Home.jsx
            alert(language === 'en' ? 'Booking Cancelled' : 'ยกเลิกการจองสำเร็จ')
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
    // Round to nearest 5 mins
    const estWait = peopleAhead > 0 ? Math.ceil(rawTime / 5) * 5 : 0

    return (
        <div className="container section-spacing" style={{ maxWidth: '600px' }}>
            <div className="glass-card animate-fade-in" style={{ padding: '0', overflow: 'hidden', position: 'relative' }}>
                {/* Header Strip */}
                <div style={{ background: peopleAhead <= 1 ? 'var(--success)' : 'var(--primary)', padding: '1.5rem', color: 'white', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, opacity: 0.9 }}>{language === 'en' ? 'YOUR QUEUE TICKET' : 'บัตรคิวของคุณ'}</h1>
                </div>

                <div style={{ padding: '2.5rem 2rem', textAlign: 'center' }}>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.5rem' }}>{hospital.name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                        <MapPin size={16} /> 2nd Floor, Building A
                    </div>

                    {/* BIG QUEUE NUMBER */}
                    <div style={{
                        background: 'var(--bg-color)',
                        padding: '2rem',
                        borderRadius: '2rem',
                        marginBottom: '2rem',
                        border: '2px dashed var(--border-color)',
                        position: 'relative'
                    }}>
                        <div style={{ textTransform: 'uppercase', fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                            {language === 'en' ? 'Queue Number' : 'หมายเลขคิว'}
                        </div>
                        <div style={{ fontSize: 'clamp(3rem, 15vw, 5rem)', fontWeight: '900', lineHeight: 1, color: peopleAhead <= 1 ? 'var(--success)' : 'var(--primary)' }}>
                            #{activeQueue.queue_number}
                        </div>
                        {peopleAhead <= 1 && (
                            <div className="badge badge-success" style={{ position: 'absolute', top: '-10px', right: '-10px', transform: 'rotate(10deg)' }}>
                                {language === 'en' ? 'You are Next!' : 'ถึงคิวแล้ว!'}
                            </div>
                        )}
                    </div>

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
            `}</style>
        </div>
    )
}
