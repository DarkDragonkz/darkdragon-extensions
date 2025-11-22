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
    version: '1.0.7',
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

    // CAMBIO STRATEGIA: Usiamo Firefox su Windows. 
    // Spesso Cloudflare è meno aggressivo con questo UA.
    readonly userAgentDesktop = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'

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
                        'User-Agent': this.userAgentDesktop,
                        // Headers semplificati per sembrare più "umani"
                        'Accept-Language': 'it-IT,it;q=0.8,en-US;q=0.5,en;q=0.3',
                        'Upgrade-Insecure-Requests': '1'
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
            url: `${this.baseUrl}/manga/${mangaId}?waring=1`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}?waring=1`,
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
        // Home request
        const requestHome = App.createRequest({ url: this.baseUrl, method: 'GET' })
        const requestUpdates = App.createRequest({ url: `${this.baseUrl}/list/New-Update/`, method: 'GET' })

        const [responseHome, responseUpdates] = await Promise.all([
            this.requestManager.schedule(requestHome, 1),
            this.requestManager.schedule(requestUpdates, 1)
        ])

        this.checkResponseError(responseHome)
        this.checkResponseError(responseUpdates)

        const $home = this.cheerio.load(responseHome.data)
        const $updates = this.cheerio.load(responseUpdates.data)

        this.parser.parseHomeSections($home, $updates, sectionCallback, this.baseUrl)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        let url = ''
        
        if (homepageSectionId === 'recent') {
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

    async getCloudflareBypassRequest(): Promise<Request> {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'User-Agent': this.userAgentDesktop,
                'Referer': `${this.baseUrl}/`,
                'Accept-Language': 'it-IT,it;q=0.8,en-US;q=0.5,en;q=0.3',
            }
        })
    }

    checkResponseError(response: Response): void {
        // Se riceviamo 403 o 503, Cloudflare ci ha bloccato
        if (response.status === 403 || response.status === 503) {
            throw new Error(`Cloudflare Bypass Required. Go to Settings > Sources > NineMangaIT > Cloud Icon to solve the captcha.`)
        }
    }
}