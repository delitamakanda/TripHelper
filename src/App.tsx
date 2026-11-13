import {useRef, useState, useEffect, useCallback} from 'react'
import { db } from './db'
import { Button, Input } from 'react-aria-components'
import { DateRangeCreator} from "./components/date-range-creator/date-range-creator.tsx";
import { Card, CardContent } from './components/card/Card'
import './App.css'
import { formatDayLabel, formatCurrencySymbol } from './utils/formatter'
import { saveAs } from 'file-saver'

import {firestore } from "./lib/firebase";
import { doc, writeBatch } from 'firebase/firestore';
import { useCloudSync, loadLocalRows } from './hooks/use-cloud-sync';
import { applyRowsToItinerary, checklistId, groupChecked, groupExpenses, isLive, planImport, type ChecklistRow, type ExpenseRow } from './lib/sync-merge';
import PWAInstallPrompt from "./components/pwa-install-prompt/PWAInstallPrompt.tsx";
import ToggleTheme from "./components/toggle-theme/ToggleTheme.tsx";
import { useExchangeRate } from './hooks/use-exchange-rate';
import { useDayPlanNotification } from './hooks/use-dayplan-notifications';
import RoutePlanner from "./components/route-planner/RoutePlanner";
import { loadItinerary } from './utils/itinerary-storage'
import { DayBudgetEditor } from './components/day-budget-editor/DayBudgetEditor'
import { describeDayDeletion } from './utils/day-budget'
import { validateNewEntry } from './utils/checklist-input'
import { AddEntryField } from './components/add-entry-field/AddEntryField'

const fs = firestore;

