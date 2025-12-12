import {
    SourceStateManager,
    NavigationSection
} from '@paperback/types'

// Lista delle lingue supportate da MangaDex che vogliamo offrire
// ID = Codice ISO 2 lettere usato da MangaDex
export const LANGUAGES = [
    { id: 'en', label: 'English 🇬🇧', default: true },
    { id: 'it', label: 'Italiano 🇮🇹', default: false }, // Default false per non intasare, l'utente lo attiverà
    { id: 'es', label: 'Español 🇪🇸', default: false },
    { id: 'es-la', label: 'Español (LatAm) 🇲🇽', default: false },
    { id: 'fr', label: 'Français 🇫🇷', default: false },
    { id: 'pt-br', label: 'Português (BR) 🇧🇷', default: false },
    { id: 'de', label: 'Deutsch 🇩🇪', default: false },
    { id: 'ru', label: 'Русский 🇷🇺', default: false },
    { id: 'ja', label: '日本語 🇯🇵', default: false },
]

// Recupera le lingue selezionate dall'utente
export const getSelectedLanguages = async (stateManager: SourceStateManager): Promise<string[]> => {
    const selected: string[] = []
    
    for (const lang of LANGUAGES) {
        // Recupera lo stato salvato. Se non esiste (null), usa il default.
        const isEnabled = await stateManager.retrieve(lang.id) ?? lang.default
        if (isEnabled) {
            selected.push(lang.id)
        }
    }

    // Fallback: Se l'utente deseleziona tutto, per evitare errori mostriamo almeno Inglese
    if (selected.length === 0) {
        return ['en']
    }

    return selected
}

// Genera il menu delle impostazioni per Paperback
export const getMangaDexSettingsMenu = (stateManager: SourceStateManager): NavigationSection => {
    return App.createNavigationSection({
        id: 'language_settings',
        header: 'Lingue Contenuti',
        footer: 'Seleziona le lingue dei capitoli che vuoi visualizzare.',
        items: LANGUAGES.map(lang => 
            App.createSwitch({
                id: lang.id,
                label: lang.label,
                value: stateManager.retrieve(lang.id) ?? lang.default,
                onChange: async (newValue) => {
                    await stateManager.store(lang.id, newValue)
                }
            })
        )
    })
}