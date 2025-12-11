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

    /**
     * Helper cruciale per evitare l'errore Kingfisher.
     * Ignora immagini base64 e placeholder.
     */
    private getImageSrc(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'
        
        // FIX CRITICO: Se è base64 (data:image...), è un placeholder inutile. Ignoralo.
        if (url.startsWith('data:')) return '' 
        if (url.includes('logo') || url.includes('placeholder')) return 'https://paperback.moe/icons/logo-alt.svg'
        
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
        
        let link = item.find('a').first()
        // Se il link non punta a un fumetto, cerca meglio
        if (!link.attr('href')?.includes('/comic/')) {
             link = item.find('h3 a, .title a').first()
        }

        const href = link.attr('href')
        const id = href?.split('/').filter((p: string) => p && p !== 'comic' && p !== 'xoxocomic.com').pop()

        if (!id) return null

        let title = item.find('h3').text().trim()
        if (!title) title = link.text().trim()
        if (!title) title = item.find('.title').text().trim()
        if (!title) title = 'Unknown Title'

        // Logica Immagini: Priorità a data-original per evitare base64
        const img = item.find('img').first()
        let imageSrc = img.attr('data-original') || img.attr('data-src') || img.attr('src')
        
        // Fallback stile CSS (background-image)
        if (!imageSrc || imageSrc.startsWith('data:')) {
            const style = item.find('.div-poster, .image').attr('style')
            const match = style?.match(/url\(['"]?(.*?)['"]?\)/)
            if (match) imageSrc = match[1]
        }

        const image = this.getImageSrc(imageSrc) || 'https://paperback.moe/icons/logo-alt.svg'
        const subtitle = item.find('.chapter, .chapter-name').last().text().trim()

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle || undefined
        })
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // 1. Titolo: prova selettori specifici
        let title = $('h2.listmanga-header').text().trim()
        if (!title) title = $('.manga-info h1').text().trim()
        if (!title) title = $('meta[property="og:title"]').attr('content')?.replace('- XoxoComic', '').trim() ?? 'Unknown'

        // 2. Immagine: Cerca data-original per evitare base64
        let img = $('.col-md-4 .img-responsive, .manga-info img').first()
        let imageSrc = img.attr('data-original') || img.attr('src')
        if (!imageSrc) imageSrc = $('meta[property="og:image"]').attr('content')
        
        const image = this.getImageSrc(imageSrc) || 'https://paperback.moe/icons/logo-alt.svg'

        let author = 'Unknown'
        let artist = 'Unknown'
        let status = 'Ongoing'
        let desc = ''

        // 3. Metadati
        $('dt, .manga-info li b').each((_: any, el: any) => {
            const label = $(el).text().toLowerCase()
            const value = $(el).next('dd').text().trim() || $(el).parent().text().replace(label, '').trim()

            if (label.includes('author')) author = value.replace(/:/g, '').trim()
            if (label.includes('artist')) artist = value.replace(/:/g, '').trim()
            if (label.includes('status')) {
                if (value.toLowerCase().includes('completed')) status = 'Completed'
            }
        })

        // 4. Descrizione (Pulisce "Summary:")
        desc = $('#noidungm, .manga-content p, .well p').first().text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') ?? ''
        desc = desc.replace(/^Summary:/i, '').trim()
        if (!desc) desc = 'No description available'

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
        
        // Selettore specifico per la lista capitoli per evitare bottoni "Start Reading"
        // Cerca dentro 'ul.chapters' O '.chapter-list'
        $('ul.chapters li, .chapter-list .row').each((_: any, li: any) => {
            const link = $(li).find('a').first()
            const title = link.text().trim()
            const href = link.attr('href')
            
            // FIX: Ignora bottoni "Start Reading" o "Read Now"
            if (title.toLowerCase().includes('start reading') || title.toLowerCase().includes('read now')) return

            let chapterId = href?.replace(BASE_URL, '') ?? ''
            if (chapterId.startsWith('/')) chapterId = chapterId.substring(1)

            if (!chapterId) return

            const dateText = $(li).find('.date-chapter-title-rtl, .time').text().trim()
            let time = new Date()
            if (dateText) {
                const parsed = new Date(dateText)
                if (!isNaN(parsed.getTime())) time = parsed
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

        // 1. TENTATIVO JAVASCRIPT (Il più affidabile su XoxoComic)
        // Cerca: var lstImages = new Array("...");
        const scriptMatch = html.match(/var\s+lstImages\s*=\s*new\s+Array\((.*?)\);/)
        
        if (scriptMatch && scriptMatch[1]) {
            const urls = scriptMatch[1].split(',').map((u: string) => u.trim().replace(/['"]/g, ''))
            for (const url of urls) {
                // Pulizia URL
                const cleanUrl = this.getImageSrc(url)
                if (cleanUrl && !cleanUrl.startsWith('data:')) {
                    pages.push(cleanUrl)
                }
            }
        } 
        
        // 2. FALLBACK HTML (Solo se lo script fallisce)
        if (pages.length === 0) {
            // Cerca tutti i tag img che non sono icone
            const imgRegex = /<img[^>]+src="([^">]+)"/g
            let match
            while ((match = imgRegex.exec(html)) !== null) {
                const rawSrc = match[1]
                
                // Saltiamo roba che puzza di placeholder o logo
                if (rawSrc.includes('logo') || rawSrc.includes('banner') || rawSrc.startsWith('data:')) continue

                const cleanUrl = this.getImageSrc(rawSrc)
                if (cleanUrl) pages.push(cleanUrl)
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
        
        const latestItems: PartialSourceManga[] = []
        const seenIds = new Set<string>()

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