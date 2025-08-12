import {useRef, useState,  useEffect} from 'react'
import { db } from './db'
import { Button, Input } from 'react-aria-components'
import { DateRangeCreator} from "./components/date-range-creator/date-range-creator.tsx";
import { Card, CardContent } from './components/card/Card'
import './App.css'
import { formatDayLabel } from './utils/formatter'
import { saveAs } from 'file-saver'

import {firestore, auth } from "./lib/firebase";
import { doc, setDoc, writeBatch, getDocs, collection, onSnapshot } from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import PWAInstallPrompt from "./components/pwa-install-prompt/PWAInstallPrompt.tsx";
import ToggleTheme from "./components/toggle-theme/ToggleTheme.tsx";

const fs = firestore;

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
    const [itinerary, setItinerary] = useState(initialItinerary)
    const [newItem, setNewItem] = useState<Record<string, string>>({})
    const [newActivity, setNewActivity] = useState<Record<string, string>>({})
    const [ntdValue, setNtdValue] = useState<string>("")
    const [exchangeRate, setExchangeRate] = useState<number>(0.0256)
    const [loadingRate, setLoadingRate] = useState<boolean>(false)
    const [selectedCurrency, setSelectedCurrency] = useState(() => localStorage.getItem('preferedCurrency') || 'EUR')
    const [currencyValue, setCurrencyValue] = useState<string>("")
    const [uid, setUid] = useState<string | null>(null)
    const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "ok" | "error">("idle")
    const unsubRefs = useRef<Array<() => void>>([])
    const syncIntervalRef = useRef<number | null>(null)

    const isSynching = useRef(false)

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
            setSyncStatus("syncing")
            const batch = writeBatch(fs)
            for (const day of itinerary) {
                for (const activity of day.activities) {
                    const id = btoa(encodeURIComponent(`${day.day}|${activity}`));
                    batch.set(doc(fs, `users/${uid}/checklist/${id}`), {
                        day: day.day,
                        item: activity,
                        checked: checked[day.day]?.includes(activity) || false,
                        type: 'activity',
                        updatedAt: new Date()
                    }, { merge: true })
                }
                for (const item of day.items) {
                    const id = btoa(encodeURIComponent(`${day.day}|${item}`));
                    batch.set(doc(fs, `users/${uid}/checklist/${id}`), {
                        day: day.day,
                        item: item,
                        checked: checked[day.day]?.includes(item) || false,
                        type: 'item',
                        updatedAt: new Date()
                    }, { merge: true })
                }
                const expenseId = btoa(encodeURIComponent(`${day.day}`));
                batch.set(doc(fs, `users/${uid}/expenses/${expenseId}`), {
                    day: day.day,
                    amount: expenses[day.day] || 0,
                    updatedAt: new Date()
                }, { merge: true })
            }
            await batch.commit()
            setSyncStatus("ok")
            setTimeout(() => setSyncStatus("idle"), 1200)
        } catch {
            console.error('Failed to sync initial itinerary to Firestore')
            setSyncStatus("error")
        }
    }

    const fetchExchangeRate = () => {
        setLoadingRate(true)
        const options = {method: 'GET', headers: {accept: 'application/json'}};

        fetch(`https://api.fastforex.io/fetch-multi?from=${selectedCurrency}&to=TWD&api_key=${import.meta.env.VITE_FASTFOREX_API_KEY}`, options)
            .then(response => response.json())
            .then(data => {
                if (data?.results?.TWD) {
                    setExchangeRate(1 / data.results.TWD)
                }
            })
            .catch(() => {
                console.error('Failed to fetch exchange rate')
            })
            .finally(() => setLoadingRate(false))
    }

    const totalBudget = itinerary.reduce((acc, curr) => acc + curr.budget, 0);
    const totalExpenses = Object.values(expenses).reduce((a, b) => a + b, 0);
    const remainingBudget = totalExpenses - totalBudget;
    const convertToCurrency = (ntd: number) => (ntd * exchangeRate).toFixed(2);

    useEffect(() => {
        localStorage.setItem('tripItinerary', JSON.stringify(itinerary))
    }, [itinerary]);

    useEffect(() => {
        // fetchExchangeRate();
        localStorage.setItem('preferedCurrency', selectedCurrency)
    }, [selectedCurrency])

    useEffect(() => {
        (async () => {
            // Auth anonyme Firebase
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    setUid(user.uid);
                    attachRealtimeListeners(user.uid);
                } else {
                    await signInAnonymously(auth).catch(console.error);
                }
            });

            // Dexie -> états UI
            const checklistData = await db.checklist.toArray();
            const groupedChecklist = checklistData.reduce((acc, curr) => {
                acc[curr.day] = acc[curr.day] || [];
                if (curr.checked) acc[curr.day].push(curr.item);
                return acc;
            }, {} as Record<string, string[]>);
            setChecked(groupedChecklist);

            const expensesData = await db.expenses.toArray();
            const groupedExpenses = expensesData.reduce((acc, curr) => {
                acc[curr.day] = curr.amount;
                return acc;
            }, {} as Record<string, number>);
            setExpenses(groupedExpenses);
        })();

        return () => {
            unsubRefs.current.forEach(off => off());
            if (syncIntervalRef.current) window.clearInterval(syncIntervalRef.current);
        };


    }, []);

    function attachRealtimeListeners(uid: string) {
        unsubRefs.current.forEach(off => off());
        unsubRefs.current = []
        const checklistCol = collection(fs, `users/${uid}/checklist`);
        const expensesCol = collection(fs, `users/${uid}/expenses`);

        const off1 = onSnapshot(checklistCol, async (snapshot) => {
            const rows: any = []
            snapshot.forEach(docu => {
                const d = docu.data();
                rows.push({id: docu.id, day: d.day, item: d.item, checked: d.checked, type: d.type, updatedAt: d.updateAt ?? 0})
            })
            await db.checklist.clear()
            await db.checklist.bulkPut(rows)
            const groupedChecklist = rows.reduce((acc: any, curr: any) => {
                acc[curr.day] = acc[curr.day] || [];
                if (curr.checked) acc[curr.day].push(curr.item);
                return acc;
            }, {} as Record<string, string[]>);
            setChecked(groupedChecklist);
        })

        const off2 = onSnapshot(expensesCol, async (snapshot) => {
            const rows: any = []
            snapshot.forEach(docu => {
                const d = docu.data();
                rows.push({id: docu.id, day: d.day, amount: d.amount, updatedAt: d.updatedAt?? 0})
            })
            await db.expenses.clear()
            await db.expenses.bulkPut(rows)
            const groupedExpenses = rows.reduce((acc: any, curr: any) => {
                acc[curr.day] = curr.amount;
                return acc;
            }, {} as Record<string, number>);
            setExpenses(groupedExpenses);
        })
        unsubRefs.current.push(off1, off2);
    }

    const pushToCloud = async (uid: string) => {
        const checklist = await db.checklist.toArray();
        const expensesRows = await db.expenses.toArray();
        for (const row of checklist) {
            if (!row.item || row.item.trim() === '') {
                continue
            }
            const id = row.id ?? btoa(encodeURIComponent(`${row.day}|${row.item}`))
            let itemType = row.type
            if (!itemType) {
                const dayEntry = itinerary.find(entry => entry.day === row.day);
                if(dayEntry) {
                    itemType = dayEntry.activities.includes(row.item)? 'activity' : 'item';
                } else {
                    itemType = 'item';
                }
            }
            await setDoc(doc(fs, `users/${uid}/checklist/${id}`), {
                day: row.day,
                item: row.item,
                checked: row.checked,
                type: itemType,
                updatedAt: Date.now() || row.updatedAt,
            }, {merge: true})
        }
        for (const row of expensesRows) {
            const id = row.id ?? btoa(encodeURIComponent(`${row.day}`))
            await setDoc(doc(fs, `users/${uid}/expenses/${id}`), {
                day: row.day,
                amount: row.amount,
                updatedAt: Date.now() || row.updatedAt,
            }, {merge: true})
        }
    }

    const syncCloud = async (uid: string) => {
        const snapCheckList = await getDocs(collection(fs, `users/${uid}/checklist`))
        const clRows: any[] = []
        snapCheckList.forEach(doc => {
            const d = doc.data();
            if (d.item && d.item.trim() !== '') {
                clRows.push({ id: doc.id,...doc.data()})
            }
        })
        await db.checklist.clear()
        await db.checklist.bulkPut(clRows)

        const snapExpenses = await getDocs(collection(fs, `users/${uid}/expenses`))
        const expRows: any[] = []
        snapExpenses.forEach(doc => {
            expRows.push({id: doc.id, ...doc.data()})
        })
        await db.expenses.clear()
        await db.expenses.bulkPut(expRows)

        const groupedChecklist = clRows.reduce((acc: any, curr: any) => {
            acc[curr.day] = acc[curr.day] || [];
            if (curr.checked) acc[curr.day].push(curr.item);
            return acc;
        }, {} as Record<string, string[]>);
        setChecked(groupedChecklist);

        const groupedExpenses = expRows.reduce((acc: any, curr: any) => {
            acc[curr.day] = curr.amount;
            return acc;
        }, {} as Record<string, number>);
        setExpenses(groupedExpenses);

        // update itinerary with activities and items
        setItinerary(prev => {
            const updatedItinerary = [...prev]

            const itemsByDayAndType: Record<string, { activities: string[], items: string[] }> = {}

            if (expRows.length
             > 0) {
                expRows.forEach(row => {
                    const { day } = row
                    if (!itemsByDayAndType[day]) itemsByDayAndType[day] = { activities: [], items: [] }
                })
            }

            clRows.forEach(row => {
                const { day, item, type } = row

                if (!item || item.trim() === '') return

                if (!itemsByDayAndType[day]) itemsByDayAndType[day] = { activities: [], items: [] }

                if (type === 'activity') {
                    if (!itemsByDayAndType[day].activities.includes(item)) {
                        itemsByDayAndType[day].activities.push(item)
                    }
                } else if (type === 'item') {
                    if (!itemsByDayAndType[day].items.includes(item)) {
                        itemsByDayAndType[day].items.push(item)
                    }
                } else {
                    console.warn('Unknown item type:', type)
                }
            })
            const existingDays = updatedItinerary.map(entry => entry.day)
            Object.keys(itemsByDayAndType).forEach(day => {
                if (!existingDays.includes(day)) {
                    updatedItinerary.push({
                        day,
                        activities: itemsByDayAndType[day].activities,
                        items: itemsByDayAndType[day].items,
                        budget: 3500,
                    })
                }
            })
            updatedItinerary.sort((a, b) => a.day.localeCompare(b.day))

            return updatedItinerary.map(entry => {
                const dayItems = itemsByDayAndType[entry.day]
                if (!dayItems) {
                    return entry
                }
                return {...entry, activities: dayItems.activities.length > 0 ? dayItems.activities : entry.activities, items: dayItems.items.length > 0? dayItems.items : entry.items}
            })
        })
    }

    const syncNow = async () => {
        if (!uid || isSynching.current) return
        isSynching.current = true
        try {
            setSyncStatus("syncing")
            await pushToCloud(uid)
            await syncCloud(uid)
            setSyncStatus("ok")
            setTimeout(() => setSyncStatus("idle"), 1200)
        } catch (error) {
            console.error('Failed to sync cloud', error)
            setSyncStatus("error")
        }
        isSynching.current = false
    }

    useEffect(() => {
        if (!uid) return
        syncNow()
        if (syncIntervalRef.current) {
            window.clearInterval(syncIntervalRef.current)
        }
        syncIntervalRef.current = window.setInterval(() => syncNow(), 300000) // 5 minutes

        const onFocus = () => syncNow()
        const onVisible = () => {
            if (document.visibilityState === 'visible') syncNow()
        }
        window.addEventListener('focus', onFocus)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            window.removeEventListener('focus', onFocus)
            document.removeEventListener('visibilitychange', onVisible)
            if (syncIntervalRef.current) window.clearInterval(syncIntervalRef.current)
        }
    }, [uid]);

    const exportData = async () => {
        const checklist = await db.checklist.toArray();
        const expenses = await db.expenses.toArray();
        const blob = new Blob([JSON.stringify({checklist, expenses}, null, 2)], {type: 'application/json'});
        saveAs(blob, `trip-helper-${new Date().toISOString().split('T')[0]}.json`);
    }

    const clearData = async () => {
        const confirmClear = window.confirm("Voulez-vous vraiment effacer les données?")
        if (!confirmClear) {
            return
        }
        await db.checklist.clear()
        await db.expenses.clear()
        setChecked({})
        setExpenses({})
    }

    const importData = async (file: File) => {
        const confirmImport = window.confirm("Importer ce fichier va remplacer toutes vos données actuelles. Continuer ?");
        if (!confirmImport) return;
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.checklist) {
            const rows = data.checklist.map((item: any) => {
                if (!item.type) {
                    const dayEntry = itinerary.find(entry => entry.day === item.day);
                    let type = 'item'
                    if (dayEntry && dayEntry.activities.includes(item.item)) {
                        type = 'activity'
                    }
                    return {id: item.id ?? btoa(encodeURIComponent(`${item.day}|${item.item}`)), ...item, type };
                }
                return { id: item.id?? btoa(encodeURIComponent(`${item.day}|${item.item}`)),...item };
            });
            await db.checklist.clear();
            await db.checklist.bulkPut(rows);
        }
        if (data.expenses) {
            const rows = data.expenses.map((item: any) => ({ id: item.id ?? btoa(encodeURIComponent(item.day)),...item }));
            await db.expenses.clear();
            await db.expenses.bulkPut(rows);
        }
        const groupedChecklist = (data.checklist || []).reduce((acc: any, curr: any) => {
            acc[curr.day] = acc[curr.day] || [];
            if (curr.checked) acc[curr.day].push(curr.item);
            return acc;
        }, {} as Record<string, string[]>);
        setChecked(groupedChecklist);
        const groupedExpenses = (data.expenses || []).reduce((acc: any, curr: any) => { acc[curr.day] = curr.amount; return acc; }, {} as Record<string, number>);
        setExpenses(groupedExpenses);
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
        await db.expenses.put({id, day, amount, updatedAt: Date.now() })
        setExpenses(prev => ({...prev, [day]: amount }))
    }

    const handleAddActivity = async (day: string) => {
        if (!newActivity[day]) return;
        setItinerary(prev => prev.map(entry => entry.day === day? {...entry, activities: [...entry.activities, newActivity[day]] } : entry))
        const id = btoa(encodeURIComponent(`${day}|${newActivity[day]}`))
        await db.checklist.put({ id, day, item: newActivity[day], checked: false, type: 'activity', updatedAt: Date.now() })
        setNewActivity(prev => ({...prev, [day]: '' }));
    }

    const handleDeleteActivity = async (day: string, index: number) => {
        const activityToDelete = itinerary.find(entry => entry.day === day)?.activities[index];
        if (!activityToDelete) {
            return
        }
        setItinerary(prev => prev.map(entry => entry.day === day? {...entry, activities: entry.activities.filter((_, i) => i!== index) } : entry))
        const id = btoa(encodeURIComponent(`${day}|${activityToDelete}`))
        await db.checklist.delete(id);
    }

    const handleAddItem =  async (day: string) => {
        if (!newItem[day]) return;
        setItinerary(prev => prev.map(entry => entry.day === day? {...entry, items: [...entry.items, newItem[day]] } : entry))
        setNewItem(prev => ({...prev, [day]: '' }));
        const id = btoa(encodeURIComponent(`${day}|${newItem[day]}`))
        await db.checklist.put({ id, day, item: newItem[day], checked: false, type: 'item', updatedAt: Date.now() })
    }

    const handleDeleteItem =  async (day: string, item: string | number, idx: number) => {
        setItinerary(prev => prev.map(entry => entry.day === day? {...entry, items: entry.items.filter((_, i) => i!== idx && item!== i) } : entry))
        const id = btoa(encodeURIComponent(`${day}|${item}`))
        await db.checklist.delete(id);

    }

