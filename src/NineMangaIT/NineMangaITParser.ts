import {
    Chapter,
    HomeSection,
    SourceManga,
    PartialSourceManga,
    Tag,
    TagSection,
} from '@paperback/types'

const BASE_URL = 'https://it.ninemanga.com'

export class NineMangaITParser {

    /**
     * Estrae l'URL dell'immagine da una pagina HTML singola.
     */
    extractImage($: any): string {
        // NineManga ha l'immagine principale dentro un div con classe 'pic_box' o simile, o direttamente un img con id 'manga_content'
        let img = $('img.manga_pic').first()
        if (img.length === 0) img = $('div.pic_box img').first()
        if (img.length === 0) img = $('center img').first()

        let src = img.attr('src')
        
        // Gestione server multipli e protocolli
        if (src) {
            if (src.startsWith('//')) src = `https:${src}`
            return src
        }
        return ''
    }

    private cleanTitle(title: string): string {
        return title.replace('Manga', '').trim()
    }

    private getImageSrc(element: any): string {
        let src = element.attr('src') ?? element.attr('data-original') ?? ''
        if (src.startsWith('//')) src = `https:${src}`
        return src || 'https://paperback.moe/icons/logo-alt.svg'
    }

    parseMangaDetails($: any, mangaId: string): SourceManga {
        const infoBox = $('.book_intro')
        
        const title = this.cleanTitle($('.book_intro .title h1').text().trim())
        const image = this.getImageSrc($('.book_intro .pic img'))
        
        let desc = $('p[itemprop="description"]').text().trim()
        // Rimuove testo inutile tipo "Trama:"
        desc = desc.replace(/^Trama\s*:\s*/i, '')

        let author = 'Unknown'
        let status = 'Ongoing'
        
        // Metadati: NineManga li mette in <li> senza classi specifiche
        $('.book_intro ul li').each((_: any, li: any) => {
            const text = $(li).text().toLowerCase()
            const val = $(li).find('a').text().trim() || $(li).text().split(':')[1]?.trim()

            if (text.includes('autore')) author = val ?? 'Unknown'
            if (text.includes('stato')) {
                if (text.includes('completato')) status = 'Completed'
            }
        })

        const tags: Tag[] = []
        $('.book_intro li[itemprop="genre"] a').each((_: any, a: any) => {
            const label = $(a).text().trim()
            const id = $(a).attr('href')?.split('/').pop()?.replace('.html', '') ?? label
            tags.push(App.createTag({ id, label }))
        })

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: [App.createTagSection({ id: '0', label: 'Generi', tags: tags })],
                desc: desc
            })
        })
    }

    parseChapters($: any): Chapter[] {
        const chapters: Chapter[] = []
        
        // NineManga ha la lista in .sub_vol_ul
        $('.sub_vol_ul > li').each((_: any, li: any) => {
            const link = $(li).find('a.chapter_list_a')
            const href = link.attr('href')
            if (!href) return

            // ID: estraiamo l'hash finale o l'intero nome file
            // Es: /chapter/NomeManga/12345.html -> 12345
            const chapterId = href.split('/').pop()?.replace('.html', '') ?? ''
            
            const rawTitle = link.attr('title') ?? link.text().trim()
            
            // Parsing numero
            const chapMatch = rawTitle.match(/Capitolo\s*(\d+(\.\d+)?)/i) || rawTitle.match(/Ch\.\s*(\d+)/i) || rawTitle.match(/(\d+)$/)
            const chapNum = chapMatch ? parseFloat(chapMatch[1]) : 0

            let name = rawTitle.replace(this.cleanTitle($('.book_intro .title h1').text()), '').trim()
            if (!name) name = `Capitolo ${chapNum}`

            chapters.push(App.createChapter({
                id: chapterId,
                name: name,
                chapNum: chapNum,
                volume: undefined,
                time: new Date(), // Date non sempre affidabili qui
                langCode: 'it',
                sortingIndex: chapters.length // NineManga di solito li mette dal più recente, Paperback ordina
            }))
        })

        return chapters
    }

    parseHomeSections($: any, popular: HomeSection, latest: HomeSection, newManga: HomeSection): void {
        
        // 1. POPOLARI (Hot Book)
        const popularItems: PartialSourceManga[] = []
        // Cerchiamo dentro il div specifico, spesso ha ID diversi ma struttura simile
        // Proviamo a prendere i primi elementi della lista principale se "Hot Book" non ha ID univoco
        // Solitamente è #tab_content_1 o simili. Facciamo un selettore generico sicuro.
        $('.book_list_ul').first().find('li').each((i: number, item: any) => {
            if (i >= 10) return
            popularItems.push(this.parseMangaItem($, item))
        })
        
        // Se non troviamo nulla, proviamo selettore alternativo
        if (popularItems.length === 0) {
             $('.ul-list li').each((i: number, item: any) => {
                if (i >= 10) return
                popularItems.push(this.parseMangaItem($, item))
            })
        }
        popular.items = popularItems

        // 2. LATEST (Spesso a destra o sotto)
        const latestItems: PartialSourceManga[] = []
        $('ul.new_chapter_list li').each((_: any, item: any) => {
            // Struttura diversa qui
            const link = $(item).find('a.book_name')
            const id = link.attr('href')?.split('/manga/')[1]?.replace('.html', '')
            const title = link.text().trim()
            const image = 'https://paperback.moe/icons/logo-alt.svg' // Lista testuale spesso non ha img
            const subtitle = $(item).find('a.chapter_name').last().text().trim()

            if (id) {
                latestItems.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: subtitle
                }))
            }
        })
        latest.items = latestItems

        // 3. NEW (Nuovi arrivi)
        // Usiamo un'altra lista se disponibile, altrimenti riempiamo con i latest
        newManga.items = latestItems.slice().reverse() // Trucco veloce
    }

    // Helper per parsare un blocco manga standard di NineManga
    private parseMangaItem($: any, item: any): PartialSourceManga {
        const link = $(item).find('a.book_list_a')
        const href = link.attr('href')
        const id = href?.split('/manga/')[1]?.replace('.html', '') ?? ''
        
        const title = this.cleanTitle(link.attr('title') ?? $(item).find('p.book_list_name').text())
        const image = this.getImageSrc($(item).find('img'))
        
        return App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: title,
            subtitle: 'Manga'
        })
    }

    parseSearchResults($: any): PartialSourceManga[] {
        const results: PartialSourceManga[] = []
        
        $('.book_list_ul li, ul.direlist li').each((_: any, item: any) => {
            const link = $(item).find('a.book_list_a, a.bookname')
            const href = link.attr('href')
            const id = href?.split('/manga/')[1]?.replace('.html', '')
            
            if (id) {
                const title = this.cleanTitle(link.attr('title') ?? link.text())
                const image = this.getImageSrc($(item).find('img'))
                
                results.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title
                }))
            }
        })
        return results
    }

    parseViewMore($: any): PartialSourceManga[] {
        return this.parseSearchResults($)
    }
}