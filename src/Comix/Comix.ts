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

import { ComixParser } from './ComixParser'

const DOMAIN = 'https://comix.to'

export const ComixInfo: SourceInfo = {
    version: '1.0.0',
    name: 'Comix',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: `Extension that pulls comics/manga from ${DOMAIN}`,
    contentRating: ContentRating.MATURE,
    websiteBaseURL: DOMAIN,
    sourceTags: [
        {
            text: 'Mixed',
            type: BadgeColor.GREY,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class Comix implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = DOMAIN
    parser = new ComixParser()
    
    // User Agent Mobile per compatibilità
    readonly userAgent = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': `${DOMAIN}/`,
                    'User-Agent': this.userAgent,
                }
                return request
            },
            interceptResponse: async (response: any) => {
                return response
            }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/title/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/title/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/title/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        // Passiamo l'HTML grezzo perché i capitoli sono nel JSON
        return this.parser.parseChapters(response.data ?? '')
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // chapterId per Comix è solitamente l'ID numerico, ma l'URL richiede slug
        // Tuttavia, dal parser capitoli dovremmo aver salvato l'URL o l'ID corretto
        // Supponiamo che l'ID passato sia già parte dell'URL o mappabile
        
        // Esempio URL: https://comix.to/title/slug/chapter-id
        // Qui dobbiamo ricostruire l'URL completo. 
        // Ma attendiamo: il parserChapters dovrebbe aver salvato l'ID.
        // Se l'ID è "5616513", l'URL è complicato da indovinare senza slug.
        // TRUCCO: Usiamo l'ID come URL relativo se possibile, o facciamo affidamento sul fatto che 
        // nel parseChapters abbiamo salvato l'URL completo come ID se necessario.
        
        // Se l'ID è solo numerico, proviamo a costruire l'URL in modo standard se possibile
        // Ma per sicurezza, assumiamo che l'ID passato da parseChapters sia quello che serve.
        
        // Dato che non abbiamo lo slug del capitolo qui, dobbiamo fare attenzione.
        // Il sito usa /title/{manga_slug}/{chapter_id}-chapter-{num}
        // Se parseChapters ha passato l'ID numerico, ci serve un modo per risolvere l'URL.
        // Soluzione: In parseChapters, passiamo l'intero URL relativo come ID del capitolo!
        
        let url = chapterId
        if (!url.startsWith('http')) {
            url = `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
        }

        const request = App.createRequest({
            url: url,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        return this.parser.parseChapterDetails(response.data ?? '', mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        // URL Ricerca: https://comix.to/browser?keyword={query}&page={page}
        const request = App.createRequest({
            url: `${this.baseUrl}/browser?keyword=${encodeURIComponent(query.title ?? '')}&page=${page}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        // Passiamo l'HTML grezzo per il parsing del JSON
        const manga = this.parser.parseSearchResults(response.data ?? '')
        
        const nextPage = manga.length > 0 ? page + 1 : undefined

        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: `${this.baseUrl}/home`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        // Passiamo l'HTML grezzo
        this.parser.parseHomeSections(response.data ?? '', sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        return App.createPagedResults({ results: [] })
    }
    
    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'Referer': `${this.baseUrl}/`,
                'User-Agent': this.userAgent
            }
        })
    }
}