return (
      <div className="mx-auto px-4 py-6 space-y-6 dark:bg-black dark:text-white">
          <h1 className="text-2xl font-bold mb-2 text-center dark:text-white">📅 Planificateur de voyage</h1>
          <ToggleTheme />

          {/* days selector */}
          <Card>
              <CardContent className="space-y-3">
                  <h2 className="text-lg font-semibold ">🗓️ Créer plusieurs jours d'affilée</h2>
                  <DateRangeCreator onCreate={(days) => setItinerary(prev => [...prev, ...days])} />
              </CardContent>
          </Card>

          {/* maj cloud */}
          <Card>
              <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">Cloud sync (Firebase) — {uid ? <span className="text-green-600">connecté</span> : <span className="text-gray-500">connexion…</span>}</div>
                  <div className="flex gap-2">
                      <button onClick={syncNow} disabled={!uid || syncStatus === 'syncing'}>{syncStatus === "syncing" ? "🔄 Synchronisation…" : syncStatus === "ok" ? "✅ Sync OK" : syncStatus === "error" ? "⚠️ Erreur" : "🔁 Synchroniser maintenant"}</button>
                  </div>
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
                      <label className="text-sm">Devise : </label>
                      <select className="border rounded px-2 py-1 text-sm" value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value)}>
                          {
                              ['EUR', 'USD', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'SGD', 'HKD', 'KRW'].map(currency => (
                                  <option key={currency} value={currency}>{currency}</option>
                              ))
                          }
                      </select>
                      <Button onClick={fetchExchangeRate}>{loadingRate ? '...' : "🔁"}</Button>
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
                          <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-500">
                              {activities.map((activity, idx) => (
                                  <li key={idx} className="flex items-center justify-between"><span>{activity}</span>
                                      <Button onClick={() => handleDeleteActivity(day, idx)}>❌</Button>
                                  </li>
                              ))}
                          </ul>
                          <div className="flex gap-2 mt-2">
                              <Input placeholder="Nouvelle activité" value={newActivity[day] || ""} onChange={e => setNewActivity(prev => ({ ...prev, [day]: e.target.value }))} />
                              <Button onClick={() => handleAddActivity(day)}>➕</Button>
                          </div>
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
                          <div className="flex gap-2 mt-2">
                              <Input placeholder="Nouvel objet à emporter" value={newItem[day] || ""} onChange={e => setNewItem(prev => ({ ...prev, [day]: e.target.value }))} />
                              <Button onClick={() => handleAddItem(day)}>➕</Button>
                          </div>
                      </div>

                      <div className="space-y-1">
                          <p className="text-sm text-gray-500 mt-2">💰 Budget : <strong>{budget.toLocaleString()} NT$</strong> (~{convertToCurrency(budget)} {selectedCurrency})</p>
                          <label>Dépenses (NT$)</label>
                          <input type="number" value={expenses[day] || ""} onChange={e => handleExpenseChange(day, +e.target.value)} />
                          <p className="text-xs text-gray-600">
                              {expenses[day] !== undefined && `Écart : ${expenses[day] - budget} NT$ (${convertToCurrency(expenses[day] - budget)} ${selectedCurrency}) ${expenses[day] > budget ? '🚨' : '✅'}`}
                          </p>

                      </div>
                  </CardContent>
              </Card>
          ))}

          <Card>
              <CardContent className="space-y-2">
                  <h2 className="text-lg font-semibold text-center">📊 Récapitulatif Global</h2>
                  <p className="text-sm">Budget total : <strong>{totalBudget.toLocaleString()} NT$</strong> (~{convertToCurrency(totalBudget)} {selectedCurrency})</p>
                  <p className="text-sm">Dépenses totales : <strong>{totalExpenses.toLocaleString()} NT$</strong> (~{convertToCurrency(totalExpenses)} {selectedCurrency})</p>
                  <p className="text-sm">Écart global : <strong>{remainingBudget} NT$</strong> ({convertToCurrency(remainingBudget)} {selectedCurrency}) {remainingBudget > 0 ? "🚨 Dépassement" : remainingBudget < 0 ? "✅ Économie" : "👌 Parfaitement calé"}</p>
              </CardContent>
          </Card>
          <PWAInstallPrompt />
      </div>
  )
}

export default App
