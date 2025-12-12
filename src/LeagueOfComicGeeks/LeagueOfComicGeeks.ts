import {
    SourceInfo,
    ContentRating,
    SourceIntents,
    Form,
    SearchResultsProviding,
    MangaProgressProviding,
    PagedResults,
    SearchResultItem,
    SearchRequest,
    MangaProgress,
    RequestManager,
    SourceStateManager,
    createRequestObject,
    createForm,
    createSection,
    createInputRow,
    createLabel
} from '@paperback/types'

// --- Configurazioni ---
const LOCG_DOMAIN = 'https://leagueofcomicgeeks.com'
const LOCG_USERNAME = 'locg_username'
const LOCG_PASSWORD = 'locg_password'
const LOCG_SESSION_COOKIE = 'locg_session_cookie'

export const LeagueOfComicGeeksInfo: SourceInfo = {
    version: '1.0.6',
    name: 'League of Comic Geeks',
    description: 'Syncs reading progress with League of Comic Geeks',
    author: 'Tu',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: LOCG_DOMAIN,
    // DICHIARIAMO ESPLICITAMENTE CHE È UN TRACKER E HA UN MENU IMPOSTAZIONI
    intents: SourceIntents.MANGA_TRACKING | SourceIntents.SETTINGS_UI
}

// FIX: Rimosso "extends Tracker". La classe è autonoma.
export class LeagueOfComicGeeks implements SearchResultsProviding, MangaProgressProviding {
    
