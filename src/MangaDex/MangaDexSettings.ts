import {
    DUIForm,
    SourceStateManager
} from '@paperback/types'

// Lista Lingue
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

// Recupera le lingue attive (Per l'uso interno dell'estensione)
export const getSelectedLanguages = async (stateManager: SourceStateManager): Promise<string[]> => {
    const selected: string[] = []
    for (const lang of LANGUAGES) {
        const isEnabled = (await stateManager.retrieve(lang.id)) ?? lang.default
        if (isEnabled) selected.push(lang.id)
    }
    return selected.length > 0 ? selected : ['en']
}

// COSTRUZIONE MENU (Stile DUI come Anilist)
// Nota come usiamo "createDUIBinding": gestisce lui get e set senza crashare
export const getMangaDexSettingsMenu = (stateManager: SourceStateManager): DUIForm => {
    return App.createDUIForm({
        sections: async () => {
            return [
                App.createDUISection({
                    id: 'languages_section',
                    header: 'Lingue Contenuti',
                    footer: 'Seleziona le lingue che vuoi visualizzare.',
                    isHidden: false,
                    rows: async () => {
                        // Mappa le lingue in interruttori DUI
                        return LANGUAGES.map(lang => {
                            return App.createDUISwitch({
                                id: lang.id,
                                label: lang.label,
                                value: App.createDUIBinding({
                                    get: async () => (await stateManager.retrieve(lang.id)) ?? lang.default,
                                    set: async (newValue) => await stateManager.store(lang.id, newValue)
                                })
                            })
                        })
                    }
                })
            ]
        }
    })
}