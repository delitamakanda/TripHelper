import { useState , useEffect } from "react";
import {Button} from "react-aria-components";
import {Download03} from "@untitledui/icons/Download03";

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
        <div className="flex flex-1 justify-around">
                <Button onClick={handleInstall}>
                    <Download03 />
                </Button>
        </div>
    );
}