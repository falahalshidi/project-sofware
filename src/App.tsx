import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import L from 'leaflet'
import { ArrowUpRight, Bike, Bot, Cloud, Coffee, Globe2, GitCompareArrows, LocateFixed, Map as MapIcon, Moon, Plus, Search, Send, Settings2, Sun, Trash2, Utensils, X } from 'lucide-react'
import type { Place, WeatherData } from './types'

const configuredApi = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
// A localhost API URL is useful during development, but it can never work
// from the deployed Netlify page. The browser fallback below keeps the main
// weather experience working when only the static client is deployed.
const API = configuredApi && !/localhost|127\.0\.0\.1/.test(configuredApi)
  ? configuredApi
  : import.meta.env.DEV ? (configuredApi || 'http://localhost:8787/api') : ''
const weatherUrl = (latitude: number, longitude: number) => `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
  latitude: String(latitude), longitude: String(longitude), timezone: 'auto', forecast_days: '14',
  current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,uv_index',
  hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,relative_humidity_2m,cloud_cover,uv_index',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',
})}`
const searchUrl = (query: string) => `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: query, count: '8', language: 'en', format: 'json' })}`
const reverseGeocodeUrl = (latitude: number, longitude: number) => `https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: 'jsonv2', 'accept-language': 'ar,en' })}`
const defaultPlace: Place = { id: '23.5880:58.3829', name: 'Muscat', country: 'Oman', latitude: 23.588, longitude: 58.3829, timezone: 'Asia/Muscat' }
const normalizePlace = (value: Place) => value.name === 'مسقط' ? { ...value, name: 'Muscat' } : value
const labels: Record<number, string> = { 0: 'Clear', 1: 'Partly cloudy', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Foggy', 51: 'Drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 80: 'Rain showers', 95: 'Thunderstorm' }
const icon = (code: number) => code >= 95 ? '⚡' : code >= 51 ? '🌦' : code >= 3 ? '☁' : '☀'
const num = (value: unknown, fallback = 0) => typeof value === 'number' ? Math.round(value) : fallback
function localAssistantAnswer(question: string, weather: WeatherData | null, place: Place) {
  const current = weather?.current
  const temperature = num(current?.temperature_2m, NaN)
  const feelsLike = num(current?.apparent_temperature, NaN)
  const humidity = num(current?.relative_humidity_2m, NaN)
  const rainChance = num(weather?.hourly?.precipitation_probability?.[0], NaN)
  const isArabic = /[\u0600-\u06FF]/.test(question)
  const location = `${place.name}${place.country ? `, ${place.country}` : ''}`
  if (/مظلة|umbrella|مطر|rain/i.test(question)) return isArabic ? `في ${location} الحرارة الآن ${temperature}° والمحسوسة ${feelsLike}°. احتمال الهطول القريب ${rainChance}%. ${rainChance >= 40 ? 'أنصح بأخذ مظلة.' : 'لا تبدو المظلة ضرورية حاليًا.'}` : `In ${location}, it is ${temperature}° and feels like ${feelsLike}°. The near-term precipitation chance is ${rainChance}%. ${rainChance >= 40 ? 'Take an umbrella.' : 'An umbrella is probably not needed right now.'}`
  if (/مشي|walk|جري|run|دراجة|cycling/i.test(question)) return isArabic ? `الجو في ${location} الآن ${temperature}° والمحسوسة ${feelsLike}°، والرطوبة ${humidity}%. ${feelsLike <= 32 && rainChance < 40 ? 'مناسب للنشاط الخارجي، ويفضل اختيار وقت أبرد.' : 'الأفضل اختيار وقت أبرد ومراجعة المطر قبل الخروج.'}` : `In ${location}, it is ${temperature}° with a feels-like temperature of ${feelsLike}° and ${humidity}% humidity. ${feelsLike <= 32 && rainChance < 40 ? 'It is suitable for an outdoor activity; a cooler time is preferable.' : 'Choose a cooler time and check rain conditions before going out.'}`
  return isArabic ? `الطقس الحالي في ${location}: ${temperature}°، والمحسوس ${feelsLike}°، والرطوبة ${humidity}%. هذه إجابة مبنية على بيانات الطقس الحالية المتاحة.` : `Current weather in ${location}: ${temperature}°, feels like ${feelsLike}°, with ${humidity}% humidity. This answer is based on the available live weather data.`
}

