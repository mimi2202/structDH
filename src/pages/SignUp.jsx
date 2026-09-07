import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import {
  FiArrowLeft,
  FiUser,
  FiMail,
  FiLock,
  FiBriefcase,
  FiSun,
  FiMoon,
  FiEye,
  FiEyeOff,
  FiCheckCircle,
  FiAlertCircle,
  FiChevronDown,
  FiCheck,
} from 'react-icons/fi'
import { FcGoogle } from 'react-icons/fc'
import { FaLinkedin } from 'react-icons/fa'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { registerSchema } from '../utils/validation'

// Profession options
const professionOptions = [
  { value: 'structural_engineer', label: 'Structural Engineer', icon: FiBriefcase },
  { value: 'civil_engineer', label: 'Civil Engineer', icon: FiBriefcase },
  { value: 'architect', label: 'Architect', icon: FiBriefcase },
  { value: 'project_manager', label: 'Project Manager', icon: FiBriefcase },
  { value: 'quantity_surveyor', label: 'Quantity Surveyor', icon: FiBriefcase },
  { value: 'analyst', label: 'Analyst', icon: FiBriefcase },
  { value: 'contractor', label: 'Contractor', icon: FiBriefcase },
  { value: 'student', label: 'Student', icon: FiBriefcase },
  { value: 'other', label: 'Other', icon: FiBriefcase },
]