    // Inizializziamo i manager manualmente (Obbligatorio se non estendiamo Tracker)
    stateManager: SourceStateManager = App.createSourceStateManager()
    requestManager: RequestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 15000
    })

    constructor(private cheerio: any) {}

    // --- 1. GESTIONE IMPOSTAZIONI (Login) ---
    // Nota: I tracker usano spesso 'getTrackerSettingsForm' invece di 'getSourceMenu'
    async getTrackerSettingsForm(): Promise<Form> {
        const username = await this.stateManager.retrieve(LOCG_USERNAME) as string ?? ''
        const password = await this.stateManager.retrieve(LOCG_PASSWORD) as string ?? ''
        const cookie = await this.stateManager.retrieve(LOCG_SESSION_COOKIE) as string ?? ''

        return createForm({
            sections: [
                createSection({
                    header: 'Credenziali Login',
                    footer: 'Inserisci le credenziali. Se il login automatico fallisce, puoi inserire manualmente il cookie "ci_session" prendendolo dal browser.',
                    rows: [
                        createInputRow({
                            id: LOCG_USERNAME,
                            label: 'Username',
                            value: username
                        }),
                        createInputRow({
                            id: LOCG_PASSWORD,
                            label: 'Password',
                            value: password,
                            maskInput: true
                        }),
                        createInputRow({
                            id: LOCG_SESSION_COOKIE,
                            label: 'Session Cookie (Opzionale)',
                            value: cookie
                        })
                    ]
                }),
                createSection({
                    header: 'Stato',
                    rows: [
                        createLabel({
                            label: 'Stato Cookie',
                            value: cookie ? 'Cookie Presente ✅' : 'Nessun Cookie ❌'
                        })
                    ]
                })
            ]
        })
    }

    // Alias per sicurezza (alcune versioni dell'app cercano questo)
    async getSourceMenu(): Promise<Form> {
        return this.getTrackerSettingsForm()
    }

    // --- 2. GESTIONE API (Metodi Privati) ---
    
    private async getSession(): Promise<string> {
        let cookie = await this.stateManager.retrieve(LOCG_SESSION_COOKIE) as string
        if (cookie) return cookie

        const username = await this.stateManager.retrieve(LOCG_USERNAME) as string
        const password = await this.stateManager.retrieve(LOCG_PASSWORD) as string

        if (!username || !password) throw new Error('Credenziali mancanti nelle impostazioni')

        const request = createRequestObject({
            url: `${LOCG_DOMAIN}/login`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            data: {
                username: username,
                password: password,
                login_sub: 'Login'
            }
        })

        const response = await this.requestManager.schedule(request, 1)
        
        let setCookie = response.headers['set-cookie'] || response.headers['Set-Cookie']
        if (Array.isArray(setCookie)) setCookie = setCookie.join('; ')

        if (setCookie && typeof setCookie === 'string') {
            const match = setCookie.match(/ci_session=([^;]+)/)
            if (match) {
                cookie = match[1]
                await this.stateManager.store(LOCG_SESSION_COOKIE, cookie)
                return cookie
            }
        }

        throw new Error('Login automatico fallito. Inserisci il cookie manualmente.')
    }

    private async findIssueIdByNumber(seriesId: string, issueNumber: number): Promise<string | undefined> {
        try {
            const cookie = await this.getSession()
            const request = createRequestObject({
                url: `${LOCG_DOMAIN}/comics/series/${seriesId}`,
                method: 'GET',
                headers: { 'Cookie': `ci_session=${cookie}` }
            })

            const response = await this.requestManager.schedule(request, 1)
            const html = response.data ?? ''
            
            const regex = new RegExp(`data-issue-id="(\\d+)"[^>]*>#${issueNumber}<`, 'i')
            const match = html.match(regex)
            
            if (!match) {
                const altRegex = new RegExp(`data-issue-id="(\\d+)"[^>]*>\\s*#?${issueNumber}\\s*<`, 'i')
                const altMatch = html.match(altRegex)
                return altMatch ? altMatch[1] : undefined
            }

            return match ? match[1] : undefined
        } catch (e) {
            console.error(`Errore ricerca issue: ${e}`)
            return undefined
        }
    }

    // --- 3. IMPLEMENTAZIONE TRACKER ---

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        try {
            const cookie = await this.getSession()
            const request = createRequestObject({
                url: `${LOCG_DOMAIN}/search/ajax_search`,
                method: 'GET',
                param: `q=${encodeURIComponent(query.title ?? '')}&type=series`,
                headers: {
                    'Cookie': `ci_session=${cookie}`,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })

            const response = await this.requestManager.schedule(request, 1)
            const data = JSON.parse(response.data ?? '[]')
            
            const items: SearchResultItem[] = data.map((item: any) => ({
                mangaId: String(item.id),
                title: item.title,
                imageUrl: item.cover_url ?? '',
                subtitle: `${item.publisher} (${item.year})`
            }))

            return App.createPagedResults({
                results: items,
                metadata: undefined
            })
        } catch (e) {
            console.error(`Errore ricerca LOCG: ${e}`)
            return App.createPagedResults({ results: [] })
        }
    }

    async getMangaProgress(mangaId: string): Promise<MangaProgress | undefined> {
        return undefined 
    }

    async updateMangaProgress(mangaId: string, progress: MangaProgress): Promise<void> {
        const lastChapterRead = progress.lastChapterRead
        if (!lastChapterRead) return

        try {
            const issueId = await this.findIssueIdByNumber(mangaId, lastChapterRead)
            
            if (issueId) {
                const cookie = await this.getSession()
                const request = createRequestObject({
                    url: `${LOCG_DOMAIN}/comic/ajax_add_to_list`,
                    method: 'POST',
                    headers: {
                        'Cookie': `ci_session=${cookie}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    data: {
                        comic_id: issueId,
                        list_id: '1', 
                        action: 'add'
                    }
                })

                await this.requestManager.schedule(request, 1)
                console.log(`LOCG: Segnato issue ${issueId} (Cap. ${lastChapterRead}) come letto.`)
            } else {
                console.warn(`LOCG: ID Issue non trovato per la serie ${mangaId} capitolo ${lastChapterRead}`)
            }
        } catch (e) {
            console.error(`Errore aggiornamento LOCG: ${e}`)
        }
    }
}