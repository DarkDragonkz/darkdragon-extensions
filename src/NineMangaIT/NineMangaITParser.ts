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

        let src = img.attr('src') || img.attr('data-src') || img.attr('original') || img.attr('data-original')
        
        if (!src || src.includes('logo-alt')) return 'https://paperback.moe/icons/logo-alt.svg'

        src = src.trim()
        if (src.startsWith('//')) src = `https:${src}`
        else if (src.startsWith('/')) src = `https://it.ninemanga.com${src}`
        else if (src.startsWith('http:')) src = src.replace('http:', 'https:')

        return src
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        let title = $('h1[itemprop="name"]').first().text().trim()
        if (!title) title = $('.book-title').text().trim()
        if (!title) title = $('h1').first().text().trim()
        title = title.replace(/ Manga$/, '').trim()
        
        let imageElement = $('img[itemprop="image"]').first()
        if (imageElement.length === 0) imageElement = $('.bookintro img').first()
        if (imageElement.length === 0) imageElement = $('.manga-cover img').first()
        
        const image = this.getImageSrc(imageElement)

        const author = $('a[itemprop="author"]').first().text().trim() || 'Unknown'
        const artist = author 

        let desc = $('p[itemprop="description"]').text().trim()
        if (!desc) {
            const intro = $('.bookintro').clone()
            intro.find('ul, h1, div, a').remove() 
            desc = intro.text().trim()
        }
        if (!desc) desc = 'Nessuna descrizione disponibile.'
        desc = desc.replace(/^Sommario:\s*/i, '')
        
        let status = 'Ongoing'
        const statusText = $('.red, a[href*="completed"]').text().toLowerCase()
        if (statusText.includes('completato') || statusText.includes('completed')) status = 'Completed'

        const arrayTags: Tag[] = []
        $('li[itemprop="genre"] a').each((_: any, el: any) => {
            const $el = $(el)
            const id = $el.attr('href')?.split('/').pop()?.replace('.html', '') ?? ''
            const label = $el.text().trim()
            if (id && label) arrayTags.push({ id, label })
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
                desc: desc,
                tags: tagSections
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        const seenIds = new Set<string>()

        let chapterLinks = $('a.chapter_list_a').toArray()
        // Fallback se il layout cambia
        if (chapterLinks.length === 0) {
            chapterLinks = $('a[href*="/chapter/"]').toArray()
        }

        for (const link of chapterLinks) {
            const $link = $(link)
            const href = $link.attr('href')
            if (!href) continue

            const parts = href.split('/')
            const filePart = parts.pop() ?? '' 
            const chapterId = filePart.split('?')[0].replace('.html', '')

            // Evitiamo duplicati o link a pagine specifiche del capitolo (es. -10-1.html)
            if (seenIds.has(chapterId)) continue
            if (filePart.match(/-\d+-\d+\.html$/)) continue 

            seenIds.add(chapterId)

            let titleRaw = $link.attr('title') || $link.text().trim()
            // Rimuoviamo il nome del manga dal titolo del capitolo per pulizia
            titleRaw = titleRaw.replace(new RegExp(`^${mangaId.replace(/-/g, ' ')}\\s+`, 'i'), '')
            titleRaw = titleRaw.replace(mangaId, '').trim()

            const dateText = $link.parent().find('span').last().text().trim()
            let time = new Date()
            if (dateText) {
                // Tenta parsing data, fallback a oggi
                const parsedDate = new Date(dateText)
                if (!isNaN(parsedDate.getTime())) time = parsedDate
            }

            // Estrazione numero capitolo
            const chapNumMatch = titleRaw.match(/(?:ch|chapter|episode|c)\.?\s*(\d+(\.\d+)?)/i)
            let chapNum = 0
            if (chapNumMatch) {
                chapNum = parseFloat(chapNumMatch[1] ?? '0')
            } else {
                const simpleNums = titleRaw.match(/(\d+(\.\d+)?)/g)
                if (simpleNums && simpleNums.length > 0) {
                    chapNum = parseFloat(simpleNums[simpleNums.length - 1] ?? '0')
                }
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: titleRaw || 'Capitolo ' + chapNum,
                chapNum: chapNum,
                time: time,
                langCode: 'it'
            }))
        }
        return chapters
    }

    /**
     * OTTIMIZZAZIONE SENIOR: Caricamento Parallelo
     */
    async parseChapterDetails(
        $: any, 
        mangaId: string, 
        chapterId: string, 
        source: any 
    ): Promise<ChapterDetails> {
        // Raccogliamo tutti gli URL delle pagine dal dropdown
        const pageUrls: string[] = []
        $('select.sl-page option').each((_: any, obj: any) => {
            let pageUrl = $(obj).attr('value') ?? ''
            if (pageUrl.startsWith('/')) pageUrl = source.baseUrl + pageUrl
            if (pageUrl && !pageUrls.includes(pageUrl)) {
                pageUrls.push(pageUrl)
            }
        })

        // Se non trova dropdown, prova a parsare la pagina corrente (capitolo monolitico?)
        if (pageUrls.length === 0) {
             const singlePageImages = await this.getImageFromCheerio($, source)
             return App.createChapterDetails({
                id: chapterId,
                mangaId: mangaId,
                pages: singlePageImages
            })
        }

        // PARALLEL REQUESTS:
        // Creiamo una promise per ogni pagina. Il RequestManager di Paperback gestirà la coda
        // per non superare il rate limit (3 req/s), ma non aspettiamo il parsing di una per iniziare l'altra.
        const promises = pageUrls.map(url => this.getImage(url, source))
        
        // Attendiamo che tutte finiscano
        const results = await Promise.all(promises)
        
        // Appiattiamo l'array di array e rimuoviamo duplicati
        const allPages = [...new Set(results.flat())]

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: allPages
        })
    }

    // Helper per scaricare e parsare una singola pagina
    async getImage(url: string, source: any): Promise<string[]> {
        try {
            const request = App.createRequest({
                url: url,
                method: 'GET',
                headers: {
                    'Referer': source.baseUrl,
                    'User-Agent': source.userAgent
                }
            })
            
            const response = await source.requestManager.schedule(request, 1)
            const $ = source.cheerio.load(response.data)
            return this.getImageFromCheerio($, source)
        } catch (e) {
            console.error(`Failed to load page ${url}: ${e}`)
            return []
        }
    }

    // Estrae le immagini da un oggetto Cheerio
    async getImageFromCheerio($: any, source: any): Promise<string[]> {
        const arrImages: string[] = []
        
        // Selettore Desktop
        $('div.pic_box img.manga_pic').each((_: any, img: any) => {
             const src = $(img).attr('src')
             if (src) arrImages.push(src)
        })

        // Selettore Mobile/Fallback
        if (arrImages.length === 0) {
             $('img.manga_pic').each((_: any, img: any) => {
                 const src = $(img).attr('src')
                 if (src) arrImages.push(src)
             })
        }

        return arrImages
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const items = $('.book-list li, .direlist .bookinfo, dl, .comic-item').toArray()

        for (const item of items) {
            const $item = $(item)
            const link = $item.find('a[href*="/manga/"]').first()
            const href = link.attr('href')
            
            if (!href) continue

            const id = href.split('/manga/')[1]?.replace('.html', '')
            if (!id) continue

            const image = this.getImageSrc($item)

            let title = link.text().trim()
            if (!title) title = link.attr('title') ?? ''
            if (!title) title = $item.find('b, h3, dd.book-list').text().trim()
            if (!title) title = 'Unknown'

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        }
        return results
    }

    parseHomeSections($home: any, $updates: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        // UI REFRESH: Popular = Large, Latest = Continuous
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popolari 🔥', containsMoreItems: true, type: HomeSectionType.singleRowLarge })
        const newSection = App.createHomeSection({ id: 'new', title: 'Nuove Uscite 🆕', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Ultimi Aggiornamenti 🆙', containsMoreItems: true, type: HomeSectionType.continuous })

        const popularItems: PartialSourceManga[] = []
        const newItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []

        const cleanTitle = (t: string) => t.replace(/(\s+(Vol\.|Ch\.|Chapter\.)?\s*\d+(\.\d+)?)+$/i, '').trim()

        const parseList = (selector: string, targetArray: PartialSourceManga[], subtitlePrefix: string | undefined) => {
            const list = $home(selector).toArray()
            for (const item of list) {
                const $item = $home(item)
                const link = $item.find('a').first()
                const href = link.attr('href')
                const id = href?.split('/manga/')[1]?.replace('.html', '')
                
                if (!id) continue

                const image = this.getImageSrc($item)
                
                const rawTitle = link.attr('title') || $item.find('span').text().trim()
                const title = cleanTitle(rawTitle)
                
                let subtitle = undefined
                if (subtitlePrefix) {
                     // Cerca info capitolo
                     const numMatch = rawTitle.match(/(\d+(\.\d+)?)$/)
                     if (numMatch) subtitle = `Ch. ${numMatch[0]}`
                }

                targetArray.push(App.createPartialSourceManga({ 
                    mangaId: id, 
                    image: image, 
                    title: title, 
                    subtitle: subtitle 
                }))
            }
        }

        parseList('#tab_content_3 li', popularItems, undefined)
        popularSection.items = popularItems
        sectionCallback(popularSection)

        parseList('#tab_content_1 li', newItems, undefined)
        newSection.items = newItems
        sectionCallback(newSection)

        parseList('#tab_content_2 li', latestItems, 'Ch.')
        latestSection.items = latestItems
        sectionCallback(latestSection)
    }
}