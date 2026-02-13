import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Bell, BellOff, X, Volume2, Info } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

export default function NotificationManager({ session }) {
    const { language } = useLanguage()
    const [permission, setPermission] = useState('default')
    const [activeQueue, setActiveQueue] = useState(null)
    const [hospital, setHospital] = useState(null)
    const [showAlert, setShowAlert] = useState(false)
    const [alertData, setAlertData] = useState({ title: '', body: '' })
    const [isIOS, setIsIOS] = useState(false)
    const [showIOSInstruction, setShowIOSInstruction] = useState(false)
    const lastNotifiedDiff = useRef(null)

    useEffect(() => {
        const checkIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
        setIsIOS(checkIOS)

        // If iPhone and not in standalone mode (PWA), they might need instructions
        if (checkIOS && !window.navigator.standalone) {
            setShowIOSInstruction(true)
        }
        if ("Notification" in window) {
            setPermission(Notification.permission)
        }

        if (session) {
            fetchMyActiveQueue()

            const channel = supabase
                .channel('global-notifications')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => fetchMyActiveQueue())
                .on('postgres_changes', { event: '*', schema: 'public', table: 'hospitals' }, () => fetchMyActiveQueue())
                .subscribe()

            return () => supabase.removeChannel(channel)
        }
    }, [session])

    const fetchMyActiveQueue = async () => {
        if (!session) return

        const { data: queue } = await supabase
            .from('queues')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('status', 'waiting')
            .maybeSingle()

        if (queue) {
            setActiveQueue(queue)
            const { data: hosp } = await supabase.from('hospitals').select('*').eq('id', queue.hospital_id).single()
            if (hosp) {
                setHospital(hosp)
                checkNotificationThresholds(queue, hosp)
            }
        } else {
            setActiveQueue(null)
            setHospital(null)
        }
    }

    const checkNotificationThresholds = (queue, hosp) => {
        const diff = queue.queue_number - (hosp.current_queue || 0)

        if (diff > 0 && diff !== lastNotifiedDiff.current) {
            if (diff === 5 || diff === 3 || diff === 1) {
                const title = language === 'en' ? 'Queue Update' : 'อัปเดตสถานะคิว'
                const body = diff === 1
                    ? (language === 'en' ? `You are NEXT! Please go to ${hosp.name}` : `ถึงคิวคุณแล้ว! กรุณาไปที่ ${hosp.name}`)
                    : (language === 'en' ? `${diff} people ahead of you at ${hosp.name}` : `อีก ${diff} คิวจะถึงตาคุณที่ ${hosp.name}`)

                triggerNotification(title, body, diff === 1)
            }
            lastNotifiedDiff.current = diff
        }
    }

    const triggerNotification = (title, body, isUrgent = false) => {
        // 1. Browser Notification
        if (Notification.permission === "granted") {
            try {
                new Notification(title, { body, icon: '/vite.svg', tag: 'queue-update' })
            } catch (e) { console.error(e) }
        }

        // 2. Sound
        playNotificationSound(isUrgent ? 'urgent' : 'normal')

        // 3. In-App Alert (Modal/Banner)
        setAlertData({ title, body })
        setShowAlert(true)

        // 4. Vibration
        if (navigator.vibrate) navigator.vibrate(isUrgent ? [300, 100, 300, 100, 300] : [200, 100, 200])
    }

    const playNotificationSound = (type) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)

            if (type === 'urgent') {
                osc.type = 'square'
                osc.frequency.setValueAtTime(880, ctx.currentTime)
                osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5)
                gain.gain.setValueAtTime(0.1, ctx.currentTime)
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
                osc.start()
                osc.stop(ctx.currentTime + 0.5)
            } else {
                osc.type = 'sine'
                osc.frequency.setValueAtTime(523.25, ctx.currentTime)
                osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.2)
                gain.gain.setValueAtTime(0.1, ctx.currentTime)
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
                osc.start()
                osc.stop(ctx.currentTime + 0.4)
            }
        } catch (e) { console.error('Audio fail', e) }
    }

    const requestPermission = () => {
        if (!("Notification" in window)) {
            alert(language === 'en' ? 'Your browser does not support notifications' : 'เบราว์เซอร์ของคุณไม่รองรับการแจ้งเตือน')
            return
        }

        // Initialize audio on user gesture to bypass browser block
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext
            const audioCtx = new AudioContext()
            if (audioCtx.state === 'suspended') audioCtx.resume()
            playNotificationSound('normal')
        } catch (e) { }

        Notification.requestPermission().then(setPermission)
    }

    // Don't show permission banner if already decided or not logged in
    const showPermissionBanner = session && permission === 'default'

    return (
        <>
            {/* Permission Banner */}
            {showPermissionBanner && (
                <div style={{
                    position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
                    width: '90%', maxWidth: '500px', background: '#3b82f6', color: 'white',
                    padding: '1.25rem 1.5rem', borderRadius: '1.5rem', zIndex: 10000,
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    animation: 'slideUp 0.5s ease-out'
                }}>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.75rem', borderRadius: '1rem' }}>
                        <Bell size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '1rem' }}>
                            {language === 'en' ? 'Enable Notifications' : 'เปิดการแจ้งเตือน'}
                        </div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                            {language === 'en' ? 'Get notified when your queue is near.' : 'รับการแจ้งเตือนทันทีเมื่อใกล้ถึงคิวของคุณ'}
                        </div>
                    </div>
                    <button
                        onClick={requestPermission}
                        style={{ background: 'white', color: '#3b82f6', border: 'none', padding: '0.6rem 1rem', borderRadius: '0.75rem', fontWeight: '700', cursor: 'pointer', fontSize: '0.875rem' }}
                    >
                        {language === 'en' ? 'Allow' : 'อนุญาต'}
                    </button>
                    <button
                        onClick={() => setPermission('dismissed')}
                        style={{ background: 'transparent', color: 'white', border: 'none', cursor: 'pointer', opacity: 0.6 }}
                    >
                        <X size={20} />
                    </button>
                </div>
            )}

            {/* iOS Help Banner - Crucial for iPhone lock screen notifications */}
            {showIOSInstruction && session && (
                <div style={{
                    position: 'fixed', bottom: showPermissionBanner ? '8rem' : '1.5rem', left: '1.5rem', right: '1.5rem',
                    background: 'rgba(30, 41, 59, 0.95)', backdropFilter: 'blur(10px)',
                    color: 'white', padding: '1.25rem', borderRadius: '1.5rem', zIndex: 9999,
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    animation: 'fadeIn 0.5s ease'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ background: 'var(--primary)', padding: '0.4rem', borderRadius: '0.6rem' }}><Info size={18} /></div>
                            <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>
                                {language === 'en' ? 'Get Lock Screen Alerts' : 'รับการแจ้งเตือนที่หน้าจอหลัก'}
                            </span>
                        </div>
                        <button onClick={() => setShowIOSInstruction(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}><X size={18} /></button>
                    </div>
                    <p style={{ fontSize: '0.85rem', lineHeight: '1.5', margin: 0, color: 'rgba(255,255,255,0.8)', fontWeight: '500' }}>
                        {language === 'en'
                            ? 'To receive queue notifications on your iPhone lock screen: Tap the Share button, then select "Add to Home Screen".'
                            : 'เพื่อให้ iPhone แจ้งเตือนที่หน้าจอล็อกได้: กดปุ่ม "แชร์" (ตรงกลางล่าง) แล้วเลือก "เพิ่มไปยังหน้าจอโฮม" ครับ'}
                    </p>
                </div>
            )}

            {/* In-App Visual Alert (Urgent/Thresholds) */}
            {showAlert && (
                <div style={{
                    position: 'fixed', top: '1.5rem', left: '50%', transform: 'translateX(-50%)',
                    width: '90%', maxWidth: '400px', background: 'white', borderLeft: '6px solid #10b981',
                    padding: '1.25rem', borderRadius: '1.25rem', zIndex: 10001,
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    display: 'flex', gap: '1rem', alignItems: 'flex-start',
                    animation: 'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}>
                    <div style={{ background: '#ecfdf5', color: '#10b981', padding: '0.5rem', borderRadius: '0.75rem' }}>
                        <Volume2 size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1.125rem' }}>{alertData.title}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem', fontWeight: '500' }}>{alertData.body}</div>
                        <button
                            onClick={() => setShowAlert(false)}
                            style={{
                                marginTop: '1rem', width: '100%', padding: '0.6rem',
                                background: 'var(--bg-color)', border: 'none', borderRadius: '0.6rem',
                                fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer'
                            }}
                        >
                            {language === 'en' ? 'OK, I Got it' : 'รับทราบ'}
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideUp { from { transform: translate(-50%, 100%); } to { transform: translate(-50%, 0); } }
                @keyframes bounceIn { from { transform: translate(-50%, -100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
            `}</style>
        </>
    )
}
