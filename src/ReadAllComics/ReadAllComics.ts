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

import { ReadAllComicsParser } from './ReadAllComicsParser'
import { URLBuilder } from '../helper'

const RAC_DOMAIN = 'https://readallcomics.com'

export const ReadAllComicsInfo: SourceInfo = {
    version: '1.0.0',
    name: 'ReadAllComics',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'Extension for ReadAllComics (US Comics)',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: RAC_DOMAIN,
    sourceTags: [
        {
            text: 'Comics 🇺🇸',
            type: BadgeColor.BLUE, // Blu per USA/Comics
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS,
}

export class ReadAllComics implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    baseUrl = RAC_DOMAIN
    parser = new ReadAllComicsParser()
    
    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 3,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'referer': `${this.baseUrl}/`,
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
                }
                return request
            },
            interceptResponse: async (response: any) => { return response }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return mangaId
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        // L'ID è l'URL intero
        const request = App.createRequest({
            url: mangaId,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: mangaId,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapters($, mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: chapterId, // chapterId è uguale a mangaId (URL pagina)
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseChapterDetails($, mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        
        // Ricerca standard WordPress ?s=QUERY
        const url = new URLBuilder(this.baseUrl)
            .addQueryParameter('s', query.title ?? '')
            .addQueryParameter('story', query.title ?? '') // Parametro extra visto nello script
            .addQueryParameter('type', 'comic')
            .buildUrl()

        // Se c'è paginazione nella ricerca, di solito WP usa /page/2/
        // Ma per ora proviamo senza paginazione complessa o gestiamo solo la prima pagina di ricerca
        // in quanto l'URL builder standard con parametri query params non supporta facilmente /page/X misto
        
        const request = App.createRequest({
            url: url,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        const manga = this.parser.parseSearchResults($)
        
        return App.createPagedResults({
            results: manga,
            metadata: undefined // Disabilitiamo paginazione ricerca per ora per semplicità
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: this.baseUrl,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        this.parser.parseHomeSections($, sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        
        // Paginazione Homepage: https://readallcomics.com/page/2/
        const url = `${this.baseUrl}/page/${page}/`
        
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