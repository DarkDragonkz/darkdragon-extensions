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

export class MangaParkITParser {

    // Helper per convertire le date relative (es. "2 days ago")
    protected convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed === 0 && timeAgo.includes('a')) ? 1 : trimmed
        if (timeAgo.includes('min')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hour')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('day')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('year')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        if (isNaN(time.getTime())) return new Date()
        return time
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Nota: Senza l'HTML specifico della pagina dettagli, usiamo selettori generici di MP v5
        // che solitamente condividono le classi con la ricerca o sono standard.
        const title = $('h3 a').first().text().trim() || $('h1').text().trim() || 'Unknown'
        
        let image = $('img').attr('src') || ''
        if (image.startsWith('/')) image = 'https://mangapark.io' + image

        const author = $('.opacity-80 a').first().text().trim() || 'Unknown'
        const desc = $('.limit-height-body').text().trim() || 'No description available'
        const status = 'Ongoing' // MP status is tricky to parse without specific HTML

        const arrayTags: Tag[] = []
        // I tag spesso sono in span/a con classi specifiche
        $('.opacity-70 span, .genres a').each((_: any, el: any) => {
            const label = $(el).text().trim().replace(/,$/, '')
            if (label) arrayTags.push({ id: label, label: label })
        })
        
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: '',
                tags: [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })],
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // MangaPark v5 carica spesso i capitoli via JSON o API. 
        // Tuttavia, se sono presenti nel DOM (SSR), usiamo questo selettore.
        // Cerchiamo link che sembrano capitoli
        $('a[href*="/chapter/"]').each((_: any, obj: any) => {
            const link = $(obj)
            const href = link.attr('href')
            // L'ID del capitolo è l'ultima parte dell'URL o l'intero URL
            const id = href?.split('/').pop() || href

            if (!id) return

            const title = link.text().trim()
            const timeStr = link.find('time').text().trim()
            
            // Estrazione numero capitolo
            const chapNumMatch = title.match(/(\d+(\.\d+)?)/)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[0]) : 0

            chapters.push(App.createChapter({
                id: id,
                name: title,
                chapNum: chapNum,
                time: this.convertTime(timeStr),
                langCode: 'it'
            }))
        })

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // MP v5 usa spesso uno script JSON per le immagini. Cerchiamo quello.
        const scriptContent = $('script:contains("srcs")').html()
        if (scriptContent) {
            try {
                // Estrazione brutale delle URL dal JS se possibile
                const matches = scriptContent.match(/\"(https?:\/\/[^\"]+)\"/g)
                if (matches) {
                    matches.forEach((m: string) => {
                         const url = m.replace(/"/g, '')
                         if (url.match(/\.(jpg|jpeg|png|webp)/i)) pages.push(url)
                    })
                }
            } catch (e) {
                console.error(e)
            }
        }

        // Fallback: Cerca immagini nel DOM
        if (pages.length == 0) {
             $('img[loading="lazy"]').each((_: any, img: any) => {
                 let src = $(img).attr('src')
                 if (src) pages.push(src)
             })
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Basato sull'HTML fornito: div.flex.border-b.border-b-base-200
        $('.flex.border-b.border-b-base-200').each((_: any, item: any) => {
            const titleLink = $('h3.font-bold a', item)
            const title = titleLink.text().trim()
            // ID: /title/386006-it-usemono-yado -> 386006-it-usemono-yado
            const id = titleLink.attr('href')?.split('/').pop()

            let image = $('img', item).attr('src') || ''
            if (image.startsWith('/')) image = 'https://mangapark.io' + image

            // Sottotitolo: Ultimo capitolo
            const subtitle = $('div.flex.flex-nowrap.justify-between a', item).first().text().trim()

            if (id && title) {
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
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popolari in Italia', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Aggiornamenti Recenti (IT)', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        // Usiamo la stessa logica di parsing della ricerca per popolare le sezioni
        // dato che la pagina di ricerca è usata come "Home" filtrata
        const mangas = this.parseSearchResults($)
        
        popularSection.items = mangas
        sectionCallback(popularSection)
        
        // Per il "latest", potremmo idealmente fare una seconda chiamata con sort diverso,
        // ma per ora popoliamo con gli stessi dati o lasciamo vuoto se vogliamo fare chiamate separate nel main
    }
}