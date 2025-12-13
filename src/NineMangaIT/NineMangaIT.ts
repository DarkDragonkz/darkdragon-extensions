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
    version: '2.0.0', // Rewrite from scratch
    name: 'NineMangaIT',
    description: 'Estensione nativa per la versione Mobile di NineManga IT. Bypassa il blocco +18.',
    author: 'DarkDragonkzz',
    icon: 'icon.png',
    contentRating: ContentRating.MATURE,
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

    // User-Agent Mobile specifico (Android) per garantire che il sito ci serva la versione mobile
    readonly userAgent = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

    constructor(public cheerio: any) {} 

    requestManager = App.createRequestManager({
        requestsPerSecond: 3, // Basso per evitare ban IP su caricamenti massivi di immagini
        requestTimeout: 25000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    ...{
                        'Referer': `${this.baseUrl}/`,
                        'User-Agent': this.userAgent,
                        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
                        // Cookie chiave per evitare redirect strani o avvisi persistenti
                        'Cookie': 'is_warning=1; my_limit=1; waring=1' 
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
        // Normalizza l'ID
        const id = mangaId.endsWith('.html') ? mangaId : `${mangaId}.html`
        return `${this.baseUrl}/manga/${id}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        // Aggiungiamo waring=1 per bypassare automaticamente la pagina +18
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
        // Costruzione URL capitolo robusta
        let url = chapterId
        if (!url.startsWith('http')) {
             if (!url.startsWith('/')) url = `/chapter/${mangaId}/${chapterId}`
             url = `${this.baseUrl}${url}`
        }
        
        // Assicuriamoci che finisca con .html e abbia il bypass
        if (!url.endsWith('.html')) url += '.html'
        if (!url.includes('waring=1')) url += '?waring=1'

        const request = App.createRequest({
            url: url,
            method: 'GET'
        })
        
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        
        const $ = this.cheerio.load(response.data)
        
        // Passiamo 'this' al parser per permettergli di fare chiamate parallele per le immagini
        return this.parser.parseChapterDetails($, mangaId, chapterId, this)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        if (page === -1) return App.createPagedResults({ results: [], metadata: { page: -1 } })

        // URL costruito basandosi su "Ricerca.txt"
        const request = App.createRequest({
            url: new URLBuilder(this.baseUrl)
                .addPathComponent('search')
                .addQueryParameter('name_sel', 'contain') // Cerca nel nome
                .addQueryParameter('wd', encodeURIComponent(query?.title ?? ''))
                .addQueryParameter('page', page.toString())
                .addQueryParameter('type', 'high') // Alta precisione
                .buildUrl({ addTrailingSlash: true, includeUndefinedParameters: false }),
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        page++
        // Se troviamo meno di 1 elemento, o la pagina non ha risultati, stop
        if (manga.length === 0) page = -1

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
        
        this.parser.parseHomeSections($home, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        let url = ''
        
        // URL presi dai file "Sezione X.txt"
        // Esempio: /list/New-Update/
        if (homepageSectionId === 'latest') url = `${this.baseUrl}/list/New-Update/?page=${page}`
        else if (homepageSectionId === 'popular') url = `${this.baseUrl}/list/Hot-Book/?page=${page}`
        else if (homepageSectionId === 'new') url = `${this.baseUrl}/list/New-Book/?page=${page}`
        else return App.createPagedResults({ results: [] })

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)

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
            }
        })
    }

    checkResponseError(response: Response): void {
        // Gestione base errori
        if (response.status === 403 || response.status === 503) {
            throw new Error(`Cloudflare Bypass Required. Go to Settings > Sources > NineMangaIT > Cloud Icon.`)
        }
    }
}