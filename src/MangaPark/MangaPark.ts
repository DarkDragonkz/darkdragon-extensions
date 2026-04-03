import {
    Source,
    Chapter,
    ChapterDetails,
    HomeSection,
    SearchRequest,
    PagedResults,
    SourceInfo,
    ContentRating,
    BadgeColor,
    SourceIntents,
    SourceManga,
    Request,
    HomeSectionType
} from '@paperback/types'
import { MangaParkParser } from './MangaParkParser'

const MP_DOMAIN = 'https://mangapark.net'

export const MangaParkInfo: SourceInfo = {
    version: '2.0.0', // Major bump per riscrittura JSON
    name: 'MangaPark',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'MangaPark source using Next.js data extraction and chapter deduplication.',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: MP_DOMAIN,
    sourceTags: [
        {
            text: 'English 🇬🇧', 
            type: BadgeColor.GREEN
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class MangaPark extends Source {
    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (req: any) => {
                req.headers = {
                    ...(req.headers ?? {}),
                    'referer': `${MP_DOMAIN}/`,
                    // Importante: User-Agent realistico per evitare blocchi Cloudflare sui JSON
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
                return req
            },
            interceptResponse: async (res: any) => { return res }
        }
    })

    parser = new MangaParkParser()

    getMangaShareUrl(mangaId: string): string { return `${MP_DOMAIN}/title/${mangaId}` }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${MP_DOMAIN}/title/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        // Passiamo direttamente la stringa HTML per estrarre il JSON
        return this.parser.parseMangaDetails(response.data ?? '', mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const request = App.createRequest({
            url: `${MP_DOMAIN}/title/${mangaId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        return this.parser.parseChapters(response.data ?? '', mangaId)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        // MangaPark v5 usa URL del tipo /title/ID/CHAPTER
        const request = App.createRequest({
            url: `${MP_DOMAIN}/title/${mangaId}/${chapterId}`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        return this.parser.parseChapterDetails(response.data ?? '', mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        const request = App.createRequest({
            url: `${MP_DOMAIN}/search?word=${encodeURIComponent(query.title ?? '')}&page=${page}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const manga = this.parser.parseSearchResults(response.data ?? '')
        
        return App.createPagedResults({
            results: manga,
            metadata: manga.length > 0 ? { page: page + 1 } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const request = App.createRequest({
            url: MP_DOMAIN,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        this.parser.parseHomeSections(response.data ?? '', sectionCallback)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const page = metadata?.page ?? 1
        let url = ''

        if (homepageSectionId === 'latest') {
            url = `${MP_DOMAIN}/latest?page=${page}`
        } else if (homepageSectionId === 'popular') {
            url = `${MP_DOMAIN}/search?sort=rating&page=${page}`
        } else {
            return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({
            url: url,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const manga = this.parser.parseSearchResults(response.data ?? '')
        
        return App.createPagedResults({
            results: manga,
            metadata: manga.length > 0 ? { page: page + 1 } : undefined
        })
    }

    async getCloudflareBypassRequestAsync(): Promise<Request> {
        return App.createRequest({
            url: MP_DOMAIN,
            method: 'GET',
            headers: {
                'referer': `${MP_DOMAIN}/`,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })
    }
}
