import { useState, useEffect } from 'react'

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

  if (!settings) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen bg-[#fffff8]">
      <header className="py-8 px-4 text-center border-b border-stone-200">
        <h1 className="text-4xl md:text-5xl text-[#4a5c4a] mb-2" style={{fontFamily: 'cursive'}}>Hop Farm Beach</h1>
        <p className="text-stone-600">Forest. Beach. No WiFi.</p>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Calendar */}
          <div>
            <h2 className="text-xl font-medium mb-6">Select your dates</h2>
            <Calendar 
              month={month} 
              setMonth={setMonth}
              unavailable={unavailable}
              range={range}
              setRange={setRange}
            />
            {nights > 0 && (
              <div className="mt-6 p-4 bg-stone-100 rounded-lg">
                <div className="flex justify-between text-stone-700 mb-2">
                  <span>{settings.nightlyRate.toLocaleString()} kr × {nights} night{nights > 1 ? 's' : ''}</span>
                  <span>{total.toLocaleString()} kr</span>
                </div>
                <div className="flex justify-between font-medium text-lg border-t border-stone-300 pt-2 mt-2">
                  <span>Total</span>
                  <span>{total.toLocaleString()} kr</span>
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <div>
            <h2 className="text-xl font-medium mb-6">Your details</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Full name"
                required
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-4 py-3 border border-stone-300 rounded-lg"
              />
              <input
                type="email"
                placeholder="Email"
                required
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="w-full px-4 py-3 border border-stone-300 rounded-lg"
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full px-4 py-3 border border-stone-300 rounded-lg"
              />
              <select
                value={form.guests}
                onChange={e => setForm({...form, guests: parseInt(e.target.value)})}
                className="w-full px-4 py-3 border border-stone-300 rounded-lg"
              >
                {[1,2,3,4].map(n => <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>)}
              </select>
              
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}
              
              <button
                type="submit"
                disabled={nights === 0 || loading}
                className="w-full py-4 rounded-lg font-medium text-white bg-[#4a5c4a] hover:bg-[#3a4a3a] disabled:bg-stone-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : nights === 0 ? 'Select dates first' : 'Continue to Payment'}
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="py-8 px-4 text-center text-stone-500 text-sm border-t border-stone-200">
        <p>Hop Farm Beach · Humlegårdsstrand, Söderhamn, Sweden</p>
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
        // Check if range contains unavailable dates
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
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))} className="p-2 hover:bg-stone-100 rounded">←</button>
        <span className="font-medium">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))} className="p-2 hover:bg-stone-100 rounded">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-500 mb-2">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {getDays().map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = day.toISOString().split('T')[0]
          const isPast = day < today
          const isUnavail = unavailableSet.has(dateStr)
          const isSelected = (range.from && day.getTime() === range.from.getTime()) || (range.to && day.getTime() === range.to.getTime())
          const inRange = isInRange(day)
          
          return (
            <button
              key={i}
              onClick={() => handleClick(day)}
              disabled={isPast || isUnavail}
              className={`aspect-square rounded-lg text-sm ${
                isPast ? 'text-stone-300' :
                isUnavail ? 'bg-stone-100 text-stone-400 line-through' :
                isSelected ? 'bg-[#4a5c4a] text-white' :
                inRange ? 'bg-[#4a5c4a]/10' :
                'hover:bg-[#4a5c4a]/10'
              }`}
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-medium mb-4">Something went wrong</h1>
        <p className="text-stone-600 mb-4">{error}</p>
        <a href="/" className="text-[#4a5c4a] underline">Back to booking</a>
      </div>
    </div>
  )

  if (!booking) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen bg-[#fffff8]">
      <header className="py-8 px-4 text-center border-b border-stone-200">
        <h1 className="text-4xl text-[#4a5c4a]" style={{fontFamily: 'cursive'}}>Hop Farm Beach</h1>
      </header>
      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-medium mb-2">Booking Confirmed</h2>
          <p className="text-stone-600">Confirmation sent to {booking.guestEmail}</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="text-sm text-stone-500 mb-1">Booking Reference</div>
          <div className="text-xl font-mono font-medium mb-4">{booking.bookingRef}</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">Guest</span><span>{booking.guestName}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Check-in</span><span>{booking.checkIn}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Check-out</span><span>{booking.checkOut}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Nights</span><span>{booking.nights}</span></div>
            <div className="flex justify-between border-t pt-2 mt-2 font-medium"><span>Total Paid</span><span>{booking.totalAmount.toLocaleString()} kr</span></div>
          </div>
        </div>
        <div className="mt-8 text-center">
          <a href="/" className="text-[#4a5c4a] underline">Back to Hop Farm Beach</a>
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
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <form onSubmit={login} className="bg-white rounded-xl p-8 w-full max-w-sm shadow-lg">
        <h1 className="text-2xl text-center text-[#4a5c4a] mb-6" style={{fontFamily: 'cursive'}}>Hop Farm Beach</h1>
        <h2 className="text-xl text-center mb-6">Admin Login</h2>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-3 border border-stone-300 rounded-lg mb-4"
        />
        <button type="submit" className="w-full bg-[#4a5c4a] text-white py-3 rounded-lg">Login</button>
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
    <div className="min-h-screen bg-stone-100">
      <header className="bg-white border-b border-stone-200 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl text-[#4a5c4a]" style={{fontFamily: 'cursive'}}>Hop Farm Beach</h1>
          <span className="text-sm text-stone-500">Admin</span>
        </div>
      </header>
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto flex">
          <button onClick={() => setTab('bookings')} className={`px-6 py-4 border-b-2 ${tab === 'bookings' ? 'border-[#4a5c4a] text-[#4a5c4a]' : 'border-transparent'}`}>Bookings</button>
          <button onClick={() => setTab('calendar')} className={`px-6 py-4 border-b-2 ${tab === 'calendar' ? 'border-[#4a5c4a] text-[#4a5c4a]' : 'border-transparent'}`}>Calendar</button>
        </div>
      </div>
      <main className="max-w-5xl mx-auto p-4">
        {tab === 'bookings' && (
          <div className="bg-white rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-stone-50 text-left text-sm">
                <tr>
                  <th className="px-4 py-3">Ref</th>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id} className="border-t border-stone-100">
                    <td className="px-4 py-3 font-mono">{b.booking_ref}</td>
                    <td className="px-4 py-3">{b.guest_name}<br/><span className="text-sm text-stone-500">{b.guest_email}</span></td>
                    <td className="px-4 py-3">{b.check_in} → {b.check_out}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${b.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === 'calendar' && (
          <div className="bg-white rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))} className="px-3 py-1 border rounded">←</button>
              <span className="font-medium">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))} className="px-3 py-1 border rounded">→</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm text-stone-500 mb-2">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {getDays().map((day, i) => {
                if (!day) return <div key={i} />
                const dateStr = day.toISOString().split('T')[0]
                const isBlocked = blocked.includes(dateStr)
                const isBooked = bookedDates.has(dateStr)
                const isPast = day < new Date(new Date().setHours(0,0,0,0))
                
                return (
                  <button
                    key={i}
                    onClick={() => !isPast && !isBooked && toggleBlock(dateStr)}
                    disabled={isPast || isBooked}
                    className={`aspect-square rounded-lg text-sm ${
                      isPast ? 'bg-stone-100 text-stone-400' :
                      isBooked ? 'bg-blue-100 text-blue-700' :
                      isBlocked ? 'bg-red-100 text-red-700' :
                      'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex gap-4 text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-50 border rounded" /> Available</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-100 rounded" /> Blocked</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-100 rounded" /> Booked</div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
