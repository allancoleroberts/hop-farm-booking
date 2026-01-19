import { useState, useEffect } from 'react'

// Brand colors
const colors = {
  smoke: '#32322B',
  dunesGrass: '#767460',
  sand: '#B8A68A',
  stone: '#E1D9CA'
}

// Gallery images - new forest image first, ending with floorplan
const galleryImages = [
  { src: '/gallery-0.webp', alt: 'Cabin nestled in Swedish forest' },
  { src: '/gallery-1.jpg', alt: 'Cabin exterior at sunset' },
  { src: '/gallery-5.jpg', alt: 'Cabin in winter snow' },
  { src: '/gallery-2.jpg', alt: 'Kitchen interior' },
  { src: '/gallery-3.jpg', alt: 'Bedroom with forest view' },
  { src: '/gallery-4.jpg', alt: 'Bed and reading chair' },
  { src: '/gallery-6.png', alt: 'Floor plan' }
]

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

// IMAGE GALLERY COMPONENT
function ImageGallery() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  const goNext = (e) => {
    e?.stopPropagation()
    setCurrentIndex((prev) => (prev + 1) % galleryImages.length)
  }

  const goPrev = (e) => {
    e?.stopPropagation()
    setCurrentIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)
  }

  const openLightbox = () => setIsLightboxOpen(true)
  const closeLightbox = () => setIsLightboxOpen(false)

  // Keyboard navigation
  useEffect(() => {
    if (!isLightboxOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isLightboxOpen])

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isLightboxOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isLightboxOpen])

  return (
    <>
      {/* Main Gallery */}
      <div 
        className="relative cursor-pointer overflow-hidden rounded-t-lg md:rounded-l-lg md:rounded-tr-none h-64 md:h-80"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={openLightbox}
      >
        <img 
          src={galleryImages[currentIndex].src} 
          alt={galleryImages[currentIndex].alt}
          className="w-full h-full object-cover transition-transform duration-300"
        />
        
        {/* Dots indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {galleryImages.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx) }}
              className="w-2 h-2 rounded-full transition-all"
              style={{ 
                backgroundColor: idx === currentIndex ? 'white' : 'rgba(255,255,255,0.5)',
                transform: idx === currentIndex ? 'scale(1.2)' : 'scale(1)'
              }}
            />
          ))}
        </div>

        {/* Navigation arrows - show on hover */}
        <div 
          className="absolute inset-0 flex items-center justify-between px-3 transition-opacity duration-200"
          style={{ opacity: isHovering ? 1 : 0 }}
        >
          <button
            onClick={goPrev}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke={colors.smoke} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goNext}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
            style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke={colors.smoke} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Click to expand hint */}
        <div 
          className="absolute top-3 right-3 px-2 py-1 rounded text-xs text-white transition-opacity duration-200"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', opacity: isHovering ? 1 : 0 }}
        >
          Click to expand
        </div>

        {/* Image count */}
        <div 
          className="absolute top-3 left-3 px-2 py-1 rounded text-xs text-white"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          {currentIndex + 1} / {galleryImages.length}
        </div>
      </div>

      {/* Lightbox */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.95)' }}
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-12 h-12 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors z-10"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image counter */}
          <div className="absolute top-4 left-4 text-white/70 text-sm">
            {currentIndex + 1} / {galleryImages.length}
          </div>

          {/* Main image */}
          <img
            src={galleryImages[currentIndex].src}
            alt={galleryImages[currentIndex].alt}
            className="max-h-[85vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Navigation arrows */}
          <button
            onClick={goPrev}
            className="absolute left-4 w-14 h-14 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goNext}
            className="absolute right-4 w-14 h-14 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Thumbnail strip */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {galleryImages.map((img, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx) }}
                className="w-16 h-12 rounded overflow-hidden transition-all"
                style={{ 
                  opacity: idx === currentIndex ? 1 : 0.5,
                  transform: idx === currentIndex ? 'scale(1.1)' : 'scale(1)',
                  border: idx === currentIndex ? '2px solid white' : '2px solid transparent'
                }}
              >
                <img src={img.src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

// RATE INFO MODAL COMPONENT
function RateInfoModal({ isOpen, onClose, nights, nightlyRate, total }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6" style={{ borderBottom: `1px solid ${colors.stone}` }}>
          <h2 className="font-dreamers text-xl tracking-wider" style={{ color: colors.smoke }}>
            Digital Detox Cabin
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
            style={{ border: `1px solid ${colors.stone}` }}
          >
            <svg className="w-5 h-5" fill="none" stroke={colors.smoke} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Room Features */}
          <h3 className="font-medium mb-3" style={{ color: colors.smoke }}>Room Features</h3>
          <p className="text-sm mb-4" style={{ color: colors.dunesGrass }}>
            Our eco-friendly cabin floats above the land to leave the natural surroundings untouched. 
            A quiet retreat where you can watch the seasons unfold through floor-to-ceiling windows.
          </p>

          {/* Specs Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
            <div className="flex items-center gap-2" style={{ color: colors.smoke }}>
              <span>👥</span>
              <span><strong>Max occupancy:</strong> Sleeps 4</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: colors.smoke }}>
              <span>🛏</span>
              <span><strong>Beds:</strong> 2 Double (160×200)</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: colors.smoke }}>
              <span>📐</span>
              <span><strong>Room size:</strong> 32m²</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: colors.smoke }}>
              <span>🚿</span>
              <span><strong>Bathrooms:</strong> 1</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: colors.smoke }}>
              <span>🚭</span>
              <span><strong>Smoking:</strong> Non-smoking</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: colors.smoke }}>
              <span>🐕</span>
              <span><strong>Pets:</strong> Not allowed</span>
            </div>
          </div>

          {/* Amenities */}
          <h3 className="font-medium mb-3" style={{ color: colors.smoke }}>Amenities</h3>
          <p className="text-sm mb-6" style={{ color: colors.dunesGrass }}>
            Air conditioned, Heated floors, Linen & Towels provided, Electric sauna, 
            Kitchenette with stovetop, Tea/Coffee maker, Bluetooth radio, Private deck, 
            Phone lockbox for digital detox
          </p>

          {/* Good to Know */}
          <h3 className="font-medium mb-3" style={{ color: colors.smoke }}>Good to Know</h3>
          <div className="space-y-2 text-sm mb-4" style={{ color: colors.dunesGrass }}>
            <p><strong>No WiFi, No TV</strong> – That's the point. 5G cell service works if you need it.</p>
            <p><strong>15 minutes from town</strong> – Stock up on food before arrival. No nearby shops.</p>
            <p><strong>Private forest</strong> – No visible neighbours. Very quiet.</p>
            <p><strong>Sauna</strong> – Electric sauna by the cabin. Takes 30 minutes to heat up.</p>
            <p><strong>Parking</strong> – Private parking on property. One-minute walk to cabin.</p>
          </div>

          {/* Cancellation Policy - subtle section */}
          <div className="text-sm mb-6 p-4 rounded-lg" style={{ backgroundColor: colors.stone }}>
            <h4 className="font-medium mb-2" style={{ color: colors.smoke }}>Cancellation Policy</h4>
            <p style={{ color: colors.dunesGrass }}>
              Full refund if cancelled 28+ days before check-in. Date changes available 14-27 days prior. 
              No changes within 14 days of arrival. <a href="https://hopfarmbeach.com/terms-conditions/" target="_blank" rel="noopener noreferrer" className="underline">Full terms</a>
            </p>
          </div>

          {/* Rate Breakdown */}
          {nights > 0 && (
            <div className="rounded-lg p-4" style={{ backgroundColor: '#f8f7f5' }}>
              <h3 className="font-medium mb-3" style={{ color: colors.smoke }}>Rate Breakdown</h3>
              <div className="flex justify-between mb-1 text-sm" style={{ color: colors.smoke }}>
                <span>{nights} night{nights > 1 ? 's' : ''}</span>
                <span>SEK {total.toLocaleString()}</span>
              </div>
              <div className="text-xs mb-3" style={{ color: colors.dunesGrass }}>
                Includes 12% VAT
              </div>
              <div className="flex justify-between font-medium pt-2" style={{ borderTop: `1px solid ${colors.sand}`, color: colors.smoke }}>
                <span>Total</span>
                <span>SEK {total.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
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
  const [showCabinInfo, setShowCabinInfo] = useState(false)
  const [showRateInfo, setShowRateInfo] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings)
    fetch('/api/unavailable').then(r => r.json()).then(setUnavailable)
  }, [])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const nights = range.from && range.to 
    ? Math.ceil((range.to - range.from) / (1000 * 60 * 60 * 24)) 
    : 0
  const total = nights * (settings?.nightlyRate || 3495)

  const selectionState = !range.from ? 'check-in' : !range.to ? 'check-out' : 'complete'

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

  const formatDate = (date) => {
    if (!date) return '—'
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (!settings) return (
    <div className="min-h-screen flex items-center justify-center" style={{backgroundColor: colors.stone}}>
      <div className="text-center">
        <div className="animate-pulse text-2xl" style={{color: colors.dunesGrass}}>Loading...</div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{backgroundColor: colors.stone}}>
      {/* Header */}
      <header className="py-5 px-6 md:px-12" style={{backgroundColor: colors.stone}}>
        <div className="max-w-7xl mx-auto">
          {/* Menu only */}
          <button 
            onClick={() => setMenuOpen(true)}
            className="flex items-center gap-3 text-xs font-medium tracking-widest transition-opacity hover:opacity-70 uppercase"
            style={{color: colors.smoke}}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="hidden sm:inline">Menu</span>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Menu Content */}
          <div 
            className="w-full md:w-1/2 h-full flex flex-col justify-center px-8 md:px-16"
            style={{backgroundColor: colors.dunesGrass}}
          >
            <nav className="space-y-1">
              {[
                { name: 'Home', href: 'https://hopfarmbeach.com/' },
                { name: 'Cabin', href: 'https://hopfarmbeach.com/cabin/' },
                { name: 'History', href: 'https://hopfarmbeach.com/history/' },
                { name: 'Gallery', href: 'https://hopfarmbeach.com/gallery/' },
                { name: 'Sustainability', href: 'https://hopfarmbeach.com/sustainability/' },
                { name: 'Contact', href: 'https://hopfarmbeach.com/contact/' }
              ].map(item => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block text-4xl md:text-5xl font-normal transition-all duration-300 hover:underline hover:translate-x-3"
                  style={{color: '#f3f1ed', fontFamily: 'Roobert, sans-serif', lineHeight: '1.3'}}
                >
                  {item.name}
                </a>
              ))}
            </nav>
          </div>

          {/* Image Side (hidden on mobile) */}
          <div 
            className="hidden md:block w-1/2 h-full bg-cover bg-center"
            style={{backgroundImage: 'url(https://hopfarmbeach.com/wp-content/uploads/2025/02/Hop-Farm-Beach-Cabin-Rental-Sweden-00033.jpg)'}}
          />

          {/* Close Button */}
          <button
            onClick={() => setMenuOpen(false)}
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center transition-opacity hover:opacity-70"
            style={{color: '#f3f1ed'}}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Cabin Info Section */}
      <section className="max-w-5xl mx-auto px-4 mb-8">
        <div className="rounded-lg overflow-hidden" style={{backgroundColor: 'white'}}>
          <div className="md:flex">
            <div className="md:w-2/5">
              <ImageGallery />
            </div>
            <div className="md:w-3/5 p-6">
              <h2 className="font-dreamers text-2xl tracking-wider mb-2" style={{color: colors.smoke}}>
                THE CABIN
              </h2>
              <p className="text-sm mb-4" style={{color: colors.dunesGrass}}>
                Sleeps four. No WiFi. Sauna included.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-4" style={{color: colors.dunesGrass}}>
                <span>👥 Sleeps 4</span>
                <span>🛏 2 double beds (160×200)</span>
                <span>🚿 1 Bathroom</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {['32m²', 'No WiFi', 'No TV', 'Sauna', 'Heated floors', 'Air conditioning', 'Kitchenette', 'Private deck'].map(item => (
                  <span key={item} className="px-2 py-1 rounded text-xs" style={{backgroundColor: colors.stone, color: colors.smoke}}>
                    {item}
                  </span>
                ))}
              </div>
              
              {showCabinInfo ? (
                <div className="text-sm space-y-3" style={{color: colors.smoke}}>
                  <p>32 square metres. Two double beds. Floor-to-ceiling windows facing forest. Everything works, nothing extra.</p>
                  <p>Designed by Danish architect Mette Fredskild. Built for people who want less stuff and more space to think.</p>
                  <p><strong>What's included:</strong> Sliding door for private bedroom, heated floors throughout, air conditioning, towels & bed linen, radio with Bluetooth, board games, phone lockbox for digital detox.</p>
                  <p><strong>Kitchenette:</strong> Electric stovetop, kettle, toaster, coffee maker. Fresh drinkable tap water.</p>
                  <p><strong>Outside:</strong> Private deck, parking, and sauna ready when you are.</p>
                  <button 
                    onClick={() => setShowCabinInfo(false)}
                    className="underline mt-2"
                    style={{color: colors.dunesGrass}}
                  >
                    Less info
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowCabinInfo(true)}
                  className="text-sm underline"
                  style={{color: colors.dunesGrass}}
                >
                  More info
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Calendar */}
          <div>
            <h2 className="font-dreamers text-2xl tracking-wider mb-4" style={{color: colors.smoke}}>
              SELECT YOUR DATES
            </h2>
            
            {/* Date Selection Status */}
            <div className="flex gap-4 mb-6">
              <div 
                className="flex-1 p-4 rounded-lg transition-all"
                style={{
                  backgroundColor: selectionState === 'check-in' ? 'white' : colors.stone,
                  border: selectionState === 'check-in' ? `2px solid ${colors.smoke}` : '2px solid transparent'
                }}
              >
                <div className="text-xs tracking-wider mb-1" style={{color: colors.dunesGrass}}>
                  {selectionState === 'check-in' ? '👉 SELECT CHECK-IN' : 'CHECK-IN'}
                </div>
                <div className="font-medium" style={{color: range.from ? colors.smoke : colors.sand}}>
                  {formatDate(range.from)}
                </div>
              </div>
              <div 
                className="flex-1 p-4 rounded-lg transition-all"
                style={{
                  backgroundColor: selectionState === 'check-out' ? 'white' : colors.stone,
                  border: selectionState === 'check-out' ? `2px solid ${colors.smoke}` : '2px solid transparent'
                }}
              >
                <div className="text-xs tracking-wider mb-1" style={{color: colors.dunesGrass}}>
                  {selectionState === 'check-out' ? '👉 SELECT CHECK-OUT' : 'CHECK-OUT'}
                </div>
                <div className="font-medium" style={{color: range.to ? colors.smoke : colors.sand}}>
                  {formatDate(range.to)}
                </div>
              </div>
            </div>

            {selectionState !== 'complete' && (
              <p className="text-sm mb-4" style={{color: colors.dunesGrass}}>
                {selectionState === 'check-in' 
                  ? 'Click on a date to select your arrival day'
                  : 'Now click on a date to select your departure day'}
              </p>
            )}

            <Calendar 
              month={month} 
              setMonth={setMonth}
              unavailable={unavailable}
              range={range}
              setRange={setRange}
              selectionState={selectionState}
            />

            {nights > 0 && (
              <div className="mt-6 p-6 rounded-lg" style={{backgroundColor: 'white'}}>
                <div className="flex justify-between mb-1" style={{color: colors.smoke}}>
                  <span>{nights} night{nights > 1 ? 's' : ''}</span>
                  <span>SEK {total.toLocaleString()}</span>
                </div>
                <div className="text-xs mb-3" style={{color: colors.dunesGrass}}>
                  Includes 12% VAT
                </div>
                <div className="flex justify-between font-medium text-lg pt-3 mb-3" style={{borderTop: `1px solid ${colors.sand}`, color: colors.smoke}}>
                  <span>Total</span>
                  <span>SEK {total.toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => setShowRateInfo(true)}
                  className="text-sm underline"
                  style={{color: colors.dunesGrass}}
                >
                  More info
                </button>
              </div>
            )}

            {range.from && (
              <button 
                onClick={() => setRange({ from: null, to: null })}
                className="mt-4 text-sm underline"
                style={{color: colors.dunesGrass}}
              >
                Clear dates
              </button>
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
                className="w-full px-4 py-4 rounded-lg border-0 outline-none"
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
      <footer className="mt-auto">
        {/* Main Footer */}
        <div className="py-12 px-6 md:px-12" style={{backgroundColor: '#dfddd9'}}>
          <div className="max-w-6xl mx-auto">
            {/* Logo & Tagline */}
            <div className="text-center mb-16">
              <img 
                src="https://hopfarmbeach.com/wp-content/uploads/2025/03/hfb-logo.png" 
                alt="Hop Farm Beach" 
                className="h-10 mx-auto mb-4" 
              />
              <p className="font-dreamers text-base tracking-widest uppercase" style={{color: colors.smoke}}>
                Screens Off, Nature On
              </p>
            </div>

            {/* Three Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16 mb-10">
              {/* Left: Navigation */}
              <div className="text-center md:text-left space-y-2">
                {[
                  { name: 'Cabin', href: 'https://hopfarmbeach.com/cabin/' },
                  { name: 'History', href: 'https://hopfarmbeach.com/history/' },
                  { name: 'Gallery', href: 'https://hopfarmbeach.com/gallery/' },
                  { name: 'Sustainability', href: 'https://hopfarmbeach.com/sustainability/' }
                ].map(item => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="block text-xl font-medium transition-all duration-300 hover:underline hover:translate-x-2"
                    style={{color: colors.smoke}}
                  >
                    {item.name}
                  </a>
                ))}
              </div>

              {/* Center: Contact */}
              <div className="text-center space-y-2">
                <p className="text-xl font-bold mb-2" style={{color: colors.smoke}}>Contact</p>
                <p className="text-lg" style={{color: colors.smoke}}>info@hopfarmbeach.com</p>
                <p className="text-lg" style={{color: colors.smoke}}>+46 707314500</p>
              </div>

              {/* Right: Social */}
              <div className="text-center md:text-right space-y-2">
                {[
                  { name: 'Instagram', href: 'https://www.instagram.com/hopfarmbeach/' },
                  { name: 'Facebook', href: 'https://www.facebook.com/hopfarmbeach' },
                  { name: 'TikTok', href: 'https://www.tiktok.com/@hopfarmbeach' }
                ].map(item => (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xl font-medium transition-all duration-300 hover:underline md:hover:-translate-x-2"
                    style={{color: colors.smoke}}
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t mb-4" style={{borderColor: '#75735f63'}} />

            {/* Bottom Links - left aligned like main site */}
            <div className="flex flex-wrap justify-start gap-x-4 gap-y-2 text-sm" style={{color: colors.smoke}}>
              <a href="https://hopfarmbeach.com/cabin/faq/" className="hover:underline">FAQ</a>
              <a href="https://hopfarmbeach.com/privacy-policy/" className="hover:underline">Privacy Policy</a>
              <a href="https://hopfarmbeach.com/imprint/" className="hover:underline">Imprint</a>
              <a href="https://hopfarmbeach.com/terms-conditions/" className="hover:underline">Terms & Conditions</a>
            </div>
          </div>
        </div>

        {/* Copyright Bar */}
        <div className="py-4 px-4 text-center text-sm" style={{backgroundColor: colors.dunesGrass, color: '#f3f1ed'}}>
          Copyright Hop Farm Beach © 2026 - Web Design by Tom Robak
        </div>
      </footer>

      {/* Rate Info Modal */}
      <RateInfoModal 
        isOpen={showRateInfo}
        onClose={() => setShowRateInfo(false)}
        nights={nights}
        nightlyRate={settings?.nightlyRate || 3495}
        total={total}
      />
    </div>
  )
}

// CALENDAR COMPONENT
function Calendar({ month, setMonth, unavailable, range, setRange, selectionState }) {
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
          const isCheckIn = range.from && day.getTime() === range.from.getTime()
          const isCheckOut = range.to && day.getTime() === range.to.getTime()
          const isSelected = isCheckIn || isCheckOut
          const inRange = isInRange(day)
          
          let bgColor = 'transparent'
          let textColor = colors.smoke
          
          if (isPast) {
            textColor = colors.sand
          } else if (isUnavail) {
            bgColor = colors.stone
            textColor = colors.sand
          } else if (isCheckIn) {
            bgColor = colors.smoke
            textColor = 'white'
          } else if (isCheckOut) {
            bgColor = colors.dunesGrass
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
      
      {/* Legend */}
      <div className="mt-4 pt-4 flex gap-4 text-xs" style={{borderTop: `1px solid ${colors.stone}`, color: colors.dunesGrass}}>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{backgroundColor: colors.smoke}}></div>
          <span>Check-in</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{backgroundColor: colors.dunesGrass}}></div>
          <span>Check-out</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{backgroundColor: colors.stone}}></div>
          <span>Unavailable</span>
        </div>
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
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [bookings, setBookings] = useState([])
  const [blocked, setBlocked] = useState([])
  const [tab, setTab] = useState('bookings')
  const [month, setMonth] = useState(new Date())
  const [showAddBooking, setShowAddBooking] = useState(false)
  const [editingBooking, setEditingBooking] = useState(null)
  const [newBooking, setNewBooking] = useState({ guestName: '', checkIn: '', checkOut: '', guests: 2, source: 'booking.com', notes: '', country: '' })
  const [icalUrl, setIcalUrl] = useState('')
  const [syncing, setSyncing] = useState(false)

  const countries = [
    { code: '', name: 'Select country' },
    { code: 'SE', name: '🇸🇪 Sweden' },
    { code: 'NO', name: '🇳🇴 Norway' },
    { code: 'DK', name: '🇩🇰 Denmark' },
    { code: 'FI', name: '🇫🇮 Finland' },
    { code: 'DE', name: '🇩🇪 Germany' },
    { code: 'NL', name: '🇳🇱 Netherlands' },
    { code: 'GB', name: '🇬🇧 United Kingdom' },
    { code: 'US', name: '🇺🇸 United States' },
    { code: 'CA', name: '🇨🇦 Canada' },
    { code: 'FR', name: '🇫🇷 France' },
    { code: 'ES', name: '🇪🇸 Spain' },
    { code: 'IT', name: '🇮🇹 Italy' },
    { code: 'CH', name: '🇨🇭 Switzerland' },
    { code: 'AT', name: '🇦🇹 Austria' },
    { code: 'BE', name: '🇧🇪 Belgium' },
    { code: 'PL', name: '🇵🇱 Poland' },
    { code: 'AU', name: '🇦🇺 Australia' },
    { code: 'OTHER', name: '🌍 Other' },
  ]

  const countryFlags = {
    'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'DE': '🇩🇪',
    'NL': '🇳🇱', 'GB': '🇬🇧', 'US': '🇺🇸', 'CA': '🇨🇦', 'FR': '🇫🇷',
    'ES': '🇪🇸', 'IT': '🇮🇹', 'CH': '🇨🇭', 'AT': '🇦🇹', 'BE': '🇧🇪',
    'PL': '🇵🇱', 'AU': '🇦🇺', 'OTHER': '🌍'
  }

  const login = async (e) => {
    e.preventDefault()
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    if (res.ok) {
      const data = await res.json()
      setToken(data.token)
      setAuthed(true)
      loadData(data.token)
      loadIcalUrl(data.token)
    } else {
      alert('Invalid password')
    }
  }

  const authHeaders = (t) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${t || token}`
  })

  const loadData = async (t) => {
    try {
      const [b, bl] = await Promise.all([
        fetch('/api/admin/bookings', { headers: authHeaders(t) }).then(r => r.ok ? r.json() : []),
        fetch('/api/admin/blocked', { headers: authHeaders(t) }).then(r => r.ok ? r.json() : [])
      ])
      setBookings(b)
      setBlocked(bl)
    } catch (err) {
      console.error('Load data error:', err)
    }
  }

  const loadIcalUrl = async (t) => {
    try {
      const res = await fetch('/api/admin/ical', { headers: authHeaders(t) })
      if (res.ok) {
        const data = await res.json()
        setIcalUrl(data.url || '')
      }
    } catch (err) {
      console.error('Load iCal URL error:', err)
    }
  }

  const toggleBlock = async (date) => {
    const isBlocked = blocked.includes(date)
    await fetch('/api/admin/block', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ date, block: !isBlocked })
    })
    loadData()
  }

  const cancelBooking = async (id, ref) => {
    if (!confirm(`Cancel booking ${ref}? This will free up the dates.`)) return
    await fetch('/api/admin/cancel', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ id })
    })
    loadData()
  }

  const createManualBooking = async (e) => {
    e.preventDefault()
    const url = editingBooking 
      ? `/api/admin/booking/${editingBooking.id}`
      : '/api/admin/booking'
    const method = editingBooking ? 'PUT' : 'POST'
    
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(newBooking)
    })
    if (res.ok) {
      setShowAddBooking(false)
      setEditingBooking(null)
      setNewBooking({ guestName: '', checkIn: '', checkOut: '', guests: 2, source: 'booking.com', notes: '', country: '' })
      loadData()
    } else {
      const data = await res.json()
      alert(data.error || 'Failed to save booking')
    }
  }

  const startEditBooking = (booking) => {
    setNewBooking({
      guestName: booking.guest_name,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      guests: booking.guests,
      source: booking.source || 'manual',
      notes: booking.guest_email || '',
      country: booking.country || ''
    })
    setEditingBooking(booking)
    setShowAddBooking(true)
  }

  const saveIcalUrl = async () => {
    await fetch('/api/admin/ical', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ url: icalUrl })
    })
    alert('iCal URL saved')
  }

  const syncCalendar = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: authHeaders()
      })
      const data = await res.json()
      if (res.ok) {
        alert(`Synced ${data.synced} new events from calendar`)
        loadData()
      } else {
        alert(data.error || 'Sync failed')
      }
    } catch (err) {
      alert('Sync failed')
    }
    setSyncing(false)
  }

  const sourceColors = {
    'direct': colors.dunesGrass,
    'booking.com': '#003580',
    'airbnb': '#FF5A5F',
    'vrbo': '#3D67FF',
    'campanyon': '#2D5A27',
    'admin': colors.smoke,
    'gcal': '#4285F4',
    'manual': colors.sand
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
    // Parse dates without timezone issues
    const [inYear, inMonth, inDay] = b.check_in.split('-').map(Number)
    const [outYear, outMonth, outDay] = b.check_out.split('-').map(Number)
    let d = new Date(inYear, inMonth - 1, inDay)
    const end = new Date(outYear, outMonth - 1, outDay)
    while (d < end) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      bookedDates.add(dateStr)
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
          <button 
            onClick={() => setTab('settings')} 
            className="px-6 py-4 font-medium"
            style={{
              borderBottom: tab === 'settings' ? `2px solid ${colors.smoke}` : '2px solid transparent',
              color: tab === 'settings' ? colors.smoke : colors.dunesGrass
            }}
          >
            Settings
          </button>
        </div>
      </div>
      <main className="max-w-5xl mx-auto p-4">
        {tab === 'bookings' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowAddBooking(true)}
                className="px-4 py-2 rounded-lg text-white font-medium"
                style={{backgroundColor: colors.smoke}}
              >
                + Add Booking
              </button>
            </div>
            {showAddBooking && (
              <div className="rounded-lg p-6 mb-4" style={{backgroundColor: 'white'}}>
                <h3 className="font-medium mb-4" style={{color: colors.smoke}}>{editingBooking ? 'Edit Booking' : 'Add External Booking'}</h3>
                <form onSubmit={createManualBooking} className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1" style={{color: colors.dunesGrass}}>Guest Name</label>
                    <input
                      type="text"
                      value={newBooking.guestName}
                      onChange={e => setNewBooking({...newBooking, guestName: e.target.value})}
                      required
                      className="w-full px-3 py-2 rounded border-0"
                      style={{backgroundColor: colors.stone, color: colors.smoke}}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{color: colors.dunesGrass}}>Source</label>
                    <select
                      value={newBooking.source}
                      onChange={e => setNewBooking({...newBooking, source: e.target.value})}
                      className="w-full px-3 py-2 rounded border-0"
                      style={{backgroundColor: colors.stone, color: colors.smoke}}
                    >
                      <option value="booking.com">Booking.com</option>
                      <option value="airbnb">Airbnb</option>
                      <option value="vrbo">VRBO</option>
                      <option value="campanyon">Campanyon</option>
                      <option value="admin">Admin Block</option>
                      <option value="manual">Manual / Phone</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{color: colors.dunesGrass}}>Check-in</label>
                    <input
                      type="date"
                      value={newBooking.checkIn}
                      onChange={e => setNewBooking({...newBooking, checkIn: e.target.value})}
                      required
                      className="w-full px-3 py-2 rounded border-0"
                      style={{backgroundColor: colors.stone, color: colors.smoke}}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{color: colors.dunesGrass}}>Check-out</label>
                    <input
                      type="date"
                      value={newBooking.checkOut}
                      onChange={e => setNewBooking({...newBooking, checkOut: e.target.value})}
                      required
                      className="w-full px-3 py-2 rounded border-0"
                      style={{backgroundColor: colors.stone, color: colors.smoke}}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{color: colors.dunesGrass}}>Guests</label>
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={newBooking.guests}
                      onChange={e => setNewBooking({...newBooking, guests: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 rounded border-0"
                      style={{backgroundColor: colors.stone, color: colors.smoke}}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{color: colors.dunesGrass}}>Country</label>
                    <select
                      value={newBooking.country}
                      onChange={e => setNewBooking({...newBooking, country: e.target.value})}
                      className="w-full px-3 py-2 rounded border-0"
                      style={{backgroundColor: colors.stone, color: colors.smoke}}
                    >
                      {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm mb-1" style={{color: colors.dunesGrass}}>Notes (optional)</label>
                    <input
                      type="text"
                      value={newBooking.notes}
                      onChange={e => setNewBooking({...newBooking, notes: e.target.value})}
                      placeholder="Booking ID, email, etc."
                      className="w-full px-3 py-2 rounded border-0"
                      style={{backgroundColor: colors.stone, color: colors.smoke}}
                    />
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded text-white font-medium"
                      style={{backgroundColor: colors.dunesGrass}}
                    >
                      {editingBooking ? 'Update Booking' : 'Save Booking'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddBooking(false); setEditingBooking(null); setNewBooking({ guestName: '', checkIn: '', checkOut: '', guests: 2, source: 'booking.com', notes: '', country: '' }); }}
                      className="px-4 py-2 rounded font-medium"
                      style={{backgroundColor: colors.stone, color: colors.smoke}}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          <div className="rounded-lg overflow-hidden" style={{backgroundColor: 'white'}}>
            <table className="w-full">
              <thead style={{backgroundColor: colors.stone}}>
                <tr className="text-left text-sm" style={{color: colors.dunesGrass}}>
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Guest</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center" style={{color: colors.dunesGrass}}>
                      No bookings yet
                    </td>
                  </tr>
                ) : bookings.map(b => (
                  <tr key={b.id} style={{borderTop: `1px solid ${colors.stone}`}}>
                    <td className="px-4 py-3 font-mono text-sm" style={{color: colors.smoke}}>{b.booking_ref}</td>
                    <td className="px-4 py-3">
                      <span style={{color: colors.smoke}}>{b.guest_name}</span>
                      {b.guest_email && <><br/><span className="text-sm" style={{color: colors.dunesGrass}}>{b.guest_email}</span></>}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{color: colors.smoke}}>{b.check_in} → {b.check_out}</td>
                    <td className="px-4 py-3">
                      <span 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: sourceColors[b.source] || colors.sand,
                          color: 'white'
                        }}
                      >
                        {b.source || 'direct'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xl" title={b.country}>
                      {countryFlags[b.country] || ''}
                    </td>
                    <td className="px-4 py-3">
                      <span 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: b.status === 'confirmed' ? colors.dunesGrass : b.status === 'cancelled' ? '#991b1b' : colors.sand,
                          color: 'white'
                        }}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      {b.status === 'confirmed' && (
                        <>
                          <button
                            onClick={() => startEditBooking(b)}
                            className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-70"
                            style={{backgroundColor: colors.stone, color: colors.smoke}}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => cancelBooking(b.id, b.booking_ref)}
                            className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-70"
                            style={{backgroundColor: '#fee2e2', color: '#991b1b'}}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
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
        {tab === 'settings' && (
          <div className="rounded-lg p-6" style={{backgroundColor: 'white'}}>
            <h3 className="font-medium mb-6" style={{color: colors.smoke}}>Google Calendar Sync</h3>
            <p className="text-sm mb-4" style={{color: colors.dunesGrass}}>
              Paste your Google Calendar iCal URL to automatically import bookings from other platforms (Booking.com, Airbnb, etc.) that sync to your calendar.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                type="url"
                value={icalUrl}
                onChange={e => setIcalUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/..."
                className="flex-1 px-4 py-2 rounded border-0"
                style={{backgroundColor: colors.stone, color: colors.smoke}}
              />
              <button
                onClick={saveIcalUrl}
                className="px-4 py-2 rounded text-white font-medium"
                style={{backgroundColor: colors.dunesGrass}}
              >
                Save
              </button>
            </div>
            <button
              onClick={syncCalendar}
              disabled={syncing || !icalUrl}
              className="px-4 py-2 rounded text-white font-medium disabled:opacity-50"
              style={{backgroundColor: colors.smoke}}
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <p className="text-xs mt-4" style={{color: colors.dunesGrass}}>
              To get your iCal URL: Google Calendar → Settings → [Your Calendar] → Integrate calendar → Secret address in iCal format
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
