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

export class NineMangaITParser {

    private getImageSrc(element: any): string {
        let img = element.find('img').first()
        if (element.is('img')) img = element

        let src = img.attr('src') || img.attr('data-src')
        if (!src || src.includes('logo')) return 'https://paperback.moe/icons/logo-alt.svg'

        src = src.trim()
        if (src.startsWith('//')) src = `https:${src}`
        else if (src.startsWith('/')) src = `https://it.ninemanga.com${src}`
        
        return src
    }

    /**
     * Estrae l'ID corretto anche se il link punta a un capitolo (comune nella home mobile)
     */
    private extractMangaId(url: string | undefined): string | null {
        if (!url) return null
        const match = url.match(/\/(?:manga|chapter)\/([^\/]+?)(?:\.html|\/|$)/)
        return match ? match[1] : null
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1').first().text().trim() || 'Titolo Sconosciuto'
        title = title.replace(/ Manga$/, '').trim()
        
        let imageElement = $('.bookintro img').first()
        if (imageElement.length === 0) imageElement = $('.manga-cover img').first()
        const image = this.getImageSrc(imageElement)

        const author = $('a[itemprop="author"]').first().text().trim() || 'Unknown'
        
        let desc = $('p[itemprop="description"]').text().trim()
        if (!desc) {
            const intro = $('.bookintro').clone()
            intro.find('*').remove() // Rimuove tutto tranne il testo diretto
            desc = intro.text().trim()
        }
        desc = desc.replace(/^Sommario:\s*/i, '').trim() || 'Nessuna descrizione.'
        
        let status = 'Ongoing'
        const statusText = $('.red, .blue').text().toLowerCase()
        if (statusText.includes('completato') || statusText.includes('completed')) status = 'Completed'

        const arrayTags: Tag[] = []
        $('.bookintro a[href*="/category/"]').each((_: any, el: any) => {
            const $el = $(el)
            const id = $el.attr('href')?.split('/').pop()?.replace('.html', '') ?? ''
            const label = $el.text().trim()
            if (id && label) arrayTags.push({ id, label })
        })

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: 'Unknown',
                desc: desc,
                tags: [App.createTagSection({ id: '0', label: 'Generi', tags: arrayTags })]
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const seenIds = new Set<string>()

        // Selettore Mobile: ul.chapter_list a.chapter_list_a
        const links = $('ul.chapter_list a.chapter_list_a').toArray()

        for (const link of links) {
            const $link = $(link)
            const href = $link.attr('href')
            if (!href) continue

            const filePart = href.split('/').pop() ?? ''
            const chapterId = filePart.split('?')[0].replace('.html', '')
            
            if (chapterId.includes('-')) continue 
            
            if (seenIds.has(chapterId)) continue
            seenIds.add(chapterId)

            let titleRaw = $link.attr('title') || $link.text().trim()
            
            // Pulizia Titolo: Rimuove "NomeManga" dal titolo del capitolo
            const cleanMangaName = mangaId.replace(/[-_]/g, ' ').replace(/\s+/g, '.*')
            titleRaw = titleRaw.replace(new RegExp(cleanMangaName, 'gi'), '').trim()
            titleRaw = titleRaw.replace(new RegExp(mangaId, 'gi'), '').trim()

            const dateText = $link.parent().find('span').last().text().trim()
            let time = new Date()
            if (dateText && !dateText.includes('ago')) {
                 const parsedDate = new Date(dateText)
                 if (!isNaN(parsedDate.getTime())) time = parsedDate
            }

            const chapNumMatch = titleRaw.match(/(\d+(\.\d+)?)/g)
            let chapNum = 0
            if (chapNumMatch && chapNumMatch.length > 0) {
                chapNum = parseFloat(chapNumMatch[chapNumMatch.length - 1])
            }

            let name = titleRaw
            name = name.replace(/^(chapter|ch|vol|c)\.?\s*\d+/i, '').trim()
            name = name.replace(/^[-–—:]+\s*/, '').trim()
            
            if (name === String(chapNum) || name === '') name = ''

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                time: time,
                langCode: 'it'
            }))
        }
        
        return chapters
    }

    async parseChapterDetails(
        $: any, 
        mangaId: string, 
        chapterId: string, 
        source: any 
    ): Promise<ChapterDetails> {
        // Mobile Reader: <select id="page"> contiene tutte le pagine
        const pageUrls: string[] = []
        
        $('select#page option').each((_: any, obj: any) => {
            let val = $(obj).attr('value') ?? ''
            if (val && val !== '0') {
                 if (val.startsWith('/')) val = source.baseUrl + val
                 pageUrls.push(val)
            }
        })

        // Fallback immagine singola
        if (pageUrls.length === 0) {
             const img = $('img.manga_pic').first()
             const src = this.getImageSrc(img)
             if (src && !src.includes('logo-alt')) {
                 return App.createChapterDetails({ id: chapterId, mangaId, pages: [src] })
             }
             return App.createChapterDetails({ id: chapterId, mangaId, pages: [] })
        }

        // Fetch parallelo (Source-managed)
        const promises = pageUrls.map(url => this.fetchImageFromPage(url, source))
        const results = await Promise.all(promises)
        const pages = results.filter(u => u !== null) as string[]

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)]
        })
    }

    private async fetchImageFromPage(url: string, source: any): Promise<string | null> {
        try {
            const request = App.createRequest({
                url: url,
                method: 'GET',
                headers: {
                    'Referer': source.baseUrl, 
                    'User-Agent': source.userAgent,
                    'Cookie': 'is_warning=1; my_limit=1; waring=1'
                }
            })
            const response = await source.requestManager.schedule(request, 1)
            const $ = source.cheerio.load(response.data)
            
            const img = $('img.manga_pic').first()
            const src = img.attr('src')
            if (src && !src.includes('logo')) {
                 if (src.startsWith('//')) return `https:${src}`
                 if (src.startsWith('/')) return `${source.baseUrl}${src}`
                 return src
            }
            return null
        } catch (e) {
            return null
        }
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        // Mobile search result list
        $('.book-list li, dl.book-list dd').each((_: any, item: any) => {
            const $item = $(item)
            const link = $item.find('a.bookname').first()
            const href = link.attr('href')
            
            const id = this.extractMangaId(href)
            if (!id) return

            const image = this.getImageSrc($item)
            const title = link.text().trim() || 'Titolo Sconosciuto'

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        })
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popolari 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Ultimi Aggiornamenti 🆙', containsMoreItems: true, type: HomeSectionType.continuous })
        const newSection = App.createHomeSection({ id: 'new', title: 'Nuove Uscite 🆕', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const newItems: PartialSourceManga[] = []

        const parseList = (selector: string, target: PartialSourceManga[]) => {
            $(selector).find('li, dd').each((_: any, el: any) => {
                const $el = $(el)
                let link = $el.find('a.bookname').first()
                if (link.length === 0) link = $el.find('a').first()
                
                const href = link.attr('href')
                const id = this.extractMangaId(href) // ID corretto (Manga, non capitolo)
                
                if (!id) return

                const image = this.getImageSrc($el)
                let title = link.text().trim()
                
                // Rimuove numeri finali dal titolo della home
                title = title.replace(/\s+\d+(\.\d+)?$/, '').trim()
                
                target.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            })
        }

        // Selettori Mobile confermati
        parseList('#tab_content_3', popularItems) // Popolari
        parseList('#tab_content_2', latestItems)  // Ultimi
        parseList('#tab_content_1', newItems)     // Nuovi

        popularSection.items = popularItems
        latestSection.items = latestItems
        newSection.items = newItems

        sectionCallback(popularSection)
        sectionCallback(latestSection)
        sectionCallback(newSection)
    }
}