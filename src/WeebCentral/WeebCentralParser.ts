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
        // Selettori più robusti: cercano l'elemento immagine principale
        // Invece di classi Tailwind complesse, usiamo attributi o gerarchia semplice
        let title = $('h1').first().text().trim()
        if (!title) title = 'Unknown Title'

        let image = $('img[alt="' + title + '"]').first().attr('src')
        if (!image) image = $('section img').first().attr('src') ?? ''
        
        let desc = ''
        // Cerca il blocco descrizione basandosi sul contenuto o sulla posizione tipica
        const descEl = $('p:contains("Description"), div:contains("Description")').last().next()
        if (descEl.length > 0) desc = descEl.text().trim()
        if (!desc) desc = $('p.leading-6').first().text().trim() // Fallback su classe generica di testo
        
        let author = 'Unknown'
        let status = 'Ongoing'

        // Parsing robusto dei metadati cercando le etichette
        $('strong, span.font-bold').each((_: any, el: any) => {
            const label = $(el).text().trim()
            const value = $(el).next().text().trim() || $(el).parent().next().text().trim()
            
            if (label.includes('Author')) author = value
            if (label.includes('Status')) status = value
        })

        if (status.toLowerCase().includes('complete')) status = 'Completed'
        if (status.toLowerCase().includes('hiatus')) status = 'Hiatus'

        // Tags
        const arrayTags: Tag[] = []
        $('a[href*="/search/data?tags="]').each((_: any, el: any) => {
            const label = $(el).text().trim()
            const id = label // WeebCentral usa il nome come ID nei filtri solitamente
            if (label) arrayTags.push({ id, label })
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: 'Unknown',
                tags: tagSections,
                desc: desc || 'No description available.'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // I capitoli sono solitamente link <a> dentro un contenitore specifico
        // L'URL contiene /chapters/
        $('a[href*="/chapters/"]').each((_: any, el: any) => {
            const $el = $(el)
            const href = $el.attr('href')
            
            // href format: https://weebcentral.com/chapters/01J...
            const chapterId = href?.split('/chapters/')[1]
            if (!chapterId) return

            const titleRaw = $el.find('span.font-bold, span').first().text().trim()
            const timeRaw = $el.find('time').attr('datetime') || new Date().toISOString()
            
            // Estrazione Numero
            const chapNumMatch = titleRaw.match(/(\d+(\.\d+)?)/)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1])
            }

            // Pulizia Nome (UI FIX)
            // Rimuove "Chapter 10" lasciando solo il titolo extra se presente
            let name = titleRaw
            name = name.replace(/^(chapter|ch)\.?\s*\d+/i, '').trim()
            name = name.replace(/^[-–—:]+\s*/, '').trim() // Rimuove separatori iniziali

            if (name === String(chapNum) || name === '') name = '' // Lascia gestire a PB "Ch. X"

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                time: new Date(timeRaw),
                langCode: 'en'
            }))
        })

        // SORTING FIX: Fondamentale
        return chapters.sort((a, b) => b.chapNum - a.chapNum)
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        // WeebCentral carica le immagini in un container, spesso img.max-w-full
        $('img').each((_: any, el: any) => {
            const $img = $(el)
            let src = $img.attr('src')
            
            // Evitiamo icone, avatar, loghi
            if (src && !src.includes('logo') && !src.includes('avatar') && !src.includes('icon')) {
                // WeebCentral usa URL completi solitamente
                if (src.includes('weebcentral') || src.includes('01J')) { // 01J è tipico degli ID immagine nuovi
                    pages.push(src)
                }
            }
        })
        
        // Fallback: se il DOM è vuoto (offuscamento), prova a cercare nei tag script (WIP logic)
        // Per ora ci fidiamo del DOM response di /images endpoint

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Risultati di ricerca WeebCentral (spesso article o div dentro un grid)
        $('a[href*="/series/"]').each((_: any, el: any) => {
            const $el = $(el)
            // Evita link duplicati (es. titolo e immagine linkano entrambi)
            if ($el.find('img').length === 0) return 
            
            const href = $el.attr('href')
            const id = href?.split('/series/')[1]
            if (!id) return

            const image = $el.find('img').attr('src') || ''
            const title = $el.attr('aria-label') || $el.find('img').attr('alt') || 'Unknown'

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        })
        
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const hotSection = App.createHomeSection({ id: 'hot', title: 'Hot Updates 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Updates 🆕', containsMoreItems: true, type: HomeSectionType.continuous })

        const hotItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        // Logica generica: cerca sezioni con titoli specifici
        // Hot Updates (spesso la prima sezione o slider)
        $('section:contains("Hot Updates"), section:contains("Popular")').find('a[href*="/series/"]').each((_: any, el: any) => {
            const $el = $(el)
            if ($el.find('img').length === 0) return 

            const href = $el.attr('href')
            const id = href?.split('/series/')[1]
            if (!id) return

            const image = $el.find('img').attr('src') || ''
            const title = $el.find('img').attr('alt') || 'Unknown'

            hotItems.push(App.createPartialSourceManga({
                mangaId: id, image: image, title: title, subtitle: undefined
            }))
        })

        // Latest Updates
        $('section:contains("Recent"), section:contains("Latest")').find('a[href*="/series/"]').each((_: any, el: any) => {
             const $el = $(el)
             if ($el.find('img').length === 0) return 
 
             const href = $el.attr('href')
             const id = href?.split('/series/')[1]
             if (!id) return
 
             const image = $el.find('img').attr('src') || ''
             const title = $el.find('img').attr('alt') || 'Unknown'
 
             latestItems.push(App.createPartialSourceManga({
                 mangaId: id, image: image, title: title, subtitle: undefined
             }))
        })

        hotSection.items = hotItems
        latestSection.items = latestItems
        
        sectionCallback(hotSection)
        sectionCallback(latestSection)
    }
}