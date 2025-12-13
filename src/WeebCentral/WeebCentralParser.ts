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

const BASE_URL = 'https://weebcentral.com'

export class WeebCentralParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // Titolo: H1 o fallback su alt immagine
        let title = $('h1').first().text().trim() 
        if (!title) title = $('picture img').attr('alt')?.replace(' cover', '') ?? 'Unknown'

        // Immagine
        let image = $('picture source').attr('srcset') ?? ''
        if (!image) image = $('picture img').attr('src') ?? ''
        
        const desc = $('p.text-lg').text().trim() || 'No description'

        let status = 'Ongoing'
        let author = 'Unknown'
        let artist = 'Unknown'
        const arrayTags: Tag[] = []

        // Parsing Metadata
        $('ul.flex.flex-col.gap-4 li').each((_: any, li: any) => {
            const label = $('strong', li).text().trim()
            const links = $('a', li)

            if (label.includes('Author')) {
                author = links.map((_: any, a: any) => $(a).text().trim()).get().join(', ')
            }
            if (label.includes('Status')) {
                const statusText = links.first().text().trim().toLowerCase()
                if (statusText.includes('complete')) status = 'Completed'
                else if (statusText.includes('ongoing')) status = 'Ongoing'
                else if (statusText.includes('hiatus')) status = 'Hiatus'
            }
            if (label.includes('Tags') || label.includes('Type')) {
                links.each((_: any, a: any) => {
                    const tagLabel = $(a).text().trim()
                    if (tagLabel) {
                        arrayTags.push(App.createTag({ id: tagLabel, label: tagLabel }))
                    }
                })
            }
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

    parseChapters($: any): Chapter[] {
        const chapters: Chapter[] = []

        $('#chapter-list > div').each((_: any, div: any) => {
            const link = $('a', div).first()
            const href = link.attr('href')
            if (!href) return

            const chapterId = href.split('/chapters/')[1]
            if (!chapterId) return

            const name = link.find('span.grow span').first().text().trim()
            const chapNumMatch = name.match(/Chapter\s+(\d+(\.\d+)?)/i)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

            const dateStr = link.find('time').attr('datetime')
            const time = dateStr ? new Date(dateStr) : new Date()

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                time: time,
                langCode: 'en'
            }))
        })

        return chapters
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []

        // LOGICA PRESA DA "SOURCE.JS" (Quello funzionante)
        // Cerca ogni tag <article> (usato sia per griglia che lista)
        $('article').each((_: any, article: any) => {
            
            // 1. Trova il link alla serie
            const link = $('a[href*="/series/"]', article).first()
            const href = link.attr('href')
            
            // 2. Estrai ID
            // Format: /series/ID/Slug o /series/ID
            const id = href?.split('/series/')[1]?.split('/')[0]
            if (!id) return

            // 3. Immagine
            // Cerca prima source (webp alta qualità), poi img
            let image = $('source', article).attr('srcset')
            const imgTag = $('img', article).first()
            if (!image) image = imgTag.attr('src') ?? ''

            // 4. Titolo (Il trucco vincente: usare l'ALT dell'immagine)
            // L'altro autore usava questo metodo perché il testo è spesso nascosto o spostato via CSS
            let title = imgTag.attr('alt')
            
            // Pulizia titolo (rimuove " cover" se presente alla fine)
            if (title) {
                title = title.replace(/ cover$/i, '').trim()
            } else {
                // Fallback se l'alt manca
                title = $('.text-lg', article).text().trim() ?? 'Unknown'
            }

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        })

        return results
    }
    
    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }
}