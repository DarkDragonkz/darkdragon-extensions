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

export class MangaParkParser {

    parseMangaDetails($: any, mangaId: string): SourceManga {
        // 1. Titolo
        const title = $('h3.font-bold a').first().text().trim() || 'Unknown Title'

        // 2. Immagine
        // Cerchiamo l'immagine principale nella colonna di sinistra
        let image = $('.w-24.md\\:w-52 img').attr('src') 
        if (!image) image = $('img.shadow-md').attr('src') // Fallback
        if (!image) image = 'https://paperback.moe/icons/logo-alt.svg'

        // 3. Descrizione
        // È dentro un tag personalizzato <react-island> o div con classe limit-html
        let desc = $('.limit-html-p').text().trim()
        if (!desc) desc = $('.limit-html').text().trim()
        if (!desc) desc = 'No description available'

        // 4. Autore
        const author = $('a[href*="/search?word="]').first().text().trim() || 'Unknown'

        // 5. Status
        // Cerca il testo "Original Publication:" e prende lo span successivo
        let status = 'Ongoing'
        const statusText = $('.font-bold.uppercase.text-success').text().trim().toLowerCase()
        if (statusText.includes('completed')) status = 'Completed'
        if (statusText.includes('hiatus')) status = 'Hiatus'

        // 6. Generi
        const arrayTags: Tag[] = []
        // I generi sono spesso link o span dopo la label "Genres:"
        // Nel tuo HTML: <div class="flex items-center flex-wrap"><b>Genres:</b><span>...</span>
        $('div.flex.items-center.flex-wrap').each((_: any, el: any) => {
            const label = $('b', el).text().trim()
            if (label.includes('Genres')) {
                $(el).find('span').each((__: any, span: any) => {
                    const tagText = $(span).text().replace(',', '').trim()
                    if (tagText && tagText !== 'Genres:') {
                         arrayTags.push({ id: tagText.toLowerCase(), label: tagText })
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
                artist: '',
                tags: tagSections,
                desc: desc
            })
        })
    }

    parseChapters($: any, mangaId: string): Chapter[] {
        const chapters: Chapter[] = []
        
        // Il contenitore dei capitoli è identificato da data-name="chapter-list"
        // Dentro c'è .scrollable-panel -> .group.flex.flex-col
        const chapterNodes = $('div[data-name="chapter-list"] .scrollable-panel .group.flex.flex-col > div').toArray()

        for (const node of chapterNodes) {
            const linkElement = $('a.link-hover.link-primary', node).first()
            const href = linkElement.attr('href')
            
            // Estraiamo l'ID del capitolo dall'URL (es. .../9939308-vol-0-ch-78)
            // Prendiamo l'ultimo pezzo dell'URL
            const chapterId = href?.split('/').pop()

            if (!chapterId) continue

            const titleRaw = linkElement.text().trim() // Es: "Vol.0 Ch.78"
            const timeStr = $('time', node).text().trim() // Es: "4 mins ago"
            
            // Parsing numero capitolo
            const chapNumMatch = titleRaw.match(/Ch\.(\d+(\.\d+)?)/i)
            const chapNum = chapNumMatch ? parseFloat(chapNumMatch[1]) : 0
            
            // Parsing volume (opzionale)
            const volMatch = titleRaw.match(/Vol\.(\d+)/i)
            const volNum = volMatch ? parseFloat(volMatch[1]) : undefined

            // Titolo extra (es: ": Ancient Card")
            let extraTitle = $('span.opacity-80', node).text().trim().replace(/^:\s*/, '')
            
            let name = titleRaw
            if (extraTitle) name += ` - ${extraTitle}`

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

    // Helper per convertire date relative (es. "2 hours ago")
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

    // --- SEARCH & HOME ---
    // Questi rimangono simili ma usano selettori HTML robusti

    parseSearchResults($: any, baseUrl: string): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        // Cerca i blocchi nella griglia
        const items = $('.group.relative').toArray()
        
        for (const item of items) {
            const link = $('a', item).first()
            const href = link.attr('href')
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null
            
            if (!id) continue

            const image = $('img', item).attr('src') ?? ''
            const title = $('h3 a', $(item).parent().parent()).text().trim() || $('a.link-hover', item).text().trim()

            if (id && title) {
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }))
            }
        }
        return results
    }

    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void, baseUrl: string): void {
        const popularSection = App.createHomeSection({ id: 'popular', title: 'Popular Updates', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        const latestSection = App.createHomeSection({ id: 'latest', title: 'Latest Releases', containsMoreItems: false, type: HomeSectionType.singleRowNormal })
        
        const popularItems: PartialSourceManga[] = []
        const latestItems: PartialSourceManga[] = []
        const seenIds = new Set<string>()

        // Selettore per le card dei manga
        // MangaPark usa spesso griglie diverse per Popular e Latest
        
        // Proviamo a prendere tutti gli elementi griglia e dividerli
        const gridItems = $('div.grid div.relative.w-full.group').toArray()

        for (let i = 0; i < gridItems.length; i++) {
            const item = gridItems[i]
            const link = $('a', item).first()
            const href = link.attr('href')
            
            // ID numerico (es. 12195)
            const idMatch = href?.match(/\/title\/(\d+)-/)
            const id = idMatch ? idMatch[1] : null

            if (!id || seenIds.has(id)) continue
            seenIds.add(id)

            let image = $('img', item).attr('src') ?? ''
            // Fallback titolo: cerca nel blocco hover nero o nel fratello
            let title = $(item).find('.bg-black\\/60 a.font-bold').text().trim()
            
            // Se non trova il titolo nel box hover, guarda fuori (layout lista)
            if (!title) {
                // Risali e cerca h3
                title = $(item).closest('.flex').find('h3 a').text().trim()
            }
            
            if (!title) title = 'Unknown'

            const manga = App.createPartialSourceManga({
                mangaId: id,
                image: image,
                title: title,
                subtitle: undefined
            })

            // Euristicamente: i primi sono popolari
            if (i < 12) {
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
}