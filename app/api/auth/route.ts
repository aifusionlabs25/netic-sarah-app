import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { name, email, token } = body

        // 1. Get the secret token (Fallback to 'Sarah' for immediate demo use)
        const validToken = process.env.DEMO_ACCESS_TOKEN || 'Sarah'

        // 2. Validate Access Token (Case-Insensitive)
        if (!token || token.trim().toLowerCase() !== validToken.toLowerCase()) {
            console.log(`❌ Access denied for: ${name} (Invalid Token)`)
            return NextResponse.json({ success: false, message: 'Invalid Access Code' }, { status: 401 })
        }

        // 3. Validate Email Format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!email || !emailRegex.test(email)) {
            console.log(`❌ Access denied for: ${name} (Invalid Email: ${email})`)
            return NextResponse.json({ success: false, message: 'Please enter a valid work email.' }, { status: 400 })
        }

        console.log(`✅ Access granted to: ${name} (${email})`)
        return NextResponse.json({
            success: true,
            message: 'Access granted'
        })

    } catch (error) {
        console.error('Auth error:', error)
        return NextResponse.json({
            success: false,
            message: 'Authentication failed'
        }, { status: 500 })
    }
}
