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

import { XoxoComicParser } from './XoxoComicParser'

const DOMAIN = 'https://xoxocomic.com'

export const XoxoComicInfo: SourceInfo = {
    version: '1.1.2', // Bump versione
    name: 'XoxoComic',
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

export class XoxoComic implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = DOMAIN
    parser = new XoxoComicParser()
    
    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': `${DOMAIN}/`,
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
        return `${this.baseUrl}/comic/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const url = mangaId.includes('/') ? `${this.baseUrl}/${mangaId}` : `${this.baseUrl}/comic/${mangaId}`
        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const urlBase = mangaId.includes('/') ? `${this.baseUrl}/${mangaId}` : `${this.baseUrl}/comic/${mangaId}`
        
        const request = App.createRequest({ url: urlBase, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        
        const totalPages = this.parser.getChapterPageCount($)
        let allChapters = this.parser.parseChapters($, mangaId)

        if (totalPages > 1) {
            const promises = []
            for (let i = 2; i <= totalPages; i++) {
                const req = App.createRequest({
                    url: `${urlBase}?page=${i}`,
                    method: 'GET'
                })
                promises.push(this.requestManager.schedule(req, 1))
            }

            const responses = await Promise.all(promises)
            
            // I risultati di Promise.all sono ordinati, quindi Page 2, Page 3...
            // Concateniamo nell'ordine corretto
            for (const res of responses) {
                const $page = this.cheerio.load(res.data)
                const pageChapters = this.parser.parseChapters($page, mangaId)
                allChapters = allChapters.concat(pageChapters)
            }
        }

        // FIX: Assegna sortingIndex basato sull'ordine della lista completa
        // Questo garantisce che "Vol 1 Part 1" stia dove il sito dice che deve stare
        return allChapters.map((chapter, index) => {
            chapter.sortingIndex = index
            return chapter
        })
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        let url = chapterId.startsWith('http') ? chapterId : `${this.baseUrl}/${chapterId}`
        if (!url.endsWith('/all')) url = `${url}/all`

        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        return this.parser.parseChapterDetails(response.data ?? '', mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        const request = App.createRequest({
            url: `${this.baseUrl}/search-comic?keyword=${encodeURIComponent(query.title ?? '')}&page=${page}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseGridItems($)
        
        return App.createPagedResults({
            results: manga,
            metadata: manga.length > 0 ? { page: page + 1 } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({ url: this.baseUrl, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = `${this.baseUrl}/latest-comic?page=${page}`
        if (homepageSectionId === 'popular') url = `${this.baseUrl}/popular-comic?page=${page}`
        
        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        
        const manga = this.parser.parseGridItems($)
        return App.createPagedResults({
            results: manga,
            metadata: manga.length > 0 ? { page: page + 1 } : undefined
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