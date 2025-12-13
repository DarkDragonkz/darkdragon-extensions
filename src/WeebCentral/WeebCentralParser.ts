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
        // Analisi basata su MangaDetails.txt.txt
        let title = $('h1').text().trim()
        if (!title) title = 'Unknown Title'

        // Immagine: Cerca l'immagine che ha come alt il titolo o fallback
        let image = $('img[alt="' + title + '"]').attr('src')
        if (!image) image = $('img[src*="/cover/"]').first().attr('src') ?? ''

        // Descrizione: Trovata in <p class="leading-6">
        let desc = $('p.leading-6').text().trim()
        if (!desc) desc = 'No description available.'

        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'

        // Metadati: Trovati in <ul class="flex flex-col gap-4"> con <strong>Label:</strong>
        $('strong').each((_: any, el: any) => {
            const label = $(el).text().trim()
            const parent = $(el).parent() // Il genitore contiene il valore
            
            // Il valore è spesso dentro un tag <a> o span subito dopo lo strong
            const valueText = parent.find('a, span').map((i: number, e: any) => $(e).text().trim()).get().join(', ')
            
            if (label.includes('Author')) author = valueText || author
            if (label.includes('Artist')) artist = valueText || artist
            if (label.includes('Status')) status = valueText || status
        })

        // Normalizzazione Stato
        if (status.toLowerCase().includes('complete')) status = 'Completed'
        if (status.toLowerCase().includes('hiatus')) status = 'Hiatus'
        if (status.toLowerCase().includes('canceled')) status = 'Cancelled'

        // Tags: Link che contengono "tags="
        const arrayTags: Tag[] = []
        $('a[href*="tags="]').each((_: any, el: any) => {
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
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Analisi basata sui link capitolo visibili in MangaDetails.txt
        // Struttura: <a href="/chapters/ID" ...> <span class="font-bold">Chapter X</span> ... </a>
        $('a[href*="/chapters/"]').each((_: any, el: any) => {
            const $el = $(el)
            const href = $el.attr('href')
            
            const chapterId = href?.split('/chapters/')[1]
            if (!chapterId) return

            // Titolo: "Chapter 1134"
            const titleRaw = $el.find('span.font-bold, span.grow').first().text().trim()
            
            // Data: <time datetime="...">
            const timeRaw = $el.find('time').attr('datetime')
            const time = timeRaw ? new Date(timeRaw) : new Date()

            // Estrazione Numero
            const chapNumMatch = titleRaw.match(/(\d+(\.\d+)?)/)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1])
            }

            // Pulizia Nome per UI
            let name = titleRaw
            name = name.replace(/^(chapter|ch)\.?\s*\d+/i, '').trim()
            name = name.replace(/^[-–—:]+\s*/, '').trim()

            // Se rimane vuoto o è solo il numero, lascia vuoto (PB metterà "Ch. X")
            if (name === String(chapNum) || name === '') name = ''

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                time: time,
                langCode: 'en'
            }))
        })

        return chapters.sort((a, b) => b.chapNum - a.chapNum)
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        // In WeebCentral le immagini sono solitamente dirette nel body response di /images
        $('img').each((_: any, el: any) => {
            const $img = $(el)
            let src = $img.attr('src')
            
            // Filtri robusti per evitare icone interfaccia
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

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Analisi basata su Search.txt
        // <a href="https://weebcentral.com/series/ID" ...>
        $('a[href*="/series/"]').each((_: any, el: any) => {
            const $el = $(el)
            // Filtro per evitare link testuali duplicati, prendiamo solo le card con immagini
            const img = $el.find('img').first()
            if (img.length === 0) return 
            
            const href = $el.attr('href')
            const id = href?.split('/series/')[1]
            if (!id) return

            const image = img.attr('src') || ''
            const title = img.attr('alt') || 'Unknown'

            // Sottotitolo: Nel file Search.txt c'è "31 Chapters" o simile
            // Cerchiamo uno span che contiene testo generico
            let subtitle = undefined
            const chaptersText = $el.text().match(/(\d+)\s+Chapters?/i)
            if (chaptersText) {
                subtitle = `${chaptersText[1]} Chapters`
            }

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
        const recentSection = App.createHomeSection({ id: 'latest', title: 'Recent Updates 🆕', containsMoreItems: true, type: HomeSectionType.continuous })

        const hotItems: PartialSourceManga[] = []
        const recentItems: PartialSourceManga[] = []

        // Analisi basata su Homepage.txt
        
        // 1. Hot Updates (Sezione con titolo "Hot Updates")
        // Cerchiamo la section che contiene questo testo h2
        const hotContainer = $('section:has(h2:contains("Hot Updates"))')
        hotContainer.find('a[href*="/series/"]').each((_: any, el: any) => {
            const $el = $(el)
            const img = $el.find('img').first()
            if (img.length === 0) return

            const id = $el.attr('href')?.split('/series/')[1]
            if (!id) return

            const title = img.attr('alt')
            const image = img.attr('src')
            
            // Sottotitolo: C'è uno span con "Chapter 1134" visibile nel txt
            const subtitle = $el.find('span:contains("Chapter")').first().text().trim()

            hotItems.push(App.createPartialSourceManga({
                mangaId: id, image: image, title: title, subtitle: subtitle
            }))
        })

        // 2. Recent Updates (Sezione con titolo "Recent Updates")
        const recentContainer = $('section:has(h2:contains("Recent Updates"))')
        recentContainer.find('a[href*="/series/"]').each((_: any, el: any) => {
            const $el = $(el)
            // In Recent Updates, la card è un blocco che contiene l'immagine
            const img = $el.find('img').first()
            if (img.length === 0) return

            const id = $el.attr('href')?.split('/series/')[1]
            if (!id) return

            const title = img.attr('alt')
            const image = img.attr('src')
            
            // Sottotitolo: Capitolo e Tempo
            const chapterText = $el.find('span:contains("Chapter")').first().text().trim()
            const timeText = $el.text().match(/(\d+\s+(min|hour|day)s?\s+ago)/i)?.[1]
            
            let subtitle = chapterText
            if (timeText) subtitle = `${chapterText} • ${timeText}`

            recentItems.push(App.createPartialSourceManga({
                mangaId: id, image: image, title: title, subtitle: subtitle
            }))
        })

        hotSection.items = hotItems
        recentSection.items = recentItems
        
        sectionCallback(hotSection)
        sectionCallback(recentSection)
    }
}