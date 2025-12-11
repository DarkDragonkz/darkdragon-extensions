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
    version: '1.4.0', // Bump versione: Refactoring e UI Enhance
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
            interceptResponse: async (response: any) => { return response }
        }
    })

    getMangaShareUrl(mangaId: string): string { return `${this.baseUrl}/comic/${mangaId}` }

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
        
        let allChapters = this.parser.parseChapters($, mangaId)
        let maxPage = this.parser.getChapterPageCount($)
        
        // Loop Discovery con Limite di Sicurezza (Senior Dev Pattern)
        const fetchedPages = new Set<number>([1])
        const MAX_SAFETY_PAGES = 50 // Previene loop infiniti in caso di bug del sito
        
        while (true) {
            const pagesToFetch: number[] = []
            
            for (let i = 2; i <= maxPage; i++) {
                if (!fetchedPages.has(i)) {
                    pagesToFetch.push(i)
                    fetchedPages.add(i)
                }
            }

            if (pagesToFetch.length === 0 || fetchedPages.size > MAX_SAFETY_PAGES) break

            const promises = pagesToFetch.map(page => 
                this.requestManager.schedule(
                    App.createRequest({ url: `${urlBase}?page=${page}`, method: 'GET' }), 
                    1
                ).then(res => this.cheerio.load(res.data))
            )

            const pages = await Promise.all(promises)

            for (const $page of pages) {
                const pageChapters = this.parser.parseChapters($page, mangaId)
                allChapters = allChapters.concat(pageChapters)
                
                // Aggiorna maxPage se ne scopriamo di nuove
                const foundMax = this.parser.getChapterPageCount($page)
                if (foundMax > maxPage) maxPage = foundMax
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
        const manga = []
        
        $('.item, .list-truyen-item-wrap, .search-story-item').each((_: any, item: any) => {
            const m = this.parser.parseUniversalItem($, item, 'grid')
            if (m) manga.push(m)
        })
        
        return App.createPagedResults({
            results: manga,
            metadata: manga.length > 0 ? { page: page + 1 } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // Stringhe esplicite per evitare ReferenceError
        const trendingSection = App.createHomeSection({ id: 'trending', title: 'Trending Comics 🔥', containsMoreItems: false, type: 'singleRowLarge' })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Updates 🆙', containsMoreItems: true, type: 'continuous' })
        const topMonthSection = App.createHomeSection({ id: 'top_month', title: 'Top Month ⭐', containsMoreItems: false, type: 'singleRowNormal' })
        const topWeekSection = App.createHomeSection({ id: 'top_week', title: 'Top Week ⚡', containsMoreItems: false, type: 'singleRowNormal' })

        const requestHome = App.createRequest({ url: this.baseUrl, method: 'GET' })
        const requestNew = App.createRequest({ url: `${this.baseUrl}/new-comic`, method: 'GET' })

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

        // 1. Trending (Home -> .items-slide)
        const trendingItems: PartialSourceManga[] = []
        $('.items-slide .item').each((_: any, item: any) => {
            const m = this.parser.parseUniversalItem($home, item, 'slide')
            if (m) trendingItems.push(m)
        })
        trendingSection.items = trendingItems
        sectionCallback(trendingSection)

        // 2. Latest (New Comic Page -> .items .row)
        const latestItems: PartialSourceManga[] = []
        $('.items .row .item').each((_: any, item: any) => {
            const m = this.parser.parseUniversalItem($new, item, 'list')
            if (m) latestItems.push(m)
        })
        latestSection.items = latestItems
        sectionCallback(latestSection)

        // 3. Top Month (Home -> #topMonth)
        const monthItems: PartialSourceManga[] = []
        $('#topMonth li').each((_: any, item: any) => {
            const m = this.parser.parseUniversalItem($home, item, 'top')
            if (m) monthItems.push(m)
        })
        topMonthSection.items = monthItems
        sectionCallback(topMonthSection)

        // 4. Top Week (Home -> #topWeek)
        const weekItems: PartialSourceManga[] = []
        $('#topWeek li').each((_: any, item: any) => {
            const m = this.parser.parseUniversalItem($home, item, 'top')
            if (m) weekItems.push(m)
        })
        topWeekSection.items = weekItems
        sectionCallback(topWeekSection)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        
        if (homepageSectionId === 'latest') {
            const url = `${this.baseUrl}/new-comic?page=${page}`
            const request = App.createRequest({ url: url, method: 'GET' })
            const response = await this.requestManager.schedule(request, 1)
            const $ = this.cheerio.load(response.data)
            
            const manga: PartialSourceManga[] = []
            $('.items .row .item').each((_: any, item: any) => {
                const m = this.parser.parseUniversalItem($, item, 'list')
                if (m) manga.push(m)
            })

            return App.createPagedResults({
                results: manga,
                metadata: manga.length > 0 ? { page: page + 1 } : undefined
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