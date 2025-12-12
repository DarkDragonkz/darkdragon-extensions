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
    SourceStateManager
} from '@paperback/types'

import { LocgAPI } from './LocgAPI'
import { routeLocgSettings } from './LocgSettings'

export const LeagueOfComicGeeksInfo: SourceInfo = {
    version: '1.0.1',
    name: 'League of Comic Geeks',
    description: 'Syncs reading progress with League of Comic Geeks',
    author: 'Tu',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: 'https://leagueofcomicgeeks.com',
    intents: SourceIntents.MANGA_TRACKING | SourceIntents.SETTINGS_UI
}

// FIX: Rimosso "extends Tracker". Ora implementa solo le interfacce.
export class LeagueOfComicGeeks implements SearchResultsProviding, MangaProgressProviding {
    
    // In Paperback 0.8+ queste proprietà vengono iniettate automaticamente se la classe le dichiara
    stateManager: SourceStateManager = App.createSourceStateManager()
    requestManager: RequestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 15000
    })

    private api: LocgAPI

    constructor(private cheerio: any) {
        this.api = new LocgAPI(this.requestManager, this.stateManager)
    }

    async getSourceMenu(): Promise<Form> {
        return (await routeLocgSettings(this.stateManager)).form
    }

    // --- Search ---
    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const results = await this.api.searchSeries(query.title ?? '')
        
        const items: SearchResultItem[] = results.map((item: any) => ({
            mangaId: String(item.id), // ID Serie su LOCG
            title: item.title,
            imageUrl: item.cover_url ?? '',
            subtitle: `${item.publisher} (${item.year})`
        }))

        return App.createPagedResults({
            results: items,
            metadata: undefined
        })
    }

    // --- Progress ---
    async getMangaProgress(mangaId: string): Promise<MangaProgress | undefined> {
        // Al momento non recuperiamo il progresso remoto, restituiamo undefined.
        // L'app mostrerà il progresso locale.
        return undefined 
    }

    async updateMangaProgress(mangaId: string, progress: MangaProgress): Promise<void> {
        const lastChapterRead = progress.lastChapterRead
        if (!lastChapterRead) return

        // 1. Trova l'ID dell'issue corrispondente al numero del capitolo
        const issueId = await this.api.findIssueIdByNumber(mangaId, lastChapterRead)
        
        if (issueId) {
            // 2. Segnalo come letto su LOCG
            await this.api.markIssueAsRead(issueId)
            console.log(`LOCG: Marked issue ${issueId} (Ch. ${lastChapterRead}) as read.`)
        } else {
            console.log(`LOCG: Could not find issue ID for series ${mangaId} chapter ${lastChapterRead}`)
        }
    }
}