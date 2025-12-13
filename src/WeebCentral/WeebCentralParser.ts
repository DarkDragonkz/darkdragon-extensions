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
        // Titolo
        // Di solito è nell'header o nel metadata, ma dall'HTML fornito sembra essere nascosto o
        // dobbiamo prenderlo dalla pagina principale.
        // Assumiamo che il titolo sia nel blocco hidden per mobile o desktop
        let title = $('h1').first().text().trim() 
        if (!title) title = $('picture img').attr('alt')?.replace(' cover', '') ?? 'Unknown'

        // Immagine
        let image = $('picture source').attr('srcset') ?? ''
        if (!image) image = $('picture img').attr('src') ?? ''
        
        let desc = ''
        // Cerca la descrizione (spesso in un paragrafo o section dedicata non inclusa nell'HTML parziale, 
        // ma useremo un selettore generico se presente)
        desc = $('p.text-lg').text().trim() || 'No description'

        let status = 'Ongoing'
        let author = 'Unknown'
        let artist = 'Unknown'
        const arrayTags: Tag[] = []

        // Parsing Metadata (Author, Status, Tags) dalla lista <ul>
        // Cerca i <li> che contengono <strong>Author(s): </strong> ecc.
        $('ul.flex.flex-col.gap-4 li').each((_: any, li: any) => {
            const label = $('strong', li).text().trim()
            const value = $(li).clone().children().remove().end().text().trim() // Testo senza figli
            const links = $('a', li) // Link interni (es. autori, tag)

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
                    const tagId = tagLabel // Non abbiamo ID numerici, usiamo il nome
                    arrayTags.push(App.createTag({ id: tagId, label: tagLabel }))
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
                artist: artist, // Spesso artista e autore sono insieme
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any): Chapter[] {
        const chapters: Chapter[] = []

        // Selettore per i blocchi capitolo
        // Cerca i div che contengono i link ai capitoli dentro #chapter-list
        $('#chapter-list > div').each((_: any, div: any) => {
            const link = $('a', div).first()
            const href = link.attr('href')
            if (!href) return

            // Estrai ID Capitolo dall'URL: /chapters/ID
            const chapterId = href.split('/chapters/')[1]
            if (!chapterId) return

            // Estrai Titolo e Numero
            // <span class="">Chapter 200</span>
            const name = link.find('span.grow span').first().text().trim()
            
            // Parsing numero capitolo
            const chapNumMatch = name.match(/Chapter\s+(\d+(\.\d+)?)/i)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0

            // Data
            // <time ... datetime="2024-09-07...">Sep 7, 2024</time>
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

    // In WeebCentral la pagina dei risultati ha una struttura simile
    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []

        // Cerca gli articoli nella griglia
        $('article.bg-base-300').each((_: any, article: any) => {
            const link = $('a', article).first()
            const href = link.attr('href')
            
            // Estrai ID Manga: /series/ID/slug
            const id = href?.split('/series/')[1]?.split('/')[0]
            if (!id) return

            const title = $('div.text-white.text-lg', article).text().trim()
            
            // Immagine: cerca nei tag source o img
            let image = $('source', article).attr('srcset')
            if (!image) image = $('img', article).attr('src') ?? ''

            results.push(App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            }))
        })

        return results
    }
    
    // Per i dettagli del capitolo (immagini) servirà un'analisi successiva
    // poiché non hai mandato l'HTML del lettore.
    // Metto un placeholder
    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails {
        const pages: string[] = []
        // TODO: Implementare quando avremo l'HTML del lettore
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        })
    }
}