import {
    Chapter,
    ChapterDetails,
    ContentRating,
    PagedResults,
    SearchRequest,
    SourceInfo,
    SourceIntents,
    SourceManga,
    BadgeColor,
    SearchResultsProviding,
    MangaProviding,
    ChapterProviding,
    Request,
} from '@paperback/types'

import { MangaBallParser } from './MangaBallParser'

const BASE_URL = 'https://mangaball.net'
const API_URL = `${BASE_URL}/api/v1`
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export const MangaBallInfo: SourceInfo = {
    version: '1.0.0',
    name: 'MangaBall',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: `Extension that pulls manga from ${BASE_URL}`,
    contentRating: ContentRating.MATURE,
    language: 'en',
    websiteBaseURL: BASE_URL,
    sourceTags: [
        {
            text: 'English',
            type: BadgeColor.GREEN,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
}

export class MangaBall implements SearchResultsProviding, MangaProviding, ChapterProviding {
    baseUrl = BASE_URL
    apiUrl = API_URL
    parser = new MangaBallParser()

    private csrfToken = ''
    private csrfCookie = ''
    private csrfUpdatedAt = 0
    private readonly CSRF_TTL_MS = 10 * 60 * 1000

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
                    'User-Agent': USER_AGENT,
                }
                return request
            },
            interceptResponse: async (response: any) => response,
        },
    })

    getMangaShareUrl(mangaId: string): string {
        return `${this.baseUrl}/title-detail/${mangaId}/`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${this.baseUrl}/title-detail/${mangaId}/`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        const $ = this.cheerio.load(response.data)
        return this.parser.parseMangaDetails($, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const data = await this.postApi('/chapter/chapter-listing-by-title-id/', {
            title_id: mangaId,
        })
        return this.parser.parseChapters(data)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${this.baseUrl}/chapter-detail/${chapterId}/`,
            method: 'GET',
        })
        const response = await this.requestManager.schedule(request, 1)
        return this.parser.parseChapterDetails(response.data ?? '', mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        if (!query?.title) {
            return App.createPagedResults({ results: [] })
        }

        const data = await this.postApi('/title/search-advanced/', {
            search_input: query.title,
            filters: '{}',
        })

        const manga = this.parser.parseSearchResults(data)
        return App.createPagedResults({ results: manga })
    }

    async getCloudflareBypassRequestAsync() {
        return App.createRequest({
            url: this.baseUrl,
            method: 'GET',
            headers: {
                'Referer': `${this.baseUrl}/`,
                'User-Agent': USER_AGENT,
            },
        })
    }

    private async postApi(path: string, data: Record<string, any>): Promise<any> {
        const { token, cookie } = await this.getCsrf()
        const request = App.createRequest({
            url: `${this.apiUrl}${path}`,
            method: 'POST',
            headers: this.buildApiHeaders(token, cookie),
            data: this.buildFormBody(data),
        })

        const response = await this.requestManager.schedule(request, 1)
        if (this.isCsrfError(response.data)) {
            this.invalidateCsrf()
            return this.retryPostApi(path, data)
        }

        return this.parseJson(response.data)
    }

    private async retryPostApi(path: string, data: Record<string, any>): Promise<any> {
        const { token, cookie } = await this.getCsrf()
        const request = App.createRequest({
            url: `${this.apiUrl}${path}`,
            method: 'POST',
            headers: this.buildApiHeaders(token, cookie),
            data: this.buildFormBody(data),
        })
        const response = await this.requestManager.schedule(request, 1)
        return this.parseJson(response.data)
    }

    private async getCsrf(): Promise<{ token: string, cookie?: string }> {
        const fresh = Date.now() - this.csrfUpdatedAt < this.CSRF_TTL_MS
        if (this.csrfToken && fresh) {
            return { token: this.csrfToken, cookie: this.csrfCookie || undefined }
        }

        const request = App.createRequest({ url: this.baseUrl, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const token = this.parser.parseCsrfToken(response.data ?? '')
        const cookie = this.extractCookie(response.headers)

        this.csrfToken = token
        this.csrfCookie = cookie ?? ''
        this.csrfUpdatedAt = Date.now()

        return { token, cookie }
    }

    private invalidateCsrf() {
        this.csrfToken = ''
        this.csrfCookie = ''
        this.csrfUpdatedAt = 0
    }

    private extractCookie(headers: Record<any, any>): string | undefined {
        const raw = headers?.['set-cookie'] ?? headers?.['Set-Cookie'] ?? headers?.['SET-COOKIE']
        if (!raw) return undefined

        const entries = Array.isArray(raw) ? raw : [raw]
        const parts = entries
            .map((value) => String(value).split(';')[0].trim())
            .filter((value) => value.length > 0)

        return parts.length > 0 ? parts.join('; ') : undefined
    }

    private buildApiHeaders(token: string, cookie?: string): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-CSRF-TOKEN': token,
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': `${this.baseUrl}/`,
            'Origin': this.baseUrl,
            'User-Agent': USER_AGENT,
            'Accept': 'application/json, text/plain, */*',
        }
        if (cookie) headers['Cookie'] = cookie
        return headers
    }

    private buildFormBody(data: Record<string, any>): string {
        return Object.keys(data)
            .filter((key) => data[key] !== undefined)
            .map((key) => {
                const rawValue = data[key]
                const value = typeof rawValue === 'object' ? JSON.stringify(rawValue) : String(rawValue)
                return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
            })
            .join('&')
    }

    private parseJson(data: any): any {
        if (!data) return {}
        if (typeof data === 'string') {
            try {
                return JSON.parse(data)
            } catch {
                return {}
            }
        }
        return data
    }

    private isCsrfError(data: any): boolean {
        if (!data) return false
        if (typeof data === 'string') return data.includes('CSRF token validation failed')
        return data?.error === 'CSRF token validation failed'
    }
}
