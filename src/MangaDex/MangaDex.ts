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

import { URLBuilder } from '../helper'

const MD_API = 'https://api.mangadex.org'
const MD_UPLOADS = 'https://uploads.mangadex.org'

export const MangaDexInfo: SourceInfo = {
    version: '2.0.1', // Bump version
    name: 'MangaDex (EN)',
    icon: 'icon.png',
    author: 'DarkDragonkzz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'MangaDex source (English Only) - Fixed Pagination & Duplicates',
    contentRating: ContentRating.MATURE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'ENGLISH',
            type: BadgeColor.BLUE,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS,
}

export class MangaDex implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    
    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 4, // Abbassato leggermente per evitare rate-limit aggressivi (429)
        requestTimeout: 20000
    })

    getMangaShareUrl(mangaId: string): string {
        return `https://mangadex.org/title/${mangaId}`
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = App.createRequest({
            url: new URLBuilder(MD_API)
                .addPathComponent('manga')
                .addPathComponent(mangaId)
                .addQueryParameter('includes[]', ['author', 'artist', 'cover_art'])
                .buildUrl(),
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        const attributes = data.data.attributes
        const relationships = data.data.relationships

        const title = attributes.title.en ?? Object.values(attributes.title)[0] ?? 'Unknown Title'
        const desc = attributes.description.en ?? Object.values(attributes.description)[0] ?? ''

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
        const chapters: Chapter[] = []
        let limit = 500
        let offset = 0
        let hasMoreResults = true

        // FIX: Loop per prendere TUTTI i capitoli (Pagination fix)
        while (hasMoreResults) {
            const url = new URLBuilder(MD_API)
                .addPathComponent('manga')
                .addPathComponent(mangaId)
                .addPathComponent('feed')
                .addQueryParameter('limit', limit)
                .addQueryParameter('offset', offset)
                .addQueryParameter('translatedLanguage[]', 'en')
                .addQueryParameter('order[chapter]', 'desc') // Dal più recente al più vecchio
                .addQueryParameter('includeFutureUpdates', '0')
                .buildUrl()

            const request = App.createRequest({ url, method: 'GET' })
            const response = await this.requestManager.schedule(request, 1)
            const data = JSON.parse(response.data ?? '{}')

            if (!data.data || data.data.length === 0) {
                hasMoreResults = false
                break
            }

            for (const chapter of data.data) {
                const attr = chapter.attributes
                // Salta link esterni (es. MangaPlus) che non sono leggibili in-app
                if (attr.externalUrl) continue

                const chapNum = parseFloat(attr.chapter) || 0
                
                let title = ''
                if (attr.title) title = attr.title
                else if (attr.chapter) title = `Chapter ${attr.chapter}`
                else title = 'Oneshot'

                // FIX: De-duplicazione semplice
                // Controlliamo se abbiamo già inserito questo numero di capitolo.
                // Dato che l'API ci dà prima i più recenti (order[chapter]=desc) e poi per data di upload,
                // se troviamo un duplicato significa che è una versione alternativa o più vecchia dello stesso gruppo.
                // Per ora, saltiamo i duplicati per avere una lista pulita.
                const isDuplicate = chapters.some(c => c.chapNum === chapNum && c.chapNum !== 0) // 0 = Oneshot, di solito non li filtriamo
                if (!isDuplicate || chapNum === 0) {
                     chapters.push(App.createChapter({
                        id: chapter.id,
                        name: title,
                        chapNum: chapNum,
                        volume: parseFloat(attr.volume) || 0,
                        time: new Date(attr.publishAt),
                        langCode: 'en'
                    }))
                }
            }

            if (data.total && (offset + limit) >= data.total) {
                hasMoreResults = false
            } else {
                offset += limit
            }
        }

        return chapters
    }

    async getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails> {
        const request = App.createRequest({
            url: `${MD_API}/at-home/server/${chapterId}`,
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
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
    }

    async getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults> {
        const limit = 20
        const offset = metadata?.offset ?? 0
        
        const urlBuilder = new URLBuilder(MD_API)
            .addPathComponent('manga')
            .addQueryParameter('limit', limit)
            .addQueryParameter('offset', offset)
            .addQueryParameter('title', query.title ?? '')
            .addQueryParameter('includes[]', 'cover_art')
            .addQueryParameter('order[relevance]', 'desc')
            // Includiamo i rating per trovare tutto
            .addQueryParameter('contentRating[]', ['safe', 'suggestive', 'erotica', 'pornographic'])

        const request = App.createRequest({
            url: urlBuilder.buildUrl(),
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results: PartialSourceManga[] = []
        
        if (data.data) {
            for (const manga of data.data) {
                const attr = manga.attributes
                const title = attr.title.en ?? Object.values(attr.title)[0] ?? 'Unknown'
                
                const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
                const fileName = coverRel?.attributes?.fileName
                const image = fileName ? `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` : 'https://paperback.moe/icons/logo-alt.svg'

                results.push(App.createPartialSourceManga({
                    mangaId: manga.id,
                    image: image,
                    title: title,
                    subtitle: attr.status
                }))
            }
        }

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const section1 = App.createHomeSection({
            id: 'popular',
            title: 'Popular (English Available)',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })
        const section2 = App.createHomeSection({
            id: 'latest',
            title: 'Latest English Updates',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })
        
        // Callback immediata per mostrare le sezioni vuote mentre caricano
        sectionCallback(section1)
        sectionCallback(section2)
        
        const ratings = ['safe', 'suggestive', 'erotica']

        // --- POPULAR ---
        const popularRequest = App.createRequest({
            url: new URLBuilder(MD_API)
                .addPathComponent('manga')
                .addQueryParameter('limit', 10)
                .addQueryParameter('order[followedCount]', 'desc')
                .addQueryParameter('includes[]', 'cover_art')
                .addQueryParameter('availableTranslatedLanguage[]', 'en')
                .addQueryParameter('contentRating[]', ratings)
                .buildUrl(),
            method: 'GET'
        })

        const popularResponse = await this.requestManager.schedule(popularRequest, 1)
        const popularData = JSON.parse(popularResponse.data ?? '{}')
        
        const popularItems: PartialSourceManga[] = []
        if (popularData.data) {
            for (const manga of popularData.data) {
                const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
                const fileName = coverRel?.attributes?.fileName
                popularItems.push(App.createPartialSourceManga({
                    mangaId: manga.id,
                    image: fileName ? `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` : 'https://paperback.moe/icons/logo-alt.svg',
                    title: manga.attributes.title.en ?? Object.values(manga.attributes.title)[0] ?? 'Unknown',
                    subtitle: 'Popular'
                }))
            }
        }
        section1.items = popularItems
        sectionCallback(section1)

        // --- LATEST ---
        // FIX: Usiamo order[latestUploadedChapter] invece di createdAt
        const latestRequest = App.createRequest({
            url: new URLBuilder(MD_API)
                .addPathComponent('manga')
                .addQueryParameter('limit', 10)
                .addQueryParameter('order[latestUploadedChapter]', 'desc') 
                .addQueryParameter('includes[]', 'cover_art')
                .addQueryParameter('availableTranslatedLanguage[]', 'en')
                .addQueryParameter('contentRating[]', ratings)
                .buildUrl(),
            method: 'GET'
        })

        const latestResponse = await this.requestManager.schedule(latestRequest, 1)
        const latestData = JSON.parse(latestResponse.data ?? '{}')
        
        const latestItems: PartialSourceManga[] = []
        if (latestData.data) {
            for (const manga of latestData.data) {
                const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
                const fileName = coverRel?.attributes?.fileName
                latestItems.push(App.createPartialSourceManga({
                    mangaId: manga.id,
                    image: fileName ? `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` : 'https://paperback.moe/icons/logo-alt.svg',
                    title: manga.attributes.title.en ?? Object.values(manga.attributes.title)[0] ?? 'Unknown',
                    subtitle: 'New Update'
                }))
            }
        }
        section2.items = latestItems
        sectionCallback(section2)
    }
    
    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        return App.createPagedResults({ results: [] })
    }
}