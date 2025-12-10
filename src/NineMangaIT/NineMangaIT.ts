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

import { NineMangaITParser } from './NineMangaITParser'
import { URLBuilder } from '../helper'

const IT_DOMAIN = 'https://it.ninemanga.com'

export const NineMangaITInfo: SourceInfo = {
    version: '1.4.0', // Major bump per l'ottimizzazione parallela
    name: 'NineMangaIT',
    description: 'Extension that pulls manga from it.ninemanga.com',
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

    readonly userAgent = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

    constructor(public cheerio: any) {} 

    requestManager = App.createRequestManager({
        requestsPerSecond: 3, 
        requestTimeout: 25000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'Referer': `${this.baseUrl}/`,
                        'User-Agent': this.userAgent,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Connection': 'keep-alive',
                        'Cookie': 'is_warning=1; my_limit=1'
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

    private getMangaUrl(mangaId: string): string {
        const id = mangaId.endsWith('.html') ? mangaId : `${mangaId}.html`
        return `${this.baseUrl}/manga/${id}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: this.getMangaUrl(mangaId) + '?waring=1',
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: this.getMangaUrl(mangaId) + '?waring=1',
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        let url = chapterId
        if (!url.startsWith('http')) {
             if (!url.startsWith('/')) url = `/chapter/${mangaId}/${chapterId}`
             url = `${this.baseUrl}${url}`
        }
        if (url.endsWith('.html')) url = url.replace('.html', '')

        // Richiediamo la pagina base, il parser poi troverà tutte le altre
        // Il suffisso -10-1 serviva per forzare un chunk, ma col nuovo parser prendiamo tutto
        url += '-10-1.html'

        const request = App.createRequest({
            url: url,
            method: 'GET'
        })
        
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        
        const $ = this.cheerio.load(response.data)
        
        // Passiamo 'this' per permettere al parser di usare il requestManager per il caricamento parallelo
        return this.parser.parseChapterDetails($, mangaId, chapterId, this)
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
                .buildUrl({ addTrailingSlash: true, includeUndefinedParameters: false }),
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
        const requestHome = App.createRequest({ url: this.baseUrl, method: 'GET' })
        const responseHome = await this.requestManager.schedule(requestHome, 1)
        this.checkResponseError(responseHome)
        const $home = this.cheerio.load(responseHome.data)
        
        this.parser.parseHomeSections($home, $home, sectionCallback, this.baseUrl)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        let url = ''
        
        // Mapping corretto per le sezioni
        if (homepageSectionId === 'latest') url = `${this.baseUrl}/list/New-Update/?page=${page}`
        else if (homepageSectionId === 'popular') url = `${this.baseUrl}/list/Hot-Book/?page=${page}`
        else if (homepageSectionId === 'new') url = `${this.baseUrl}/list/New-Book/?page=${page}`
        else return App.createPagedResults({ results: [] })

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($, this.baseUrl)

        // Paginazione infinita
        if (manga.length > 0) {
             return App.createPagedResults({ results: manga, metadata: { page: page + 1 } })
        }
        return App.createPagedResults({ results: [] })
    }

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