const currencies: string[] = ['EUR', 'USD', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'SGD', 'HKD', 'KRW', 'TWD']

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
    const [checked, setChecked] = useState<Record<string, string[]>>({})
    const [expenses, setExpenses] = useState<Record<string, number>>({})
    const [itinerary, setItinerary] = useState(() => loadItinerary(initialItinerary))
    const [newItem, setNewItem] = useState<Record<string, string>>({})
    const [newActivity, setNewActivity] = useState<Record<string, string>>({})
    const [ntdValue, setNtdValue] = useState<string>("")
    const [selectedCurrency, setSelectedCurrency] = useState(() => localStorage.getItem('preferedCurrency') || 'EUR')
    const [baseCurrency, setBaseCurrency] = useState((localStorage.getItem('baseCurrency') || 'TWD') as string)
    // rate = nombre de baseCurrency pour 1 selectedCurrency (null = taux inconnu)
    const { rate, loading: loadingRate, message: rateMessage, refresh: fetchExchangeRate } = useExchangeRate(selectedCurrency, baseCurrency)
    const [currencyValue, setCurrencyValue] = useState<string>("")
    const itineraryRef = useRef(itinerary)
    useEffect(() => {
        itineraryRef.current = itinerary
    }, [itinerary])

    const handleCloudData = useCallback((checklistRows: ChecklistRow[], expenseRows: ExpenseRow[]) => {
        setChecked(groupChecked(checklistRows))
        setExpenses(groupExpenses(expenseRows))
        setItinerary(prev => applyRowsToItinerary(prev, checklistRows, expenseRows))
    }, [])
    const { uid, syncStatus, syncMessage, syncNow, deleteChecklistEntry, resetData, updateDayBudget, deleteDay } = useCloudSync({
        onData: handleCloudData,
        getItinerary: () => itineraryRef.current,
    })

    const restoreInitialItinerary = () => {
        const defaultItinerary = [
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
        ]
        localStorage.setItem('tripItinerary', JSON.stringify(defaultItinerary))
        if (uid) {
            db.checklist.clear()
            db.expenses.clear()
            syncInitialItineraryToFirestore(uid)
        }
        return defaultItinerary
    }

    const syncInitialItineraryToFirestore = async(uid: string) => {
        if (!uid) {
            return
        }
        try {
            const now = Date.now()
            const batch = writeBatch(fs)
            for (const day of itinerary) {
                for (const activity of day.activities) {
                    const id = btoa(encodeURIComponent(`${day.day}|${activity}`));
                    batch.set(doc(fs, `users/${uid}/checklist/${id}`), {
                        day: day.day,
                        item: activity,
                        checked: checked[day.day]?.includes(activity) || false,
                        type: 'activity',
                        updatedAt: now
                    }, { merge: true })
                }
                for (const item of day.items) {
                    const id = btoa(encodeURIComponent(`${day.day}|${item}`));
                    batch.set(doc(fs, `users/${uid}/checklist/${id}`), {
                        day: day.day,
                        item: item,
                        checked: checked[day.day]?.includes(item) || false,
                        type: 'item',
                        updatedAt: now
                    }, { merge: true })
                }
                const expenseId = btoa(encodeURIComponent(`${day.day}`));
                batch.set(doc(fs, `users/${uid}/expenses/${expenseId}`), {
                    day: day.day,
                    amount: expenses[day.day] || 0,
                    budget: day.budget,
                    updatedAt: now
                }, { merge: true })
            }
            await batch.commit()
            void syncNow()
        } catch {
            console.error('Failed to sync initial itinerary to Firestore')
        }
    }

    const totalBudget = itinerary.reduce((acc, curr) => acc + curr.budget, 0);
    const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
    const remainingBudget = totalExpenses - totalBudget;
    const convertToCurrency = (ntd: number) => rate === null ? '—' : (ntd / rate).toFixed(2);
    useDayPlanNotification(itinerary)

    useEffect(() => {
        localStorage.setItem('tripItinerary', JSON.stringify(itinerary))
    }, [itinerary]);

    useEffect(() => {
        localStorage.setItem('preferedCurrency', selectedCurrency)
        localStorage.setItem('baseCurrency', baseCurrency)
    }, [selectedCurrency, baseCurrency])

    useEffect(() => {
        // Dexie -> états UI (les lignes supprimées sont filtrées)
        loadLocalRows().then(({ checklist, expenses }) => {
            setChecked(groupChecked(checklist));
            setExpenses(groupExpenses(expenses));
        }).catch(console.error);
    }, []);

    const exportData = async () => {
        const { checklist: allChecklist, expenses: allExpenses } = await loadLocalRows();
        const checklist = allChecklist.filter(isLive);
        const expenses = allExpenses.filter(isLive);
        const blob = new Blob([JSON.stringify({checklist, expenses}, null, 2)], {type: 'application/json'});
        saveAs(blob, `trip-helper-${new Date().toISOString().split('T')[0]}.json`);
    }

    const clearData = async () => {
        const confirmClear = window.confirm("Voulez-vous vraiment effacer les données, y compris la synchronisation cloud ?")
        if (!confirmClear) {
            return
        }
        try {
            // pierres tombales locales + reset cloud mis en attente si hors ligne
            await resetData()
        } catch (error) {
            console.error('Failed to reset data', error)
        }
        setChecked({})
        setExpenses({})
    }

    const importData = async (file: File) => {
        const confirmImport = window.confirm("Importer ce fichier va remplacer toutes vos données actuelles. Continuer ?");
        if (!confirmImport) return;
        const text = await file.text();
        let data: { checklist?: unknown; expenses?: unknown };
        try {
            data = JSON.parse(text);
        } catch {
            window.alert("Fichier invalide : impossible de lire le JSON.");
            return;
        }
        // Remplacement : les lignes absentes du fichier deviennent des pierres tombales (propagées au cloud)
        const plan = planImport(await loadLocalRows(), data ?? {}, Date.now(), (day, item) =>
            itinerary.find(entry => entry.day === day)?.activities.includes(item) ? 'activity' : 'item');
        await db.checklist.bulkPut(plan.checklist);
        await db.expenses.bulkPut(plan.expenses);
        const { checklist, expenses } = await loadLocalRows();
        setChecked(groupChecked(checklist));
        setExpenses(groupExpenses(expenses));
        // jours et budgets du fichier (et jours absents du fichier retirés)
        setItinerary(prev => applyRowsToItinerary(prev, checklist, expenses));
        void syncNow();
    };

    const toggleItem = async (day: string, item: string) => {
        const isChecked = checked[day]?.includes(item);
        const id = btoa(encodeURIComponent(`${day}|${item}`))
        let type: 'activity' | 'item' = 'item'
        const dayEntry = itinerary.find(entry => entry.day === day);
        if (dayEntry && dayEntry.activities.includes(item)) {
            type = 'activity'
        }
        await db.checklist.put({ id, day, item, checked: !isChecked, type, updatedAt: Date.now()})
        setChecked(prev => {
            const dayChecked = prev[day] || [];
            return {
                ...prev, [day]: isChecked ? dayChecked.filter(i => i!== item) : [...dayChecked, item]
            }
        })
    }

    const handleExpenseChange = async (day: string, val: number) => {
        const amount = +val || 0;
        const id = btoa(encodeURIComponent(`${day}`))
        // on conserve le budget de la ligne (ou, à défaut, celui de la carte)
        const existing = await db.expenses.get(id)
        const budget = existing && existing.deleted !== true ? existing.budget : undefined
        await db.expenses.put({id, day, amount, budget: budget ?? itineraryRef.current.find(e => e.day === day)?.budget, updatedAt: Date.now() })
        setExpenses(prev => ({...prev, [day]: amount }))
    }

    const handleBudgetChange = async (day: string, budget: number) => {
        setItinerary(prev => prev.map(entry => entry.day === day ? { ...entry, budget } : entry))
        await updateDayBudget(day, budget)
    }

    const handleDeleteDay = async (day: string) => {
        const entry = itinerary.find(e => e.day === day)
        if (!entry) return
        const confirmDelete = window.confirm(describeDayDeletion(formatDayLabel(day), entry.activities.length, entry.items.length, expenses[day] || 0, baseCurrency))
        if (!confirmDelete) return
        setItinerary(prev => prev.filter(e => e.day !== day))
        setChecked(prev => Object.fromEntries(Object.entries(prev).filter(([d]) => d !== day)))
        setExpenses(prev => Object.fromEntries(Object.entries(prev).filter(([d]) => d !== day)))
        setNewActivity(prev => Object.fromEntries(Object.entries(prev).filter(([d]) => d !== day)))
        setNewItem(prev => Object.fromEntries(Object.entries(prev).filter(([d]) => d !== day)))
        await deleteDay(day)
    }

    const addEntry = (day: string, raw: string, type: 'activity' | 'item'): string | null => {
        const entry = itinerary.find(e => e.day === day)
        const own = (type === 'activity' ? entry?.activities : entry?.items) ?? []
        const other = (type === 'activity' ? entry?.items : entry?.activities) ?? []
        const sameList = type === 'activity' ? 'Cette activité existe déjà ce jour-là.' : 'Cet objet est déjà dans la liste de ce jour.'
        const otherList = type === 'activity' ? 'Un objet à emporter porte déjà ce nom ce jour-là.' : 'Une activité porte déjà ce nom ce jour-là.'
        const result = validateNewEntry(raw, own)
        if (!result.ok) return result.error === 'empty' ? 'Saisissez un texte avant d\'ajouter.' : sameList
        if (!validateNewEntry(raw, other).ok) return otherList
        const value = result.value
        setItinerary(prev => prev.map(e => e.day === day ? (type === 'activity' ? {...e, activities: [...e.activities, value]} : {...e, items: [...e.items, value]}) : e))
        if (type === 'activity') setNewActivity(prev => ({...prev, [day]: '' }))
        else setNewItem(prev => ({...prev, [day]: '' }))
        void db.checklist.put({ id: checklistId(day, value), day, item: value, checked: false, type, updatedAt: Date.now() })
        return null
    }

    const handleDeleteActivity = async (day: string, index: number) => {
        const activityToDelete = itinerary.find(entry => entry.day === day)?.activities[index];
        if (!activityToDelete) {
            return
        }
        setItinerary(prev => prev.map(entry => entry.day === day? {...entry, activities: entry.activities.filter((_, i) => i!== index) } : entry))
        // pierre tombale locale, propagée au cloud dès que la synchro est possible
        await deleteChecklistEntry(day, activityToDelete, 'activity');
    }

    const handleDeleteItem =  async (day: string, item: string | number, idx: number) => {
        setItinerary(prev => prev.map(entry => entry.day === day? {...entry, items: entry.items.filter((_, i) => i!== idx && item!== i) } : entry))
        await deleteChecklistEntry(day, String(item), 'item');
    }

