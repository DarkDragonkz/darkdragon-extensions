import {
    Chapter,
    ChapterDetails,
    HomeSection,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

const BASE_URL = 'https://www.mangaworld.mx'

export class MangaWorldParser {

    /**
     * Parsing Date Italiane
     */
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

    // --- PARSER DETTAGLI ---
    parseMangaDetails($: any, mangaId: string): SourceManga {
        const infoBox = $('.comic-info')
        
        let rawTitle = $('h1.name', infoBox).text().trim()
        if (!rawTitle) rawTitle = $('.comic-title', infoBox).text().trim()
        
        const title = this.cleanTitle(rawTitle)
        const image = this.getImageSrc($('.thumb img', infoBox))

        let desc = $('#noidungm').text().trim()
        if (!desc) desc = $('.comic-description').text().trim()

        let author = 'Unknown'
        let status = 'Ongoing'
        let artist = 'Unknown'

        $('.meta-data [class*="col-"]').each((_: any, col: any) => {
            const text = $(col).text().trim()
            if (text.toLowerCase().includes('autore:')) {
                author = $(col).find('a').text().trim()
            }
            if (text.toLowerCase().includes('artista:')) {
                artist = $(col).find('a').text().trim()
            }
            if (text.toLowerCase().includes('stato:')) {
                if (text.toLowerCase().includes('completato') || text.toLowerCase().includes('finito')) {
                    status = 'Completed'
                }
            }
        })

        const arrayTags: Tag[] = []
        $('.tags a, .genre a', infoBox).each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('genre=')[1] ?? label
            if (label) arrayTags.push(App.createTag({ id, label }))
        })
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Generi', tags: arrayTags })]

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
        
        const wrapper = $('.chapters-wrapper')
        const volumes = wrapper.find('.volume-element')
        
        if (volumes.length > 0) {
            volumes.each((_: any, volEl: any) => {
                const volText = $(volEl).find('.volume-name').text().trim()
                const volNumMatch = volText.match(/Volume\s*(\d+)/i)
                const volNum = volNumMatch ? parseInt(volNumMatch[1]) : undefined

                $(volEl).find('.chapter').each((_: any, item: any) => {
                    this.extractChapterData($, item, chapters, volNum)
                })
            })
        } else {
            $('.chapter', wrapper).each((_: any, item: any) => {
                this.extractChapterData($, item, chapters, undefined)
            })
        }

        return chapters
    }

    private extractChapterData($: any, item: any, chapters: Chapter[], volNum: number | undefined) {
        const link = $(item).find('a.chap')
        const href = link.attr('href')
        if (!href) return

        const chapterId = href.split('/').pop() ?? ''
        
        // Titolo (es: "Capitolo 04" oppure "Capitolo 5 - L'inizio")
        let titleText = link.find('span').text().trim()
        const dateText = link.find('.chap-date').text().trim()
        const time = this.parseItalianDate(dateText)

        // Parsing numero capitolo
        const chapMatch = titleText.match(/(\d+(\.\d+)?)/)
        const chapNum = chapMatch ? parseFloat(chapMatch[0]) : 0

        // --- FIX NOMINAZIONE (RIMUOVE RIPETIZIONI) ---
        let name = ''
        
        // Rimuove "Capitolo X" dal titolo se c'è altro testo
        // Es: "Capitolo 5 - Battaglia" -> diventa "Battaglia"
        // Es: "Capitolo 5" -> rimane vuoto/numero
        const cleanName = titleText.replace(/Capitolo\s*\d+(\.\d+)?\s*-?\s*/i, '').trim()
        
        if (cleanName.length > 0) {
            // Se c'è un titolo vero (es. "Il ritorno"), usiamo quello
            name = cleanName
        } else {
            // Se è solo un numero, mettiamo il nome completo italiano per chiarezza
            // Paperback mostrerà: Vol. 1 Ch. 5 - Capitolo 5 (o solo Capitolo 5)
            // Meglio di "Ch. 5 - Ch. 5"
            name = titleText 
        }

        chapters.push(App.createChapter({
            id: chapterId,
            name: name,
            chapNum: chapNum,
            volume: volNum,
            time: time,
            langCode: '🇮🇹', // FIX: Emoji Bandiera Italiana
            sortingIndex: chapters.length
        }))
    }

    parseChapterDetails(html: string, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]+class=["']content-image/g
        let match
        while ((match = imgRegex.exec(html)) !== null) {
            const url = this.getImageSrc({ attr: () => match![1] })
            pages.push(url)
        }

        if (pages.length === 0) {
            try {
                const jsonMatch = html.match(/wrapper\s*=\s*(\{.*?\});/s)
                if (jsonMatch && jsonMatch[1]) {
                    // Fallback JSON logic here if needed
                }
            } catch (e) { }
        }

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }

    // --- HOME PAGE PARSERS ---

    parseHomeSections($: any, month: HomeSection, latest: HomeSection, trending: HomeSection): void {
        const monthItems: PartialSourceManga[] = []
        $('.top-wrapper .entry').each((i: number, item: any) => {
            if (i >= 10) return
            const el = $(item)
            const link = el.find('.content .name').parent()
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''
            const title = this.cleanTitle(el.find('.content .name').text())
            const image = this.getImageSrc(el.find('.thumb img'))

            if (id && title) {
                monthItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: 'Top Mensile'
                }))
            }
        })
        month.items = monthItems

        const latestItems: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            const el = $(item)
            const link = el.find('a.manga-title')
            const title = this.cleanTitle(link.text())
            const href = link.attr('href') || el.find('a.thumb').attr('href')
            const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''
            const image = this.getImageSrc(el.find('img'))
            const subtitle = el.find('.xanh').first().text().trim()

            if (id && title) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        latest.items = latestItems

        const trendingItems: PartialSourceManga[] = []
        $('#chapters-slide .entry').each((_: any, item: any) => {
            const el = $(item)
            if (el.hasClass('slick-cloned')) return
            const titleEl = el.find('a.manga-title')
            const title = this.cleanTitle(titleEl.text())
            const href = titleEl.attr('href')
            const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''
            const image = this.getImageSrc(el.find('img'))
            const subtitle = el.find('.chapter').text().trim()

            if (id && title) {
                trendingItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        trending.items = trendingItems
    }

    parseViewMore($: any): PartialSourceManga[] {
        const manga: PartialSourceManga[] = []
        $('.comics-grid .entry').each((_: any, item: any) => {
            const el = $(item)
            const titleEl = el.find('a.manga-title')
            const title = this.cleanTitle(titleEl.text())
            const href = titleEl.attr('href')
            const id = href?.split('/manga/')[1]?.split('/')[0] ?? ''
            const image = this.getImageSrc(el.find('img'))
            
            if (id && title) {
                manga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title
                }))
            }
        })
        return manga
    }
}