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

export class Parser {
    parseMangaDetails($: any, mangaId: string): SourceManga {
        // FIX: Usa attr('title') se possibile, altrimenti text().trim()
        let title = $('.name.bigger').text().trim() ?? ''
        // Se il titolo sembra duplicato o sporco, prova altri selettori
        if (!title) title = $('h1').first().text().trim()

        const imgElement = $('.thumb.mb-3.text-center img')
        let image = imgElement.attr('src') ?? ''
        
        if (!image || image.includes('loading') || image.startsWith('data:')) {
            image = imgElement.attr('data-src') ?? imgElement.attr('data-original') ?? ''
        }
        
        if (image && image.startsWith('/')) {
            image = 'https://www.mangaworld.mx' + image
        }
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        const desc = $('#noidungm').text().trim() ?? ''
        let hentai = false
        let author = ''
        let artist = ''
        
        // Parsing Autori e Artisti
        $('.meta-data .row').each((_: any, row: any) => {
            const label = $('label', row).text().toLowerCase()
            const value = $('span, a', row).text().trim()
            if (label.includes('autore')) author = value
            if (label.includes('artista')) artist = value
        })

        const arrayTags: Tag[] = []
        $('.meta-data .row').each((_: any, row: any) => {
             const label = $('label', row).text().toLowerCase()
             if(label.includes('generi')) {
                 $('a', row).each((__: any, tag: any) => {
                     const id = $(tag).attr('href')?.split('/').pop() ?? ''
                     const tagName = $(tag).text().trim()
                     if(id && tagName) arrayTags.push({id, label: tagName})
                 })
             }
        })
        
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Generi', tags: arrayTags })]
        
        // Status
        let status = 'Ongoing'
        const statusText = $('.meta-data').text().toLowerCase()
        if (statusText.includes('finito') || statusText.includes('completato')) status = 'Completed'
        if (statusText.includes('droppato')) status = 'Unknown'

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                status,
                author,
                artist,
                tags: tagSections,
                desc,
                hentai
            }),
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        // Selettore capitoli
        const arrChapters = $('.chapter').toArray()
        
        for (const item of arrChapters) {
            const link = $('a', item).first()
            const href = link.attr('href')
            const chapterId = href?.split('/').pop() // Prende l'ultimo pezzo dell'URL
            
            if (!chapterId) continue

            const title = link.attr('title') ?? link.text().trim()
            // Estrae numero capitolo e data
            const dateText = $('.chapter-release-date i', item).text().trim()
            
            // Parsing numero capitolo dal titolo (es "Capitolo 10")
            const chapNumMatch = title.match(/(\d+(\.\d+)?)/)
            let chapNum = 0
            if (chapNumMatch && chapNumMatch[1]) chapNum = parseFloat(chapNumMatch[1])

            chapters.push(App.createChapter({
                id: href, // MangaWorld usa l'URL intero come ID spesso per i redirect
                name: title,
                chapNum: chapNum,
                time: this.convertTime(dateText),
                langCode: 'it'
            }))
        }
        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // Cerca immagini nel div #page (struttura classica MW)
        $('#page img').each((_: any, img: any) => {
             let src = $(img).attr('src') || $(img).attr('data-src')
             if (src && !src.includes('loading')) {
                 if (src.startsWith('/')) src = 'https://www.mangaworld.mx' + src
                 pages.push(src.trim())
             }
        })
        
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    // FIX TITOLI DUPLICATI QUI
    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const hotSection = App.createHomeSection({ id: 'hot', title: 'Manga del Mese', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Ultimi Aggiornamenti', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const newSection = App.createHomeSection({ id: 'new', title: 'Nuove Aggiunte', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const hotItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const newItems: PartialSourceManga[] = []

        // MANGA DEL MESE (Hot)
        // Solitamente sono in .popular-manga o .owl-carousel
        const hotArr = $('.owl-carousel .entry').toArray()
        for (const item of hotArr) {
            const link = $('a', item).first()
            const id = link.attr('href')?.split('/').pop()
            const image = $('img', item).attr('src') || $('img', item).attr('data-src') || ''
            
            // FIX: Usa .attr('title') invece di .text() per evitare duplicati
            let title = link.attr('title')
            if (!title) title = $('.name', item).text().trim() // Fallback
            
            if (id && title) {
                hotItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image.startsWith('/') ? baseUrl + image : image,
                    title: title,
                    subtitle: undefined
                }))
            }
        }
        hotSection.items = hotItems
        sectionCallback(hotSection)

        // ULTIMI AGGIORNAMENTI
        const latestArr = $('.comics-grid .entry').toArray()
        for (const item of latestArr) {
            const link = $('a.thumb', item)
            const id = link.attr('href')?.split('/').pop()
            const image = $('img', item).attr('src') || $('img', item).attr('data-src') || ''
            
            // FIX: Usa attr('title')
            let title = link.attr('title') 
            // Se attr title non c'è, prova a prendere il testo ma facendo attenzione
            if (!title) title = $('.name a', item).text().trim()

            const chapter = $('.chapter-number', item).first().text().trim()

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image.startsWith('/') ? baseUrl + image : image,
                    title: title,
                    subtitle: chapter
                }))
            }
        }
        latestSection.items = latestItems
        sectionCallback(latestSection)
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const items = $('.comics-grid .entry').toArray()

        for (const item of items) {
            const link = $('a.thumb', item)
            const id = link.attr('href')?.split('/').pop()
            const image = $('img', item).attr('src') || $('img', item).attr('data-src') || ''
            
            // FIX: Usa attr('title')
            let title = link.attr('title')
            if (!title) title = $('.name a', item).text().trim()

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image.startsWith('/') ? baseUrl + image : image,
                    title: title,
                    subtitle: undefined
                }))
            }
        }
        return results
    }

    private convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed === 0 && timeAgo.includes('a')) ? 1 : trimmed
        if (timeAgo.includes('min')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('or')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('giorn')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('anno') || timeAgo.includes('anni')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        if (isNaN(time.getTime())) return new Date()
        return time
    }
}