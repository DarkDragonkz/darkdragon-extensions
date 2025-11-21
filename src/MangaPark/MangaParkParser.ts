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

const MP_DOMAIN = 'https://mangapark.net'

export class MangaParkParser {

    // Helper robusto per le immagini
    private getImageSrc(element: any, selector: string = 'img'): string {
        let img = element.find(selector).first()
        let src = img.attr('src') || img.attr('data-src') || img.attr('srcset')
        
        if (!src || src.includes('data:image')) {
            return 'https://paperback.moe/icons/logo-alt.svg'
        }

        if (src.startsWith('//')) src = `https:${src}`
        else if (src.startsWith('/')) src = `${MP_DOMAIN}${src}`
        
        return src
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // 1. Titolo: Proviamo vari selettori
        let title = $('h3 a.link-hover').first().text().trim()
        if (!title) title = $('.comic-detail h3').first().text().trim()
        if (!title) title = $('title').text().split('-')[0]?.trim() ?? 'Unknown Title'

        // 2. Immagine
        // Cerca l'immagine principale nel dettaglio
        let image = this.getImageSrc($, '.w-24 img, .w-32 img, .w-52 img, div.relative img')

        // 3. Descrizione
        let desc = $('.limit-html-p').text().trim()
        if (!desc) desc = $('.limit-html').text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') ?? 'No description available'

        // 4. Autore
        const authors: string[] = []
        $('a[href*="/search?word="]').each((_: any, el: any) => {
            const text = $(el).text().trim()
            // Escludiamo link che sembrano tag o generi
            if (text && !text.includes('All') && $(el).parent().text().includes('Story')) {
                authors.push(text)
            }
        })
        let author = authors.length > 0 ? authors.join(', ') : 'Unknown'

        // 5. Status
        let status = 'Ongoing'
        const statusText = $('span.font-bold.uppercase.text-success, span.font-bold.uppercase.text-info').text().trim().toLowerCase()
        if (statusText.includes('completed')) status = 'Completed'
        if (statusText.includes('hiatus')) status = 'Hiatus'

        // 6. Generi
        const arrayTags: Tag[] = []
        // Cerchiamo i link dei generi
        $('a[href^="/search?genres="]').each((_: any, el: any) => {
            const id = $(el).text().trim()
            if (id) arrayTags.push({ id: id.toLowerCase(), label: id })
        })
        
        const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })]

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                artist: '',
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Cerca tutti i blocchi che sembrano capitoli
        // Nel tuo HTML: div con classi border-b e bg-accent/5
        const chapterNodes = $('div.group.flex.flex-col > div.border-b').toArray()

        for (const node of chapterNodes) {
            const linkElement = $('a.link-hover.link-primary', node).first()
            const href = linkElement.attr('href')
            
            if (!href) continue

            // ID dall'URL
            const chapterId = href.split('/').pop()
            if (!chapterId) continue

            const titleRaw = linkElement.text().trim() // Es: "Vol.0 Ch.78"
            const timeStr = $('time', node).text().trim()
            
            // Parsing numeri
            const chapNumMatch = titleRaw.match(/Ch\.(\d+(\.\d+)?)/i)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0
            
            const volMatch = titleRaw.match(/Vol\.(\d+)/i)
            const volNum = volMatch ? parseFloat(volMatch[1]) : undefined

            let name = titleRaw
            // Cerca titolo extra nello span adiacente
            const extraSpan = linkElement.next('span')
            if (extraSpan.length > 0) {
                const extraText = extraSpan.text().trim().replace(/^:\s*/, '')
                if (extraText) name += ` - ${extraText}`
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: volNum,
                time: this.convertTime(timeStr),
                langCode: 'en'
            }))
        }

        return chapters
    }

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // Selettore per le card nella griglia di ricerca
        const items = $('div.group.relative').toArray()

        for (const item of items) {
            const link = $('a', item).first()
            const href = link.attr('href')
            // Cerca ID numerico nell'URL (es /title/123456-name)
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null
            
            if (!id || seenIds.has(id)) continue
            seenIds.add(id)

            const image = this.getImageSrc($(item))
            
            // Il titolo è spesso nascosto nel box nero in hover o nell'attributo title dell'immagine
            let title = $('img', item).attr('title') 
            if (!title) title = $('img', item).attr('alt')
            if (!title) title = $(item).find('.bg-black\\/60 a').first().text().trim()
            if (!title) title = 'Unknown Title'

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        }
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popular Updates', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Releases', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        
        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // Nella home, le card sono dentro div.grid > div.relative.w-full.group
        const gridItems = $('div.grid > div.relative.w-full.group').toArray()

        for (let i = 0; i < gridItems.length; i++) {
            const item = gridItems[i]
            const link = $('a', item).first()
            const href = link.attr('href')
            
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null

            if (!id || seenIds.has(id)) continue
            seenIds.add(id)

            const image = this.getImageSrc($(item))
            
            let title = $('img', item).attr('title') || $('img', item).attr('alt')
            if (!title) title = $(item).find('.bg-black\\/60 a').first().text().trim()
            if (!title) title = 'Unknown'

            const manga = App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            })

            // Mettiamo i primi 12 in popular, il resto in latest
            if (popularItems.length < 12) {
                popularItems.push(manga)
            } else {
                latestItems.push(manga)
            }
        }

        popularSection.items = popularItems
        latestSection.items = latestItems
        
        sectionCallback(popularSection)
        sectionCallback(latestSection)
    }

    private convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed === 0 && timeAgo.includes('a')) ? 1 : trimmed
        
        if (timeAgo.includes('mins') || timeAgo.includes('minutes') || timeAgo.includes('minute')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hours') || timeAgo.includes('hour')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('days') || timeAgo.includes('day')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('year') || timeAgo.includes('years')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        if (isNaN(time.getTime())) return new Date()
        return time
    }
}