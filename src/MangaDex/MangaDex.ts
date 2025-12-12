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
    ConfigurableSource,
    SourceStateManager,
    DUIForm // <--- Importante
} from '@paperback/types'

import { MangaDexParser } from './MangaDexParser'
import { getMangaDexSettingsMenu, getSelectedLanguages } from './MangaDexSettings'

const MD_API = 'https://api.mangadex.org'

export const MangaDexInfo: SourceInfo = {
    version: '2.2.5', // Bump versione DUI
    name: 'MangaDex (Multi)',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'MangaDex source with configurable languages (DUI).',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'Multilingual 🌍',
            type: BadgeColor.BLUE,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS | SourceIntents.SETTINGS_UI,
}

export class MangaDex implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding, ConfigurableSource {
    
    parser = new MangaDexParser()
    stateManager = App.createSourceStateManager()

    constructor(private cheerio: any) {}

    // --- FIX DUI ---
    // Non serve più async/await qui, la funzione DUI ritorna l'oggetto form immediatamente
    // e le promise sono gestite internamente dai Binding.
    getSourceMenu(): Promise<DUIForm> {
        return Promise.resolve(getMangaDexSettingsMenu(this.stateManager))
    }
    // ---------------

    requestManager = App.createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: any) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': 'https://mangadex.org/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
                }
                return request
            },
            interceptResponse: async (response: any) => { return response }
        }
    })

    getMangaShareUrl(mangaId: string): string {
        return `https://mangadex.org/title/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}?includes[]=author&includes[]=artist&includes[]=cover_art`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseMangaDetails(data, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const langs = await getSelectedLanguages(this.stateManager)
        const langQuery = langs.map(l => `translatedLanguage[]=${l}`).join('&')

        const limit = 500
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}/feed?limit=${limit}&${langQuery}&order[chapter]=desc&includeFutureUpdates=0&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
            method: 'GET'
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        return this.parser.parseChapters(data)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${MD_API}/at-home/server/${chapterId}`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseChapterDetails(data, mangaId, chapterId)
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        
        const langs = await getSelectedLanguages(this.stateManager)
        const langQuery = langs.map(l => `availableTranslatedLanguage[]=${l}`).join('&')

        let url = `${MD_API}/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&${langQuery}`

        if (query.title) {
            url += `&title=${encodeURIComponent(query.title)}&order[relevance]=desc`
        } else {
            url += `&order[followedCount]=desc`
        }

        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results = this.parser.parseSearchResults(data)
        
        return App.createPagedResults({
            results: results,
            metadata: (offset + limit < data.total) ? { offset: offset + limit } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sectionPopular = App.createHomeSection({ id: 'popular', title: 'Popular Manga 🔥', containsMoreItems: true, type: 'singleRowNormal' })
        const sectionLatest = App.createHomeSection({ id: 'latest', title: 'Latest Updates 🆕', containsMoreItems: true, type: 'continuous' })
        const sectionNew = App.createHomeSection({ id: 'recently_added', title: 'Recently Added ✨', containsMoreItems: true, type: 'singleRowNormal' })

        sectionCallback(sectionPopular)
        sectionCallback(sectionLatest)
        sectionCallback(sectionNew)

        const langs = await getSelectedLanguages(this.stateManager)
        const langQuery = langs.map(l => `availableTranslatedLanguage[]=${l}`).join('&')
        const limit = 20

        const baseParams = `limit=${limit}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&${langQuery}`

        const requestPopular = App.createRequest({ url: `${MD_API}/manga?${baseParams}&order[followedCount]=desc`, method: 'GET' })
        const requestLatest = App.createRequest({ url: `${MD_API}/manga?${baseParams}&order[latestUploadedChapter]=desc`, method: 'GET' })
        const requestNew = App.createRequest({ url: `${MD_API}/manga?${baseParams}&order[createdAt]=desc`, method: 'GET' })

        const [dataPopular, dataLatest, dataNew] = await Promise.all([
            this.requestManager.schedule(requestPopular, 1),
            this.requestManager.schedule(requestLatest, 1),
            this.requestManager.schedule(requestNew, 1)
        ])

        sectionPopular.items = this.parser.parseSearchResults(JSON.parse(dataPopular.data ?? '{}'))
        sectionCallback(sectionPopular)

        sectionLatest.items = this.parser.parseSearchResults(JSON.parse(dataLatest.data ?? '{}'))
        sectionCallback(sectionLatest)

        sectionNew.items = this.parser.parseSearchResults(JSON.parse(dataNew.data ?? '{}'))
        sectionCallback(sectionNew)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        
        const langs = await getSelectedLanguages(this.stateManager)
        const langQuery = langs.map(l => `availableTranslatedLanguage[]=${l}`).join('&')

        const baseParams = `limit=${limit}&offset=${offset}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&${langQuery}`
        
        let url = ''
        switch(homepageSectionId) {
            case 'popular': url = `${MD_API}/manga?${baseParams}&order[followedCount]=desc`; break;
            case 'latest': url = `${MD_API}/manga?${baseParams}&order[latestUploadedChapter]=desc`; break;
            case 'recently_added': url = `${MD_API}/manga?${baseParams}&order[createdAt]=desc`; break;
            default: return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results = this.parser.parseSearchResults(data)
        
        return App.createPagedResults({
            results: results,
            metadata: (offset + limit < data.total) ? { offset: offset + limit } : undefined
        })
    }
}