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

    // Helper per correggere URL immagini
    private fixImageUrl(url: string | undefined): string {
        if (!url) return 'https://paperback.moe/icons/logo-alt.svg'
        if (url.startsWith('//')) return `https:${url}`
        if (url.startsWith('/')) return `${MP_DOMAIN}${url}`
        return url
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // FIX: Rimosso l'uso di helper errati che causavano il crash "element.find"
        
        // 1. Titolo
        let title = $('h3 a.link-hover').first().text().trim()
        if (!title) title = $('.comic-detail h3').first().text().trim()
        if (!title) title = $('title').text().split('-')[0]?.trim() ?? 'Unknown'

        // 2. Immagine (Selettore specifico per la pagina dettagli)
        // Cerca l'immagine nella colonna di sinistra (w-24 mobile, w-52 desktop)
        let image = $('.w-24 img').attr('src') || $('.w-52 img').attr('src') || $('div.relative img').attr('src')
        image = this.fixImageUrl(image)

        // 3. Descrizione
        let desc = $('.limit-html-p').text().trim()
        if (!desc) desc = $('.limit-html').text().trim()
        if (!desc) desc = 'No description available'

        // 4. Autore
        const authors: string[] = []
        $('a[href*="/search?word="]').each((_: any, el: any) => {
            // Cerca link che sono dentro un nodo di testo che indica l'autore
            const parentText = $(el).parent().text()
            if (parentText.includes('Story') || parentText.includes('Art')) {
                authors.push($(el).text().trim())
            }
        })
        let author = authors.length > 0 ? [...new Set(authors)].join(', ') : 'Unknown'

        // 5. Status
        let status = 'Ongoing'
        const statusText = $('span.font-bold.uppercase').text().trim().toLowerCase()
        if (statusText.includes('completed')) status = 'Completed'
        if (statusText.includes('hiatus')) status = 'Hiatus'

        // 6. Generi
        const arrayTags: Tag[] = []
        $('a[href^="/search?genres="]').each((_: any, el: any) => {
            const tagText = $(el).text().trim()
            if (tagText) arrayTags.push({ id: tagText.toLowerCase(), label: tagText })
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
        
        // Cerca i blocchi capitolo. Solitamente sono in una lista verticale.
        // Usiamo un selettore che cerca i link che puntano a un capitolo specifico
        const chapterLinks = $('a.link-hover.link-primary[href*="/title/"]').toArray()

        for (const el of chapterLinks) {
            const link = $(el)
            const href = link.attr('href')
            
            // Filtra link che non sono capitoli (devono avere un ID numerico alla fine)
            // Es: /title/12345-name/9939308-vol-0-ch-78
            if (!href || !href.match(/\/\d+-.*-ch-/)) continue

            // Estrai ID
            const chapterId = href.split('/').pop()
            if (!chapterId) continue

            const titleRaw = link.text().trim()
            
            // Cerca la data nel parent o vicino
            // Risaliamo al contenitore riga (div border-b)
            const row = link.closest('div.border-b')
            const timeStr = row.find('time').text().trim()

            // Parsing numeri
            const chapNumMatch = titleRaw.match(/Ch\.(\d+(\.\d+)?)/i)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0
            
            const volMatch = titleRaw.match(/Vol\.(\d+)/i)
            const volNum = volMatch ? parseFloat(volMatch[1]) : undefined

            // Titolo extra
            let name = titleRaw
            const extraSpan = link.next('span.opacity-80')
            if (extraSpan.length > 0) {
                const extraText = extraSpan.text().replace(/^:\s*/, '').trim()
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

        // Nella ricerca usano una griglia di "group relative"
        const items = $('div.group.relative').toArray()

        for (const item of items) {
            const link = $('a', item).first()
            const href = link.attr('href')
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null
            
            if (!id || seenIds.has(id)) continue
            seenIds.add(id)

            let image = $('img', item).attr('src')
            image = this.fixImageUrl(image)

            let title = $('img', item).attr('title') || $('img', item).attr('alt')
            // Fallback ricerca titolo fuori dall'immagine
            if (!title) {
                title = $(item).closest('div.flex').find('h3 a').text().trim()
            }
            
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

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popular Updates', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Releases', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        
        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // --- SEZIONE POPULAR ---
        // Cerca la sezione "Popular Updates" e prende la griglia successiva
        // La griglia popolare usa elementi "div.relative.w-full.group"
        const popularGrid = $('b:contains("Popular Updates")').closest('div.space-y-5').find('div.grid div.relative.w-full.group').toArray()
        
        for (const item of popularGrid) {
            const link = $('a', item).first()
            const href = link.attr('href')
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null

            if (id && !seenIds.has(id)) {
                seenIds.add(id)
                let image = $('img', item).attr('src')
                image = this.fixImageUrl(image)
                
                let title = $('img', item).attr('title') || $('img', item).attr('alt')
                if (!title) title = $(item).find('a.link-hover').text().trim()

                popularItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title || 'Unknown',
                    subtitle: 'Popular'
                }))
            }
        }
        popularSection.items = popularItems
        sectionCallback(popularSection)

        // --- SEZIONE LATEST ---
        // La sezione Latest usa un layout a LISTA, non a griglia.
        // Cerca "Latest Releases" e poi i container "div.flex.border-b"
        const latestList = $('b:contains("Latest Releases")').closest('div.space-y-5').find('div.flex.border-b').toArray()

        for (const item of latestList) {
            const link = $('h3 a', item).first() // Il titolo è dentro un h3
            const href = link.attr('href')
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null
            
            // Evitiamo duplicati se un manga è sia in popular che latest
            if (id && !seenIds.has(id)) {
                seenIds.add(id)
                
                // L'immagine è nel div precedente
                let image = $('img', item).attr('src')
                image = this.fixImageUrl(image)
                
                const title = link.text().trim()
                const subtitle = $('div.flex.justify-between a', item).first().text().trim() // Ultimo capitolo

                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title || 'Unknown',
                    subtitle: subtitle
                }))
            }
        }
        latestSection.items = latestItems
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