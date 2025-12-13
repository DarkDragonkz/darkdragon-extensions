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
    version: '2.6.0', // Hybrid Version: Robust + Clean UI
    name: 'WeebCentral',
    description: 'Extension for WeebCentral. Fixed UI, Search and Chapters.',
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

    readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

    constructor(public cheerio: any) {} 

    requestManager = App.createRequestManager({
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
        // FONDAMENTALE: Usa full-chapter-list come nel file originale funzionante
        const request = App.createRequest({
            url: `${this.baseUrl}/series/${mangaId}/full-chapter-list`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
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
        
        // Usa l'endpoint di ricerca dati che ritorna HTML parziale
        const request = App.createRequest({
            url: `${this.baseUrl}/search/data?author=&text=${encodeURIComponent(query.title ?? '')}&sort=Best%20Match&order=Ascending&official=Any&limit=32&offset=${offset}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        return App.createPagedResults({
            results: manga,
            metadata: this.parser.isLastPage($) ? undefined : { offset: offset + 32 }
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
        
        // Mappiamo le sezioni ai filtri di ricerca per avere paginazione infinita funzionante
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
            metadata: this.parser.isLastPage($) ? undefined : { offset: offset + 32 }
        })
    }
}