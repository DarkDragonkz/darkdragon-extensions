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

const BASE_URL = 'https://xoxocomic.com'

export class XoxoComicParser {

    private getImageSrc(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'
        
        url = url.trim()
        if (url.startsWith('//')) {
            url = `https:${url}`
        } else if (url.startsWith('/')) {
            url = BASE_URL + url
        }
        
        return url
    }

    /**
     * Helper universale per parsare un blocco manga.
     * Cerca in modo "difensivo" (prova A, se fallisce prova B).
     */
    private parseMangaItem($: any, element: any): PartialSourceManga | null {
        const item = $(element)
        
        // 1. Trova il link al fumetto (fondamentale)
        // Cerca un tag <a> che contenga "/comic/" nell'href
        let link = item.find('a[href*="/comic/"]').first()
        // Se l'elemento stesso è il link
        if (item.is('a') && item.attr('href')?.includes('/comic/')) {
            link = item
        }

        const href = link.attr('href')
        // ID: Estrae l'ultima parte dell'URL (es. /comic/batman -> batman)
        const id = href?.split('/').filter(Boolean).pop()

        if (!id) return null

        // 2. Trova il Titolo
        let title = item.find('h3').text().trim()
        if (!title) title = link.text().trim()
        if (!title) title = item.find('.title, .name').text().trim() // Classi comuni alternative
        if (!title) title = 'Unknown Title'

        // 3. Trova l'immagine
        let img = item.find('img').first()
        let imageSrc = img.attr('src') || img.attr('data-src') || img.attr('data-original')
        const image = this.getImageSrc(imageSrc)

        // 4. Sottotitolo (es. Latest Chapter)
        const subtitle = item.find('.chapter').text().trim()

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle || undefined
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h2.listmanga-header').text().trim() || 'Unknown'
        
        const imageElement = $('.col-md-4 .img-responsive')
        const image = this.getImageSrc(imageElement.attr('src'))

        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'
        let desc = ''

        // Parsing Metadati
        $('.dl-horizontal dt').each((i: number, dt: any) => {
            const label = $(dt).text().toLowerCase()
            const value = $(dt).next('dd').text().trim()

            if (label.includes('author')) author = value
            if (label.includes('status')) {
                if (value.toLowerCase().includes('completed')) status = 'Completed'
            }
        })

        // Descrizione
        const descElement = $('.manga-content p')
        if (descElement.length > 0) {
            desc = descElement.text().trim()
        } else {
            desc = $('.well p').text().trim()
        }

        // Generi
        const arrayTags: Tag[] = []
        $('.dl-horizontal dd a[href*="/genre/"]').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('/').pop() ?? label
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
                desc: desc || 'No description available'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('ul.chapters li').each((_: any, li: any) => {
            const link = $('h5.chapter-title-rtl a', li)
            const title = link.text().trim()
            const href = link.attr('href')
            
            // Logica ID Capitolo
            let chapterId = href?.replace(BASE_URL, '') ?? ''
            // Rimuovi slash iniziale se presente
            if (chapterId.startsWith('/')) chapterId = chapterId.substring(1)

            if (!chapterId) return

            const dateText = $('.date-chapter-title-rtl', li).text().trim()
            let time = new Date()
            if (dateText) {
                time = new Date(dateText)
                if (isNaN(time.getTime())) time = new Date()
            }

            const numMatch = title.match(/(\d+(\.\d+)?)/)
            const chapNum = numMatch ? parseFloat(numMatch[0]) : 0

            chapters.push(App.createChapter({
                id: chapterId,
                name: title,
                chapNum: chapNum,
                time: time,
                langCode: 'en'
            }))
        })

        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        // Estrazione JS Array (Prioritaria)
        const scriptMatch = html.match(/var\s+lstImages\s*=\s*new\s+Array\((.*?)\);/)
        
        if (scriptMatch && scriptMatch[1]) {
            const urls = scriptMatch[1].split(',').map((u: string) => u.trim().replace(/['"]/g, ''))
            for (const url of urls) {
                if (url) pages.push(this.getImageSrc(url))
            }
        } else {
            // Fallback Regex su <img> tag se lo script fallisce
            const imgRegex = /<img[^>]+src="([^">]+)"[^>]+class="img-responsive"/g
            let match
            while ((match = imgRegex.exec(html)) !== null) {
                if (match[1]) pages.push(this.getImageSrc(match[1]))
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
        const seenIds = new Set<string>()

        // Cerca in TUTTI i div 'item'
        $('.item').each((_: any, item: any) => {
            const manga = this.parseMangaItem($, item)
            if (manga && !seenIds.has(manga.mangaId)) {
                seenIds.add(manga.mangaId)
                results.push(manga)
            }
        })

        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates 🆕', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })
        
        const latestItems: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // Strategia: Prendi TUTTI gli elementi .item della pagina
        // Solitamente nella home ci sono blocchi "Hot", "Latest", ecc. 
        // Se prendiamo tutto, riempiamo sicuramente la lista.
        $('.item').each((_: any, item: any) => {
            const manga = this.parseMangaItem($, item)
            if (manga && !seenIds.has(manga.mangaId)) {
                seenIds.add(manga.mangaId)
                latestItems.push(manga)
            }
        })

        latestSection.items = latestItems
        sectionCallback(latestSection)
    }
}