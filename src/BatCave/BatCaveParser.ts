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
                    // Pulizia titolo: rimuove underscore e spazi multipli
                    let title = (chap.title || `Chapter ${chap.id}`).replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
                    
                    let time = new Date()
                    if (chap.date) {
                        const parts = chap.date.split('.')
                        if (parts.length === 3) {
                            time = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                        }
                    }

                    // --- LOGICA NUMERAZIONE POTENZIATA ---
                    let chapNum = 0
                    
                    // 1. Cerca pattern standard "Issue #123" o "Chapter 123"
                    const stdMatch = title.match(/(?:Issue|Chapter|Ch\.?|#)\s*(\d+(\.\d+)?)/i)
                    if (stdMatch) {
                        chapNum = parseFloat(stdMatch[1])
                    } 
                    // 2. Cerca pattern "Part 123" (es. Deluxe Edition Part 4)
                    else if (title.match(/(?:Part|Pt\.?)\s*(\d+(\.\d+)?)/i)) {
                        const partMatch = title.match(/(?:Part|Pt\.?)\s*(\d+(\.\d+)?)/i)
                        chapNum = parseFloat(partMatch![1])
                    }
                    // 3. Cerca pattern "Special 123"
                    else if (title.match(/(?:Special)\s*(\d+(\.\d+)?)/i)) {
                        const specialMatch = title.match(/(?:Special)\s*(\d+(\.\d+)?)/i)
                        chapNum = parseFloat(specialMatch![1])
                    }
                    // 4. Fallback: Cerca l'ultimo numero presente nel titolo (es. "Vol 3 1999")
                    else {
                        const anyNumMatch = title.match(/(\d+(\.\d+)?)/g)
                        if (anyNumMatch && anyNumMatch.length > 0) {
                             // Prende l'ultimo numero trovato, sperando sia il capitolo
                             chapNum = parseFloat(anyNumMatch[anyNumMatch.length - 1])
                        }
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
        
        // 1. Hot Comics (MODIFICATO: singleRowLarge per copertine intere)
        const hotSection = App.createHomeSection({ 
            id: 'hot', 
            title: 'Hot New Releases 🔥', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge // <-- Mostra copertina intera grande
        })
        
        const hotItems: PartialSourceManga[] = []
        $('.sect--hot .poster').each((_: any, item: any) => {
            const href = $(item).attr('href')
            const id = href?.split('/').pop()
            
            const title = $('.poster__title', item).text().trim()
            let image = $('img', item).attr('data-src') ?? $('img', item).attr('src') ?? ''
            if (image.startsWith('/')) image = BASE_URL + image

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

        // 2. Latest Comics (List)
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