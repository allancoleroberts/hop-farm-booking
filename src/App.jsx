import { useState, useEffect } from 'react'

// Brand colors
const colors = {
  smoke: '#32322B',
  dunesGrass: '#767460',
  sand: '#B8A68A',
  stone: '#E1D9CA'
}

// Simple router
function useRoute() {
  const [path, setPath] = useState(window.location.pathname)
  const [search, setSearch] = useState(window.location.search)
  
  useEffect(() => {
    const handler = () => {
      setPath(window.location.pathname)
      setSearch(window.location.search)
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])
  
  return { path, search }
}

export default function App() {
  const { path, search } = useRoute()
  
  if (path === '/success') return <SuccessPage search={search} />
  if (path === '/admin') return <AdminPage />
  return <BookingPage />
}

// BOOKING PAGE
function BookingPage() {
  const [settings, setSettings] = useState(null)
  const [unavailable, setUnavailable] = useState([])
  const [range, setRange] = useState({ from: null, to: null })
  const [form, setForm] = useState({ name: '', email: '', phone: '', guests: 2 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [month, setMonth] = useState(new Date())

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings)
    fetch('/api/unavailable').then(r => r.json()).then(setUnavailable)
  }, [])

  const nights = range.from && range.to 
    ? Math.ceil((range.to - range.from) / (1000 * 60 * 60 * 24)) 
    : 0
  const total = nights * (settings?.nightlyRate || 3495)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!range.from || !range.to) return setError('Select dates first')
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: form.name,
          guestEmail: form.email,
          guestPhone: form.phone,
          guests: form.guests,
          checkIn: range.from.toISOString().split('T')[0],
          checkOut: range.to.toISOString().split('T')[0]
        })
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error || 'Checkout failed')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (!settings) return (
    <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: colors.stone}}>
      <div className="text-center">
        <div className="animate-pulse text-2xl" style={{color: colors.dunesGrass}}>Loading...</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{backgroundColor: colors.stone}}>
      {/* Header */}
      <header className="py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <img src="/logo.png" alt="Hop Farm Beach" className="h-20 md:h-28 mx-auto" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Calendar */}
          <div>
            <h2 className="font-dreamers text-2xl tracking-wider mb-6" style={{color: colors.smoke}}>
              SELECT YOUR DATES
            </h2>
            <Calendar 
              month={month} 
              setMonth={setMonth}
              unavailable={unavailable}
              range={range}
              setRange={setRange}
            />
            {nights > 0 && (
              <div className="mt-6 p-6 rounded-lg" style={{backgroundColor: 'white'}}>
                <div className="flex justify-between mb-3" style={{color: colors.dunesGrass}}>
                  <span>{settings.nightlyRate.toLocaleString()} kr × {nights} night{nights > 1 ? 's' : ''}</span>
                  <span>{total.toLocaleString()} kr</span>
                </div>
                <div className="flex justify-between font-medium text-lg pt-3" style={{borderTop: `1px solid ${colors.sand}`, color: colors.smoke}}>
                  <span>Total</span>
                  <span>{total.toLocaleString()} kr</span>
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <div>
            <h2 className="font-dreamers text-2xl tracking-wider mb-6" style={{color: colors.smoke}}>
              YOUR DETAILS
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Full name"
                required
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-4 py-4 rounded-lg border-0 focus:ring-2 focus:ring-opacity-50 outline-none"
                style={{backgroundColor: 'white', color: colors.smoke}}
              />
              <input
                type="email"
                placeholder="Email"
                required
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="w-full px-4 py-4 rounded-lg border-0 outline-none"
                style={{backgroundColor: 'white', color: colors.smoke}}
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full px-4 py-4 rounded-lg border-0 outline-none"
                style={{backgroundColor: 'white', color: colors.smoke}}
              />
              <select
                value={form.guests}
                onChange={e => setForm({...form, guests: parseInt(e.target.value)})}
                className="w-full px-4 py-4 rounded-lg border-0 outline-none"
                style={{backgroundColor: 'white', color: colors.smoke}}
              >
                {[1,2,3,4].map(n => <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>)}
              </select>
              
              {error && (
                <div className="p-4 rounded-lg text-red-700" style={{backgroundColor: '#fee2e2'}}>
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={nights === 0 || loading}
                className="w-full py-4 rounded-lg font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{backgroundColor: nights === 0 || loading ? colors.sand : colors.smoke}}
              >
                {loading ? 'Processing...' : nights === 0 ? 'Select dates to continue' : 'Continue to Payment'}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 px-4 mt-12" style={{borderTop: `1px solid ${colors.sand}`}}>
        <div className="max-w-5xl mx-auto text-center">
          <p className="font-dreamers tracking-widest text-sm" style={{color: colors.dunesGrass}}>
            HUMLEGÅRDSSTRAND · SÖDERHAMN · SWEDEN
          </p>
        </div>
      </footer>
    </div>
  )
}

// CALENDAR COMPONENT
function Calendar({ month, setMonth, unavailable, range, setRange }) {
  const unavailableSet = new Set(unavailable)
  const today = new Date()
  today.setHours(0,0,0,0)

  const getDays = () => {
    const year = month.getFullYear()
    const m = month.getMonth()
    const first = new Date(year, m, 1)
    const last = new Date(year, m + 1, 0)
    const days = []
    const start = first.getDay() === 0 ? 6 : first.getDay() - 1
    for (let i = 0; i < start; i++) days.push(null)
    for (let i = 1; i <= last.getDate(); i++) days.push(new Date(year, m, i))
    return days
  }

  const handleClick = (day) => {
    if (!day || day < today || unavailableSet.has(day.toISOString().split('T')[0])) return
    
    if (!range.from || (range.from && range.to)) {
      setRange({ from: day, to: null })
    } else {
      if (day <= range.from) {
        setRange({ from: day, to: null })
      } else {
        let d = new Date(range.from)
        while (d < day) {
          if (unavailableSet.has(d.toISOString().split('T')[0])) return
          d.setDate(d.getDate() + 1)
        }
        setRange({ ...range, to: day })
      }
    }
  }

  const isInRange = (day) => {
    if (!day || !range.from || !range.to) return false
    return day >= range.from && day < range.to
  }

  return (
    <div className="rounded-lg p-6" style={{backgroundColor: 'white'}}>
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))} 
          className="p-2 rounded-full transition-colors"
          style={{color: colors.smoke}}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-dreamers text-lg tracking-wider" style={{color: colors.smoke}}>
          {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase()}
        </span>
        <button 
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))} 
          className="p-2 rounded-full transition-colors"
          style={{color: colors.smoke}}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-3" style={{color: colors.dunesGrass}}>
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} className="py-2 font-medium tracking-wide">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {getDays().map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = day.toISOString().split('T')[0]
          const isPast = day < today
          const isUnavail = unavailableSet.has(dateStr)
          const isSelected = (range.from && day.getTime() === range.from.getTime()) || (range.to && day.getTime() === range.to.getTime())
          const inRange = isInRange(day)
          
          let bgColor = 'transparent'
          let textColor = colors.smoke
          
          if (isPast) {
            textColor = colors.sand
          } else if (isUnavail) {
            bgColor = colors.stone
            textColor = colors.sand
          } else if (isSelected) {
            bgColor = colors.smoke
            textColor = 'white'
          } else if (inRange) {
            bgColor = colors.sand + '40'
          }
          
          return (
            <button
              key={i}
              onClick={() => handleClick(day)}
              disabled={isPast || isUnavail}
              className={`aspect-square rounded-lg text-sm font-medium transition-all duration-150 ${isUnavail ? 'line-through' : ''}`}
              style={{ backgroundColor: bgColor, color: textColor }}
              onMouseEnter={(e) => {
                if (!isPast && !isUnavail && !isSelected && !inRange) {
                  e.target.style.backgroundColor = colors.sand + '30'
                }
              }}
              onMouseLeave={(e) => {
                if (!isPast && !isUnavail && !isSelected && !inRange) {
                  e.target.style.backgroundColor = 'transparent'
                }
              }}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// SUCCESS PAGE
function SuccessPage({ search }) {
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(search)
    const sessionId = params.get('session_id')
    if (sessionId) {
      fetch(`/api/confirm?session_id=${sessionId}`)
        .then(r => r.json())
        .then(data => {
          if (data.error) setError(data.error)
          else setBooking(data)
        })
        .catch(err => setError(err.message))
    }
  }, [search])

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor: colors.stone}}>
      <div className="text-center">
        <h1 className="font-dreamers text-2xl tracking-wider mb-4" style={{color: colors.smoke}}>SOMETHING WENT WRONG</h1>
        <p className="mb-6" style={{color: colors.dunesGrass}}>{error}</p>
        <a href="/" className="underline" style={{color: colors.smoke}}>Back to booking</a>
      </div>
    </div>
  )

  if (!booking) return (
    <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: colors.stone}}>
      <div className="animate-pulse text-xl" style={{color: colors.dunesGrass}}>Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{backgroundColor: colors.stone}}>
      <header className="py-8 px-4">
        <div className="max-w-lg mx-auto">
          <img src="/logo.png" alt="Hop Farm Beach" className="h-16 mx-auto" />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center" style={{backgroundColor: colors.dunesGrass}}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-dreamers text-3xl tracking-wider mb-3" style={{color: colors.smoke}}>BOOKING CONFIRMED</h2>
          <p style={{color: colors.dunesGrass}}>Confirmation sent to {booking.guestEmail}</p>
        </div>
        <div className="rounded-lg p-6" style={{backgroundColor: 'white'}}>
          <div className="text-xs tracking-wider mb-1" style={{color: colors.dunesGrass}}>BOOKING REFERENCE</div>
          <div className="text-2xl font-mono font-medium mb-6" style={{color: colors.smoke}}>{booking.bookingRef}</div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span style={{color: colors.dunesGrass}}>Guest</span>
              <span style={{color: colors.smoke}}>{booking.guestName}</span>
            </div>
            <div className="flex justify-between">
              <span style={{color: colors.dunesGrass}}>Check-in</span>
              <span style={{color: colors.smoke}}>{booking.checkIn}</span>
            </div>
            <div className="flex justify-between">
              <span style={{color: colors.dunesGrass}}>Check-out</span>
              <span style={{color: colors.smoke}}>{booking.checkOut}</span>
            </div>
            <div className="flex justify-between">
              <span style={{color: colors.dunesGrass}}>Nights</span>
              <span style={{color: colors.smoke}}>{booking.nights}</span>
            </div>
            <div className="flex justify-between pt-3 mt-3 font-medium" style={{borderTop: `1px solid ${colors.sand}`}}>
              <span style={{color: colors.smoke}}>Total Paid</span>
              <span style={{color: colors.smoke}}>{booking.totalAmount.toLocaleString()} kr</span>
            </div>
          </div>
        </div>
        <div className="mt-8 text-center">
          <a href="/" className="font-dreamers tracking-wider text-sm" style={{color: colors.dunesGrass}}>
            ← BACK TO HOP FARM BEACH
          </a>
        </div>
      </main>
    </div>
  )
}

