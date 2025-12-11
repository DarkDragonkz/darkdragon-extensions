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

    private parseMangaItem($: any, element: any): PartialSourceManga | null {
        const item = $(element)
        
        // Link
        let link = item.is('a') ? item : item.find('a[href*="/comic/"]').first()
        if (!link.attr('href')) link = item.find('h3 a, .title a').first()

        const href = link.attr('href')
        const id = href?.split('/').filter((p: string) => p && p !== 'comic' && p !== 'xoxocomic.com').pop()

        if (!id) return null

        // Titolo
        let title = item.find('h3').text().trim()
        if (!title) title = item.find('.title').text().trim()
        if (!title) title = link.text().trim() || link.attr('title') || 'Unknown'

        // Immagine
        const img = item.find('img').first()
        let imageSrc = img.attr('data-original') || img.attr('data-src') || img.attr('src')
        
        // Fix per sfondi CSS
        if (!imageSrc) {
            const style = item.find('.div-poster, .image').attr('style')
            const match = style?.match(/url\(['"]?(.*?)['"]?\)/)
            if (match) imageSrc = match[1]
        }

        const image = this.getImageSrc(imageSrc)
        const subtitle = item.find('.chapter, .chapter-name').last().text().trim()

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle || undefined
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // STRATEGIA 1: META TAGS (Più affidabile)
        let title = $('meta[property="og:title"]').attr('content')?.replace('- XoxoComic', '').trim()
        let imageSrc = $('meta[property="og:image"]').attr('content')
        let desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content')

        // STRATEGIA 2: Fallback HTML
        if (!title) title = $('h2.listmanga-header, h1.title-manga, h1').first().text().trim()
        if (!imageSrc) imageSrc = $('.col-md-4 .img-responsive, .manga-info img').first().attr('src')
        if (!desc) desc = $('.manga-content p, .well p, #noidungm').text().trim()

        const image = this.getImageSrc(imageSrc)
        if (!title) title = 'Unknown Title'
        if (!desc) desc = 'No description available'

        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'

        // Parsing Metadati
        // Cerca liste di definizione o label generiche
        $('dt, .manga-info li b').each((_: any, el: any) => {
            const label = $(el).text().toLowerCase()
            const value = $(el).next('dd').text().trim() || $(el).parent().text().replace(label, '').trim()

            if (label.includes('author')) author = value
            if (label.includes('artist')) artist = value
            if (label.includes('status')) {
                if (value.toLowerCase().includes('completed')) status = 'Completed'
            }
        })

        // Generi
        const arrayTags: Tag[] = []
        // Cerca link che contengono "genre" ovunque nella pagina
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
        
        // CERCA OVUNQUE: Qualsiasi link che sembri un capitolo
        // Escludi link header/footer/sidebar generici
        $('a').each((_: any, a: any) => {
            const link = $(a)
            const href = link.attr('href')
            if (!href) return

            // Deve contenere l'ID del manga o "chapter" o "issue"
            // E non deve essere il link alla pagina manga stessa
            const isChapterLink = (href.includes(mangaId) || href.includes('chapter') || href.includes('issue')) 
                                  && href.length > (BASE_URL.length + mangaId.length + 5)
                                  && !href.endsWith('/comic/' + mangaId)
            
            if (!isChapterLink) return

            // Verifica che sia dentro una lista o una tabella (per evitare link "Latest" nella sidebar)
            const parentClass = link.closest('ul, div, li').attr('class') || ''
            if (!parentClass && link.parents().length < 5) return // Troppo in alto nell'albero DOM

            let chapterId = href.replace(BASE_URL, '')
            if (chapterId.startsWith('/')) chapterId = chapterId.substring(1)

            const title = link.text().trim()
            if (!title) return

            // Evita duplicati
            if (chapters.some(c => c.id === chapterId)) return

            // Parsing Numero
            const numMatch = title.match(/(\d+(\.\d+)?)/)
            const chapNum = numMatch ? parseFloat(numMatch[0]) : 0

            // Cerca data vicino al link
            const dateText = link.parent().text().replace(title, '').trim()
            let time = new Date()
            if (dateText.match(/\d{4}/)) { // Se sembra una data
                 const parsed = new Date(dateText)
                 if (!isNaN(parsed.getTime())) time = parsed
            }

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

        // Cerca qualsiasi 'item' in pagina
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