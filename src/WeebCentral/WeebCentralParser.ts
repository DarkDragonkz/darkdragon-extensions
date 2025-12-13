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

export class WeebCentralParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1').first().text().trim()
        if (!title) title = 'Unknown Title'

        // Cerca l'immagine usando alt, fallback alla prima immagine della section
        let image = $('img[alt="' + title + '"]').first().attr('src')
        if (!image) image = $('section img').first().attr('src') ?? ''
        
        let desc = ''
        // Cerca descrizione in modo flessibile
        const descEl = $('p:contains("Description"), div:contains("Description")').last().next()
        if (descEl.length > 0) desc = descEl.text().trim()
        if (!desc) desc = $('p.leading-6').first().text().trim()
        
        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'

        // Parsing Metadati
        $('strong, span.font-bold').each((_: any, el: any) => {
            const label = $(el).text().trim()
            const value = $(el).next().text().trim() || $(el).parent().next().text().trim()
            
            if (label.includes('Author')) author = value
            if (label.includes('Artist')) artist = value
            if (label.includes('Status')) status = value
        })

        if (artist === 'Unknown' && author !== 'Unknown') artist = author

        if (status.toLowerCase().includes('complete')) status = 'Completed'
        if (status.toLowerCase().includes('hiatus')) status = 'Hiatus'
        if (status.toLowerCase().includes('cancel')) status = 'Cancelled'

        const arrayTags: Tag[] = []
        $('a[href*="/search/data?tags="]').each((_: any, el: any) => {
            const label = $(el).text().trim()
            if (label) arrayTags.push({ id: label, label: label })
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
                desc: desc || 'No description available.'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('a[href*="/chapters/"]').each((_: any, el: any) => {
            const $el = $(el)
            const href = $el.attr('href')
            
            const chapterId = href?.split('/chapters/')[1]
            if (!chapterId) return

            const titleRaw = $el.find('span.font-bold, span.grow').first().text().trim()
            const timeRaw = $el.find('time').attr('datetime') || new Date().toISOString()
            
            const chapNumMatch = titleRaw.match(/(\d+(\.\d+)?)/)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1])
            }

            let name = titleRaw
            name = name.replace(/^(chapter|ch)\.?\s*\d+/i, '').trim()
            name = name.replace(/^[-–—:]+\s*/, '').trim()

            if (name === String(chapNum) || name === '') name = ''

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                time: new Date(timeRaw),
                langCode: 'en'
            }))
        })

        return chapters.sort((a, b) => b.chapNum - a.chapNum)
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        $('img').each((_: any, el: any) => {
            const $img = $(el)
            let src = $img.attr('src')
            
            if (src && src.startsWith('http') && !src.includes('logo') && !src.includes('icon')) {
                pages.push(src)
            }
        })
        
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    // Helper per estrarre sottotitolo (Ultimo capitolo)
    private extractSubtitle($el: any): string | undefined {
        // Cerca elementi che sembrano capitoli
        let sub = $el.find('span:contains("Chapter"), span:contains("Ch."), time').first().text().trim()
        
        // Se c'è una data relativa (es "2 hours ago"), usala
        if (!sub) {
             const time = $el.find('time').text().trim()
             if (time) sub = time
        }
        
        return sub || undefined
    }

    // Helper per pulire titoli sporchi (es "One Piece Cover")
    private cleanTitle(title: string): string {
        return title
            .replace(/\s+Cover$/i, '')
            .replace(/\s+Poster$/i, '')
            .replace(/\s+Scan$/i, '')
            .trim()
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Cerca qualsiasi blocco che contenga un link a /series/ e un'immagine
        // Questo è più generico e cattura sia griglie che liste
        $('a[href*="/series/"]').each((_: any, el: any) => {
            const $el = $(el)
            const img = $el.find('img').first()
            
            // Se non c'è immagine nel link diretto, cerchiamo nel genitore (card layout)
            let image = img.attr('src')
            if (!image) {
                // Caso: Link testuale, cerchiamo l'immagine nel contenitore padre
                image = $el.closest('article, div').find('img').first().attr('src')
            }
            if (!image) return // Se proprio non c'è immagine, saltiamo

            const href = $el.attr('href')
            const id = href?.split('/series/')[1]
            if (!id) return

            let title = img.attr('alt') || $el.text().trim() || 'Unknown'
            title = this.cleanTitle(title)

            // Cerchiamo un sottotitolo nel genitore
            const subtitle = this.extractSubtitle($el.closest('article, div'))

            // Evita duplicati (stesso ID aggiunto più volte)
            if (!results.find(r => r.mangaId === id)) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const hotSection = App.createHomeSection({ id: 'hot', title: 'Hot Updates 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Recent Updates 🆕', containsMoreItems: true, type: HomeSectionType.continuous })

        const hotItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        // 1. HOT UPDATES
        // Cerchiamo la sezione Hot specificamente
        const hotContainer = $('section:contains("Hot Updates"), section:contains("Popular")').first()
        
        hotContainer.find('a[href*="/series/"]').each((_: any, el: any) => {
            const $el = $(el)
            const img = $el.find('img').first()
            if (img.length === 0) return 

            const id = $el.attr('href')?.split('/series/')[1]
            if (!id) return

            let title = img.attr('alt') || 'Unknown'
            title = this.cleanTitle(title)
            
            const image = img.attr('src') || ''
            
            // In Hot Updates, il sottotitolo potrebbe essere nascosto o diverso
            const subtitle = this.extractSubtitle($el.parent())

            hotItems.push(App.createPartialSourceManga({
                mangaId: id, image: image, title: title, subtitle: subtitle
            }))
        })

        // 2. RECENT UPDATES
        // Selettore più aggressivo: prendiamo tutti i link series che NON sono nella hot section
        // Oppure cerchiamo specificamente la seconda grande griglia
        
        // Proviamo a identificare la sezione Recent
        let recentContainer = $('section:contains("Recent"), section:contains("Latest")').first()
        
        // Se non la trova per testo, prendiamo "tutto il resto"
        if (recentContainer.length === 0) {
             // Fallback: cerca tutti i link series nella pagina principale
             recentContainer = $('body')
        }

        recentContainer.find('a[href*="/series/"]').each((_: any, el: any) => {
             const $el = $(el)
             
             // Evita di ri-aggiungere gli item della Hot Section
             const href = $el.attr('href')
             const id = href?.split('/series/')[1]
             if (!id) return
             if (hotItems.find(x => x.mangaId === id)) return // Skip duplicati Hot

             // Logica immagine/titolo
             let image = $el.find('img').attr('src')
             let title = $el.find('img').attr('alt')
             
             // Caso speciale: Recent Updates spesso è una lista testo + immagine piccola
             if (!image) {
                 image = $el.closest('div').find('img').first().attr('src')
             }
             if (!title) {
                 title = $el.closest('div').find('a.font-bold, a.text-white').first().text().trim()
             }
             
             if (!image) return // Se ancora niente immagine, salta

             title = this.cleanTitle(title || 'Unknown')
             
             const subtitle = this.extractSubtitle($el.closest('div, tr'))

             latestItems.push(App.createPartialSourceManga({
                 mangaId: id, image: image, title: title, subtitle: subtitle
             }))
        })

        hotSection.items = hotItems
        latestSection.items = latestItems
        
        sectionCallback(hotSection)
        sectionCallback(latestSection)
    }
}