// ADMIN PAGE
function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [bookings, setBookings] = useState([])
  const [blocked, setBlocked] = useState([])
  const [tab, setTab] = useState('bookings')
  const [month, setMonth] = useState(new Date())

  const login = async (e) => {
    e.preventDefault()
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    if (res.ok) {
      setAuthed(true)
      loadData()
    } else {
      alert('Invalid password')
    }
  }

  const loadData = async () => {
    const [b, bl] = await Promise.all([
      fetch('/api/admin/bookings').then(r => r.json()),
      fetch('/api/admin/blocked').then(r => r.json())
    ])
    setBookings(b)
    setBlocked(bl)
  }

  const toggleBlock = async (date) => {
    const isBlocked = blocked.includes(date)
    await fetch('/api/admin/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, block: !isBlocked })
    })
    loadData()
  }

  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{backgroundColor: colors.stone}}>
      <form onSubmit={login} className="rounded-lg p-8 w-full max-w-sm" style={{backgroundColor: 'white'}}>
        <img src="/logo.png" alt="Hop Farm Beach" className="h-16 mx-auto mb-8" />
        <h2 className="font-dreamers text-xl tracking-wider text-center mb-6" style={{color: colors.smoke}}>ADMIN LOGIN</h2>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-3 rounded-lg mb-4 border-0 outline-none"
          style={{backgroundColor: colors.stone, color: colors.smoke}}
        />
        <button 
          type="submit" 
          className="w-full py-3 rounded-lg text-white font-medium"
          style={{backgroundColor: colors.smoke}}
        >
          Login
        </button>
      </form>
    </div>
  )

  const getDays = () => {
    const year = month.getFullYear()
    const m = month.getMonth()
    const first = new Date(year, m, 1)
    const last = new Date(year, m + 1, 0)
    const days = []
    const start = first.getDay() === 0 ? 6 : first.getDay() - 1
    for (let i = 0; i < start; i++) days.push(null)
    for (let i = 1; i <= last.getDate(); i++) days.push(new Date(year, m, i))
    return days
  }

  const bookedDates = new Set()
  bookings.filter(b => b.status === 'confirmed').forEach(b => {
    let d = new Date(b.check_in)
    const end = new Date(b.check_out)
    while (d < end) {
      bookedDates.add(d.toISOString().split('T')[0])
      d.setDate(d.getDate() + 1)
    }
  })

  return (
    <div className="min-h-screen" style={{backgroundColor: colors.stone}}>
      <header className="px-4 py-4" style={{backgroundColor: 'white', borderBottom: `1px solid ${colors.sand}`}}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <img src="/logo.png" alt="Hop Farm Beach" className="h-10" />
          <span className="font-dreamers tracking-wider text-sm" style={{color: colors.dunesGrass}}>ADMIN</span>
        </div>
      </header>
      <div style={{backgroundColor: 'white', borderBottom: `1px solid ${colors.sand}`}}>
        <div className="max-w-5xl mx-auto flex">
          <button 
            onClick={() => setTab('bookings')} 
            className="px-6 py-4 font-medium"
            style={{
              borderBottom: tab === 'bookings' ? `2px solid ${colors.smoke}` : '2px solid transparent',
              color: tab === 'bookings' ? colors.smoke : colors.dunesGrass
            }}
          >
            Bookings
          </button>
          <button 
            onClick={() => setTab('calendar')} 
            className="px-6 py-4 font-medium"
            style={{
              borderBottom: tab === 'calendar' ? `2px solid ${colors.smoke}` : '2px solid transparent',
              color: tab === 'calendar' ? colors.smoke : colors.dunesGrass
            }}
          >
            Calendar
          </button>
        </div>
      </div>
      <main className="max-w-5xl mx-auto p-4">
        {tab === 'bookings' && (
          <div className="rounded-lg overflow-hidden" style={{backgroundColor: 'white'}}>
            <table className="w-full">
              <thead style={{backgroundColor: colors.stone}}>
                <tr className="text-left text-sm" style={{color: colors.dunesGrass}}>
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Guest</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center" style={{color: colors.dunesGrass}}>
                      No bookings yet
                    </td>
                  </tr>
                ) : bookings.map(b => (
                  <tr key={b.id} style={{borderTop: `1px solid ${colors.stone}`}}>
                    <td className="px-4 py-3 font-mono" style={{color: colors.smoke}}>{b.booking_ref}</td>
                    <td className="px-4 py-3">
                      <span style={{color: colors.smoke}}>{b.guest_name}</span>
                      <br/>
                      <span className="text-sm" style={{color: colors.dunesGrass}}>{b.guest_email}</span>
                    </td>
                    <td className="px-4 py-3" style={{color: colors.smoke}}>{b.check_in} → {b.check_out}</td>
                    <td className="px-4 py-3">
                      <span 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: b.status === 'confirmed' ? colors.dunesGrass : colors.sand,
                          color: 'white'
                        }}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'calendar' && (
          <div className="rounded-lg p-6" style={{backgroundColor: 'white'}}>
            <div className="flex items-center justify-between mb-6">
              <button 
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))} 
                className="px-3 py-1 rounded"
                style={{border: `1px solid ${colors.sand}`, color: colors.smoke}}
              >
                ←
              </button>
              <span className="font-dreamers tracking-wider" style={{color: colors.smoke}}>
                {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase()}
              </span>
              <button 
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))} 
                className="px-3 py-1 rounded"
                style={{border: `1px solid ${colors.sand}`, color: colors.smoke}}
              >
                →
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm mb-3" style={{color: colors.dunesGrass}}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {getDays().map((day, i) => {
                if (!day) return <div key={i} />
                const dateStr = day.toISOString().split('T')[0]
                const isBlocked = blocked.includes(dateStr)
                const isBooked = bookedDates.has(dateStr)
                const isPast = day < new Date(new Date().setHours(0,0,0,0))
                
                let bgColor = '#ecfdf5'
                let textColor = colors.dunesGrass
                
                if (isPast) {
                  bgColor = colors.stone
                  textColor = colors.sand
                } else if (isBooked) {
                  bgColor = colors.sand
                  textColor = colors.smoke
                } else if (isBlocked) {
                  bgColor = '#fee2e2'
                  textColor = '#991b1b'
                }
                
                return (
                  <button
                    key={i}
                    onClick={() => !isPast && !isBooked && toggleBlock(dateStr)}
                    disabled={isPast || isBooked}
                    className="aspect-square rounded-lg text-sm font-medium"
                    style={{backgroundColor: bgColor, color: textColor}}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
            <div className="mt-6 flex gap-6 text-sm" style={{color: colors.dunesGrass}}>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{backgroundColor: '#ecfdf5'}} /> Available
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{backgroundColor: '#fee2e2'}} /> Blocked
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{backgroundColor: colors.sand}} /> Booked
              </div>
            </div>
            <p className="mt-4 text-sm" style={{color: colors.dunesGrass}}>
              Click on available dates to block/unblock them.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
