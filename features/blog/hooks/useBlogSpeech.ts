import { useState, useEffect, useRef } from 'react';

export function useBlogSpeech(es: boolean) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

    const stopSpeech = () => {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        speechRef.current = null;
    };

    const toggleSpeech = (text: string) => {
        if (isSpeaking) {
            stopSpeech();
            return;
        }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = es ? 'es-ES' : 'en-US';
        u.rate = 0.95;
        u.onend = () => setIsSpeaking(false);
        u.onerror = () => setIsSpeaking(false);
        speechRef.current = u;
        window.speechSynthesis.speak(u);
        setIsSpeaking(true);
    };

    useEffect(() => {
        return () => stopSpeech();
    }, []);

    return {
        isSpeaking,
        stopSpeech,
        toggleSpeech
    };
}
