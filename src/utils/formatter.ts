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

const currencyFormatters: Record<string, Intl.NumberFormat> = {};

export function formatCurrencySymbol(amount: number, currencyCode=  'TWD',  lang = 'fr-FR'): string {
    try {
        if (!Number.isFinite(amount)) {
            return `${amount} ${currencyCode}`;
        }
        const formatterKey = `${currencyCode}|${lang}`;
        if (!currencyFormatters[formatterKey]) {
            currencyFormatters[formatterKey] = new Intl.NumberFormat(lang, {
                style: 'currency',
                currency: currencyCode
            });
        }
        return currencyFormatters[formatterKey].format(amount);
    } catch(error) {
        if (error instanceof RangeError) {
            console.warn(`Invalid currency code or language: ${currencyCode} / ${lang}`);
        } else {
            console.error('Error formatting currency:', error);
        }
        return `${amount.toLocaleString(lang)} ${currencyCode}`;
    }
}
