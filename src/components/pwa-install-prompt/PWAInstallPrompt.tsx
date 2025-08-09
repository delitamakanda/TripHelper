import { useState , useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallPrompt() {
    const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
    const [isSupported, setIsSupported] = useState(false);

    useEffect(() => {
        if (window.matchMedia("(display-mode: standalone)").matches) {
            setIsSupported(true);
            return
        }
        const handleBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setPromptEvent(event as BeforeInstallPromptEvent);
        };
        window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

        window.addEventListener("appinstalled", () => {
            setIsSupported(true);
            setPromptEvent(null);
        })
        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstall = async () => {
        if (!promptEvent) {
            return
        }
        await promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult.outcome === "accepted") {
            console.log("User accepted the install prompt");
        } else {
            console.log("User dismissed the install prompt");
        }
        setPromptEvent(null);
    };

    if (isSupported || !promptEvent) {
        return null;
    }

    return (
        <div>
            <button onClick={handleInstall}>Install this app</button>
        </div>
    );
}