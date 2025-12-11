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

const BASE_URL = 'https://www.mangaworld.mx'

export class MangaWorldParser {

    private parseItalianDate(dateStr: string): Date {
        const months: { [key: string]: number } = {
            'gennaio': 0, 'febbraio': 1, 'marzo': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
            'luglio': 6, 'agosto': 7, 'settembre': 8, 'ottobre': 9, 'novembre': 10, 'dicembre': 11,
            'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
            'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
        }

        dateStr = dateStr.toLowerCase().trim()
        if (dateStr.includes('oggi')) return new Date()
        if (dateStr.includes('ieri')) {
            const d = new Date()
            d.setDate(d.getDate() - 1)
            return d
        }

        const parts = dateStr.split(' ')
        if (parts.length >= 3) {
            const day = parseInt(parts[0] ?? '1')
            const monthName = parts[1] ?? ''
            const year = parseInt(parts[2] ?? new Date().getFullYear().toString())
            if (months[monthName] !== undefined) return new Date(year, months[monthName]!, day)
        }
        return new Date()
    }

    private cleanTitle(title: string): string {
        if (!title) return 'Unknown'
        title = title.trim()
        if (title.length > 0 && title.length % 2 === 0) {
            const half = title.substring(0, title.length / 2)
            if (half === title.substring(title.length / 2)) return half
        }
        return title
    }

    private getImageSrc(element: any): string {
        let image = element.attr('src') ?? ''
        if (!image || image.includes('loading') || image.startsWith('data:')) {
            image = element.attr('data-src') ?? element.attr('data-original') ?? ''
        }
        if (image && image.startsWith('/')) image = BASE_URL + image
        return image || 'https://paperback.moe/icons/logo-alt.svg'
    }

    // --- PARSER DETTAGLI (Fail-Safe) ---
    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Prova più contenitori possibili
        let infoBox = $('.comic-info')
        if (infoBox.length === 0) infoBox = $('.manga-info-top, .detail-info')

        // Titolo: Prova h1.name > .comic-title > h1
        let rawTitle = $('h1.name', infoBox).text().trim()
        if (!rawTitle) rawTitle = $('.comic-title', infoBox).text().trim()
        if (!rawTitle) rawTitle = $('h1').first().text().trim()
        
        const title = this.cleanTitle(rawTitle)
        
        // Immagine
        let image = this.getImageSrc($('.comic-thumb img', infoBox))
        if (image.includes('logo-alt')) image = this.getImageSrc($('.col-image img'))

        // Descrizione
        let desc = $('#noidungm').text().trim()
        if (!desc) desc = $('.description').text().trim()
        if (!desc) desc = $('.detail-content p').text().trim()

        let author = 'Unknown'
        let status = 'Ongoing'
        let artist = 'Unknown'

        // Parsing Metadati: Prova 3 layout diversi
        // Layout 1: .meta-data > .col... > strong
        $('.meta-data .col-12, .meta-data .col-6').each((_: any, col: any) => {
            const label = $(col).find('strong').text().toLowerCase()
            const value = $(col).text().replace($(col).find('strong').text(), '').trim()
            if (label.includes('autore')) author = value
            if (label.includes('artista')) artist = value
            if (label.includes('stato') && (value.includes('ompletato') || value.includes('inito'))) status = 'Completed'
        })

        // Layout 2: .specs .row
        if (author === 'Unknown') {
            $('.specs .row, .list-info li').each((_: any, row: any) => {
                const label = $(row).text().toLowerCase()
                const value = $(row).find('span, a, p').last().text().trim()
                if (label.includes('autore')) author = value
                if (label.includes('artista')) artist = value
                if (label.includes('stato') && (value.includes('ompletato') || value.includes('inito'))) status = 'Completed'
            })
        }

