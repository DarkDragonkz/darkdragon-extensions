import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    PartialSourceManga,
    SourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

export class WeebCentralParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h1').first().text().trim()
        const image = $('img[alt$=" cover"]').attr('src') ?? 'https://paperback.moe/icons/logo-alt.svg'
        const desc = $('strong:contains("Description")').next('p').text().trim()
        const author = $('strong:contains("Author(s)")').next().find('a').text().trim()

        const statusStr = $('strong:contains("Status")').next('a').text().trim()
        let status = 'Unknown'
        if (statusStr.toLowerCase().includes('ongoing')) status = 'Ongoing'
        else if (statusStr.toLowerCase().includes('complete')) status = 'Completed'

        const arrayTags: Tag[] = []
        $('strong:contains("Tags(s)")').nextAll('span').each((_: any, span: any) => {
            const a = $('a', span)
            const id = a.text().trim()
            const label = a.text().trim()
            arrayTags.push({ id, label })
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags.map((x) => App.createTag(x)) })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('a[href*="/chapters/"]').each((_: any, element: any) => {
            const href = $(element).attr('href')
            const id = href?.split('/chapters/')[1]
            
            const chapterTextSpan = $(element).find('span.grow span').first()
            const name = chapterTextSpan.text().trim() 
            
            const numMatch = name.match(/(\d+(\.\d+)?)/)
            const chapNum = numMatch ? parseFloat(numMatch[0]) : 0

            const timeStr = $(element).find('time').attr('datetime')
            const time = timeStr ? new Date(timeStr) : new Date()

            if (id) {
                chapters.push(App.createChapter({
                    id: id,
                    name: name,
                    chapNum: chapNum,
                    langCode: 'en',
                    time: time
                }))
            }
        })

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        $('img').each((_: any, img: any) => {
            const src = $(img).attr('src')
            if (src) pages.push(src)
        })

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        $('article').each((_: any, article: any) => {
            const link = $('a', article).attr('href')
            const id = link?.split('/series/')?.[1]?.split('/')?.[0]
            
            let title = $('.font-semibold', article).text().trim()
            if (!title) title = $('.text-white', article).text().trim()
            
            const image = $('img', article).attr('src') ?? ''

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })

        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const hotSection = App.createHomeSection({
            id: 'hot_updates',
            title: 'Hot Updates',
            containsMoreItems: false,
            type: HomeSectionType.singleRowNormal,
        })
        
        const latestSection = App.createHomeSection({
            id: 'latest_updates',
            title: 'Latest Updates',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal,
        })

        // --- 1. Parsing HOT UPDATES ---
        const hotManga: PartialSourceManga[] = []
        
        // Strategia più robusta: Trova l'H2 che contiene il testo, poi prendi la sezione successiva
        const hotHeader = $('h2').filter((_: any, el: any) => $(el).text().includes('Hot Updates')).first()
        const hotContainer = hotHeader.next('section')
        
        $('article', hotContainer).each((_: any, manga: any) => {
            const link = $('a', manga).attr('href')
            const id = link?.split('/series/')?.[1]?.split('/')?.[0]
            const title = $('.text-white.text-center.text-lg', manga).first().text().trim()
            const image = $('img', manga).attr('src')
            
            if (id && title) {
                hotManga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image ?? '',
                    title: title,
                    subtitle: undefined
                }))
            }
        })
        hotSection.items = hotManga
        sectionCallback(hotSection)


        // --- 2. Parsing LATEST UPDATES ---
        const latestManga: PartialSourceManga[] = []
        
        // Stessa strategia robusta
        const latestHeader = $('h2').filter((_: any, el: any) => $(el).text().includes('Latest Updates')).first()
        const latestContainer = latestHeader.next('section')

        $('article', latestContainer).each((_: any, manga: any) => {
            const linkElement = $('a[href*="/series/"]', manga)
            const link = linkElement.attr('href')
            const id = link?.split('/series/')?.[1]?.split('/')?.[0]
            const title = $('.font-semibold.text-lg', manga).text().trim()
            const image = $('img', manga).attr('src')
            const chapter = $('span', manga).last().text().trim()

            if (id && title) {
                latestManga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image ?? '',
                    title: title,
                    subtitle: chapter
                }))
            }
        })
        latestSection.items = latestManga
        sectionCallback(latestSection)
    }
}