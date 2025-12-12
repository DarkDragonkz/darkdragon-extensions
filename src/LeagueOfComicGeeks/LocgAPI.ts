import {
    Request,
    RequestManager,
    SourceStateManager
} from '@paperback/types'
import { LOCG_SESSION_COOKIE, LOCG_USERNAME, LOCG_PASSWORD } from './LocgSettings'

const LOCG_DOMAIN = 'https://leagueofcomicgeeks.com'

export class LocgAPI {
    constructor(private requestManager: RequestManager, private stateManager: SourceStateManager) {}

    // Recupera il cookie o prova a fare il login
    async getSession(): Promise<string> {
        // 1. Controlla se abbiamo già un cookie valido
        let cookie = await this.stateManager.retrieve(LOCG_SESSION_COOKIE) as string
        if (cookie) return cookie

        // 2. Se non c'è, proviamo il login automatico
        const username = await this.stateManager.retrieve(LOCG_USERNAME) as string
        const password = await this.stateManager.retrieve(LOCG_PASSWORD) as string

        if (!username || !password) throw new Error('Credenziali mancanti nelle impostazioni')

        const request = App.createRequest({
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
        
        // Estrai il cookie "ci_session" dagli header
        const setCookie = response.headers['set-cookie']
        if (setCookie) {
            const match = setCookie.match(/ci_session=([^;]+)/)
            if (match) {
                cookie = match[1]
                await this.stateManager.store(LOCG_SESSION_COOKIE, cookie)
                return cookie
            }
        }

        throw new Error('Login fallito. Controlla le credenziali o inserisci il cookie manualmente.')
    }

    async searchSeries(query: string): Promise<any[]> {
        const cookie = await this.getSession()
        const request = App.createRequest({
            url: `${LOCG_DOMAIN}/search/ajax_search`,
            method: 'GET',
            param: `q=${encodeURIComponent(query)}&type=series`, // Filtriamo per serie
            headers: {
                'Cookie': `ci_session=${cookie}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        })

        const response = await this.requestManager.schedule(request, 1)
        try {
            return JSON.parse(response.data ?? '[]')
        } catch (e) {
            console.log("Errore parsing ricerca: " + e)
            return []
        }
    }

    // Per segnare un capitolo come letto, dobbiamo sapere l'ID dell'issue su LOCG.
    // Questo è difficile perché Paperback ha solo il numero del capitolo.
    // Strategia: Cerchiamo la lista degli issue della serie e troviamo quello con il numero corrispondente.
    async findIssueIdByNumber(seriesId: string, issueNumber: number): Promise<string | undefined> {
        const cookie = await this.getSession()
        // Nota: LOCG non ha un'API pulita per la lista issue. Dobbiamo parsare l'HTML della pagina serie.
        const request = App.createRequest({
            url: `${LOCG_DOMAIN}/comics/series/${seriesId}`,
            method: 'GET',
            headers: { 'Cookie': `ci_session=${cookie}` }
        })

        const response = await this.requestManager.schedule(request, 1)
        const html = response.data ?? ''
        
        // Regex brutale per trovare l'issue.
        // Cerca pattern tipo: data-id="12345" ... #5 (o simile)
        // Questo è un punto fragile che potrebbe richiedere aggiustamenti sui selettori CSS reali
        const regex = new RegExp(`data-issue-id="(\\d+)"[^>]*>#${issueNumber}<`, 'i')
        const match = html.match(regex)
        
        return match ? match[1] : undefined
    }

    async markIssueAsRead(issueId: string): Promise<void> {
        const cookie = await this.getSession()
        const request = App.createRequest({
            url: `${LOCG_DOMAIN}/comic/ajax_add_to_list`,
            method: 'POST',
            headers: {
                'Cookie': `ci_session=${cookie}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            },
            data: {
                comic_id: issueId,
                list_id: '1', // 1 Di solito è "Read" o "Collection", da verificare
                action: 'add'
            }
        })

        await this.requestManager.schedule(request, 1)
    }
}