export default function App() {
  const [place, setPlace] = useState<Place>(() => normalizePlace(JSON.parse(localStorage.getItem('skycast:place') || 'null') || defaultPlace))
  const [favorites, setFavorites] = useState<Place[]>(() => (JSON.parse(localStorage.getItem('skycast:favorites') || 'null') || [defaultPlace]).map(normalizePlace))
  const [favoriteTemps, setFavoriteTemps] = useState<Record<string, number>>({})
  const [placesOpen, setPlacesOpen] = useState(false)
  const [favoriteQuery, setFavoriteQuery] = useState('')
  const [favoriteResults, setFavoriteResults] = useState<Place[]>([])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareFirstQuery, setCompareFirstQuery] = useState('')
  const [compareSecondQuery, setCompareSecondQuery] = useState('')
  const [compareFirstResults, setCompareFirstResults] = useState<Place[]>([])
  const [compareSecondResults, setCompareSecondResults] = useState<Place[]>([])
  const [compareFirst, setCompareFirst] = useState<Place | null>(null)
  const [compareSecond, setCompareSecond] = useState<Place | null>(null)
  const [compareWeather, setCompareWeather] = useState<[WeatherData | null, WeatherData | null]>([null, null])
  const [compareLoading, setCompareLoading] = useState(false)
  const [unit, setUnit] = useState<'C' | 'F'>('C')
  const [dark, setDark] = useState(() => localStorage.getItem('skycast:theme') === 'dark')
  const [loading, setLoading] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState([{ role: 'bot', text: 'Hi! Ask me about today’s weather or the best time for an activity.' }])

  useEffect(() => { localStorage.setItem('skycast:place', JSON.stringify(place)); localStorage.setItem('skycast:favorites', JSON.stringify(favorites)); localStorage.setItem('skycast:theme', dark ? 'dark' : 'light'); document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [place, favorites, dark])
  useEffect(() => { void loadWeather(place) }, [place])
  useEffect(() => { const timer = setTimeout(() => { if (query.trim().length > 1) void searchPlaces(query) }, 350); return () => clearTimeout(timer) }, [query])
  useEffect(() => { const timer = setTimeout(() => { if (compareFirstQuery.trim().length > 1 && compareFirstQuery !== compareFirst?.name) void searchComparisonPlaces(compareFirstQuery, setCompareFirstResults) }, 350); return () => clearTimeout(timer) }, [compareFirstQuery, compareFirst])
  useEffect(() => { const timer = setTimeout(() => { if (compareSecondQuery.trim().length > 1 && compareSecondQuery !== compareSecond?.name) void searchComparisonPlaces(compareSecondQuery, setCompareSecondResults) }, 350); return () => clearTimeout(timer) }, [compareSecondQuery, compareSecond])
  useEffect(() => { if (!compareFirst || !compareSecond) { setCompareWeather([null, null]); return }; setCompareLoading(true); void Promise.all([loadWeatherData(compareFirst), loadWeatherData(compareSecond)]).then((data) => setCompareWeather(data as [WeatherData | null, WeatherData | null])).finally(() => setCompareLoading(false)) }, [compareFirst, compareSecond])
  useEffect(() => { const timer = setTimeout(() => { if (favoriteQuery.trim().length > 1) void searchFavoritePlaces(favoriteQuery) }, 350); return () => clearTimeout(timer) }, [favoriteQuery])
  useEffect(() => { void loadFavoriteTemperatures() }, [favorites])
  useEffect(() => { if (chatMessagesRef.current) chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight }, [messages, isTyping])
  useEffect(() => {
    function closeSearch(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest('.ask-input')) setResults([])
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setResults([]); setQuery('') }
    }
    document.addEventListener('mousedown', closeSearch)
    document.addEventListener('keydown', closeWithEscape)
    return () => { document.removeEventListener('mousedown', closeSearch); document.removeEventListener('keydown', closeWithEscape) }
  }, [])

  async function loadWeather(target: Place) { setLoading(true); try { const response = await fetch(API ? `${API}/weather?latitude=${target.latitude}&longitude=${target.longitude}` : weatherUrl(target.latitude, target.longitude)); setWeather(response.ok ? await response.json() : null) } catch { setWeather(null) } finally { setLoading(false) } }
  async function searchPlaces(value: string) { try { const response = await fetch(API ? `${API}/search?q=${encodeURIComponent(value)}` : searchUrl(value)); const data = await response.json(); const items = data.results || []; setResults(items.map((item: any) => ({ id: item.id || `${item.latitude}:${item.longitude}`, name: item.name, country: item.country || item.country_code, admin1: item.admin1, latitude: item.latitude, longitude: item.longitude, timezone: item.timezone }))) } catch { setResults([]) } }
  async function searchFavoritePlaces(value: string) { try { const response = await fetch(API ? `${API}/search?q=${encodeURIComponent(value)}` : searchUrl(value)); const data = await response.json(); const items = data.results || []; setFavoriteResults(items.map((item: any) => ({ id: item.id || `${item.latitude}:${item.longitude}`, name: item.name, country: item.country || item.country_code, admin1: item.admin1, latitude: item.latitude, longitude: item.longitude, timezone: item.timezone }))) } catch { setFavoriteResults([]) } }
  async function searchComparisonPlaces(value: string, setter: (places: Place[]) => void) { try { const response = await fetch(API ? `${API}/search?q=${encodeURIComponent(value)}` : searchUrl(value)); const data = await response.json(); const items = data.results || []; setter(items.map((item: any) => ({ id: item.id || `${item.latitude}:${item.longitude}`, name: item.name, country: item.country || item.country_code, admin1: item.admin1, latitude: item.latitude, longitude: item.longitude, timezone: item.timezone }))) } catch { setter([]) } }
  async function loadWeatherData(target: Place) { try { const response = await fetch(API ? `${API}/weather?latitude=${target.latitude}&longitude=${target.longitude}` : weatherUrl(target.latitude, target.longitude)); return response.ok ? await response.json() as WeatherData : null } catch { return null } }
  async function loadFavoriteTemperatures() { const pairs = await Promise.all(favorites.map(async (item) => { try { const response = await fetch(API ? `${API}/weather?latitude=${item.latitude}&longitude=${item.longitude}` : weatherUrl(item.latitude, item.longitude)); const data = await response.json(); return [item.id, num(data?.current?.temperature_2m)] as const } catch { return [item.id, 0] as const } })); setFavoriteTemps(Object.fromEntries(pairs)) }
  function choosePlace(next: Place) { setPlace(next); setQuery(''); setResults([]) }
  function useLocation() { navigator.geolocation?.getCurrentPosition(async (position) => { const latitude = position.coords.latitude; const longitude = position.coords.longitude; try { const response = await fetch(API ? `${API}/reverse-geocode?latitude=${latitude}&longitude=${longitude}` : reverseGeocodeUrl(latitude, longitude)); const placeName = await response.json(); const address = placeName.address || {}; choosePlace({ id: `${latitude}:${longitude}`, name: placeName.name || address.city || address.town || address.village || 'Current location', country: placeName.country || address.country || 'GPS', latitude, longitude }) } catch { choosePlace({ id: `${latitude}:${longitude}`, name: 'Current location', country: 'GPS', latitude, longitude }) } }) }
  function addFavorite() { if (!favorites.some((item) => item.id === place.id)) setFavorites([...favorites, place]) }
  function addPlace(next: Place) { if (!favorites.some((item) => item.id === next.id)) setFavorites([...favorites, next]); choosePlace(next); setPlacesOpen(false); setFavoriteQuery(''); setFavoriteResults([]) }
  function removeFavorite(id: string) { setFavorites(favorites.filter((item) => item.id !== id)) }
  async function ask(text = chatInput) {
    const question = text.trim()
    if (!question || isTyping) return
    setMessages((items) => [...items, { role: 'user', text: question }])
    setChatInput('')
    setIsTyping(true)
    if (/where|location|locate|my place|موقعي|مكاني/i.test(question)) {
      await new Promise((resolve) => setTimeout(resolve, 550))
      setMessages((items) => [...items, { role: 'bot', text: `Your selected location is ${place.name}${place.country ? `, ${place.country}` : ''}. To use your device location, click “Use my location”.` }])
      setIsTyping(false)
      return
    }
    try {
      if (!API) {
        await new Promise((resolve) => setTimeout(resolve, 700))
        setMessages((items) => [...items, { role: 'bot', text: localAssistantAnswer(question, weather, place) }])
      } else {
        const response = await fetch(`${API}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, weather, location: { name: place.name, country: place.country, latitude: place.latitude, longitude: place.longitude } }) })
        const data = await response.json()
        setMessages((items) => [...items, { role: 'bot', text: data.answer || data.message || 'I could not get an answer.' }])
      }
    } catch { setMessages((items) => [...items, { role: 'bot', text: localAssistantAnswer(question, weather, place) }]) }
    finally { setIsTyping(false) }
  }

  const current = weather?.current
  const daily = weather?.daily
  const hourly = weather?.hourly
  const currentCode = num(current?.weather_code)
  // Keep the headline on the measured current temperature; show feels-like
  // separately so it cannot be confused with the phone's main temperature.
  const temperature = num(current?.temperature_2m)
  const displayTemperature = unit === 'C' ? temperature : Math.round(temperature * 9 / 5 + 32)
  const dayAhead = useMemo(() => {
    if (!hourly?.time?.length) return []
    const currentTime = String(current?.time || '')
    const found = hourly.time.findIndex((time) => String(time) >= currentTime)
    const start = found < 0 ? 0 : found
    return Array.from({ length: Math.min(24, hourly.time.length - start) }, (_, offset) => {
      const index = start + offset
      return { hour: new Date(String(hourly.time?.[index])).toLocaleTimeString('en', { hour: 'numeric' }), temp: num(hourly.temperature_2m?.[index]), code: num(hourly.weather_code?.[index]) }
    })
  }, [hourly, current?.time])
  const activities = [{ title: 'Coffee', detail: 'Best before 2 PM', tone: 'sand', icon: <Coffee size={42} strokeWidth={1.5} />, score: 'Excellent' }, { title: 'Cycling', detail: 'Best before 5 PM', tone: 'blue', icon: <Bike size={42} strokeWidth={1.5} />, score: 'Great' }, { title: 'Dinner', detail: 'Best after 7 PM', tone: 'stone', icon: <Utensils size={42} strokeWidth={1.5} />, score: 'Good' }]

  return <div className="app-shell">
    <header className="app-header"><div className="brand"><span className="brand-symbol"><Cloud size={21} /></span><strong>SkyCast</strong><span className="brand-muted">Weather</span></div><div className="header-center"><span className="live-dot" />Live weather · {place.name}</div><div className="header-actions"><button className="header-link" onClick={() => setChatOpen(true)}><Bot size={17} />Assistant</button><button className="circle-btn" onClick={() => setDark(!dark)}>{dark ? <Sun size={17} /> : <Moon size={17} />}</button><button className="circle-btn" onClick={() => setUnit(unit === 'C' ? 'F' : 'C')}>°{unit === 'C' ? 'F' : 'C'}</button></div></header>
    <main className="weather-canvas">
      <section className="ask-bar"><button className="ask-copy" onClick={() => setCompareOpen(!compareOpen)}><GitCompareArrows size={18} /><span>Compare cities</span></button><div className="ask-input"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a city..." /><button onClick={() => { setResults([]); choosePlace(defaultPlace) }} aria-label="Choose city"><ArrowUpRight size={19} /></button>{results.length > 0 && <div className="search-results">{results.map((item) => <button key={item.id} onClick={() => choosePlace(item)}><Globe2 size={15} /><span><b>{item.name}</b><small>{[item.admin1, item.country].filter(Boolean).join(', ')}</small></span></button>)}</div>}</div><button className="location-link" onClick={() => { setResults([]); useLocation() }}><LocateFixed size={16} />Use my location</button></section>
      {compareOpen && <section className="compare-panel paper-card"><div className="compare-panel-head"><div><span className="kicker">Weather route</span><h2>Compare two cities</h2><p>Choose a starting city and a destination to compare their weather.</p></div><button className="circle-btn" onClick={() => setCompareOpen(false)} aria-label="Close comparison"><X size={16} /></button></div><div className="compare-pickers"><CityPicker label="From" value={compareFirst} query={compareFirstQuery} results={compareFirstResults} placeholder="Search first city..." onQueryChange={setCompareFirstQuery} onChoose={(next) => { setCompareFirst(next); setCompareFirstQuery(next.name); setCompareFirstResults([]) }} /><div className="compare-arrow"><GitCompareArrows size={20} /></div><CityPicker label="To" value={compareSecond} query={compareSecondQuery} results={compareSecondResults} placeholder="Search second city..." onQueryChange={setCompareSecondQuery} onChoose={(next) => { setCompareSecond(next); setCompareSecondQuery(next.name); setCompareSecondResults([]) }} /></div>{compareFirst && compareSecond && <div className="comparison-results">{compareLoading ? <div className="compare-loading">Loading comparison…</div> : <>{[compareFirst, compareSecond].map((city, index) => <WeatherCompareCard key={city.id} place={city} weather={compareWeather[index]} unit={unit} />)}</>}</div>}</section>}
      <section className="weather-layout">
        <div className="day-card paper-card"><div className="card-top"><div><span className="kicker">Today’s outlook</span><h1>Your day ahead</h1><p>Swipe the hours to explore the rest of your day.</p></div><button className="more-btn"><Settings2 size={17} /></button></div><div className="hour-columns">{loading ? <div className="hour-loading">Loading today’s hourly forecast…</div> : dayAhead.length ? dayAhead.map((item, index) => <div key={`${item.hour}-${index}`} className={`hour-column ${index === 0 ? 'is-current' : ''}`}><strong>{item.temp}°</strong><span className="hour-weather">{icon(item.code)}</span><small>{item.hour}</small></div>) : <div className="hour-loading">Hourly forecast is unavailable.</div>}</div><div className="activity-head"><h2>What suits you today?</h2><span>Weather-based suggestions</span></div><div className="activity-grid">{activities.map((item) => <div className={`activity-card ${item.tone}`} key={item.title}><span className="activity-score">{item.score}</span><div className="activity-visual">{item.icon}</div><h3>{item.title}</h3><p>{item.detail}</p></div>)}</div></div>
        <aside className="today-column"><div className="today-card paper-card"><span className="kicker">Current weather</span><h2>Current temperature</h2><div className="today-temp">{loading || !weather ? '—' : `${displayTemperature}°`}</div><div className="today-status"><span>{icon(currentCode)}</span>{labels[currentCode] || 'Clear'}</div><div className="clock-grid"><div><strong>{daily ? new Date(String(daily.sunrise?.[0])).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '06:03'}</strong><small>Sunrise</small></div><div><strong>{daily ? new Date(String(daily.sunset?.[0])).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : '06:00'}</strong><small>Sunset</small></div></div><div className="today-location">{new Date().toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}<br /><strong>{place.name}, {place.country}</strong></div></div><div className="quick-metrics paper-card"><Metric label="High" value={`${daily ? num(daily.temperature_2m_max?.[0]) : '—'}°`} /><Metric label="Low" value={`${daily ? num(daily.temperature_2m_min?.[0]) : '—'}°`} /><Metric label="Feels like" value={`${current ? num(current.apparent_temperature) : '—'}°`} /><Metric label="Humidity" value={`${current ? num(current.relative_humidity_2m) : '—'}%`} /></div></aside>
      </section>
      <section className="below-grid"><div className="map-card paper-card"><div className="section-head"><div><span className="kicker">Explore the world</span><h2>Weather map</h2></div><button className="location-link"><MapIcon size={15} />Open map</button></div><WeatherMap place={place} /></div><div className="favorites-card paper-card"><div className="section-head"><div><span className="kicker">Saved places</span><h2>My places</h2></div><button className="circle-btn" onClick={() => setPlacesOpen(!placesOpen)}><Plus size={17} /></button></div>{placesOpen && <div className="favorites-add-panel"><div className="favorites-search"><Search size={15} /><input autoFocus value={favoriteQuery} onChange={(event) => setFavoriteQuery(event.target.value)} placeholder="Search for a city to add..." /></div>{favoriteResults.map((item) => <button key={item.id} onClick={() => addPlace(item)}><b>{item.name}</b><small>{[item.admin1, item.country].filter(Boolean).join(', ')}</small><Plus size={14} /></button>)}</div>}{favorites.slice(0, 4).map((item) => <button className={`favorite-row ${item.id === place.id ? 'active' : ''}`} key={item.id} onClick={() => choosePlace(item)}><span className="fav-icon">{icon(currentCode)}</span><span><b>{item.name}</b><small>{item.country}</small></span><strong>{favoriteTemps[item.id] ? `${unit === 'C' ? favoriteTemps[item.id] : Math.round(favoriteTemps[item.id] * 9 / 5 + 32)}°` : '—'}</strong>{favorites.length > 1 && <i onClick={(event) => { event.stopPropagation(); removeFavorite(item.id) }}><Trash2 size={14} /></i>}</button>)}</div></section>
    </main>
    {chatOpen && <div className="chat-panel"><div className="chat-head"><div><b>SkyCast AI</b><small>Weather assistant · {place.name}</small></div><button onClick={() => setChatOpen(false)} aria-label="Close chat"><X size={17} /></button></div><div className="chat-messages" ref={chatMessagesRef}>{messages.map((message, index) => <div className={`bubble ${message.role}`} key={index}>{message.text}</div>)}{isTyping && <div className="bubble bot typing" aria-label="Assistant is typing"><i></i><i></i><i></i></div>}</div><div className="chat-suggestions"><button onClick={() => void ask('Is the weather good for a walk?')}>Good for a walk?</button><button onClick={() => void ask('Do I need an umbrella?')}>Do I need an umbrella?</button></div><div className="chat-input"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void ask()} placeholder="Ask a question..." disabled={isTyping} /><button onClick={() => void ask()} disabled={isTyping} aria-label="Send question"><Send size={16} /></button></div></div>}
  </div>
}

function CityPicker({ label, value, query, results, placeholder, onQueryChange, onChoose }: { label: string; value: Place | null; query: string; results: Place[]; placeholder: string; onQueryChange: (value: string) => void; onChoose: (place: Place) => void }) { return <div className="city-picker"><label>{label}</label><div className="city-input"><Search size={15} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={placeholder} /><span>{value ? '✓' : ''}</span></div>{results.length > 0 && <div className="compare-results">{results.map((item) => <button key={item.id} onClick={() => onChoose(item)}><Globe2 size={14} /><span><b>{item.name}</b><small>{[item.admin1, item.country].filter(Boolean).join(', ')}</small></span></button>)}</div>}</div> }
function WeatherCompareCard({ place, weather, unit }: { place: Place; weather: WeatherData | null; unit: 'C' | 'F' }) { const current = weather?.current; const daily = weather?.daily; const temperature = num(current?.temperature_2m); const display = unit === 'C' ? temperature : Math.round(temperature * 9 / 5 + 32); const feels = num(current?.apparent_temperature); return <article className="compare-card"><div className="compare-card-title"><div><span className="kicker">{place.country || 'Location'}</span><h3>{place.name}</h3></div><span className="compare-condition">{icon(num(current?.weather_code))}</span></div><div className="compare-temperature">{weather ? `${display}°` : '—'}</div><p className="compare-label">{labels[num(current?.weather_code)] || 'Weather unavailable'}</p><div className="compare-metrics"><span><b>{weather ? `${num(daily?.temperature_2m_max?.[0])}°` : '—'}</b>High</span><span><b>{weather ? `${num(daily?.temperature_2m_min?.[0])}°` : '—'}</b>Low</span><span><b>{weather ? `${feels}°` : '—'}</b>Feels like</span><span><b>{weather ? `${num(current?.relative_humidity_2m)}%` : '—'}</b>Humidity</span></div></article> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric-cell"><strong>{value}</strong><span>{label}</span></div> }
function WeatherMap({ place }: { place: Place }) { const mapElement = useRef<HTMLDivElement>(null); const mapRef = useRef<L.Map | null>(null); const markerRef = useRef<L.Marker | null>(null); useEffect(() => { if (!mapElement.current || mapRef.current) return; const map = L.map(mapElement.current, { zoomControl: false }).setView([place.latitude, place.longitude], 4); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map); L.control.zoom({ position: 'bottomright' }).addTo(map); const markerIcon = L.divIcon({ className: 'skycast-marker', html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14] }); markerRef.current = L.marker([place.latitude, place.longitude], { icon: markerIcon }).addTo(map).bindPopup(`<b>${place.name}</b>`).openPopup(); mapRef.current = map; return () => { map.remove(); mapRef.current = null } }, []); useEffect(() => { if (mapRef.current && markerRef.current) { mapRef.current.flyTo([place.latitude, place.longitude], 4); markerRef.current.setLatLng([place.latitude, place.longitude]).setPopupContent(`<b>${place.name}</b>`).openPopup() } }, [place]); return <div className="map-wrap"><div ref={mapElement} className="leaflet-map" /><div className="map-overlay"><span>🌡 Temperature</span><span>🌧 Rain</span><span>💨 Wind</span></div></div> }
