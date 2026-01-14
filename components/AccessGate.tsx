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
                            {/* Netic Official SVG (Scraped) wrapped in container */}
                            <div className="relative h-12 w-auto my-4">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-full w-auto fill-white"
                                    viewBox="0 0 81 23"
                                >
                                    <path d="M0 22.1285H2.55994V8.70024H5.48559C5.87742 8.70024 6.19088 8.93908 6.34761 9.31062L10.7361 20.032C11.2585 21.3323 12.434 22.1285 13.8185 22.1285H19.3302V6.20567H16.7702V19.6339H13.8707C13.4789 19.6339 13.1654 19.3951 13.0087 19.0235L8.62021 8.30217C8.09777 7.00181 6.92229 6.20567 5.53783 6.20567H0V22.1285ZM30.7193 22.5C34.0629 22.5 36.6228 21.5446 38.4775 19.7931L36.8057 17.962C35.2122 19.5012 33.018 20.0054 30.7193 20.0054C27.4802 20.0054 25.2337 18.0416 24.9202 14.9367H39.2873V14.114C39.2873 9.09831 35.6563 5.78106 30.7193 5.78106C25.8084 5.78106 22.2036 9.12485 22.2036 14.114C22.2036 19.1297 25.7823 22.5 30.7193 22.5ZM25.0247 12.6544C25.5733 9.94753 27.7153 8.27563 30.7193 8.27563C33.6972 8.27563 35.9175 9.89445 36.4922 12.6544H25.0247ZM48.4038 22.1285H52.4004V19.6339H47.8291C46.8365 19.6339 46.2618 19.0501 46.2618 18.0416V8.75332H52.6616V6.25875H46.2618V2.27805H43.7541V6.25875H40.5933V8.75332H43.7018V17.3516C43.7018 20.1381 45.661 22.1285 48.4038 22.1285ZM59.4011 22.1285H61.961V9.97406C61.961 7.79795 60.4459 6.25875 58.304 6.25875H54.4902V8.75332H58.3562C59.0092 8.75332 59.4011 9.15139 59.4011 9.81484V22.1285ZM59.2182 3.81725H62.3006V0.5H59.2182V3.81725ZM73.6897 22.5C76.7721 22.5 78.888 21.5712 80.6643 19.7931L79.0708 18.0682C77.8431 19.4481 76.2235 20.0054 73.6897 20.0054C70.1371 20.0054 67.5772 17.8028 67.5772 14.1936C67.5772 10.5579 70.111 8.27563 73.6897 8.27563C76.119 8.27563 77.5296 8.85947 79.1753 10.611L80.821 8.80639C79.2014 6.94873 76.7982 5.78106 73.6897 5.78106C68.7004 5.78106 64.9128 9.12485 64.9128 14.1936C64.9128 19.2358 68.7266 22.5 73.6897 22.5Z" />
                                </svg>
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
                                    type="text"
                                    placeholder="Company Name"
                                    value={reqCompany}
                                    onChange={e => setReqCompany(e.target.value)}
                                    className="w-full px-6 py-3 bg-[#0A2F20] border border-emerald-800/50 rounded-full text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all font-sans"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        type="tel"
                                        placeholder="Phone"
                                        value={reqPhone}
                                        onChange={e => setReqPhone(e.target.value)}
                                        className="w-full px-6 py-3 bg-[#0A2F20] border border-emerald-800/50 rounded-full text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all font-sans"
                                    />
                                    <input
                                        type="url"
                                        placeholder="Website"
                                        value={reqWebsite}
                                        onChange={e => setReqWebsite(e.target.value)}
                                        className="w-full px-6 py-3 bg-[#0A2F20] border border-emerald-800/50 rounded-full text-white placeholder-emerald-100/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/50 transition-all font-sans"
                                    />
                                </div>
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
