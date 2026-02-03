
import { createClient } from '@supabase/supabase-js'

// --- CONFIG ---
const supabaseUrl = 'https://sabckofvkyrbvlsvftof.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhYmNrb2Z2a3lyYnZsc3ZmdG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMDIwODEsImV4cCI6MjA4NTY3ODA4MX0.fMcfjg97XqEVnPVwFwKKgCtBvD8ZQ6xmTwgoh9bVb_g'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const users = [
    { username: 'user1', password: 'user123', role: 'patient', firstName: 'Patient', lastName: 'One' },
    { username: 'doc1', password: 'doc123', role: 'doctor_opd', firstName: 'Doctor', lastName: 'OPD' },
    { username: 'docO1', password: 'docO123', role: 'doctor_online', firstName: 'Doctor', lastName: 'Online' },
    { username: 'phar1', password: 'phar123', role: 'pharmacist', firstName: 'Pharmacist', lastName: 'One' },
]

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function seed() {
    console.log('Starting seed...')
    console.log('NOTE: If this fails with rate limits, please increase Rate Limits in Supabase Dashboard and Disable Email Confirmation.')

    for (const u of users) {
        // Construct a fake email for auth
        const email = `${u.username}@queueh.com`
        console.log(`Creating ${u.username} (${email})...`)

        // 1. SignUp
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: u.password
        })

        if (authError) {
            console.error(`Failed to signup ${u.username}:`, authError.message)
            // If user already exists, we might still want to try creating profile if missing?
            // checking specific error...
        }

        if (authData?.user) {
            console.log(`Signed up ${u.username}. Inserting profile...`)
            // 2. Insert Profile with Role and Username
            const { error: profileError } = await supabase.from('profiles').insert({
                id: authData.user.id,
                username: u.username,
                email: email,
                role: u.role,
                first_name: u.firstName,
                last_name: u.lastName,
                credibility_score: 100
            })

            if (profileError) {
                console.error(`Failed to create profile for ${u.username}:`, profileError.message)
            } else {
                console.log(`Success! Created ${u.username} as ${u.role}`)
            }

            // Sign out to clear session
            await supabase.auth.signOut()

            // Wait 2 seconds between requests to be gentle
            await delay(2000)
        } else {
            console.log('Skipping profile creation due to signup failure.')
        }
    }
    console.log('Seed complete.')
}

seed()
