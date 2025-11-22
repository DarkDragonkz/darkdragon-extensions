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

    protected convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed === 0 && timeAgo.includes('a')) ? 1 : trimmed
        if (timeAgo.includes('min')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hour') || timeAgo.includes('ore')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('day') || timeAgo.includes('giorn')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('year') || timeAgo.includes('anni')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        if (isNaN(time.getTime())) return new Date()
        return time
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // 1. Titolo (Mobile & Desktop)
        let title = $('h3.text-lg.font-bold a').first().text().trim()
        if (!title) title = $('h3.text-2xl.font-bold a').first().text().trim()
        if (!title) title = $('h1').text().trim() || 'Unknown'
        
        // 2. Immagine
        // Cerca l'immagine nella colonna di sinistra o nell'header
        let image = $('.w-24 img, .w-52 img').first().attr('src') || ''
        if (image.startsWith('/')) image = 'https://mangapark.io' + image
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        // 3. Autore
        // Cerca link che puntano a una ricerca per autore
        const author = $('a[href*="/search?word="]').first().text().trim() || 'Unknown'

        // 4. Descrizione
        // Cerca nei blocchi di testo limitati o react-island
        let desc = $('.limit-html-p').text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') || ''
        
        const status = 'Ongoing' 

        // 5. Tags
        const arrayTags: Tag[] = []
        $('.opacity-70 span, .genres a').each((_: any, el: any) => {
            const label = $(el).text().trim().replace(/,$/, '')
            if (label && label.length > 1) arrayTags.push(App.createTag({ id: label, label: label }))
        })
        
        const tagSections: TagSection[] = [
            App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })
        ]
        
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: '',
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // FIX: Cerca nel container specifico della lista capitoli
        const chapterList = $('div[data-name="chapter-list"] .flex.border-b')
        
        chapterList.each((_: any, element: any) => {
            const row = $(element)
            const link = row.find('a').first()
            const href = link.attr('href')
            
            // L'URL è tipo: /title/386006-it-usemono-yado/8314523-vol-3-ch-18
            if (!href) return

            // Estrai l'ID del capitolo (l'ultima parte dell'URL)
            const parts = href.split('/')
            const chapterId = parts.pop() 

            if (!chapterId) return

            const title = link.text().trim()
            const timeStr = row.find('time').text().trim()
            
            // Parsing numero capitolo
            const chapNumMatch = title.match(/(?:ch|chapter|episode|c)(?:\.|apters?|\s)*\s*(\d+(\.\d+)?)/i)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1] ?? '0')
            } else {
                const simpleNums = title.match(/(\d+(\.\d+)?)/g)
                if (simpleNums && simpleNums.length > 0) {
                    chapNum = parseFloat(simpleNums[simpleNums.length - 1] ?? '0')
                }
            }

            chapters.push(App.createChapter({
                id: chapterId,
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
        
        // Cerca nello script JSON che contiene "srcs"
        const scriptContent = $('script:contains("srcs")').html()
        if (scriptContent) {
            try {
                // Estrae gli URL delle immagini
                const matches = scriptContent.match(/\"(https?:\/\/[^\"]+)\"/g)
                if (matches) {
                    matches.forEach((m: string) => {
                         const url = m.replace(/"/g, '')
                         // Filtra solo immagini vere
                         if (url.match(/\.(jpg|jpeg|png|webp)/i)) pages.push(url)
                    })
                }
            } catch (e) {
                console.error(e)
            }
        }

        // Fallback DOM (se il JSON fallisce)
        if (pages.length == 0) {
             $('img.loading-lazy, img[loading="lazy"]').each((_: any, img: any) => {
                 let src = $(img).attr('src')
                 if (src && src.startsWith('http')) pages.push(src)
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
        
        // Selettore per i risultati di ricerca (lista verticale)
        $('.flex.border-b.border-b-base-200').each((_: any, item: any) => {
            const titleLink = $('h3.font-bold a', item)
            const title = titleLink.text().trim()
            const id = titleLink.attr('href')?.split('/').pop()

            let image = $('img', item).attr('src') || ''
            if (image.startsWith('/')) image = 'https://mangapark.io' + image

            // Cerca l'ultimo capitolo o info aggiuntive
            const subtitle = $('div.flex.justify-between a', item).first().text().trim()

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

        const mangas = this.parseSearchResults($)
        
        // Popola entrambe le sezioni con i risultati trovati (poiché usiamo la search come home)
        popularSection.items = mangas
        sectionCallback(popularSection)
        
        // Per la sezione "Latest", potremmo volerla riempire dopo se facciamo una seconda chiamata,
        // ma per ora va bene così per mostrare qualcosa.
        latestSection.items = mangas
        sectionCallback(latestSection)
    }
}