import {
    Chapter,
    ChapterDetails,
    ContentRating,
    HomeSection,
    HomeSectionType,
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
    Request
} from '@paperback/types'

import { MangaDexParser } from './MangaDexParser'

const MD_API = 'https://api.mangadex.org'

export const MangaDexInfo: SourceInfo = {
    version: '2.1.0', 
    name: 'MangaDex (EN)',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'MangaDex source (English Only) with high-res covers and scanlation groups support.',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'English 🇬🇧',
            type: BadgeColor.GREEN,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS,
}

export class MangaDex implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    
    parser = new MangaDexParser()

    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 5,
        requestTimeout: 20000, // Timeout ridotto per non bloccare troppo l'UI
        interceptor: {
            interceptRequest: async (request: Request) => {
                request.headers = {
                    ...(request.headers ?? {}),
                    'Referer': 'https://mangadex.org',
                    'User-Agent': 'Paperback-iOS/MangaDex-Ext'
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
        // Aggiungiamo 'includes' necessari
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}?includes[]=author&includes[]=artist&includes[]=cover_art`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        return this.parser.parseMangaDetails(data, mangaId)
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        // CRUCIAL: include scanlation_group per vedere CHI ha tradotto
        const url = `${MD_API}/manga/${mangaId}/feed?limit=500&translatedLanguage[]=en&order[chapter]=desc&includeFutureUpdates=0&includes[]=scanlation_group`

        const request = App.createRequest({
            url: url,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        // Il parsing ora gestisce gruppi e titoli
        const chapters = this.parser.parseChapters(data)

        // FIX ORDINAMENTO: A volte l'API ordina male i volumi misti.
        // Ordiniamo manualmente per sicurezza: Volume Desc -> Chapter Desc
        return chapters.sort((a, b) => {
            if ((a.volume ?? 0) !== (b.volume ?? 0)) {
                return (b.volume ?? 0) - (a.volume ?? 0)
            }
            return (b.chapNum ?? 0) - (a.chapNum ?? 0)
        })
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        try {
            const request = App.createRequest({
                url: `${MD_API}/at-home/server/${chapterId}`,
                method: 'GET',
            })

            const response = await this.requestManager.schedule(request, 1)
            const data = JSON.parse(response.data ?? '{}')
            return this.parser.parseChapterDetails(data, mangaId, chapterId)
        } catch (e) {
            // Fallback elegante
            return App.createChapterDetails({
                id: chapterId,
                mangaId: mangaId,
                pages: ['https://paperback.moe/icons/logo-alt.svg'] 
            })
        }
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        
        let url = `${MD_API}/manga?limit=${limit}&offset=${offset}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=en`
        
        if (query.title) {
            url += `&title=${encodeURIComponent(query.title)}&order[relevance]=desc`
        } else {
            url += `&order[followedCount]=desc` // Default sort se vuoto
        }
        
        const request = App.createRequest({ url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results = this.parser.parseSearchResults(data, false) // False = Low quality thumbs per liste

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sections = [
            App.createHomeSection({ id: 'popular', title: 'Popular 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge }),
            App.createHomeSection({ id: 'latest', title: 'Latest Updates 🆙', containsMoreItems: true, type: HomeSectionType.continuous }), // UX: Continuous per updates
            App.createHomeSection({ id: 'recently_added', title: 'Recently Added 🆕', containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            App.createHomeSection({ id: 'recommended', title: 'Top Rated ⭐', containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            App.createHomeSection({ id: 'featured', title: 'Featured (Monthly) 🌟', containsMoreItems: true, type: HomeSectionType.singleRowLarge }),
            App.createHomeSection({ id: 'self_published', title: 'Self-Published 🖊️', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        ]

        // Parametri base comuni
        const baseParams = 'limit=15&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=en'

        // Mappa ID -> URL
        const urls: Record<string, string> = {
            popular: `${MD_API}/manga?${baseParams}&order[followedCount]=desc`,
            latest: `${MD_API}/manga?${baseParams}&order[latestUploadedChapter]=desc`, // Nota: MD non ha un endpoint "feed" globale pulito, questo è il best effort per manga
            recently_added: `${MD_API}/manga?${baseParams}&order[createdAt]=desc`,
            recommended: `${MD_API}/manga?${baseParams}&order[rating]=desc`,
            featured: `${MD_API}/manga?${baseParams}&order[followedCount]=desc&createdAtSince=${new Date(Date.now() - 2592000000).toISOString().slice(0, 19)}`,
            self_published: `${MD_API}/manga?${baseParams}&originalLanguage[]=en&order[createdAt]=desc`
        }

        const promises = sections.map(async (section) => {
            try {
                const url = urls[section.id]
                if (!url) return

                const request = App.createRequest({ url: url, method: 'GET' })
                const response = await this.requestManager.schedule(request, 1)
                const data = JSON.parse(response.data ?? '{}')
                
                // UX Logic: Se la sezione è Large, usa cover HD (.512.jpg), altrimenti SD (.256.jpg)
                const useHighQuality = (section.type === HomeSectionType.singleRowLarge)
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
        const baseParams = `limit=${limit}&offset=${offset}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=en`
        
        let url = ''
        switch(homepageSectionId) {
            case 'popular': url = `${MD_API}/manga?${baseParams}&order[followedCount]=desc`; break;
            case 'latest': url = `${MD_API}/manga?${baseParams}&order[latestUploadedChapter]=desc`; break;
            case 'recently_added': url = `${MD_API}/manga?${baseParams}&order[createdAt]=desc`; break;
            case 'recommended': url = `${MD_API}/manga?${baseParams}&order[rating]=desc`; break;
            case 'featured': url = `${MD_API}/manga?${baseParams}&order[followedCount]=desc&createdAtSince=${new Date(Date.now() - 2592000000).toISOString().slice(0, 19)}`; break;
            case 'self_published': url = `${MD_API}/manga?${baseParams}&originalLanguage[]=en&order[createdAt]=desc`; break;
            default: return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        // In ViewMore, usiamo thumbs normali per caricare veloce la lista
        const results = this.parser.parseSearchResults(data, false)

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }
}