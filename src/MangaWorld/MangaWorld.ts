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
    version: '3.4.0', // Major bump per refactoring e UI
    name: 'MangaWorld',
    description: 'Extension that pulls manga from MangaWorld.',
    author: 'NmN & DarkDragonkz',
    authorWebsite: 'http://github.com/pandeynmm',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
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
    
    constructor(private cheerio: any) {}
    
    // RIDOTTO A 2: 10 retry causano blocchi infiniti se il sito è down
    RETRIES = 2
    parser = new MangaWorldParser()

    requestManager = App.createRequestManager({
        requestsPerSecond: 5, // Abbassato leggermente per sicurezza
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'referer': `${this.baseUrl}/`,
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
            url: this.baseUrl,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseTags($, this.baseUrl)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        let page = metadata?.page ?? 1
        // Se page è -1, abbiamo finito i risultati
        if (page === -1) return App.createPagedResults({ results: [], metadata: undefined })
        
        const request = this.constructSearchRequest(page, query)
        
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        // Logica paginazione
        const nextPage = manga.length > 0 ? page + 1 : undefined

        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined,
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
            case '1': // Ultimi capitoli (corrisponde alla home paginata)
                url = `${this.baseUrl}/?page=${page}`
                break
            case '2': // Manga del mese (archivio most_read)
                url = `${this.baseUrl}/archive?sort=most_read&page=${page}`
                break
            case '3': // In tendenza (archivio most_read fallback)
                url = `${this.baseUrl}/archive?sort=most_read&page=${page}`
                break
            default:
                return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({
            url: url,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, this.RETRIES)
        const $ = this.cheerio.load(response.data)
        const manga: PartialSourceManga[] = this.parser.parseViewMore($)
        
        const nextPage = manga.length > 0 ? page + 1 : undefined
        
        return App.createPagedResults({
            results: manga,
            metadata: nextPage ? { page: nextPage } : undefined,
        })
    }

    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'referer': `${this.baseUrl}/`,
                'origin': `${this.baseUrl}/`,
                'user-agent': await this.requestManager.getDefaultUserAgent()
            }
        })
    }

    constructSearchRequest(page: number, query: SearchRequest): any {
        const builder = new URLBuilder(this.baseUrl)
            .addPathComponent('archive')
            .addQueryParameter('page', page.toString())

        if (query.title) {
            builder.addQueryParameter('keyword', encodeURIComponent(query.title))
        }

        if (query.includedTags && query.includedTags.length > 0) {
            // Seleziona il primo tag per filtrare (MangaWorld solitamente supporta 1 filtro genere alla volta via GET semplice)
            builder.addQueryParameter('genre', query.includedTags[0]?.id)
        }

        builder.addQueryParameter('sort', 'most_read')

        return App.createRequest({
            url: builder.buildUrl({ addTrailingSlash: true, includeUndefinedParameters: false }),
            method: 'GET',
        })
    }
}