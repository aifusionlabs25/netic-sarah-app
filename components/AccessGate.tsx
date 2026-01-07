'use client'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface AccessGateProps {
    children: React.ReactNode
}

export default function AccessGate({ children }: AccessGateProps) {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [token, setToken] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    // Request Access Modal State
    const [isRequestOpen, setIsRequestOpen] = useState(false)
    const [reqName, setReqName] = useState('')
    const [reqCompany, setReqCompany] = useState('')
    const [reqWebsite, setReqWebsite] = useState('')
    const [reqPhone, setReqPhone] = useState('')
    const [reqEmail, setReqEmail] = useState('')
    const [reqLoading, setReqLoading] = useState(false)
    const [reqSuccess, setReqSuccess] = useState(false)
    const [reqError, setReqError] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, token })
            })

            const data = await response.json()

            if (data.success) {
                // strict auth: no localStorage persistence
                setIsAuthenticated(true)
            } else {
                setError(data.message || 'Invalid credentials')
            }
        } catch {
            setError('Authentication failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleRequestSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setReqLoading(true)
        setReqError('')

        try {
            const response = await fetch('/api/request-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: reqName,
                    company: reqCompany,
                    website: reqWebsite,
                    phone: reqPhone,
                    email: reqEmail
                })
            })

            if (response.ok) {
                setReqSuccess(true)
            } else {
                const data = await response.json()
                setReqError(data.error || 'Failed to submit')
            }
        } catch {
            setReqError('Failed to send request. Try again.')
        } finally {
            setReqLoading(false)
        }
    }

    const handleLogout = () => {
        setIsAuthenticated(false)
        setName('')
        setEmail('')
        setToken('')
    }

    // SSR Safe Portal
    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
    }, [])

    // Authenticated - show children with logout option
    if (isAuthenticated) {
        // Inject user props into children (InteractiveAvatar)
        const childrenWithProps = React.Children.map(children, child => {
            if (React.isValidElement(child)) {
                return React.cloneElement(child, {
                    //@ts-ignore - Dynamic prop injection
                    userEmail: email,
                    //@ts-ignore
                    userName: name
                });
            }
            return child;
        });

        return (
            <div className="relative">
                {/* Logout button - small, in corner */}
                <button
                    onClick={handleLogout}
                    className="fixed bottom-4 left-4 z-[500] text-[10px] text-slate-600 hover:text-white bg-transparent hover:bg-slate-900/80 px-2 py-1 rounded-md border border-transparent hover:border-slate-700/50 transition-all opacity-30 hover:opacity-100"
                >
                    Exit Demo
                </button>
                {childrenWithProps}
            </div>
        )
    }

    // Not authenticated - show login
    return (
        <>
            <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0B3B28]">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path d="M0 100 C 20 0 50 0 100 100 Z" fill="#ffffff" />
                    </svg>
                </div>

                <div className="w-full max-w-lg relative z-10">
                    {/* Header Section */}
                    <div className="text-center mb-10">
                        {/* Netic Brand Mark */}
                        <div className="flex items-center justify-center mb-6">
                            {/* Netic SVG Wordmark (Large) */}
                            <div className="flex items-center gap-4">
                                {/* The Visual Mark (Stylized N) */}
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white">
                                    <path d="M4 20V4L20 20V4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>

                                {/* The Wordmark (Lowercase 'netic') */}
                                <span className="text-6xl font-medium tracking-tight text-white font-sans lowercase">
                                    netic
                                </span>
                            </div>
                        </div>

                        {/* Sarah Avatar */}
                        <div className="relative w-28 h-28 mx-auto mb-6">
                            <div className="absolute inset-0 bg-emerald-900/40 rounded-full"></div>
                            <img
                                src="/sarah-welcome.png"
                                alt="Sarah"
                                className="relative w-full h-full object-cover rounded-full border border-white/20 shadow-2xl"
                            />
                        </div>

                        <h1 className="text-5xl font-serif font-normal text-white mb-4">
                            Sarah
                        </h1>
                        <p className="text-emerald-100/80 text-lg font-light max-w-sm mx-auto font-sans">
                            Your complete autonomous revenue engine.
                        </p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
                        <div className="space-y-4">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your Name"
                                required
                                className="w-full px-6 py-4 bg-[#0A2F20] border border-emerald-800/50 rounded-full text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all text-center font-sans"
                            />

                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Work Email"
                                required
                                className="w-full px-6 py-4 bg-[#0A2F20] border border-emerald-800/50 rounded-full text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all text-center font-sans"
                            />

                            <input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                placeholder="Access Code"
                                required
                                className="w-full px-6 py-4 bg-[#0A2F20] border border-emerald-800/50 rounded-full text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all text-center font-sans"
                            />
                        </div>

                        {error && (
                            <div className="text-white text-sm bg-red-500/20 border border-red-500/30 rounded-full px-6 py-2 text-center">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !name || !email || !token}
                            className="w-full py-4 bg-white hover:bg-emerald-50 text-[#0B3B28] font-medium rounded-full shadow-lg transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed mt-4 font-sans tracking-wide"
                        >
                            {loading ? 'Authenticating...' : 'Initialize Session'}
                        </button>
                    </form>

                    <div className="mt-12 text-center space-y-4">
                        <button onClick={() => setIsRequestOpen(true)} className="text-emerald-200/60 hover:text-white text-sm transition-colors font-sans">
                            Request Access
                        </button>
                    </div>
                </div>
            </div>

            {/* Request Access Modal - Themed */}
            {mounted && isRequestOpen && createPortal(
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[#051c13]/90 backdrop-blur-sm">
                    <div className="bg-[#0B3B28] border border-emerald-800 rounded-3xl p-10 w-full max-w-md shadow-2xl relative">
                        <button
                            onClick={() => setIsRequestOpen(false)}
                            className="absolute top-6 right-6 text-emerald-400/50 hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <h2 className="text-3xl font-serif text-white mb-2">Request Access</h2>
                        <p className="text-emerald-100/60 text-sm mb-8 font-sans">Join the autonomous revolution.</p>

                        {reqSuccess ? (
                            <div className="text-center py-8">
                                <h3 className="text-xl font-serif text-white mb-2">Request Sent</h3>
                                <p className="text-emerald-100/60 text-sm font-sans">We will be in touch shortly.</p>
                                <button
                                    onClick={() => setIsRequestOpen(false)}
                                    className="mt-8 px-8 py-3 bg-white text-[#0B3B28] rounded-full font-medium transition-colors font-sans"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleRequestSubmit} className="space-y-4">
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    value={reqName}
                                    onChange={e => setReqName(e.target.value)}
                                    required
                                    className="w-full px-6 py-3 bg-[#0A2F20] border border-emerald-800/50 rounded-full text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all font-sans"
                                />
                                <input
                                    type="email"
                                    placeholder="Company Email"
                                    value={reqEmail}
                                    onChange={e => setReqEmail(e.target.value)}
                                    required
                                    className="w-full px-6 py-3 bg-[#0A2F20] border border-emerald-800/50 rounded-full text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all font-sans"
                                />

                                {reqError && <p className="text-red-300 text-sm text-center">{reqError}</p>}

                                <button
                                    type="submit"
                                    disabled={reqLoading}
                                    className="w-full py-3 bg-white hover:bg-emerald-50 text-[#0B3B28] font-medium rounded-full shadow-lg transition-all disabled:opacity-50 mt-4 font-sans"
                                >
                                    {reqLoading ? 'Sending...' : 'Submit Request'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
