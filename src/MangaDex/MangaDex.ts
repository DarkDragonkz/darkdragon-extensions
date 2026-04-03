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
    version: '3.2.0', // Bump version (Deduplication & Light Home)
    name: 'MangaDex',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'English MangaDex source with deduplicated chapters.',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'English 🇬🇧',
            type: BadgeColor.GREEN,
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
        let offset = 0
        let hasMore = true
        const allChaptersData: any[] = []

        while (hasMore) {
            const request = App.createRequest({
                url: `${MD_API}/manga/${mangaId}/feed?limit=${limit}&offset=${offset}&translatedLanguage[]=en&order[chapter]=desc&includeFutureUpdates=0&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
                method: 'GET'
            })

            const response = await this.requestManager.schedule(request, 1)
            const data = JSON.parse(response.data ?? '{}')
            
            const results = data.data || []
            allChaptersData.push(...results)

            if (results.length < limit) {
                hasMore = false
            } else {
                offset += limit
            }
        }

        return this.parser.parseChapters(allChaptersData)
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
        
        // OTTIMIZZAZIONE HOME: Rimosse 2 sezioni meno utili e ridotto il carico
        
        const s1 = App.createHomeSection({ id: 'popular_new', title: 'Popular New Titles 🔥', containsMoreItems: false, type: HomeSectionType.singleRowLarge })
        const s2 = App.createHomeSection({ id: 'latest', title: 'Latest Updates 🆕', containsMoreItems: true, type: HomeSectionType.doubleRow })
        const s3 = App.createHomeSection({ id: 'recommended', title: 'Recommended ⭐', containsMoreItems: false, type: HomeSectionType.singleRowLarge })
        const s4 = App.createHomeSection({ id: 'featured', title: 'Featured ⚡', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        
        sectionCallback(s1)
        sectionCallback(s2)
        sectionCallback(s3)
        sectionCallback(s4)

        // Riduciamo il limit a 10 per velocizzare (Mobile friendly)
        const base = `limit=10&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=en`
        const oneMonthAgo = new Date(Date.now() - 2592000000).toISOString().slice(0, 19)

        const req1 = App.createRequest({ url: `${MD_API}/manga?${base}&order[followedCount]=desc&createdAtSince=${oneMonthAgo}`, method: 'GET' })
        const req2 = App.createRequest({ url: `${MD_API}/manga?${base}&order[latestUploadedChapter]=desc`, method: 'GET' })
        const req3 = App.createRequest({ url: `${MD_API}/manga?${base}&order[rating]=desc`, method: 'GET' })
        const req4 = App.createRequest({ url: `${MD_API}/manga?${base}&order[relevance]=desc`, method: 'GET' })

        // Solo 4 richieste in parallelo invece di 6
        const [d1, d2, d3, d4] = await Promise.all([
            this.requestManager.schedule(req1, 1),
            this.requestManager.schedule(req2, 1),
            this.requestManager.schedule(req3, 1),
            this.requestManager.schedule(req4, 1)
        ])

        s1.items = this.parser.parseSearchResults(JSON.parse(d1.data ?? '{}'))
        s2.items = this.parser.parseSearchResults(JSON.parse(d2.data ?? '{}'))
        s3.items = this.parser.parseSearchResults(JSON.parse(d3.data ?? '{}'))
        s4.items = this.parser.parseSearchResults(JSON.parse(d4.data ?? '{}'))

        sectionCallback(s1)
        sectionCallback(s2)
        sectionCallback(s3)
        sectionCallback(s4)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        const base = `limit=${limit}&offset=${offset}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&availableTranslatedLanguage[]=en`
        
        let url = ''
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
