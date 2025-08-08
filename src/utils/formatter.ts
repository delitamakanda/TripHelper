export function formatDayLabel(day: string): string {
    try {
        const d = new Date(day);
        const fmt = new Intl.DateTimeFormat('fr-FR', {
            weekday: 'short',
            month: '2-digit',
            day: '2-digit'
        })
        return fmt.format(d);
    } catch {
        return day;
    }
}

