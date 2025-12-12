import {
    SourceStateManager,
    NavigationSection
} from '@paperback/types'

// ID = Codice ISO 2 lettere usato da MangaDex
export const LANGUAGES = [
    { id: 'en', label: 'English 🇬🇧', default: true },
    { id: 'it', label: 'Italiano 🇮🇹', default: false },
    { id: 'es', label: 'Español 🇪🇸', default: false },
    { id: 'es-la', label: 'Español (LatAm) 🇲🇽', default: false },
    { id: 'fr', label: 'Français 🇫🇷', default: false },
    { id: 'pt-br', label: 'Português (BR) 🇧🇷', default: false },
    { id: 'de', label: 'Deutsch 🇩🇪', default: false },
    { id: 'ru', label: 'Русский 🇷🇺', default: false },
    { id: 'ja', label: '日本語 🇯🇵', default: false },
]

export const getSelectedLanguages = async (stateManager: SourceStateManager): Promise<string[]> => {
    const selected: string[] = []
    
    for (const lang of LANGUAGES) {
        const isEnabled = (await stateManager.retrieve(lang.id)) ?? lang.default
        if (isEnabled) {
            selected.push(lang.id)
        }
    }

    if (selected.length === 0) {
        return ['en']
    }

    return selected
}

// FIX CRASH: Questa funzione ora è ASYNC e restituisce una Promise<NavigationSection>
export const getMangaDexSettingsMenu = async (stateManager: SourceStateManager): Promise<NavigationSection> => {
    
    // 1. Carica prima tutti i valori salvati
    const values: Record<string, boolean> = {}
    
    for (const lang of LANGUAGES) {
        // Qui aspettiamo (await) che il dato venga letto dalla memoria
        values[lang.id] = (await stateManager.retrieve(lang.id)) ?? lang.default
    }

    // 2. Ora costruiamo il menu con i valori REALI (booleani), non le Promise
    return App.createNavigationSection({
        id: 'language_settings',
        header: 'Lingue Contenuti',
        footer: 'Seleziona le lingue dei capitoli che vuoi visualizzare.',
        items: LANGUAGES.map(lang => 
            App.createSwitch({
                id: lang.id,
                label: lang.label,
                value: values[lang.id], // Ora questo è true/false, non una Promise!
                onChange: async (newValue) => {
                    await stateManager.store(lang.id, newValue)
                }
            })
        )
    })
}