// Custom Dropdown Component
const CustomDropdown = ({ value, onChange, options, placeholder, error }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const selectedOption = options.find((opt) => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full pl-10 pr-4 py-3 rounded-lg border transition-all duration-200 flex items-center justify-between ${
          error
            ? 'border-red-500'
            : 'border-[#e5e7eb] dark:border-[#374151] hover:border-[#0A2F44] dark:hover:border-[#66a4c2]'
        } focus:outline-none focus:ring-2 focus:ring-[#0A2F44]`}
        style={{
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex items-center space-x-2">
          <FiBriefcase style={{ color: 'var(--text-muted)' }} />
          <span>
            {selectedOption ? selectedOption.label : placeholder || 'Select your profession'}
          </span>
        </div>
        <FiChevronDown
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute z-20 w-full mt-1 rounded-lg shadow-xl overflow-hidden animate-fade-in"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
          }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              className="w-full px-4 py-3 text-left flex items-center justify-between transition-colors"
              style={{
                backgroundColor: value === option.value ? 'var(--info-bg)' : 'transparent',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }
              }}
              onMouseLeave={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }
              }}
            >
              <div className="flex items-center space-x-3">
                <option.icon style={{ color: 'var(--accent)' }} />
                <div className="text-sm font-medium">{option.label}</div>
              </div>
              {value === option.value && <FiCheck style={{ color: 'var(--accent)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const SignUp = () => {
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { register: registerUser, createPersonalOrganization } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [profession, setProfession] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    trigger,
  } = useForm({
    resolver: yupResolver(registerSchema),
    defaultValues: {
      termsAccepted: false,
      profession: '',
    },
  })

  const handleProfessionChange = (value) => {
    setProfession(value)
    setValue('profession', value)
    trigger('profession')
  }

  const onSubmit = async (data) => {
    setIsSubmitting(true)
    setServerError('')

    const { confirmPassword, termsAccepted, ...userData } = data

    const result = await registerUser(userData)

    if (result.success) {
      const personalOrgResult = await createPersonalOrganization(result.user.id, result.user.name)

      if (personalOrgResult.success) {
        navigate('/dashboard')
      } else {
        setServerError(
          'Account created but personal workspace setup failed. Please contact support.'
        )
        setIsSubmitting(false)
      }
    } else {
      setServerError(result.error || 'Registration failed. Please try again.')
      setIsSubmitting(false)
    }
  }

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`
  }

  const handleLinkedInLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/linkedin`
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
          <FiMoon className="text-2xl" style={{ color: '#0A2F44' }} />
        )}
      </button>

      {/* Sign Up Card */}
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

        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4 transition-colors duration-300"
            style={{ backgroundColor: '#0A2F44' }}
          >
            <span className="text-white text-2xl font-bold">SA</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Create your account
          </h1>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
            Join StructAI and start optimizing your designs
          </p>
        </div>

        {/* Personal Organization Info Banner - FIXED: Only text color changed */}
        <div
          className="mb-6 rounded-lg p-3 flex items-start space-x-2"
          style={{
            backgroundColor: 'var(--info-bg)',
            border: '1px solid var(--info-border)',
          }}
        >
          <FiCheckCircle className="mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
          <p className="text-xs dark:text-[#cce1eb]">
            A personal organization will be created automatically for you. You can create or join
            other organizations later.
          </p>
        </div>

        {/* Server error message */}
        {serverError && (
          <div
            className="mb-4 p-3 rounded-lg flex items-start space-x-2"
            style={{
              backgroundColor: 'var(--error-bg)',
              border: '1px solid var(--error-border)',
              color: 'var(--error-text)',
            }}
          >
            <FiAlertCircle className="mt-0.5 flex-shrink-0" />
            <span className="text-sm">{serverError}</span>
          </div>
        )}

        {/* Sign up form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Full Name Field */}
          <div className="relative">
            <FiUser
              className="absolute left-3 top-1/2 transform -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              {...register('name')}
              placeholder="Full name"
              className="w-full pl-10 pr-4 py-3 rounded-lg transition-colors duration-300"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: `1px solid ${errors.name ? '#ef4444' : 'var(--border-color)'}`,
                color: 'var(--text-primary)',
              }}
            />
          </div>
          {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}

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

          {/* Profession Field - Aesthetic Custom Dropdown */}
          <div className="relative">
            <CustomDropdown
              value={profession}
              onChange={handleProfessionChange}
              options={professionOptions}
              placeholder="Select your profession"
              error={errors.profession}
            />
            <input type="hidden" {...register('profession')} value={profession} />
          </div>
          {errors.profession && (
            <p className="text-sm text-red-500 mt-1">{errors.profession.message}</p>
          )}

          {/* Password Field */}
          <div className="relative">
            <FiLock
              className="absolute left-3 top-1/2 transform -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              placeholder="Password"
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

          {/* Confirm Password Field */}
          <div className="relative">
            <FiLock
              className="absolute left-3 top-1/2 transform -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              {...register('confirmPassword')}
              placeholder="Confirm password"
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

          {/* Terms and Conditions */}
          <label className="flex items-center">
            <input
              type="checkbox"
              {...register('termsAccepted')}
              className="w-4 h-4 rounded transition-colors duration-300"
              style={{ accentColor: '#0A2F44' }}
            />
            <span className="ml-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              I agree to the{' '}
              <a href="#" className="hover:underline" style={{ color: 'var(--accent)' }}>
                Terms
              </a>{' '}
              and{' '}
              <a href="#" className="hover:underline" style={{ color: 'var(--accent)' }}>
                Privacy Policy
              </a>
            </span>
          </label>
          {errors.termsAccepted && (
            <p className="text-sm text-red-500 mt-1">{errors.termsAccepted.message}</p>
          )}

          {/* Create Account Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-white cursor-pointer font-semibold py-3 px-4 rounded-lg transition-colors duration-300 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#0A2F44' }}
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* OAuth Section */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div
                className="w-full border-t transition-colors duration-300"
                style={{ borderColor: 'var(--border-color)' }}
              ></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span
                className="px-2 transition-colors duration-300"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-muted)',
                }}
              >
                Or sign up with
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex items-center cursor-pointer justify-center space-x-2 py-3 px-4 rounded-lg transition-colors duration-300 hover:opacity-80"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: `1px solid var(--border-color)`,
                color: 'var(--text-secondary)',
              }}
            >
              <FcGoogle className="text-xl" />
              <span>Google</span>
            </button>

            {/* LinkedIn */}
            <button
              type="button"
              onClick={handleLinkedInLogin}
              className="flex items-center cursor-pointer justify-center space-x-2 py-3 px-4 rounded-lg transition-colors duration-300 hover:opacity-80"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: `1px solid var(--border-color)`,
                color: 'var(--text-secondary)',
              }}
            >
              <FaLinkedin className="text-xl" style={{ color: '#0A66C2' }} />
              <span>LinkedIn</span>
            </button>
          </div>
        </div>

        {/* Sign in link */}
        <div className="text-center mt-6">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Already have an account?{' '}
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
    </div>
  )
}

export default SignUp
