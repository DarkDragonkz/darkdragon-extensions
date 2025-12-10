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
    version: '2.0.4', // Bump version (Order Fix)
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
        const request = App.createRequest({
            url: `${this.apiUrl}/manga/${mangaId}?includes[]=author&includes[]=artist`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseMangaDetails(data, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        // FIX ORDINE: Rimosso &order[number]=desc
        // Lasciamo che sia il sito a darci l'ordine corretto (solitamente per data/inserimento)
        const limit = 100 
        const request = App.createRequest({
            url: `${this.apiUrl}/manga/${mangaId}/chapters?page=1&limit=${limit}`,
            method: 'GET'
        })
        
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        let allChaptersData = data.result?.items || []
        const pagination = data.result?.pagination
        const lastPage = pagination?.last_page || 1

        if (lastPage > 1) {
            const promises = []
            for (let page = 2; page <= lastPage; page++) {
                const req = App.createRequest({
                    // Rimosso ordinamento anche qui
                    url: `${this.apiUrl}/manga/${mangaId}/chapters?page=${page}&limit=${limit}`,
                    method: 'GET'
                })
                promises.push(this.requestManager.schedule(req, 1))
            }

            const responses = await Promise.all(promises)
            
            for (const res of responses) {
                const pageData = JSON.parse(res.data ?? '{}')
                if (pageData.result?.items) {
                    allChaptersData = allChaptersData.concat(pageData.result.items)
                }
            }
        }

        return this.parser.parseChapters(allChaptersData)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
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
        
        const nextPage = manga.length >= 20 ? page + 1 : undefined

        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popular 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const followSection = App.createHomeSection({ id: 'follow', title: 'Most Followed 💖', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const recentSection = App.createHomeSection({ id: 'recent', title: 'Recently Added 🆕', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const updatesHotSection = App.createHomeSection({ id: 'updatesHot', title: 'Latest Hot Updates ⚡', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const updatesNewSection = App.createHomeSection({ id: 'updatesNew', title: 'Latest Updates 🆙', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const requestPopular = App.createRequest({ url: `${this.apiUrl}/top?type=trending&days=7&limit=15&includes[]=author`, method: 'GET' })
        this.requestManager.schedule(requestPopular, 1).then(res => {
            popularSection.items = this.parser.parseHomeSectionItems(JSON.parse(res.data ?? '{}'))
            sectionCallback(popularSection)
        })

        const requestFollow = App.createRequest({ url: `${this.apiUrl}/top?type=follows&days=7&limit=20&includes[]=author`, method: 'GET' })
        this.requestManager.schedule(requestFollow, 1).then(res => {
            followSection.items = this.parser.parseHomeSectionItems(JSON.parse(res.data ?? '{}'))
            sectionCallback(followSection)
        })

        const requestRecent = App.createRequest({ url: `${this.apiUrl}/manga?order[created_at]=desc&page=1&limit=20&includes[]=author`, method: 'GET' })
        this.requestManager.schedule(requestRecent, 1).then(res => {
            recentSection.items = this.parser.parseHomeSectionItems(JSON.parse(res.data ?? '{}'))
            sectionCallback(recentSection)
        })

        const reqUpdatesHot = App.createRequest({ url: `${this.apiUrl}/manga?order[chapter_updated_at]=desc&page=1&limit=20&scope=hot`, method: 'GET' })
        this.requestManager.schedule(reqUpdatesHot, 1).then(res => {
            updatesHotSection.items = this.parser.parseHomeSectionItems(JSON.parse(res.data ?? '{}'))
            sectionCallback(updatesHotSection)
        })

        const reqUpdatesNew = App.createRequest({ url: `${this.apiUrl}/manga?order[chapter_updated_at]=desc&page=1&limit=20&scope=new`, method: 'GET' })
        this.requestManager.schedule(reqUpdatesNew, 1).then(res => {
            updatesNewSection.items = this.parser.parseHomeSectionItems(JSON.parse(res.data ?? '{}'))
            sectionCallback(updatesNewSection)
        })
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        switch (homepageSectionId) {
            case 'popular':
                url = `${this.apiUrl}/top?type=trending&days=7&limit=20&page=${page}&includes[]=author`
                break
            case 'follow':
                url = `${this.apiUrl}/top?type=follows&days=7&limit=20&page=${page}&includes[]=author`
                break
            case 'recent':
                url = `${this.apiUrl}/manga?order[created_at]=desc&limit=20&page=${page}&includes[]=author`
                break
            case 'updatesHot':
                url = `${this.apiUrl}/manga?order[chapter_updated_at]=desc&limit=20&page=${page}&scope=hot`
                break
            case 'updatesNew':
                url = `${this.apiUrl}/manga?order[chapter_updated_at]=desc&limit=20&page=${page}&scope=new`
                break
            default:
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