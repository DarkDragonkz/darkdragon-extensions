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
        let title = $('h1').first().text().trim()
        if (!title) title = $('section:has(picture)').first().attr('data-tip') ?? 'Unknown'
        
        const image = $('img[alt$=" cover"]').attr('src') ?? 'https://paperback.moe/icons/logo-alt.svg'
        
        const desc = $('.whitespace-pre-wrap').text().trim() || 'No description available'
        
        const author = $('strong:contains("Author(s)")').next().find('a').text().trim() || 'Unknown'

        // Parsing Status migliorato
        const statusStr = $('strong:contains("Status")').next('a').text().trim().toLowerCase()
        let status = 'Ongoing'
        if (statusStr.includes('complete')) status = 'Completed'
        else if (statusStr.includes('hiatus')) status = 'Hiatus'
        else if (statusStr.includes('cancel')) status = 'Completed' // Spesso usato per cancellati

        const arrayTags: Tag[] = []
        $('strong:contains("Tags(s)")').nextAll('span').each((_: any, span: any) => {
            const a = $('a', span)
            const id = a.text().trim()
            const label = a.text().trim()
            if (id) arrayTags.push({ id, label })
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
            
            // Cerchiamo il titolo nello span specifico
            let name = $(element).find('.grow span, span.font-bold').first().text().trim()
            
            if (!name) {
                const clone = $(element).clone()
                clone.find('time').remove()
                name = clone.text().trim()
            }

            // Pulizia titolo
            name = name.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, " ").trim()

            // Parsing del numero
            const numMatch = name.match(/(\d+(\.\d+)?)/g)
            const chapNum = numMatch ? parseFloat(numMatch[numMatch.length - 1] ?? '0') : 0

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
            let src = $(img).attr('src')
            if (!src) src = $(img).attr('data-src')
            
            if (src && !src.includes('logo') && !src.includes('icon')) {
                pages.push(src)
            }
        })
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        $('article, div.bg-base-100, a[href*="/series/"]').each((_: any, item: any) => {
            let linkElement = $(item)
            if (!linkElement.is('a')) {
                linkElement = $('a[href*="/series/"]', item).first()
            }
            
            const href = linkElement.attr('href')
            if (!href) return 
            
            const parts = href.split('/series/')[1]?.split('/')
            const id = parts?.[0]

            let image = $('img', item).attr('src') 
            if (!image) image = $('img', item).attr('data-src')
            if (!image) image = linkElement.find('img').attr('src')

            let title = $(item).attr('data-tip')?.trim()
            if (!title) {
                const potentialTitles: string[] = []
                $(item).find('.text-lg, .font-semibold, .font-bold, .text-white').each((_: any, el: any) => {
                    const t = $(el).text().trim()
                    if (t && t !== 'Official' && t !== 'Manga' && !t.includes('Chapter')) {
                        potentialTitles.push(t)
                    }
                })
                if (potentialTitles.length > 0) title = potentialTitles[0]
            }

            if (id && title && title !== 'Official') {
                const exists = results.some(m => m.mangaId === id)
                if (!exists) {
                    results.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image ?? '',
                        title: title,
                        subtitle: undefined
                    }))
                }
            }
        })

        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // UI IMPROVEMENT: Sezione Hot in evidenza (Featured)
        const hotSection = App.createHomeSection({
            id: 'hot_updates',
            title: 'Hot Updates 🔥',
            containsMoreItems: false,
            type: HomeSectionType.featured, // <-- Carosello grande
        })
        
        const latestSection = App.createHomeSection({
            id: 'latest_updates',
            title: 'Latest Updates 🆙',
            containsMoreItems: true,
            type: HomeSectionType.singleRowNormal,
        })

        const hotManga: PartialSourceManga[] = []
        const hotContainer = $('section:has(h2:contains("Hot Updates"))').first()
        
        $('article', hotContainer).each((_: any, manga: any) => {
            const link = $('a', manga).attr('href')
            const id = link?.split('/series/')?.[1]?.split('/')?.[0]
            
            let title = $(manga).attr('data-tip')?.trim()
            if (!title) title = $('.text-white', manga).first().text().trim()
            
            const image = $('img', manga).attr('src') ?? ''
            
            if (id && title) {
                hotManga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })
        hotSection.items = hotManga
        sectionCallback(hotSection)

        const latestManga: PartialSourceManga[] = []
        const latestContainer = $('section:has(h2:contains("Latest Updates"))').first()

        $('article', latestContainer).each((_: any, manga: any) => {
            const linkElement = $('a[href*="/series/"]', manga)
            const link = linkElement.attr('href')
            const id = link?.split('/series/')?.[1]?.split('/')?.[0]
            
            let title = $(manga).attr('data-tip')?.trim()
            if (!title) title = $('.font-semibold.text-lg', manga).text().trim()
            
            const image = $('img', manga).attr('src') ?? ''
            const chapter = $('span', manga).last().text().trim()

            if (id && title) {
                latestManga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: chapter
                }))
            }
        })
        latestSection.items = latestManga
        sectionCallback(latestSection)
    }

    isLastPage($: any): boolean {
        return $(`span:contains("View More Results...")`).length === 0
    }
}