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
        
        url = url.trim()
        if (url.startsWith('//')) {
            url = `https:${url}`
        } else if (url.startsWith('/')) {
            url = BASE_URL + url
        }
        
        return url
    }

    /**
     * Parser Universale per Grid/List items
     */
    private parseMangaItem($: any, element: any): PartialSourceManga | null {
        const item = $(element)
        
        // 1. Cerca il link principale (Anchor)
        let link = item.is('a') ? item : item.find('a').first()
        // A volte il link è sul titolo
        if (!link.attr('href')) link = item.find('h3 a, .title a').first()

        const href = link.attr('href')
        // ID: Estrae l'ultima parte significativa dell'URL
        // Es: https://xoxocomic.com/comic/batman -> batman
        const id = href?.split('/').filter((p: string) => p && p !== 'comic' && p !== 'xoxocomic.com').pop()

        if (!id) return null

        // 2. Titolo
        let title = item.find('h3').text().trim()
        if (!title) title = item.find('.title').text().trim()
        if (!title) title = link.text().trim() || link.attr('title') || 'Unknown'

        // 3. Immagine (Prova vari attributi)
        const img = item.find('img').first()
        let imageSrc = img.attr('data-original') || img.attr('data-src') || img.attr('src')
        
        // Fix per sfondi CSS (usato in alcuni layout mobile)
        if (!imageSrc) {
            const style = item.find('.div-poster, .image').attr('style')
            const match = style?.match(/url\(['"]?(.*?)['"]?\)/)
            if (match) imageSrc = match[1]
        }

        const image = this.getImageSrc(imageSrc)

        // 4. Sottotitolo
        const subtitle = item.find('.chapter, .chapter-name').last().text().trim()

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle || undefined
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // STRATEGIA 1: Layout Classico
        let title = $('h2.listmanga-header, h1.title-manga').first().text().trim()
        // STRATEGIA 2: Layout Alternativo (Mobile)
        if (!title) title = $('.manga-info h1, .manga-info h3').first().text().trim()
        if (!title) title = $('title').text().replace('- XoxoComic', '').trim() || 'Unknown'

        // Immagine
        let img = $('.col-md-4 .img-responsive, .manga-info img').first()
        let imageSrc = img.attr('src') || img.attr('data-src')
        const image = this.getImageSrc(imageSrc)

        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'
        let desc = ''

        // Parsing Metadati (Cerca in tutte le liste di definizione o span)
        $('li, p, .dl-horizontal dt, .manga-info li').each((_: any, el: any) => {
            const text = $(el).text().toLowerCase()
            const value = $(el).next().text().trim() || $(el).find('span, a').text().trim()

            if (text.includes('author') || text.includes('writer')) author = value.replace(/author(s)?:/i, '').trim()
            if (text.includes('artist')) artist = value.replace(/artist(s)?:/i, '').trim()
            if (text.includes('status')) {
                if (text.includes('completed') || value.toLowerCase().includes('completed')) status = 'Completed'
            }
        })

        // Descrizione
        desc = $('.manga-content p, .well p, #noidungm').first().text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') ?? 'No description available'

        // Generi
        const arrayTags: Tag[] = []
        $('a[href*="/genre/"]').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('/').pop() ?? label
            if (label && id) arrayTags.push(App.createTag({ id, label }))
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
        
        // Selettori Multipli per i capitoli
        const selector = 'ul.chapters li, .chapter-list .row, .row-content-chapter li'
        
        $(selector).each((_: any, li: any) => {
            const link = $('a', li).first()
            const title = link.text().trim()
            const href = link.attr('href')
            
            // ID Pulizia
            let chapterId = href?.replace(BASE_URL, '') ?? ''
            if (chapterId.startsWith('/')) chapterId = chapterId.substring(1)

            if (!chapterId) return

            const dateText = $(li).find('.date, .time, .date-chapter-title-rtl').text().trim()
            let time = new Date()
            if (dateText) {
                const parsed = new Date(dateText)
                if (!isNaN(parsed.getTime())) time = parsed
            }

            // Parsing Numero
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

        // 1. Estrazione Array JS (Metodo veloce)
        const scriptMatch = html.match(/var\s+lstImages\s*=\s*new\s+Array\((.*?)\);/)
        if (scriptMatch && scriptMatch[1]) {
            const urls = scriptMatch[1].split(',').map((u: string) => u.trim().replace(/['"]/g, ''))
            for (const url of urls) if (url) pages.push(this.getImageSrc(url))
        } 
        
        // 2. Fallback: Cerca tag <img> standard se JS fallisce
        if (pages.length === 0) {
            const imgRegex = /<img[^>]+src="([^">]+)"/g
            let match
            while ((match = imgRegex.exec(html)) !== null) {
                const src = match[1]
                if (src && !src.includes('logo') && !src.includes('banner')) {
                    pages.push(this.getImageSrc(src))
                }
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

        // Cerca qualsiasi elemento che assomigli a un fumetto
        $('.item, .list-truyen-item-wrap, .search-story-item').each((_: any, item: any) => {
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

        // Selettore molto ampio per prendere qualsiasi griglia in home
        $('.item, .content .row .col-md-3').each((_: any, item: any) => {
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