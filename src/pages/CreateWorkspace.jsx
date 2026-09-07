import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  FiArrowLeft,
  FiSun,
  FiMoon,
  FiHome,
  FiBriefcase,
  FiTool,
  FiChevronRight,
  FiChevronLeft,
  FiInfo,
  FiLoader,
  FiUsers,
  FiUser,
  FiMail,
  FiPlus,
  FiX,
  FiChevronDown,
  FiCheck,
  FiEye,
  FiGlobe,
  FiSearch,
  FiAlertCircle,
  FiGrid,
  FiLayers,
  FiBarChart2,
  FiDollarSign,
  FiTrendingUp, // Added new icons
} from 'react-icons/fi'
import ReactDOM from 'react-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useWorkspace } from '../contexts/WorkspaceContext'

const CreateWorkspace = () => {
  const { workspaceId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isDarkMode, toggleDarkMode } = useTheme()
  const { createWorkspace, inviteMember } = useWorkspace()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showLoading, setShowLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)

  const [isRoleOpen, setIsRoleOpen] = useState(false)
  const [isProfessionOpen, setIsProfessionOpen] = useState(false) // Added for profession dropdown

  const [isLocationOpen, setIsLocationOpen] = useState(false)
  const [locationSearch, setLocationSearch] = useState('')
  const [selectedCode, setSelectedCode] = useState('Eurocode')
  const locationButtonRef = useRef(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })

  // Team invite state
  const [invites, setInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteProfession, setInviteProfession] = useState('structural_engineer') // Added for profession
  const [showInviteInput, setShowInviteInput] = useState(false)
  const [skipInvite, setSkipInvite] = useState(false)

  // Helper function to get profession label
  const getProfessionLabel = (profession) => {
    const professions = {
      structural_engineer: 'Structural Engineer',
      architect: 'Architect',
      civil_engineer: 'Civil Engineer',
      project_manager: 'Project Manager',
      quantity_surveyor: 'Quantity Surveyor',
      analyst: 'Analyst',
    }
    return professions[profession] || 'Select Profession'
  }

  // Helper function to get profession icon
  const getProfessionIcon = (profession) => {
    const icons = {
      structural_engineer: FiGrid,
      architect: FiLayers,
      civil_engineer: FiBarChart2,
      project_manager: FiUsers,
      quantity_surveyor: FiDollarSign,
      analyst: FiTrendingUp,
    }
    return icons[profession] || FiUser
  }

  // ISO-style country source
  const baseCountries = [
    // Africa
    { name: 'Algeria', iso2: 'DZ', region: 'Africa' },
    { name: 'Angola', iso2: 'AO', region: 'Africa' },
    { name: 'Benin', iso2: 'BJ', region: 'Africa' },
    { name: 'Botswana', iso2: 'BW', region: 'Africa' },
    { name: 'Burkina Faso', iso2: 'BF', region: 'Africa' },
    { name: 'Burundi', iso2: 'BI', region: 'Africa' },
    { name: 'Cabo Verde', iso2: 'CV', region: 'Africa' },
    { name: 'Cameroon', iso2: 'CM', region: 'Africa' },
    { name: 'Central African Republic', iso2: 'CF', region: 'Africa' },
    { name: 'Chad', iso2: 'TD', region: 'Africa' },
    { name: 'Comoros', iso2: 'KM', region: 'Africa' },
    { name: 'Congo', iso2: 'CG', region: 'Africa' },
    { name: 'Democratic Republic of the Congo', iso2: 'CD', region: 'Africa' },
    { name: 'Djibouti', iso2: 'DJ', region: 'Africa' },
    { name: 'Egypt', iso2: 'EG', region: 'Africa' },
    { name: 'Equatorial Guinea', iso2: 'GQ', region: 'Africa' },
    { name: 'Eritrea', iso2: 'ER', region: 'Africa' },
    { name: 'Eswatini', iso2: 'SZ', region: 'Africa' },
    { name: 'Ethiopia', iso2: 'ET', region: 'Africa' },
    { name: 'Gabon', iso2: 'GA', region: 'Africa' },
    { name: 'Gambia', iso2: 'GM', region: 'Africa' },
    { name: 'Ghana', iso2: 'GH', region: 'Africa' },
    { name: 'Guinea', iso2: 'GN', region: 'Africa' },
    { name: 'Guinea-Bissau', iso2: 'GW', region: 'Africa' },
    { name: 'Côte d’Ivoire', iso2: 'CI', region: 'Africa' },
    { name: 'Kenya', iso2: 'KE', region: 'Africa' },
    { name: 'Lesotho', iso2: 'LS', region: 'Africa' },
    { name: 'Liberia', iso2: 'LR', region: 'Africa' },
    { name: 'Libya', iso2: 'LY', region: 'Africa' },
    { name: 'Madagascar', iso2: 'MG', region: 'Africa' },
    { name: 'Malawi', iso2: 'MW', region: 'Africa' },
    { name: 'Mali', iso2: 'ML', region: 'Africa' },
    { name: 'Mauritania', iso2: 'MR', region: 'Africa' },
    { name: 'Mauritius', iso2: 'MU', region: 'Africa' },
    { name: 'Morocco', iso2: 'MA', region: 'Africa' },
    { name: 'Mozambique', iso2: 'MZ', region: 'Africa' },
    { name: 'Namibia', iso2: 'NA', region: 'Africa' },
    { name: 'Niger', iso2: 'NE', region: 'Africa' },
    { name: 'Nigeria', iso2: 'NG', region: 'Africa' },
    { name: 'Rwanda', iso2: 'RW', region: 'Africa' },
    { name: 'Sao Tome and Principe', iso2: 'ST', region: 'Africa' },
    { name: 'Senegal', iso2: 'SN', region: 'Africa' },
    { name: 'Seychelles', iso2: 'SC', region: 'Africa' },
    { name: 'Sierra Leone', iso2: 'SL', region: 'Africa' },
    { name: 'Somalia', iso2: 'SO', region: 'Africa' },
    { name: 'South Africa', iso2: 'ZA', region: 'Africa' },
    { name: 'South Sudan', iso2: 'SS', region: 'Africa' },
    { name: 'Sudan', iso2: 'SD', region: 'Africa' },
    { name: 'Tanzania', iso2: 'TZ', region: 'Africa' },
    { name: 'Togo', iso2: 'TG', region: 'Africa' },
    { name: 'Tunisia', iso2: 'TN', region: 'Africa' },
    { name: 'Uganda', iso2: 'UG', region: 'Africa' },
    { name: 'Zambia', iso2: 'ZM', region: 'Africa' },
    { name: 'Zimbabwe', iso2: 'ZW', region: 'Africa' },

    // Asia
    { name: 'Afghanistan', iso2: 'AF', region: 'Asia' },
    { name: 'Armenia', iso2: 'AM', region: 'Asia' },
    { name: 'Azerbaijan', iso2: 'AZ', region: 'Asia' },
    { name: 'Bahrain', iso2: 'BH', region: 'Asia' },
    { name: 'Bangladesh', iso2: 'BD', region: 'Asia' },
    { name: 'Bhutan', iso2: 'BT', region: 'Asia' },
    { name: 'Brunei', iso2: 'BN', region: 'Asia' },
    { name: 'Cambodia', iso2: 'KH', region: 'Asia' },
    { name: 'China', iso2: 'CN', region: 'Asia' },
    { name: 'Cyprus', iso2: 'CY', region: 'Asia' },
    { name: 'Georgia', iso2: 'GE', region: 'Asia' },
    { name: 'India', iso2: 'IN', region: 'Asia' },
    { name: 'Indonesia', iso2: 'ID', region: 'Asia' },
    { name: 'Iran', iso2: 'IR', region: 'Asia' },
    { name: 'Iraq', iso2: 'IQ', region: 'Asia' },
    { name: 'Israel', iso2: 'IL', region: 'Asia' },
    { name: 'Japan', iso2: 'JP', region: 'Asia' },
    { name: 'Jordan', iso2: 'JO', region: 'Asia' },
    { name: 'Kazakhstan', iso2: 'KZ', region: 'Asia' },
    { name: 'Kuwait', iso2: 'KW', region: 'Asia' },
    { name: 'Kyrgyzstan', iso2: 'KG', region: 'Asia' },
    { name: 'Laos', iso2: 'LA', region: 'Asia' },
    { name: 'Lebanon', iso2: 'LB', region: 'Asia' },
    { name: 'Malaysia', iso2: 'MY', region: 'Asia' },
    { name: 'Maldives', iso2: 'MV', region: 'Asia' },
    { name: 'Mongolia', iso2: 'MN', region: 'Asia' },
    { name: 'Myanmar', iso2: 'MM', region: 'Asia' },
    { name: 'Nepal', iso2: 'NP', region: 'Asia' },
    { name: 'North Korea', iso2: 'KP', region: 'Asia' },
    { name: 'Oman', iso2: 'OM', region: 'Asia' },
    { name: 'Pakistan', iso2: 'PK', region: 'Asia' },
    { name: 'Palestine', iso2: 'PS', region: 'Asia' },
    { name: 'Philippines', iso2: 'PH', region: 'Asia' },
    { name: 'Qatar', iso2: 'QA', region: 'Asia' },
    { name: 'Saudi Arabia', iso2: 'SA', region: 'Asia' },
    { name: 'Singapore', iso2: 'SG', region: 'Asia' },
    { name: 'South Korea', iso2: 'KR', region: 'Asia' },
    { name: 'Sri Lanka', iso2: 'LK', region: 'Asia' },
    { name: 'Syria', iso2: 'SY', region: 'Asia' },
    { name: 'Taiwan', iso2: 'TW', region: 'Asia' },
    { name: 'Tajikistan', iso2: 'TJ', region: 'Asia' },
    { name: 'Thailand', iso2: 'TH', region: 'Asia' },
    { name: 'Timor-Leste', iso2: 'TL', region: 'Asia' },
    { name: 'Turkey', iso2: 'TR', region: 'Asia' },
    { name: 'Turkmenistan', iso2: 'TM', region: 'Asia' },
    { name: 'United Arab Emirates', iso2: 'AE', region: 'Asia' },
    { name: 'Uzbekistan', iso2: 'UZ', region: 'Asia' },
    { name: 'Vietnam', iso2: 'VN', region: 'Asia' },
    { name: 'Yemen', iso2: 'YE', region: 'Asia' },

    // Europe
    { name: 'Albania', iso2: 'AL', region: 'Europe' },
    { name: 'Andorra', iso2: 'AD', region: 'Europe' },
    { name: 'Austria', iso2: 'AT', region: 'Europe' },
    { name: 'Belarus', iso2: 'BY', region: 'Europe' },
    { name: 'Belgium', iso2: 'BE', region: 'Europe' },
    { name: 'Bosnia and Herzegovina', iso2: 'BA', region: 'Europe' },
    { name: 'Bulgaria', iso2: 'BG', region: 'Europe' },
    { name: 'Croatia', iso2: 'HR', region: 'Europe' },
    { name: 'Czech Republic', iso2: 'CZ', region: 'Europe' },
    { name: 'Denmark', iso2: 'DK', region: 'Europe' },
    { name: 'Estonia', iso2: 'EE', region: 'Europe' },
    { name: 'Finland', iso2: 'FI', region: 'Europe' },
    { name: 'France', iso2: 'FR', region: 'Europe' },
    { name: 'Germany', iso2: 'DE', region: 'Europe' },
    { name: 'Greece', iso2: 'GR', region: 'Europe' },
    { name: 'Hungary', iso2: 'HU', region: 'Europe' },
    { name: 'Iceland', iso2: 'IS', region: 'Europe' },
    { name: 'Ireland', iso2: 'IE', region: 'Europe' },
    { name: 'Italy', iso2: 'IT', region: 'Europe' },
    { name: 'Kosovo', iso2: 'XK', region: 'Europe' },
    { name: 'Latvia', iso2: 'LV', region: 'Europe' },
    { name: 'Liechtenstein', iso2: 'LI', region: 'Europe' },
    { name: 'Lithuania', iso2: 'LT', region: 'Europe' },
    { name: 'Luxembourg', iso2: 'LU', region: 'Europe' },
    { name: 'Malta', iso2: 'MT', region: 'Europe' },
    { name: 'Moldova', iso2: 'MD', region: 'Europe' },
    { name: 'Monaco', iso2: 'MC', region: 'Europe' },
    { name: 'Montenegro', iso2: 'ME', region: 'Europe' },
    { name: 'Netherlands', iso2: 'NL', region: 'Europe' },
    { name: 'North Macedonia', iso2: 'MK', region: 'Europe' },
    { name: 'Norway', iso2: 'NO', region: 'Europe' },
    { name: 'Poland', iso2: 'PL', region: 'Europe' },
    { name: 'Portugal', iso2: 'PT', region: 'Europe' },
    { name: 'Romania', iso2: 'RO', region: 'Europe' },
    { name: 'Russia', iso2: 'RU', region: 'Europe' },
    { name: 'San Marino', iso2: 'SM', region: 'Europe' },
    { name: 'Serbia', iso2: 'RS', region: 'Europe' },
    { name: 'Slovakia', iso2: 'SK', region: 'Europe' },
    { name: 'Slovenia', iso2: 'SI', region: 'Europe' },
    { name: 'Spain', iso2: 'ES', region: 'Europe' },
    { name: 'Sweden', iso2: 'SE', region: 'Europe' },
    { name: 'Switzerland', iso2: 'CH', region: 'Europe' },
    { name: 'Ukraine', iso2: 'UA', region: 'Europe' },
    { name: 'United Kingdom', iso2: 'GB', region: 'Europe' },
    { name: 'England', iso2: 'GB', region: 'Europe' },
    { name: 'Scotland', iso2: 'GB', region: 'Europe' },
    { name: 'Wales', iso2: 'GB', region: 'Europe' },
    { name: 'Northern Ireland', iso2: 'GB', region: 'Europe' },
    { name: 'Vatican City', iso2: 'VA', region: 'Europe' },

    // North America
    { name: 'Antigua and Barbuda', iso2: 'AG', region: 'North America' },
    { name: 'Bahamas', iso2: 'BS', region: 'North America' },
    { name: 'Barbados', iso2: 'BB', region: 'North America' },
    { name: 'Belize', iso2: 'BZ', region: 'North America' },
    { name: 'Canada', iso2: 'CA', region: 'North America' },
    { name: 'Costa Rica', iso2: 'CR', region: 'North America' },
    { name: 'Cuba', iso2: 'CU', region: 'North America' },
    { name: 'Dominica', iso2: 'DM', region: 'North America' },
    { name: 'Dominican Republic', iso2: 'DO', region: 'North America' },
    { name: 'El Salvador', iso2: 'SV', region: 'North America' },
    { name: 'Grenada', iso2: 'GD', region: 'North America' },
    { name: 'Guatemala', iso2: 'GT', region: 'North America' },
    { name: 'Haiti', iso2: 'HT', region: 'North America' },
    { name: 'Honduras', iso2: 'HN', region: 'North America' },
    { name: 'Jamaica', iso2: 'JM', region: 'North America' },
    { name: 'Mexico', iso2: 'MX', region: 'North America' },
    { name: 'Nicaragua', iso2: 'NI', region: 'North America' },
    { name: 'Panama', iso2: 'PA', region: 'North America' },
    { name: 'Saint Kitts and Nevis', iso2: 'KN', region: 'North America' },
    { name: 'Saint Lucia', iso2: 'LC', region: 'North America' },
    { name: 'Saint Vincent and the Grenadines', iso2: 'VC', region: 'North America' },
    { name: 'Trinidad and Tobago', iso2: 'TT', region: 'North America' },
    { name: 'United States', iso2: 'US', region: 'North America' },

    // South America
    { name: 'Argentina', iso2: 'AR', region: 'South America' },
    { name: 'Bolivia', iso2: 'BO', region: 'South America' },
    { name: 'Brazil', iso2: 'BR', region: 'South America' },
    { name: 'Chile', iso2: 'CL', region: 'South America' },
    { name: 'Colombia', iso2: 'CO', region: 'South America' },
    { name: 'Ecuador', iso2: 'EC', region: 'South America' },
    { name: 'Guyana', iso2: 'GY', region: 'South America' },
    { name: 'Paraguay', iso2: 'PY', region: 'South America' },
    { name: 'Peru', iso2: 'PE', region: 'South America' },
    { name: 'Suriname', iso2: 'SR', region: 'South America' },
    { name: 'Uruguay', iso2: 'UY', region: 'South America' },
    { name: 'Venezuela', iso2: 'VE', region: 'South America' },

    // Oceania
    { name: 'Australia', iso2: 'AU', region: 'Oceania' },
    { name: 'Fiji', iso2: 'FJ', region: 'Oceania' },
    { name: 'Kiribati', iso2: 'KI', region: 'Oceania' },
    { name: 'Marshall Islands', iso2: 'MH', region: 'Oceania' },
    { name: 'Micronesia', iso2: 'FM', region: 'Oceania' },
    { name: 'Nauru', iso2: 'NR', region: 'Oceania' },
    { name: 'New Zealand', iso2: 'NZ', region: 'Oceania' },
    { name: 'Palau', iso2: 'PW', region: 'Oceania' },
    { name: 'Papua New Guinea', iso2: 'PG', region: 'Oceania' },
    { name: 'Samoa', iso2: 'WS', region: 'Oceania' },
    { name: 'Solomon Islands', iso2: 'SB', region: 'Oceania' },
    { name: 'Tonga', iso2: 'TO', region: 'Oceania' },
    { name: 'Tuvalu', iso2: 'TV', region: 'Oceania' },
    { name: 'Vanuatu', iso2: 'VU', region: 'Oceania' },
  ]

  const buildingTypes = [
    { value: 'residential', label: 'Residential', icon: FiHome },
    { value: 'commercial', label: 'Commercial', icon: FiBriefcase },
    { value: 'industrial', label: 'Industrial', icon: FiTool },
  ]

  // Converts ISO code to emoji flag
  const isoToFlag = (iso2) =>
    iso2
      .toUpperCase()
      .split('')
      .map((char) => String.fromCodePoint(127397 + char.charCodeAt()))
      .join('')

  // Countries using British Standards
  const bsCountries = new Set([
    'United Kingdom',
    'England',
    'Scotland',
    'Wales',
    'Northern Ireland',
  ])

  // Countries you want to mark as Eurocode
  const eurocodeCountries = new Set([
    'Albania',
    'Andorra',
    'Austria',
    'Belgium',
    'Bosnia and Herzegovina',
    'Bulgaria',
    'Croatia',
    'Cyprus',
    'Czech Republic',
    'Denmark',
    'Estonia',
    'Finland',
    'France',
    'Germany',
    'Greece',
    'Hungary',
    'Iceland',
    'Ireland',
    'Italy',
    'Kosovo',
    'Latvia',
    'Liechtenstein',
    'Lithuania',
    'Luxembourg',
    'Malta',
    'Monaco',
    'Montenegro',
    'Netherlands',
    'North Macedonia',
    'Norway',
    'Poland',
    'Portugal',
    'Romania',
    'San Marino',
    'Serbia',
    'Slovakia',
    'Slovenia',
    'Spain',
    'Sweden',
    'Switzerland',
    'Turkey',
    'Ukraine',
    'Vatican City',
  ])

  const getDesignCode = (countryName) => {
    if (bsCountries.has(countryName)) return 'BS'
    if (eurocodeCountries.has(countryName)) return 'Eurocode'
    return 'unsupported'
  }

  const countries = baseCountries.map((country) => ({
    name: country.name,
    flag: isoToFlag(country.iso2),
    code: getDesignCode(country.name),
    region: country.region,
  }))

  const filteredLocations = countries.filter((country) =>
    country.name.toLowerCase().includes(locationSearch.toLowerCase())
  )

  // Check if coming from New Design conversion
  const isFromDesign = new URLSearchParams(location.search).get('fromDesign') === 'true'
  const designName = new URLSearchParams(location.search).get('name') || ''
  const designElement = new URLSearchParams(location.search).get('element') || 'slab'

  // Form state
  const [formData, setFormData] = useState({
    // Workspace Info
    workspaceName: isFromDesign ? designName : '',
    workspaceType: 'personal',

    // Project Info
    buildingType: 'commercial',
    location: 'London, UK',
    description: '',
  })

  const [errors, setErrors] = useState({})

  // Loading animation effect
  useEffect(() => {
    if (showLoading) {
      const interval = setInterval(() => {
        setLoadingProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 10
        })
      }, 300)
      return () => clearInterval(interval)
    }
  }, [showLoading])

  // Auto-hide loading and create project
  useEffect(() => {
    if (loadingProgress >= 100) {
      setTimeout(() => {
        setShowLoading(false)
        handleCreateProject()
      }, 0)
    }
  }, [loadingProgress])

  useEffect(() => {
    if (isLocationOpen && locationButtonRef.current) {
      const rect = locationButtonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }, [isLocationOpen])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (locationButtonRef.current && !locationButtonRef.current.contains(event.target)) {
        const dropdown = document.getElementById('location-dropdown')
        if (dropdown && !dropdown.contains(event.target)) {
          setIsLocationOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddInvite = () => {
    // Check if email is valid
    if (!inviteEmail.trim()) {
      alert('Please enter an email address')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail.trim())) {
      alert('Please enter a valid email address')
      return
    }

    // Add the invite
    const newInvite = {
      email: inviteEmail.trim(),
      role: inviteRole,
      profession: inviteProfession,
    }

    setInvites((prev) => [...prev, newInvite])

    // Reset form
    setInviteEmail('')
    setInviteRole('member')
    setInviteProfession('structural_engineer')
    setShowInviteInput(false)
  }

  const handleRemoveInvite = (index) => {
    setInvites(invites.filter((_, i) => i !== index))
  }

  const handleNext = () => {
    if (step === 1) {
      if (!formData.workspaceName.trim()) {
        setErrors({ ...errors, workspaceName: 'Workspace name is required' })
        return
      }
      setErrors({})
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    } else if (step === 3) {
      setShowLoading(true)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleSkipInvite = () => {
    setSkipInvite(true)
    setStep(3)
  }

  const handleCreateProject = async () => {
    setIsSubmitting(true)

    const workspaceData = {
      name: formData.workspaceName,
      type: formData.workspaceType,
    }

    try {
      const workspaceResult = await createWorkspace(workspaceData)

      if (workspaceResult.success) {
        if (invites.length > 0 && !skipInvite) {
          for (const invite of invites) {
            await inviteMember(
              workspaceResult.workspace.id,
              invite.email,
              invite.role,
              invite.profession
            )
          }
        }

        navigate(`/workspace/${workspaceResult.workspace.id}/projects/new/structural-input`)
      } else {
        console.error('Failed to create workspace:', workspaceResult.error)
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Error creating workspace:', error)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827] flex items-start justify-center py-12 px-4 overflow-visible transition-colors duration-300">
      {/* Theme Toggle */}
      <button
        onClick={toggleDarkMode}
        className="absolute top-4 right-4 p-3 rounded-lg bg-white dark:bg-[#1f2937] shadow-lg hover:shadow-xl transition-all z-10 cursor-pointer"
      >
        {isDarkMode ? (
          <FiSun className="text-xl text-yellow-500" />
        ) : (
          <FiMoon className="text-xl text-[#0A2F44]" />
        )}
      </button>

      {/* Main Card */}
      <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-xl max-w-2xl w-full p-8 border border-[#e5e7eb] dark:border-[#374151] relative overflow-visible">
        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-[#0A2F44] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">SA</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#02090d] dark:text-white">
            Create Your Workspace
          </h1>
          <p className="text-sm text-[#6b7280] dark:text-[#9ca3af] mt-2">
            Set up your workspace to start collaborating
          </p>
        </div>

        {/* Progress Steps */}
        {!showLoading && (
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-[#0A2F44] text-white' : 'bg-[#e5e7eb] dark:bg-[#374151] text-[#6b7280]'}`}
              >
                1
              </div>
              <div
                className={`w-16 h-1 mx-2 ${step >= 2 ? 'bg-[#0A2F44]' : 'bg-[#e5e7eb] dark:bg-[#374151]'}`}
              />
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-[#0A2F44] text-white' : 'bg-[#e5e7eb] dark:bg-[#374151] text-[#6b7280]'}`}
              >
                2
              </div>
              <div
                className={`w-16 h-1 mx-2 ${step >= 3 ? 'bg-[#0A2F44]' : 'bg-[#e5e7eb] dark:bg-[#374151]'}`}
              />
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-[#0A2F44] text-white' : 'bg-[#e5e7eb] dark:bg-[#374151] text-[#6b7280]'}`}
              >
                3
              </div>
            </div>
          </div>
        )}

        {/* Loading Splash Screen */}
        {showLoading && (
          <div className="py-12 flex flex-col items-center justify-center min-h-[400px]">
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-[#0A2F44] rounded-2xl flex items-center justify-center animate-pulse">
                <span className="text-white text-4xl font-bold">SA</span>
              </div>
              <div className="absolute -top-2 -right-2">
                <FiLoader className="text-3xl text-[#0A2F44] animate-spin" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[#02090d] dark:text-white mb-4">
              Creating Your Workspace
            </h2>
            <p className="text-[#6b7280] dark:text-[#9ca3af] text-center mb-8 max-w-md">
              Setting up your project structure...
            </p>
            <div className="w-64 h-2 bg-[#e5e7eb] dark:bg-[#374151] rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-[#0A2F44] transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <p className="text-sm text-[#0A2F44] dark:text-[#cce1eb] font-medium">
              {loadingProgress}% Complete
            </p>
          </div>
        )}

        {/* Step 1: Workspace Info */}
        {!showLoading && step === 1 && (
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  name="workspaceName"
                  value={formData.workspaceName}
                  onChange={handleChange}
                  placeholder="e.g., Acme Engineering"
                  className="w-full px-4 py-3 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                  required
                />
                {errors.workspaceName && (
                  <p className="text-red-500 text-xs mt-1">{errors.workspaceName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                  Workspace Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, workspaceType: 'personal' })}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      formData.workspaceType === 'personal'
                        ? 'border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                        : 'border-[#e5e7eb] dark:border-[#374151] hover:border-[#99c2d6]'
                    }`}
                  >
                    <FiUser className="mx-auto text-2xl mb-2 text-[#0A2F44]" />
                    <span className="text-sm font-medium text-[#374151] dark:text-[#d1d5db]">
                      Personal
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, workspaceType: 'team' })}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                      formData.workspaceType === 'team'
                        ? 'border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                        : 'border-[#e5e7eb] dark:border-[#374151] hover:border-[#99c2d6]'
                    }`}
                  >
                    <FiUsers className="mx-auto text-2xl mb-2 text-[#0A2F44]" />
                    <span className="text-sm font-medium text-[#374151] dark:text-[#d1d5db]">
                      Team
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-8 pt-4 border-t border-[#e5e7eb] dark:border-[#374151]">
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center space-x-2 px-6 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors cursor-pointer"
              >
                <span>Continue</span> <FiChevronRight />
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Conditional - Team Invite OR Building Info */}
        {!showLoading && step === 2 && (
          <form onSubmit={(e) => e.preventDefault()}>
            {formData.workspaceType === 'team' ? (
              // Team Invite Screen with Profession
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiUsers className="text-3xl text-[#0A2F44] dark:text-[#66a4c2]" />
                  </div>
                  <h2 className="text-xl font-semibold text-[#02090d] dark:text-white mb-2">
                    Invite Your Team
                  </h2>
                  <p className="text-[#6b7280] dark:text-[#9ca3af] text-center max-w-md mx-auto">
                    Add team members to collaborate on projects
                  </p>
                </div>

                {/* Invite List */}
                {invites.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-[#374151] dark:text-[#d1d5db]">
                      Invited members:
                    </p>
                    {invites.map((invite, index) => {
                      const ProfessionIcon = getProfessionIcon(invite.profession)
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-[#f9fafb] dark:bg-[#374151] rounded-lg border border-[#e5e7eb] dark:border-[#4b5563]"
                        >
                          <div className="flex items-center space-x-3">
                            <FiMail className="text-[#6b7280] dark:text-[#9ca3af]" />
                            <div>
                              <p className="text-sm font-medium text-[#02090d] dark:text-white">
                                {invite.email}
                              </p>
                              <div className="flex items-center space-x-2 mt-0.5">
                                <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] capitalize">
                                  {invite.role}
                                </p>
                                <span className="text-xs text-[#9ca3af]">•</span>
                                <div className="flex items-center space-x-1">
                                  <ProfessionIcon className="text-xs text-[#0A2F44] dark:text-[#66a4c2]" />
                                  <p className="text-xs text-[#0A2F44] dark:text-[#66a4c2]">
                                    {getProfessionLabel(invite.profession)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveInvite(index)}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <FiX />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add Invite Input */}
                {showInviteInput ? (
                  <div className="space-y-4 p-4 bg-[#f9fafb] dark:bg-[#374151] rounded-lg border border-[#e5e7eb] dark:border-[#4b5563]">
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af] dark:text-[#6b7280]" />
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        className="w-full pl-10 pr-4 py-3 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#1f2937] text-[#02090d] dark:text-white placeholder:text-[#9ca3af] dark:placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#0A2F44] transition-all"
                      />
                    </div>

                    {/* Role Dropdown */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                        Role
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsRoleOpen(!isRoleOpen)}
                          className="w-full px-4 py-3 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#1f2937] text-[#02090d] dark:text-white flex items-center justify-between hover:border-[#0A2F44] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                        >
                          <div className="flex items-center space-x-2">
                            {inviteRole === 'member' && <FiUsers className="text-[#0A2F44]" />}
                            {inviteRole === 'admin' && <FiUser className="text-[#0A2F44]" />}
                            {inviteRole === 'viewer' && <FiEye className="text-[#0A2F44]" />}
                            <span>
                              {inviteRole === 'member'
                                ? 'Member'
                                : inviteRole === 'admin'
                                  ? 'Admin'
                                  : 'Viewer'}
                            </span>
                          </div>
                          <FiChevronDown
                            className={`text-[#6b7280] dark:text-[#9ca3af] transition-transform duration-200 ${isRoleOpen ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {isRoleOpen && (
                          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-lg shadow-xl overflow-hidden animate-fade-in">
                            <button
                              type="button"
                              onClick={() => {
                                setInviteRole('member')
                                setIsRoleOpen(false)
                              }}
                              className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors ${
                                inviteRole === 'member' ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]' : ''
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <FiUsers className="text-[#0A2F44]" />
                                <div>
                                  <div className="text-sm font-medium text-[#02090d] dark:text-white">
                                    Member
                                  </div>
                                  <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                                    Can view and create designs
                                  </div>
                                </div>
                              </div>
                              {inviteRole === 'member' && <FiCheck className="text-[#0A2F44]" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setInviteRole('admin')
                                setIsRoleOpen(false)
                              }}
                              className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors ${
                                inviteRole === 'admin' ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]' : ''
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <FiUser className="text-[#0A2F44]" />
                                <div>
                                  <div className="text-sm font-medium text-[#02090d] dark:text-white">
                                    Admin
                                  </div>
                                  <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                                    Can manage members and settings
                                  </div>
                                </div>
                              </div>
                              {inviteRole === 'admin' && <FiCheck className="text-[#0A2F44]" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setInviteRole('viewer')
                                setIsRoleOpen(false)
                              }}
                              className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors ${
                                inviteRole === 'viewer' ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]' : ''
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <FiEye className="text-[#0A2F44]" />
                                <div>
                                  <div className="text-sm font-medium text-[#02090d] dark:text-white">
                                    Viewer
                                  </div>
                                  <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                                    Read-only access
                                  </div>
                                </div>
                              </div>
                              {inviteRole === 'viewer' && <FiCheck className="text-[#0A2F44]" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Profession Dropdown - NEW */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                        Profession
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsProfessionOpen(!isProfessionOpen)}
                          className="w-full px-4 py-3 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#1f2937] text-[#02090d] dark:text-white flex items-center justify-between hover:border-[#0A2F44] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                        >
                          <div className="flex items-center space-x-2">
                            {(() => {
                              const Icon = getProfessionIcon(inviteProfession)
                              return <Icon className="text-[#0A2F44]" />
                            })()}
                            <span>{getProfessionLabel(inviteProfession)}</span>
                          </div>
                          <FiChevronDown
                            className={`text-[#6b7280] dark:text-[#9ca3af] transition-transform duration-200 ${isProfessionOpen ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {isProfessionOpen && (
                          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-lg shadow-xl overflow-hidden animate-fade-in max-h-80 overflow-y-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setInviteProfession('structural_engineer')
                                setIsProfessionOpen(false)
                              }}
                              className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors ${
                                inviteProfession === 'structural_engineer'
                                  ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <FiGrid className="text-[#0A2F44]" />
                                <div>
                                  <div className="text-sm font-medium text-[#02090d] dark:text-white">
                                    Structural Engineer
                                  </div>
                                  <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                                    Designs structural elements, beams, columns, foundations
                                  </div>
                                </div>
                              </div>
                              {inviteProfession === 'structural_engineer' && (
                                <FiCheck className="text-[#0A2F44]" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setInviteProfession('architect')
                                setIsProfessionOpen(false)
                              }}
                              className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors ${
                                inviteProfession === 'architect'
                                  ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <FiLayers className="text-[#0A2F44]" />
                                <div>
                                  <div className="text-sm font-medium text-[#02090d] dark:text-white">
                                    Architect
                                  </div>
                                  <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                                    Focuses on building layout, aesthetics, and spatial planning
                                  </div>
                                </div>
                              </div>
                              {inviteProfession === 'architect' && (
                                <FiCheck className="text-[#0A2F44]" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setInviteProfession('civil_engineer')
                                setIsProfessionOpen(false)
                              }}
                              className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors ${
                                inviteProfession === 'civil_engineer'
                                  ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <FiBarChart2 className="text-[#0A2F44]" />
                                <div>
                                  <div className="text-sm font-medium text-[#02090d] dark:text-white">
                                    Civil Engineer
                                  </div>
                                  <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                                    Oversees site works, foundations, and infrastructure
                                  </div>
                                </div>
                              </div>
                              {inviteProfession === 'civil_engineer' && (
                                <FiCheck className="text-[#0A2F44]" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setInviteProfession('project_manager')
                                setIsProfessionOpen(false)
                              }}
                              className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors ${
                                inviteProfession === 'project_manager'
                                  ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <FiUsers className="text-[#0A2F44]" />
                                <div>
                                  <div className="text-sm font-medium text-[#02090d] dark:text-white">
                                    Project Manager
                                  </div>
                                  <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                                    Coordinates project timeline, budget, and resources
                                  </div>
                                </div>
                              </div>
                              {inviteProfession === 'project_manager' && (
                                <FiCheck className="text-[#0A2F44]" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setInviteProfession('quantity_surveyor')
                                setIsProfessionOpen(false)
                              }}
                              className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors ${
                                inviteProfession === 'quantity_surveyor'
                                  ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <FiDollarSign className="text-[#0A2F44]" />
                                <div>
                                  <div className="text-sm font-medium text-[#02090d] dark:text-white">
                                    Quantity Surveyor
                                  </div>
                                  <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                                    Manages costs, materials, and procurement
                                  </div>
                                </div>
                              </div>
                              {inviteProfession === 'quantity_surveyor' && (
                                <FiCheck className="text-[#0A2F44]" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setInviteProfession('analyst')
                                setIsProfessionOpen(false)
                              }}
                              className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors ${
                                inviteProfession === 'analyst'
                                  ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                                  : ''
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <FiTrendingUp className="text-[#0A2F44]" />
                                <div>
                                  <div className="text-sm font-medium text-[#02090d] dark:text-white">
                                    Analyst
                                  </div>
                                  <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                                    Analyzes structural performance and optimization data
                                  </div>
                                </div>
                              </div>
                              {inviteProfession === 'analyst' && (
                                <FiCheck className="text-[#0A2F44]" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowInviteInput(false)
                          setInviteEmail('')
                          setInviteRole('member')
                          setInviteProfession('structural_engineer')
                        }}
                        className="px-4 py-2 text-sm border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#6b7280] dark:text-[#9ca3af] hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddInvite}
                        className="px-4 py-2 text-sm bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors cursor-pointer"
                      >
                        Add Member
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowInviteInput(true)}
                    className="w-full py-3 border-2 border-dashed border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#0A2F44] dark:text-[#66a4c2] hover:border-[#0A2F44] dark:hover:border-[#66a4c2] transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <FiPlus className="text-[#0A2F44] dark:text-[#66a4c2]" />
                    <span>Invite Member</span>
                  </button>
                )}

                {/* Settings Link */}
                <div className="text-center pt-2">
                  <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
                    You can also{' '}
                    <span className="text-[#0A2F44] dark:text-[#66a4c2] opacity-50 cursor-not-allowed relative group">
                      manage team members later from workspace settings
                      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Will be available after workspace creation
                      </span>
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Building Info Screen (Personal) */}
                <div className="space-y-6 overflow-visible">
                  {/* Building Type */}
                  <div>
                    <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-3">
                      Building Type
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      {buildingTypes.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, buildingType: type.value })}
                          className={`p-4 rounded-lg border-2 text-center transition-all cursor-pointer ${
                            formData.buildingType === type.value
                              ? 'border-[#0A2F44] bg-[#e6f0f5] dark:bg-[#1e3a4a]'
                              : 'border-[#e5e7eb] dark:border-[#374151] hover:border-[#99c2d6]'
                          }`}
                        >
                          <type.icon
                            className={`text-2xl mx-auto mb-2 ${
                              formData.buildingType === type.value
                                ? 'text-[#0A2F44] dark:text-[#66a4c2]'
                                : 'text-[#6b7280] dark:text-[#9ca3af]'
                            }`}
                          />
                          <span
                            className={`text-sm font-medium ${
                              formData.buildingType === type.value
                                ? 'text-[#02090d] dark:text-white'
                                : 'text-[#374151] dark:text-[#d1d5db]'
                            }`}
                          >
                            {type.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Project Description Field */}
                  <div>
                    <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                      Project Description <span className="text-xs text-[#6b7280]">(optional)</span>
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Describe the type of buildings you design, your specialities, or any specific requirements..."
                      rows="4"
                      className="w-full px-4 py-3 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44] resize-none"
                    />
                    <p className="text-xs text-[#6b7280] dark:text-[#9ca3af] mt-1">
                      This helps us tailor recommendations for your projects
                    </p>
                  </div>

                  {/* Location with Aesthetic Dropdown */}
                  <div className="overflow-visible relative">
                    <label className="block text-sm font-medium text-[#374151] dark:text-[#d1d5db] mb-2">
                      Location
                    </label>
                    <div className="relative overflow-visible">
                      <button
                        ref={locationButtonRef}
                        type="button"
                        onClick={() => setIsLocationOpen(!isLocationOpen)}
                        className="w-full px-4 py-3 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white flex items-center justify-between hover:border-[#0A2F44] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <FiGlobe className="text-[#0A2F44] dark:text-[#66a4c2]" />
                          <span>{formData.location}</span>
                        </div>
                        <FiChevronDown
                          className={`text-[#6b7280] transition-transform duration-200 ${isLocationOpen ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {/* PORTAL DROPDOWN */}
                      {isLocationOpen &&
                        ReactDOM.createPortal(
                          <div
                            id="location-dropdown"
                            className="fixed bg-white dark:bg-[#1f2937] border border-[#e5e7eb] dark:border-[#374151] rounded-xl shadow-xl overflow-hidden animate-fade-in"
                            style={{
                              top: dropdownPosition.top,
                              left: dropdownPosition.left,
                              width: dropdownPosition.width,
                              zIndex: 9999,
                            }}
                          >
                            <div className="sticky top-0 p-3 border-b border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#1f2937]">
                              <div className="relative">
                                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#9ca3af]" />
                                <input
                                  type="text"
                                  placeholder="Search country..."
                                  value={locationSearch}
                                  onChange={(e) => setLocationSearch(e.target.value)}
                                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#e5e7eb] dark:border-[#374151] bg-white dark:bg-[#374151] text-[#02090d] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0A2F44]"
                                />
                              </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                              {filteredLocations.map((country) => (
                                <button
                                  key={country.name}
                                  type="button"
                                  onClick={() => {
                                    setFormData({ ...formData, location: country.name })
                                    setSelectedCode(country.code)
                                    setIsLocationOpen(false)
                                    setLocationSearch('')
                                  }}
                                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center space-x-3">
                                    <span className="text-xl">{country.flag}</span>
                                    <div>
                                      <div className="text-sm font-medium text-[#02090d] dark:text-white">
                                        {country.name}
                                      </div>
                                      <div className="text-xs text-[#6b7280] dark:text-[#9ca3af]">
                                        {country.code === 'Eurocode' && '🇪🇺 Eurocode'}
                                        {country.code === 'BS' && '🇬🇧 British Standards'}
                                        {country.code === 'unsupported' && '⚠️ Coming soon'}
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    {country.code !== 'unsupported' ? (
                                      <span
                                        className={`text-xs px-2 py-1 rounded-full ${
                                          country.code === 'Eurocode'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-green-100 text-green-700'
                                        }`}
                                      >
                                        {country.code}
                                      </span>
                                    ) : (
                                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                                        Coming Soon
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>,
                          document.body
                        )}
                    </div>
                  </div>

                  {/* Code Support Message */}
                  {selectedCode === 'unsupported' && (
                    <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start space-x-2">
                        <FiAlertCircle className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Design codes for {formData.location} coming soon.</strong> For
                          now, we recommend using Eurocode or British Standards as an alternative.
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Code Recommendation for Unsupported */}
                  {selectedCode === 'unsupported' && (
                    <div className="mt-3 p-3 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-lg">
                      <p className="text-sm text-[#0A2F44] dark:text-[#cce1eb] flex items-start space-x-2">
                        <FiInfo className="mt-0.5 flex-shrink-0" />
                        <span>
                          <strong>Alternative suggestion:</strong> Use Eurocode (European standard)
                          or British Standards for your design. Both are widely accepted
                          internationally.
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-4 border-t border-[#e5e7eb] dark:border-[#374151]">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center space-x-2 px-6 py-2 border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#374151] dark:text-[#d1d5db] hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
              >
                <FiChevronLeft /> <span>Back</span>
              </button>
              {formData.workspaceType === 'team' && (
                <button
                  type="button"
                  onClick={handleSkipInvite}
                  className="px-6 py-2 text-[#6b7280] hover:text-[#0A2F44] transition-colors"
                >
                  Skip for now
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center space-x-2 px-6 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors cursor-pointer"
              >
                <span>Continue</span> <FiChevronRight />
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Summary */}
        {!showLoading && step === 3 && (
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-6">
              <div className="bg-[#f3f4f6] dark:bg-[#374151] rounded-lg p-6 space-y-4">
                <h3 className="font-semibold text-[#02090d] dark:text-white">Project Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[#6b7280] dark:text-[#9ca3af]">Workspace Name</p>
                    <p className="font-medium text-[#02090d] dark:text-white">
                      {formData.workspaceName}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#6b7280] dark:text-[#9ca3af]">Workspace Type</p>
                    <p className="font-medium text-[#02090d] dark:text-white capitalize">
                      {formData.workspaceType}
                    </p>
                  </div>
                  {formData.workspaceType === 'personal' && (
                    <>
                      <div>
                        <p className="text-[#6b7280] dark:text-[#9ca3af]">Building Type</p>
                        <p className="font-medium text-[#02090d] dark:text-white capitalize">
                          {formData.buildingType}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#6b7280] dark:text-[#9ca3af]">Location</p>
                        <p className="font-medium text-[#02090d] dark:text-white">
                          {formData.location}
                        </p>
                      </div>
                      {formData.description && (
                        <div className="col-span-2">
                          <p className="text-[#6b7280] dark:text-[#9ca3af]">Description</p>
                          <p className="font-medium text-[#02090d] dark:text-white mt-1">
                            {formData.description}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {formData.workspaceType === 'team' && invites.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-[#6b7280] dark:text-[#9ca3af]">Invited Members</p>
                      <div className="space-y-1 mt-1">
                        {invites.map((invite, idx) => {
                          const ProfessionIcon = getProfessionIcon(invite.profession)
                          return (
                            <div key={idx} className="flex items-center space-x-2 text-sm">
                              <span className="text-[#02090d] dark:text-white">{invite.email}</span>
                              <span className="text-[#9ca3af]">•</span>
                              <span className="text-xs capitalize text-[#6b7280]">
                                {invite.role}
                              </span>
                              <span className="text-[#9ca3af]">•</span>
                              <div className="flex items-center space-x-1">
                                <ProfessionIcon className="text-xs text-[#0A2F44]" />
                                <span className="text-xs text-[#0A2F44]">
                                  {getProfessionLabel(invite.profession)}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-lg p-4">
                <p className="text-sm text-[#0A2F44] dark:text-[#cce1eb]">
                  You can invite more team members after creating your workspace from the workspace
                  settings.
                </p>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-4 border-t border-[#e5e7eb] dark:border-[#374151]">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center space-x-2 px-6 py-2 border border-[#e5e7eb] dark:border-[#374151] rounded-lg text-[#374151] dark:text-[#d1d5db] hover:bg-[#f3f4f6] dark:hover:bg-[#374151] transition-colors cursor-pointer"
              >
                <FiChevronLeft /> <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center space-x-2 px-6 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors cursor-pointer"
              >
                <span>Create Project</span> <FiChevronRight />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default CreateWorkspace
