import {
    ButtonRow,
    Form,
    NavigationButton,
    Section,
    SelectRow,
    Switch,
    FormSectionElement
} from '@paperback/types'

// Lista delle lingue supportate da MangaDex che vogliamo filtrare
export const LANGUAGES = [
    { id: 'it', name: 'Italiano' },
    { id: 'en', name: 'English' },
    { id: 'es', name: 'Spanish' },
    { id: 'fr', name: 'French' },
    { id: 'de', name: 'German' },
    { id: 'ja', name: 'Japanese' }
]

export const DEFAULT_LANGUAGES = ['it', 'en']

export class MangaDexSettings extends Form {
    
    async getSections(): Promise<FormSectionElement[]> {
        const sections: FormSectionElement[] = []
        const source = this.source as any // Accesso allo state manager della source

        // Ottieni le lingue salvate o usa il default
        let selectedLanguages = await source.stateManager.retrieve('languages') as string[]
        if (!selectedLanguages) {
            selectedLanguages = DEFAULT_LANGUAGES
            await source.stateManager.store('languages', selectedLanguages)
        }

        // Crea una riga switch per ogni lingua
        const languageRows = LANGUAGES.map(lang => {
            return Switch(lang.id, {
                label: lang.name,
                value: selectedLanguages.includes(lang.id),
                onValueChange: Application.Selector(this as MangaDexSettings, 'onLanguageChange')
            })
        })

        sections.push(Section('Languages Filter', languageRows))
        
        return sections
    }

    async onLanguageChange(value: boolean, context: any): Promise<void> {
        const source = this.source as any
        const langId = context.id
        
        let selectedLanguages = await source.stateManager.retrieve('languages') as string[]
        if (!selectedLanguages) selectedLanguages = DEFAULT_LANGUAGES

        if (value) {
            // Aggiungi lingua se non c'è
            if (!selectedLanguages.includes(langId)) selectedLanguages.push(langId)
        } else {
            // Rimuovi lingua
            selectedLanguages = selectedLanguages.filter(l => l !== langId)
        }

        // Salva
        await source.stateManager.store('languages', selectedLanguages)
    }
}