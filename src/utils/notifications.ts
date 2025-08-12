export async function requestNotificationPermission() : Promise<boolean>{
    if (!('Notification' in window)) {
        console.error('This browser does not support notifications.');
        return false;
    }

    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
        return true;
    } else if (permission === 'denied') {
        console.error('User denied notification permission.');
        return false;
    }

    return false;
}

export async function sendNotification(title: string, options?: NotificationOptions) : Promise<void>{
    if (!('Notification' in window)) {
        console.error('This browser does not support notifications.');
        return;
    }
    if (Notification.permission !== 'granted') {
        console.error('User denied notification permission.');
        return;
    }

    new Notification(title, options);
}