return (
      <div className="mx-auto px-4 py-6 space-y-6 dark:bg-black dark:text-white">
          <h1 className="text-2xl font-bold mb-2 text-center dark:text-white">📅 Planificateur de voyage</h1>
          <ToggleTheme />

          {/* days selector */}
          <Card>
              <CardContent className="space-y-3">
                  <h2 className="text-lg font-semibold ">🗓️ Créer plusieurs jours d'affilée</h2>
                  <DateRangeCreator onCreate={(days) => setItinerary(prev => [...prev, ...days])} currencyCode={baseCurrency} />
              </CardContent>
          </Card>

          {/* maj cloud */}
          <Card>
              <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">Cloud sync (Firebase) — {uid ? <span className="text-green-600">connecté</span> : <span className="text-gray-500">connexion…</span>}</div>
                  <div className="flex gap-2">
                      <button onClick={syncNow} disabled={!uid || syncStatus === 'syncing'}>{syncStatus === "syncing" ? "🔄 Synchronisation…" : syncStatus === "ok" ? "✅ Sync OK" : syncStatus === "error" ? "⚠️ Erreur" : "🔁 Synchroniser maintenant"}</button>
                  </div>
                  {syncMessage && <p role="status" aria-live="polite" className="text-xs text-gray-600 dark:text-gray-300">{syncMessage}</p>}
                  <div>
                      <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
                      <Button onClick={exportData}>📤 Exporter</Button>
                      <Button onClick={clearData}>🗑 Reset</Button>
                      {import.meta.env.DEV && (<Button onClick={() => {
                          const confirmRestore = window.confirm('Voulez-vous restaurer votre itinéraire?')
                          if (confirmRestore) {
                              setItinerary(restoreInitialItinerary())
                          }
                      }}>🔄 Restaurer itinéraire</Button>)}
                  </div>
              </CardContent>
          </Card>
          {/* convertisseur de devises */}
          <Card>
              <CardContent className="space-y-4">
                  <h2 className="text-lg font-semibold">💱 Convertisseur de devises</h2>
                  <div className="flex items-center gap-2">
                      <label className="text-sm">Devise depuis : </label>
                      <select className="border rounded px-2 py-1 text-sm" value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value)}>
                          {
                              currencies.map(currency => (
                                  <option key={currency} value={currency}>{currency}</option>
                              ))
                          }
                      </select>
                      <div className="flex items-center gap-2">
                          <label className="text-sm">vers : </label>
                          <select className="border rounded px-2 py-1 text-sm" value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)}>
                              {
                              currencies.map(currency => (
                                  <option key={currency} value={currency}>{currency}</option>
                              ))
                              }
                          </select>
                          <Button onClick={fetchExchangeRate} isDisabled={loadingRate} aria-busy={loadingRate} aria-label="Actualiser le taux de change">{loadingRate ? '...' : "🔁"}</Button>
                      </div>
                  </div>
                  <p role="status" aria-live="polite" className="text-xs text-gray-600 dark:text-gray-300">{rateMessage}</p>
                  <div>
                      <p className="text-xs text-gray-500">1 {selectedCurrency} ≈ {rate === null ? '—' : rate.toFixed(4)} {baseCurrency}</p>
                      <div className="flex gap-2">
                          <Input type="number" placeholder={`Montant en ${selectedCurrency}`} value={currencyValue} onChange={e => setCurrencyValue(e.target.value)} />
                      </div>
                      {currencyValue && <p className="text-sm mt-1">≈ {rate === null ? '—' : (parseFloat(currencyValue) * rate).toFixed(2)} {baseCurrency}</p>}
                  </div>

                  <div>
                      <p className="text-xs text-gray-500">1 {baseCurrency} ≈ {rate === null ? '—' : (1 / rate).toFixed(4)} {selectedCurrency}</p>
                      <div className="flex gap-2">
                          <Input type="number" placeholder={`Montant en ${baseCurrency}`} value={ntdValue} onChange={e => setNtdValue(e.target.value)} />
                      </div>
                      {ntdValue && <p className="text-sm mt-1">≈ {rate === null ? '—' : (parseFloat(ntdValue) / rate).toFixed(2)} {selectedCurrency}</p>}
                  </div>
              </CardContent>
          </Card>

          <RoutePlanner plans={itinerary.map(({ day, activities }) => ({ day, activities }))} />

          {/* itinerary */}
          {itinerary.map(({ day, activities, items, budget }) => (
              <Card key={day}>
                  <CardContent className="space-y-4">
                      <h2 className="text-lg font-semibold">{formatDayLabel(day)}</h2>
                      <div>
                          <p className="text-sm font-medium">Activités :</p>
                          <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-500">
                              {activities.map((activity, idx) => (
                                  <li key={idx} className="flex items-center justify-between"><span>{activity}</span>
                                      <Button onClick={() => handleDeleteActivity(day, idx)}>❌</Button>
                                  </li>
                              ))}
                          </ul>
                          <AddEntryField placeholder="Nouvelle activité" addLabel="Ajouter une activité" value={newActivity[day] || ""} onChange={v => setNewActivity(prev => ({ ...prev, [day]: v }))} onSubmit={raw => addEntry(day, raw, 'activity')} />
                      </div>
                      <div>
                          <p className="font-medium text-sm">À emporter :</p>
                          <ul className="space-y-1">
                              {items.map((item, index) => (
                                  <li key={index} className={`flex items-center justify-between px-3 py-1 rounded-lg border text-sm ${checked[day]?.includes(item) ? "bg-green-100 line-through text-gray-500" : "bg-white dark:bg-black"}`}><span>{item}</span>
                                      <div className="flex gap-2">
                                          <Button onClick={() => toggleItem(day, item)}>
                                              {checked[day]?.includes(item) ? "✔️" : "🧳"}
                                          </Button>
                                          <Button onClick={() => handleDeleteItem(day, item, index)}>❌</Button>
                                      </div>
                                  </li>
                              ))}
                          </ul>
                          <AddEntryField placeholder="Nouvel objet à emporter" addLabel="Ajouter un objet" value={newItem[day] || ""} onChange={v => setNewItem(prev => ({ ...prev, [day]: v }))} onSubmit={raw => addEntry(day, raw, 'item')} />
                      </div>

                      <div className="space-y-1">
                          <DayBudgetEditor budget={budget} currencyCode={baseCurrency} onCommit={value => handleBudgetChange(day, value)} />
                          <p className="text-sm text-gray-500 dark:text-gray-400">Budget : <strong>{formatCurrencySymbol(+budget, baseCurrency, navigator.language)}</strong> (~{convertToCurrency(budget)} {selectedCurrency})</p>
                          <label>Dépenses ({baseCurrency})</label>
                          <input type="number" value={expenses[day] || ""} onChange={e => handleExpenseChange(day, +e.target.value)} />
                          <p className="text-xs text-gray-600">
                              {expenses[day] !== undefined && `Écart : ${expenses[day] - budget} ${baseCurrency} (${convertToCurrency(expenses[day] - budget)} ${selectedCurrency}) ${expenses[day] > budget ? '🚨' : '✅'}`}
                          </p>

                      </div>
                      <Button
                          onClick={() => handleDeleteDay(day)}
                          aria-label={`Supprimer le jour ${formatDayLabel(day)}`}
                          className="min-h-11 rounded border border-red-700 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
                      >Supprimer ce jour</Button>
                  </CardContent>
              </Card>
          ))}

          <Card>
              <CardContent className="space-y-2">
                  <h2 className="text-lg font-semibold text-center">📊 Récapitulatif Global</h2>
                  <p className="text-sm">Budget total : <strong>{formatCurrencySymbol(+totalBudget, baseCurrency, navigator.language)} </strong> (~{convertToCurrency(totalBudget)} {selectedCurrency})</p>
                  <p className="text-sm">Dépenses totales : <strong>{formatCurrencySymbol(totalExpenses, baseCurrency, navigator.language)}</strong> (~{convertToCurrency(totalExpenses)} {selectedCurrency})</p>
                  <p className="text-sm">Écart global : <strong>{formatCurrencySymbol(+remainingBudget, baseCurrency, navigator.language)}</strong> ({convertToCurrency(remainingBudget)} {selectedCurrency}) {remainingBudget > 0 ? "🚨 Dépassement" : remainingBudget < 0 ? "✅ Économie" : "👌 Parfaitement calé"}</p>
              </CardContent>
          </Card>
          <PWAInstallPrompt />
      </div>
  )
}

export default App
