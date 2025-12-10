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

import { BatCaveParser } from './BatCaveParser'

const DOMAIN = 'https://batcave.biz'

export const BatCaveInfo: SourceInfo = {
    version: '1.0.7',
    name: 'BatCave',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: `Extension that pulls comics from ${DOMAIN}`,
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
        {
            text: 'Comics',
            type: BadgeColor.GREY,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class BatCave implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = DOMAIN
    parser = new BatCaveParser()
    
    RETRIES = 5 

    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': `${DOMAIN}/`,
                    // Usiamo quello di default per passare meglio i controlli CF dell'app
                    'User-Agent': await this.requestManager.getDefaultUserAgent(), 
                }
                return request
            },
            interceptResponse: async (response: any) => {
                return response
            }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        this.checkResponseError(response)
        return this.parser.parseChapters(response.data ?? '')
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const mangaNumericId = mangaId.split('-')[0]
        const request = App.createRequest({
            url: `${this.baseUrl}/reader/${mangaNumericId}/${chapterId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        this.checkResponseError(response)
        return this.parser.parseChapterDetails(response.data ?? '', mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        const request = App.createRequest({
            url: `${this.baseUrl}/index.php?do=search&subaction=search&story=${encodeURIComponent(query.title ?? '')}&search_start=${page}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, this.RETRIES)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        const nextPage = manga.length > 0 ? page + 1 : undefined

        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: this.baseUrl,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, this.RETRIES)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        return App.createPagedResults({ results: [] })
    }
    
    // Funzione fondamentale per permettere il bypass Cloudflare dall'app
    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'Referer': `${this.baseUrl}/`,
                'User-Agent': await this.requestManager.getDefaultUserAgent()
            }
        })
    }

    // Gestione errori per notificare l'app se serve il Cloudflare Bypass
    checkResponseError(response: Response): void {
        if (response.status === 403 || response.status === 503) {
            throw new Error(`Cloudflare Bypass Required. Go to Settings > Sources > BatCave > Cloud Icon.`)
        }
    }
}