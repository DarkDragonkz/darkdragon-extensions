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
    HomeSectionType,
    Request
} from '@paperback/types'

import { XoxoComicParser } from './XoxoComicParser'

const DOMAIN = 'https://xoxocomic.com'

export const XoxoComicInfo: SourceInfo = {
    version: '1.2.5',
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
            for (const res of responses) {
                const $page = this.cheerio.load(res.data)
                const pageChapters = this.parser.parseChapters($page, mangaId)
                allChapters = allChapters.concat(pageChapters)
            }
        }

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
        // 1. Trending (Hot) - LARGE, NO View More
        const trendingSection = App.createHomeSection({ 
            id: 'trending', 
            title: 'Trending Comics 🔥', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })

        // 2. Latest Updates (New Comic) - CONTINUOUS, SI View More
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates 🆙', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })

        // 3. Top Month - NORMAL, NO View More
        const topMonthSection = App.createHomeSection({ 
            id: 'top_month', 
            title: 'Top Month ⭐', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })

        // 4. Top Week - NORMAL, NO View More
        const topWeekSection = App.createHomeSection({ 
            id: 'top_week', 
            title: 'Top Week ⚡', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })

        // URL Specifici
        // NOTA: Usiamo la Home Page per Trending, Top Month e Top Week perché li contiene tutti
        // Usiamo /new-comic per Latest Updates come richiesto
        
        const requestHome = App.createRequest({ url: this.baseUrl, method: 'GET' })
        const requestNew = App.createRequest({ url: `${this.baseUrl}/new-comic`, method: 'GET' })

        // Eseguiamo in parallelo
        sectionCallback(trendingSection)
        sectionCallback(latestSection)
        sectionCallback(topMonthSection)
        sectionCallback(topWeekSection)

        const [responseHome, responseNew] = await Promise.all([
            this.requestManager.schedule(requestHome, 1),
            this.requestManager.schedule(requestNew, 1)
        ])

        const $home = this.cheerio.load(responseHome.data)
        const $new = this.cheerio.load(responseNew.data)

        // Parsing da Home
        this.parser.parseHomeSections($home, trendingSection, topMonthSection, topWeekSection)
        
        // Parsing da New Comic page
        this.parser.parseLatestSection($new, latestSection)

        // Callback finali
        sectionCallback(trendingSection)
        sectionCallback(topMonthSection)
        sectionCallback(topWeekSection)
        sectionCallback(latestSection)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        
        // Solo Latest (New Comic) supporta il View More
        if (homepageSectionId === 'latest') {
            const url = `${this.baseUrl}/new-comic?page=${page}`
            const request = App.createRequest({ url: url, method: 'GET' })
            const response = await this.requestManager.schedule(request, 1)
            const $ = this.cheerio.load(response.data)
            
            const manga = this.parser.parseGridItems($)
            const nextPage = manga.length > 0 ? page + 1 : undefined

            return App.createPagedResults({
                results: manga,
                metadata: nextPage ? { page: nextPage } : undefined
            })
        }
        
        return App.createPagedResults({ results: [] })
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