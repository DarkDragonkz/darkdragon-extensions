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

import { NineMangaITParser } from './NineMangaITParser'
import { URLBuilder } from '../helper'

const IT_DOMAIN = 'https://it.ninemanga.com'

export const NineMangaITInfo: SourceInfo = {
    version: '2.0.1', // Bump versione per fix crash
    name: 'NineMangaIT',
    description: 'Estensione per NineManga (IT) con interfaccia aggiornata.',
    author: 'DarkDragonkz',
    icon: 'icon.png',
    contentRating: ContentRating.EVERYONE,
    language: 'it',
    websiteBaseURL: IT_DOMAIN,
    sourceTags: [
        {
            text: 'Italian 🇮🇹',
            type: BadgeColor.RED
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class NineMangaIT implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = IT_DOMAIN
    parser = new NineMangaITParser()

    // --- FIX IMPORTANTE: Costruttore per Cheerio ---
    constructor(private cheerio: any) {}
    // ----------------------------------------------

    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': `${this.baseUrl}/`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                    'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
                }
                return request
            },
            interceptResponse: async (response: any) => { return response }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/manga/${mangaId}.html`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}.html`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${this.baseUrl}/manga/${mangaId}.html?warning=1`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${this.baseUrl}/chapter/${chapterId}.html`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.fetchChapterPages($, mangaId, chapterId)
    }

    async fetchChapterPages($: any, mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const pages: string[] = []
        
        const pageOptions = $('select#page option').length
        let totalPages = pageOptions > 0 ? pageOptions : 1
        
        if (totalPages === 1) {
            const text = $('.page_select').text()
            const match = text.match(/\/\s*(\d+)/)
            if (match) totalPages = parseInt(match[1])
        }

        const promises: Promise<any>[] = []
        
        // Pagina 1
        const img1 = this.parser.extractImage($)
        if (img1) pages.push(img1)

        // Pagine successive
        for (let i = 2; i <= totalPages; i++) {
            const req = App.createRequest({
                url: `${this.baseUrl}/chapter/${chapterId}-${i}.html`,
                method: 'GET'
            })
            promises.push(this.requestManager.schedule(req, 1))
        }

        const responses = await Promise.all(promises)
        
        for (const res of responses) {
            const $page = this.cheerio.load(res.data)
            const img = this.parser.extractImage($page)
            if (img) pages.push(img)
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages.filter(p => p && !p.includes('logo'))
        })
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        
        const builder = new URLBuilder(this.baseUrl).addPathComponent('search')
        
        if (query.title) builder.addQueryParameter('name_s', encodeURIComponent(query.title))
        builder.addQueryParameter('page', page.toString())
        builder.addQueryParameter('type', 'high') 

        const request = App.createRequest({
            url: builder.buildUrl({ addTrailingSlash: true }),
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        const hasNext = $('.pagelist a.next').length > 0
        return App.createPagedResults({
            results: manga,
            metadata: hasNext ? { page: page + 1 } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sectionPopular = App.createHomeSection({ id: 'popular', title: 'Popolari 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const sectionLatest = App.createHomeSection({ id: 'latest', title: 'Ultime Uscite 🆕', containsMoreItems: true, type: HomeSectionType.continuous })
        const sectionNew = App.createHomeSection({ id: 'new', title: 'Nuovi Manga ✨', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        sectionCallback(sectionPopular)
        sectionCallback(sectionLatest)
        sectionCallback(sectionNew)

        const request = App.createRequest({ url: this.baseUrl, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        
        this.parser.parseHomeSections($, sectionPopular, sectionLatest, sectionNew)
        
        sectionCallback(sectionPopular)
        sectionCallback(sectionLatest)
        sectionCallback(sectionNew)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        switch(homepageSectionId) {
            case 'popular': url = `${this.baseUrl}/category/index_${page}.html?sort=click`; break;
            case 'latest': url = `${this.baseUrl}/category/index_${page}.html?sort=time`; break;
            case 'new': url = `${this.baseUrl}/category/index_${page}.html?sort=date`; break;
            default: return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        
        const manga = this.parser.parseViewMore($)
        const hasNext = $('.pagelist a.next').length > 0 

        return App.createPagedResults({
            results: manga,
            metadata: hasNext ? { page: page + 1 } : undefined
        })
    }

    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'referer': `${this.baseUrl}/`,
                'origin': `${this.baseUrl}/`,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
        })
    }
}