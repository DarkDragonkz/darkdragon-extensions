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
        let title = $('h3.text-lg.font-bold a').first().text().trim()
        if (!title) title = $('h3.text-2xl.font-bold a').first().text().trim()
        if (!title) title = $('h1').text().trim() || 'Unknown'
        
        let image = $('.w-24 img, .w-52 img').first().attr('src') || ''
        if (image.startsWith('/')) image = 'https://mangapark.io' + image
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        const author = $('a[href*="/search?word="]').first().text().trim() || 'Unknown'
        
        let desc = $('.limit-html-p').text().trim()
        if (!desc) desc = $('meta[name="description"]').attr('content') || ''
        
        const status = 'Ongoing' 

        const arrayTags: Tag[] = []
        const tagElements = $('.opacity-70 span, .genres a').toArray()
        for (const el of tagElements) {
            const label = $(el).text().trim().replace(/,$/, '')
            if (label && label.length > 1) arrayTags.push(App.createTag({ id: label, label: label }))
        }
        
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
        
        // FIX: Usiamo .toArray() e ciclo for per stabilità
        const chapterList = $('div[data-name="chapter-list"] .flex.border-b, div[data-name="chapter-list"] .px-2').toArray()
        
        for (const element of chapterList) {
            const row = $(element)
            const link = row.find('a').first()
            const href = link.attr('href')
            
            // L'URL deve contenere l'ID del manga per essere valido
            if (!href || !href.includes(mangaId)) continue

            // Estrai ID capitolo (es: 8314523-vol-3-ch-18)
            const parts = href.split('/')
            const chapterId = parts.pop() 

            if (!chapterId) continue

            const title = link.text().trim()
            const timeStr = row.find('time').text().trim()
            
            // FIX: Parsing numero capitolo corretto (prendiamo il gruppo 1 della regex)
            let chapNum = 0
            const chapNumMatch = title.match(/(?:ch|chapter|episode|c)(?:\.|apters?|\s)*\s*(\d+(\.\d+)?)/i)
            if (chapNumMatch && chapNumMatch[1]) {
                chapNum = parseFloat(chapNumMatch[1])
            } else {
                // Fallback: cerca l'ultimo numero nel titolo
                const simpleNums = title.match(/(\d+(\.\d+)?)/g)
                if (simpleNums && simpleNums.length > 0) {
                    chapNum = parseFloat(simpleNums[simpleNums.length - 1] ?? '0')
                }
            }

            chapters.push(App.createChapter({
                id: chapterId,
                name: title,
                chapNum: chapNum,
                time: this.convertTime(timeStr),
                langCode: 'it'
            }))
        }

        return chapters
    }

    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        
        // Cerca URL immagini negli script JSON (Metodo principale per MP v5)
        const scripts = $('script').toArray()
        for (const script of scripts) {
            const content = $(script).html()
            if (content && (content.includes('srcs') || content.includes('http'))) {
                // Cerca array di immagini o URL singoli
                const matches = content.match(/\"(https?:\/\/[^\"]+\.(?:jpg|jpeg|png|webp))\"/gi)
                if (matches) {
                    for (const m of matches) {
                         const url = m.replace(/"/g, '').replace(/\\/g, '')
                         pages.push(url)
                    }
                    // Se ne troviamo, ci fermiamo
                    if (pages.length > 0) break
                }
            }
        }

        // Fallback DOM: Cerca tag img lazy loaded
        if (pages.length == 0) {
             const imgs = $('img[loading="lazy"], .main img').toArray()
             for (const img of imgs) {
                 let src = $(img).attr('src') || $(img).attr('data-src')
                 if (src && src.startsWith('http')) pages.push(src)
             }
        }

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
            const titleLink = $('h3.font-bold a', item)
            const title = titleLink.text().trim()
            const id = titleLink.attr('href')?.split('/').pop()

            let image = $('img', item).attr('src') || ''
            if (image.startsWith('/')) image = 'https://mangapark.io' + image

            const subtitle = $('div.flex.justify-between a', item).first().text().trim()

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