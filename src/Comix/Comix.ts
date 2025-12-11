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

import { ComixParser } from './ComixParser'

const BASE_URL = 'https://comix.to'
const API_URL = 'https://comix.to/api/v2'

export const ComixInfo: SourceInfo = {
    version: '2.1.0', // Bump version (UI & Volume Support)
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
        requestsPerSecond: 4, 
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: Request) => {
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
        const limit = 100 
        const request = App.createRequest({
            url: `${this.apiUrl}/manga/${mangaId}/chapters?page=1&limit=${limit}&order[number]=desc`,
            method: 'GET'
        })
        
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const firstPageItems = data.result?.items || []
        const lastPage = data.result?.pagination?.last_page || 1

        const allPagesData: { page: number, items: any[] }[] = []
        allPagesData.push({ page: 1, items: firstPageItems })

        // Gestione paginazione se ci sono più di 100 capitoli
        if (lastPage > 1) {
            const promises = []
            for (let page = 2; page <= lastPage; page++) {
                const req = App.createRequest({
                    url: `${this.apiUrl}/manga/${mangaId}/chapters?page=${page}&limit=${limit}&order[number]=desc`,
                    method: 'GET'
                })
                promises.push(
                    this.requestManager.schedule(req, 1).then(res => ({
                        page: page,
                        items: JSON.parse(res.data ?? '{}').result?.items || []
                    }))
                )
            }
            const results = await Promise.all(promises)
            allPagesData.push(...results)
        }

        allPagesData.sort((a, b) => a.page - b.page)
        const allChapters = allPagesData.flatMap(p => p.items)

        return this.parser.parseChapters(allChapters)
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
        let url = `${this.apiUrl}/manga?page=${page}&limit=100`
        
        if (query.title) {
            url += `&keyword=${encodeURIComponent(query.title)}&order[relevance]=desc`
        } else {
            url += `&order[followed_count]=desc`
        }

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        // Passiamo 'search' come contesto
        let manga = this.parser.parseSearchResults(data, 'search')
        
        // Client-Side Sorting per rilevanza
        if (query.title && manga.length > 0) {
            const q = query.title.toLowerCase().trim()
            manga.sort((a, b) => {
                const titleA = a.title.toLowerCase()
                const titleB = b.title.toLowerCase()
                if (titleA === q && titleB !== q) return -1
                if (titleB === q && titleA !== q) return 1
                const aStarts = titleA.startsWith(q)
                const bStarts = titleB.startsWith(q)
                if (aStarts && !bStarts) return -1
                if (bStarts && !aStarts) return 1
                return 0
            })
        }
        
        const nextPage = manga.length >= 100 ? page + 1 : undefined

        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // UI MIGLIORATA: Titoli più accattivanti
        const sections = [
            {
                // Top Trending - Usa layout GRANDE
                request: App.createRequest({ url: `${this.apiUrl}/top?type=trending&days=7&limit=15&includes[]=author`, method: 'GET' }),
                section: App.createHomeSection({ id: 'popular', title: 'Trending Now 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge }),
                context: 'popular'
            },
            {
                // Most Followed - Usa layout Normale
                request: App.createRequest({ url: `${this.apiUrl}/top?type=follows&days=7&limit=20&includes[]=author`, method: 'GET' }),
                section: App.createHomeSection({ id: 'follow', title: 'Most Followed 💖', containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
                context: 'popular'
            },
            {
                // Recently Added
                request: App.createRequest({ url: `${this.apiUrl}/manga?order[created_at]=desc&page=1&limit=20&includes[]=author`, method: 'GET' }),
                section: App.createHomeSection({ id: 'recent', title: 'New Arrivals 🆕', containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
                context: 'popular'
            },
            {
                // Hot Updates - Scroll Continuo
                request: App.createRequest({ url: `${this.apiUrl}/manga?order[chapter_updated_at]=desc&page=1&limit=20&scope=hot`, method: 'GET' }),
                section: App.createHomeSection({ id: 'updatesHot', title: 'Hot Updates ⚡', containsMoreItems: true, type: HomeSectionType.continuous }),
                context: 'latest' // Mostra "Ch. X"
            },
            {
                // Latest Updates - Scroll Continuo
                request: App.createRequest({ url: `${this.apiUrl}/manga?order[chapter_updated_at]=desc&page=1&limit=20&scope=new`, method: 'GET' }),
                section: App.createHomeSection({ id: 'updatesNew', title: 'Latest Updates 🆙', containsMoreItems: true, type: HomeSectionType.continuous }),
                context: 'latest' // Mostra "Ch. X"
            }
        ]

        const promises = sections.map(async (item) => {
            try {
                const response = await this.requestManager.schedule(item.request, 1)
                const data = JSON.parse(response.data ?? '{}')
                // Passa il contesto specifico per migliorare i sottotitoli
                item.section.items = this.parser.parseSearchResults(data, item.context as any)
                sectionCallback(item.section)
            } catch (e) {
                console.error(`Error fetching section ${item.section.id}: ${e}`)
                sectionCallback(item.section) 
            }
        })

        await Promise.all(promises)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''
        let context = 'search'

        switch (homepageSectionId) {
            case 'popular':
                url = `${this.apiUrl}/top?type=trending&days=7&limit=20&page=${page}&includes[]=author`
                context = 'popular'
                break
            case 'follow':
                url = `${this.apiUrl}/top?type=follows&days=7&limit=20&page=${page}&includes[]=author`
                context = 'popular'
                break
            case 'recent':
                url = `${this.apiUrl}/manga?order[created_at]=desc&limit=20&page=${page}&includes[]=author`
                context = 'popular'
                break
            case 'updatesHot':
                url = `${this.apiUrl}/manga?order[chapter_updated_at]=desc&limit=20&page=${page}&scope=hot`
                context = 'latest'
                break
            case 'updatesNew':
                url = `${this.apiUrl}/manga?order[chapter_updated_at]=desc&limit=20&page=${page}&scope=new`
                context = 'latest'
                break
            default:
                return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        const manga = this.parser.parseSearchResults(data, context as any)

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