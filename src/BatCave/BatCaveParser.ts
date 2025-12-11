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

    /**
     * Ottimizzazione URL Immagini
     */
    private getHighResImage(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'

        // Gestione path relativi
        if (!url.startsWith('http')) {
            if (url.startsWith('/')) {
                url = BASE_URL + url
            } else {
                url = `${BASE_URL}/${url}`
            }
        }

        // Fix DLE: Rimuove /thumbs/ per ottenere l'immagine HD
        if (url.includes('/thumbs/')) {
            return url.replace('/thumbs/', '/')
        }

        return url
    }

    /**
     * Helper centralizzato per il parsing delle griglie
     */
    parseGridItems($: any, containerSelector: string, itemSelector: string): PartialSourceManga[] {
        const manga: PartialSourceManga[] = []
        
        $(containerSelector).find(itemSelector).each((_: any, element: any) => {
            const item = $(element)
            // Trova il link (a volte è l'elemento stesso, a volte è figlio)
            const link = item.is('a') ? item : item.find('a').first()
            
            const href = link.attr('href')
            const id = href?.split('/').pop()?.replace('.html', '')

            // Titolo: Cerca nei vari posti usati da BatCave
            const title = item.find('.caption').text().trim() || 
                          item.find('.popular__title').text().trim() || 
                          item.attr('title') || 
                          link.text().trim()

            // Immagine: Cerca src, data-src o style background
            let image = item.find('img').attr('src') || item.find('img').attr('data-src')
            if (!image) {
                const style = item.attr('style')
                const match = style?.match(/url\(['"]?(.*?)['"]?\)/)
                if (match) image = match[1]
            }

            // Sottotitolo opzionale (es. ultimo capitolo)
            const subtitle = item.find('.latest__chapter').text().trim()

            if (id && title) {
                manga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: this.getHighResImage(image),
                    title: title,
                    subtitle: subtitle || undefined
                }))
            }
        })

        return manga
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Fallback multipli per il titolo
        let title = $('h1.title').text().trim() 
        if (!title) title = $('.f-desc h1').text().trim() || 'Unknown'

        // Immagine
        const imageSrc = $('.f-desc img').first().attr('src')
        const image = this.getHighResImage(imageSrc)

        // Descrizione
        let desc = $('.full-text').text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') ?? ''
        
        // Metadati
        let author = 'Unknown'
        let status = 'Ongoing'
        
        $('.f-info li').each((_: any, li: any) => {
            const text = $(li).text()
            if (text.includes('Publisher:')) author = $(li).find('a').text().trim()
            if (text.includes('Status:')) {
                if (text.toLowerCase().includes('completed')) status = 'Completed'
            }
        })

        // Tags
        const arrayTags: Tag[] = []
        $('.f-info a[href*="/genre/"]').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('/').pop()?.replace('.html', '') ?? label
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
                desc: desc || 'No description available.'
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        $('.list-chapters .chapter-item').each((_: any, item: any) => {
            const link = $(item).find('a')
            const href = link.attr('href')
            
            if (!href) return

            const chapterId = href.split('/').pop()?.replace('.html', '') ?? ''
            const title = link.text().trim()
            
            // Parsing Data
            const dateText = $(item).find('.date').text().trim()
            let time = new Date()
            
            if (dateText.toLowerCase().includes('today')) {
                time = new Date()
            } else if (dateText.toLowerCase().includes('yesterday')) {
                time.setDate(time.getDate() - 1)
            } else {
                const parts = dateText.split('.')
                if (parts.length === 3) {
                    // Formato DD.MM.YYYY
                    time = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                }
            }

            // Parsing Numero (Regex ottimizzata)
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

        // 1. Estrazione Variabile JS (imgArr o images)
        // Usiamo una regex più tollerante per catturare l'array
        const scriptMatch = html.match(/(?:imgArr|images)\s*=\s*(\[.*?\])/s)
        
        if (scriptMatch && scriptMatch[1]) {
            try {
                // Sostituisce apici singoli con doppi per JSON.parse
                const jsonStr = scriptMatch[1].replace(/'/g, '"')
                const urls = JSON.parse(jsonStr)
                
                if (Array.isArray(urls)) {
                    for (const url of urls) {
                        if (url) pages.push(this.getHighResImage(url))
                    }
                }
            } catch (e) {
                // Fallback Regex se JSON.parse fallisce (es. sintassi js non valida)
                const urlRegex = /"([^"]+\.(?:jpg|jpeg|png|webp))"/g
                let match
                while ((match = urlRegex.exec(scriptMatch[1])) !== null) {
                    pages.push(this.getHighResImage(match[1]))
                }
            }
        } else {
            // 2. Fallback DOM (se non trova lo script)
            const imgRegex = /<img[^>]+data-src=["']([^"']+)["']/g
            let match
            while ((match = imgRegex.exec(html)) !== null) {
                pages.push(this.getHighResImage(match[1]))
            }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)] // Rimuove duplicati
        })
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // 1. HOT RELEASES
        const hotSection = App.createHomeSection({ 
            id: 'hot', 
            title: 'Hot Releases 🔥', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        hotSection.items = this.parseGridItems($, '.sect--hot', '.poster')
        sectionCallback(hotSection)
        
        // 2. TOP RATED
        const topRatedSection = App.createHomeSection({ 
            id: 'top_rated', 
            title: 'Top Rated ⭐', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        topRatedSection.items = this.parseGridItems($, '.side-block:contains("Top-rated")', 'a.popular')
        sectionCallback(topRatedSection)

        // 3. JUST ADDED
        const justAddedSection = App.createHomeSection({ 
            id: 'just_added', 
            title: 'Just Added 🆕', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        justAddedSection.items = this.parseGridItems($, '.side-block:contains("Just added")', 'a.popular')
        sectionCallback(justAddedSection)

        // 4. LATEST UPDATES
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates 🆙', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })
        latestSection.items = this.parseGridItems($, '.sect--latest', '.latest__chapter')
        sectionCallback(latestSection)
    }

    parseSearchResults($: any): PartialSourceManga[] {
        // Fallback: cerca prima come griglia poster, poi come lista capitoli
        let results = this.parseGridItems($, '#dle-content', '.poster')
        if (results.length === 0) {
            results = this.parseGridItems($, '#dle-content', '.latest__chapter')
        }
        return results
    }
}