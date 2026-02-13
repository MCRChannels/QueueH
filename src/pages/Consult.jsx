
import React, { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Peer } from 'peerjs'
import { Video, VideoOff, Mic, MicOff, PhoneOff, RefreshCw, XCircle, Trash2, CheckCircle, UserCheck, ChevronRight, Loader2, Hospital, AlertCircle, Clock, Stethoscope, Star, FileText, X, Eye } from 'lucide-react'
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
    const [toggleLoading, setToggleLoading] = useState(false)

    // Rating state
    const [showRating, setShowRating] = useState(false)
    const [rating, setRating] = useState(0)
    const [ratingHover, setRatingHover] = useState(0)
    const [ratingSubmitted, setRatingSubmitted] = useState(false)

    // Patient history modal (for doctor)
    const [patientHistory, setPatientHistory] = useState(null)
    const [showPatientHistory, setShowPatientHistory] = useState(false)
    const [historyLoading, setHistoryLoading] = useState(false)

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

    // Save Feedback (non-blocking toast instead of alert)
    const [saveFeedback, setSaveFeedback] = useState(null)
    const saveFeedbackTimer = useRef(null)
    const showSaveFeedback = (message) => {
        if (saveFeedbackTimer.current) clearTimeout(saveFeedbackTimer.current)
        setSaveFeedback(message)
        saveFeedbackTimer.current = setTimeout(() => setSaveFeedback(null), 3000)
    }

    // UI State
    const [showMedicalPanel, setShowMedicalPanel] = useState(window.innerWidth > 768)

    // Stream Handling Effect - only re-assign when remoteStream actually changes
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            // Guard: Only re-assign srcObject if it actually changed
            if (remoteVideoRef.current.srcObject !== remoteStream) {
                remoteVideoRef.current.srcObject = remoteStream
            }
            remoteVideoRef.current.muted = false // IMPORTANT: Ensure not muted
            remoteVideoRef.current.volume = 1.0
            remoteVideoRef.current.play().catch(e => console.error('Error auto-playing video:', e))
        }
    }, [remoteStream])

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

            const sub = supabase.channel('doctors_status_sync_' + session.user.id)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'role=in.(doctor_online,admin)' }, (payload) => {
                    console.log('Doctor status changed:', payload)
                    checkDoctorsOnline()
                })
                .subscribe((status) => {
                    console.log('Doctor Status Realtime:', status)
                    // On successful subscription, do an immediate check
                    if (status === 'SUBSCRIBED') {
                        checkDoctorsOnline()
                    }
                })

            // POLLING FALLBACK: Refresh doctors count every 5 seconds
            const interval = setInterval(() => {
                checkDoctorsOnline()
            }, 5000)

            // Also re-check when user focuses the tab/app
            const handleVisibility = () => {
                if (document.visibilityState === 'visible') {
                    checkDoctorsOnline()
                }
            }
            document.addEventListener('visibilitychange', handleVisibility)

            return () => {
                supabase.removeChannel(sub)
                clearInterval(interval)
                document.removeEventListener('visibilitychange', handleVisibility)
            }
        }

        if (profile.role === 'doctor_online' || profile.role === 'admin') {
            setIsDoctorOnline(profile.is_online)
            fetchIncomingPatients()

            // Auto-offline when doctor closes/leaves the page
            const handleBeforeUnload = () => {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sabckofvkyrbvlsvftof.supabase.co'
                const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhYmNrb2Z2a3lyYnZsc3ZmdG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMDIwODEsImV4cCI6MjA4NTY3ODA4MX0.fMcfjg97XqEVnPVwFwKKgCtBvD8ZQ6xmTwgoh9bVb_g'
                const url = `${supabaseUrl}/rest/v1/profiles?id=eq.${session.user.id}`
                const headers = {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${session.access_token}`,
                    'Prefer': 'return=minimal'
                }
                const body = JSON.stringify({ is_online: false })
                // sendBeacon with fetch fallback
                if (navigator.sendBeacon) {
                    const blob = new Blob([body], { type: 'application/json' })
                    // sendBeacon doesn't support custom headers, so use fetch with keepalive
                    fetch(url, { method: 'PATCH', headers, body, keepalive: true }).catch(() => { })
                } else {
                    fetch(url, { method: 'PATCH', headers, body, keepalive: true }).catch(() => { })
                }
            }
            window.addEventListener('beforeunload', handleBeforeUnload)

            return () => {
                window.removeEventListener('beforeunload', handleBeforeUnload)
            }
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
        setToggleLoading(true)
        const nextStatus = !isDoctorOnline
        const { error } = await supabase.from('profiles').update({ is_online: nextStatus }).eq('id', session.user.id)
        if (error) {
            console.error('Failed to update online status:', error)
            alert(language === 'en' ? 'Failed to update status: ' + error.message : 'อัปเดตสถานะไม่สำเร็จ: ' + error.message)
            setToggleLoading(false)
            return
        }
        console.log('Doctor online status updated to:', nextStatus)
        setIsDoctorOnline(nextStatus)
        setToggleLoading(false)
    }

    // Fetch patient medical history (for doctor)
    const fetchPatientHistory = async (patientId) => {
        setHistoryLoading(true)
        setShowPatientHistory(true)
        try {
            const { data: patientProfile } = await supabase.from('profiles')
                .select('first_name, last_name, phone, province, district')
                .eq('id', patientId).single()

            const { data: consultations } = await supabase.from('consultations')
                .select(`
                    id, summary, status, created_at,
                    doctor:profiles!doctor_id(first_name, last_name),
                    prescriptions(medicines, total_cost, status)
                `)
                .eq('patient_id', patientId)
                .eq('status', 'completed')
                .order('created_at', { ascending: false })
                .limit(10)

            setPatientHistory({
                profile: patientProfile,
                consultations: consultations || []
            })
        } catch (err) {
            console.error('Error fetching patient history:', err)
        } finally {
            setHistoryLoading(false)
        }
    }

    // Submit rating
    const submitRating = async () => {
        if (!activeConsultation || rating === 0) return
        try {
            await supabase.from('consultations').update({ rating }).eq('id', activeConsultation.id)
            setRatingSubmitted(true)
        } catch (err) {
            console.error('Rating error:', err)
        }
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
        // Use non-blocking toast instead of alert() to prevent video freeze
        showSaveFeedback(language === 'en' ? 'Prescription/Notes Saved!' : 'บันทึกรายการยาและบันทึกเรียบร้อยแล้ว!')
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
                height: '100vh',
                height: '100dvh',
                background: '#0f172a',
                zIndex: 9999,
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                overflow: 'hidden'
            }}>
                {/* Non-blocking Save Toast (replaces frozen alert) */}
                {saveFeedback && (
                    <div className="animate-fade-in" style={{
                        position: 'fixed',
                        top: '1.5rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10001,
                        background: 'rgba(16, 185, 129, 0.95)',
                        color: 'white',
                        padding: '0.85rem 1.5rem',
                        borderRadius: '1rem',
                        boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: '600',
                        fontSize: '0.95rem',
                        backdropFilter: 'blur(8px)',
                        pointerEvents: 'none'
                    }}>
                        <CheckCircle size={20} />
                        {saveFeedback}
                    </div>
                )}
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
                            bottom: 0,
                            left: 0,
                            right: 0,
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            zIndex: 100,
                            padding: '14px 16px',
                            paddingBottom: 'calc(14px + env(safe-area-inset-bottom))',
                            background: 'rgba(15, 23, 42, 0.85)',
                            backdropFilter: 'blur(16px)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            alignItems: 'center'
                        }}>
                            <button onClick={toggleAudio} style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: isAudioEnabled ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.9)',
                                border: isAudioEnabled ? '1px solid rgba(59, 130, 246, 0.5)' : 'none',
                                color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s ease', flexShrink: 0
                            }}>
                                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                            </button>

                            <button onClick={toggleVideo} style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: isVideoEnabled ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.9)',
                                border: isVideoEnabled ? '1px solid rgba(59, 130, 246, 0.5)' : 'none',
                                color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s ease', flexShrink: 0
                            }}>
                                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                            </button>

                            <button onClick={endCall} style={{
                                width: '56px', height: '56px', borderRadius: '50%',
                                background: '#ef4444',
                                border: '3px solid rgba(239, 68, 68, 0.3)',
                                color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                                flexShrink: 0
                            }}>
                                <PhoneOff size={24} fill="white" />
                            </button>

                            {isDoctor && (
                                <button onClick={() => setShowMedicalPanel(!showMedicalPanel)} style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: showMedicalPanel ? 'white' : 'rgba(255,255,255,0.15)',
                                    border: 'none',
                                    color: showMedicalPanel ? 'var(--primary)' : 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <Stethoscope size={20} />
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
                        height: isMobile ? 'auto' : '100%',
                        maxHeight: isMobile ? '80dvh' : '100%',
                        background: 'white',
                        padding: isMobile ? '1rem 1rem calc(1rem + 80px + env(safe-area-inset-bottom))' : '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        borderLeft: !isMobile ? '1px solid var(--border-color)' : 'none',
                        borderTop: isMobile ? '4px solid var(--primary)' : 'none',
                        borderRadius: isMobile ? '1.5rem 1.5rem 0 0' : 0,
                        zIndex: 50,
                        position: isMobile ? 'fixed' : 'relative',
                        bottom: isMobile ? 0 : 'auto',
                        left: isMobile ? 0 : 'auto',
                        boxShadow: isMobile ? '0 -8px 30px rgba(0,0,0,0.2)' : 'none'
                    }}>
                        {/* Drag Handle for mobile */}
                        {isMobile && (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '0.25rem 0 0.75rem' }}>
                                <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: '#cbd5e1' }}></div>
                            </div>
                        )}
                        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: '700', margin: 0 }}>{t.consult.writeSummary}</h3>
                            {isMobile && (
                                <button onClick={() => setShowMedicalPanel(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <ChevronRight size={22} style={{ transform: 'rotate(90deg)', color: 'var(--text-muted)' }} />
                                </button>
                            )}
                        </div>

                        {/* Patient History Button - during call */}
                        {activeConsultation && (
                            <button
                                className="btn btn-outline"
                                onClick={() => fetchPatientHistory(activeConsultation.patient_id)}
                                style={{
                                    width: '100%', marginBottom: '1rem', borderRadius: '0.75rem',
                                    minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    borderColor: 'var(--primary)', color: 'var(--primary)', fontSize: isMobile ? '0.95rem' : '0.9rem'
                                }}
                            >
                                <FileText size={16} />
                                {language === 'en' ? 'View Patient History' : 'ดูประวัติการรักษาผู้ป่วย'}
                            </button>
                        )}

                        <textarea
                            className="input"
                            rows={isMobile ? 3 : 4}
                            placeholder="Symptoms, Diagnosis, and Treatment Plan..."
                            value={summaryText}
                            onChange={e => setSummaryText(e.target.value)}
                            style={{ margin: '0 0 1rem 0', borderRadius: '0.75rem', padding: '0.85rem', fontSize: isMobile ? '1rem' : '0.95rem' }}
                        />

                        <h3 style={{ fontSize: isMobile ? '1rem' : '1.125rem', fontWeight: '700', marginBottom: '0.75rem' }}>Prescribe Medications</h3>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                            {medicines.map((m, i) => (
                                <div key={i} style={{ padding: isMobile ? '0.85rem' : '1rem', border: '1px solid var(--border-color)', borderRadius: '1rem', background: '#fafbfc' }}>
                                    <input className="input" placeholder={language === 'en' ? 'Medication Name' : 'ชื่อยา'} value={m.name} onChange={e => updateMed(i, 'name', e.target.value)} style={{ marginBottom: '0.5rem', fontSize: isMobile ? '1rem' : '0.9rem', padding: isMobile ? '0.75rem' : '0.6rem 0.75rem', height: isMobile ? '48px' : 'auto' }} />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                        <input className="input" placeholder={language === 'en' ? 'Qty' : 'จำนวน'} value={m.quantity} onChange={e => updateMed(i, 'quantity', e.target.value)} style={{ fontSize: isMobile ? '1rem' : '0.9rem', padding: isMobile ? '0.75rem' : '0.6rem 0.75rem', height: isMobile ? '48px' : 'auto' }} />
                                        <input className="input" type="number" placeholder={language === 'en' ? 'Price' : 'ราคา'} value={m.price} onChange={e => updateMed(i, 'price', e.target.value)} style={{ fontSize: isMobile ? '1rem' : '0.9rem', padding: isMobile ? '0.75rem' : '0.6rem 0.75rem', height: isMobile ? '48px' : 'auto' }} />
                                    </div>
                                    <button onClick={() => setMedicines(medicines.filter((_, idx) => idx !== i))} style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none', background: 'none', padding: '0.6rem 0', cursor: 'pointer', marginTop: '0.25rem', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
                                        <Trash2 size={14} style={{ marginRight: '6px' }} /> {language === 'en' ? 'Remove' : 'ลบ'}
                                    </button>
                                </div>
                            ))}
                            <button className="btn btn-outline" style={{ width: '100%', borderRadius: '1rem', minHeight: '48px' }} onClick={() => setMedicines([...medicines, { name: '', quantity: '', price: 0 }])}>
                                + {t.consult.addPrescription}
                            </button>
                        </div>

                        <div style={{ marginTop: '1rem', paddingBottom: isMobile ? '0.5rem' : 0 }}>
                            <button className="btn btn-primary" style={{ width: '100%', padding: isMobile ? '0.85rem' : '1rem', minHeight: '48px', fontSize: isMobile ? '1rem' : '0.95rem' }} onClick={submitPrescription}>
                                {t.consult.saveRecord}
                            </button>
                        </div>
                    </div>
                )}

                {/* Patient History Modal (overlay during call) */}
                {showPatientHistory && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 10000, padding: '1rem'
                    }} onClick={() => setShowPatientHistory(false)}>
                        <div className="glass-card animate-fade-in" style={{
                            width: '100%', maxWidth: '650px', maxHeight: '85vh', overflow: 'auto',
                            padding: '2rem', background: 'white', borderRadius: '2rem',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FileText size={20} color="var(--primary)" />
                                    {language === 'en' ? 'Patient Medical History' : 'ประวัติการรักษาผู้ป่วย'}
                                </h3>
                                <button onClick={() => setShowPatientHistory(false)} style={{ background: 'var(--bg-color)', border: 'none', borderRadius: '0.75rem', padding: '0.5rem', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            {historyLoading ? (
                                <div style={{ textAlign: 'center', padding: '3rem' }}>
                                    <Loader2 className="spinner" size={32} color="var(--primary)" />
                                </div>
                            ) : patientHistory ? (
                                <>
                                    <div style={{ background: 'var(--bg-color)', padding: '1.25rem', borderRadius: '1.25rem', marginBottom: '1.5rem' }}>
                                        <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                                            {patientHistory.profile?.first_name} {patientHistory.profile?.last_name}
                                        </div>
                                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {patientHistory.profile?.phone && <span>📞 {patientHistory.profile.phone}</span>}
                                            {patientHistory.profile?.province && <span>📍 {patientHistory.profile.district}, {patientHistory.profile.province}</span>}
                                        </div>
                                    </div>
                                    {patientHistory.consultations.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                            <FileText size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                            <p>{language === 'en' ? 'No previous consultations found' : 'ไม่พบประวัติการรักษาก่อนหน้านี้'}</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {patientHistory.consultations.map((c, idx) => (
                                                <div key={c.id} style={{
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '1.25rem', padding: '1.25rem',
                                                    background: idx === 0 ? 'rgba(99, 102, 241, 0.03)' : 'white'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                                                            {new Date(c.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: '700' }}>
                                                            {language === 'en' ? 'Dr.' : 'พญ.'} {c.doctor?.first_name} {c.doctor?.last_name}
                                                        </div>
                                                    </div>
                                                    {c.summary && (
                                                        <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-main)', marginBottom: '0.75rem', borderLeft: '3px solid var(--primary)', paddingLeft: '0.75rem' }}>
                                                            {c.summary}
                                                        </div>
                                                    )}
                                                    {c.prescriptions && c.prescriptions.length > 0 && c.prescriptions[0].medicines && (
                                                        <div style={{ background: 'var(--bg-color)', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                                                {language === 'en' ? 'Prescribed Medications' : 'ยาที่สั่ง'}
                                                            </div>
                                                            {c.prescriptions[0].medicines.map((med, mi) => (
                                                                <div key={mi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.3rem 0', borderBottom: mi < c.prescriptions[0].medicines.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                                                    <span style={{ fontWeight: '600' }}>{med.name || '-'}</span>
                                                                    <span style={{ color: 'var(--text-muted)' }}>{med.quantity} • {med.price}฿</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : null}
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
            <div className="container section-spacing" style={{ maxWidth: '800px', padding: '0 1rem' }}>
                <div className="glass-card animate-fade-in" style={{ padding: 'clamp(1.25rem, 5vw, 3rem)' }}>
                    <div style={{ textAlign: 'center', marginBottom: 'clamp(1.5rem, 4vw, 3rem)' }}>
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

                    {/* Rating Section */}
                    {!ratingSubmitted ? (
                        <div style={{ marginTop: '2.5rem', padding: '2rem', background: 'var(--bg-color)', borderRadius: '1.5rem', textAlign: 'center' }}>
                            <h4 style={{ fontWeight: '700', marginBottom: '0.75rem' }}>{language === 'en' ? 'Rate Your Doctor' : 'ให้คะแนนแพทย์'}</h4>
                            <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>{language === 'en' ? 'Your feedback helps us improve our service' : 'ความคิดเห็นของคุณช่วยให้เราปรับปรุงบริการ'}</p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => setRatingHover(star)}
                                        onMouseLeave={() => setRatingHover(0)}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
                                            transform: (ratingHover || rating) >= star ? 'scale(1.2)' : 'scale(1)',
                                            transition: 'transform 0.2s'
                                        }}
                                    >
                                        <Star size={32} fill={(ratingHover || rating) >= star ? '#f59e0b' : 'none'} color={(ratingHover || rating) >= star ? '#f59e0b' : '#d1d5db'} />
                                    </button>
                                ))}
                            </div>
                            {rating > 0 && (
                                <button className="btn btn-primary" onClick={submitRating} style={{ padding: '0.75rem 2rem' }}>
                                    {language === 'en' ? 'Submit Rating' : 'ส่งคะแนน'}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div style={{ marginTop: '2.5rem', padding: '1.5rem', background: '#fefce8', borderRadius: '1.5rem', textAlign: 'center', border: '1px solid #fde68a' }}>
                            <Star size={24} fill="#f59e0b" color="#f59e0b" style={{ marginBottom: '0.5rem' }} />
                            <p style={{ fontWeight: '700', color: '#92400e' }}>{language === 'en' ? 'Thank you for your feedback!' : 'ขอบคุณสำหรับคะแนน!'}</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // 3. DOCTOR DASHBOARD UI
    if (profile.role === 'doctor_online' || profile.role === 'admin') {
        return (
            <div className="container section-spacing">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ minWidth: 0 }}>
                        <h1 style={{ fontSize: 'clamp(1.35rem, 4vw, 2rem)', fontWeight: '800', margin: 0 }}>Telehealth Hub</h1>
                        <p className="text-muted" style={{ margin: 0, marginTop: '0.25rem' }}>Manage your virtual appointments</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                            className={`btn ${isDoctorOnline ? 'btn-success' : 'btn-outline'}`}
                            onClick={toggleOnlineStatus}
                            disabled={toggleLoading}
                            style={{
                                background: isDoctorOnline ? '#10b981' : 'transparent',
                                color: isDoctorOnline ? 'white' : '#10b981',
                                borderColor: '#10b981',
                                whiteSpace: 'nowrap',
                                fontSize: 'clamp(0.8rem, 2.5vw, 0.95rem)',
                                opacity: toggleLoading ? 0.6 : 1
                            }}>
                            {toggleLoading ? <Loader2 className="spinner" size={16} /> : isDoctorOnline ? (language === 'en' ? '● Online' : '● ออนไลน์') : (language === 'en' ? '○ Go Online' : '○ ออนไลน์')}
                        </button>
                        {incomingPatients.length > 0 && (
                            <button className="btn btn-outline" style={{ borderColor: '#ef4444', color: '#ef4444', whiteSpace: 'nowrap', fontSize: 'clamp(0.8rem, 2.5vw, 0.95rem)' }} onClick={clearAllWaiting}>
                                <Trash2 size={16} /> {language === 'en' ? 'Clear' : 'ล้าง'}
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
                                            gap: '1rem',
                                            padding: 'clamp(1rem, 3vw, 1.5rem)',
                                            background: idx === 0 ? 'var(--primary-light)' : 'white',
                                            border: idx === 0 ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                            borderRadius: '1.25rem'
                                        }}>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontSize: 'clamp(0.95rem, 3vw, 1.1rem)', fontWeight: '700' }}>{p.profiles?.first_name} {p.profiles?.last_name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                <Clock size={12} />
                                                {language === 'en' ? `Waiting ${Math.floor((new Date() - new Date(p.created_at)) / 60000)} min` : `รอ ${Math.floor((new Date() - new Date(p.created_at)) / 60000)} นาที`}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <button className="btn btn-outline" style={{ whiteSpace: 'nowrap', padding: '0.6rem 0.75rem', fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', borderColor: 'var(--primary)', color: 'var(--primary)' }} onClick={() => fetchPatientHistory(p.patient_id)} title={language === 'en' ? 'View History' : 'ดูประวัติ'}>
                                                <Eye size={14} /> {language === 'en' ? 'History' : 'ประวัติ'}
                                            </button>
                                            <button className="btn btn-primary" style={{ whiteSpace: 'nowrap', padding: '0.6rem 1rem', fontSize: 'clamp(0.8rem, 2.5vw, 0.95rem)' }} onClick={() => callPatient(p)}>
                                                <Video size={16} /> {t.consult.startConsult}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Patient History Modal */}
                {showPatientHistory && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 2000, padding: '1rem'
                    }} onClick={() => setShowPatientHistory(false)}>
                        <div className="glass-card animate-fade-in" style={{
                            width: '100%', maxWidth: '650px', maxHeight: '85vh', overflow: 'auto',
                            padding: '2rem', background: 'white', borderRadius: '2rem',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FileText size={20} color="var(--primary)" />
                                    {language === 'en' ? 'Patient Medical History' : 'ประวัติการรักษาผู้ป่วย'}
                                </h3>
                                <button onClick={() => setShowPatientHistory(false)} style={{ background: 'var(--bg-color)', border: 'none', borderRadius: '0.75rem', padding: '0.5rem', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            </div>

                            {historyLoading ? (
                                <div style={{ textAlign: 'center', padding: '3rem' }}>
                                    <Loader2 className="spinner" size={32} color="var(--primary)" />
                                </div>
                            ) : patientHistory ? (
                                <>
                                    {/* Patient Info */}
                                    <div style={{ background: 'var(--bg-color)', padding: '1.25rem', borderRadius: '1.25rem', marginBottom: '1.5rem' }}>
                                        <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                                            {patientHistory.profile?.first_name} {patientHistory.profile?.last_name}
                                        </div>
                                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                            {patientHistory.profile?.phone && <span>📞 {patientHistory.profile.phone}</span>}
                                            {patientHistory.profile?.province && <span>📍 {patientHistory.profile.district}, {patientHistory.profile.province}</span>}
                                        </div>
                                    </div>

                                    {/* Consultations List */}
                                    {patientHistory.consultations.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                            <FileText size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                            <p>{language === 'en' ? 'No previous consultations found' : 'ไม่พบประวัติการรักษาก่อนหน้านี้'}</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {patientHistory.consultations.map((c, idx) => (
                                                <div key={c.id} style={{
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '1.25rem',
                                                    padding: '1.25rem',
                                                    background: idx === 0 ? 'rgba(99, 102, 241, 0.03)' : 'white'
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                                                            {new Date(c.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: '700' }}>
                                                            {language === 'en' ? 'Dr.' : 'พญ.'} {c.doctor?.first_name} {c.doctor?.last_name}
                                                        </div>
                                                    </div>
                                                    {c.summary && (
                                                        <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-main)', marginBottom: '0.75rem', borderLeft: '3px solid var(--primary)', paddingLeft: '0.75rem' }}>
                                                            {c.summary}
                                                        </div>
                                                    )}
                                                    {c.prescriptions && c.prescriptions.length > 0 && c.prescriptions[0].medicines && (
                                                        <div style={{ background: 'var(--bg-color)', padding: '0.75rem 1rem', borderRadius: '0.75rem' }}>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                                                {language === 'en' ? 'Prescribed Medications' : 'ยาที่สั่ง'}
                                                            </div>
                                                            {c.prescriptions[0].medicines.map((med, mi) => (
                                                                <div key={mi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.3rem 0', borderBottom: mi < c.prescriptions[0].medicines.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                                                    <span style={{ fontWeight: '600' }}>{med.name || '-'}</span>
                                                                    <span style={{ color: 'var(--text-muted)' }}>{med.quantity} • {med.price}฿</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                    </div>
                )}
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

