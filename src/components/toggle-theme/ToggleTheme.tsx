import {Button} from "react-aria-components";
import {Sun} from "@untitledui/icons/Sun";
import {Moon02} from "@untitledui/icons/Moon02";
import { useEffect, useState } from 'react'


export default function ToggleTheme(){
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const storedTheme = localStorage.getItem('theme')
        if (storedTheme) {
            return storedTheme === 'dark'
        }
        return window.matchMedia("(prefers-color-scheme: dark)").matches
    });
    useEffect(() => {
        document.body.classList.remove('dark-mode', 'white-mode')
        document.body.classList.add(isDarkMode? 'dark-mode' : 'white-mode')
        localStorage.setItem('theme', isDarkMode? 'dark' : 'light')
    }, [isDarkMode])

    const switchTheme = () => {
        setIsDarkMode(prev =>!prev)
    }
    return (
        <div>
            <Button className="dark:text-white" onClick={switchTheme}>
                {isDarkMode ? <Moon02 size={24} /> : <Sun size={24} />  }
            </Button>
        </div>
    )

}
