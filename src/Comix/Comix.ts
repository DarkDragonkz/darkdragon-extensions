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
    HomeSectionType
} from '@paperback/types'

import { ComixParser } from './ComixParser'

const BASE_URL = 'https://comix.to'
const API_URL = 'https://comix.to/api/v2'

export const ComixInfo: SourceInfo = {
    version: '2.0.0', // Major version update (API Rewrite)
    name: 'Comix',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: `Extension that pulls comics/manga from ${BASE_URL} using API v2`,
    contentRating: ContentRating.MATURE,
    websiteBaseURL: BASE_URL,
    sourceTags: [
        {
            text: 'Mixed',
            type: BadgeColor.GREY,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class Comix implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = BASE_URL
    apiUrl = API_URL
    parser = new ComixParser()

    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': `${BASE_URL}/`,
                    'Origin': BASE_URL,
                    // User Agent desktop standard per API
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
        return `${this.baseUrl}/title/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        // API: /api/v2/manga/{id}?includes[]=author&includes[]=artist
        const request = App.createRequest({
            url: `${this.apiUrl}/manga/${mangaId}?includes[]=author&includes[]=artist`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseMangaDetails(data, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        // API: /api/v2/manga/{id}/chapters?page=1&limit=1000&order[number]=desc
        // Scarichiamo fino a 1000 capitoli in una volta (o gestiamo la paginazione se necessario)
        const request = App.createRequest({
            url: `${this.apiUrl}/manga/${mangaId}/chapters?page=1&limit=1000&order[number]=desc`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseChapters(data)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // API: /api/v2/chapters/{id}
        const request = App.createRequest({
            url: `${this.apiUrl}/chapters/${chapterId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseChapterDetails(data, mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        
        // API: /api/v2/manga?keyword={query}&page={page}
        let url = `${this.apiUrl}/manga?page=${page}&limit=20`
        if (query.title) {
            url += `&keyword=${encodeURIComponent(query.title)}`
        }

        const request = App.createRequest({
            url: url,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        const manga = this.parser.parseSearchResults(data)
        
        // Controlla se ci sono altri risultati (se l'array è pieno)
        const nextPage = manga.length >= 20 ? page + 1 : undefined

        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // Definiamo le sezioni
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Most Popular 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const trendingSection = App.createHomeSection({ id: 'trending', title: 'Trending Webtoon 🌟', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Updates 🆙', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        // Eseguiamo le chiamate API in parallelo
        const requestPopular = App.createRequest({
            url: `${this.apiUrl}/top?type=trending&days=30&limit=10`,
            method: 'GET'
        })
        const requestTrending = App.createRequest({
            url: `${this.apiUrl}/manga?order[views_7d]=desc&types[]=manhwa&limit=10`,
            method: 'GET'
        })
        const requestLatest = App.createRequest({
            url: `${this.apiUrl}/manga?order[chapter_updated_at]=desc&limit=10`,
            method: 'GET'
        })

        // Popola Popular
        this.requestManager.schedule(requestPopular, 1).then(response => {
            const data = JSON.parse(response.data ?? '{}')
            popularSection.items = this.parser.parseHomeSection(data, 'popular')
            sectionCallback(popularSection)
        })

        // Popola Trending
        this.requestManager.schedule(requestTrending, 1).then(response => {
            const data = JSON.parse(response.data ?? '{}')
            trendingSection.items = this.parser.parseHomeSection(data, 'trending')
            sectionCallback(trendingSection)
        })

        // Popola Latest
        this.requestManager.schedule(requestLatest, 1).then(response => {
            const data = JSON.parse(response.data ?? '{}')
            latestSection.items = this.parser.parseHomeSection(data, 'latest')
            sectionCallback(latestSection)
        })
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        // Mappatura sezioni -> API
        if (homepageSectionId === 'popular') {
            url = `${this.apiUrl}/top?type=trending&days=30&limit=20&page=${page}`
        } else if (homepageSectionId === 'trending') {
            url = `${this.apiUrl}/manga?order[views_7d]=desc&types[]=manhwa&limit=20&page=${page}`
        } else if (homepageSectionId === 'latest') {
            url = `${this.apiUrl}/manga?order[chapter_updated_at]=desc&limit=20&page=${page}`
        } else {
            return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        const manga = this.parser.parseSearchResults(data)

        const nextPage = manga.length >= 20 ? page + 1 : undefined
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