        const arrayTags: Tag[] = []
        $('.tags a, .kind a').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('genre=')[1] ?? label
            if (label) arrayTags.push(App.createTag({ id, label }))
        })
        const tagSections = [App.createTagSection({ id: '0', label: 'Generi', tags: arrayTags })]

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
        
        // Prova selettori multipli per la lista capitoli
        let container = $('.chapters-wrapper')
        if (container.length === 0) container = $('.list-chapters, .chapter-list')
        
        // Elementi lista
        let items = container.find('.chapter-item')
        if (items.length === 0) items = container.find('li.row, li')

        items.each((_: any, item: any) => {
            const link = $(item).find('a.chapter-name, a').first()
            const href = link.attr('href')
            if (!href) return

            const chapterId = href.split('/').pop() ?? ''
            const rawTitle = link.text().trim()
            
            const dateText = $(item).find('.chapter-date, .date, .time').text().trim()
            const time = this.parseItalianDate(dateText)

            const volMatch = rawTitle.match(/Vol\.?\s*(\d+)/i)
            const chapMatch = rawTitle.match(/(?:Cap|Ch)\.?\s*(\d+(\.\d+)?)/i)
            
            const volNum = volMatch ? parseInt(volMatch[1] ?? '0') : undefined
            const chapNum = chapMatch ? parseFloat(chapMatch[1] ?? '0') : 0

            let name = ''
            if (volNum !== undefined) name += `Vol. ${volNum} `
            name += `Ch. ${chapNum}`
            
            if (rawTitle.includes('-')) {
                const extraTitle = rawTitle.split('-').slice(1).join('-').trim()
                if (extraTitle && !extraTitle.includes(String(chapNum))) {
                    name += ` - ${extraTitle}`
                }
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: volNum,
                time: time,
                langCode: 'it',
                sortingIndex: chapters.length
            }))
        })

        return chapters
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // 1. JSON (Priority)
        try {
            const jsonMatch = html.match(/wrapper\s*=\s*(\{.*?\});/s)
            if (jsonMatch && jsonMatch[1]) {
                const data = JSON.parse(jsonMatch[1])
                const pageList = data.chapter?.pages || data.pages || []
                // Qui servirebbe logica per ricostruire URL se relativi, ma proviamo fallback se vuoto
            }
        } catch (e) { }

        // 2. DOM (Standard)
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]+class=["']content-image/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            pages.push(this.getImageSrc({ attr: () => match![1] }))
        }

        // 3. Fallback (Reader Area)
        if (pages.length === 0) {
             const genericRegex = /<div id="page_\d+">.*?<img[^>]+src=["']([^"']+)["']/gs
             while ((match = genericRegex.exec(html)) !== null) {
                 pages.push(this.getImageSrc({ attr: () => match![1] }))
             }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    // --- HOME PAGE ---
    parseCommonManga($: any, element: any, subtitleSelector?: string): PartialSourceManga {
        const item = $(element)
        const link = item.find('a').first()
        const href = link.attr('href')
        const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''

        let rawTitle = item.find('.manga-title, .name').text().trim() // Aggiunto .name
        if (!rawTitle) rawTitle = item.find('.title, h3').text().trim()
        if (!rawTitle) rawTitle = link.attr('title') ?? 'Unknown'

        const title = this.cleanTitle(rawTitle)
        
        // Immagine: cerca anche .thumb img
        let image = this.getImageSrc(item.find('img').first())
        if (image.includes('logo-alt')) image = this.getImageSrc(item.find('.thumb img'))

        let subtitle = undefined
        if (subtitleSelector) subtitle = item.find(subtitleSelector).text().trim()
        else subtitle = item.find('.chapter-text, .latest-chapter').first().text().trim()

        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: subtitle || undefined
        })
    }

    parseHomeSections($: any, month: HomeSection, latest: HomeSection, trending: HomeSection): void {
        const monthItems: PartialSourceManga[] = []
        $('.top-wrapper .entry, .to-wrapper .entry').each((i: number, item: any) => {
            if (i < 10) monthItems.push(this.parseCommonManga($, item))
        })
        month.items = monthItems

        const latestItems: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            latestItems.push(this.parseCommonManga($, item, '.chapter-link, .chapter a'))
        })
        latest.items = latestItems

        const trendingItems: PartialSourceManga[] = []
        $('#chapters-slide .entry, .entry.vertical').each((_: any, item: any) => {
            if ($(item).hasClass('slick-cloned')) return
            trendingItems.push(this.parseCommonManga($, item, '.chapter'))
        })
        trending.items = trendingItems
    }

    parseViewMore($: any): PartialSourceManga[] {
        const manga: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            manga.push(this.parseCommonManga($, item))
        })
        return manga
    }
}