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
    version: '1.0.3',
    name: 'MangaDex',
    icon: 'icon.png',
    author: 'DarkDragonkzz',
    authorWebsite: 'https://github.com/DarkDragonkz',
    description: 'Extension for MangaDex (API v5)',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: 'https://mangadex.org',
    sourceTags: [
        {
            text: 'MULTI-LANG',
            type: BadgeColor.BLUE,
        },
    ],
    intents: SourceIntents.MANGA_CHAPTERS | SourceIntents.HOMEPAGE_SECTIONS,
}

export class MangaDex implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    
    constructor(private cheerio: any) {}

    requestManager = App.createRequestManager({
        requestsPerSecond: 5, // MangaDex ha un rate limit di 5 req/s
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
        // Lingue di default: Italiano e Inglese
        const languages = ['it', 'en']

        const url = new URLBuilder(MD_API)
            .addPathComponent('manga')
            .addPathComponent(mangaId)
            .addPathComponent('feed')
            .addQueryParameter('limit', '500')
            .addQueryParameter('order[chapter]', 'desc')
            
        for (const lang of languages) {
            url.addQueryParameter('translatedLanguage[]', lang)
        }
            
        const request = App.createRequest({
            url: url.buildUrl(),
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const chapters: Chapter[] = []
        
        for (const chapter of data.data) {
            const attr = chapter.attributes
            if (attr.externalUrl) continue

            const lang = attr.translatedLanguage
            const chapNum = parseFloat(attr.chapter) || 0
            const title = attr.title ? `${attr.title}` : (attr.chapter ? `Chapter ${attr.chapter}` : 'Oneshot')
            
            let flag = ''
            if (lang === 'it') flag = '🇮🇹 '
            else if (lang === 'en') flag = '🇬🇧 '
            else flag = `[${lang}] `

            chapters.push(App.createChapter({
                id: chapter.id,
                name: flag + title,
                chapNum: chapNum,
                volume: parseFloat(attr.volume) || 0,
                time: new Date(attr.publishAt),
                langCode: lang
            }))
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
        
        const url = new URLBuilder(MD_API)
            .addPathComponent('manga')
            .addQueryParameter('limit', limit.toString())
            .addQueryParameter('offset', offset.toString())
            .addQueryParameter('title', query.title ?? '')
            .addQueryParameter('includes[]', 'cover_art')
            .addQueryParameter('order[relevance]', 'desc')

        const request = App.createRequest({
            url: url.buildUrl(),
            method: 'GET',
        })

        const response = await this.requestManager.schedule(request, 1)
        const data = JSON.parse(response.data ?? '{}')
        
        const results: PartialSourceManga[] = []
        
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

        return App.createPagedResults({
            results: results,
            metadata: { offset: offset + limit }
        })
    }

    async getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void> {
        const section1 = App.createHomeSection({
            id: 'popular',
            title: 'Popular on MangaDex',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })
        sectionCallback(section1)

        const section2 = App.createHomeSection({
            id: 'latest',
            title: 'Latest Updates',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal
        })
        sectionCallback(section2)

        const popularUrl = new URLBuilder(MD_API)
            .addPathComponent('manga')
            .addQueryParameter('limit', '10')
            .addQueryParameter('order[followedCount]', 'desc')
            .addQueryParameter('includes[]', 'cover_art')
            .buildUrl()
            
        const popularRequest = App.createRequest({ url: popularUrl, method: 'GET' })
        const popularResponse = await this.requestManager.schedule(popularRequest, 1)
        const popularData = JSON.parse(popularResponse.data ?? '{}')
        
        const popularItems: PartialSourceManga[] = []
        for (const manga of popularData.data) {
            const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
            const fileName = coverRel?.attributes?.fileName
            popularItems.push(App.createPartialSourceManga({
                mangaId: manga.id,
                image: fileName ? `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` : '',
                title: manga.attributes.title.en ?? Object.values(manga.attributes.title)[0] ?? 'Unknown',
                subtitle: 'Popular'
            }))
        }
        section1.items = popularItems
        sectionCallback(section1)

        const latestUrl = new URLBuilder(MD_API)
            .addPathComponent('manga')
            .addQueryParameter('limit', '10')
            .addQueryParameter('order[createdAt]', 'desc')
            .addQueryParameter('includes[]', 'cover_art')
            .buildUrl()

        const latestRequest = App.createRequest({ url: latestUrl, method: 'GET' })
        const latestResponse = await this.requestManager.schedule(latestRequest, 1)
        const latestData = JSON.parse(latestResponse.data ?? '{}')
        
        const latestItems: PartialSourceManga[] = []
        for (const manga of latestData.data) {
            const coverRel = manga.relationships.find((r: any) => r.type === 'cover_art')
            const fileName = coverRel?.attributes?.fileName
            latestItems.push(App.createPartialSourceManga({
                mangaId: manga.id,
                image: fileName ? `${MD_UPLOADS}/covers/${manga.id}/${fileName}.256.jpg` : '',
                title: manga.attributes.title.en ?? Object.values(manga.attributes.title)[0] ?? 'Unknown',
                subtitle: 'New Entry'
            }))
        }
        section2.items = latestItems
        sectionCallback(section2)
    }
    
    async getViewMoreItems(homepageSectionId: string, metadata: any): Promise<PagedResults> {
        return App.createPagedResults({ results: [] })
    }
}