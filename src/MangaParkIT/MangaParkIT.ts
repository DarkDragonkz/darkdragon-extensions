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
} from '@paperback/types'

import { MangaParkITParser } from './MangaParkITParser'
import { URLBuilder } from '../helper'

const MP_DOMAIN = 'https://mangapark.io'

export const MangaParkITInfo: SourceInfo = {
    version: '1.0.0',
    name: 'MangaPark IT',
    description: 'Estensione per MangaPark (Solo Italiano)',
    author: 'NmN',
    authorWebsite: 'http://github.com/pandeynmm',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
    language: 'it',
    websiteBaseURL: MP_DOMAIN,
    sourceTags: [
        {
            text: 'Italian 🇮🇹',
            type: BadgeColor.RED, // Colore per l'Italia
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class MangaParkIT implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = MP_DOMAIN
    parser = new MangaParkITParser()
    
    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'referer': `${this.baseUrl}/`,
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
                }
                return request
            },
            interceptResponse: async (response: any) => { return response }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/title/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/title/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/title/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // Gestione URL capitolo (assumendo che chapterId sia parte dell'url o l'id numerico)
        const url = chapterId.startsWith('http') ? chapterId : `${this.baseUrl}/title/${mangaId}/${chapterId}`
        const request = App.createRequest({
            url: url,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        
        // Costruiamo l'URL di ricerca forzando lang=it
        const url = new URLBuilder(this.baseUrl)
            .addPathComponent('search')
            .addQueryParameter('lang', 'it')
            .addQueryParameter('page', page.toString())
            .addQueryParameter('q', query.title ?? '')
            .buildUrl()

        const request = App.createRequest({
            url: url,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        return App.createPagedResults({
            results: manga,
            metadata: manga.length > 0 ? { page: page + 1 } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // Sezione Popolari (Ordinata per score)
        const requestPopular = App.createRequest({
            url: `${this.baseUrl}/search?lang=it&sortby=field_score&page=1`,
            method: 'GET'
        })
        
        // Sezione Recenti (Ordinata per update)
        const requestLatest = App.createRequest({
            url: `${this.baseUrl}/search?lang=it&sortby=field_update&page=1`,
            method: 'GET'
        })

        // Eseguiamo le richieste
        const [responsePopular, responseLatest] = await Promise.all([
            this.requestManager.schedule(requestPopular, 1),
            this.requestManager.schedule(requestLatest, 1)
        ])
        
        const $popular = this.cheerio.load(responsePopular.data)
        const $latest = this.cheerio.load(responseLatest.data)
        
        // Parsing manuale delle sezioni usando il metodo di ricerca
        const popularManga = this.parser.parseSearchResults($popular)
        const latestManga = this.parser.parseSearchResults($latest)
        
        const sectionPopular = App.createHomeSection({id: 'popular', title: 'Popolari (IT)', containsMoreItems: true, type: HomeSectionType.singleRowNormal})
        sectionPopular.items = popularManga
        sectionCallback(sectionPopular)

        const sectionLatest = App.createHomeSection({id: 'latest', title: 'Recenti (IT)', containsMoreItems: true, type: HomeSectionType.singleRowNormal})
        sectionLatest.items = latestManga
        sectionCallback(sectionLatest)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let sort = 'field_score'
        if (homepageSectionId === 'latest') sort = 'field_update'

        const url = `${this.baseUrl}/search?lang=it&sortby=${sort}&page=${page}`
        const request = App.createRequest({
            url: url,
            method: 'GET'
        })
    
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)

        return App.createPagedResults({
            results: manga,
            metadata: manga.length > 0 ? { page: page + 1 } : undefined
        })
    }
}