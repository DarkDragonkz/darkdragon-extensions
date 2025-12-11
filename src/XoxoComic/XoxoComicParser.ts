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
        if (!url || url.includes('logo') || url.includes('placeholder')) return 'https://paperback.moe/icons/logo-alt.svg'
        if (url.startsWith('data:')) return 'https://paperback.moe/icons/logo-alt.svg' // Evita base64 vuoti
        
        url = url.trim()
        if (url.startsWith('//')) {
            url = `https:${url}`
        } else if (url.startsWith('/')) {
            url = BASE_URL + url
        }
        
        return url
    }

    /**
     * Helper universale per parsare un blocco manga (Home/Search/ViewMore).
     */
    parseMangaItem($: any, element: any): PartialSourceManga | null {
        const item = $(element)
        
        // Cerca il link principale
        let link = item.find('a').first()
        // Fallback: cerca link nel titolo h3
        if (!link.attr('href')) link = item.find('h3 a').first()

        const href = link.attr('href')
        // ID: Estrae l'ultima parte dell'URL
        const id = href?.split('/').filter((p: string) => p && p !== 'comic' && p !== 'xoxocomic.com').pop()

        if (!id) return null

        let title = item.find('h3').text().trim()
        if (!title) title = link.attr('title') || link.text().trim()
        if (!title) title = 'Unknown Title'

        // Immagine: Cerca data-original, src, o style background
        let img = item.find('img').first()
        let imageSrc = img.attr('data-original') || img.attr('data-src') || img.attr('src')
        
        // Fix per layout che usano background-image
        if (!imageSrc || imageSrc.startsWith('data:')) {
            const style = item.find('.div-poster, .image').attr('style')
            const match = style?.match(/url\(['"]?(.*?)['"]?\)/)
            if (match) imageSrc = match[1]
        }

        const image = this.getImageSrc(imageSrc)
        
        // Sottotitolo (Capitolo)
        const subtitle = item.find('.chapter a').first().text().trim()

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle || undefined
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Titolo
        let title = $('.title-detail').text().trim()
        if (!title) title = $('h1').first().text().trim()
        
        // Immagine Cover
        const imageSrc = $('.col-image img').attr('src')
        const image = this.getImageSrc(imageSrc)

        // Descrizione
        let desc = $('.detail-content p').first().text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') ?? 'No description'

        let author = 'Unknown'
        let status = 'Ongoing'

        // Metadati
        $('.list-info li').each((_: any, row: any) => {
            const label = $(row).find('.name').text().toLowerCase()
            const value = $(row).find('.col-xs-8').text().trim()

            if (label.includes('author')) author = value
            if (label.includes('status')) {
                if (value.toLowerCase().includes('completed')) status = 'Completed'
            }
        })

        // Tags
        const arrayTags: Tag[] = []
        $('.list-info .kind a').each((_: any, a: any) => {
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
                tags: tagSections,
                desc: desc
            })
        })
    }

    // NUOVO HELPER: Conta le pagine della lista capitoli
    getChapterPageCount($: any): number {
        // Cerca l'ultimo numero nella paginazione
        const lastPageLink = $('.pagination li a').last().attr('href')
        if (lastPageLink) {
            // Estrai il numero dopo page=
            const match = lastPageLink.match(/page=(\d+)/)
            if (match) return parseInt(match[1])
        }
        // Se non c'è paginazione o non trova link, è 1 pagina sola
        return 1
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Cerca righe che contengono link ai capitoli
        // Escludi header (.heading)
        $('.list-chapter li.row:not(.heading)').each((_: any, li: any) => {
            const link = $(li).find('a').first()
            const title = link.text().trim()
            const href = link.attr('href')
            
            if (!href) return

            // Estrazione ID
            let chapterId = href.replace(BASE_URL, '')
            if (chapterId.startsWith('/')) chapterId = chapterId.substring(1)

            const dateText = $(li).find('.col-xs-3').text().trim()
            let time = new Date()
            if (dateText && !dateText.includes('Day')) {
                const parsed = new Date(dateText)
                if (!isNaN(parsed.getTime())) time = parsed
            }

            // Parsing numero
            const numMatch = title.match(/Issue #(\d+(\.\d+)?)/i) || title.match(/Chapter (\d+)/i)
            const chapNum = numMatch ? parseFloat(numMatch[1] ?? '0') : 0

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
        
        // Regex per data-original per evitare placeholder base64
        const imgRegex = /<img[^>]+data-original=["']([^"']+)["']/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            const url = match[1]
            if (url) pages.push(this.getImageSrc(url))
        }

        // Fallback standard
        if (pages.length === 0) {
            const genericRegex = /<img[^>]+src=["']([^"']+)["']/g
            while ((match = genericRegex.exec(html)) !== null) {
                const url = match[1]
                if (url && !url.startsWith('data:') && !url.includes('loading') && !url.includes('logo')) {
                    pages.push(this.getImageSrc(url))
                }
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    // Usato per search e view more
    parseGridItems($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // Selettori multipli per coprire Home, Search e Latest
        $('.item, .list-truyen-item-wrap').each((_: any, item: any) => {
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
        const popularSection = App.createHomeSection({ 
            id: 'popular', 
            title: 'Popular Comics 🔥', 
            containsMoreItems: true, 
            type: HomeSectionType.singleRowLarge 
        })
        
        const latestItems = this.parseGridItems($)
        
        // Popola entrambe per sicurezza se i selettori sono identici
        latestSection.items = latestItems
        popularSection.items = latestItems.slice(0, 10) // Primi 10 come popular se non c'è sezione dedicata

        // Cerca sezione specifica popular se esiste (spesso è un owl-carousel o simile)
        // ... (Logica semplificata: usiamo la lista generale che funziona)

        sectionCallback(popularSection)
        sectionCallback(latestSection)
    }
}