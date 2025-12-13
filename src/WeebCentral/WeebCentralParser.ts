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
        // Logica migliorata per la descrizione: cerca vicino al titolo "Description"
        const descEl = $('p:contains("Description"), div:contains("Description")').last().next()
        if (descEl.length > 0) desc = descEl.text().trim()
        if (!desc) desc = $('p.leading-6').first().text().trim()
        
        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'

        // Parsing Metadati: Cerca le label specifiche
        $('strong, span.font-bold').each((_: any, el: any) => {
            const label = $(el).text().trim()
            // Il valore è spesso nel nodo di testo successivo o nel parent fratello
            const value = $(el).next().text().trim() || $(el).parent().next().text().trim()
            
            if (label.includes('Author')) author = value
            if (label.includes('Artist')) artist = value
            if (label.includes('Status')) status = value
        })

        // Fallback Artista se non trovato
        if (artist === 'Unknown' && author !== 'Unknown') artist = author

        if (status.toLowerCase().includes('complete')) status = 'Completed'
        if (status.toLowerCase().includes('hiatus')) status = 'Hiatus'

        // Tags
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
        
        // Cerca i link ai capitoli. WeebCentral usa /chapters/ID
        $('a[href*="/chapters/"]').each((_: any, el: any) => {
            const $el = $(el)
            const href = $el.attr('href')
            
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

            // Pulizia UI: Rimuove "Chapter 10" lasciando solo il titolo extra
            let name = titleRaw
            name = name.replace(/^(chapter|ch)\.?\s*\d+/i, '').trim()
            name = name.replace(/^[-–—:]+\s*/, '').trim()

            // Se il nome è vuoto o uguale al numero, lascia vuoto (PB metterà "Ch. X")
            if (name === String(chapNum) || name === '') name = ''

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                time: new Date(timeRaw),
                langCode: 'en'
            }))
        })

        // Sorting: Dal più recente al più vecchio
        return chapters.sort((a, b) => b.chapNum - a.chapNum)
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        $('img').each((_: any, el: any) => {
            const $img = $(el)
            let src = $img.attr('src')
            
            // Filtro immagini UI
            if (src && !src.includes('logo') && !src.includes('avatar') && !src.includes('icon')) {
                // WeebCentral usa CDN esterne spesso, accettiamo URL validi
                if (src.startsWith('http')) {
                    pages.push(src)
                }
            }
        })
        
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    // Helper per estrarre sottotitolo (Ultimo capitolo) dalle card
    private extractSubtitle($el: any): string | undefined {
        // Cerca un testo che sembri un capitolo o un orario
        // WeebCentral home cards: spesso hanno un span con "Chapter X" o "X mins ago"
        let sub = $el.find('span:contains("Chapter"), span:contains("Ch."), time').last().text().trim()
        
        // Se non trova nulla, prova a prendere l'ultimo span di testo
        if (!sub) sub = $el.find('a span').last().text().trim()
        
        return sub || undefined
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        $('a[href*="/series/"]').each((_: any, el: any) => {
            const $el = $(el)
            // Evita duplicati (container vs link testo)
            if ($el.find('img').length === 0) return 
            
            const href = $el.attr('href')
            const id = href?.split('/series/')[1]
            if (!id) return

            const image = $el.find('img').attr('src') || ''
            const title = $el.attr('aria-label') || $el.find('img').attr('alt') || 'Unknown'
            
            // UI Update: Aggiunto sottotitolo
            const subtitle = this.extractSubtitle($el.parent())

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: subtitle
            }))
        })
        
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const hotSection = App.createHomeSection({ id: 'hot', title: 'Hot Updates 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Updates 🆕', containsMoreItems: true, type: HomeSectionType.continuous })

        const hotItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        // Parsing generico delle sezioni
        // Hot Updates
        $('section:contains("Hot Updates"), section:contains("Popular")').find('a[href*="/series/"]').each((_: any, el: any) => {
            const $el = $(el)
            if ($el.find('img').length === 0) return 

            const href = $el.attr('href')
            const id = href?.split('/series/')[1]
            if (!id) return

            const image = $el.find('img').attr('src') || ''
            const title = $el.find('img').attr('alt') || 'Unknown'
            
            // UI Update: Sottotitolo
            const subtitle = this.extractSubtitle($el.parent())

            hotItems.push(App.createPartialSourceManga({
                mangaId: id, image: image, title: title, subtitle: subtitle
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
             
             // UI Update: Sottotitolo
             const subtitle = this.extractSubtitle($el.parent())
 
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