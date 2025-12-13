import {
    Chapter,
    ChapterDetails,
    ContentRating,
    HomeSection,
    PagedResults,
    SearchRequest,
    SourceInfo,
    SourceIntents,
    SourceManga,
    BadgeColor,
    SearchResultsProviding,
    MangaProviding,
    ChapterProviding,
    HomePageSectionsProviding,
    Request,
    Response,
} from '@paperback/types'

import { WeebCentralParser } from './WeebCentralParser'

const DOMAIN = 'https://weebcentral.com'

export const WeebCentralInfo: SourceInfo = {
    version: '2.0.0', // Major bump: Security & Stability Fixes
    name: 'WeebCentral',
    description: 'Extension for WeebCentral. Optimized for safety and sorting.',
    author: 'DarkDragonkzz',
    icon: 'icon.png',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
        {
            text: 'English 🇬🇧',
            type: BadgeColor.BLUE
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class WeebCentral implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = DOMAIN
    parser = new WeebCentralParser()

    // Centralized User-Agent
    readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    constructor(public cheerio: any) {} 

    requestManager = App.createRequestManager({
        // SAFETY FIX: Abbassato da 10 a 4 per evitare IP Ban da Cloudflare
        requestsPerSecond: 4, 
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'Referer': `${this.baseUrl}/`,
                        'User-Agent': this.userAgent,
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
        return `${this.baseUrl}/series/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        // WeebCentral carica i capitoli via API o pagina dedicata "full-chapter-list"
        // Questa chiamata è corretta per ottenere tutto in una volta
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}/full-chapter-list`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // endpoint /images per caricare tutte le immagini del capitolo
        const request = App.createRequest({
            url: `${this.baseUrl}/chapters/${chapterId}/images?is_prev=False&current_page=1&reading_style=long_strip`,
            method: 'GET'
        })
        
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const offset = metadata?.offset ?? 0
        
        // WeebCentral search structure
        // Nota: limit=32 è standard per il sito
        const request = App.createRequest({
            url: `${this.baseUrl}/search/data?author=&text=${encodeURIComponent(query.title ?? '')}&sort=Best%20Match&order=Ascending&official=Any&limit=32&offset=${offset}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        return App.createPagedResults({
            results: manga,
            metadata: manga.length >= 32 ? { offset: offset + 32 } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({ url: this.baseUrl, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const offset = metadata?.offset ?? 0
        let url = ''
        
        // Mapping corretto per le View More
        if (homepageSectionId === 'hot') {
            url = `${this.baseUrl}/search/data?sort=Popularity&order=Descending&official=Any&limit=32&offset=${offset}`
        } else if (homepageSectionId === 'latest') {
            url = `${this.baseUrl}/search/data?sort=Latest%20Updates&order=Descending&official=Any&limit=32&offset=${offset}`
        } else {
            return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        
        const manga = this.parser.parseSearchResults($)
        
        return App.createPagedResults({
            results: manga,
            metadata: manga.length >= 32 ? { offset: offset + 32 } : undefined
        })
    }
}