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
    HomeSectionType
} from '@paperback/types'

import { MangaDexParser } from './MangaDexParser'

const MD_API = 'https://api.mangadex.org'

export const MangaDexInfo: SourceInfo = {
    version: '3.0.0', // Reset versione pulita
    name: 'MangaDex (EN)',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'MangaDex English source. High quality covers.',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'English 🇬🇧',
            type: BadgeColor.BLUE,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS,
}

export class MangaDex implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    
    parser = new MangaDexParser()

    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': 'https://mangadex.org/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
                }
                return request
            },
            interceptResponse: async (response: any) => { return response }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `https://mangadex.org/title/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}?includes[]=author&includes[]=artist&includes[]=cover_art`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseMangaDetails(data, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const limit = 500
        // Hardcoded EN
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}/feed?limit=${limit}&translatedLanguage[]=en&order[chapter]=desc&includeFutureUpdates=0&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseChapters(data)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${MD_API}/at-home/server/${chapterId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseChapterDetails(data, mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        
        let url = `${MD_API}/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=en`

        if (query.title) {
            url += `&title=${encodeURIComponent(query.title)}&order[relevance]=desc`
        } else {
            url += `&order[followedCount]=desc`
        }

        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results = this.parser.parseSearchResults(data)
        
        return App.createPagedResults({
            results: results,
            metadata: (offset + limit < data.total) ? { offset: offset + limit } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        
        // 1. Popular New Titles - GRANDI
        const s1 = App.createHomeSection({ id: 'popular_new', title: 'Popular New Titles 🔥', containsMoreItems: false, type: HomeSectionType.singleRowLarge })
        
        // 2. Latest Updates - View More (Continuous)
        const s2 = App.createHomeSection({ id: 'latest', title: 'Latest Updates 🆕', containsMoreItems: true, type: HomeSectionType.continuous })
        
        // 3. Recommended - GRANDI
        const s3 = App.createHomeSection({ id: 'recommended', title: 'Recommended ⭐', containsMoreItems: false, type: HomeSectionType.singleRowLarge })
        
        // 4. Self-Published - Normali, No View More
        const s4 = App.createHomeSection({ id: 'self_published', title: 'Self-Published 🖊️', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        
        // 5. Featured - Normali, No View More
        const s5 = App.createHomeSection({ id: 'featured', title: 'Featured ⚡', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        
        // 6. Recently Added - Normali, No View More
        const s6 = App.createHomeSection({ id: 'recently_added', title: 'Recently Added ✨', containsMoreItems: false, type: HomeSectionType.singleRowNormal })

        sectionCallback(s1)
        sectionCallback(s2)
        sectionCallback(s3)
        sectionCallback(s4)
        sectionCallback(s5)
        sectionCallback(s6)

        // Parametri Comuni
        const base = `limit=15&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=en`
        
        // Richieste API Specifiche
        // 1. Popular New (Creati nell'ultimo mese + Popolari)
        const oneMonthAgo = new Date(Date.now() - 2592000000).toISOString().slice(0, 19)
        const req1 = App.createRequest({ url: `${MD_API}/manga?${base}&order[followedCount]=desc&createdAtSince=${oneMonthAgo}`, method: 'GET' })
        
        // 2. Latest Updates
        const req2 = App.createRequest({ url: `${MD_API}/manga?${base}&order[latestUploadedChapter]=desc`, method: 'GET' })
        
        // 3. Recommended (Rating alto)
        const req3 = App.createRequest({ url: `${MD_API}/manga?${base}&order[rating]=desc`, method: 'GET' })
        
        // 4. Self-Published (Original Language = EN)
        const req4 = App.createRequest({ url: `${MD_API}/manga?${base}&originalLanguage[]=en&order[followedCount]=desc`, method: 'GET' })
        
        // 5. Featured (Popolari di sempre)
        const req5 = App.createRequest({ url: `${MD_API}/manga?${base}&order[relevance]=desc`, method: 'GET' })
        
        // 6. Recently Added
        const req6 = App.createRequest({ url: `${MD_API}/manga?${base}&order[createdAt]=desc`, method: 'GET' })

        // Esecuzione Parallela
        const [d1, d2, d3, d4, d5, d6] = await Promise.all([
            this.requestManager.schedule(req1, 1),
            this.requestManager.schedule(req2, 1),
            this.requestManager.schedule(req3, 1),
            this.requestManager.schedule(req4, 1),
            this.requestManager.schedule(req5, 1),
            this.requestManager.schedule(req6, 1)
        ])

        s1.items = this.parser.parseSearchResults(JSON.parse(d1.data ?? '{}'))
        s2.items = this.parser.parseSearchResults(JSON.parse(d2.data ?? '{}'))
        s3.items = this.parser.parseSearchResults(JSON.parse(d3.data ?? '{}'))
        s4.items = this.parser.parseSearchResults(JSON.parse(d4.data ?? '{}'))
        s5.items = this.parser.parseSearchResults(JSON.parse(d5.data ?? '{}'))
        s6.items = this.parser.parseSearchResults(JSON.parse(d6.data ?? '{}'))

        sectionCallback(s1)
        sectionCallback(s2)
        sectionCallback(s3)
        sectionCallback(s4)
        sectionCallback(s5)
        sectionCallback(s6)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        const base = `limit=${limit}&offset=${offset}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=en`
        
        let url = ''
        // Gestiamo solo 'latest' perché è l'unico con containsMoreItems: true
        if (homepageSectionId === 'latest') {
            url = `${MD_API}/manga?${base}&order[latestUploadedChapter]=desc`
        } else {
            return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results = this.parser.parseSearchResults(data)
        
        return App.createPagedResults({
            results: results,
            metadata: (offset + limit < data.total) ? { offset: offset + limit } : undefined
        })
    }
}