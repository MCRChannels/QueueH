
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { User, Calendar, AlertTriangle, Stethoscope, Clock, Truck, Package, Building, MapPin, ClipboardList, CreditCard, ChevronRight, CheckCircle2, History, ShieldCheck, Loader2 } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { translations } from '../lib/translations'

export default function Profile() {
    const [session, setSession] = useState(null)
    const [profile, setProfile] = useState(null)
    const [queues, setQueues] = useState([])
    const [consults, setConsults] = useState([])
    const [loading, setLoading] = useState(true)
    const { language } = useLanguage()
    const t = translations[language]

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            if (session) {
                fetchData(session.user.id)
            } else {
                setLoading(false)
            }
        })
    }, [])

    const fetchData = async (userId) => {
        try {
            const { data: profileData } = await supabase.from('profiles').select('*, hospitals(name)').eq('id', userId).single()
            const { data: queueData } = await supabase.from('queues').select('*, hospitals(name)').eq('user_id', userId).order('created_at', { ascending: false })

            const { data: consultData } = await supabase
                .from('consultations')
                .select(`
                    *,
                    doctor:profiles!doctor_id(first_name, last_name),
                    patient:profiles!patient_id(first_name, last_name),
                    prescriptions(*)
                `)
                .or(`patient_id.eq.${userId},doctor_id.eq.${userId}`)
                .order('created_at', { ascending: false })

            setProfile(profileData)
            setQueues(queueData || [])
            setConsults(consultData || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <Loader2 className="spinner" size={40} color="var(--primary)" />
        </div>
    )

    if (!session) return (
        <div className="container" style={{ padding: '6rem 1rem', textAlign: 'center' }}>
            <div className="glass-card" style={{ maxWidth: '400px', margin: '0 auto', padding: '3rem' }}>
                <ShieldCheck size={64} className="text-primary" style={{ marginBottom: '1.5rem', opacity: 0.5 }} />
                <h3>{t.profile.identityRequired}</h3>
                <p className="text-muted">{t.profile.identitySubtitle}</p>
                <button onClick={() => window.location.href = '/login'} className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>{t.navbar.login}</button>
            </div>
        </div>
    )

    const userProfile = profile || { first_name: 'Patient', last_name: '', credibility_score: 100 }
    const score = userProfile.credibility_score
    const isBanned = score < 50

    return (
        <div className="container" style={{ padding: '3rem 1rem 8rem' }}>

            {/* Professional Profile Header */}
            <div className="glass-card animate-fade-in" style={{ padding: '3rem 2.5rem', border: 'none', background: 'white', marginBottom: '3rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '5px', background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}></div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            width: '100px', height: '100px', borderRadius: '2.5rem',
                            background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: '2.5rem', fontWeight: '800',
                            boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.4)'
                        }}>
                            {userProfile.first_name?.[0].toUpperCase() || 'U'}
                        </div>
                        <div style={{ position: 'absolute', bottom: '-5px', right: '-5px', background: 'white', padding: '4px', borderRadius: '50%' }}>
                            <div style={{ background: '#10b981', width: '15px', height: '15px', borderRadius: '50%', border: '3px solid white' }}></div>
                        </div>
                    </div>

                    <div style={{ flex: 1, minWidth: '250px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                            <h1 style={{ fontSize: '2.25rem', fontWeight: '800', margin: 0 }}>{userProfile.first_name} {userProfile.last_name}</h1>
                            <span className="badge badge-primary" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{userProfile.role || 'patient'}</span>
                        </div>
                        <p className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <History size={16} /> {t.profile.memberSince} {new Date(profile?.created_at || Date.now()).toLocaleDateString(language === 'en' ? 'en-US' : 'th-TH', { month: 'long', year: 'numeric' })}
                        </p>

                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-main)', fontWeight: '600' }}>
                                <div style={{ color: 'var(--primary)', background: 'var(--primary-light)', padding: '0.35rem', borderRadius: '0.5rem' }}><Package size={14} /></div>
                                {queues.length} {t.profile.visits}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-main)', fontWeight: '600' }}>
                                <div style={{ color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)', padding: '0.35rem', borderRadius: '0.5rem' }}><Stethoscope size={14} /></div>
                                {consults.length} {t.profile.consultations}
                            </div>
                            {userProfile.hospitals?.name && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--primary)', fontWeight: '700' }}>
                                    <div style={{ color: 'white', background: 'var(--primary)', padding: '0.35rem', borderRadius: '0.5rem' }}><Building size={14} /></div>
                                    {t.profile.affiliated}: {userProfile.hospitals.name}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ minWidth: '220px', padding: '1.5rem', background: 'var(--bg-color)', borderRadius: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                            <span>{t.profile.credibilityScore}</span>
                            <span style={{ color: isBanned ? 'var(--danger)' : 'var(--success)' }}>{score}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                            <div style={{ width: `${score}%`, height: '100%', background: isBanned ? 'var(--danger)' : 'var(--success)', transition: 'width 1s ease-out' }}></div>
                        </div>
                        {isBanned ? (
                            <div style={{ fontSize: '0.75rem', color: '#b91c1c', display: 'flex', gap: '0.25rem' }}>
                                <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {t.profile.statusRestricted}
                            </div>
                        ) : (
                            <div style={{ fontSize: '0.75rem', color: '#166534', display: 'flex', gap: '0.25rem' }}>
                                <ShieldCheck size={14} style={{ flexShrink: 0 }} /> {t.profile.verifiedAccount}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gap: '2.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>

                {/* Physical Hospital Visits */}
                <div className="glass-card animate-fade-in" style={{ padding: 0, animationDelay: '0.1s', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '1.75rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.75rem' }}><Calendar size={20} /></div>
                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '800' }}>{t.profile.bookingHistory}</h3>
                    </div>

                    <div style={{ padding: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
                        {queues.length === 0 ? (
                            <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                                <p className="text-muted">{t.profile.noVisits}</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {queues.map(queue => (
                                    <div key={queue.id} className="table-row-hover" style={{ borderRadius: '1.25rem', padding: '1.25rem', border: '1px solid var(--border-color)', background: 'white' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                            <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1rem' }}>{queue.hospitals?.name || t.profile.medicalFacility}</div>
                                            <span className={`badge ${queue.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                                                {queue.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '0.25rem' }}>{t.profile.queueNumber}</div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>#{queue.queue_number}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '0.25rem' }}>{t.profile.appointmentDate}</div>
                                                <div style={{ fontSize: '0.875rem', fontWeight: '700' }}>{new Date(queue.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'th-TH')}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Virtual Consultations */}
                <div className="glass-card animate-fade-in" style={{ padding: 0, animationDelay: '0.2s', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '1.75rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', padding: '0.5rem', borderRadius: '0.75rem' }}><Stethoscope size={20} /></div>
                        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '800' }}>{t.profile.healthConsultations}</h3>
                    </div>

                    <div style={{ padding: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
                        {consults.length === 0 ? (
                            <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                                <p className="text-muted">{t.profile.noConsults}</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {consults.map(c => {
                                    const isPatient = profile?.role === 'patient' || !profile?.role
                                    const counterpart = isPatient ? c.doctor : c.patient

                                    return (
                                        <div key={c.id} className="table-row-hover" style={{ borderRadius: '1.25rem', padding: '1.25rem', border: '1px solid var(--border-color)', background: 'white' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '700' }}>
                                                        {counterpart?.first_name?.[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: '800' }}>
                                                            {isPatient ? 'Dr. ' : ''}{counterpart?.first_name} {counterpart?.last_name}
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>{new Date(c.created_at).toLocaleDateString(language === 'en' ? 'en-US' : 'th-TH')}</div>
                                                    </div>
                                                </div>
                                                <span className={`badge ${c.status === 'completed' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                                                    {c.status.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </div>
                                            {c.summary && (
                                                <div style={{ padding: '0.75rem', background: 'var(--bg-color)', borderRadius: '0.75rem', fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{t.profile.medicalObservation}</div>
                                                    {c.summary}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Medical Logistics */}
            <div className="animate-fade-in" style={{ marginTop: '3rem', animationDelay: '0.3s' }}>
                <div className="glass-card" style={{ padding: 0 }}>
                    <div style={{ padding: '1.75rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '0.5rem', borderRadius: '0.75rem' }}><Truck size={20} /></div>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>{t.profile.pharmacyOrders}</h3>
                        </div>
                    </div>

                    <div style={{ padding: '2rem' }}>
                        {(() => {
                            const orders = consults.flatMap(c => (c.prescriptions || []).map(p => ({ ...p, doctor: c.doctor })))
                            if (orders.length === 0) return (
                                <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                                    <Package size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                                    <p className="text-muted">{t.profile.noOrders}</p>
                                </div>
                            )

                            return (
                                <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))' }}>
                                    {orders.map(order => (
                                        <div key={order.id} className="table-row-hover" style={{ border: '1px solid var(--border-color)', borderRadius: '1.5rem', padding: '1.75rem', background: 'white' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t.profile.orderRef}</span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '800' }}>#{order.id.slice(0, 8)}</span>
                                                    </div>
                                                    <div style={{ fontSize: '1.1rem', fontWeight: '800' }}>via Dr. {order.doctor?.first_name} {order.doctor?.last_name}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div className={`badge ${order.status === 'shipped' ? 'badge-success' : 'badge-primary'}`} style={{ marginBottom: '0.25rem' }}>
                                                        {order.status.replace('_', ' ').toUpperCase()}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>{new Date(order.created_at).toLocaleString(language === 'en' ? 'en-US' : 'th-TH')}</div>
                                                </div>
                                            </div>

                                            <div style={{ background: 'var(--bg-color)', borderRadius: '1.25rem', padding: '1.5rem' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.25rem' }}>
                                                    {(order.medicines || []).map((m, idx) => (
                                                        <span key={idx} style={{ background: 'white', border: '1px solid var(--border-color)', padding: '0.4rem 0.8rem', borderRadius: '0.75rem', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {m.name} <span style={{ color: 'var(--primary)', fontWeight: '800', background: 'var(--primary-light)', padding: '0.1rem 0.35rem', borderRadius: '0.35rem', fontSize: '0.7rem' }}>{m.quantity}</span>
                                                        </span>
                                                    ))}
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '1.25rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                        <CreditCard size={16} /> {t.profile.totalBilled}
                                                    </div>
                                                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>{order.total_cost}฿</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        })()}
                    </div>
                </div>
            </div>

            {/* Address & Logistics Details */}
            {userProfile.house_no && (
                <div className="glass-card animate-fade-in" style={{ marginTop: '3rem', animationDelay: '0.4s', padding: '2rem' }}>
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.75rem' }}><MapPin size={20} /></div>
                                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '800' }}>{t.profile.deliveryAddress}</h3>
                            </div>
                            <div style={{ padding: '1.5rem', background: 'var(--bg-color)', borderRadius: '1.25rem', border: '1px solid var(--border-color)' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.5rem' }}>{userProfile.first_name} {userProfile.last_name}</div>
                                <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
                                    {userProfile.house_no} {userProfile.village ? (language === 'en' ? `Moo ${userProfile.village}` : `หมู่ ${userProfile.village}`) : ''} {userProfile.road},<br />
                                    {userProfile.sub_district}, {userProfile.district},<br />
                                    {userProfile.province} {userProfile.zipcode}
                                </p>
                            </div>
                        </div>
                        <div style={{ width: '300px', padding: '1.5rem', background: 'rgba(59, 130, 246, 0.03)', borderRadius: '1.25rem', border: '1px dashed var(--primary)' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '1rem' }}>{t.profile.accountSecurity}</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span className="text-muted">{t.profile.accountID}</span>
                                    <span style={{ fontWeight: '700' }}>#{userProfile.id?.slice(0, 8)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                    <span className="text-muted">{t.profile.encryption}</span>
                                    <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>AES-256</span>
                                </div>
                                <div style={{ borderTop: '1px solid #eee', marginTop: '0.5rem', paddingTop: '0.75rem' }}>
                                    <button className="btn btn-outline" style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem' }}>{t.profile.updateSecurity}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .table-row-hover { transition: all 0.2s ease; }
                .table-row-hover:hover { transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border-color: var(--primary-light) !important; }
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

