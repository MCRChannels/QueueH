
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Building, Plus, Trash2, Edit2, Check, X, Shield, Search, LayoutGrid, BarChart3, Settings, ShieldCheck, UserPlus, MoreVertical, Loader2, MoreHorizontal } from 'lucide-react'

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('users')
    const [users, setUsers] = useState([])
    const [hospitals, setHospitals] = useState([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)

    // New Hospital State
    const [newHospital, setNewHospital] = useState({ name: '', total_queues: 0, current_queue: 0, avg_waiting_time: 0 })

    useEffect(() => {
        fetchData()

        const channel = supabase
            .channel('admin-realtime')
            .on('postgres_changes', { event: '*', table: 'profiles' }, () => fetchData())
            .on('postgres_changes', { event: '*', table: 'hospitals' }, () => fetchData())
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchData = async () => {
        try {
            const { data: userData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
            const { data: hospData } = await supabase.from('hospitals').select('*').order('name')
            setUsers(userData || [])
            setHospitals(hospData || [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const updateUserRole = async (userId, newRole) => {
        setActionLoading(true)
        const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
        if (error) alert(error.message)
        else await fetchData()
        setActionLoading(false)
    }

    const updateUserHospital = async (userId, hospId) => {
        setActionLoading(true)
        const { error } = await supabase.from('profiles').update({ hospital_id: hospId || null }).eq('id', userId)
        if (error) alert(error.message)
        else await fetchData()
        setActionLoading(false)
    }

    const addHospital = async () => {
        if (!newHospital.name) return
        setActionLoading(true)
        const { error } = await supabase.from('hospitals').insert([newHospital])
        if (error) alert(error.message)
        else {
            setNewHospital({ name: '', total_queues: 0, current_queue: 0, avg_waiting_time: 0 })
            await fetchData()
        }
        setActionLoading(false)
    }

    const deleteHospital = async (id) => {
        if (!confirm('Are you sure? This will delete all associated data.')) return
        setActionLoading(true)
        const { error } = await supabase.from('hospitals').delete().eq('id', id)
        if (error) alert(error.message)
        else await fetchData()
        setActionLoading(false)
    }

    const toggleHospitalStatus = async (hosp) => {
        setActionLoading(true)
        const { error } = await supabase.from('hospitals').update({ is_open: !hosp.is_open }).eq('id', hosp.id)
        if (error) alert(error.message)
        else await fetchData()
        setActionLoading(false)
    }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <Loader2 className="spinner" size={40} color="var(--primary)" />
        </div>
    )

    return (
        <div className="container" style={{ padding: '3rem 1rem 6rem' }}>

            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: '0.75rem' }}>
                            <Shield size={24} />
                        </div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0 }}>Command Center</h1>
                    </div>
                    <p className="text-muted">System Administration & Oversight</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="glass" style={{ display: 'flex', padding: '0.35rem', borderRadius: '1rem', background: 'rgba(255,255,255,0.7)' }}>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={activeTab === 'users' ? 'btn btn-primary' : 'btn-outline'}
                            style={{
                                padding: '0.6rem 1.25rem',
                                border: 'none',
                                borderRadius: '0.75rem',
                                background: activeTab === 'users' ? undefined : 'transparent',
                                boxShadow: activeTab === 'users' ? undefined : 'none'
                            }}>
                            <Users size={18} />
                            Users
                        </button>
                        <button
                            onClick={() => setActiveTab('hospitals')}
                            className={activeTab === 'hospitals' ? 'btn btn-primary' : 'btn-outline'}
                            style={{
                                padding: '0.6rem 1.25rem',
                                border: 'none',
                                borderRadius: '0.75rem',
                                background: activeTab === 'hospitals' ? undefined : 'transparent',
                                boxShadow: activeTab === 'hospitals' ? undefined : 'none'
                            }}>
                            <Building size={18} />
                            Hospitals
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                <div className="glass-card animate-fade-in" style={{ padding: '1.5rem', background: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ background: 'var(--primary-light)', padding: '0.5rem', borderRadius: '0.5rem', color: 'var(--primary)' }}><Users size={20} /></div>
                        <span className="badge badge-success">+12%</span>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>{users.length}</div>
                    <div className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Registered Patients</div>
                </div>
                <div className="glass-card animate-fade-in" style={{ padding: '1.5rem', background: 'white', animationDelay: '0.1s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: '#10b981' }}><Building size={20} /></div>
                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Live</span>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>{hospitals.filter(h => h.is_open).length}</div>
                    <div className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Active Medical Facilities</div>
                </div>
                <div className="glass-card animate-fade-in" style={{ padding: '1.5rem', background: 'white', animationDelay: '0.2s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '0.5rem', color: '#6366f1' }}><BarChart3 size={20} /></div>
                        <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>Global</span>
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: '800' }}>{hospitals.reduce((acc, h) => acc + (h.total_queues || 0), 0)}</div>
                    <div className="text-muted" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Total Daily Sessions</div>
                </div>
                <div className="glass-card animate-fade-in" style={{ padding: '1.5rem', background: 'var(--primary)', color: 'white', animationDelay: '0.3s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '0.5rem' }}><ShieldCheck size={20} /></div>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>System Status</div>
                    <div style={{ fontSize: '0.875rem', opacity: 0.8, fontWeight: '500', marginTop: '0.25rem' }}>All services operational</div>
                </div>
            </div>

            {activeTab === 'users' ? (
                <div className="glass-card animate-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>System Users</h3>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input className="input" placeholder="Search accounts..." style={{ paddingLeft: '2.75rem', width: '280px', height: '42px', borderRadius: '0.75rem' }} />
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-color)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <th style={{ textAlign: 'left', padding: '1rem 2rem' }}>Identity</th>
                                    <th style={{ textAlign: 'left', padding: '1rem' }}>Security Role</th>
                                    <th style={{ textAlign: 'left', padding: '1rem' }}>Affiliation</th>
                                    <th style={{ textAlign: 'right', padding: '1rem 2rem' }}>Management</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u, idx) => (
                                    <tr key={u.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--bg-color)' }}>
                                        <td style={{ padding: '1.25rem 2rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{
                                                    width: '40px', height: '40px', borderRadius: '50%',
                                                    background: 'var(--primary-light)', color: 'var(--primary)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: '700', fontSize: '0.875rem'
                                                }}>
                                                    {u.first_name?.[0].toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{u.first_name || 'Incognito'} {u.last_name || ''}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{u.username || 'unidentified'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1.25rem 1rem' }}>
                                            <select
                                                disabled={actionLoading}
                                                value={u.role || 'patient'}
                                                onChange={(e) => updateUserRole(u.id, e.target.value)}
                                                className="input" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', height: 'auto', background: 'white', cursor: 'pointer', borderRadius: '0.6rem' }}>
                                                <option value="patient">Patient</option>
                                                <option value="doctor_online">Doctor (Online)</option>
                                                <option value="doctor_opd">Doctor (OPD)</option>
                                                <option value="pharmacist">Pharmacist</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        </td>
                                        <td style={{ padding: '1.25rem 1rem' }}>
                                            <select
                                                disabled={actionLoading}
                                                value={u.hospital_id || ''}
                                                onChange={(e) => updateUserHospital(u.id, e.target.value)}
                                                className="input" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', height: 'auto', background: 'white', cursor: 'pointer', maxWidth: '180px', borderRadius: '0.6rem' }}>
                                                <option value="">None / External</option>
                                                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                            </select>
                                        </td>
                                        <td style={{ padding: '1.25rem 2rem', textAlign: 'right' }}>
                                            <button className="btn-icon" style={{ borderRadius: '0.5rem' }}><MoreHorizontal size={18} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in">
                    {/* Facility Control Center */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
                        <div>
                            <div className="glass-card" style={{ padding: '2rem', sticky: 'top' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                    <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}><Plus size={20} /></div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: '700', margin: 0 }}>Register Facility</h3>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-muted)' }}>Hospital Full Name</div>
                                    <input
                                        className="input" placeholder="e.g. Central City Medical"
                                        value={newHospital.name} onChange={e => setNewHospital({ ...newHospital, name: e.target.value })}
                                        style={{ height: '48px', borderRadius: '0.75rem', marginBottom: '1rem' }}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        onClick={addHospital}
                                        disabled={!newHospital.name || actionLoading}
                                        style={{ width: '100%', height: '48px', borderRadius: '0.75rem' }}>
                                        {actionLoading ? <Loader2 className="spinner" size={20} /> : 'Initialize Facility'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                            {hospitals.map(h => (
                                <div key={h.id} className="glass-card table-row-hover animate-fade-in" style={{ padding: '1.5rem', borderLeft: h.is_open ? '6px solid #10b981' : '6px solid #ef4444' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.25rem' }}>{h.name}</h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: h.is_open ? '#10b981' : '#ef4444' }}></div>
                                                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                                    {h.is_open ? 'Online' : 'Offline'}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => toggleHospitalStatus(h)}
                                                className="btn-icon"
                                                title={h.is_open ? 'Close Facility' : 'Open Facility'}
                                                style={{ borderRadius: '0.6rem', background: h.is_open ? '#f0fdf4' : '#fef2f2', color: h.is_open ? '#166534' : '#991b1b', border: '1px solid transparent' }}>
                                                {h.is_open ? <Check size={18} /> : <X size={18} />}
                                            </button>
                                            <button
                                                onClick={() => deleteHospital(h.id)}
                                                className="btn-icon"
                                                style={{ borderRadius: '0.6rem', color: '#ef4444' }}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-color)', borderRadius: '1rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>TOTAL TRAFFIC</div>
                                            <div style={{ fontSize: '1rem', fontWeight: '700' }}>{h.total_queues}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>CURRENT</div>
                                            <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)' }}>#{h.current_queue}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .table-row-hover:hover { background-color: #f8fafc; }
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

