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
        // FIX: Ignora immagini base64 (placeholder)
        if (url.startsWith('data:')) return ''
        
        url = url.trim()
        if (url.startsWith('//')) return `https:${url}`
        if (url.startsWith('/')) return BASE_URL + url
        return url
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // SELETTORI BASATI SUL TUO FILE HTML
        const title = $('.title-detail').text().trim() || $('h1').text().trim() || 'Unknown'
        
        const imageSrc = $('.col-image img').attr('src')
        const image = this.getImageSrc(imageSrc) || 'https://paperback.moe/icons/logo-alt.svg'

        let desc = $('.detail-content p').text().trim()
        if (!desc) desc = 'No description available'

        let author = 'Unknown'
        let status = 'Ongoing'

        // Parsing lista info (.list-info)
        $('.list-info li').each((_: any, row: any) => {
            const label = $(row).find('.name').text().toLowerCase()
            const value = $(row).find('.col-xs-8').text().trim()

            if (label.includes('author')) author = value
            if (label.includes('status')) {
                if (value.toLowerCase().includes('completed')) status = 'Completed'
            }
        })

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

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // FIX: Seleziona SOLO i capitoli nella lista, ignorando i bottoni "Start Reading" sopra
        // Il contenitore è .list-chapter o #nt_listchapter
        $('.list-chapter nav ul li.row').each((_: any, li: any) => {
            // Ignora l'header della tabella
            if ($(li).hasClass('heading')) return

            const link = $(li).find('a').first()
            const title = link.text().trim()
            const href = link.attr('href')
            
            if (!href) return

            // Estrazione ID
            let chapterId = href.replace(BASE_URL, '')
            if (chapterId.startsWith('/')) chapterId = chapterId.substring(1)

            const dateText = $(li).find('.col-xs-3').text().trim()
            let time = new Date()
            if (dateText && !dateText.includes('Day Added')) {
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
        
        // FIX KINGFISHER: Estrai SOLO data-original
        // Il tuo HTML: <img class="single-page lazy" ... data-original="...">
        
        // Usiamo una regex per velocità e robustezza su HTML raw
        const imgRegex = /<img[^>]+class=["'].*?lazy.*?["'][^>]+data-original=["']([^"']+)["']/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            const url = match[1]
            if (url) pages.push(this.getImageSrc(url))
        }

        // Fallback: se la regex specifica fallisce, prova una più generica ma ignora base64
        if (pages.length === 0) {
            const genericRegex = /<img[^>]+src=["']([^"']+)["']/g
            while ((match = genericRegex.exec(html)) !== null) {
                const url = match[1]
                if (url && !url.startsWith('data:') && !url.includes('loading')) {
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

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Selettore per griglia (Home e Search usano .item)
        $('.item').each((_: any, item: any) => {
            const link = $('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/').filter((p: string) => p && p !== 'comic').pop()

            const title = link.attr('title') || $('h3 a', item).text().trim()
            const img = $('img', item)
            // Cerca src o data-original
            const imageSrc = img.attr('data-original') || img.attr('src')
            const image = this.getImageSrc(imageSrc)

            const subtitle = $('.chapter a', item).text().trim()

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle || undefined
                }))
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
        
        const latestItems: PartialSourceManga[] = []
        const popularItems: PartialSourceManga[] = []

        // Parsing LATEST
        $('.item').each((_: any, item: any) => {
            const link = $('a', item).first()
            const href = link.attr('href')
            const id = href?.split('/').filter((p: string) => p && p !== 'comic').pop()
            const title = link.attr('title') || $('h3 a', item).text().trim()
            
            const imageSrc = $('img', item).attr('src') || $('img', item).attr('data-original')
            const image = this.getImageSrc(imageSrc)
            const subtitle = $('.chapter a', item).text().trim()

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        
        // Fallback: se latestItems è vuoto, usa un altro selettore
        if (latestItems.length === 0) {
             // A volte usano .row .col-md-3 in homepage
             $('.col-md-3 .item').each((_: any, item: any) => {
                 // (Logica ripetuta o funzione helper)
             })
        }

        latestSection.items = latestItems
        popularSection.items = latestItems // Per ora usiamo gli stessi, XoxoComic ha spesso liste miste in home
        
        sectionCallback(popularSection)
        sectionCallback(latestSection)
    }
}