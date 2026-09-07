import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { FiArrowLeft, FiMail, FiCheckCircle, FiSun, FiMoon } from 'react-icons/fi'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { forgotPasswordSchema } from '../utils/validation'

const ForgotPassword = () => {
  const [emailSent, setEmailSent] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { forgotPassword } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data) => {
    setIsSubmitting(true)
    setServerError('')

    const result = await forgotPassword(data.email)

    if (result.success) {
      setSubmittedEmail(data.email)
      setEmailSent(true)
    } else {
      setServerError(result.error)
    }

    setIsSubmitting(false)
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Dark mode toggle */}
      <button
        onClick={toggleDarkMode}
        className="absolute top-4 right-4 p-3 rounded-lg shadow-lg hover:shadow-xl transition-all z-10 cursor-pointer"
        style={{
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
        }}
        aria-label="Toggle theme"
      >
        {isDarkMode ? (
          <FiSun className="text-2xl" style={{ color: 'var(--text-primary)' }} />
        ) : (
          <FiMoon className="text-2xl" style={{ color: 'var(--primary)' }} />
        )}
      </button>

      <div
        className="p-8 rounded-xl shadow-lg max-w-md w-full transition-colors duration-300"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid var(--border-color)`,
        }}
      >
        {/* Back to login link */}
        <Link
          to="/login"
          className="inline-flex items-center text-sm hover:underline mb-6 transition-colors duration-300"
          style={{ color: 'var(--accent)' }}
        >
          <FiArrowLeft className="mr-2" /> Back to login
        </Link>

        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: '#0A2F44' }}
          >
            <span className="text-white text-2xl font-bold">SA</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Reset your password
          </h1>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
            {emailSent
              ? 'Check your email for reset instructions'
              : "Enter your email and we'll send you a reset link"}
          </p>
        </div>

        {/* Server error message */}
        {serverError && !emailSent && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {serverError}
          </div>
        )}

        {emailSent ? (
          /* Success state */
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-[#e8f5e9] dark:bg-[#1e3a4a] rounded-full flex items-center justify-center mx-auto mb-4">
              <FiCheckCircle className="text-3xl" style={{ color: 'var(--accent)' }} />
            </div>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              We've sent an email to:
            </p>
            <p className="font-semibold mt-1" style={{ color: 'var(--accent)' }}>
              {submittedEmail}
            </p>
            <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
              Didn't receive it?{' '}
              <button
                onClick={() => setEmailSent(false)}
                className="font-medium hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Try again
              </button>
            </p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <div className="relative">
              <FiMail
                className="absolute left-3 top-1/2 transform -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="email"
                {...register('email')}
                placeholder="Email address"
                className="w-full pl-10 pr-4 py-3 rounded-lg transition-colors duration-300"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: `1px solid ${errors.email ? '#ef4444' : 'var(--border-color)'}`,
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-300 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#0A2F44' }}
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
          Remember your password?{' '}
          <Link
            to="/login"
            className="font-medium hover:underline transition-all duration-200"
            style={{ color: 'var(--accent)' }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default ForgotPassword
