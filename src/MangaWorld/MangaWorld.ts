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
    TagSection,
    PartialSourceManga,
} from '@paperback/types'

import { MangaWorldParser } from './MangaWorldParser'
import { URLBuilder } from '../helper'

const MW_DOMAIN = 'https://www.mangaworld.mx'

export const MangaWorldInfo: SourceInfo = {
    version: '3.6.0', // Bump version: Safety & Logic Fixes
    name: 'MangaWorld',
    description: 'Extension that pulls manga from MangaWorld. Optimized for speed and safety.',
    author: 'DarkDragonkzz',
    authorWebsite: 'https://github.com/DarkDragonkzz',
    icon: 'icon.png',
    contentRating: ContentRating.MATURE,
    language: 'it',
    websiteBaseURL: MW_DOMAIN,
    sourceTags: [
        {
            text: 'Italian 🇮🇹',
            type: BadgeColor.RED
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class MangaWorld implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding { 
    baseUrl = MW_DOMAIN
    parser = new MangaWorldParser()
    
    // SAFETY: Abbassato da 10 a 2. 10 è un attacco DDoS involontario.
    RETRIES = 2

    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        // SAFETY: 8 rps è aggressivo per un sito WP. 4 è il sweet spot.
        requestsPerSecond: 4,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'referer': `${this.baseUrl}/`,
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
                return request
            },
            interceptResponse: async (response: any) => {
                return response
            }
        }
    })
    
    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/manga/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // Nota: MangaWorld a volte ha layout "single page" (style=list)
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}/read/${chapterId}/?style=list`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    async getTags(): Promise<TagSection[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/archive`, // Carichiamo archive che è più leggero della home per i tag
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseTags($, this.baseUrl)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        if (page == -1) return App.createPagedResults({ results: [], metadata: { page: -1 } })
        
        const request = this.constructSearchRequest(page, query)
        
        const data = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(data.data)
        const manga = this.parser.parseSearchResults($)
        
        // Paginazione MangaWorld
        page++
        if (manga.length < 16) page = -1 // Se troviamo meno item del limite, siamo alla fine
        
        return App.createPagedResults({
            results: manga,
            metadata: { page: page },
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: `${this.baseUrl}`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        switch (homepageSectionId) {
            case 'ultimi_capitoli':
                url = `${this.baseUrl}/?page=${page}`
                break
            case 'manga_mese':
                url = `${this.baseUrl}/archive?sort=most_read&page=${page}`
                break
            default:
                return App.createPagedResults({ results: [], metadata: { page: -1 } })
        }

        const request = App.createRequest({
            url: url,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        const manga: PartialSourceManga[] = this.parser.parseViewMore($)
        
        const hasMore = manga.length > 0
        
        return App.createPagedResults({
            results: manga,
            metadata: hasMore ? { page: page + 1 } : undefined,
        })
    }

    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'referer': `${this.baseUrl}/`,
                'origin': `${this.baseUrl}/`,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })
    }

    constructSearchRequest(page: number, query: SearchRequest): any {
        const builder = new URLBuilder(this.baseUrl)
                .addPathComponent('archive')
                .addQueryParameter('page', page.toString())

        if (query?.title) {
            builder.addQueryParameter('keyword', query.title)
        }

        if (query?.includedTags && query.includedTags.length > 0) {
             builder.addQueryParameter('genre', query.includedTags.map((x: any) => x.id))
        }

        // Se non c'è ricerca specifica, ordiniamo per più letti (UX migliore)
        if (!query?.title && (!query?.includedTags || query.includedTags.length === 0)) {
            builder.addQueryParameter('sort', 'most_read')
        }

        return App.createRequest({
            url: builder.buildUrl({ addTrailingSlash: true, includeUndefinedParameters: false }),
            method: 'GET',
        })
    }
}
