import { useRef, useEffect } from "react";
import { requestNotificationPermission, sendNotification } from "../utils/notifications.ts";
import { DateTime } from 'luxon'

type DayPlan = {
    day: string;
    activities?: string[];
}

const MAX_TIMEOUT = 5 * 60 * 1000; // 5 minutes

function format8hDateLocale(isoDay: string): Date {
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    const asiaPacificZone = DateTime.fromISO(isoDay, {
        zone: 'Asia/Taipei'
    }).set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
    const inLocal =asiaPacificZone.setZone(localZone)
    return inLocal.toJSDate();
}

function formatBody(activities: string[]): string {
    if (!activities || activities.length === 0) {
        return "No activities scheduled.";
    }
    const top = activities.slice(0, 3).join(", ");
    return `${top}${activities.length > 3? "..." : ""}`;
}

export function useDayPlanNotification(day: DayPlan[]) {
    const timeoutRef = useRef<number[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function setup() {
            const ok = await requestNotificationPermission();
            if (!ok || cancelled) {
                return;
            }

            timeoutRef.current.forEach(clearTimeout);
            timeoutRef.current = []
            const now = new Date();
            for (const plan of day) {
                if (!plan?.day) {
                    continue;
                }
                const at8h = format8hDateLocale(plan.day);
                const sentKey = `plan_${plan.day}`;
                const alreadySent = localStorage.getItem(sentKey) === '1';
                if (at8h.getTime() > now.getTime()) {
                    const delay = at8h.getTime() - now.getTime();
                    if (delay <= MAX_TIMEOUT) {
                        const id = window.setTimeout(() => {
                            sendNotification('🗓️ Itinéraire du jour', {
                                body: formatBody(plan.activities!),
                                icon: "/pwa-192x192.png",
                                tag: `triphelper_${plan.day}`,
                                requireInteraction: true,
                                silent: false,
                                data: { plan },
                            })
                            localStorage.setItem(sentKey, '1');
                        }, delay)
                        timeoutRef.current.push(id);
                    }
                    continue;
                }
                const nowInTaipei = DateTime.now().setZone('Asia/Taipei');
                const dayInTaipei = DateTime.fromISO(plan.day, { zone: 'Asia/Taipei' });
                const isSameDayInTaipei = nowInTaipei.hasSame(dayInTaipei, "day");
                const taipeiNoon = dayInTaipei.set({
                    hour: 12,
                    minute: 0,
                    second: 0,
                    millisecond: 0,
                })
                if (isSameDayInTaipei && nowInTaipei < taipeiNoon && !alreadySent) {
                    sendNotification('🗓️ Itinéraire du jour',{
                        body: formatBody(plan.activities!),
                        icon: "/pwa-192x192.png",
                        tag: `triphelper_${plan.day}`,
                        requireInteraction: true,
                        silent: false,
                        data: { plan },
                    } )
                    localStorage.setItem(sentKey, '1');
                }
            }
        }
        setup();
        return () => {
            cancelled = true;
            timeoutRef.current.forEach(clearTimeout);
            timeoutRef.current = [];
        };
    }, [JSON.stringify(day)]);

    return {
        isNotificationSet:!!timeoutRef.current,
    };
}