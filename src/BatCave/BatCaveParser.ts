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
     * Trasforma URL miniatura in HD rimuovendo /thumbs/ o ridimensionamenti.
     */
    private getHighResImage(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'

        if (url.startsWith('/')) {
            url = BASE_URL + url
        }

        // Fix DLE: trasforma .../thumbs/image.jpg in .../image.jpg
        if (url.includes('/thumbs/')) {
            return url.replace('/thumbs/', '/')
        }

        return url
    }

    /**
     * Helper centralizzato per parsare griglie di fumetti
     */
    parseGridItems($: any, containerSelector: string, itemSelector = 'a.popular'): PartialSourceManga[] {
        const manga: PartialSourceManga[] = []
        
        // Selettore flessibile: cerca dentro il container specifico
        $(containerSelector).find(itemSelector).each((_: any, element: any) => {
            const item = $(element)
            const id = item.attr('href')?.split('/').pop()?.replace('.html', '')
            const title = item.find('.caption, .popular__title').text().trim() || item.attr('title')
            
            // Immagine: cerca nel tag img o nello stile background
            let image = item.find('img').attr('src') || item.find('img').attr('data-src')
            if (!image) {
                // Fallback per layout con background-image
                const style = item.attr('style')
                const match = style?.match(/url\(['"]?(.*?)['"]?\)/)
                if (match) image = match[1]
            }

            if (id && title) {
                manga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: this.getHighResImage(image),
                    title: title,
                    subtitle: undefined // Opzionale: potremmo mettere "Vol X" se disponibile
                }))
            }
        })

        return manga
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const infoBlock = $('.f-desc')
        
        let title = $('h1.title').text().trim()
        if (!title) title = $('.f-desc h1').text().trim() || 'Unknown'

        // Immagine: prende quella principale
        const image = this.getHighResImage($('.f-desc img').first().attr('src'))

        // Descrizione: Rimuove i metadati "Publisher:", "Year:", ecc dal testo
        let desc = $('.full-text').text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') ?? ''
        
        // Parsing Metadati
        let author = 'Unknown'
        let status = 'Ongoing'
        
        $('.f-info li').each((_: any, li: any) => {
            const text = $(li).text()
            if (text.includes('Publisher:')) author = $(li).find('a').text().trim()
            if (text.includes('Status:')) {
                if (text.toLowerCase().includes('completed')) status = 'Completed'
            }
        })

        // Generi
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
        
        // BatCave elenca i capitoli in .list-chapters o .sect--latest nella pagina del fumetto
        $('.list-chapters .chapter-item, .sect--latest .latest__chapter').each((_: any, item: any) => {
            const link = $(item).find('a')
            const href = link.attr('href')
            
            if (!href) return

            const chapterId = href.split('/').pop()?.replace('.html', '') ?? ''
            const title = link.text().trim() || $(item).find('.latest__title').text().trim()
            
            // Parsing Data (es. "Today", "Yesterday", "12.05.2023")
            const dateText = $(item).find('.date, .latest__date').text().trim()
            let time = new Date()
            
            if (dateText.includes('Today')) {
                time = new Date()
            } else if (dateText.includes('Yesterday')) {
                time.setDate(time.getDate() - 1)
            } else {
                // Formato DD.MM.YYYY
                const parts = dateText.split('.')
                if (parts.length === 3) {
                    time = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                }
            }

            // Parsing Numero (cerca l'ultimo numero nel titolo o ID)
            const numMatch = title.match(/(?:Issue|Chapter|#)\s*(\d+(\.\d+)?)/i) 
                             || href.match(/-(\d+)(?:-|\.html)/)
            
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

    // --- NUOVA LOGICA READER ---
    // Cerca sia regex JS che fallback HTML
    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []

        // 1. Tentativo Regex (Veloce, script imgArr)
        // Cerca pattern: var imgArr = ["url1", "url2"];
        const scriptMatch = html.match(/imgArr\s*=\s*(\[.*?\])/s) || html.match(/var\s+images\s*=\s*(\[.*?\])/s)
        
        if (scriptMatch && scriptMatch[1]) {
            try {
                // Pulisce la stringa JSON e la parsa
                // A volte usano apici singoli, JSON.parse vuole doppi
                const jsonStr = scriptMatch[1].replace(/'/g, '"')
                const urls = JSON.parse(jsonStr)
                
                if (Array.isArray(urls)) {
                    for (const url of urls) {
                        if (url) pages.push(this.getHighResImage(url))
                    }
                }
            } catch (e) {
                console.error('BatCave JSON parse failed, trying regex extraction')
            }
        }

        // 2. Tentativo Regex Semplice (se JSON fallisce)
        if (pages.length === 0) {
            const urlRegex = /"([^"]+\.(?:jpg|jpeg|png|webp))"/g
            let match
            // Cerca dentro lo script specifico o tutto l'html
            while ((match = urlRegex.exec(html)) !== null) {
                if (match[1] && !match[1].includes('logo') && !match[1].includes('icon')) {
                    pages.push(this.getHighResImage(match[1]))
                }
            }
        }

        // Filtra duplicati
        const uniquePages = [...new Set(pages)]

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: uniquePages
        })
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // 1. HOT RELEASES -> LARGE (Vetrina)
        const hotSection = App.createHomeSection({ 
            id: 'hot', 
            title: 'Hot Releases 🔥', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowLarge 
        })
        hotSection.items = this.parseGridItems($, '.sect--hot', '.poster')
        sectionCallback(hotSection)
        
        // 2. TOP RATED -> NORMAL
        const topRatedSection = App.createHomeSection({ 
            id: 'top_rated', 
            title: 'Top Rated ⭐', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        // Cerca il blocco sidebar che contiene "Top-rated"
        topRatedSection.items = this.parseGridItems($, 'div.side-block:has(h2:contains("Top-rated"))', 'a.popular')
        sectionCallback(topRatedSection)

        // 3. JUST ADDED -> NORMAL
        const justAddedSection = App.createHomeSection({ 
            id: 'just_added', 
            title: 'Just Added 🆕', 
            containsMoreItems: false, 
            type: HomeSectionType.singleRowNormal 
        })
        justAddedSection.items = this.parseGridItems($, 'div.side-block:has(h2:contains("Just added"))', 'a.popular')
        sectionCallback(justAddedSection)

        // 4. LATEST UPDATES -> CONTINUOUS (Scroll Infinito)
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates 🆙', 
            containsMoreItems: true, 
            type: HomeSectionType.continuous 
        })
        // In home page, latest è in .sect--latest
        latestSection.items = this.parseGridItems($, '.sect--latest', '.latest__chapter')
        sectionCallback(latestSection)
    }

    parseSearchResults($: any): PartialSourceManga[] {
        // Usa il parser generico sulla griglia dei risultati
        // Solitamente BatCave usa la stessa struttura di Latest o Grid standard
        let results = this.parseGridItems($, '#dle-content', '.poster')
        
        if (results.length === 0) {
            // Fallback per layout lista
            results = this.parseGridItems($, '#dle-content', '.latest__chapter')
        }
        
        return results
    }
}