import {
    Source,
    MangaProviding,
    ChapterProviding,
    HomePageSectionsProviding,
    SearchResultsProviding,
    SourceInfo,
    ContentRating,
    BadgeColor,
    SourceIntents,
    HomeSection,
    HomeSectionType,
    Request,
    Response,
    PagedResults,
    SourceManga,
    Chapter,
    ChapterDetails,
    SearchRequest
} from '@paperback/types'

import { NineMangaITParser } from './NineMangaITParser'

const IT_DOMAIN = 'https://it.ninemanga.com'

export const NineMangaITInfo: SourceInfo = {
    version: '3.0.0', // Reset versione - Clean Start
    name: 'NineMangaIT',
    description: 'Estensione per NineManga IT basata sui sorgenti Desktop.',
    author: 'DarkDragonkzz',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
    language: 'it',
    websiteBaseURL: IT_DOMAIN,
    sourceTags: [
        {
            text: 'Italian 🇮🇹',
            type: BadgeColor.RED
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class NineMangaIT implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = IT_DOMAIN
    parser = new NineMangaITParser()

    // User-Agent Desktop standard, dato che l'HTML fornito rispecchia la versione Desktop
    readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    constructor(public cheerio: any) {} 

    requestManager = App.createRequestManager({
        requestsPerSecond: 3, 
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'Referer': `${this.baseUrl}/`,
                        'User-Agent': this.userAgent,
                        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
                    }
                }
                return request
            },
            interceptResponse: async (response: any) => {
                return response
            }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/manga/${mangaId}.html`
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({ url: this.baseUrl, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        // Implementazione futura: Paginazione per "Ultimi Aggiornamenti"
        // Per ora ritorniamo vuoto finché non completiamo la logica base
        return App.createPagedResults({ results: [] })
    }

    // --- Placeholder per le funzioni Manga/Chapter (le implementeremo dopo aver fixato la Home) ---
    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        // Placeholder temporaneo
        return App.createSourceManga({ id: mangaId, mangaInfo: App.createMangaInfo({ titles: ['WIP'], image: '', status: 'Unknown' }) })
    }
    async getChapters(mangaId: string): Promise<Chapter[]> { return [] }
    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> { 
        return App.createChapterDetails({ id: chapterId, mangaId, pages: [] }) 
    }
    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        return App.createPagedResults({ results: [] })
    }
    // -----------------------------------------------------------------------------------------

    async getCloudflareBypassRequest(): Promise<Request> {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'User-Agent': this.userAgent,
                'Referer': `${this.baseUrl}/`,
            }
        })
    }

    checkResponseError(response: Response): void {
        if (response.status === 403 || response.status === 503) {
            throw new Error(`Cloudflare Bypass Required. Go to Settings > Sources > NineMangaIT > Cloud Icon.`)
        }
    }
}