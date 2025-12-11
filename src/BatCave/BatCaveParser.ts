import {
    Chapter,
    ChapterDetails,
    HomeSection,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

const BASE_URL = 'https://batcave.biz'

export class BatCaveParser {

    private getHighResImage(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'

        if (!url.startsWith('http')) {
            if (url.startsWith('/')) {
                url = BASE_URL + url
            } else {
                url = BASE_URL + '/' + url
            }
        }

        // Fix tipico DLE: rimuove /thumbs/ per avere l'immagine full
        if (url.includes('/thumbs/')) {
            return url.replace('/thumbs/', '/')
        }

        return url
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Selettori originali ripristinati
        const infoBlock = $('.f-desc')
        
        let title = $('h1.title').text().trim() || $('.f-desc h1').text().trim() || 'Unknown'
        
        const imageSrc = $('.f-desc img').first().attr('src')
        const image = this.getHighResImage(imageSrc)

        let desc = $('.full-text').text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') ?? ''
        
        let author = 'Unknown'
        let status = 'Ongoing'
        
        $('.f-info li').each((_: any, li: any) => {
            const text = $(li).text()
            if (text.includes('Publisher:')) author = $(li).find('a').text().trim()
            if (text.includes('Status:')) {
                if (text.toLowerCase().includes('completed')) status = 'Completed'
            }
        })

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
        
        // Selettori originali ripristinati
        $('.list-chapters .chapter-item').each((_: any, item: any) => {
            const link = $(item).find('a')
            const href = link.attr('href')
            
            if (!href) return

            const chapterId = href.split('/').pop()?.replace('.html', '') ?? ''
            const title = link.text().trim()
            
            const dateText = $(item).find('.date').text().trim()
            let time = new Date()
            
            if (dateText.includes('Today')) {
                time = new Date()
            } else if (dateText.includes('Yesterday')) {
                time.setDate(time.getDate() - 1)
            } else {
                const parts = dateText.split('.')
                if (parts.length === 3) {
                    time = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                }
            }

            // Parsing numero
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

        // Logica Originale (Regex imgArr)
        const scriptMatch = html.match(/imgArr\s*=\s*(\[.*?\])/s) || html.match(/var\s+images\s*=\s*(\[.*?\])/s)
        
        if (scriptMatch && scriptMatch[1]) {
            try {
                const jsonStr = scriptMatch[1].replace(/'/g, '"')
                const urls = JSON.parse(jsonStr)
                if (Array.isArray(urls)) {
                    for (const url of urls) {
                        if (url) pages.push(this.getHighResImage(url))
                    }
                }
            } catch (e) {
                // Fallback Regex semplice se JSON fallisce
                const urlRegex = /"([^"]+\.(?:jpg|jpeg|png|webp))"/g
                let match
                while ((match = urlRegex.exec(scriptMatch[1])) !== null) {
                    pages.push(this.getHighResImage(match[1]))
                }
            }
        } else {
            // Fallback DOM per sicurezza
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

    // Usato sia per Home che per Search/ViewMore
    parseGridItems($: any, container: string, itemSelector: string): PartialSourceManga[] {
        const manga: PartialSourceManga[] = []
        
        $(container).find(itemSelector).each((_: any, element: any) => {
            const item = $(element)
            const link = item.is('a') ? item : item.find('a').first()
            const id = link.attr('href')?.split('/').pop()?.replace('.html', '')
            
            // Titolo: cerca in vari posti tipici di DLE
            let title = item.find('.caption').text().trim() || item.find('.popular__title').text().trim() || item.attr('title') || link.text().trim()
            
            let image = item.find('img').attr('src') || item.find('img').attr('data-src')
            if (!image) {
                const style = item.attr('style')
                const match = style?.match(/url\(['"]?(.*?)['"]?\)/)
                if (match) image = match[1]
            }

            if (id && title) {
                manga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: this.getHighResImage(image),
                    title: title,
                    subtitle: undefined
                }))
            }
        })

        return manga
    }

    parseSearchResults($: any): PartialSourceManga[] {
        // Fallback generico per la ricerca
        return this.parseGridItems($, '#dle-content', '.poster, .short')
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        
        // 1. HOT RELEASES -> LARGE (L'unica modifica "UI" richiesta)
        const hotSection = App.createHomeSection({ 
            id: 'hot', 
            title: 'Hot Releases 🔥', 
            containsMoreItems: false, 
            type: 'singleRowLarge' 
        })
        hotSection.items = this.parseGridItems($, '.sect--hot', '.poster')
        sectionCallback(hotSection)
        
        // 2. TOP RATED -> NORMAL
        const topRatedSection = App.createHomeSection({ 
            id: 'top_rated', 
            title: 'Top Rated ⭐', 
            containsMoreItems: false, 
            type: 'singleRowNormal' 
        })
        // Selettore specifico per la sidebar destra
        topRatedSection.items = this.parseGridItems($, '.side-block:contains("Top-rated")', 'a.popular')
        sectionCallback(topRatedSection)

        // 3. JUST ADDED -> NORMAL
        const justAddedSection = App.createHomeSection({ 
            id: 'just_added', 
            title: 'Just Added 🆕', 
            containsMoreItems: false, 
            type: 'singleRowNormal' 
        })
        justAddedSection.items = this.parseGridItems($, '.side-block:contains("Just added")', 'a.popular')
        sectionCallback(justAddedSection)

        // 4. LATEST UPDATES -> CONTINUOUS
        const latestSection = App.createHomeSection({ 
            id: 'latest', 
            title: 'Latest Updates 🆙', 
            containsMoreItems: true, 
            type: 'continuous' 
        })
        latestSection.items = this.parseGridItems($, '.sect--latest', '.latest__chapter')
        sectionCallback(latestSection)
    }
}