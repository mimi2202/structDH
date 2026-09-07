import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { FiArrowLeft, FiLock, FiEye, FiEyeOff } from 'react-icons/fi'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { resetPasswordSchema } from '../utils/validation'

const ResetPassword = () => {
  const { isDarkMode } = useTheme()
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const { token } = useParams()
  const [showPassword, setShowPassword] = useState(false)
  ;[showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(resetPasswordSchema),
  })

  const onSubmit = async (data) => {
    setIsSubmitting(true)
    setServerError('')

    const result = await resetPassword(token, data.password)

    if (result.success) {
      // Redirect to login with success message
      navigate('/login', {
        state: { message: 'Password reset successful. Please login with your new password.' },
      })
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
      <div
        className="p-8 rounded-xl shadow-lg max-w-md w-full transition-colors duration-300"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid var(--border-color)`,
        }}
      >
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
            Enter your new password below
          </p>
        </div>

        {serverError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* New Password */}
          <div className="relative">
            <FiLock
              className="absolute left-3 top-1/2 transform -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              placeholder="New password"
              className="w-full pl-10 pr-12 py-3 rounded-lg transition-colors duration-300"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: `1px solid ${errors.password ? '#ef4444' : 'var(--border-color)'}`,
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
          )}

          {/* Confirm Password */}
          <div className="relative">
            <FiLock
              className="absolute left-3 top-1/2 transform -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              {...register('confirmPassword')}
              placeholder="Confirm new password"
              className="w-full pl-10 pr-12 py-3 rounded-lg transition-colors duration-300"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: `1px solid ${errors.confirmPassword ? '#ef4444' : 'var(--border-color)'}`,
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            >
              {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-red-500 mt-1">{errors.confirmPassword.message}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-300 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#0A2F44' }}
          >
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
