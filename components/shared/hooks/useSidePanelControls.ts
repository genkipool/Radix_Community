import { useState } from 'react';

export function useSidePanelControls(storageKey: string = 'panelPinned') {
  const [isPinned, setIsPinned] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(storageKey) === 'true';
    }
    return false;
  });

  const [externalWindow, setExternalWindow] = useState<Window | null>(null);

  const togglePin = () => {
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    localStorage.setItem(storageKey, newPinned.toString());
  };

  const handlePiP = async () => {
    if ('documentPictureInPicture' in window) {
      try {
        const pipWindow = await (window as Window & {
          documentPictureInPicture?: {
            requestWindow: (opts: { width: number; height: number }) => Promise<Window>;
          };
        }).documentPictureInPicture!.requestWindow({
          width: 420,
          height: 800,
        });

        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
        styles.forEach((style) => {
          pipWindow.document.head.appendChild(style.cloneNode(true));
        });

        pipWindow.document.documentElement.className = document.documentElement.className;
        pipWindow.document.documentElement.style.cssText = document.documentElement.style.cssText;
        pipWindow.document.body.className = 'bg-[var(--color-bg)]';

        pipWindow.addEventListener('pagehide', () => {
          setExternalWindow(null);
        });

        setExternalWindow(pipWindow);
      } catch (e) {
        console.error(e);
        alert('No se pudo abrir la ventana Picture-in-Picture.');
      }
    } else {
      alert('La API Document Picture-in-Picture no está soportada en tu navegador (requiere Chrome/Edge 111+).');
    }
  };

  const handlePopupWindow = () => {
    const popup = window.open('', 'RadixSidePanelPopup', 'width=420,height=800,scrollbars=yes,resizable=yes');
    if (!popup) {
      alert('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.');
      return;
    }

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
    styles.forEach((style) => {
      popup.document.head.appendChild(style.cloneNode(true));
    });

    popup.document.documentElement.className = document.documentElement.className;
    popup.document.documentElement.style.cssText = document.documentElement.style.cssText;
    popup.document.body.className = 'bg-[var(--color-bg)]';

    popup.addEventListener('beforeunload', () => {
      setExternalWindow(null);
    });

    setExternalWindow(popup);
  };

  const closeExternalWindow = () => {
    if (externalWindow) {
      externalWindow.close();
      setExternalWindow(null);
    }
  };

  const resetPin = () => {
    if (isPinned) {
      setIsPinned(false);
      localStorage.setItem(storageKey, 'false');
    }
  };

  return {
    isPinned,
    togglePin,
    resetPin,
    externalWindow,
    handlePiP,
    handlePopupWindow,
    closeExternalWindow,
  };
}
