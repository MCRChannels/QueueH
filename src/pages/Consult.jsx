
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Peer } from 'peerjs'
import { Video, VideoOff, Mic, MicOff, PhoneOff, RefreshCw, XCircle, Trash2, CheckCircle, UserCheck, ChevronRight, Loader2, Hospital, AlertCircle, Clock, Stethoscope } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { translations } from '../lib/translations'

export default function Consult() {
    const [session, setSession] = useState(null)
    const [profile, setProfile] = useState(null)
    const { language } = useLanguage()
    const t = translations[language]

    // Notification Sound (Simple "Glass" Ping - Base64)
    const playNotificationSound = () => {
        try {
            // Short simplified beep
            const ctx = new (window.AudioContext || window.webkitAudioContext)()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.type = 'sine'
            osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
            osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.1) // Slide up
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

    // Logic
    const [doctorsOnlineCount, setDoctorsOnlineCount] = useState(0)
    const [isDoctorOnline, setIsDoctorOnline] = useState(false)
    const [incomingPatients, setIncomingPatients] = useState([])
    const [activeConsultation, setActiveConsultation] = useState(null)

    // Call State
    const [myPeerId, setMyPeerId] = useState(null)
    const [remoteStream, setRemoteStream] = useState(null)
    const [callStatus, setCallStatus] = useState('idle')
    const [isLocalAudioOnly, setIsLocalAudioOnly] = useState(false)
    const [isRemoteAudioOnly, setIsRemoteAudioOnly] = useState(false)
    const [isAudioEnabled, setIsAudioEnabled] = useState(true)

    const [isVideoEnabled, setIsVideoEnabled] = useState(true)
    const [prescriptionStatus, setPrescriptionStatus] = useState('pending')

    // Refs
    const peerRef = useRef(null)
    const callRef = useRef(null)
    const localStreamRef = useRef(null)
    const myVideoRef = useRef()
    const remoteVideoRef = useRef()

    // Prescription
    const [medicines, setMedicines] = useState([])
    const [summaryText, setSummaryText] = useState('')
    const [deliveryFee] = useState(50)

    // Notification State
    const lastNotifiedPosition = useRef(null)

    // UI State
    const [showMedicalPanel, setShowMedicalPanel] = useState(window.innerWidth > 768)

    // Stream Handling Effect
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream
            remoteVideoRef.current.muted = false // IMPORTANT: Ensure not muted
            remoteVideoRef.current.volume = 1.0
            remoteVideoRef.current.play().catch(e => console.error('Error auto-playing video:', e))
        }
    }, [remoteStream, callStatus])

    // -- INIT --
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            if (session) {
                fetchProfile(session.user.id)
            }
        })

        if (!peerRef.current) {
            const peer = new Peer({
                config: {
                    iceServers: [
                        { urls: "stun:stun.relay.metered.ca:80" },
                        {
                            urls: "turn:global.relay.metered.ca:80",
                            username: "39da8a42505447326d3d41f8",
                            credential: "lbO4fkpwjUvsjBhp",
                        },
                        {
                            urls: "turn:global.relay.metered.ca:80?transport=tcp",
                            username: "39da8a42505447326d3d41f8",
                            credential: "lbO4fkpwjUvsjBhp",
                        },
                        {
                            urls: "turn:global.relay.metered.ca:443",
                            username: "39da8a42505447326d3d41f8",
                            credential: "lbO4fkpwjUvsjBhp",
                        },
                        {
                            urls: "turns:global.relay.metered.ca:443?transport=tcp",
                            username: "39da8a42505447326d3d41f8",
                            credential: "lbO4fkpwjUvsjBhp",
                        },
                    ]
                }
            })
            peerRef.current = peer

            peer.on('open', (id) => {
                console.log('My Peer ID:', id)
                setMyPeerId(id)
            })

            peer.on('error', (err) => {
                console.error('PeerJS Error:', err)
                // Don't alert on 'peer-unavailable' as it might be temporary
                if (err.type === 'peer-unavailable') {
                    // Retry logic or just ignore
                } else {
                    console.warn('Peer connection error:', err.type)
                }
            })

            peer.on('call', async (call) => {
                setCallStatus('connecting')

                try {
                    const stream = await getMediaStream()
                    localStreamRef.current = stream
                    setIsLocalAudioOnly(stream.getVideoTracks().length === 0)
                    if (myVideoRef.current) myVideoRef.current.srcObject = stream

                    call.answer(stream)
                    callRef.current = call

                    call.on('stream', (remoteStream) => {
                        console.log('Received remote stream (Incoming Call)')
                        // Explicitly enable audio tracks just in case
                        remoteStream.getAudioTracks().forEach(track => track.enabled = true)

                        window.lastCallStarted = Date.now()
                        setCallStatus('connected')
                        setRemoteStream(remoteStream)
                        setIsRemoteAudioOnly(remoteStream.getVideoTracks().length === 0)
                    })

                    call.on('close', () => {
                        console.log('Call closed by remote')
                        endCall(false) // Not intentional from this side
                    })

                    call.on('error', (e) => {
                        console.error('Call error:', e)
                        // Don't auto-end on minor errors
                    })

                } catch (err) {
                    console.error('Media Error', err)
                    let msg = language === 'en' ? 'Could not access Camera/Mic.' : 'ไม่สามารถเข้าถึงกล้องหรือไมโครโฟนได้'
                    if (err.name === 'NotAllowedError') msg = language === 'en' ? 'Permission denied. Please allow access in browser settings.' : 'การเข้าถึงถูกปฏิเสธ กรุณาอนุญาตการเข้าถึงในตั้งค่าเบราว์เซอร์'
                    alert(`${msg}\n(${err.name})`)
                    setCallStatus('idle')
                }
            })

            peer.on('disconnected', () => {
                console.warn('Peer disconnected. Attempting reconnect...')
                if (peerRef.current && !peerRef.current.destroyed) {
                    peerRef.current.reconnect()
                }
            })

        }

        return () => {
            if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop())
            if (callRef.current) callRef.current.close()
            if (peerRef.current) peerRef.current.destroy()
            peerRef.current = null
        }
    }, [])

    // -- REALTIME --
    const fetchIncomingPatients = useCallback(async () => {
        const { data, error } = await supabase.from('consultations')
            .select('*, profiles:patient_id(first_name, last_name)')
            .eq('status', 'waiting')
            .order('created_at', { ascending: true })

        if (!error) {
            // Filter out unique patients (one request per patient) just in case
            setIncomingPatients(data || [])
        }
    }, [])

    useEffect(() => {
        if (!session) return

        const channel = supabase.channel('consultation_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'consultations' }, (payload) => {
                // Optimization for Patient: If MY consultation changed, update my state
                if (activeConsultation && payload.new && payload.new.id === activeConsultation.id) {
                    if (payload.new.status === 'in_progress') {
                        // Accepted! PeerJS handle the rest
                    }
                }

                // For Doctor/Admin: Always refresh list
                fetchIncomingPatients()
            })
            .subscribe()

        // POLLING FALLBACK: Refresh queue every 10 seconds for doctors
        let interval;
        if (profile?.role === 'doctor_online' || profile?.role === 'admin') {
            interval = setInterval(() => {
                fetchIncomingPatients()
            }, 10000)
        }

        return () => {
            supabase.removeChannel(channel)
            if (interval) clearInterval(interval)
        }
    }, [session, profile, fetchIncomingPatients, activeConsultation])

    // -- PROFILE & RESTORE STATE --
    useEffect(() => {
        if (!profile) return

        if (profile.role === 'patient') {
            checkDoctorsOnline()

            // Request Notification Permission early
            if ("Notification" in window && Notification.permission === 'default') {
                Notification.requestPermission()
            }

            // Restore State: Check if I'm already waiting or have a pending summary
            const checkExisting = async () => {
                // 1. Check Waiting
                const { data: waiting } = await supabase.from('consultations')
                    .select('*')
                    .eq('patient_id', session.user.id)
                    .eq('status', 'waiting')
                    .maybeSingle()

                if (waiting) {
                    console.log('Restored waiting session')
                    setActiveConsultation(waiting)
                    setCallStatus('waiting')
                    return
                }

                // 2. Check Unpaid Summary (Completed but Prescription Pending/Confirmed)
                // We fetch the most recent completed one
                const { data: recent } = await supabase.from('consultations')
                    .select('*, prescriptions(*)')
                    .eq('patient_id', session.user.id)
                    .eq('status', 'completed')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (recent) {
                    // Check if prescription exists and status
                    if (recent.prescriptions && recent.prescriptions.length > 0) {
                        const pres = recent.prescriptions[0]
                        // If pending or just paid today (so they can see success), restore summary
                        const isRecent = new Date() - new Date(recent.updated_at) < 24 * 60 * 60 * 1000 // 24 hours
                        if (isRecent) {
                            console.log('Restored summary session')
                            setActiveConsultation(recent)
                            setCallStatus('summary')
                            // Pre-load description status
                            setPrescriptionStatus(pres.status)
                            setMedicines(pres.medicines || [])
                        }
                    }
                }
            }
            checkExisting()

            const sub = supabase.channel('doctors_status_sync')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
                    console.log('Realtime Profile Update:', payload)
                    checkDoctorsOnline()
                })
                .subscribe((status) => {
                    console.log('Doctor Status Realtime Status:', status)
                })

            // POLLING FALLBACK: Refresh doctors count every 15 seconds
            const interval = setInterval(() => {
                checkDoctorsOnline()
            }, 15000)

            return () => {
                supabase.removeChannel(sub)
                clearInterval(interval)
            }
        }

        if (profile.role === 'doctor_online' || profile.role === 'admin') {
            setIsDoctorOnline(profile.is_online)
            fetchIncomingPatients()
        }
    }, [profile])


    // -- QUEUE NOTIFICATION LOGIC --
    useEffect(() => {
        // Only for patients who are waiting
        if (profile?.role === 'patient' && callStatus === 'waiting' && incomingPatients.length > 0) {
            const myIndex = incomingPatients.findIndex(p => p.patient_id === session.user.id)

            if (myIndex !== -1) {
                const queuePosition = myIndex + 1 // 1st, 2nd, 3rd...

                // If position changed significantly or is critical
                if (queuePosition !== lastNotifiedPosition.current) {

                    // Logic: Notify at 5, 3, and 1
                    if (queuePosition === 1) {
                        sendQueueNotification(
                            language === 'en' ? 'You are Next!' : 'คุณคือคิวถัดไป!',
                            language === 'en' ? 'Please stay on this page and prepare for your consultation.' : 'กรุณารอที่หน้านี้และเตรียมตัวสำหรับการปรึกษา'
                        )
                    } else if (queuePosition === 3) {
                        sendQueueNotification(
                            language === 'en' ? '3 Queues Remaining' : 'อีก 3 คิวจะถึงตาคุณ',
                            language === 'en' ? 'Get ready, your turn is coming up soon.' : 'เตรียมตัวไว้นะครับ ใกล้ถึงคิวแล้ว'
                        )
                    } else if (queuePosition === 5) {
                        sendQueueNotification(
                            language === 'en' ? '5 Queues Remaining' : 'อีก 5 คิวจะถึงตาคุณ',
                            language === 'en' ? 'We will notify you when you are closer.' : 'เราจะแจ้งเตือนเมื่อใกล้ถึงคิว'
                        )
                    }

                    lastNotifiedPosition.current = queuePosition
                }
            }
        }
    }, [incomingPatients, callStatus, profile, session, language])

    // Sync Prescription on Summary
    useEffect(() => {
        if (callStatus === 'summary' && activeConsultation) {
            fetchPrescriptionDetails()
        }
    }, [callStatus, activeConsultation])

    // Auto-init medicines for doctor
    useEffect(() => {
        if ((profile?.role === 'doctor_online' || profile?.role === 'admin') && medicines.length === 0) {
            setMedicines([{ name: '', quantity: '', price: 0 }])
        }
    }, [profile, medicines])

    const fetchPrescriptionDetails = async () => {
        if (!activeConsultation) return

        console.log('Fetching prescription for:', activeConsultation.id)
        const { data, error } = await supabase.from('prescriptions').select('*').eq('consultation_id', activeConsultation.id).maybeSingle()

        if (error) {
            console.error('Error fetching prescription:', error)
            alert('Could not load prescription: ' + error.message)
        } else if (data) {
            console.log('Prescription loaded:', data)
            setMedicines(data.medicines || [])
            setPrescriptionStatus(data.status || 'pending')
        } else {
            console.warn('No prescription found for this consultation.')
        }
    }


    const getMediaStream = async () => {
        // Ensure any previous tracks are stopped to free up the device
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop())
        }

        try {
            return await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        } catch (err) {
            console.warn('Media access error:', err.name, err.message)

            // Fallback: If camera is messed up/busy, try audio only
            if (err.name === 'NotReadableError' || err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
                console.warn('Video failed, trying audio only')
                try {
                    return await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
                } catch (audioErr) {
                    if (audioErr.name === 'NotReadableError') {
                        alert(language === 'en' ? 'Camera/Mic is being used by another app. Please close other apps and try again.' : 'กล้องหรือไมโครโฟนถูกใช้งานโดยแอปอื่น กรุณาปิดแอปอื่นแล้วลองใหม่')
                    }
                    throw audioErr
                }
            }
            throw err
        }
    }

    const fetchProfile = async (userId) => {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
        if (data) setProfile(data)
    }

    const checkDoctorsOnline = async () => {
        const { count } = await supabase.from('profiles')
            .select('*', { count: 'exact', head: true })
            .in('role', ['doctor_online', 'admin'])
            .eq('is_online', true)
        setDoctorsOnlineCount(count || 0)
    }

    // -- ACTIONS --
    const startConsultationRequest = async () => {
        if (!myPeerId) return alert('Connecting to server... please wait.')

        // Auto-Cleanup: Cancel any old requests first
        await supabase.from('consultations')
            .update({ status: 'cancelled' })
            .eq('patient_id', session.user.id)
            .eq('status', 'waiting')

        const { data, error } = await supabase.from('consultations').insert({
            patient_id: session.user.id,
            status: 'waiting',
            peer_id: myPeerId
        }).select().single()

        if (error) {
            alert('Error: ' + error.message)
        } else {
            setActiveConsultation(data)
            setCallStatus('waiting')
        }
    }

    const cancelConsultation = async () => {
        if (!activeConsultation) return

        await supabase.from('consultations')
            .update({ status: 'cancelled' })
            .eq('id', activeConsultation.id)

        setActiveConsultation(null)
        setCallStatus('idle')
    }

    const toggleOnlineStatus = async () => {
        const nextStatus = !isDoctorOnline
        await supabase.from('profiles').update({ is_online: nextStatus }).eq('id', session.user.id)
        setIsDoctorOnline(nextStatus)
    }

    const clearAllWaiting = async () => {
        if (!confirm('Are you sure you want to PERMANENTLY delete all waiting list items?')) return
        try {
            // Bulk DELETE is cleaner for this "Reset" button
            const { error, count } = await supabase.from('consultations')
                .delete({ count: 'exact' })
                .eq('status', 'waiting')

            if (error) {
                console.error(error)
                alert(language === 'en' ? 'Error clearing queue: ' + error.message : 'เกิดข้อผิดพลาดในการล้างคิว: ' + error.message)
            } else {
                alert(language === 'en' ? `Successfully deleted ${count ?? 'all'} waiting patients.` : `ลบคิวผู้ป่วย ${count ?? 'ทั้งหมด'} เรียบร้อยแล้ว`)
                fetchIncomingPatients()
            }
        } catch (err) {
            console.error(err)
            alert('Crash: ' + err.message)
        }
    }

    const callPatient = async (consultation) => {
        if (!peerRef.current) return alert('Telehealth server not connected')

        try {
            setCallStatus('connecting')
            const stream = await getMediaStream()

            // Safety Check: Component might have unmounted or peer destroyed during await
            if (!peerRef.current) {
                console.warn('Peer connection closed during media setup')
                return
            }

            localStreamRef.current = stream
            setIsLocalAudioOnly(stream.getVideoTracks().length === 0)

            if (myVideoRef.current) myVideoRef.current.srcObject = stream

            const call = peerRef.current.call(consultation.peer_id, stream)
            callRef.current = call
            setActiveConsultation(consultation)

            call.on('stream', (remoteStream) => {
                console.log('Received remote stream (Outgoing Call)')
                // FIX: Ensure audio is enabled
                remoteStream.getAudioTracks().forEach(track => {
                    track.enabled = true
                })

                window.lastCallStarted = Date.now()
                setCallStatus('connected')
                setRemoteStream(remoteStream)
                setIsRemoteAudioOnly(remoteStream.getVideoTracks().length === 0)
            })

            call.on('close', () => endCall(false))

            await supabase.from('consultations').update({
                status: 'in_progress',
                doctor_id: session.user.id
            }).eq('id', consultation.id)

        } catch (err) {
            console.error(err)
            let msg = 'Error: ' + err.message
            if (err.name === 'NotAllowedError') msg = 'Permission denied. Please allow access in browser settings.'
            if (err.name === 'NotFoundError') msg = 'No camera/microphone found.'
            if (err.name === 'NotReadableError') msg = 'Camera is in use by another app (or the other tab). Please close other instances.'

            alert(`${msg}\n(${err.name})`)
            setCallStatus('idle')
        }

    }

    // Media Controls
    const toggleAudio = () => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getAudioTracks()[0]
            if (track) {
                track.enabled = !isAudioEnabled
                setIsAudioEnabled(!isAudioEnabled)
            }
        }
    }

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const track = localStreamRef.current.getVideoTracks()[0]
            if (track) {
                track.enabled = !isVideoEnabled
                setIsVideoEnabled(!isVideoEnabled)
            }
        }
    }

    const endCall = async (isIntentional = true) => {
        const callDuration = (Date.now() - (window.lastCallStarted || Date.now())) / 1000

        if (callRef.current) callRef.current.close()
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(track => track.stop())

        callRef.current = null
        localStreamRef.current = null
        setRemoteStream(null)

        // logic: If call was super short (< 5s) and NOT intentional (e.g. error/drop), 
        // don't go to summary. Just go back to idle/waiting to let them retry.
        if (!isIntentional && callDuration < 5) {
            console.warn('Call dropped prematurely. Resetting to waiting/idle.')
            setCallStatus('idle') // Or 'waiting' if we want to auto-rejoin?
            return
        }

        setCallStatus('summary')

        if ((profile?.role === 'doctor_online' || profile?.role === 'admin') && activeConsultation) {
            await supabase.from('consultations').update({ status: 'completed' }).eq('id', activeConsultation.id)
        }
    }

    const submitPrescription = async () => {
        const total = medicines.reduce((sum, m) => sum + (Number(m.price) || 0), 0) + deliveryFee

        // Upsert prescription
        const { data: existing } = await supabase.from('prescriptions').select('id').eq('consultation_id', activeConsultation.id).maybeSingle()

        if (existing) {
            await supabase.from('prescriptions').update({
                medicines: medicines,
                total_cost: total,
                status: 'pending'
            }).eq('id', existing.id)
        } else {
            await supabase.from('prescriptions').insert({
                consultation_id: activeConsultation.id,
                medicines: medicines,
                delivery_fee: deliveryFee,
                total_cost: total,
                status: 'pending'
            })
        }

        await supabase.from('consultations').update({ summary: summaryText }).eq('id', activeConsultation.id)
        alert(language === 'en' ? 'Prescription/Notes Saved!' : 'บันทึกรายการยาและบันทึกเรียบร้อยแล้ว!')
    }

    const confirmPayment = async () => {
        if (!activeConsultation) {
            alert('Error: No active consultation found. Please refresh.')
            return
        }

        try {
            const { data: pres } = await supabase.from('prescriptions').select('*').eq('consultation_id', activeConsultation.id).single()

            if (pres) {
                const { error } = await supabase.from('prescriptions').update({ status: 'confirmed_payment' }).eq('id', pres.id)
                if (error) throw error

                setPrescriptionStatus('confirmed_payment')
                alert('Payment Confirmed! Redirecting to main menu...')

                // Auto-redirect after 2 seconds
                setTimeout(() => {
                    setActiveConsultation(null)
                    setCallStatus('idle')
                }, 2000)

            } else {
                alert('No prescription found to confirm.')
            }
        } catch (err) {
            console.error('Payment Error:', err)
            alert('Payment Confirmation Failed: ' + err.message)
        }
    }

    // Same UI Renders ...
    const addMedicine = () => setMedicines([...medicines, { name: '', quantity: '', price: 0 }])
    const updateMed = (i, f, v) => { const m = [...medicines]; m[i][f] = v; setMedicines(m) }
    // --- UI RENDERING ---
    if (!profile) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <Loader2 className="spinner" size={40} color="var(--primary)" />
        </div>
    )

    // 1. VIDEO ROOM UI
    if (callStatus === 'connected' || callStatus === 'connecting') {
        const isDoctor = profile.role === 'doctor_online' || profile.role === 'admin'
        // Increase threshold slightly for iPad or rely on touch capability, 
        // but for now keeping 768. iPad Mini is 768+. 
        // Issue on iPad might be "Desktop" view having buttons sink.
        const isMobile = window.innerWidth <= 768

        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh', // Fallback
                height: '100dvh', // Modern mobile browsers
                background: '#0f172a',
                zIndex: 9999,
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row'
            }}>
                {/* Main Content Area (Video) */}
                <div style={{
                    flex: 1,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    overflow: 'hidden'
                }}>

                    {/* Remote Video Container */}
                    <div style={{
                        flex: 1,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        background: '#000'
                    }}>
                        {callStatus === 'connecting' && (
                            <div className="glass animate-fade-in" style={{ position: 'absolute', zIndex: 10, color: 'white', padding: '1rem 2rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Loader2 className="spinner" size={20} />
                                <span style={{ fontWeight: '600' }}>Establishing Connection...</span>
                            </div>
                        )}

                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />

                        {/* Manual Play Button for iOS if stubborn */}
                        <div style={{ position: 'absolute', bottom: '150px', left: '50%', transform: 'translateX(-50%)', zIndex: 50, pointerEvents: 'none', opacity: 0 }}>
                            {/* Hidden unless needed logic added later, keeping structure clean */}
                        </div>

                        {/* Self View (Pip) */}
                        <div style={{
                            position: 'absolute',
                            top: isMobile ? '1rem' : '2rem',
                            right: isMobile ? '1rem' : '2rem',
                            width: isMobile ? '100px' : '240px',
                            height: isMobile ? '75px' : '180px',
                            borderRadius: '1rem',
                            border: '1.5px solid rgba(255,255,255,0.2)',
                            overflow: 'hidden',
                            background: '#334155',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                            zIndex: 20,
                            transition: 'all 0.3s ease'
                        }}>
                            <video ref={myVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                        </div>
                    </div>

                    {/* CONTROLS */}

                    {/* Mobile Controls: Centered Floating Island */}
                    {isMobile && (
                        <div style={{
                            position: 'fixed',
                            bottom: '2rem',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            gap: '1.5rem',
                            zIndex: 100,
                            padding: '12px 24px',
                            paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', // Safe Area Logic
                            borderRadius: '50px',
                            background: 'rgba(15, 23, 42, 0.7)',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                            alignItems: 'center'
                        }}>
                            <button onClick={toggleAudio} className={`btn-circle ${isAudioEnabled ? '' : 'btn-danger'}`} style={{
                                width: '50px', height: '50px', borderRadius: '50%',
                                background: isAudioEnabled ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.9)',
                                border: isAudioEnabled ? '1px solid rgba(59, 130, 246, 0.5)' : 'none',
                                color: isAudioEnabled ? 'white' : 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s ease'
                            }}>
                                {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                            </button>

                            <button onClick={endCall} style={{
                                width: '60px', height: '60px', borderRadius: '50%',
                                background: '#ef4444',
                                border: '4px solid rgba(239, 68, 68, 0.3)',
                                color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                            }}>
                                <PhoneOff size={28} fill="white" />
                            </button>

                            {isDoctor && !showMedicalPanel && (
                                <button onClick={() => setShowMedicalPanel(true)} style={{
                                    width: '50px', height: '50px', borderRadius: '50%',
                                    background: 'white',
                                    border: 'none',
                                    color: 'var(--primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}>
                                    <Stethoscope size={24} />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Desktop/Tablet Controls: Integrated Bar with Safe Area */}
                    {!isMobile && (
                        <div style={{
                            position: 'fixed',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            padding: '1.5rem',
                            paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))', // Safe Area Logic
                            background: 'linear-gradient(to top, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.6) 60%, transparent 100%)',
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '1.5rem',
                            zIndex: 30,
                            pointerEvents: 'none' // Allow clicks mostly to pass through, but catch on buttons
                        }}>
                            <div style={{ pointerEvents: 'auto', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                <button onClick={toggleAudio} className={`btn-circle ${isAudioEnabled ? '' : 'btn-danger'}`} style={{
                                    width: '56px', height: '56px', borderRadius: '50%',
                                    background: isAudioEnabled ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.9)',
                                    border: isAudioEnabled ? '1px solid rgba(59, 130, 246, 0.5)' : 'none',
                                    color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backdropFilter: 'blur(5px)'
                                }}>
                                    {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                                </button>

                                <button onClick={toggleVideo} className={`btn-circle ${isVideoEnabled ? '' : 'btn-danger'}`} style={{
                                    width: '56px', height: '56px', borderRadius: '50%',
                                    background: isVideoEnabled ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.9)',
                                    border: isVideoEnabled ? '1px solid rgba(59, 130, 246, 0.5)' : 'none',
                                    color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backdropFilter: 'blur(5px)'
                                }}>
                                    {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
                                </button>

                                <button onClick={endCall} style={{
                                    width: '72px', height: '72px', borderRadius: '50%',
                                    background: '#ef4444',
                                    border: '4px solid rgba(239, 68, 68, 0.3)',
                                    color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 8px 20px rgba(239, 68, 68, 0.4)',
                                    transform: 'translateY(-4px)'
                                }}>
                                    <PhoneOff size={32} fill="white" />
                                </button>

                                {isDoctor && (
                                    <button onClick={() => setShowMedicalPanel(!showMedicalPanel)} style={{
                                        width: '56px', height: '56px', borderRadius: '50%',
                                        background: showMedicalPanel ? 'white' : 'rgba(255,255,255,0.15)',
                                        border: 'none',
                                        color: showMedicalPanel ? 'var(--primary)' : 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        backdropFilter: 'blur(5px)'
                                    }}>
                                        <Stethoscope size={24} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Doctor Sidebar - Professional Medical Notes */}
                {isDoctor && showMedicalPanel && (
                    <div className="animate-fade-in" style={{
                        width: isMobile ? '100%' : '400px',
                        height: isMobile ? '65%' : '100%',
                        background: 'white',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: 'auto',
                        borderLeft: !isMobile ? '1px solid var(--border-color)' : 'none',
                        borderTop: isMobile ? '4px solid var(--primary)' : 'none',
                        zIndex: 40,
                        position: isMobile ? 'fixed' : 'relative',
                        bottom: isMobile ? 0 : 'auto',
                        left: isMobile ? 0 : 'auto',
                        boxShadow: isMobile ? '0 -4px 20px rgba(0,0,0,0.1)' : 'none'
                    }}>
                        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>{t.consult.writeSummary}</h3>
                            {isMobile && (
                                <button onClick={() => setShowMedicalPanel(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <ChevronRight size={20} style={{ transform: 'rotate(90deg)', color: 'var(--text-muted)' }} />
                                </button>
                            )}
                        </div>

                        <textarea
                            className="input"
                            rows={4}
                            placeholder="Symptoms, Diagnosis, and Treatment Plan..."
                            value={summaryText}
                            onChange={e => setSummaryText(e.target.value)}
                            style={{ margin: '0 0 1.5rem 0', borderRadius: '1rem', padding: '1rem' }}
                        />

                        <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1rem' }}>Prescribe Medications</h3>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
                            {medicines.map((m, i) => (
                                <div key={i} className="glass-card" style={{ padding: '1rem', border: '1px solid var(--border-color)' }}>
                                    <input className="input" placeholder="Medication Name" value={m.name} onChange={e => updateMed(i, 'name', e.target.value)} style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }} />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                        <input className="input" placeholder="Qty" value={m.quantity} onChange={e => updateMed(i, 'quantity', e.target.value)} style={{ fontSize: '0.9rem' }} />
                                        <input className="input" type="number" placeholder="Price" value={m.price} onChange={e => updateMed(i, 'price', e.target.value)} style={{ fontSize: '0.9rem' }} />
                                    </div>
                                    <button onClick={() => setMedicines(medicines.filter((_, idx) => idx !== i))} style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none', background: 'none', padding: '0.5rem 0', cursor: 'pointer', marginTop: '0.25rem' }}>
                                        <Trash2 size={12} style={{ marginRight: '4px' }} /> {language === 'en' ? 'Remove' : 'ลบ'}
                                    </button>
                                </div>
                            ))}
                            <button className="btn btn-outline" style={{ width: '100%', borderRadius: '1rem' }} onClick={() => setMedicines([...medicines, { name: '', quantity: '', price: 0 }])}>
                                + {t.consult.addPrescription}
                            </button>
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                            <button className="btn btn-primary" style={{ width: '100%', padding: '1rem' }} onClick={submitPrescription}>
                                {t.consult.saveRecord}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // 2. CONSULTATION SUMMARY UI
    if (callStatus === 'summary') {
        const total = medicines.reduce((sum, m) => sum + (Number(m.price) || 0), 0) + deliveryFee

        if (profile.role === 'doctor_online' || profile.role === 'admin') {
            return (
                <div className="container section-spacing" style={{ textAlign: 'center' }}>
                    <div className="glass-card animate-fade-in" style={{ maxWidth: '500px', margin: '0 auto', padding: '4rem 2rem' }}>
                        <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '1.5rem', borderRadius: '2rem', display: 'inline-flex', marginBottom: '2rem' }}>
                            <CheckCircle size={48} />
                        </div>
                        <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1rem' }}>{language === 'en' ? 'Consultation Finished' : 'สิ้นสุดการปรึกษา'}</h2>
                        <p className="text-muted" style={{ marginBottom: '2.5rem' }}>{language === 'en' ? 'Your reports and prescriptions have been synced successfully.' : 'บันทึกรายงานและการสั่งยาของคุณเรียบร้อยแล้ว'}</p>
                        <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setActiveConsultation(null); setCallStatus('idle'); fetchIncomingPatients(); }}>
                            {language === 'en' ? 'Return to Dashboard' : 'กลับสู่แผงควบคุม'}
                        </button>
                    </div>
                </div>
            )
        }

        return (
            <div className="container section-spacing" style={{ maxWidth: '800px' }}>
                <div className="glass-card animate-fade-in" style={{ padding: '3rem' }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                        <h2 style={{ fontSize: '2.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>{language === 'en' ? 'Consultation Report' : 'รายงานการตรวจรักษา'}</h2>
                        <p className="text-muted">{language === 'en' ? 'Review your medical summary and prescription' : 'ตรวจสอบผลการตรวจและรายการยาของคุณ'}</p>
                    </div>

                    {summaryText && (
                        <div style={{ marginBottom: '3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                <div style={{ width: '32px', height: '32px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <UserCheck size={18} />
                                </div>
                                <h4 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>Doctor's Observations</h4>
                            </div>
                            <div style={{ background: 'var(--bg-color)', padding: '1.75rem', borderRadius: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
                                <p style={{ lineHeight: '1.6', fontSize: '1.05rem', color: 'var(--text-main)' }}>{summaryText}</p>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h4 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>Integrated Prescription</h4>
                        <button onClick={fetchPrescriptionDetails} className="btn-outline" style={{ padding: '0.5rem', borderRadius: '0.75rem' }}>
                            <RefreshCw size={16} />
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', marginBottom: '2rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                    <th style={{ textAlign: 'left', padding: '1rem' }}>MEDICATION / ITEM</th>
                                    <th style={{ textAlign: 'center', padding: '1rem' }}>QTY</th>
                                    <th style={{ textAlign: 'right', padding: '1rem' }}>PRICE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {medicines.map((m, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--bg-color)' }}>
                                        <td style={{ padding: '1.25rem', fontWeight: '600' }}>{m.name || 'Universal Charge'}</td>
                                        <td style={{ textAlign: 'center', padding: '1.25rem' }}>{m.quantity}</td>
                                        <td style={{ textAlign: 'right', padding: '1.25rem', fontWeight: '600' }}>{m.price}฿</td>
                                    </tr>
                                ))}
                                <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                                    <td colSpan={2} style={{ padding: '1.25rem', textAlign: 'right', color: 'var(--text-muted)' }}>Delivery Fee</td>
                                    <td style={{ padding: '1.25rem', textAlign: 'right' }}>{deliveryFee}฿</td>
                                </tr>
                                <tr style={{ fontSize: '1.5rem', fontWeight: '800' }}>
                                    <td colSpan={2} style={{ padding: '1.25rem', textAlign: 'right', color: 'var(--text-main)' }}>Total Payable</td>
                                    <td style={{ padding: '1.25rem', textAlign: 'right', color: 'var(--primary)' }}>{total}฿</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {prescriptionStatus === 'confirmed_payment' ? (
                        <div className="animate-fade-in" style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '2rem', borderRadius: '1.5rem', textAlign: 'center', marginTop: '2rem', border: '1px solid #10b981' }}>
                            <CheckCircle size={48} style={{ marginBottom: '1rem' }} />
                            <h3 style={{ fontWeight: '800', marginBottom: '0.5rem' }}>{language === 'en' ? 'Payment Confirmed' : 'ยืนยันการชำระเงินเรียบร้อย'}</h3>
                            <p style={{ opacity: 0.8 }}>{language === 'en' ? 'Your medications are being packaged for dispatch.' : 'ยาของคุณกำลังอยู่ในขั้นตอนการจัดส่ง'}</p>
                        </div>
                    ) : (
                        <button className="btn btn-primary" onClick={confirmPayment} style={{ width: '100%', padding: '1.25rem', fontSize: '1.25rem', marginTop: '2rem' }}>
                            {language === 'en' ? 'Secure Checkout & Book Delivery' : 'ชำระเงินและเรียกพนักงานส่งยา'}
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // 3. DOCTOR DASHBOARD UI
    if (profile.role === 'doctor_online' || profile.role === 'admin') {
        return (
            <div className="container section-spacing">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0 }}>Telehealth Hub</h1>
                        <p className="text-muted">Manage your virtual appointments</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            className={`btn ${isDoctorOnline ? 'btn-success' : 'btn-outline'}`}
                            onClick={toggleOnlineStatus}
                            style={{
                                background: isDoctorOnline ? '#10b981' : 'transparent',
                                color: isDoctorOnline ? 'white' : '#10b981',
                                borderColor: '#10b981'
                            }}>
                            {isDoctorOnline ? (language === 'en' ? '● You are Online' : '● ออนไลน์อยู่') : (language === 'en' ? '○ Go Online' : '○ ออนไลน์')}
                        </button>
                        {incomingPatients.length > 0 && (
                            <button className="btn btn-outline" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={clearAllWaiting}>
                                <Trash2 size={18} /> Clear Room
                            </button>
                        )}
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>Virtual Waiting Room ({incomingPatients.length})</h3>
                        <button onClick={fetchIncomingPatients} className="btn-outline" style={{ padding: '0.4rem', borderRadius: '0.6rem' }}>
                            <RefreshCw size={18} />
                        </button>
                    </div>

                    <div style={{ padding: '1rem' }}>
                        {incomingPatients.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '6rem 2rem' }}>
                                <div style={{ opacity: 0.1, marginBottom: '1.5rem' }}>
                                    <Video size={80} />
                                </div>
                                <h4 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>{language === 'en' ? 'No Virtual Requests' : 'ไม่มีคำขอปรึกษา'}</h4>
                                <p className="text-muted">{language === 'en' ? 'Wait for patients to request a consultation' : 'รอรับคำปรึกษาจากผู้ป่วย'}</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {incomingPatients.map((p, idx) => (
                                    <div
                                        key={p.id}
                                        className="animate-fade-in"
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '1.5rem',
                                            padding: '1.5rem',
                                            background: idx === 0 ? 'var(--primary-light)' : 'white',
                                            border: idx === 0 ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                            borderRadius: '1.5rem'
                                        }}>
                                        <div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>{p.profiles?.first_name} {p.profiles?.last_name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                <Clock size={12} />
                                                {language === 'en' ? `Waiting for ${Math.floor((new Date() - new Date(p.created_at)) / 60000)} mins` : `รอมาแล้ว ${Math.floor((new Date() - new Date(p.created_at)) / 60000)} นาที`}
                                            </div>
                                        </div>
                                        <button className="btn btn-primary" onClick={() => callPatient(p)}>
                                            <Video size={18} /> {t.consult.startConsult}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // 4. PATIENT DASHBOARD UI
    return (
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            {callStatus === 'waiting' ? (
                <div className="glass-card animate-fade-in" style={{ maxWidth: '450px', width: '100%', padding: '4rem 2rem', textAlign: 'center' }}>
                    <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 2.5rem' }}>
                        <div className="spinner" style={{ position: 'absolute', inset: 0, border: '4px solid var(--primary-light)', borderTopColor: 'var(--primary)', width: '80px', height: '80px' }}></div>
                        <Video size={40} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--primary)' }} />
                    </div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem' }}>{language === 'en' ? 'Requesting Doctor...' : 'กำลังขอพบแพทย์...'}</h3>
                    <p className="text-muted" style={{ marginBottom: '3rem', lineHeight: '1.6' }}>{language === 'en' ? 'We are notifying available doctors of your request. Please keep this browser window active.' : 'เรากำลังแจ้งเตือนแพทย์ที่พร้อมให้บริการ กรุณาสะบัดหน้าจอนี้ไว้'}</p>
                    <button onClick={cancelConsultation} className="btn btn-outline" style={{ width: '100%', borderColor: '#ef4444', color: '#ef4444' }}>
                        <XCircle size={18} /> Cancel Request
                    </button>
                </div>
            ) : (
                <div className="glass-card animate-fade-in" style={{ maxWidth: '450px', width: '100%', padding: '3.5rem 2.5rem', textAlign: 'center' }}>
                    <div style={{
                        width: '90px', height: '90px',
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                        borderRadius: '2rem',
                        margin: '0 auto 2rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Video size={48} />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '1.25rem' }}>Start Consultation</h2>
                    <p className="text-muted" style={{ marginBottom: '2.5rem', lineHeight: '1.6' }}>Consult with our board-certified physicians from the comfort of your home.</p>

                    {doctorsOnlineCount > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="badge badge-success" style={{ padding: '0.6rem 1rem', display: 'inline-flex', alignSelf: 'center', marginBottom: '0.5rem' }}>
                                <UserCheck size={14} style={{ marginRight: '0.5rem' }} /> {doctorsOnlineCount} {language === 'en' ? 'Doctor(s) Available Now' : 'ท่าน พร้อมให้บริการ'}
                            </div>
                            <button className="btn btn-primary" style={{ width: '100%', padding: '1.1rem' }} onClick={startConsultationRequest}>
                                {t.consult.startConsult}
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626', padding: '1.5rem', borderRadius: '1.25rem' }}>
                            <AlertCircle size={24} style={{ marginBottom: '0.5rem' }} />
                            <div style={{ fontWeight: '700' }}>{language === 'en' ? 'Doctors Offline' : 'ไม่มีแพทย์ออนไลน์'}</div>
                            <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>{t.consult.noDoctors}</p>
                        </div>
                    )}
                </div>
            )}
            <style>{`
                .spinner { borderRadius: 50%; animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

