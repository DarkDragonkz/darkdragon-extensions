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
} from '@paperback/types'

import { BatCaveParser } from './BatCaveParser'

const DOMAIN = 'https://batcave.biz'

export const BatCaveInfo: SourceInfo = {
    version: '1.1.0', // Major Bump per UI Revamp
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
    
    // RETRIES abbassato a 2. 10 è eccessivo e blocca l'app
    RETRIES = 2 

    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 2,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': `${DOMAIN}/`,
                    // User agent più moderno per evitare versioni wap/mobile rotte
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
                return request
            },
            interceptResponse: async (response: any) => {
                return response
            }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/${mangaId}.html`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/${mangaId}.html`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/${mangaId}.html`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${this.baseUrl}/${chapterId}.html`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        // Passiamo l'HTML grezzo al parser che gestirà regex e fallback
        return this.parser.parseChapterDetails(response.data, mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        
        // BatCave (DLE) usa post per la ricerca solitamente, ma proviamo GET standard
        // Pattern: /index.php?do=search&subaction=search&story=QUERY&page=X
        const searchUrl = `${this.baseUrl}/index.php?do=search&subaction=search&story=${encodeURIComponent(query.title ?? '')}&page=${page}`

        const request = App.createRequest({
            url: searchUrl,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        // Paginazione semplice
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
        const $ = this.cheerio.load(response.data)
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        // BatCave paginazione: /page/2/
        if (homepageSectionId === 'latest') {
            url = `${this.baseUrl}/page/${page}/`
        } else {
            // Le altre sezioni (hot, top) spesso non hanno paginazione diretta accessibile facilmente via ID
            return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({
            url: url,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        
        // Usiamo un selettore specifico per la griglia principale delle pagine
        // Nella home è .sect--latest, ma nelle pagine /page/2/ spesso gli elementi sono diretti nel content
        let manga = this.parser.parseGridItems($, '.sect--latest, #dle-content', '.latest__chapter')

        // Se non trova nulla con i selettori home, prova quelli generici
        if (manga.length === 0) {
             manga = this.parser.parseSearchResults($)
        }

        const nextPage = manga.length > 0 ? page + 1 : undefined

        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined
        })
    }
    
    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'Referer': `${this.baseUrl}/`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })
    }
}