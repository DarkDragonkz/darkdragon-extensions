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
    TagSection,
    PartialSourceManga
} from '@paperback/types'

const MD_API = 'https://api.mangadex.org'
const MD_UPLOADS = 'https://uploads.mangadex.org'

export const MangaDexInfo: SourceInfo = {
    version: '2.0.6', // Bump version
    name: 'MangaDex (EN)',
    icon: 'icon.png',
    author: 'DarkDragonkz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'MangaDex source (English Only) with full sections support.',
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
    
    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 4, // Abbassato a 4 per stabilità
        requestTimeout: 20000
    })

    getMangaShareUrl(mangaId: string): string {
        return `https://mangadex.org/title/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: `${MD_API}/manga/${mangaId}?includes[]=author&includes[]=artist&includes[]=cover_art`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        const attributes = data.data.attributes
        const relationships = data.data.relationships

        const title = attributes.title.en ?? Object.values(attributes.title)[0] ?? 'Unknown Title'
        let desc = attributes.description.en ?? Object.values(attributes.description)[0] ?? ''

        const availableLanguages = attributes.availableTranslatedLanguages || []
        if (!availableLanguages.includes('en')) {
            desc = `⚠️ [NO ENGLISH CHAPTERS AVAILABLE]\n\n${desc}`
        }

        const authors = relationships.filter((r: any) => r.type === 'author').map((r: any) => r.attributes?.name).filter((n: any) => n)
        const artists = relationships.filter((r: any) => r.type === 'artist').map((r: any) => r.attributes?.name).filter((n: any) => n)
        
        const coverRel = relationships.find((r: any) => r.type === 'cover_art')
        const fileName = coverRel?.attributes?.fileName
        const image = fileName ? `${MD_UPLOADS}/covers/${mangaId}/${fileName}` : 'https://paperback.moe/icons/logo-alt.svg'

        let status = 'Ongoing'
        if (attributes.status === 'completed') status = 'Completed'
        if (attributes.status === 'hiatus') status = 'Hiatus'
        if (attributes.status === 'cancelled') status = 'Cancelled'

        const tags: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: [] })]
        tags[0]!.tags = attributes.tags.map((tag: any) => App.createTag({ id: tag.id, label: tag.attributes.name.en }))

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: authors.join(', '),
                artist: artists.join(', '),
                tags: tags,
                desc: desc
            })
        })
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {
        const url = `${MD_API}/manga/${mangaId}/feed?limit=500&translatedLanguage[]=en&order[chapter]=desc&includeFutureUpdates=0`

        const request = App.createRequest({
            url: url,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const chapters: Chapter[] = []
        
        if (!data.data) return []

        for (const chapter of data.data) {
            const attr = chapter.attributes
            
            const chapNum = parseFloat(attr.chapter) || 0
            
            let title = ''
            if (attr.title) {
                title = attr.title
            } else if (attr.chapter) {
                title = `Chapter ${attr.chapter}`
            } else {
                title = 'Oneshot'
            }

            if (attr.externalUrl !== null || attr.pages === 0) {
                title = `🚫 [External] ${title}`
            }

            chapters.push(App.createChapter({
                id: chapter.id,
                name: title,
                chapNum: chapNum,
                volume: parseFloat(attr.volume) || 0,
                time: new Date(attr.publishAt),
                langCode: 'en'
            }))
        }

        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        try {
            const request = App.createRequest({
                url: `${MD_API}/at-home/server/${chapterId}`,
                method: 'GET',
            })

            const response = await this.requestManager.schedule(request, 1)
            const data = JSON.parse(response.data ?? '{}')
            
            if (data.baseUrl) {
                const baseUrl = data.baseUrl
                const hash = data.chapter.hash
                const fileNames = data.chapter.data 

                const pages: string[] = []
                for (const file of fileNames) {
                    pages.push(`${baseUrl}/data/${hash}/${file}`)
                }

                return App.createChapterDetails({
                    id: chapterId,
                    mangaId: mangaId,
                    pages: pages
                })
            } else {
                throw new Error('External chapter')
            }
        } catch (e) {
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
        
        const url = `${MD_API}/manga?limit=${limit}&offset=${offset}&title=${encodeURIComponent(query.title ?? '')}&includes[]=cover_art&order[relevance]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`
        
        const request = App.createRequest({
            url: url,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results: PartialSourceManga[] = []
        
        if (data.data) {
            for (const manga of data.data) {
                this.processMangaResult(manga, results)
            }
        }

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const sections = [
            App.createHomeSection({ id: 'popular', title: 'Popular', containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            App.createHomeSection({ id: 'latest', title: 'Latest Updates', containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            App.createHomeSection({ id: 'recently_added', title: 'Recently Added', containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            App.createHomeSection({ id: 'recommended', title: 'Recommended (Top Rated)', containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            App.createHomeSection({ id: 'featured', title: 'Featured (Monthly)', containsMoreItems: true, type: HomeSectionType.singleRowNormal }),
            App.createHomeSection({ id: 'self_published', title: 'Self-Published', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        ]

        // 1. Invia subito le sezioni vuote (UI immediata)
        for (const section of sections) {
            sectionCallback(section)
        }

        const baseParams = 'limit=10&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=en'

        const urls = {
            popular: `${MD_API}/manga?${baseParams}&order[followedCount]=desc`,
            latest: `${MD_API}/manga?${baseParams}&order[latestUploadedChapter]=desc`,
            recently_added: `${MD_API}/manga?${baseParams}&order[createdAt]=desc`,
            recommended: `${MD_API}/manga?${baseParams}&order[rating]=desc`,
            featured: `${MD_API}/manga?${baseParams}&order[followedCount]=desc&createdAtSince=${new Date(Date.now() - 2592000000).toISOString().slice(0, 19)}`,
            self_published: `${MD_API}/manga?${baseParams}&originalLanguage[]=en&order[createdAt]=desc`
        }

        // 2. FIX: Caricamento SEQUENZIALE per evitare Timeout
        for (const sectionId of Object.keys(urls)) {
            try {
                const url = (urls as any)[sectionId]
                const request = App.createRequest({ url: url, method: 'GET' })
                
                // Attendiamo ogni singola richiesta prima di procedere alla successiva
                const response = await this.requestManager.schedule(request, 1)
                const data = JSON.parse(response.data ?? '{}')
                
                const items: PartialSourceManga[] = []
                if (data.data) {
                    for (const manga of data.data) {
                        this.processMangaResult(manga, items)
                    }
                }
                
                const section = sections.find(s => s.id === sectionId)
                if (section) {
                    section.items = items
                    sectionCallback(section)
                }
            } catch (e) {
                console.error(`Error fetching section ${sectionId}: ${e}`)
                // Continua con la prossima sezione anche se una fallisce
            }
        }
    }
    
    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        const baseParams = `limit=${limit}&offset=${offset}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&availableTranslatedLanguage[]=en`
        
        let url = ''
        switch(homepageSectionId) {
            case 'popular':
                url = `${MD_API}/manga?${baseParams}&order[followedCount]=desc`
                break
            case 'latest':
                url = `${MD_API}/manga?${baseParams}&order[latestUploadedChapter]=desc`
                break
            case 'recently_added':
                url = `${MD_API}/manga?${baseParams}&order[createdAt]=desc`
                break
            case 'recommended':
                url = `${MD_API}/manga?${baseParams}&order[rating]=desc`
                break
            case 'featured':
                url = `${MD_API}/manga?${baseParams}&order[followedCount]=desc&createdAtSince=${new Date(Date.now() - 2592000000).toISOString().slice(0, 19)}`
                break
            case 'self_published':
                url = `${MD_API}/manga?${baseParams}&originalLanguage[]=en&order[createdAt]=desc`
                break
            default:
                return App.createPagedResults({ results: [] })
        }

        const request = App.createRequest({ url: url, method: 'GET' })
        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results: PartialSourceManga[] = []
        if (data.data) {
            for (const manga of data.data) {
                this.processMangaResult(manga, results)
            }
        }

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }

    private processMangaResult(manga: any, targetArray: PartialSourceManga[]) {
        const attr = manga.attributes
        const title = attr.title.en ?? Object.values(attr.title)[0] ?? 'Unknown'
        
        const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
        const fileName = coverRel?.attributes?.fileName
        const image = fileName ? `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` : 'https://paperback.moe/icons/logo-alt.svg'

        let subtitle = attr.status
        const availableLanguages = attr.availableTranslatedLanguages || []
        if (!availableLanguages.includes('en')) {
            subtitle = '🚫 No EN Ch.'
        }

        targetArray.push(App.createPartialSourceManga({
            mangaId: manga.id,
            image: image,
            title: title,
            subtitle: subtitle
        }))
    }
}