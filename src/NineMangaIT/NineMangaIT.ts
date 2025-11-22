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
    TagSection,
    Request,
    Response,
} from '@paperback/types'

import { NineMangaITParser } from './NineMangaITParser'
import { URLBuilder } from '../helper'

const IT_DOMAIN = 'https://it.ninemanga.com'

export const NineMangaITInfo: SourceInfo = {
    version: '1.0.8', // Bump version
    name: 'NineMangaIT',
    description: 'Extension that pulls manga from it.ninemanga.com',
    author: 'DarkDragonkzz',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
    language: 'it',
    websiteBaseURL: IT_DOMAIN,
    sourceTags: [
        {
            text: 'Italian',
            type: BadgeColor.GREY
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class NineMangaIT implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = IT_DOMAIN
    parser = new NineMangaITParser()

    // FIX: Usiamo un User-Agent MOBILE (iPhone) per evitare il blocco "You have been blocked".
    // Cloudflare rileva se fingi di essere un PC ma sei su un telefono.
    readonly userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'

    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 2,
        requestTimeout: 25000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'Referer': `${this.baseUrl}/`,
                        'User-Agent': this.userAgent,
                        // Headers standard minimi per sembrare un browser mobile reale
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
        return `${this.baseUrl}/manga/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        let url = `${this.baseUrl}/chapter/${chapterId}`
        if (!chapterId.includes('chapter/')) {
             if (chapterId.startsWith('/')) url = `${this.baseUrl}${chapterId}`
             else url = `${this.baseUrl}/${chapterId}`
        }
        if (!url.includes('.html')) url += '.html'

        const request = App.createRequest({
            url: url,
            method: 'GET'
        })
        
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        // Passiamo il requestManager e baseUrl per gestire eventuali pagine aggiuntive
        return this.parser.parseChapterDetails($, mangaId, chapterId, this.requestManager, this.baseUrl, this.cheerio)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        if (page === -1) return App.createPagedResults({ results: [], metadata: { page: -1 } })

        const request = App.createRequest({
            url: new URLBuilder(this.baseUrl)
                .addPathComponent('search')
                .addQueryParameter('name_sel', 'contain')
                .addQueryParameter('wd', encodeURIComponent(query?.title ?? ''))
                .addQueryParameter('page', page.toString())
                .addQueryParameter('type', 'high')
                .buildUrl({ addTrailingSlash: true }),
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($, this.baseUrl)
        
        page++
        if (manga.length < 10) page = -1

        return App.createPagedResults({
            results: manga,
            metadata: { page: page },
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // Richiediamo solo la Home. Il parser gestirà la visualizzazione mobile.
        const requestHome = App.createRequest({ url: this.baseUrl, method: 'GET' })
        const responseHome = await this.requestManager.schedule(requestHome, 1)
        
        this.checkResponseError(responseHome)
        const $home = this.cheerio.load(responseHome.data)
        
        // Passiamo $home due volte perché non facciamo più la chiamata separata per gli update
        // (per ridurre il rischio di blocco)
        this.parser.parseHomeSections($home, $home, sectionCallback, this.baseUrl)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        let url = ''
        
        // URL ottimizzati per evitare redirect strani
        if (homepageSectionId === 'recent' || homepageSectionId === 'updates') {
            url = `${this.baseUrl}/list/New-Update/?page=${page}`
        } else if (homepageSectionId === 'popular') {
            url = `${this.baseUrl}/list/Hot-Book/?page=${page}`
        } else if (homepageSectionId === 'new') {
            url = `${this.baseUrl}/list/New-Book/?page=${page}`
        } else {
            return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($, this.baseUrl)

        if (manga.length > 0) {
             return App.createPagedResults({
                results: manga,
                metadata: { page: page + 1 }
            })
        }
        
        return App.createPagedResults({ results: [] })
    }

    // Cloudflare Bypass Request deve matchare gli header dell'interceptor
    async getCloudflareBypassRequest(): Promise<Request> {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'User-Agent': this.userAgent,
                'Referer': `${this.baseUrl}/`,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        })
    }

    checkResponseError(response: Response): void {
        if (response.status === 403 || response.status === 503) {
            throw new Error(`Cloudflare Bypass Required. Go to Settings > Sources > NineMangaIT > Cloud Icon.`)
        }
    }
}