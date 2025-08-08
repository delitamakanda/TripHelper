import { useState } from 'react'
import { db } from './db'
import { Button, Input } from 'react-aria-components'
import { DateRangeCreator} from "./components/date-range-creator/date-range-creator.tsx";
import { Card, CardContent } from './components/card/Card'
import './App.css'
import { formatDayLabel } from './utils/formatter'

const initialItinerary = import.meta.env.DEV ? [
    {
        day: "2025-11-30", // Dim 30/11
        activities: ["Songshan Ciyou Temple", "Rainbow Bridge", "Raohe Night Market"],
        items: ["Passeport", "Cash NT$", "EasyCard", "Sac à dos"],
        budget: 3500
    },
    {
        day: "2025-12-01",
        activities: ["Xiangshan Trail", "Beitou Thermal Valley", "Onsen Long Nice"],
        items: ["Chaussures confort", "Maillot de bain", "Serviette", "Crème solaire"],
        budget: 3500
    },
    {
        day: "2025-12-02",
        activities: ["Jiufen Old Street", "Golden Waterfall", "Yinyang Sea"],
        items: ["Batterie externe", "Snacks", "Cash NT$", "Vêtements confort"],
        budget: 3500
    },
    {
        day: "2025-12-03",
        activities: ["Chiang Kai-shék Memorial", "Spa des oreilles Ximending", "Tamsui balade"],
        items: ["Réservation Spa", "Tenue confortable", "Cash NT$", "Baume à lèvres"],
        budget: 5200
    },
    {
        day: "2025-12-04",
        activities: ["Yangmingshan National Park", "Shilin Night Market"],
        items: ["Chaussures rando", "Coupe-vent", "Cash NT$", "EasyCard"],
        budget: 3500
    },
    {
        day: "2025-12-05",
        activities: ["Shifen Waterfall", "Lanternes", "Houtong Cat Village"],
        items: ["Batterie externe", "Souvenirs", "Gourde", "Chaussures confort"],
        budget: 3500
    },
    {
        day: "2025-12-06",
        activities: ["Takeout Din Tai Fung", "Yongkang Park", "Drunken Moon Lake"],
        items: ["Tote bag", "Cash NT$", "Crème solaire", "Lunettes de soleil"],
        budget: 3500
    }
] : []

function App() {
    const [checked, setChecked] = useState<Record<string, string>>({})
    const [expenses, setExpenses] = useState<Record<string, string>>({})
    const [itinerary, setItinerary] = useState(initialItinerary)
    const [newItem, setNewItem] = useState<Record<string, string>>({})
    const [newActivity, setNewActivity] = useState<Record<string, string>>({})
    const [ntdValue, setNtdValue] = useState<string>("")
    const [exchangeRate, setExchangeRate] = useState<number>(0.0256)
    const [loadingRate, setLoadingRate] = useState<boolean>(false)
    const [selectedCurrency, setSelectedCurrency] = useState(() => localStorage.getItem('preferedCurrency') || 'EUR')
    const [currencyValue, setCurrencyValue] = useState<string>("")

  return (
      <div className="max-w-screen-sm mx-auto px-4 py-6 space-y-6">
          <h1 className="text-2xl font-bold mb-2 text-center">📅 Planificateur de voyage</h1>

          {/* days selector */}
          <Card>
              <CardContent className="space-y-3">
                  <h2 className="text-lg font-semibold">🗓️ Créer plusieurs jours d'affilée</h2>
                  <DateRangeCreator onCreate={(days) => setItinerary(prev => [...prev, ...days])} />
              </CardContent>
          </Card>

          {/* maj cloud */}
          <Card>
              <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">Cloud sync</div>
                  <div className="flex gap-2">
                      <Button>🔁 Synchroniser maintenant</Button>
                  </div>
              </CardContent>
              {/* convertisseur de devises */}
              <CardContent className="space-y-4">
                  <h2 className="text-lg font-semibold">💱 Convertisseur de devises</h2>
                  <div className="flex items-center gap-2">
                      <label className="text-sm">Devise : </label>
                      <select className="border rounded px-2 py-1 text-sm" value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value)}>
                          {
                              ['EUR', 'USD', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'SGD', 'HKD', 'KRW'].map(currency => (
                                  <option key={currency} value={currency}>{currency}</option>
                              ))
                          }
                      </select>
                      <Button>Convertir</Button>
                  </div>
                  <div>
                      <p className="text-xs text-gray-500">1 {selectedCurrency} ≈ {(1 / exchangeRate).toFixed(4)} TWD</p>
                      <div className="flex gap-2">
                          <Input type="number" placeholder={`Montant en ${selectedCurrency}`} value={currencyValue} onChange={e => setCurrencyValue(e.target.value)} />
                      </div>
                      {currencyValue && <p className="text-sm mt-1">≈ {(parseFloat(currencyValue) * (1 / exchangeRate)).toFixed(2)} TWD</p>}
                  </div>

                  <div>
                      <p className="text-xs text-gray-500">1 TWD ≈ {exchangeRate.toFixed(4)} {selectedCurrency}</p>
                      <div className="flex gap-2">
                          <Input type="number" placeholder="Montant en TWD" value={ntdValue} onChange={e => setNtdValue(e.target.value)} />
                      </div>
                      {ntdValue && <p className="text-sm mt-1">≈ {(parseFloat(ntdValue) * exchangeRate).toFixed(2)} {selectedCurrency}</p>}
                  </div>
              </CardContent>
          </Card>

          {/* itinerary */}
          {itinerary.map(({ day, activities, items, budget }) => (
              <Card key={day}>
                  <CardContent className="space-y-4">
                      <h2 className="text-lg font-semibold">{formatDayLabel(day)}</h2>
                      <div>
                          <p className="text-sm font-medium">Activités :</p>
                          <ul className="list-disc list-inside text-sm text-gray-700">
                              {activities.map((activity, idx) => (
                                  <li key={idx} className="flex items-center justify-between"><span>{activity}</span>
                                      <Button>❌</Button>
                                  </li>
                              ))}
                          </ul>
                          <div className="flex gap-2 mt-2">
                              <Input placeholder="Nouvelle activité" value={newActivity[day] || ""} onChange={e => setNewActivity(prev => ({ ...prev, [day]: e.target.value }))} />
                              <Button>➕</Button>
                          </div>
                      </div>
                      <div>
                          <p className="font-medium text-sm">À emporter :</p>
                          <ul className="space-y-1">
                              {items.map((item, idx) => (
                                  <li key={idx} className={`flex items-center justify-between px-3 py-1 rounded-lg border text-sm ${checked[day]?.includes(item) ? "bg-green-100 line-through text-gray-500" : "bg-white"}`}><span>{item}</span>
                                      <div className="flex gap-2">
                                          <Button>
                                              {checked[day]?.includes(item) ? "✔️" : "🧳"}
                                          </Button>
                                          <Button>❌</Button>
                                      </div>
                                  </li>
                              ))}
                          </ul>
                          <div className="flex gap-2 mt-2">
                              <Input placeholder="Nouvel objet à emporter" value={newItem[day] || ""} onChange={e => setNewItem(prev => ({ ...prev, [day]: e.target.value }))} />
                              <Button>➕</Button>
                          </div>
                      </div>

                      <div className="space-y-1">

                      </div>
                  </CardContent>
              </Card>
          ))}

          <Card>
              <CardContent className="space-y-2">
                  <h2 className="text-lg font-semibold text-center">📊 Récapitulatif Global</h2>
              </CardContent>
          </Card>
      </div>
  )
}

export default App
