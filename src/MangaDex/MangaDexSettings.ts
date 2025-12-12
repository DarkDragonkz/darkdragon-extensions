import {
    NavigationSection,
    SourceStateManager
} from '@paperback/types'

// Lista delle lingue disponibili (aggiungine altre se vuoi)
export const LANGUAGES = [
    { id: 'en', label: 'English 🇬🇧', default: true },
    { id: 'it', label: 'Italiano 🇮🇹', default: false },
    { id: 'es', label: 'Español 🇪🇸', default: false },
    { id: 'es-la', label: 'Español (LatAm) 🇲🇽', default: false },
    { id: 'fr', label: 'Français 🇫🇷', default: false },
    { id: 'pt-br', label: 'Português (BR) 🇧🇷', default: false },
    { id: 'de', label: 'Deutsch 🇩🇪', default: false },
    { id: 'ja', label: '日本語 🇯🇵', default: false },
]

// Recupera le lingue attive (usato per le richieste API)
export const getSelectedLanguages = async (stateManager: SourceStateManager): Promise<string[]> => {
    const selected: string[] = []
    
    for (const lang of LANGUAGES) {
        // Recupera il valore, se null usa il default
        const isEnabled = (await stateManager.retrieve(lang.id)) ?? lang.default
        if (isEnabled) {
            selected.push(lang.id)
        }
    }

    // Se l'utente disattiva tutto, per sicurezza torniamo almeno l'inglese
    if (selected.length === 0) return ['en']

    return selected
}

// Costruisce il menu delle impostazioni (Async per evitare crash)
export const getMangaDexSettingsMenu = async (stateManager: SourceStateManager): Promise<NavigationSection> => {
    
    // 1. Pre-carichiamo i valori salvati
    const values: Record<string, boolean> = {}
    for (const lang of LANGUAGES) {
        values[lang.id] = (await stateManager.retrieve(lang.id)) ?? lang.default
    }

    // 2. Costruiamo il menu
    return App.createNavigationSection({
        id: 'lang_settings',
        header: 'Lingue Contenuti',
        footer: 'Seleziona le lingue che vuoi visualizzare nell\'app.',
        items: LANGUAGES.map(lang => 
            App.createSwitch({
                id: lang.id,
                label: lang.label,
                value: values[lang.id], // Valore booleano reale (no promise)
                onChange: async (newValue) => {
                    await stateManager.store(lang.id, newValue)
                }
            })
        )
    })
}