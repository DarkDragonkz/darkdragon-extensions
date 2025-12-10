import {
    Chapter,
    ChapterDetails,
    HomeSection,
    HomeSectionType,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

const BASE_URL = 'https://batcave.biz'

export class BatCaveParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h1.main-page-title').text().trim() || $('h1').first().text().trim() || 'Unknown'
        
        let image = $('.page__poster img').attr('src') ?? ''
        if (image.startsWith('/')) image = BASE_URL + image

        let desc = $('.page__text').text().trim()
        
        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'

        $('.page__list li').each((_: any, li: any) => {
            const text = $(li).text().trim()
            if (text.includes('Writer:')) {
                author = text.replace('Writer:', '').trim()
            } else if (text.includes('Artist:')) {
                artist = text.replace('Artist:', '').trim()
            } else if (text.includes('Release type:')) {
                const type = text.replace('Release type:', '').trim().toLowerCase()
                if (type.includes('completed')) status = 'Completed'
            }
        })

        const arrayTags: Tag[] = []
        $('.page__tags a').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('/').filter(Boolean).pop() ?? label
            if (label) arrayTags.push(App.createTag({ id, label }))
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: artist,
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters(html: string): Chapter[] {
        const chapters: Chapter[] = []
        
        const scriptData = html.match(/window\.__DATA__\s*=\s*({.*?});/s)
        if (!scriptData) return []

        try {
            const data = JSON.parse(scriptData[1])
            if (data.chapters && Array.isArray(data.chapters)) {
                for (const chap of data.chapters) {
                    const id = String(chap.id)
                    
                    let title = (chap.title || `Chapter ${chap.id}`).replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
                    
                    let time = new Date()
                    if (chap.date) {
                        const parts = chap.date.split('.')
                        if (parts.length === 3) {
                            time = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                        }
                    }

                    // Ordine basato sulla posizione nel sito
                    let chapNum = 0
                    if (chap.posi) {
                        chapNum = parseFloat(chap.posi)
                    } else {
                        const numMatch = title.match(/#(\d+(\.\d+)?)/)
                        chapNum = numMatch ? parseFloat(numMatch[1]) : 0
                    }

                    chapters.push(App.createChapter({
                        id: id,
                        name: title,
                        chapNum: chapNum,
                        time: time,
                        langCode: 'en'
                    }))
                }
            }
        } catch (e) {
            console.log(`Error parsing chapters JSON: ${e}`)
        }

        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        const scriptData = html.match(/window\.__DATA__\s*=\s*({.*?});/s)
        
        if (scriptData) {
            try {
                const data = JSON.parse(scriptData[1])
                if (data.images && Array.isArray(data.images)) {
                    for (const img of data.images) {
                         if (img && !img.includes('logo') && !img.includes('icon')) {
                             pages.push(img)
                         }
                    }
                }
            } catch (e) {
                console.log(`Error parsing images JSON: ${e}`)
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []

        $('.readed').each((_: any, item: any) => {
            const link = $('a.readed__img', item)
            const href = link.attr('href')
            const id = href?.split('/').pop() 
            
            const title = $('.readed__title a', item).text().trim()
            let image = $('img', link).attr('data-src') ?? $('img', link).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

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
        
        // 1. Hot Comics -> singleRowNormal (Copertina Intera NON schiacciata)
        const hotSection = App.createHomeSection({ 
            id: 'hot', 
            title: 'Hot New Releases 🔥', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        
        const hotItems: PartialSourceManga[] = []
        $('.sect--hot .poster').each((_: any, item: any) => {
            const href = $(item).attr('href')
            const id = href?.split('/').pop()
            
            const title = $('.poster__title', item).text().trim()
            let image = $('img', item).attr('data-src') ?? $('img', item).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

            // FIX: Alta qualità
            image = image.replace('/mini/64x96/', '/mini/142x212/')
            image = image.replace('/mini/131x196/', '/mini/142x212/')

            if (id && title) {
                hotItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        })
        hotSection.items = hotItems
        sectionCallback(hotSection)

        // 2. Latest Comics -> singleRowNormal (Copertina Intera NON schiacciata)
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Newest Releases 🆙', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowNormal
        })

        const latestItems: PartialSourceManga[] = []
        $('.sect--latest .latest').each((_: any, item: any) => {
            const link = $('a.latest__img', item)
            const href = link.attr('href')
            const id = href?.split('/').pop()
            
            let image = $('img', link).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image
            
            // FIX: Alta qualità
            image = image.replace('/mini/64x96/', '/mini/142x212/')
            
            const title = $('.latest__title a', item).text().trim()
            const chapter = $('.latest__chapter a', item).text().trim().split('-')[1]?.trim() ?? ''

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: chapter
                }))
            }
        })
        latestSection.items = latestItems
        sectionCallback(latestSection)
    }
}