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
    version: '1.2.0', // Bump version per refresh cache
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

    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 4, // Aumentato leggermente per gestire il multipage fetch
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
        let requestUrl = chapterId
        // Costruzione URL robusta
        if (!requestUrl.startsWith('http')) {
             if (!requestUrl.startsWith('/')) requestUrl = `/chapter/${mangaId}/${requestUrl}`
             requestUrl = `${this.baseUrl}${requestUrl}`
        }
        if (!requestUrl.endsWith('.html')) requestUrl += '.html'

        // Tentativo 1: Chiediamo style=list
        const separator = requestUrl.includes('?') ? '&' : '?'
        const listUrl = requestUrl + separator + 'style=list'

        const request = App.createRequest({
            url: listUrl,
            method: 'GET'
        })
        
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        
        const $ = this.cheerio.load(response.data)
        
        // --- LOGICA DI SALVATAGGIO (FIX PER 1 PAGINA) ---
        // Verifichiamo se il sito ha ignorato style=list
        // Sintomi: C'è il menu a tendina delle pagine E troviamo solo 1 immagine
        const hasPagination = $('select[name="page"]').length > 0
        const imageCount = $('img.manga_pic').length
        
        if (hasPagination && imageCount === 1) {
            // FALLBACK: Scarichiamo manualmente tutte le pagine
            const pages: string[] = []
            
            // 1. Aggiungi l'immagine della pagina corrente (pagina 1)
            const firstImg = $('img.manga_pic').attr('src')
            if (firstImg) pages.push(firstImg)
            
            // 2. Trova i link di tutte le altre pagine dal menu a tendina
            const pageLinks: string[] = []
            $('select[name="page"] option').each((_: any, el: any) => {
                 // Saltiamo quella selezionata perché l'abbiamo già
                 if (!$(el).prop('selected')) {
                     const val = $(el).attr('value')
                     if (val) pageLinks.push(val)
                 }
            })
            
            // 3. Scarica le altre pagine in parallelo
            // Usiamo Promise.all per velocità, il RequestManager gestirà la coda
            const promises = pageLinks.map(link => {
                return (async () => {
                     let pUrl = link
                     if (!pUrl.startsWith('http')) pUrl = this.baseUrl + pUrl
                     
                     const r = App.createRequest({ url: pUrl, method: 'GET' })
                     const res = await this.requestManager.schedule(r, 1)
                     const $p = this.cheerio.load(res.data)
                     
                     // Estrai l'immagine
                     let src = $p('img.manga_pic').attr('src')
                     // Fallback se .manga_pic non esiste nelle sottopagine
                     if (!src) src = $p('div[align="center"] img').attr('src')
                     
                     return src
                })()
            })
            
            const results = await Promise.all(promises)
            
            // 4. Unisci i risultati
            for (const img of results) {
                if (img && !img.includes('logo') && !img.includes('icon')) {
                    pages.push(img)
                }
            }
            
            // Rimuovi eventuali duplicati
            const uniquePages = [...new Set(pages)]

            return App.createChapterDetails({
                id: chapterId,
                mangaId: mangaId,
                pages: uniquePages
            })
        }
        
        // Se style=list ha funzionato o non c'è paginazione, usa il parser normale
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
        
        if (homepageSectionId === 'recent') url = `${this.baseUrl}/list/New-Update/?page=${page}`
        else if (homepageSectionId === 'popular') url = `${this.baseUrl}/list/Hot-Book/?page=${page}`
        else if (homepageSectionId === 'new') url = `${this.baseUrl}/list/New-Book/?page=${page}`
        else return App.createPagedResults({ results: [] })

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        this.checkResponseError(response)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($, this.baseUrl)

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