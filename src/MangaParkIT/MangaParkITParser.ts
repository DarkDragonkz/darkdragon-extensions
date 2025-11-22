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

export class MangaParkITParser {

    protected convertTime(timeAgo: string): Date {
        let time: Date
        let trimmed = Number((/\d*/.exec(timeAgo) ?? [])[0])
        trimmed = (trimmed === 0 && timeAgo.includes('a')) ? 1 : trimmed
        if (timeAgo.includes('min')) {
            time = new Date(Date.now() - trimmed * 60000)
        } else if (timeAgo.includes('hour') || timeAgo.includes('ore')) {
            time = new Date(Date.now() - trimmed * 3600000)
        } else if (timeAgo.includes('day') || timeAgo.includes('giorn')) {
            time = new Date(Date.now() - trimmed * 86400000)
        } else if (timeAgo.includes('year') || timeAgo.includes('anni')) {
            time = new Date(Date.now() - trimmed * 31556952000)
        } else {
            time = new Date(timeAgo)
        }
        if (isNaN(time.getTime())) return new Date()
        return time
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const title = $('h3 a').first().text().trim() || $('h1').first().text().trim() || 'Unknown'
        
        let image = $('.w-24 img, .w-52 img').first().attr('src') || ''
        if (image.startsWith('/')) image = 'https://mangapark.io' + image
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        const author = $('a[href*="/search?word="]').first().text().trim() || 'Unknown'
        const desc = $('.limit-html-p').text().trim() || $('meta[name="description"]').attr('content') || 'No description'
        const status = 'Ongoing' 

        const arrayTags: Tag[] = []
        $('.opacity-70 span, .genres a').each((_: any, el: any) => {
            const label = $(el).text().trim().replace(/,$/, '')
            if (label && label.length > 1) {
                arrayTags.push(App.createTag({ id: label, label: label }))
            }
        })
        
        const tagSections: TagSection[] = [
            App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags })
        ]
        
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
        const seenIds = new Set<string>()
        
        // FIX: Selettore corretto per MangaPark v5 (dentro div chapter-list)
        // I link sono del tipo: /title/ID_MANGA/ID_CAPITOLO
        const chapterNodes = $('div[data-name="chapter-list"] a[href*="/title/"]').toArray()

        for (const node of chapterNodes) {
            const $link = $(node)
            const href = $link.attr('href')
            
            // Assicuriamoci che sia un link al capitolo e contenga l'ID del manga
            if (!href || !href.includes(mangaId)) continue

            // Estrazione ID Capitolo (ultima parte dell'URL)
            // es: /title/386006-it-usemono-yado/8314523-vol-3-ch-18 -> 8314523-vol-3-ch-18
            const parts = href.split('/')
            const chapterId = parts.pop()
            
            // Evita link duplicati o che non sono capitoli specifici
            if (!chapterId || seenIds.has(chapterId)) continue
            seenIds.add(chapterId)

            const title = $link.text().trim()
            
            // Data
            const timeNode = $link.closest('.flex').find('time')
            const timeStr = timeNode.text().trim()
            // Fallback timestamp se disponibile
            const timeTs = timeNode.attr('data-time')
            const time = timeTs ? new Date(Number(timeTs)) : this.convertTime(timeStr)

            // Parsing numero capitolo
            let chapNum = 0
            const chapNumMatch = title.match(/(\d+(\.\d+)?)/g)
            if (chapNumMatch && chapNumMatch.length > 0) {
                // Prende l'ultimo numero trovato nel titolo (es: Vol.3 Ch.18 -> 18)
                chapNum = parseFloat(chapNumMatch[chapNumMatch.length - 1] ?? '0')
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: title,
                chapNum: chapNum,
                time: time,
                langCode: 'it'
            }))
        }

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // Metodo 1: Estrazione da Script JSON (MangaPark V5)
        const scripts = $('script').toArray()
        for (const script of scripts) {
            const content = $(script).html()
            if (content && (content.includes('srcs') || content.includes('http'))) {
                // Regex per trovare URL di immagini all'interno di array JSON
                const matches = content.match(/\"(https?:\/\/[^\"]+\.(?:jpg|jpeg|png|webp))\"/gi)
                if (matches && matches.length > 0) {
                    for (const m of matches) {
                         // Rimuovi le virgolette e escape
                         const url = m.replace(/"/g, '').replace(/\\/g, '')
                         pages.push(url)
                    }
                    if (pages.length > 0) break
                }
            }
        }

        // Metodo 2: Fallback DOM (Lazy Loading images)
        if (pages.length == 0) {
             const imgs = $('img[loading="lazy"], .main img, #main img').toArray()
             for (const img of imgs) {
                 let src = $(img).attr('src') || $(img).attr('data-src')
                 if (src && src.startsWith('http')) pages.push(src)
             }
        }
        
        // Fallback estremo: se ancora 0, non crashare ma restituisci array vuoto
        // (L'app mostrerà pagina bianca ma non si chiuderà)

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: [...new Set(pages)] // Rimuovi duplicati
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        const items = $('.flex.border-b.border-b-base-200').toArray()
        
        for (const item of items) {
            const $item = $(item)
            const titleLink = $item.find('h3 a').first()
            const title = titleLink.text().trim()
            const id = titleLink.attr('href')?.split('/').pop()

            let image = $item.find('img').first().attr('src') || ''
            if (image.startsWith('/')) image = 'https://mangapark.io' + image
            if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

            const subtitle = $item.find('.flex.justify-between a').first().text().trim()

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        }
        
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popolari in Italia', containsMoreItems: true, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Aggiornamenti Recenti (IT)', containsMoreItems: true, type: HomeSectionType.singleRowNormal })

        const mangas = this.parseSearchResults($)
        
        popularSection.items = mangas
        sectionCallback(popularSection)
        
        latestSection.items = mangas
        sectionCallback(latestSection)
    }
}