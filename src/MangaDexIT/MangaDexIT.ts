import {
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
    HomeSectionType,
    SearchResultsProviding,
    MangaProviding,
    ChapterProviding,
    HomePageSectionsProviding
} from '@paperback/types'

import { MangaDexITParser } from './MangaDexITParser'

const MD_API = 'https://api.mangadex.org'

export const MangaDexITInfo: SourceInfo = {
    version: '1.2.0', // Bump version (Pagination & Deduplication)
    name: 'MangaDex IT',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'Italian MangaDex source with smart ID search and deduplicated chapters.',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'Italian 🇮🇹',
            type: BadgeColor.RED
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS,
}

export class MangaDexIT implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    
    parser = new MangaDexITParser()

    requestManager = App.createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000,
        interceptor: {
            interceptRequest: async (request: Request) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': 'https://mangadex.org',
                    'User-Agent': 'Paperback-iOS/MangaDexIT-Ext'
                }
                return request
            },
            interceptResponse: async (response: any) => { return response }
        }
    })

    getMangaShareUrl(mangaId: string): string { return `https://mangadex.org/title/${mangaId}` }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`,
            method: 'GET'
        })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseMangaDetails(data, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const limit = 500
        let offset = 0
        let hasMore = true
        const allChaptersData: any[] = []

        // Ciclo WHILE per scaricare TUTTI i capitoli (es. One Piece > 500 ch)
        while (hasMore) {
            const request = App.createRequest({
                url: `${MD_API}/manga/${mangaId}/feed?limit=${limit}&offset=${offset}&translatedLanguage[]=it&order[chapter]=desc&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic&includeFutureUpdates=0`,
                method: 'GET'
            })

            const response = await this.requestManager.schedule(request, 1)
            const data = JSON.parse(response.data ?? '{}')
            
            const results = data.data || []
            allChaptersData.push(...results)

            if (results.length < limit) {
                hasMore = false
            } else {
                offset += limit
            }
        }
        
        // Passiamo tutto al parser che farà la deduplicazione
        return this.parser.parseChapters(allChaptersData)
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        try {
            const request = App.createRequest({
                url: `${MD_API}/at-home/server/${chapterId}`,
                method: 'GET'
            })
            const response = await this.requestManager.schedule(request, 1)
            const data = JSON.parse(response.data ?? '{}')
            return this.parser.parseChapterDetails(data, mangaId, chapterId)
        } catch (e) {
            return App.createChapterDetails({
                id: chapterId,
                mangaId: mangaId,
                pages: ['https://paperback.moe/icons/logo-alt.svg'] // Fallback immagine errore
            })
        }
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        
        let url = `${MD_API}/manga?limit=${limit}&offset=${offset}&includes[]=cover_art`

        url += '&availableTranslatedLanguage[]=it'
        url += '&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic'
        
        if (query.title) {
            const safeTitle = query.title.trim()
            // SMART SEARCH: Se è un UUID, cerca per ID
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeTitle)

            if (isUUID) {
                url += `&ids[]=${safeTitle}`
            } else {
                url += `&title=${encodeURIComponent(safeTitle)}&order[relevance]=desc`
            }
        } else {
            url += '&order[followedCount]=desc'
        }

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results = this.parser.parseSearchResults(data, false)
        const nextOffset = offset + limit
        const hasMore = typeof data.total === 'number' ? nextOffset < data.total : results.length >= limit

        return App.createPagedResults({
            results: results,
            metadata: hasMore ? { offset: nextOffset } : undefined
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        // La Home italiana è già leggera (3 sezioni), la manteniamo così ma con limit ottimizzato a 15
        const sections = [
            App.createHomeSection({ id: 'popular', title: 'Popolari (IT) 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge }),
            App.createHomeSection({ id: 'latest', title: 'Ultime Uscite (IT) 🆙', containsMoreItems: true, type: HomeSectionType.doubleRow }),
            App.createHomeSection({ id: 'new', title: 'Nuovi Arrivi (IT) 🆕', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        ]

        sectionCallback(sections[0])
        sectionCallback(sections[1])
        sectionCallback(sections[2])

        const baseParams = 'limit=15&includes[]=cover_art&availableTranslatedLanguage[]=it&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic'

        const urls: Record<string, string> = {
            popular: `${MD_API}/manga?${baseParams}&order[followedCount]=desc`,
            latest: `${MD_API}/manga?${baseParams}&order[latestUploadedChapter]=desc`,
            new: `${MD_API}/manga?${baseParams}&order[createdAt]=desc`
        }

        const promises = sections.map(async (section) => {
            try {
                const request = App.createRequest({ url: urls[section.id], method: 'GET' })
                const response = await this.requestManager.schedule(request, 1)
                const data = JSON.parse(response.data ?? '{}')
                
                const useHighQuality = section.id === 'popular'
                section.items = this.parser.parseSearchResults(data, useHighQuality)
                
                sectionCallback(section)
            } catch (e) {
                console.error(`Error fetching section ${section.id}: ${e}`)
                sectionCallback(section)
            }
        })

        await Promise.all(promises)
    }

    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        const baseParams = `limit=${limit}&offset=${offset}&includes[]=cover_art&availableTranslatedLanguage[]=it&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`
        
        let url = ''
        switch(homepageSectionId) {
            case 'popular': url = `${MD_API}/manga?${baseParams}&order[followedCount]=desc`; break;
            case 'latest': url = `${MD_API}/manga?${baseParams}&order[latestUploadedChapter]=desc`; break;
            case 'new': url = `${MD_API}/manga?${baseParams}&order[createdAt]=desc`; break;
            default: return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results = this.parser.parseSearchResults(data, false)
        const nextOffset = offset + limit
        const hasMore = typeof data.total === 'number' ? nextOffset < data.total : results.length >= limit

        return App.createPagedResults({
            results: results,
            metadata: hasMore ? { offset: nextOffset } : undefined
        })
    }
}
